package fr.nautic.test;

import android.app.*;
import android.content.*;
import android.os.*;
import java.util.*;
import java.util.concurrent.*;

/** Explicitly activated foreground watch; independent of the video and its control dialog. */
public class TrematageService extends Service {
 static final String ACTION="fr.nautic.test.TREMATAGE_EVENT";
 private static final String STATUS="nautic_trematage_status", ALERTS="nautic_trematage_alerts";
 private volatile boolean running;
 private ExecutorService worker;
 private String cameraKey;
 private final Map<String,Boolean> states=new HashMap<>();
 private final Map<String,Long> last=new HashMap<>();
 @Override public android.os.IBinder onBind(Intent intent){return null;}
 static void start(Context context,String host,int index,String key){
  Intent i=new Intent(context,TrematageService.class).putExtra("host",host).putExtra("index",index).putExtra("key",key);
  if(Build.VERSION.SDK_INT>=26)context.startForegroundService(i);else context.startService(i);
 }
 static void stop(Context context,String key){
  String current=context.getSharedPreferences("nautic_trematage",MODE_PRIVATE).getString("watchKey","");
  if(key.equals(current))context.stopService(new Intent(context,TrematageService.class));
 }
 @Override public void onCreate(){
  super.onCreate();
  if(Build.VERSION.SDK_INT>=26){
   NotificationManager n=getSystemService(NotificationManager.class);
   n.createNotificationChannel(new NotificationChannel(STATUS,"Veille Trématage",NotificationManager.IMPORTANCE_LOW));
   n.createNotificationChannel(new NotificationChannel(ALERTS,"Alertes Trématage",NotificationManager.IMPORTANCE_HIGH));
  }
 }
 private Notification notification(String channel,String title,String message,boolean ongoing){
  Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,channel):new Notification.Builder(this);
  Intent open=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
  PendingIntent pending=PendingIntent.getActivity(this,71,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  b.setSmallIcon(android.R.drawable.ic_menu_view).setContentTitle(title).setContentText(message).setStyle(new Notification.BigTextStyle().bigText(message)).setContentIntent(pending).setOngoing(ongoing);
  if(!ongoing)b.setDefaults(Notification.DEFAULT_SOUND|Notification.DEFAULT_VIBRATE).setAutoCancel(true);
  return b.build();
 }
 private void status(String text){
  getSharedPreferences("nautic_trematage",MODE_PRIVATE).edit().putString("watchStatus",text).apply();
  ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(1101,notification(STATUS,"Trématage",text,true));
 }
 @Override public int onStartCommand(Intent intent,int flags,int id){
  if(running)return START_NOT_STICKY;
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
   try{
    camera.discover();if(!camera.services.containsKey(OnvifCamera.EVENTS))throw new java.io.IOException("La caméra n’expose pas de service d’alertes");
    int failures=0;
    while(running&&!Thread.currentThread().isInterrupted()){
     try{
      states.clear();camera.beginEvents();long renewed=System.currentTimeMillis();
      status("Écoute active · personne, véhicule et mouvement selon les signaux disponibles");
      while(running&&!Thread.currentThread().isInterrupted()){
       if(System.currentTimeMillis()-renewed>40000){camera.endEvents();states.clear();camera.beginEvents();renewed=System.currentTimeMillis();}
       List<CameraEvent> messages=camera.readEvents();
       if(!running)break;
       for(CameraEvent event:messages)receive(event,System.currentTimeMillis()-renewed>4000);
       failures=0;
      }
     }catch(Exception e){
      if(!running||Thread.currentThread().isInterrupted())break;
      status("Alertes indisponibles · reconnexion : "+e.getMessage());
      failures++;Thread.sleep(Math.min(15000,2000L*failures));
     }finally{camera.endEvents();}
    }
   }catch(Exception e){if(running){status("Veille indisponible : "+e.getMessage());running=false;}}
   finally{camera.endEvents();}
  });
  return START_NOT_STICKY;
 }
 private void receive(CameraEvent e,boolean settled){
  String raw=e.topic+" — "+e.source+" — "+e.detail;
  SharedPreferences p=getSharedPreferences("nautic_trematage",MODE_PRIVATE);
  p.edit().putString("lastRawEvent",raw).apply();
  String key=e.topic+"|"+e.source;boolean was=Boolean.TRUE.equals(states.put(key,e.active));
  if(!e.active||e.initial||was||!settled||"autre".equals(e.category))return;
  long now=System.currentTimeMillis();Long previous=last.get(key);if(previous!=null&&now-previous<5000)return;last.put(key,now);
  String message="Trématage · "+e.category+" détecté"+("personne".equals(e.category)?"e":"");
  if("mouvement générique".equals(e.category))message="Trématage · mouvement détecté (catégorie non fournie)";
  p.edit().putString("lastAlert",message).putLong("lastAlertTime",now).apply();
  ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify(1102,notification(ALERTS,message,"Alerte caméra · vérifier la vue arrière",false));
  sendBroadcast(new Intent(ACTION).setPackage(getPackageName()).putExtra("message",message));
 }
 @Override public void onDestroy(){
  running=false;if(worker!=null)worker.shutdownNow();
  getSharedPreferences("nautic_trematage",MODE_PRIVATE).edit().remove("watchKey").putString("watchStatus","Écoute arrêtée").apply();
  stopForeground(true);super.onDestroy();
 }
}
