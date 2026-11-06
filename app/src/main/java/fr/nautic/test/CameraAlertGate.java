package fr.nautic.test;

import java.util.HashMap;
import java.util.Map;

/** Some cameras repeat Initialized states. Announce a stable reported presence once per episode. */
final class CameraAlertGate {
 private static final class State {boolean active,announced;long since,lastAlarm=Long.MIN_VALUE;}
 private final Map<String,State> states=new HashMap<>();
 boolean receive(CameraEvent e,boolean settled,long now){
  return receive(e,settled,now,"véhicule".equals(e.category));
 }
 boolean receive(CameraEvent e,boolean settled,long now,boolean enabled){
  if(!enabled){states.remove(e.topic+"|"+e.source);return false;}
  String key=e.topic+"|"+e.source;State s=states.get(key);if(s==null){s=new State();states.put(key,s);}
  if(!e.active){s.active=false;s.announced=false;s.since=0;return false;}
  if(!s.active){s.active=true;s.since=now;}
  if(!settled||s.announced||"autre".equals(e.category))return false;
  if(e.initial&&now-s.since<1000)return false;
  if(s.lastAlarm!=Long.MIN_VALUE&&now-s.lastAlarm<5000)return false;
  s.announced=true;s.lastAlarm=now;return true;
 }
}
