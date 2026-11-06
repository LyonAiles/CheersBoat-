package fr.nautic.test;

import java.util.*;
import org.w3c.dom.*;

final class CameraEvent {
 final String topic,detail,category,source;
 final boolean active,initial;
 CameraEvent(String topic,String detail,String category,String source,boolean active,boolean initial){this.topic=topic;this.detail=detail;this.category=category;this.source=source;this.active=active;this.initial=initial;}
 static List<CameraEvent> parse(Document d){
  List<CameraEvent> out=new ArrayList<>();
  for(Element n:OnvifCamera.elements(d,"NotificationMessage")){
   String topic=OnvifCamera.value(n,"Topic"),lower=topic.toLowerCase(Locale.ROOT);
   StringBuilder details=new StringBuilder(),sources=new StringBuilder();boolean on=false,off=false,initial=false;
   for(Element m:OnvifCamera.elements(n,"Message"))if("Initialized".equalsIgnoreCase(m.getAttribute("PropertyOperation")))initial=true;
   for(Element s:OnvifCamera.elements(n,"Source"))for(Element e:OnvifCamera.elements(s,"SimpleItem"))sources.append(e.getAttribute("Name")).append('=').append(e.getAttribute("Value")).append(';');
   for(Element data:OnvifCamera.elements(n,"Data"))for(Element e:OnvifCamera.elements(data,"SimpleItem")){
    String key=e.getAttribute("Name"),v=e.getAttribute("Value");details.append(key).append('=').append(v).append(' ');
    boolean state=key.toLowerCase(Locale.ROOT).matches("(state|logicalstate|ismotion|ispeople|isperson|ishuman|isvehicle|motion|detected|alarm|active)");
    if(state&&("true".equalsIgnoreCase(v)||"1".equals(v)))on=true;
    if(state&&("false".equalsIgnoreCase(v)||"0".equals(v)))off=true;
    lower+=" "+key.toLowerCase(Locale.ROOT);
   }
   String category;
   if(lower.contains("person")||lower.contains("people")||lower.contains("human"))category="personne";
   else if(lower.contains("vehicle"))category="véhicule";
   else if(lower.contains("motion"))category="mouvement générique";
   else category="autre";
   out.add(new CameraEvent(topic,details.toString(),category,sources.toString(),on&&!off,initial));
  }return out;
 }
}
