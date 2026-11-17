package fr.nautic.test;

import android.app.Dialog;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
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
 private final Runnable finished;
 private final java.util.List<Track> tracks=new java.util.ArrayList<>();
 private Dialog prompt;
 private TextView elapsed;
 private long started;

 DashboardRecording(MainActivity activity,Runnable finished){this.activity=activity;this.finished=finished;}
 boolean active(){return !tracks.isEmpty();}
 interface LiveFrame {boolean available();}
 static final class Lens {
  final String name;
  final TextureView texture;
  final float ratio;
  final LiveFrame live;
  Lens(String name,TextureView texture,float ratio,LiveFrame live){
   this.name=name;this.texture=texture;this.ratio=ratio;this.live=live;
  }
 }
 private static final class Track {
  Lens lens;
  MediaRecorder recorder;
  Surface encoder;
  Bitmap bitmap;
  File pending,output;
  Rect frame;
  int frames;
  boolean started;
 }

 private static File directory(MainActivity activity){
  File dir=activity.getExternalFilesDir(Environment.DIRECTORY_MOVIES);
  return dir==null?new File(activity.getFilesDir(),"captures"):dir;
 }
 static File[] latestPair(MainActivity activity){
  File[] files=directory(activity).listFiles((dir,name)->name.matches("Nautic-[0-9]+(?:-(?:fixe|mobile))?\\.mp4"));
  if(files==null)return new File[0];
  String latest="";
  for(File file:files)if(file.length()>0&&session(file).compareTo(latest)>0)latest=session(file);
  java.util.List<File> result=new java.util.ArrayList<>(2);
  for(File file:files)if(file.length()>0&&session(file).equals(latest))result.add(file);
  java.util.Collections.sort(result,(a,b)->a.getName().compareTo(b.getName()));
  return result.toArray(new File[0]);
 }
 private static String session(File file){return file.getName().replaceFirst("(?:-fixe|-mobile)?\\.mp4$","");}
 static File latest(MainActivity activity){
  File[] files=latestPair(activity);
  return files.length==0?null:files[0];
 }
 void photo(Lens... lenses){
  java.util.List<File> written=new java.util.ArrayList<>();
  java.util.List<Bitmap> images=new java.util.ArrayList<>();
  try{
   File dir=directory(activity);if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("Stockage indisponible");
   String prefix="Nautic-"+System.currentTimeMillis();
   for(Lens lens:lenses){
    if(!lens.live.available())throw new IOException("Flux "+lens.name+" indisponible");
    int width=Math.max(2,Math.round(1280*Math.min(1,lens.ratio)));
    int height=Math.max(2,Math.round(1280*Math.min(1,1/lens.ratio)));
    Bitmap image=lens.texture.getBitmap(width,height);
    if(image==null)throw new IOException("Image "+lens.name+" indisponible");
    images.add(image);
   }
   for(int i=0;i<lenses.length;i++){
    File file=new File(dir,prefix+"-"+lenses[i].name+".jpg");
    written.add(file);
    try(FileOutputStream stream=new FileOutputStream(file)){
     if(!images.get(i).compress(Bitmap.CompressFormat.JPEG,94,stream))throw new IOException("Photo non enregistrée");
    }
   }
   message("Deux photos enregistrées · fixe et mobile");
  }catch(Exception error){
   for(File file:written)file.delete();
   message(error.getMessage()==null?"Photos non enregistrées":error.getMessage());
  }finally{for(Bitmap image:images)image.recycle();finished.run();}
 }
 void start(Lens... lenses){
  if(active())return;
  try{
   File dir=directory(activity);if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("Stockage indisponible");
   String prefix="Nautic-"+System.currentTimeMillis();
   for(Lens lens:lenses){
    Track track=new Track();
    track.lens=lens;tracks.add(track);
    track.output=new File(dir,prefix+"-"+lens.name+".mp4");
    track.pending=File.createTempFile("nautic-video-",".pending",dir);
    int width=Math.max(16,Math.round(720*Math.min(1,lens.ratio)/16)*16);
    int height=Math.max(16,Math.round(720*Math.min(1,1/lens.ratio)/16)*16);
    track.frame=new Rect(0,0,width,height);
    track.bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);
    track.recorder=new MediaRecorder();
    track.recorder.setVideoSource(MediaRecorder.VideoSource.SURFACE);
    track.recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
    track.recorder.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
    track.recorder.setVideoSize(width,height);
    track.recorder.setVideoFrameRate(12);
    track.recorder.setVideoEncodingBitRate(2_000_000);
    track.recorder.setOutputFile(track.pending.getAbsolutePath());
    track.recorder.setOnErrorListener((r,what,extra)->{
     if(tracks.contains(track))stop(true,"Erreur sur le flux "+track.lens.name);
    });
    track.recorder.prepare();
    track.encoder=track.recorder.getSurface();
   }
   for(Track track:tracks){track.recorder.start();track.started=true;}
   started=SystemClock.elapsedRealtime();
   showPrompt();
   handler.post(tick);
  }catch(Exception error){stop(false,"Impossible de démarrer les deux enregistrements");}
 }
 private void showPrompt(){
  prompt=new Dialog(activity);
  prompt.requestWindowFeature(android.view.Window.FEATURE_NO_TITLE);
  prompt.setCancelable(false);
  prompt.setCanceledOnTouchOutside(false);
  LinearLayout strip=new LinearLayout(activity);
  strip.setGravity(Gravity.CENTER_VERTICAL);
  int gap=Math.round(8*activity.getResources().getDisplayMetrics().density);
  strip.setPadding(gap*2,gap,gap,gap);
  GradientDrawable background=new GradientDrawable();
  background.setColor(0xffb80f23);
  background.setCornerRadius(gap*1.5f);
  strip.setBackground(background);
  elapsed=new TextView(activity);
  elapsed.setTextColor(Color.WHITE);
  elapsed.setTypeface(null,android.graphics.Typeface.BOLD);
  elapsed.setText("● REC ×2  00:00");
  elapsed.setPadding(0,0,gap,0);
  strip.addView(elapsed);
  Button stop=new Button(activity);
  stop.setText("Arrêter");
  stop.setOnClickListener(view->stop(true,null));
  strip.addView(stop);
  prompt.setContentView(strip);
  android.view.Window window=prompt.getWindow();
  if(window!=null){
   window.setBackgroundDrawableResource(android.R.color.transparent);
   window.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
   window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON|WindowManager.LayoutParams.FLAG_FULLSCREEN);
   window.setGravity(Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);
  }
  prompt.show();
  if(window!=null)window.setLayout(ViewGroup.LayoutParams.WRAP_CONTENT,ViewGroup.LayoutParams.WRAP_CONTENT);
 }
 private void recordFrame(){
  if(!active())return;
  try{
   for(Track track:tracks){
    Lens lens=track.lens;
    if(!lens.live.available()||!lens.texture.isAvailable()||lens.texture.getBitmap(track.bitmap)==null){
     stop(true,"Flux "+lens.name+" interrompu");return;
    }
    Canvas canvas=track.encoder.lockHardwareCanvas();
    try{
     canvas.drawColor(Color.BLACK);
     canvas.drawBitmap(track.bitmap,null,track.frame,paint);
    }finally{track.encoder.unlockCanvasAndPost(canvas);}
    track.frames++;
   }
   long seconds=(SystemClock.elapsedRealtime()-started)/1000;
   elapsed.setText(String.format(Locale.FRANCE,"● REC ×2  %02d:%02d",seconds/60,seconds%60));
   handler.postDelayed(tick,83);
  }catch(RuntimeException error){stop(true,"Capture interrompue");}
 }
 void stop(boolean save,String status){
  handler.removeCallbacks(tick);
  int kept=0;
  for(Track track:tracks){
   boolean completed=false;
   if(track.recorder!=null){
    try{if(track.started){track.recorder.stop();completed=save&&track.frames>0;}}
    catch(RuntimeException ignored){}
    finally{track.recorder.release();}
   }
   if(track.encoder!=null)track.encoder.release();
   if(track.bitmap!=null)track.bitmap.recycle();
   if(track.pending!=null){
    if(completed&&track.pending.length()>0&&track.pending.renameTo(track.output))kept++;
    else track.pending.delete();
   }
  }
  tracks.clear();
  if(prompt!=null){prompt.dismiss();prompt=null;elapsed=null;}
  String result=kept==2?"Deux vidéos enregistrées · fixe et mobile":kept==1?"Une seule vidéo récupérée":"Aucune vidéo enregistrée";
  if(status!=null)message(status+(save?" · "+result:""));
  else if(save)message(result);
  finished.run();
 }
 private void message(String text){Toast.makeText(activity,text,Toast.LENGTH_LONG).show();}
}
