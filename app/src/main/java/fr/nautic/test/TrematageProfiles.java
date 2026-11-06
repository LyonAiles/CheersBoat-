package fr.nautic.test;

import java.util.*;
import org.w3c.dom.Element;

/** Stream profiles are aliases of a camera, not separate cameras. Prefer a retained return. */
final class TrematageProfiles {
 static boolean sameCamera(String first,String second){
  int a=first.indexOf('|'),b=second.indexOf('|');return a>0&&b>0&&first.substring(0,a).equalsIgnoreCase(second.substring(0,b));
 }
 static Element select(List<Element> profiles,String host,String preferred,Map<String,?> saved){
  Element fallback=null,chosen=null;
  for(Element p:profiles)if(!OnvifCamera.elements(p,"PTZConfiguration").isEmpty()){
   String token=p.getAttribute("token");if(fallback==null)fallback=p;if(preferred.equals(token))chosen=p;
   if(Boolean.TRUE.equals(saved.get(host+"|"+token+".active")))return p;
  }
  return chosen==null?fallback:chosen;
 }
}
