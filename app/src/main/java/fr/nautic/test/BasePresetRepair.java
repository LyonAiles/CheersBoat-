package fr.nautic.test;

import java.io.IOException;
import java.util.*;
import org.w3c.dom.*;

/** Explicit repair only. SetPreset also records coordinates, so verify arrival before renaming. */
final class BasePresetRepair {
 private final OnvifCamera camera;private final Element profile;
 BasePresetRepair(OnvifCamera camera,Element profile){this.camera=camera;this.profile=profile;}
 private List<Element> presets()throws Exception{return OnvifCamera.elements(camera.ptz(profile,"GetPresets",""),"Preset");}
 static boolean samePosition(Element target,Element current){
  if(target==null||current==null)return false;
  for(String axis:new String[]{"PanTilt","Zoom"}){
   List<Element> expected=OnvifCamera.elements(target,axis),actual=OnvifCamera.elements(current,axis);
   if(expected.isEmpty()){if(axis.equals("PanTilt"))return false;continue;}
   if(actual.isEmpty())return false;Element a=expected.get(0),b=actual.get(0);
   if(!a.getAttribute("space").isEmpty()&&!a.getAttribute("space").equals(b.getAttribute("space")))return false;
   for(String coordinate:axis.equals("PanTilt")?new String[]{"x","y"}:new String[]{"x"})try{
    double x=Double.parseDouble(a.getAttribute(coordinate)),y=Double.parseDouble(b.getAttribute(coordinate));
    if(Double.isNaN(x)||Double.isInfinite(x)||Double.isNaN(y)||Double.isInfinite(y)||Math.abs(x-y)>.001)return false;
   }catch(Exception e){return false;}
  }return true;
 }
 private Element position(Node n,String name){List<Element> found=OnvifCamera.elements(n,name);return found.isEmpty()?null:found.get(0);}
 String restore(String rememberedToken)throws Exception{
  List<Element> all=presets(),old=new ArrayList<>();Element candidate=null;
  for(Element p:all){String name=OnvifCamera.value(p,"Name").trim();
   if(name.equalsIgnoreCase("BASE")){String token=p.getAttribute("token");camera.ptz(profile,"GotoPreset","<c:PresetToken>"+OnvifCamera.xml(token)+"</c:PresetToken>");return token;}
   if(name.startsWith("Nautic retour ")){old.add(p);if(p.getAttribute("token").equals(rememberedToken))candidate=p;}
  }
  if(candidate==null&&old.size()==1)candidate=old.get(0);
  if(candidate==null)throw new IOException("Ancienne position BASE non identifiable ; choisir son nom dans Tapo");
  Element target=position(candidate,"PTZPosition");
  if(target==null||!samePosition(target,target))throw new IOException("Coordonnées non fournies par la caméra ; renommer la position en BASE dans Tapo");
  String token=candidate.getAttribute("token");
  camera.ptz(profile,"GotoPreset","<c:PresetToken>"+OnvifCamera.xml(token)+"</c:PresetToken>");
  long deadline=System.nanoTime()+8000000000L;int stable=0;
  while(System.nanoTime()<deadline){
   Document status=camera.ptz(profile,"GetStatus","");Element actual=position(status,"Position"),movement=position(status,"MoveStatus");
   boolean idle=movement!=null&&"IDLE".equalsIgnoreCase(OnvifCamera.value(movement,"PanTilt"));
   String zoom=movement==null?"":OnvifCamera.value(movement,"Zoom");if(!zoom.isEmpty()&&!zoom.equalsIgnoreCase("IDLE"))idle=false;
   stable=idle&&samePosition(target,actual)?stable+1:0;if(stable>=2)break;Thread.sleep(350);
  }
  if(stable<2)throw new IOException("Position non confirmée : aucun nom modifié ; renommer en BASE dans Tapo");
  camera.ptz(profile,"SetPreset","<c:PresetName>BASE</c:PresetName><c:PresetToken>"+OnvifCamera.xml(token)+"</c:PresetToken>");
  for(Element p:presets())if(p.getAttribute("token").equals(token)&&"BASE".equalsIgnoreCase(OnvifCamera.value(p,"Name").trim())&&samePosition(target,position(p,"PTZPosition")))return token;
  throw new IOException("Restauration non confirmée par la caméra ; vérifier BASE dans Tapo");
 }
}
