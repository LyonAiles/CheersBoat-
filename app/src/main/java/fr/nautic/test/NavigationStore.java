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
 private String importError="";
 static synchronized NavigationStore get(Context context){
  if(instance==null){instance=new NavigationStore(context.getApplicationContext());instance.seedBundled(context.getApplicationContext());}return instance;
 }
 private NavigationStore(Context context){super(context,"navigation-local.db",null,1);setWriteAheadLoggingEnabled(true);}
 @Override public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE tiles (id TEXT PRIMARY KEY, payload TEXT NOT NULL)");}
 @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion){}
 private void seedBundled(Context context){
  android.content.SharedPreferences prefs=context.getSharedPreferences("nautic_settings",Context.MODE_PRIVATE);
  if(prefs.getBoolean("nautic-idf-bootstrap-v1",false))return;
  try(InputStream input=context.getAssets().open("nautic-signs-idf.js");ByteArrayOutputStream out=new ByteArrayOutputStream()){
   byte[] buffer=new byte[8192];for(int n;(n=input.read(buffer))!=-1;)out.write(buffer,0,n);
   String raw=new String(out.toByteArray(),StandardCharsets.UTF_8),marker="window.NauticSignsIdf=";
   int start=raw.indexOf(marker);if(start<0)return;
   String json=raw.substring(start+marker.length()).trim();if(json.endsWith(";"))json=json.substring(0,json.length()-1);
   JSONObject seed=new JSONObject(json);
   long date=new java.text.SimpleDateFormat("yyyy-MM-dd",java.util.Locale.ROOT).parse(seed.getString("date")).getTime();
   importRegions(new JSONArray().put(new JSONObject().put("time",date).put("elements",seed.getJSONArray("elements"))));
   prefs.edit().putBoolean("nautic-idf-bootstrap-v1",true).apply();
  }catch(Exception error){importError=error.getMessage()==null?"import local interrompu":error.getMessage();}
 }
 synchronized void importRegions(JSONArray regions)throws JSONException{
  java.util.Map<String,JSONObject> grouped=new java.util.LinkedHashMap<>();
  for(int r=0;r<regions.length();r++){
   JSONObject region=regions.optJSONObject(r);if(region==null)continue;
   JSONArray elements=region.optJSONArray("elements");if(elements==null)continue;
   long date=Math.max(0,Math.min(System.currentTimeMillis(),region.optLong("time",0)));
   for(int i=0;i<elements.length();i++){
    JSONObject e=elements.optJSONObject(i);if(e==null)continue;
    JSONObject p=e.has("lat")?e:e.optJSONObject("center");
    if(p==null){JSONArray geometry=e.optJSONArray("geometry");if(geometry!=null&&geometry.length()>0)p=geometry.optJSONObject(geometry.length()/2);}
    if(p==null)continue;double lat=p.optDouble("lat",Double.NaN),lon=p.optDouble("lon",Double.NaN);
    if(!Double.isFinite(lat)||!Double.isFinite(lon)||lat<0||lat>90||lon< -180||lon>180)continue;
    String key="fr-"+(int)Math.floor(lat/.05)+"-"+(int)Math.floor((lon+180)/.075);
    JSONObject tile=grouped.get(key);
    if(tile==null){tile=new JSONObject().put("id",key).put("updated",date).put("complete",false).put("elements",new JSONArray());grouped.put(key,tile);}
    tile.put("updated",Math.min(tile.getLong("updated"),date));tile.getJSONArray("elements").put(e);
   }
  }
  for(java.util.Map.Entry<String,JSONObject> row:grouped.entrySet()){
   JSONObject previous=read(row.getKey()),next=row.getValue();
   // Never replace a complete downloaded lot with a partial legacy/imported lot.
   if(previous!=null&&previous.optBoolean("complete",true))continue;
   java.util.Map<String,JSONObject> unique=new java.util.LinkedHashMap<>();
   for(JSONObject part:new JSONObject[]{previous,next})if(part!=null){
    JSONArray elements=part.getJSONArray("elements");for(int i=0;i<elements.length();i++){JSONObject e=elements.getJSONObject(i);unique.put(e.optString("type")+"/"+e.optLong("id"),e);}
   }
   JSONArray merged=new JSONArray();for(JSONObject e:unique.values())merged.put(e);
   if(previous!=null)next.put("updated",Math.min(previous.optLong("updated",0),next.optLong("updated",0)));
   next.put("elements",merged);save(row.getKey(),next);
  }
 }
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
  java.util.HashSet<String> ids=new java.util.HashSet<>();long bytes=0,oldest=Long.MAX_VALUE,newest=0;int lots=0,partial=0;
  try(Cursor cursor=getReadableDatabase().query("tiles",new String[]{"payload"},null,null,null,null,null)){
   while(cursor.moveToNext()){
    String raw=cursor.getString(0);JSONObject tile=new JSONObject(raw);lots++;if(!tile.optBoolean("complete",true))partial++;bytes+=raw.getBytes(StandardCharsets.UTF_8).length;
    long date=tile.optLong("updated",0);if(date>0){oldest=Math.min(oldest,date);newest=Math.max(newest,date);}
    JSONArray elements=tile.getJSONArray("elements");
    for(int i=0;i<elements.length();i++){JSONObject e=elements.getJSONObject(i);ids.add(e.optString("type")+"/"+e.optLong("id"));}
   }
  }
  cachedStats=new JSONObject().put("importError",importError).put("partialLots",partial).put("lots",lots).put("objects",ids.size()).put("bytes",bytes)
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
