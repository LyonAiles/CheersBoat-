package fr.nautic.test;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import java.io.IOException;
import java.util.List;
import org.w3c.dom.Element;

final class CameraAxis {
 private static final String AXIS="Axe 46";
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
 static boolean move(Context context,int index,boolean restore)throws Exception{
  synchronized(TrematageSession.class){
   String host=Uri.parse(TrematageAccess.address(context,index)).getHost();
   if(host==null)throw new IOException("Configure la caméra de la vue 46");
   SharedPreferences saved=state(context);
   String returnKey=host+".return",profileKey=host+".profile";
   String previous=saved.getString(returnKey,"");
   if(restore&&previous.isEmpty())throw new IOException("Aucune orientation précédente mémorisée");
   SharedPreferences trematage=TrematageAccess.prefs(context);
   for(String key:trematage.getAll().keySet()){
    if(key.startsWith(host+"|")&&key.endsWith(".active")&&trematage.getBoolean(key,false))
     throw new IOException("Désactive Trématage sur cette caméra avant de changer son orientation");
   }
   SharedPreferences credentials=context.getSharedPreferences("nautic_camera_private",Context.MODE_PRIVATE);
   OnvifCamera camera=new OnvifCamera(host,credentials.getString("username"+index,credentials.getString("username","")),
     credentials.getString("password"+index,credentials.getString("password","")));
   camera.discover();
   Element profile=TrematageProfiles.select(camera.profiles,host,saved.getString(profileKey,""),trematage.getAll());
   if(profile==null||!camera.services.containsKey(OnvifCamera.PTZ))throw new IOException("Objectif motorisé non accessible par ONVIF");
   List<Element> presets=OnvifCamera.elements(camera.ptz(profile,"GetPresets",""),"Preset");
   if(restore){
    if(!previous.equals(token(presets,RETURN)))
     throw new IOException("La position de retour n’est plus disponible dans la caméra");
    go(camera,profile,previous);
    if(!saved.edit().remove(returnKey).remove(profileKey).commit())
     throw new IOException("Retour demandé. L’état du bouton n’a pas pu être enregistré");
    return false;
   }
   String target=token(presets,AXIS);
   if(target.isEmpty())throw new IOException("Oriente l’objectif motorisé dans l’axe de l’objectif fixe, puis mémorise « Axe 46 » dans Tapo");
   if(previous.isEmpty()){
    String existing=token(presets,RETURN);
    String position="<c:PresetName>"+RETURN+"</c:PresetName>";
    if(!existing.isEmpty())position+=presetToken(existing);
    String backup=OnvifCamera.value(camera.ptz(profile,"SetPreset",position),"PresetToken").trim();
    if(backup.isEmpty())throw new IOException("La caméra n’a pas confirmé la position de retour");
    if(!saved.edit().putString(returnKey,backup).putString(profileKey,profile.getAttribute("token")).commit())
     throw new IOException("Impossible d’enregistrer la position de retour");
   }
   go(camera,profile,target);
   return true;
  }
 }
 private static String token(List<Element> presets,String name){
  for(Element preset:presets)
   if(name.equalsIgnoreCase(OnvifCamera.value(preset,"Name").trim()))return preset.getAttribute("token");
  return "";
 }
 private static String presetToken(String token){return "<c:PresetToken>"+OnvifCamera.xml(token)+"</c:PresetToken>";}
 private static void go(OnvifCamera camera,Element profile,String token)throws Exception{
  camera.ptz(profile,"GotoPreset",presetToken(token));
 }
}
