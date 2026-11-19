package fr.nautic.test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

final class NauticSigns {
 private static final String[] ENDPOINTS={
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
 };

 static JSONArray lookup(double south,double west,double north,double east) throws IOException {
  if(!(south>=-90&&north<=90&&west>=-180&&east<=180&&south<north&&west<east
    &&north-south<=1.41&&east-west<=2.11))throw new IOException("zone hors limites");
  String area="("+south+","+west+","+north+","+east+")";
  String query="[out:json][timeout:18];(nwr[\"seamark:type\"=\"notice\"]"+area
    +";nwr[\"seamark:notice:category\"]"+area+";);out center;";
  return lookupQuery(query);
 }

 static JSONArray lookupQuery(String query) throws IOException {
  if(query==null||query.length()>16000||!query.startsWith("[out:json]"))throw new IOException("requête invalide");
  byte[] payload=("data="+URLEncoder.encode(query,"UTF-8")).getBytes(StandardCharsets.UTF_8);
  Set<String> errors=new LinkedHashSet<>();
  for(String endpoint:ENDPOINTS){
   try{return request(endpoint,payload);}
   catch(SocketTimeoutException error){errors.add("délai réseau dépassé");}
   catch(Exception error){errors.add(error instanceof IOException&&error.getMessage()!=null
     &&error.getMessage().startsWith("HTTP ")?error.getMessage():"connexion ou réponse invalide");}
  }
  throw new IOException(android.text.TextUtils.join(" / ",errors));
 }

 private static JSONArray request(String endpoint,byte[] payload) throws Exception {
  HttpURLConnection connection=(HttpURLConnection)new URL(endpoint).openConnection();
  try{
   connection.setConnectTimeout(7000);
   connection.setReadTimeout(22000);
   connection.setInstanceFollowRedirects(false);
   connection.setRequestMethod("POST");
   connection.setRequestProperty("Content-Type","application/x-www-form-urlencoded");
   connection.setRequestProperty("Accept","application/json");
   connection.setDoOutput(true);
   connection.setFixedLengthStreamingMode(payload.length);
   try(OutputStream output=connection.getOutputStream()){output.write(payload);}
   int status=connection.getResponseCode();
   if(status!=200)throw new IOException("HTTP "+status);
   try(InputStream input=connection.getInputStream();ByteArrayOutputStream body=new ByteArrayOutputStream()){
    byte[] buffer=new byte[8192];
    for(int n;(n=input.read(buffer))!=-1;){
     if(body.size()+n>2_000_000)throw new IOException("réponse trop volumineuse");
     body.write(buffer,0,n);
    }
    JSONObject data=new JSONObject(new String(body.toByteArray(),StandardCharsets.UTF_8));
    if(data.has("remark"))throw new IOException("réponse incomplète");
    return data.getJSONArray("elements");
   }
  }finally{connection.disconnect();}
 }
}
