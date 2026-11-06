package fr.nautic.test;

import java.io.IOException;
import java.text.Normalizer;
import java.util.List;
import org.w3c.dom.*;

/** A return preset is committed before moving, and survives a failed command or app restart. */
final class TrematageSession {
 interface Store {String backup();boolean armed();void save(String backup,boolean armed)throws Exception;}
 private final OnvifCamera camera;
 private final Element profile;
 private final Store store;
 TrematageSession(OnvifCamera camera,Element profile,Store store){this.camera=camera;this.profile=profile;this.store=store;}
 private List<Element> presets()throws Exception{return OnvifCamera.elements(camera.ptz(profile,"GetPresets",""),"Preset");}
 static boolean named(String name){return Normalizer.normalize(name.trim(),Normalizer.Form.NFD).replaceAll("\\p{M}","").equalsIgnoreCase("Trematage");}
 private String destination(List<Element> list){for(Element e:list)if(named(OnvifCamera.value(e,"Name")))return e.getAttribute("token");return "";}
 private void go(String token)throws Exception{camera.ptz(profile,"GotoPreset","<c:PresetToken>"+OnvifCamera.xml(token)+"</c:PresetToken>");}
 void remember()throws Exception{synchronized(TrematageSession.class){
  if(store.armed())throw new IOException("Désactiver Trématage avant de modifier sa position");
  String old=destination(presets());
  camera.ptz(profile,"SetPreset","<c:PresetName>Trématage</c:PresetName>"+(old.isEmpty()?"":"<c:PresetToken>"+OnvifCamera.xml(old)+"</c:PresetToken>"));
 }}
 void activate()throws Exception{synchronized(TrematageSession.class){
  if(store.armed())return; // Never replace the original return position on repeated activation.
  List<Element> list=presets();String target=destination(list);
  if(target.isEmpty())throw new IOException("Orienter l’objectif vers l’arrière puis mémoriser Trématage");
  String base="";for(Element e:list)if("BASE".equalsIgnoreCase(OnvifCamera.value(e,"Name").trim())){base=e.getAttribute("token");break;}
  if(base.isEmpty())throw new IOException("Position BASE introuvable : la mémoriser dans la caméra avant d’activer Trématage");
  store.save(base,true);
  go(target);
 }}
 void deactivate()throws Exception{synchronized(TrematageSession.class){
  if(!store.armed())return;
  String base="";for(Element e:presets())if("BASE".equalsIgnoreCase(OnvifCamera.value(e,"Name").trim())){base=e.getAttribute("token");break;}
  if(base.isEmpty())throw new IOException("Position BASE introuvable ; retour non exécuté");
  go(base);store.save(base,false);
 }}
}
