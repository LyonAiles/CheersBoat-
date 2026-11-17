package fr.nautic.test;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import java.io.IOException;
import java.util.List;
import org.w3c.dom.Element;

final class CameraAxis {
 private static final String RETURN="Nautic 46 retour";
 private static SharedPreferences state(Context context){
  return context.getSharedPreferences("nautic_camera_axis",Context.MODE_PRIVATE);
 }
 static boolean hasReturn(Context context,String host){
  return host!=null&&!state(context).getString(host+".return","").isEmpty();
 }
 static boolean hasReturn(Context context,int index)throws Exception{
  return hasReturn(context,Uri.parse(TrematageAccess.address(context,index)).getHost());
 }
 static void move(Context context,int index,String direction)throws Exception{
  synchronized(TrematageSession.class){
   String host=Uri.parse(TrematageAccess.address(context,index)).getHost();
   if(host==null)throw new IOException("Configure la caméra de la vue 46");
   SharedPreferences saved=state(context);
   SharedPreferences trematage=TrematageAccess.prefs(context);
   for(String key:trematage.getAll().keySet()){
    if(key.startsWith(host+"|")&&key.endsWith(".active")&&trematage.getBoolean(key,false))
     throw new IOException("Désactive la veille Trématage avant de réorienter cette caméra");
   }
   SharedPreferences credentials=context.getSharedPreferences("nautic_camera_private",Context.MODE_PRIVATE);
   OnvifCamera camera=new OnvifCamera(host,credentials.getString("username"+index,credentials.getString("username","")),
     credentials.getString("password"+index,credentials.getString("password","")));
   camera.discover();
   if(!camera.services.containsKey(OnvifCamera.PTZ))throw new IOException("Service motorisé ONVIF indisponible");
   boolean restore="RETOUR".equals(direction);
   String previous=saved.getString(host+".return","");
   if(restore&&previous.isEmpty())throw new IOException("Aucune orientation précédente mémorisée");
   java.util.List<Element> profiles=new java.util.ArrayList<>();
   Element preferred=TrematageProfiles.select(camera.profiles,host,
     saved.getString(host+".profile",trematage.getString("shortcutProfile","")),trematage.getAll());
   if(preferred!=null)profiles.add(preferred);
   for(Element profile:camera.profiles)
    if(profile!=preferred&&!OnvifCamera.elements(profile,"PTZConfiguration").isEmpty())profiles.add(profile);
   if(profiles.isEmpty())throw new IOException("Objectif motorisé non accessible par ONVIF");
   Exception failure=null;
   boolean found=false;
   java.util.Set<String> names=new java.util.LinkedHashSet<>();
   for(Element profile:profiles){
    try{
     List<Element> presets=OnvifCamera.elements(camera.ptz(profile,"GetPresets",""),"Preset");
     for(Element preset:presets){
      String name=OnvifCamera.value(preset,"Name").trim();
      if(!name.isEmpty())names.add(name);
     }
     String target=token(presets,restore?RETURN:direction);
     if(target.isEmpty()||(restore&&!previous.equals(target)))continue;
     found=true;
     camera.ptz(profile,"GotoPreset",presetToken(target));
     saved.edit().remove(host+".return").remove(host+".profile").apply();
     return;
    }catch(Exception error){failure=error;}
   }
   if(failure!=null&&(found||names.isEmpty()))throw failure;
   if(restore)throw new IOException("La position de retour n’est plus disponible dans la caméra");
   throw new IOException("Position « "+direction+" » introuvable. Positions lisibles : "+
     (names.isEmpty()?"aucune":android.text.TextUtils.join(", ",names))+".");
  }
 }
 static String normalize(String value){
  return java.text.Normalizer.normalize(value.trim(),java.text.Normalizer.Form.NFD)
    .replaceAll("\\p{M}","").toUpperCase(java.util.Locale.ROOT);
 }
 private static String token(List<Element> presets,String name){
  for(Element preset:presets)
   if(normalize(name).equals(normalize(OnvifCamera.value(preset,"Name"))))return preset.getAttribute("token");
  return "";
 }
 private static String presetToken(String token){return "<c:PresetToken>"+OnvifCamera.xml(token)+"</c:PresetToken>";}
}
