package fr.nautic.test;

import android.content.Context;
import android.media.*;
import android.os.*;

final class TrematageFeedback {
 static void activated(Context context){
  Context app=context.getApplicationContext();TrematageAccess.prefs(app).edit().putLong("activationTime",System.currentTimeMillis()).apply();
  new Handler(Looper.getMainLooper()).post(()->{try{
   Ringtone sound=RingtoneManager.getRingtone(app,RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));
   if(sound!=null){sound.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());sound.play();new Handler(Looper.getMainLooper()).postDelayed(sound::stop,2000);}
  }catch(Exception ignored){}});
 }
}
