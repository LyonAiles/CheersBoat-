package fr.nautic.test;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.os.*;
import android.text.*;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.widget.*;
import java.io.*;

/** Local draft, saved on edits and close. Export clears it only after successful file closure. */
final class NotesPad {
 static final int SAVE_FILE=231;
 private final Activity activity;private final Runnable dismissed;
 private final android.content.SharedPreferences prefs;
 private Dialog dialog;private EditText editor;
 NotesPad(Activity activity,Runnable dismissed){this.activity=activity;this.dismissed=dismissed;prefs=activity.getSharedPreferences("nautic_notes",0);}
 boolean isShowing(){return dialog!=null&&dialog.isShowing();}
 private int dp(int n){return (int)(n*activity.getResources().getDisplayMetrics().density+.5f);}
 private void save(){if(editor!=null)prefs.edit().putString("draft",editor.getText().toString()).commit();}
 void show(){
  if(isShowing())return;
  dialog=new Dialog(activity);dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
  LinearLayout page=new LinearLayout(activity);page.setOrientation(LinearLayout.VERTICAL);page.setPadding(dp(12),dp(10),dp(12),dp(10));page.setBackgroundColor(0xff082438);
  LinearLayout bar=new LinearLayout(activity);bar.setGravity(Gravity.CENTER_VERTICAL);
  TextView title=new TextView(activity);title.setText("Bloc-notes");title.setTextColor(Color.WHITE);title.setTextSize(21);bar.addView(title,new LinearLayout.LayoutParams(0,-2,1));
  Button close=new Button(activity);close.setText("✕");close.setContentDescription("Mémoriser et fermer");close.setOnClickListener(v->dialog.dismiss());bar.addView(close,new LinearLayout.LayoutParams(dp(56),dp(48)));page.addView(bar);
  editor=new EditText(activity);editor.setTextColor(Color.WHITE);editor.setHintTextColor(0xffa4c2d5);editor.setHint("Écrire une note…");editor.setGravity(Gravity.TOP);editor.setTextSize(18);editor.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE|InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);editor.setHorizontallyScrolling(false);editor.setImeOptions(android.view.inputmethod.EditorInfo.IME_FLAG_NO_EXTRACT_UI);
  editor.setText(prefs.getString("draft",""));editor.setSelection(editor.length());
  editor.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){prefs.edit().putString("draft",s.toString()).apply();}public void afterTextChanged(Editable e){}});
  page.addView(editor,new LinearLayout.LayoutParams(-1,0,1));
  Button export=new Button(activity);export.setText("Copier dans un fichier et fermer");page.addView(export,new LinearLayout.LayoutParams(-1,-2));export.setOnClickListener(v->{
   save();String text=editor.getText().toString();if(text.trim().isEmpty()){Toast.makeText(activity,"Le bloc-notes est vide",Toast.LENGTH_SHORT).show();return;}
   if(!prefs.edit().putString("pendingExport",text).commit()){Toast.makeText(activity,"Mémorisation impossible : notes conservées",Toast.LENGTH_LONG).show();return;}
   try{Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("text/plain");
    intent.putExtra(Intent.EXTRA_TITLE,"Nautic-notes-"+new java.text.SimpleDateFormat("yyyyMMdd-HHmmss",java.util.Locale.FRANCE).format(new java.util.Date())+".txt");activity.startActivityForResult(intent,SAVE_FILE);
   }catch(Exception e){prefs.edit().remove("pendingExport").apply();Toast.makeText(activity,"Enregistrement de fichier indisponible : notes conservées",Toast.LENGTH_LONG).show();}
  });
  dialog.setContentView(page);dialog.setOnDismissListener(d->{save();((InputMethodManager)activity.getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(editor.getWindowToken(),0);dismissed.run();});
  dialog.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE|WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);dialog.show();dialog.getWindow().setLayout(-1,-1);
  editor.requestFocus();editor.postDelayed(()->{if(isShowing())((InputMethodManager)activity.getSystemService(Context.INPUT_METHOD_SERVICE)).showSoftInput(editor,InputMethodManager.SHOW_IMPLICIT);},180);
 }
 boolean result(int request,int result,Intent data){
  if(request!=SAVE_FILE)return false;
  if(result!=Activity.RESULT_OK||data==null||data.getData()==null){prefs.edit().remove("pendingExport").apply();return true;}
  String snapshot=prefs.getString("pendingExport",null);if(snapshot==null)return true;
  try{
   NotesDocument.export(activity.getContentResolver().openOutputStream(data.getData(),"wt"),snapshot,new NotesDocument.Store(){public String read(){return prefs.getString("draft","");}public void save(String value)throws IOException{if(!prefs.edit().putString("draft",value).commit())throw new IOException("Notes non mémorisées");}});
   prefs.edit().remove("pendingExport").apply();if(editor!=null)editor.setText(prefs.getString("draft",""));if(isShowing())dialog.dismiss();Toast.makeText(activity,"Fichier enregistré",Toast.LENGTH_LONG).show();
  }catch(Exception e){prefs.edit().remove("pendingExport").apply();Toast.makeText(activity,"Échec de l’enregistrement : notes conservées",Toast.LENGTH_LONG).show();}
  return true;
 }
 void destroy(){save();if(isShowing()){dialog.setOnDismissListener(null);dialog.dismiss();}}
}
