package fr.nautic.test;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
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
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.graphics.PixelFormat;
import android.widget.TextView;
import android.graphics.drawable.GradientDrawable;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

public class MainActivity extends Activity {
 private static final int PICK_PHONE=201, PICK_IMAGE=202, MOVE_CAPTURE=203, BROWSE_CAPTURES=204, GPS=100, CAMERA=101, CALLS=103;
 private String captureToMove;
 private WebView web;
 private android.widget.FrameLayout dashboardLayer;
 private DashboardCameras dashboardCameras;
 private final java.util.concurrent.ExecutorService dashboardCommands=java.util.concurrent.Executors.newSingleThreadExecutor();
 private final java.util.concurrent.atomic.AtomicBoolean trematageBusy=new java.util.concurrent.atomic.AtomicBoolean();
 private boolean dashboardVisible=false,mapManipulating=false;
 private boolean reducedWithButton=false;
 void dashboardClick(String id,boolean held){js(held?"nauticDashboardHold":"nauticDashboardClick",id);}
 void updateMapCameraAlpha(float alpha){js("nauticMapCameraAlpha",Float.toString(alpha));}
 void refreshDashboardVideos(){js("nauticDashboardResume","");}
 void dashboardAlert(String message){js("nauticTrematageAlert",message);}
 private PermissionRequest pendingCamera;
 private NotesPad notesPad;
 private android.content.BroadcastReceiver trematageReceiver;
 @Override protected void onStart(){super.onStart();trematageReceiver=TrematageAlerts.attach(this);}
 @Override protected void onPause(){mapManipulating=false;dashboardVisible=false;if(dashboardCameras!=null)dashboardCameras.suspend();super.onPause();}
 @Override protected void onStop(){dashboardVisible=false;if(trematageReceiver!=null){unregisterReceiver(trematageReceiver);trematageReceiver=null;}super.onStop();}
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  if(state!=null)captureToMove=state.getString("captureToMove");
  if(RemoteTwinService.prefs(this).getBoolean("enabled",false))RemoteTwinService.apply(this);
  notesPad=new NotesPad(this,()->{dashboardVisible=true;js("nauticDashboardResume","");});
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
  android.widget.FrameLayout dashboard=new android.widget.FrameLayout(this);dashboard.addView(web,new android.widget.FrameLayout.LayoutParams(-1,-1));
  dashboardLayer=new android.widget.FrameLayout(this);dashboard.addView(dashboardLayer,new android.widget.FrameLayout.LayoutParams(-1,-1));setContentView(dashboard);
  if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)
   requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},GPS);
  web.loadUrl("file:///android_asset/index.html");
  NauticUpdates.check(this);
 }
 private void toast(String s){runOnUiThread(()->Toast.makeText(this,s,Toast.LENGTH_LONG).show());}
 private void js(String name,String value){
  String escaped=org.json.JSONObject.quote(value==null?"":value);
  runOnUiThread(()->web.evaluateJavascript("window."+name+" && window."+name+"("+escaped+")",null));
 }
 private boolean cameraOrientationPending;
 private void requestCameraOrientation(int index,String direction){
  if(cameraOrientationPending)return;
  cameraOrientationPending=true;
  toast("Orientation · "+direction+"…");
  dashboardCommands.execute(()->{
   String failure=null;
   try{CameraAxis.move(this,index,direction);}
   catch(Exception error){failure=error.getMessage()==null?"Commande ONVIF impossible.":error.getMessage();}
   String result=failure;
   runOnUiThread(()->{
    cameraOrientationPending=false;
    if(isDestroyed()||isFinishing())return;
    if(result==null)toast("Position demandée · "+direction);
    else new AlertDialog.Builder(this).setTitle("Orientation de la caméra")
      .setMessage(result).setPositiveButton("Fermer",null).show();
   });
  });
 }
 private void showCameraOrientations(int index){
  if(cameraOrientationPending||isFinishing())return;
  android.widget.LinearLayout menu=new android.widget.LinearLayout(this);
  menu.setOrientation(android.widget.LinearLayout.VERTICAL);
  int padding=Math.round(12*getResources().getDisplayMetrics().density);
  menu.setPadding(padding,padding,padding,padding);
  AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Orientation de la caméra").setView(menu).create();
  addOrientationRow(menu,dialog,index,new String[]{"","▲",""},new String[]{"","PROUE",""});
  addOrientationRow(menu,dialog,index,new String[]{"◀","BASE","▶"},new String[]{"BÂBORD","BASE","TRIBORD"});
  addOrientationRow(menu,dialog,index,new String[]{"","▼",""},new String[]{"","TREMATAGE",""});
  try{
   if(CameraAxis.hasReturn(this,index))addOrientationRow(menu,dialog,index,
     new String[]{"Retour précédent"},new String[]{"RETOUR"});
  }catch(Exception ignored){}
  dialog.show();
 }
 private void addOrientationRow(android.widget.LinearLayout menu,AlertDialog dialog,int index,String[] labels,String[] directions){
  android.widget.LinearLayout row=new android.widget.LinearLayout(this);
  for(int i=0;i<labels.length;i++){
   String direction=directions[i];
   if(direction.isEmpty()){
    row.addView(new android.widget.Space(this),new android.widget.LinearLayout.LayoutParams(0,0,1));
    continue;
   }
   android.widget.Button button=new android.widget.Button(this);
   button.setText(labels[i]);
   button.setContentDescription(direction.equals("TREMATAGE")?"Trématage":direction);
   button.setOnClickListener(view->{dialog.dismiss();requestCameraOrientation(index,direction);});
   row.addView(button,new android.widget.LinearLayout.LayoutParams(0,-2,1));
  }
  menu.addView(row);
 }
 private void composeSondeurMail(String recipient, String subject, String body, Bitmap image) {
  js("nauticSondeurCaptureDone", "");
  try {
   Intent intent = new Intent(Intent.ACTION_SEND);
   intent.setType("message/rfc822");
   intent.putExtra(Intent.EXTRA_EMAIL, new String[]{recipient});
   intent.putExtra(Intent.EXTRA_SUBJECT, subject);
   intent.putExtra(Intent.EXTRA_TEXT, body);
   if (image != null) {
    java.io.File dir = new java.io.File(getCacheDir(), "sondeur-maps");
    if (!dir.isDirectory() && !dir.mkdirs()) throw new java.io.IOException("Carte inaccessible");
    java.io.File file = java.io.File.createTempFile("carte-alerte-5-km-", ".png", dir);
    try (java.io.FileOutputStream out = new java.io.FileOutputStream(file)) {
     if (!image.compress(Bitmap.CompressFormat.PNG, 100, out)) throw new java.io.IOException("Carte inaccessible");
    }
    Uri uri = androidx.core.content.FileProvider.getUriForFile(this, getPackageName() + ".sondeur-files", file);
    intent.putExtra(Intent.EXTRA_STREAM, uri);
    intent.setClipData(android.content.ClipData.newRawUri("Carte de l’alerte", uri));
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
   } else {
    toast("Capture indisponible, brouillon ouvert sans carte");
   }
   startActivity(Intent.createChooser(intent, "Préparer le courriel"));
  } catch (Exception e) {
   toast("Impossible de préparer le courriel");
  } finally {
   if (image != null) image.recycle();
  }
 }

 private void captureSondeurMap(String recipient, String subject, String body, double x, double y, double width, double height, double scale) {
  int[] position = new int[2];
  web.getLocationInWindow(position);
  android.graphics.Rect area = new android.graphics.Rect(
      position[0] + (int)Math.round(x * scale), position[1] + (int)Math.round(y * scale),
      position[0] + (int)Math.round((x + width) * scale), position[1] + (int)Math.round((y + height) * scale));
  if (!area.intersect(position[0], position[1], position[0] + web.getWidth(), position[1] + web.getHeight())) {
   composeSondeurMail(recipient, subject, body, null);
   return;
  }
  Bitmap image = Bitmap.createBitmap(area.width(), area.height(), Bitmap.Config.ARGB_8888);
  if (android.os.Build.VERSION.SDK_INT >= 26) {
   try {
    android.view.PixelCopy.request(getWindow(), area, image, result -> {
     if (result == android.view.PixelCopy.SUCCESS) composeSondeurMail(recipient, subject, body, image);
     else { image.recycle(); composeSondeurMail(recipient, subject, body, null); }
    }, new android.os.Handler(getMainLooper()));
    return;
   } catch (IllegalArgumentException ignored) {}
  }
  android.graphics.Canvas canvas = new android.graphics.Canvas(image);
  canvas.translate(position[0] - area.left, position[1] - area.top);
  web.draw(canvas);
  composeSondeurMail(recipient, subject, body, image);
 }

 public class Bridge {
  @JavascriptInterface public void composeSondeurMail(String recipient, String subject, String body, double x, double y, double width, double height, double scale) {
   runOnUiThread(() -> captureSondeurMap(recipient, subject, body, x, y, width, height, scale));
  }
  @JavascriptInterface public void openNotes(){runOnUiThread(()->{dashboardVisible=false;if(dashboardCameras!=null){dashboardCameras.close();dashboardCameras=null;}notesPad.show();});}
  @JavascriptInterface public void mapInteraction(boolean active){runOnUiThread(()->{mapManipulating=active;if(dashboardCameras!=null)dashboardCameras.pauseForMap(active);});}
  @JavascriptInterface public void searchMapCity(String name,int request){
   new Thread(()->{
    org.json.JSONObject result=new org.json.JSONObject();
    try{
     result.put("request",request);
     try{result.put("cities",new org.json.JSONArray(NauticNotices.searchCity(name)));}
     catch(Exception e){result.put("failed",true);}
     if(!isDestroyed())js("nauticCitySearchResult",result.toString());
    }catch(org.json.JSONException ignored){}
   },"nautic-map-city").start();
  }
  @JavascriptInterface public void navigationDataStats(){
   new Thread(()->{
    try{if(!isDestroyed())js("nauticNavigationStats",NavigationStore.get(MainActivity.this).stats().toString());}
    catch(Exception error){if(!isDestroyed())js("nauticNavigationStats","{}");}
   },"nautic-data-counter").start();
  }
  @JavascriptInterface public String readNavigationTile(String key){
   try{org.json.JSONObject entry=NavigationStore.get(MainActivity.this).read(key);return entry==null?"":entry.toString();}
   catch(Exception error){return "";}
  }
  @JavascriptInterface public void syncNavigationTile(int request,String key,String query,boolean force){
   new Thread(()->{
    try{
     org.json.JSONObject result=new org.json.JSONObject().put("request",request);
     try{
      if(!key.matches("fr-[0-9]+-[0-9]+"))throw new java.io.IOException("zone invalide");
      android.content.SharedPreferences syncPrefs=getSharedPreferences("nautic_settings",MODE_PRIVATE);
      NauticSigns.retryAt=Math.max(NauticSigns.retryAt,syncPrefs.getLong("nautic-data-retry-at",0));
      NavigationStore store=NavigationStore.get(MainActivity.this);
      org.json.JSONObject entry=store.read(key);long now=System.currentTimeMillis();String source="locale";
      if(force||entry==null||now-entry.optLong("updated",0)>7L*86400000){
       String base=getSharedPreferences("nautic_settings",MODE_PRIVATE).getString("nautic-data-base-url","");
       org.json.JSONObject shared=null;
       try{shared=NavigationStore.shared(base,key);}catch(Exception ignored){}
       if(shared!=null&&now-shared.optLong("updated",0)<=7L*86400000){entry=shared;source="base réseau";}
       else{entry=new org.json.JSONObject().put("id",key).put("updated",now).put("elements",NauticSigns.lookupQuery(query));source="recherche externe";}
       store.save(key,entry);
      }
      result.put("entry",entry).put("source",source);
      syncPrefs.edit().putLong("nautic-data-retry-at",NauticSigns.retryAt).apply();
     }catch(Exception error){
      getSharedPreferences("nautic_settings",MODE_PRIVATE).edit().putLong("nautic-data-retry-at",NauticSigns.retryAt).apply();
      result.put("retryAt",NauticSigns.retryAt).put("error",error.getMessage()==null?"mise à jour interrompue":error.getMessage());
     }
     if(!isDestroyed())js("nauticNavigationTileResult",result.toString());
    }catch(org.json.JSONException ignored){}
   },"nautic-local-data").start();
  }
  @JavascriptInterface public void searchMapWorks(int request,String query){
   new Thread(()->{
    try{
     org.json.JSONObject result=new org.json.JSONObject().put("request",request);
     try{result.put("elements",NauticSigns.lookupQuery(query));}
     catch(java.io.IOException error){result.put("error",error.getMessage());}
     if(!isDestroyed())js("nauticMapWorksResult",result.toString());
    }catch(org.json.JSONException ignored){}
   },"nautic-map-works").start();
  }
  @JavascriptInterface public void searchMapSigns(int request,double south,double west,double north,double east){
   new Thread(()->{
    try{
     org.json.JSONObject result=new org.json.JSONObject().put("request",request);
     try{result.put("elements",NauticSigns.lookup(south,west,north,east));}
     catch(java.io.IOException error){result.put("error",error.getMessage());}
     if(!isDestroyed())js("nauticMapSignsResult",result.toString());
    }catch(org.json.JSONException ignored){}
   },"nautic-map-signs").start();
  }
  @JavascriptInterface public void checkRouteImpacts(String routes){
   new Thread(()->{
    try{if(!isDestroyed())js("nauticRouteImpacts",NauticNotices.lookupImpacts(routes));}
    catch(Exception e){if(!isDestroyed())js("nauticRouteImpacts","");}
   },"nautic-euris-impacts").start();
  }
  @JavascriptInterface public void checkNavigationNotices(){
   new Thread(()->{
    try{if(!isDestroyed())js("nauticNavigationNotices",NauticNotices.lookup());}
    catch(Exception e){if(!isDestroyed())js("nauticNavigationNotices","");}
   },"nautic-vnf-notices").start();
  }
  @JavascriptInterface public void dashboardPreviews(String json){runOnUiThread(()->{
   if(mapManipulating||!dashboardVisible||(notesPad!=null&&notesPad.isShowing()))return;if(dashboardCameras==null)dashboardCameras=new DashboardCameras(MainActivity.this,dashboardLayer);dashboardCameras.update(json);
  });}
  @JavascriptInterface public void openRemoteTwin(){runOnUiThread(()->RemoteTwinSettings.open(MainActivity.this));}
  @JavascriptInterface public void previewAlertSound(String sound){CameraAlertSounds.play(MainActivity.this,"42",sound);}
  @JavascriptInterface public String camera42Status(){return Camera42Access.status(MainActivity.this);}
  @JavascriptInterface public void toggleCamera42(){runOnUiThread(()->{try{js("nauticCamera42Result",Camera42Access.toggle(MainActivity.this));}catch(Exception e){js("nauticCamera42Result",e.getMessage());}});}
  @JavascriptInterface public String trematageStatus(){return TrematageAccess.status(MainActivity.this);}
  @JavascriptInterface public boolean hasLatestCameraVideo(){return DashboardRecording.latest(MainActivity.this)!=null;}
  @JavascriptInterface public void cameraCapture(String action){
   runOnUiThread(()->{if(dashboardVisible&&dashboardCameras!=null)dashboardCameras.captureAction(action);});
  }
  @JavascriptInterface public void openCameraOrientations(int index){
   if(index>=1&&index<=3)runOnUiThread(()->showCameraOrientations(index));
  }
  @JavascriptInterface public void toggleTrematage(){
   if(!trematageBusy.compareAndSet(false,true))return;
   dashboardCommands.execute(()->{try{String message=TrematageAccess.toggle(MainActivity.this);js("nauticTrematageResult",message);}catch(Exception e){js("nauticTrematageResult",e.getMessage());}finally{trematageBusy.set(false);}});
  }
  @JavascriptInterface public void openTrematageCamera(){runOnUiThread(()->{try{
   int index=TrematageAccess.index(MainActivity.this);String address=TrematageAccess.address(MainActivity.this,index);
   if(!address.startsWith("rtsp://")){toast("Configurer la TC47 dans Paramètres");return;}
   Intent i=new Intent(MainActivity.this,CameraActivity.class);i.putExtra("url",address);i.putExtra("cameraIndex",index);i.putExtra("mobileOnly",true);i.putExtra("autoControls",true);startActivity(i);
  }catch(Exception e){toast("Caméra mobile indisponible");}});}
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
  @JavascriptInterface public void minimizeApp(){runOnUiThread(()->reducedWithButton=moveTaskToBack(true));}
  @JavascriptInterface public void call(String number){runOnUiThread(()->{
   try{startActivity(new Intent(Intent.ACTION_DIAL,Uri.parse("tel:"+Uri.encode(number))));}
   catch(Exception e){toast("Téléphone indisponible");}
  });}
  @JavascriptInterface public void dialSip(String number,String domain){runOnUiThread(()->{
   if(number==null||!number.matches("[+]?[0-9]+")||domain==null||
      !domain.matches("(?i)[a-z0-9-]+(?:[.][a-z0-9-]+)+(?::[0-9]{1,5})?")){
    toast("Numéro ou domaine SIP invalide");
    return;
   }
   try{startActivity(new Intent(Intent.ACTION_DIAL,Uri.fromParts("sip",number+"@"+domain,null)));}
   catch(android.content.ActivityNotFoundException e){toast("Aucune application ne prend en charge les appels SIP");}
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
  @JavascriptInterface public void openWaterLevel(){runOnUiThread(()->WaterLevelDialog.open(MainActivity.this));}
  @JavascriptInterface public void openBoat(){runOnUiThread(()->{
   Intent i=new Intent(MainActivity.this,BoatActivity.class);startActivity(i);
  });}
  @JavascriptInterface public void scanLocalDevices(){runOnUiThread(()->{
   Intent i=new Intent(MainActivity.this,CameraActivity.class);
   i.putExtra("discover",true);i.putExtra("chooseCamera",true);startActivity(i);
  });}
  @JavascriptInterface public void configureRtsp(int index){runOnUiThread(()->{
   Intent i=new Intent(MainActivity.this,CameraActivity.class);i.putExtra("settings",true);i.putExtra("cameraIndex",index);startActivity(i);
  });}
  @JavascriptInterface public void openCameraMosaic(){runOnUiThread(()->startActivity(new Intent(MainActivity.this,CameraMosaicActivity.class)));}
  @JavascriptInterface public void openDashboardCamera(int index){runOnUiThread(()->{try{if(index!=1&&index!=3)return;int sourceIndex=CameraDisplaySource.index(MainActivity.this,index);String address=TrematageAccess.address(MainActivity.this,sourceIndex);if(address==null||!address.startsWith("rtsp://")){toast("Configurer cette caméra dans Paramètres");return;}Intent i=new Intent(MainActivity.this,CameraActivity.class);i.putExtra("url",address);i.putExtra("cameraIndex",sourceIndex);i.putExtra("singleCamera",true);startActivity(i);}catch(Exception e){toast("Caméra indisponible");}});}
  @JavascriptInterface public void openRtspForCamera(String address,int index){runOnUiThread(()->{
   if(address==null||!address.startsWith("rtsp://")){discoverForCamera(index);return;}
   Intent i=new Intent(MainActivity.this,CameraActivity.class);
   i.putExtra("url",address);i.putExtra("cameraIndex",index);
   boolean dual=index==1;try{dual=dual||java.util.Objects.equals(Uri.parse(address).getHost(),Uri.parse(TrematageAccess.address(MainActivity.this,TrematageAccess.index(MainActivity.this))).getHost());}catch(Exception ignored){}
   i.putExtra("singleCamera",!dual);startActivity(i);
  });}
  @JavascriptInterface public void discoverForCamera(int index){runOnUiThread(()->{
   Intent i=new Intent(MainActivity.this,CameraActivity.class);
   i.putExtra("discover",true);i.putExtra("cameraIndex",index);startActivity(i);
  });}
  @JavascriptInterface public void openRtsp(String address){runOnUiThread(()->{
   if(!address.toLowerCase().startsWith("rtsp://")){toast("Adresse RTSP invalide");return;}
   Intent i=new Intent(MainActivity.this,CameraActivity.class);i.putExtra("url",address);startActivity(i);
  });}
 }
 @Override protected void onResume(){
  super.onResume();dashboardVisible=true;
  if(dashboardCameras!=null)dashboardCameras.resume();
  js("nauticDashboardResume","");
  if(reducedWithButton){reducedWithButton=false;NauticUpdates.check(this);}
  String saved=getSharedPreferences("nautic_settings",MODE_PRIVATE).getString("nautic-v04","");
  if(!saved.isEmpty())js("nauticCameraAddressSync",saved);
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
 void openCaptureDirectory(){
  Intent picker=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
   .setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/jpeg","video/mp4"});
  if(android.os.Build.VERSION.SDK_INT>=26)picker.putExtra(android.provider.DocumentsContract.EXTRA_INITIAL_URI,
   CaptureDocuments.directoryUri(this));
  try{startActivityForResult(picker,BROWSE_CAPTURES);}
  catch(ActivityNotFoundException e){toast("Application Fichiers indisponible");}
 }
 void chooseCaptureDestination(String name){
  Intent picker=new Intent(Intent.ACTION_CREATE_DOCUMENT)
   .addCategory(Intent.CATEGORY_OPENABLE)
   .setType(name.endsWith(".jpg")?"image/jpeg":"video/mp4")
   .putExtra(Intent.EXTRA_TITLE,name);
  captureToMove=name;
  try{startActivityForResult(picker,MOVE_CAPTURE);}
  catch(ActivityNotFoundException e){captureToMove=null;toast("Sélecteur de fichiers indisponible");}
 }
 @Override protected void onSaveInstanceState(Bundle state){
  super.onSaveInstanceState(state);
  state.putString("captureToMove",captureToMove);
 }
 private void moveCapture(String name,Uri destination){
  java.io.File source=DashboardRecording.findCapture(this,name);
  if(source==null){toast("Capture introuvable");return;}
  try{
   try(InputStream input=new java.io.FileInputStream(source);
       java.io.OutputStream output=getContentResolver().openOutputStream(destination,"wt")){
    if(output==null)throw new java.io.IOException("Destination inaccessible");
    byte[] buffer=new byte[65536];
    long copied=0;
    int read;
    while((read=input.read(buffer))!=-1){output.write(buffer,0,read);copied+=read;}
    if(copied!=source.length()||copied==0)throw new java.io.IOException("Copie incomplète");
   }
  }catch(java.io.IOException|RuntimeException e){
   try{android.provider.DocumentsContract.deleteDocument(getContentResolver(),destination);}
   catch(Exception ignored){}
   toast("Déplacement impossible · original conservé");
   return;
  }
  boolean moved=source.delete();
  toast(moved?"Capture déplacée":"Capture copiée · original conservé");
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
  super.onActivityResult(request,result,data);
  if(request==BROWSE_CAPTURES){
   if(result==RESULT_OK&&data!=null&&data.getData()!=null){
    Uri uri=data.getData();
    try{
     Intent view=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,getContentResolver().getType(uri))
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
     startActivity(view);
    }catch(ActivityNotFoundException|SecurityException e){toast("Aucune application pour ouvrir ce fichier");}
   }
   return;
  }
  if(request==MOVE_CAPTURE){
   String name=captureToMove;
   captureToMove=null;
   if(name!=null&&result==RESULT_OK&&data!=null&&data.getData()!=null){
    Uri destination=data.getData();
    dashboardCommands.execute(()->moveCapture(name,destination));
   }
   return;
  }
  if(notesPad!=null&&notesPad.result(request,result,data))return;
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
 @Override public void onBackPressed(){if(dashboardCameras!=null&&dashboardCameras.dismissPlayback())return;if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(notesPad!=null)notesPad.destroy();dashboardCommands.shutdown();if(dashboardCameras!=null)dashboardCameras.close();if(pendingCamera!=null)pendingCamera.deny();if(web!=null)web.destroy();super.onDestroy();}
}
