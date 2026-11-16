package fr.nautic.test;

import android.net.Uri;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

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
     if(bytes.size()+length>128000)throw new IOException("Réponse trop longue");
     bytes.write(buffer,0,length);
    }
    return new String(bytes.toByteArray(),StandardCharsets.UTF_8);
   }
  }finally{connection.disconnect();}
 }
}
