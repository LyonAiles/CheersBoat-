package fr.nautic.test;

import android.app.*;
import android.content.*;
import android.os.*;
import java.util.*;
import java.util.concurrent.*;

/** Explicitly activated foreground watch; independent of the video and its control dialog. */
public class TrematageService extends Service {
 static final String ACTION="fr.nautic.test.TREMATAGE_EVENT";
 private static final String STATUS="nautic_trematage_status", ALERTS="nautic_trematage_alerts_v2";
 private volatile boolean running;
 private volatile long generation=0;
 private ExecutorService worker;
 private String cameraKey;

 @Override public android.os.IBinder onBind(Intent intent){return null;}
 static void start(Context context,String host,int index,String key){
  Intent i=new Intent(context,TrematageService.class).putExtra("host",host).putExtra("index",index).putExtra("key",key);
  if(Build.VERSION.SDK_INT>=26)context.startForegroundService(i);else context.startService(i);
 }
 static void stop(Context context,String key){
  String current=context.getSharedPreferences("nautic_trematage",MODE_PRIVATE).getString("watchKey","");
  if(key.equals(current)||TrematageProfiles.sameCamera(key,current))context.stopService(new Intent(context,TrematageService.class));
 }
 @Override public void onCreate(){
  super.onCreate();
  if(Build.VERSION.SDK_INT>=26){
   NotificationManager n=getSystemService(NotificationManager.class);
   n.createNotificationChannel(new NotificationChannel(STATUS,"Veille Trématage",NotificationManager.IMPORTANCE_LOW));
   NotificationChannel alerts=new NotificationChannel(ALERTS,"Alertes Trématage",NotificationManager.IMPORTANCE_HIGH);alerts.setSound(null,null);alerts.enableVibration(true);n.createNotificationChannel(alerts);
  }
 }
 private Notification notification(String channel,String title,String message,boolean ongoing){
  Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,channel):new Notification.Builder(this);
  Intent open=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
  PendingIntent pending=PendingIntent.getActivity(this,71,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  b.setSmallIcon(android.R.drawable.ic_menu_view).setContentTitle(title).setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message)).setContentIntent(pending).setOngoing(ongoing);
  if(!ongoing)b.setDefaults(Notification.DEFAULT_VIBRATE).setAutoCancel(true);
  return b.build();
 }
 private void status(String text){
  getSharedPreferences("nautic_trematage",MODE_PRIVATE).edit().putString("watchStatus",text).apply();
  ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(1101,notification(STATUS,"Trématage",text,true));
 }
 @Override public int onStartCommand(Intent intent,int flags,int id){
  if(running&&intent!=null&&TrematageProfiles.sameCamera(cameraKey,intent.getStringExtra("key")==null?"":intent.getStringExtra("key"))){cameraKey=intent.getStringExtra("key");getSharedPreferences("nautic_trematage",MODE_PRIVATE).edit().putString("watchKey",cameraKey).apply();return START_NOT_STICKY;}
  final long watchGeneration=++generation;
  if(worker!=null)worker.shutdownNow();
  startForeground(1101,notification(STATUS,"Trématage","Connexion à la caméra…",true));
  if(intent==null){stopSelf();return START_NOT_STICKY;}
  String key=intent.getStringExtra("key");
  cameraKey=key;
  String host=intent.getStringExtra("host");int index=intent.getIntExtra("index",1);
  if(host==null||key==null){stopSelf();return START_NOT_STICKY;}
  running=true;getSharedPreferences("nautic_trematage",MODE_PRIVATE).edit().putString("watchKey",key).apply();
  worker=Executors.newSingleThreadExecutor();
  worker.execute(()->{
   SharedPreferences p=getSharedPreferences("nautic_camera_private",MODE_PRIVATE);
   OnvifCamera camera=new OnvifCamera(host,p.getString("username"+index,p.getString("username","")),p.getString("password"+index,p.getString("password","")));
   CameraAlertGate gate=new CameraAlertGate();long watchStarted=System.currentTimeMillis();
   try{
    camera.discover();if(!camera.services.containsKey(OnvifCamera.EVENTS))throw new java.io.IOException("La caméra n’expose pas de service d’alertes");
    int failures=0;
    while(running&&generation==watchGeneration&&!Thread.currentThread().isInterrupted()){
     try{
      camera.beginEvents();long renewed=System.currentTimeMillis();
      if(generation!=watchGeneration)break;
      status("Écoute active · alertes véhicule uniquement");
      while(running&&generation==watchGeneration&&!Thread.currentThread().isInterrupted()){
       if(System.currentTimeMillis()-renewed>40000){camera.endEvents();camera.beginEvents();renewed=System.currentTimeMillis();}
       List<CameraEvent> messages=camera.readEvents();
       if(!running||generation!=watchGeneration)break;
       for(CameraEvent event:messages)receive(event,System.currentTimeMillis()-watchStarted>4000,gate);
       Thread.sleep(250); // Firmware may immediately repeat Initialized states; avoid a busy poll loop.
       failures=0;
      }
     }catch(Exception e){
      if(!running||generation!=watchGeneration||Thread.currentThread().isInterrupted())break;
      status("Alertes indisponibles · reconnexion : "+e.getMessage());
      failures++;Thread.sleep(Math.min(15000,2000L*failures));
     }finally{camera.endEvents();}
    }
   }catch(Exception e){if(running&&generation==watchGeneration){status("Veille indisponible : "+e.getMessage());running=false;}}
   finally{camera.endEvents();}
  });
  return START_NOT_STICKY;
 }
 private void receive(CameraEvent e,boolean settled,CameraAlertGate gate){
  String raw=e.topic+" — "+e.source+" — "+e.detail+" — UTC caméra="+e.utcTime;
  SharedPreferences p=getSharedPreferences("nautic_trematage",MODE_PRIVATE);
  p.edit().putString("lastRawEvent",raw).apply();
  long now=System.currentTimeMillis();if(!gate.receive(e,settled,now))return;
  String message="Trématage · "+e.category+" détecté"+("personne".equals(e.category)?"e":"");
  if("mouvement générique".equals(e.category))message="Trématage · mouvement détecté (catégorie non fournie)";
  if(e.initial)message="Trématage · "+e.category+" : présence signalée par la caméra";
  p.edit().putString("lastAlert",message).putLong("lastAlertTime",now).apply();
  ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(1102,notification(ALERTS,message,"Alerte caméra · vérifier la vue arrière",false));
  TrematageFeedback.playAlert(this);
  sendBroadcast(new Intent(ACTION).setPackage(getPackageName()).putExtra("message",message));
 }
 @Override public void onDestroy(){
  running=false;if(worker!=null)worker.shutdownNow();
  getSharedPreferences("nautic_trematage",MODE_PRIVATE).edit().remove("watchKey").putString("watchStatus","Écoute arrêtée").apply();
  stopForeground(true);super.onDestroy();
 }
}
