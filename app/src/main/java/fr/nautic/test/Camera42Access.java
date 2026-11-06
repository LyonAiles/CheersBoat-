package fr.nautic.test;

import android.content.*;
import android.net.Uri;
import android.media.ToneGenerator;
import android.media.AudioManager;
import android.os.*;
import org.json.JSONObject;

/** Independent, stationary watch for dashboard camera 42. No PTZ commands. */
final class Camera42Access {
 static SharedPreferences prefs(Context c){return c.getSharedPreferences("nautic_camera42",Context.MODE_PRIVATE);}
 static void ding(Context c){new Handler(Looper.getMainLooper()).post(()->{try{android.media.MediaPlayer tone=android.media.MediaPlayer.create(c.getApplicationContext(),R.raw.camera42_ding);if(tone!=null){tone.setOnCompletionListener(android.media.MediaPlayer::release);tone.setOnErrorListener((player,what,extra)->{player.release();return true;});tone.start();}}catch(Exception ignored){}});}
 static String toggle(Context c)throws Exception{
  SharedPreferences p=prefs(c);
  if(p.getBoolean("active",false)){c.stopService(new Intent(c,Camera42Service.class));p.edit().putBoolean("active",false).apply();return "Veille désactivée";}
  String host=Uri.parse(TrematageAccess.address(c,2)).getHost();
  if(host==null)throw new java.io.IOException("Configurer la caméra 42 dans Paramètres");
  p.edit().putBoolean("active",true).putLong("activationTime",System.currentTimeMillis()).remove("lastAlertTime").apply();
  try{Camera42Service.start(c,host,2,host+"|watch42");}catch(Exception e){p.edit().putBoolean("active",false).apply();throw e;}
  ding(c);return "Veille activée";
 }
 static String status(Context c){try{SharedPreferences p=prefs(c);return new JSONObject().put("active",p.getBoolean("active",false)).put("status",p.getString("watchStatus","")).toString();}catch(Exception e){return "{}";}}
}
