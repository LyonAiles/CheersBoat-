package fr.nautic.test;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.media.*;
import android.os.*;

/** User-selected boat horn, bundled for playback without Internet. */
final class TrematageFeedback {
 private static final Handler handler=new Handler(Looper.getMainLooper());
 private static MediaPlayer player;
 static void activated(Context context){
  TrematageAccess.prefs(context).edit().putLong("activationTime",System.currentTimeMillis()).apply();playAlert(context);
 }
 private static void release(MediaPlayer current){if(player==current)player=null;try{current.release();}catch(Exception ignored){}}
 static void playAlert(Context context){
  Context app=context.getApplicationContext();
  handler.post(()->{
   if(player!=null)release(player);
   MediaPlayer current=new MediaPlayer();player=current;
   try(AssetFileDescriptor fd=app.getResources().openRawResourceFd(R.raw.trematage_horn)){
    current.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
    current.setDataSource(fd.getFileDescriptor(),fd.getStartOffset(),fd.getLength());current.setLooping(false);
    current.setOnPreparedListener(p->{if(player==p)p.start();});
    current.setOnCompletionListener(TrematageFeedback::release);
    current.setOnErrorListener((p,what,extra)->{release(p);return true;});
    current.prepareAsync();
    handler.postDelayed(()->{if(player==current)release(current);},6000);
   }catch(Exception e){release(current);}
  });
 }
}
