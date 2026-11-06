package fr.nautic.test;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.*;
import android.os.*;
import org.json.JSONObject;

/** Shared local sound catalogue; previews use the same playback as real alerts. */
final class CameraAlertSounds {
 private static final Handler handler=new Handler(Looper.getMainLooper());
 private static MediaPlayer player;
 static String selected(Context c,String watch){
  String fallback="42".equals(watch)?"ding":"horn";
  try{JSONObject all=new JSONObject(c.getSharedPreferences("nautic_settings",Context.MODE_PRIVATE).getString("nautic-extensions","{}"));JSONObject sounds=all.optJSONObject("alertSounds");return sounds==null?fallback:sounds.optString(watch,fallback);}catch(Exception e){return fallback;}
 }
 static int resource(String sound){
  switch(sound){case "bell":return R.raw.alert_bell;case "warning":return R.raw.alert_warning;case "ding":return R.raw.camera42_ding;case "dingding":return R.raw.alert_dingding;case "horn":return R.raw.trematage_horn;default:return R.raw.camera42_ding;}
 }
 private static void release(MediaPlayer current){if(player==current)player=null;try{current.release();}catch(Exception ignored){}}
 static void play(Context context,String watch,String preview){
  Context app=context.getApplicationContext();String sound=preview==null?selected(app,watch):preview;
  handler.post(()->{
   if(player!=null)release(player);
   if("silent".equals(sound))return;
   MediaPlayer current=new MediaPlayer();player=current;
   try(AssetFileDescriptor fd=app.getResources().openRawResourceFd(resource(sound))){
    current.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
    current.setDataSource(fd.getFileDescriptor(),fd.getStartOffset(),fd.getLength());current.setLooping(false);
    current.setOnPreparedListener(p->{if(player==p)p.start();});current.setOnCompletionListener(CameraAlertSounds::release);
    current.setOnErrorListener((p,what,extra)->{release(p);return true;});current.prepareAsync();
    handler.postDelayed(()->{if(player==current)release(current);},6000);
   }catch(Exception e){release(current);}
  });
 }
}
