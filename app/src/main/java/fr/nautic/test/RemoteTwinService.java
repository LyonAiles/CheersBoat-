package fr.nautic.test;

import android.app.*;
import android.content.*;
import android.os.*;
import java.net.*;
import java.io.*;
import java.util.concurrent.*;
import org.json.JSONObject;

/** Optional HTTPS telemetry transport. Requires a separately configured authenticated relay. */
public class RemoteTwinService extends Service {
 private ScheduledExecutorService worker;
 static SharedPreferences prefs(Context c){return c.getSharedPreferences("nautic_twin",MODE_PRIVATE);}
 static void apply(Context c){if(prefs(c).getBoolean("enabled",false)){Intent i=new Intent(c,RemoteTwinService.class);if(Build.VERSION.SDK_INT>=26)c.startForegroundService(i);else c.startService(i);}else c.stopService(new Intent(c,RemoteTwinService.class));}
 public IBinder onBind(Intent i){return null;}
 public int onStartCommand(Intent i,int flags,int id){
  if(Build.VERSION.SDK_INT>=26)getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel("nautic_twin","Liaison Nautic distante",NotificationManager.IMPORTANCE_LOW));
  Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,"nautic_twin"):new Notification.Builder(this);
  startForeground(1301,b.setSmallIcon(android.R.drawable.ic_menu_share).setContentTitle("Nautic · liaison distante").setContentText("Échange des états et dernières alertes").setOngoing(true).build());
  if(worker!=null)worker.shutdownNow();worker=Executors.newSingleThreadScheduledExecutor();worker.scheduleWithFixedDelay(this::exchange,0,5,TimeUnit.SECONDS);return START_NOT_STICKY;
 }
 private void exchange(){
  SharedPreferences p=prefs(this);HttpURLConnection connection=null;
  try{
   URL url=new URL(p.getString("url",""));if(!"https".equals(url.getProtocol())||url.getUserInfo()!=null)throw new IOException("Une adresse HTTPS sans identifiants est nécessaire");
   String token=p.getString("token","");if(token.length()<24)throw new IOException("Clé de jumelage trop courte (24 caractères minimum)");
   boolean aboard="boat".equals(p.getString("role","boat"));
   connection=(HttpURLConnection)url.openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(7000);connection.setReadTimeout(7000);connection.setRequestProperty("Authorization","Bearer "+token);connection.setRequestProperty("Accept","application/json");connection.setUseCaches(false);
   if(aboard){
    JSONObject state=new JSONObject().put("protocol","nautic-twin-v1").put("sentAt",System.currentTimeMillis()).put("camera42",watch("nautic_camera42")).put("camera44",watch("nautic_trematage"));
    byte[] data=state.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);connection.setRequestMethod("PUT");connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json; charset=utf-8");connection.setFixedLengthStreamingMode(data.length);try(OutputStream out=connection.getOutputStream()){out.write(data);}
   }
   int code=connection.getResponseCode();if(code<200||code>=300)throw new IOException("Relais HTTP "+code);
   if(!aboard){
    ByteArrayOutputStream data=new ByteArrayOutputStream();try(InputStream in=connection.getInputStream()){byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1){if(data.size()+n>65536)throw new IOException("Réponse trop volumineuse");data.write(buf,0,n);}}
    JSONObject state=new JSONObject(data.toString("UTF-8"));if(!"nautic-twin-v1".equals(state.optString("protocol")))throw new IOException("Relais incompatible");
    p.edit().putString("remoteState",state.toString()).apply();
   }
   p.edit().putLong("lastSuccess",System.currentTimeMillis()).putString("status",aboard?"État transmis au relais":"État reçu du relais").apply();
  }catch(Exception e){p.edit().putString("status","Liaison indisponible : "+e.getMessage()).apply();}finally{if(connection!=null)connection.disconnect();}
 }
 private JSONObject watch(String name)throws Exception{
  SharedPreferences p=getSharedPreferences(name,MODE_PRIVATE);String key=p.getString("shortcutKey",p.getString("watchKey",""));boolean active=name.equals("nautic_camera42")?p.getBoolean("active",false):!key.isEmpty()&&p.getBoolean(key+".active",false);
  return new JSONObject().put("active",active).put("status",p.getString("watchStatus","")).put("alert",p.getString("lastAlert","")).put("alertTime",p.getLong("lastAlertTime",0));
 }
 public void onDestroy(){if(worker!=null)worker.shutdownNow();stopForeground(true);super.onDestroy();}
}
