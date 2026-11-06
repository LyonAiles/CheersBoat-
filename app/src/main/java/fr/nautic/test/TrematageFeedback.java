package fr.nautic.test;

import android.content.Context;
import android.media.*;
import android.os.*;

/** A distinct three-pulse warning, shared by activation and camera alerts. */
final class TrematageFeedback {
 private static final Handler handler=new Handler(Looper.getMainLooper());
 private static ToneGenerator tone;
 static void activated(Context context){
  TrematageAccess.prefs(context).edit().putLong("activationTime",System.currentTimeMillis()).apply();playAlert();
 }
 static void playAlert(){handler.post(()->{try{
  if(tone!=null){tone.release();tone=null;}
  ToneGenerator current=new ToneGenerator(AudioManager.STREAM_ALARM,85);tone=current;
  for(int i=0;i<3;i++)handler.postDelayed(()->{if(tone==current)current.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD,600);},i*800L);
  handler.postDelayed(()->{if(tone==current){current.release();tone=null;}},2400);
 }catch(Exception ignored){}});}
}
