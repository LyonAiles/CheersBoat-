package fr.nautic.test;
import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.WindowManager;
public class MainActivity extends Activity {
 private WebView web;
 private PermissionRequest pending;
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
  web=new WebView(this);
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);
  s.setAllowFileAccess(true);s.setGeolocationEnabled(true);s.setMediaPlaybackRequiresUserGesture(false);
  web.setWebViewClient(new WebViewClient());
  web.setWebChromeClient(new WebChromeClient(){
   @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback cb){
    cb.invoke(origin,checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED,false);
   }
   @Override public void onPermissionRequest(PermissionRequest req){
    runOnUiThread(()->{
     boolean video=false;
     for(String resource:req.getResources())if(PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource))video=true;
     if(!video){req.deny();return;}
     if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)
      req.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
     else{pending=req;requestPermissions(new String[]{Manifest.permission.CAMERA},101);}
    });
   }
   @Override public void onPermissionRequestCanceled(PermissionRequest req){if(pending==req)pending=null;}
  });
  setContentView(web);
  if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)
   requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},100);
  web.loadUrl("file:///android_asset/index.html");
 }
 @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){
  super.onRequestPermissionsResult(code,permissions,results);
  if(code==100&&web!=null)web.reload();
  if(code==101&&pending!=null){
   PermissionRequest r=pending;pending=null;
   if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)
    r.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
   else r.deny();
  }
 }
 @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(pending!=null)pending.deny();if(web!=null)web.destroy();super.onDestroy();}
}
