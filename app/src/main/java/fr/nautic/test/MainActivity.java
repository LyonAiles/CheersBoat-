package fr.nautic.test;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.content.pm.PackageManager;
import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.provider.CallLog;
import org.json.JSONArray;
import org.json.JSONObject;
import android.database.Cursor;
import android.util.Base64;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.view.WindowManager;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

public class MainActivity extends Activity {
 private static final int PICK_PHONE=201, PICK_IMAGE=202, GPS=100, CAMERA=101, CALLS=103;
 private WebView web;
 private PermissionRequest pendingCamera;
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
  web=new WebView(this);
  WebSettings s=web.getSettings();
  s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(true);
  s.setGeolocationEnabled(true);s.setMediaPlaybackRequiresUserGesture(false);
  web.addJavascriptInterface(new Bridge(),"NauticAndroid");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){
    return external(req.getUrl());
   }
   @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return external(Uri.parse(url));}
   private boolean external(Uri uri){
    String scheme=uri.getScheme();
    if("tel".equals(scheme)||"sms".equals(scheme)||"smsto".equals(scheme)){
     try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){toast("Application téléphone ou SMS introuvable");}
     return true;
    }
    if("file".equals(scheme)||"about".equals(scheme)||"data".equals(scheme))return false;
    // Do not expose JavaScript bridge to remote sites inside this WebView.
    try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){toast("Lien inaccessible");}
    return true;
   }
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback cb){
    cb.invoke(origin,checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED,false);
   }
   @Override public void onPermissionRequest(PermissionRequest req){runOnUiThread(()->{
    boolean video=false;
    for(String r:req.getResources())if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r))video=true;
    if(!video){req.deny();return;}
    if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)
     req.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
    else{pendingCamera=req;requestPermissions(new String[]{Manifest.permission.CAMERA},CAMERA);}
   });}
   @Override public void onPermissionRequestCanceled(PermissionRequest req){if(pendingCamera==req)pendingCamera=null;}
  });
  setContentView(web);
  if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)
   requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},GPS);
  web.loadUrl("file:///android_asset/index.html");
 }
 private void toast(String s){runOnUiThread(()->Toast.makeText(this,s,Toast.LENGTH_LONG).show());}
 private void js(String name,String value){
  String escaped=org.json.JSONObject.quote(value==null?"":value);
  runOnUiThread(()->web.evaluateJavascript("window."+name+" && window."+name+"("+escaped+")",null));
 }
 public class Bridge {
  // SharedPreferences est indépendant du stockage WebView (file://).
  @JavascriptInterface public String readSetting(String key){
   return getSharedPreferences("nautic_settings",MODE_PRIVATE).getString(key,"");
  }
  @JavascriptInterface public boolean writeSetting(String key,String value){
   return getSharedPreferences("nautic_settings",MODE_PRIVATE).edit().putString(key,value).commit();
  }
  @JavascriptInterface public String versionName(){
   try{return getPackageManager().getPackageInfo(getPackageName(),0).versionName;}
   catch(Exception e){return "?";}
  }
  @JavascriptInterface public void exitApp(){runOnUiThread(()->{if(web!=null)web.stopLoading();finish();});}
  @JavascriptInterface public void call(String number){runOnUiThread(()->{
   try{startActivity(new Intent(Intent.ACTION_DIAL,Uri.parse("tel:"+Uri.encode(number))));}
   catch(Exception e){toast("Téléphone indisponible");}
  });}
  @JavascriptInterface public void sms(String number,String message){runOnUiThread(()->{
   try{Intent i=new Intent(Intent.ACTION_SENDTO,Uri.parse("smsto:"+Uri.encode(number)));
    i.putExtra("sms_body",message);startActivity(i);
   }catch(Exception e){toast("Messagerie SMS indisponible");}
  });}
  @JavascriptInterface public void pickContact(){runOnUiThread(()->{
   try{Intent i=new Intent(Intent.ACTION_PICK,ContactsContract.CommonDataKinds.Phone.CONTENT_URI);
    startActivityForResult(i,PICK_PHONE);
   }catch(Exception e){toast("Sélecteur de contacts indisponible");}
  });}
  @JavascriptInterface public void pickImage(){runOnUiThread(()->{
   try{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("image/*");i.addCategory(Intent.CATEGORY_OPENABLE);
    startActivityForResult(i,PICK_IMAGE);
   }catch(Exception e){toast("Galerie indisponible");}
  });}
  @JavascriptInterface public void recentPhoneCalls(){runOnUiThread(()->{
   if(checkSelfPermission(Manifest.permission.READ_CALL_LOG)!=PackageManager.PERMISSION_GRANTED){
    requestPermissions(new String[]{Manifest.permission.READ_CALL_LOG},CALLS);return;
   }
   sendRecentCalls();
  });}
  @JavascriptInterface public void cameraActivities(String pkg){runOnUiThread(()->{
   try{
    if(pkg==null||pkg.trim().isEmpty()){js("nauticCameraActivities","[]");return;}
    JSONArray out=new JSONArray();
    android.content.pm.PackageInfo info=getPackageManager().getPackageInfo(pkg,PackageManager.GET_ACTIVITIES);
    if(info.activities!=null)for(ActivityInfo a:info.activities){
     if(!a.exported)continue;
     JSONObject item=new JSONObject();
     item.put("name",a.name);
     item.put("label",a.loadLabel(getPackageManager()).toString());
     out.put(item);
    }
    js("nauticCameraActivities",out.toString());
   }catch(Exception e){js("nauticCameraActivities","[]");toast("Activités accessibles introuvables");}
  });}
  @JavascriptInterface public void launchCameraActivity(String pkg,String activity){runOnUiThread(()->{
   try{
    android.content.pm.PackageInfo info=getPackageManager().getPackageInfo(pkg,PackageManager.GET_ACTIVITIES);
    boolean allowed=false;
    if(info.activities!=null)for(ActivityInfo a:info.activities)if(a.exported&&a.name.equals(activity))allowed=true;
    if(!allowed){toast("Activité non accessible");return;}
    Intent i=new Intent(Intent.ACTION_MAIN);i.setClassName(pkg,activity);startActivity(i);
   }catch(Exception e){toast("Cette activité refuse le lancement direct");}
  });}
  @JavascriptInterface public void openCameraApp(String packageName,String deepLink){runOnUiThread(()->{
   try{
    if(deepLink!=null&&!deepLink.trim().isEmpty()){
     Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(deepLink));
     if(packageName!=null&&!packageName.trim().isEmpty())intent.setPackage(packageName);
     startActivity(intent);return;
    }
    if(packageName==null||packageName.trim().isEmpty()){toast("Identifiant de l’application manquant");return;}
    Intent launch=getPackageManager().getLaunchIntentForPackage(packageName);
    if(launch==null){toast("Application caméra non trouvée");return;}
    startActivity(launch);
   }catch(Exception e){toast("Impossible d’ouvrir l’application caméra");}
  });}
  @JavascriptInterface public void openTapo(){runOnUiThread(()->{
   try{
    Intent launch=getPackageManager().getLaunchIntentForPackage("com.tplink.iot");
    if(launch==null){
     Intent i=new Intent(Intent.ACTION_VIEW,Uri.parse("tapo://"));
     startActivity(i);
    }else startActivity(launch);
   }catch(Exception e){toast("Ouvre Tapo pour choisir la double vue");}
  });}
  @JavascriptInterface public void openBoat(){runOnUiThread(()->{
   Intent i=new Intent(MainActivity.this,BoatActivity.class);startActivity(i);
  });}
  @JavascriptInterface public void openRtsp(String address){runOnUiThread(()->{
   if(!address.toLowerCase().startsWith("rtsp://")){toast("Adresse RTSP invalide");return;}
   Intent i=new Intent(MainActivity.this,CameraActivity.class);i.putExtra("url",address);startActivity(i);
  });}
 }
 private void sendRecentCalls(){
  JSONArray out=new JSONArray();
  try(Cursor c=getContentResolver().query(CallLog.Calls.CONTENT_URI,
   new String[]{CallLog.Calls.NUMBER,CallLog.Calls.CACHED_NAME,CallLog.Calls.TYPE},
   null,null,CallLog.Calls.DATE+" DESC")){
   if(c!=null){java.util.HashSet<String> seen=new java.util.HashSet<>();
    while(c.moveToNext()&&out.length()<12){
     String number=c.getString(0),name=c.getString(1);
     if(number==null||number.trim().isEmpty()||!seen.add(number))continue;
     JSONObject item=new JSONObject();item.put("number",number);
     item.put("label",name==null||name.trim().isEmpty()?number:name);
     out.put(item);
    }
   }
  }catch(Exception e){toast("Historique des appels inaccessible");}
  js("nauticPhoneCallHistory",out.toString());
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
  super.onActivityResult(request,result,data);
  if(result!=RESULT_OK||data==null||data.getData()==null)return;
  if(request==PICK_PHONE){
   try(Cursor c=getContentResolver().query(data.getData(),new String[]{ContactsContract.CommonDataKinds.Phone.NUMBER},null,null,null)){
    if(c!=null&&c.moveToFirst())js("nauticSelectedContact",c.getString(0));
   }catch(Exception e){toast("Lecture du contact impossible");}
  }
  if(request==PICK_IMAGE){
   try(InputStream in=getContentResolver().openInputStream(data.getData())){
    BitmapFactory.Options o=new BitmapFactory.Options();o.inJustDecodeBounds=true;
    BitmapFactory.decodeStream(in,null,o);
    int sample=1;while(Math.max(o.outWidth/sample,o.outHeight/sample)>1400)sample*=2;
    try(InputStream in2=getContentResolver().openInputStream(data.getData())){
     BitmapFactory.Options opts=new BitmapFactory.Options();opts.inSampleSize=sample;
     Bitmap b=BitmapFactory.decodeStream(in2,null,opts);
     if(b==null){toast("Image illisible");return;}
     ByteArrayOutputStream out=new ByteArrayOutputStream();b.compress(Bitmap.CompressFormat.JPEG,75,out);b.recycle();
     js("nauticSelectedImage","data:image/jpeg;base64,"+Base64.encodeToString(out.toByteArray(),Base64.NO_WRAP));
    }
   }catch(Exception e){toast("Impossible de charger l’image");}
  }
 }
 @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){
  super.onRequestPermissionsResult(code,permissions,results);
  if(code==GPS&&web!=null)web.reload();
  if(code==CALLS){if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)sendRecentCalls();else js("nauticPhoneCallHistory","[]");}
  if(code==CAMERA&&pendingCamera!=null){PermissionRequest r=pendingCamera;pendingCamera=null;
   if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)
    r.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else r.deny();}
 }
 @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(pendingCamera!=null)pendingCamera.deny();if(web!=null)web.destroy();super.onDestroy();}
}
