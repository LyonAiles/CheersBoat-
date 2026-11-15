package fr.nautic.test;

import android.content.SharedPreferences;
import android.net.Uri;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import java.io.IOException;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

final class MapCameraControls {
 private static final String IMAGING="http://www.onvif.org/ver20/imaging/wsdl";
 private static final String DEVICE_IO="http://www.onvif.org/ver10/deviceIO/wsdl";

 static OnvifCamera discover(MainActivity activity,int index)throws Exception {
  Uri address=Uri.parse(TrematageAccess.address(activity,index));
  String host=address.getHost();
  if(host==null||host.isEmpty())throw new IOException("Adresse caméra manquante");
  SharedPreferences prefs=activity.getSharedPreferences("nautic_camera_private",MainActivity.MODE_PRIVATE);
  String user=prefs.getString("username"+index,prefs.getString("username",""));
  String pass=prefs.getString("password"+index,prefs.getString("password",""));
  if(user.isEmpty())throw new IOException("Identifiants locaux caméra manquants");
  OnvifCamera camera=new OnvifCamera(host,user,pass);
  camera.discover();
  return camera;
 }

 static String night(OnvifCamera camera,String mode)throws Exception {
  String endpoint=camera.services.get(IMAGING);
  if(endpoint==null)return null;
  Set<String> sources=new LinkedHashSet<>();
  for(Element profile:camera.profiles){
   for(Element config:OnvifCamera.elements(profile,"VideoSourceConfiguration")){
    String source=OnvifCamera.value(config,"SourceToken").trim();
    if(!source.isEmpty())sources.add(source);
   }
  }
  String media=camera.services.get(OnvifCamera.MEDIA);
  if(media!=null)try{
   Document response=camera.call(media,OnvifCamera.MEDIA,"GetVideoSources","");
   for(Element source:OnvifCamera.elements(response,"VideoSources")){
    String token=source.getAttribute("token").trim();
    if(!token.isEmpty())sources.add(token);
   }
  }catch(Exception ignored){}

  int applied=0,failed=0;
  for(String source:sources){
   String token="<c:VideoSourceToken>"+OnvifCamera.xml(source)+"</c:VideoSourceToken>";
   try{
    Document options=camera.call(endpoint,IMAGING,"GetOptions",token);
    if(!supportsNightMode(options,mode))continue;
    camera.call(endpoint,IMAGING,"SetImagingSettings",token+
     "<c:ImagingSettings><tt:IrCutFilter>"+mode+"</tt:IrCutFilter></c:ImagingSettings>"+
     "<c:ForcePersistence>true</c:ForcePersistence>");
    applied++;
   }catch(Exception e){failed++;}
  }
  if(applied==0&&failed>0)throw new IOException("La caméra n’a pas accepté le mode jour/nuit");
  if(applied==0)return null;
  return "Jour / nuit appliqué · "+applied+"/"+sources.size()+" source(s) vidéo";
 }

 static boolean supportsNightMode(Document options,String mode) {
  if(!"ON".equals(mode)&&!"OFF".equals(mode)&&!"AUTO".equals(mode))return false;
  for(Element option:OnvifCamera.elements(options,"IrCutFilter")){
   if(mode.equals(option.getTextContent().trim()))return true;
  }
  return false;
 }

 static String lights(OnvifCamera camera,boolean on)throws Exception {
  String endpoint=camera.services.get(DEVICE_IO);
  String service=endpoint==null?OnvifCamera.DEVICE:DEVICE_IO;
  if(endpoint==null)endpoint=camera.device;
  Document outputs;
  try{outputs=camera.call(endpoint,service,"GetRelayOutputs","");}
  catch(Exception e){return null;}
  int count=0;
  for(Element output:OnvifCamera.elements(outputs,"RelayOutputs")){
   String token=output.getAttribute("token");
   if(!isLightRelay(token,OnvifCamera.value(output,"Name")))continue;
   camera.call(endpoint,service,"SetRelayOutputState",
    "<c:RelayOutputToken>"+OnvifCamera.xml(token)+"</c:RelayOutputToken>"+
    "<c:LogicalState>"+(on?"active":"inactive")+"</c:LogicalState>");
   count++;
  }
  return count==0?null:on?"Projecteurs allumés":"Projecteurs éteints";
 }

 static boolean isLightRelay(String token,String label) {
  if(token==null||token.isEmpty())return false;
  String id=(token+" "+label).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]","");
  return id.contains("spotlight")||id.contains("floodlight")||id.contains("whitelamp")||id.contains("projecteur");
 }
}
