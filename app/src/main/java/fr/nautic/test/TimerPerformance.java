package fr.nautic.test;

import android.app.Activity;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.FrameMetrics;
import org.json.JSONObject;

/** Activity frame timings include native camera views; process CPU excludes WebView's separate renderer. */
final class TimerPerformance {
 private long frames,slow,totalNanos,start,cpu;
 private boolean active;
 TimerPerformance(Activity activity){
  if(Build.VERSION.SDK_INT>=24){
   double budget=1_000_000_000d/activity.getWindowManager().getDefaultDisplay().getRefreshRate();
   activity.getWindow().addOnFrameMetricsAvailableListener((window,metrics,dropped)->{
    synchronized(this){if(!active)return;
     long duration=metrics.getMetric(FrameMetrics.TOTAL_DURATION);
     frames++;totalNanos+=duration;if(duration>budget)slow++;
    }
   },new Handler(Looper.getMainLooper()));
  }
 }
 synchronized String sample(boolean reset){
  try{
   long now=android.os.SystemClock.elapsedRealtime(),current=android.os.Process.getElapsedCpuTime();
   JSONObject result=new JSONObject().put("wallMs",now-start).put("cpuMs",current-cpu)
    .put("frames",frames).put("slow",slow).put("renderMs",frames==0?0:totalNanos/1_000_000d/frames)
    .put("frameMetricsSupported",Build.VERSION.SDK_INT>=24);
   active=reset;
   if(reset){start=now;cpu=current;frames=slow=totalNanos=0;}
   return result.toString();
  }catch(Exception ignored){return "{}";}
 }
}
