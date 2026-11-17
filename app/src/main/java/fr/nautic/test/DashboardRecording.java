package fr.nautic.test;

import android.app.AlertDialog;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.media.MediaRecorder;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Surface;
import android.view.TextureView;
import android.view.WindowManager;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Locale;

final class DashboardRecording {
 private final MainActivity activity;
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final Paint paint=new Paint(Paint.FILTER_BITMAP_FLAG);
 private final Runnable tick=this::recordFrame;
 private MediaRecorder recorder;
 private AlertDialog prompt;
 private Surface encoder;
 private TextureView texture;
 private Bitmap bitmap;
 private File pending,output;
 private Rect frame;
 private long started;
 private int frames;
 private LiveFrame live;

 DashboardRecording(MainActivity activity){this.activity=activity;}
 boolean active(){return recorder!=null;}

 private static File directory(MainActivity activity){
  File dir=activity.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
  return dir==null?new File(activity.getFilesDir(),"captures"):dir;
 }
 static File latest(MainActivity activity){
  File[] candidates=directory(activity).listFiles((dir,name)->name.startsWith("Nautic-")&&name.endsWith(".mp4"));
  File latest=null;
  if(candidates!=null)for(File file:candidates)
   if(file.length()>0&&(latest==null||file.getName().compareTo(latest.getName())>0))latest=file;
  return latest;
 }
 void photo(TextureView view,float ratio){
  Bitmap image=null;
  try{
   File dir=directory(activity);if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("Stockage indisponible");
   int width=Math.max(2,Math.round(1280*Math.min(1,ratio)));
   int height=Math.max(2,Math.round(1280*Math.min(1,1/ratio)));
   image=view.getBitmap(width,height);
   if(image==null)throw new IOException("Image indisponible");
   File file=new File(dir,"Nautic-"+System.currentTimeMillis()+".jpg");
   try(FileOutputStream stream=new FileOutputStream(file)){
    if(!image.compress(Bitmap.CompressFormat.JPEG,94,stream))throw new IOException("Photo non enregistrée");
   }
   message("Photo enregistrée sur cet appareil");
  }catch(Exception error){message(error.getMessage()==null?"Photo non enregistrée":error.getMessage());}
  finally{if(image!=null)image.recycle();}
 }
 interface LiveFrame {boolean available();}
 void start(TextureView view,float ratio,LiveFrame live){
  if(active())return;
  try{
   File dir=directory(activity);if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("Stockage indisponible");
   output=new File(dir,"Nautic-"+System.currentTimeMillis()+".mp4");
   pending=File.createTempFile("nautic-video-",".pending",dir);
   texture=view;this.live=live;
   int width=Math.max(16,Math.round(720*Math.min(1,ratio)/16)*16);
   int height=Math.max(16,Math.round(720*Math.min(1,1/ratio)/16)*16);
   frame=new Rect(0,0,width,height);
   bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);
   recorder=new MediaRecorder();
   recorder.setVideoSource(MediaRecorder.VideoSource.SURFACE);
   recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
   recorder.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
   recorder.setVideoSize(width,height);
   recorder.setVideoFrameRate(12);
   recorder.setVideoEncodingBitRate(2_000_000);
   recorder.setOutputFile(pending.getAbsolutePath());
   recorder.setOnErrorListener((r,what,extra)->{if(r==recorder)stop(false,"Erreur d’enregistrement vidéo");});
   recorder.prepare();
   encoder=recorder.getSurface();
   recorder.start();
   frames=0;
   started=SystemClock.elapsedRealtime();
   prompt=new AlertDialog.Builder(activity).setTitle("Enregistrement vidéo · 151")
    .setMessage("En cours · 00:00").setCancelable(false)
    .setPositiveButton("Arrêter",(dialog,which)->stop(true,null)).create();
   prompt.setCanceledOnTouchOutside(false);
   prompt.show();
   if(prompt.getWindow()!=null)prompt.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
   handler.post(tick);
  }catch(Exception error){stop(false,"Impossible de démarrer l’enregistrement");}
 }
 private void recordFrame(){
  if(!active())return;
  try{
   if(!live.available()||!texture.isAvailable()||texture.getBitmap(bitmap)==null){stop(true,"Flux caméra interrompu");return;}
   Canvas canvas=encoder.lockHardwareCanvas();
   try{
    canvas.drawColor(Color.BLACK);
    canvas.drawBitmap(bitmap,null,frame,paint);
   }finally{encoder.unlockCanvasAndPost(canvas);}
   frames++;
   long seconds=(SystemClock.elapsedRealtime()-started)/1000;
   prompt.setMessage(String.format(Locale.FRANCE,"En cours · %02d:%02d",seconds/60,seconds%60));
   handler.postDelayed(tick,83);
  }catch(RuntimeException error){stop(true,"Capture du flux interrompue");}
 }
 void stop(boolean save,String status){
  handler.removeCallbacks(tick);
  boolean completed=false;
  if(recorder!=null){
   try{recorder.stop();completed=save&&frames>0;}
   catch(RuntimeException ignored){}
   finally{recorder.release();recorder=null;}
  }
  if(encoder!=null){encoder.release();encoder=null;}
  if(bitmap!=null){bitmap.recycle();bitmap=null;}
  texture=null;live=null;
  if(prompt!=null){prompt.dismiss();prompt=null;}
  boolean kept=completed&&pending!=null&&pending.length()>0&&pending.renameTo(output);
  if(pending!=null&&!kept)pending.delete();
  pending=null;output=null;frames=0;
  if(status!=null)message(kept?status+" · vidéo enregistrée":status);
  else if(save)message(kept?"Vidéo enregistrée sur cet appareil":"Vidéo trop courte ou indisponible");
  activity.refreshDashboardVideos();
 }
 private void message(String text){Toast.makeText(activity,text,Toast.LENGTH_LONG).show();}
}
