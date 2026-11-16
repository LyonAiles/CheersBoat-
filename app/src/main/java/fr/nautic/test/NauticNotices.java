package fr.nautic.test;

import android.net.Uri;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;

final class NauticNotices {
 static String lookup()throws IOException{
  String filter="countryCode eq 'FR' and (number eq '2026/8405/0' or number eq '2026/8406/0')";
  String endpoint="https://www.eurisportal.eu/api/v3/nts?%24filter="+Uri.encode(filter);
  return read(endpoint);
 }

 static String searchCity(String name)throws IOException{
  if(name==null||name.trim().length()<2||name.length()>100)throw new IOException("Nom de commune invalide");
  return read("https://geo.api.gouv.fr/communes?fields=nom,codeDepartement,centre,mairie&boost=population&limit=8&nom="+Uri.encode(name.trim()));
 }

 static String lookupImpacts(String routes)throws IOException,JSONException{
  JSONArray codes=new JSONArray(routes);
  Set<String> scopes=new HashSet<>();
  Set<String> countries=new LinkedHashSet<>();
  for(int i=0;i<codes.length();i++){
   String value=codes.optString(i);
   if(!value.matches("FR[0-9]{3}|(?:FR|BE)[A-Z0-9]{5}"))continue;
   scopes.add(value);countries.add(value.substring(0,2));
  }
  JSONArray impacts=new JSONArray(), refs=new JSONArray();
  if(countries.isEmpty())return new JSONObject().put("items",impacts).put("refs",refs).put("scopes",new JSONArray(scopes)).toString();
  List<String> regions=new ArrayList<>();
  for(String country:countries)regions.add("countryCode eq '"+country+"'");
  SimpleDateFormat date=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);
  date.setTimeZone(TimeZone.getTimeZone("UTC"));
  String filter="("+android.text.TextUtils.join(" or ",regions)+") and dateEnd ge "+date.format(new Date())+"T00:00:00Z";
  Set<String> objectIds=new LinkedHashSet<>();
  final int pageSize=100;
  for(String shape:new String[]{"lines","points"}){
   for(int offset=0;;offset+=pageSize){
    if(offset>=10000)throw new IOException("Liste des avis incomplète");
    JSONObject page=query("/api/v3/route-impact/"+shape,filter,
      "&%24count=true&%24top="+pageSize+"&%24skip="+offset+"&%24orderby=id");
    JSONArray items=page.getJSONArray("items");
    for(int i=0;i<items.length();i++){
     JSONObject item=items.getJSONObject(i);
     String start=item.optString("isrsStart",item.optString("isrs",""));
     String end=item.optString("isrsEnd","");
     if(!scopes.contains(scope(start))&&!scopes.contains(scope(end)))continue;
     impacts.put(item);
     addObject(objectIds,start);addObject(objectIds,end);
    }
    if(items.length()<pageSize||offset+items.length()>=page.optInt("count",Integer.MAX_VALUE))break;
   }
  }
  List<String> refFilters=new ArrayList<>();
  for(String id:objectIds)refFilters.add("isrs eq '"+id+"'");
  for(int i=0;i<refFilters.size();i+=25){
   int end=Math.min(i+25,refFilters.size());
   try{
    JSONArray items=query("/visuris/api/RisIndices_v2/GetRISIndexObjects",
      android.text.TextUtils.join(" or ",refFilters.subList(i,end)),"&%24top=25").getJSONArray("items");
    for(int j=0;j<items.length();j++)refs.put(items.getJSONObject(j));
   }catch(IOException ignored){
    // The notice is still useful in the list when its location service is unavailable.
   }
  }
  return new JSONObject().put("items",impacts).put("refs",refs).put("scopes",new JSONArray(scopes)).toString();
 }

 private static void addObject(Set<String> ids,String id){
  if(id.matches("[A-Z0-9]{20}"))ids.add(id);
 }

 private static String scope(String id){
  if(id.length()!=20)return "";
  String value=id.substring(0,2)+id.substring(5,10);
  return value.matches("FR[A-Z]{2}[0-9]{3}")?"FR"+value.substring(4):value;
 }

 private static JSONObject query(String path,String filter,String suffix)throws IOException,JSONException{
  return new JSONObject(read("https://www.eurisportal.eu"+path+"?%24filter="+Uri.encode(filter)+suffix));
 }

 private static String read(String endpoint)throws IOException{
  HttpURLConnection connection=(HttpURLConnection)new URL(endpoint).openConnection();
  connection.setConnectTimeout(6000);
  connection.setReadTimeout(9000);
  connection.setInstanceFollowRedirects(false);
  connection.setRequestProperty("Accept","application/json");
  try{
   if(connection.getResponseCode()!=200)throw new IOException("Service indisponible");
   try(InputStream stream=connection.getInputStream()){
    ByteArrayOutputStream bytes=new ByteArrayOutputStream();
    byte[] buffer=new byte[2048];
    for(int length;(length=stream.read(buffer))!=-1;){
     if(bytes.size()+length>750000)throw new IOException("Réponse trop longue");
     bytes.write(buffer,0,length);
    }
    return new String(bytes.toByteArray(),StandardCharsets.UTF_8);
   }
  }finally{connection.disconnect();}
 }
}
