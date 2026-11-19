package fr.nautic.test;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.content.ContentValues;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import org.json.*;

/** Static navigation tiles. Each validated replacement is committed atomically. */
final class NavigationStore extends SQLiteOpenHelper {
 private static NavigationStore instance;
 private JSONObject cachedStats;
 static synchronized NavigationStore get(Context context){
  if(instance==null)instance=new NavigationStore(context.getApplicationContext());return instance;
 }
 private NavigationStore(Context context){super(context,"navigation-local.db",null,1);setWriteAheadLoggingEnabled(true);}
 @Override public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE tiles (id TEXT PRIMARY KEY, payload TEXT NOT NULL)");}
 @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion){}
 synchronized JSONObject read(String key)throws JSONException{
  try(Cursor cursor=getReadableDatabase().query("tiles",new String[]{"payload"},"id=?",new String[]{key},null,null,null)){
   return cursor.moveToFirst()?new JSONObject(cursor.getString(0)):null;
  }
 }
 synchronized void save(String key,JSONObject entry)throws JSONException{
  if(!key.matches("fr-[0-9]+-[0-9]+")||!entry.has("updated")||!(entry.opt("elements") instanceof JSONArray))throw new JSONException("lot invalide");
  JSONObject stable=new JSONObject(entry.toString());
  ContentValues values=new ContentValues();values.put("id",key);values.put("payload",stable.toString());
  cachedStats=null;
  if(getWritableDatabase().insertWithOnConflict("tiles",null,values,SQLiteDatabase.CONFLICT_REPLACE)<0)throw new android.database.sqlite.SQLiteException("enregistrement local impossible");
 }
 synchronized JSONObject stats()throws JSONException{
  if(cachedStats!=null)return cachedStats;
  java.util.HashSet<String> ids=new java.util.HashSet<>();long bytes=0,oldest=Long.MAX_VALUE,newest=0;int lots=0;
  try(Cursor cursor=getReadableDatabase().query("tiles",new String[]{"payload"},null,null,null,null,null)){
   while(cursor.moveToNext()){
    String raw=cursor.getString(0);JSONObject tile=new JSONObject(raw);lots++;bytes+=raw.getBytes(StandardCharsets.UTF_8).length;
    long date=tile.optLong("updated",0);if(date>0){oldest=Math.min(oldest,date);newest=Math.max(newest,date);}
    JSONArray elements=tile.getJSONArray("elements");
    for(int i=0;i<elements.length();i++){JSONObject e=elements.getJSONObject(i);ids.add(e.optString("type")+"/"+e.optLong("id"));}
   }
  }
  cachedStats=new JSONObject().put("lots",lots).put("objects",ids.size()).put("bytes",bytes)
   .put("oldest",oldest==Long.MAX_VALUE?0:oldest).put("newest",newest);
  return cachedStats;
 }
 static JSONObject shared(String base,String key)throws Exception{
  if(base==null||base.isEmpty())return null;
  URL url=new URL(base.replaceAll("/+$","")+"/"+key+".json");
  if(!url.getProtocol().equals("https"))throw new IOException("base partagée HTTPS requise");
  HttpURLConnection c=(HttpURLConnection)url.openConnection();
  try{
   c.setConnectTimeout(5000);c.setReadTimeout(10000);c.setRequestProperty("Accept","application/json");
   c.setInstanceFollowRedirects(false);
   if(c.getResponseCode()!=200)throw new IOException("base réseau HTTP "+c.getResponseCode());
   try(InputStream input=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
    byte[] buffer=new byte[8192];for(int n;(n=input.read(buffer))!=-1;){if(out.size()+n>2000000)throw new IOException("lot trop volumineux");out.write(buffer,0,n);}
    JSONObject entry=new JSONObject(new String(out.toByteArray(),StandardCharsets.UTF_8));
    long updated=entry.optLong("updated",0);
    if(!key.equals(entry.optString("id"))||updated<=0||updated>System.currentTimeMillis()+300000||!(entry.opt("elements") instanceof JSONArray))throw new IOException("lot réseau invalide");
    return entry;
   }
  }finally{c.disconnect();}
 }
}
