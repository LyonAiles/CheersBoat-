package fr.nautic.test;

import android.content.*;
import android.net.Uri;
import org.json.JSONObject;
import org.w3c.dom.Element;

final class TrematageAccess {
 static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("nautic_trematage",Context.MODE_PRIVATE);}
 static int index(Context c){return prefs(c).getInt("shortcutIndex",1);}
 static String address(Context c,int index)throws Exception{
  JSONObject cfg=new JSONObject(c.getSharedPreferences("nautic_settings",Context.MODE_PRIVATE).getString("nautic-v04","{}"));
  String address=cfg.optString("cam"+index,"");return address.isEmpty()&&index==1?"rtsp://192.168.1.101:554/stream1":address;
 }
 static TrematageSession.Store store(Context c,String key){
  android.content.SharedPreferences p=prefs(c);
  return new TrematageSession.Store(){
   public String backup(){return p.getString(key+".return","");}
   public boolean armed(){return p.getBoolean(key+".active",false);}
   public void save(String backup,boolean armed)throws Exception{if(!p.edit().putString(key+".return",backup).putBoolean(key+".active",armed).commit())throw new java.io.IOException("Sauvegarde de la position de retour impossible");}
  };
 }
 static String toggle(Context c)throws Exception{
  int index=index(c);String host=Uri.parse(address(c,index)).getHost();if(host==null)throw new java.io.IOException("Configurer la caméra TC47 dans Paramètres");
  android.content.SharedPreferences credentials=c.getSharedPreferences("nautic_camera_private",Context.MODE_PRIVATE);
  OnvifCamera camera=new OnvifCamera(host,credentials.getString("username"+index,credentials.getString("username","")),credentials.getString("password"+index,credentials.getString("password","")));
  camera.discover();String preferred=prefs(c).getString("shortcutProfile","");
  Element profile=TrematageProfiles.select(camera.profiles,host,preferred,prefs(c).getAll());
  if(profile==null)throw new java.io.IOException("Objectif mobile non accessible par ONVIF");
  String key=host+"|"+profile.getAttribute("token");TrematageSession.Store store=store(c,key);TrematageSession session=new TrematageSession(camera,profile,store);
  prefs(c).edit().putString("shortcutKey",key).putString("shortcutProfile",profile.getAttribute("token")).apply();
  if(store.armed()){session.deactivate();TrematageService.stop(c,key);return "Trématage désactivé · retour demandé";}
  String other=prefs(c).getString("watchKey","");
  if(!other.isEmpty()&&!TrematageProfiles.sameCamera(other,key)&&prefs(c).getBoolean(other+".active",false))throw new java.io.IOException("Une position de retour est encore conservée pour "+other.substring(0,other.indexOf('|'))+" ; revenir depuis ses commandes");
  session.activate();prefs(c).edit().putString("shortcutKey",key).putString("shortcutProfile",profile.getAttribute("token")).apply();
  TrematageService.start(c,host,index,key);TrematageFeedback.activated(c);return "Trématage activé";
 }
 static String status(Context c){try{
  android.content.SharedPreferences p=prefs(c);String key=p.getString("shortcutKey",p.getString("watchKey",""));
  return new JSONObject().put("active",!key.isEmpty()&&p.getBoolean(key+".active",false)).put("activationTime",p.getLong("activationTime",0)).put("alertTime",p.getLong("lastAlertTime",0)).put("alert",p.getString("lastAlert","")).put("status",p.getString("watchStatus","")).put("index",index(c)).toString();
 }catch(Exception e){return "{}";}}
}
