package fr.nautic.test;
import android.app.*;
import android.content.*;
import android.widget.*;
/** The shared relay URL identifies a pair. Secrets are kept out of dashboard settings. */
final class RemoteTwinSettings {
 static void open(Activity a){
  SharedPreferences p=RemoteTwinService.prefs(a);LinearLayout box=new LinearLayout(a);box.setOrientation(1);box.setPadding(24,12,24,12);
  CheckBox enabled=new CheckBox(a);enabled.setText("Activer la liaison distante");enabled.setChecked(p.getBoolean("enabled",false));box.addView(enabled);
  Spinner role=new Spinner(a);role.setAdapter(new ArrayAdapter<String>(a,android.R.layout.simple_spinner_dropdown_item,new String[]{"À bord · transmettre","À distance · recevoir"}));role.setSelection("viewer".equals(p.getString("role","boat"))?1:0);box.addView(role);
  EditText url=new EditText(a);url.setHint("URL HTTPS du relais de cette paire");url.setSingleLine(true);url.setInputType(17);url.setText(p.getString("url",""));box.addView(url);
  EditText token=new EditText(a);token.setHint("Clé de jumelage commune (24 caractères minimum)");token.setSingleLine(true);token.setInputType(129);token.setText(p.getString("token",""));box.addView(token);
  TextView info=new TextView(a);info.setText("Configurer la même URL et la même clé sur les deux appareils. Un relais HTTPS compatible est requis. Cette version échange les états des veilles et leurs dernières alertes, sans vidéo ni commande distante.\n\n"+p.getString("status","Relais non configuré"));box.addView(info);
  String raw=p.getString("remoteState","");if(!raw.isEmpty())try{org.json.JSONObject state=new org.json.JSONObject(raw);long age=Math.max(0,System.currentTimeMillis()-state.optLong("sentAt",0))/1000;info.append("\nDernier état à bord : il y a "+age+" s");for(String id:new String[]{"42","44"}){org.json.JSONObject cam=state.optJSONObject("camera"+id);if(cam!=null)info.append("\nCaméra "+id+" : "+(cam.optBoolean("active")?"veille activée":"veille désactivée")+"\n"+cam.optString("alert"));}}catch(Exception ignored){}
  ScrollView scroll=new ScrollView(a);scroll.addView(box);
  AlertDialog dialog=new AlertDialog.Builder(a).setTitle("Jumelle distante · module préparatoire").setView(scroll).setNegativeButton("Fermer",null).setPositiveButton("Enregistrer",null).create();dialog.setOnShowListener(d->dialog.getButton(-1).setOnClickListener(v->{
   String endpoint=url.getText().toString().trim(),secret=token.getText().toString().trim();
   if(enabled.isChecked()){try{java.net.URL parsed=new java.net.URL(endpoint);if(!"https".equals(parsed.getProtocol())||parsed.getUserInfo()!=null||secret.length()<24||secret.contains("\r")||secret.contains("\n"))throw new Exception();}catch(Exception e){Toast.makeText(a,"URL HTTPS et clé d’au moins 24 caractères nécessaires",Toast.LENGTH_LONG).show();return;}}
   if(!p.edit().putBoolean("enabled",enabled.isChecked()).putString("role",role.getSelectedItemPosition()==0?"boat":"viewer").putString("url",endpoint).putString("token",secret).remove("remoteState").commit()){Toast.makeText(a,"Enregistrement impossible",Toast.LENGTH_LONG).show();return;}
   RemoteTwinService.apply(a);dialog.dismiss();
  }));dialog.show();
 }
}
