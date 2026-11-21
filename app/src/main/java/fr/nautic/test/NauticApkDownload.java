package fr.nautic.test;

import android.app.*;
import android.content.Intent;
import android.content.pm.*;
import android.net.Uri;
import androidx.core.content.FileProvider;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** One private APK slot. An interrupted download never replaces the last valid APK. */
final class NauticApkDownload {
 private static final AtomicBoolean busy=new AtomicBoolean();
 static void start(Activity activity,String version){
  if(!busy.compareAndSet(false,true))return;
  ProgressDialog progress=new ProgressDialog(activity);progress.setTitle("Mise à jour Nautic "+version);
  progress.setMessage("Téléchargement de l’APK signé…");progress.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL);progress.setMax(100);progress.setIndeterminate(true);progress.setCancelable(false);progress.show();
  new Thread(()->{
   HttpURLConnection connection=null;File partial=null;
   try{
    int expected=Integer.parseInt(version.substring("0.4.".length()));
    File directory=new File(activity.getCacheDir(),"updates");if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Dossier de mise à jour inaccessible");
    File apk=new File(directory,"nautic-update.apk");partial=new File(directory,"nautic-update.part");
    boolean reusable=false;
    if(apk.isFile())try{validate(activity,apk,expected);reusable=true;}catch(Exception ignored){}
    if(!reusable){
     URL url=new URL("https://github.com/LyonAiles/CheersBoat-/releases/download/nautic-"+version+"/app-release.apk");
     connection=(HttpURLConnection)url.openConnection();connection.setConnectTimeout(10000);connection.setReadTimeout(15000);connection.setInstanceFollowRedirects(true);
     if(connection.getResponseCode()!=200||!"https".equalsIgnoreCase(connection.getURL().getProtocol()))throw new IOException("Téléchargement indisponible · HTTP "+connection.getResponseCode());
     long size=-1;try{size=Long.parseLong(connection.getHeaderField("Content-Length"));}catch(Exception ignored){}
     long count=0;int last=-1;
     if(size>134217728L)throw new IOException("APK trop volumineux");
     try(InputStream in=connection.getInputStream();FileOutputStream out=new FileOutputStream(partial,false)){
      byte[] buffer=new byte[32768];
      for(int n;(n=in.read(buffer))!=-1;){
       count+=n;if(count>134217728L)throw new IOException("APK trop volumineux");out.write(buffer,0,n);
       int percent=size>0?(int)Math.min(100,count*100/size):-1;
       if(percent!=last){last=percent;activity.runOnUiThread(()->{if(!activity.isDestroyed()){progress.setIndeterminate(percent<0);if(percent>=0)progress.setProgress(percent);}});}
      }
      out.getFD().sync();
     }
     if(count==0||(size>0&&count!=size))throw new IOException("Téléchargement incomplet ; ancien APK conservé");
     validate(activity,partial,expected);
     android.system.Os.rename(partial.getAbsolutePath(),apk.getAbsolutePath());
    }
    activity.runOnUiThread(()->{
     if(activity.isFinishing()||activity.isDestroyed())return;
     progress.dismiss();
     try{
      Uri uri=FileProvider.getUriForFile(activity,activity.getPackageName()+".sondeur-files",apk);
      activity.startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
     }catch(Exception error){new AlertDialog.Builder(activity).setTitle("Installation Nautic").setMessage("APK vérifié et conservé. Autorise Nautic à installer des applications dans les paramètres Android, puis réessaie. "+error.getMessage()).setPositiveButton("Fermer",null).show();}
    });
   }catch(Exception error){activity.runOnUiThread(()->{
    if(activity.isFinishing()||activity.isDestroyed())return;
    progress.dismiss();new AlertDialog.Builder(activity).setTitle("Mise à jour interrompue").setMessage(error.getMessage()+"\nL’application et tes réglages sont conservés.").setPositiveButton("Fermer",null).show();
   });}finally{if(connection!=null)connection.disconnect();if(partial!=null&&partial.exists())partial.delete();busy.set(false);}
  },"nautic-apk-download").start();
 }
 static void validate(Activity activity,File apk,int version)throws Exception{
  PackageManager pm=activity.getPackageManager();
  PackageInfo candidate=pm.getPackageArchiveInfo(apk.getAbsolutePath(),PackageManager.GET_SIGNATURES);
  PackageInfo installed=pm.getPackageInfo(activity.getPackageName(),PackageManager.GET_SIGNATURES);
  if(candidate==null||!activity.getPackageName().equals(candidate.packageName)||candidate.versionCode!=version||version<=installed.versionCode)throw new IOException("APK invalide ou version inattendue");
  if(candidate.signatures==null||installed.signatures==null||candidate.signatures.length==0||!new HashSet<>(Arrays.asList(candidate.signatures)).equals(new HashSet<>(Arrays.asList(installed.signatures))))throw new IOException("Signature de l’APK différente ; installation refusée");
 }
}
