package fr.nautic.test;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.util.AtomicFile;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.concurrent.*;

/** Compact local event journal. No URLs, credentials or video content. Never called per frame. */
final class OperationLog {
 private static final ScheduledExecutorService worker=Executors.newSingleThreadScheduledExecutor();
 private static final ArrayDeque<String> rows=new ArrayDeque<>();
 private static boolean loaded;
 private static ScheduledFuture<?> flush;
 private static final java.util.LinkedHashMap<String,Long> recent=new java.util.LinkedHashMap<>();
 private static AtomicFile file(Context c){return new AtomicFile(new File(c.getFilesDir(),"operations.json"));}
 private static void load(Context c){
  if(loaded)return;loaded=true;
  try(FileInputStream in=file(c).openRead()){
   ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] bytes=new byte[4096];int n;
   while((n=in.read(bytes))!=-1){if(out.size()+n>100000)return;out.write(bytes,0,n);}
   JSONArray saved=new JSONArray(out.toString("UTF-8"));
   for(int i=Math.max(0,saved.length()-400);i<saved.length();i++)rows.add(saved.getString(i));
  }catch(Exception ignored){}
 }
 private static void save(Context c){
  AtomicFile target=file(c);FileOutputStream out=null;
  try{out=target.startWrite();out.write(new JSONArray(rows).toString().getBytes(StandardCharsets.UTF_8));target.finishWrite(out);}
  catch(Exception ignored){if(out!=null)target.failWrite(out);}
 }
 static void add(Context context,int object,String code,String detail){
  Context c=context.getApplicationContext();long now=System.currentTimeMillis();
  // Callers pass numeric references and short internal codes, never device configuration.
  String safe=(code+" "+detail).replaceAll("[^A-Za-z0-9_ :.,=+/-]","?");
  if(safe.length()>140)safe=safe.substring(0,140);
  final String event=object+" "+safe;
  worker.execute(()->{
   load(c);Long prior=recent.get(event);if(prior!=null&&now-prior<5000)return;
   recent.remove(event);recent.put(event,now);while(recent.size()>64)recent.remove(recent.keySet().iterator().next());
   rows.add(now+" "+event);
   while(rows.size()>400)rows.removeFirst();
   if(flush==null||flush.isDone())flush=worker.schedule(()->save(c),1,TimeUnit.SECONDS);
  });
 }
 static String trace(String json){try{
  JSONObject a=new JSONObject(json).optJSONObject("alertTrace");
  return a==null?"":a.optInt("number")+":"+a.optLong("time");
 }catch(Exception ignored){return "";}}
 static void deferred(Context c,String json,String reason){String id=trace(json);if(!id.isEmpty())add(c,46,"WAIT",id+" "+reason);}
 static void open(Activity a){worker.execute(()->{
  load(a);StringBuilder report=new StringBuilder("N1\n");
  java.text.SimpleDateFormat clock=new java.text.SimpleDateFormat("MM-dd HH:mm:ss.SSS",java.util.Locale.ROOT);
  for(String row:rows){int split=row.indexOf(' ');try{report.append(clock.format(new java.util.Date(Long.parseLong(row.substring(0,split))))).append(row.substring(split)).append('\n');}catch(Exception ignored){}}
  String text=report.toString();int count=rows.size();
  a.runOnUiThread(()->{
   if(a.isDestroyed()||a.isFinishing())return;
   TextView view=new TextView(a);view.setText(text);view.setTextSize(11);view.setTypeface(android.graphics.Typeface.MONOSPACE);view.setTextIsSelectable(true);view.setPadding(16,12,16,12);
   ScrollView scroll=new ScrollView(a);scroll.addView(view);
   new AlertDialog.Builder(a).setTitle("Journal des opérations · "+count).setView(scroll)
    .setPositiveButton("Fermer",null).setNeutralButton("Copier",(d,w)->{
     android.content.ClipboardManager clipboard=(android.content.ClipboardManager)a.getSystemService(Context.CLIPBOARD_SERVICE);
     clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Nautic N1",text));
    }).setNegativeButton("Effacer",(d,w)->worker.execute(()->{rows.clear();recent.clear();save(a);})).show();
  });
 });}
}
