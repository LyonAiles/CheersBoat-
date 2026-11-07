package fr.nautic.test;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.view.*;
import android.widget.*;
import androidx.media3.common.*;
import androidx.media3.exoplayer.*;
import androidx.media3.exoplayer.rtsp.RtspMediaSource;

import org.json.JSONObject;
import java.util.ArrayList;

/** Three camera view: 42 above, 41 and 43 below. Dashboard decoders are released before entry. */
public class CameraMosaicActivity extends Activity {
 private final ArrayList<ExoPlayer> players=new ArrayList<>();
 private long lastRefresh;
 private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
 @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);}
 @Override protected void onStart(){super.onStart();build();}
 private void build(){
  release();FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.BLACK);LinearLayout rows=new LinearLayout(this);rows.setOrientation(LinearLayout.VERTICAL);root.addView(rows,new FrameLayout.LayoutParams(-1,-1));
  rows.addView(tile(2),new LinearLayout.LayoutParams(-1,0,1));LinearLayout bottom=new LinearLayout(this);rows.addView(bottom,new LinearLayout.LayoutParams(-1,0,1));bottom.addView(tile(1),new LinearLayout.LayoutParams(0,-1,1));bottom.addView(tile(3),new LinearLayout.LayoutParams(0,-1,1));
  TextView close=new TextView(this);close.setText("×");close.setTextColor(Color.WHITE);close.setTextSize(26);close.setGravity(Gravity.CENTER);close.setBackgroundColor(0x55000000);close.setContentDescription("Fermer la vue des trois caméras");FrameLayout.LayoutParams cp=new FrameLayout.LayoutParams(dp(44),dp(44),Gravity.TOP|Gravity.RIGHT);root.addView(close,cp);close.setOnClickListener(v->finish());TextView refresh=new TextView(this);refresh.setText("↻");refresh.setTextColor(Color.WHITE);refresh.setTextSize(24);refresh.setGravity(Gravity.CENTER);refresh.setBackgroundColor(0x55000000);refresh.setContentDescription("Rafraîchir les trois caméras");root.addView(refresh,new FrameLayout.LayoutParams(dp(44),dp(44),Gravity.TOP|Gravity.LEFT));refresh.setOnClickListener(v->{long now=android.os.SystemClock.uptimeMillis();if(now-lastRefresh>1000){lastRefresh=now;build();}});setContentView(root);
 }
 private FrameLayout tile(int index){
  FrameLayout frame=new FrameLayout(this);frame.setBackgroundColor(Color.BLACK);frame.setClipChildren(true);frame.setClipToPadding(true);frame.setContentDescription("Caméra "+(40+index));
  TextureView view=new TextureView(this);final float[] ratio={16f/9f};
  final int alignment=index==1?Gravity.LEFT:index==3?Gravity.RIGHT:Gravity.CENTER_HORIZONTAL;
  Runnable resize=()->{int h=frame.getHeight();if(h<=0)return;int w=Math.max(1,Math.round(h*ratio[0]));FrameLayout.LayoutParams layout=new FrameLayout.LayoutParams(w,h,Gravity.TOP|alignment);view.setLayoutParams(layout);};
  frame.addView(view,new FrameLayout.LayoutParams(-1,-1));frame.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->{if(r-l!=or-ol||b-t!=ob-ot)resize.run();});
  final int sourceIndex=CameraDisplaySource.index(this,index);
  String address="";try{
   address=TrematageAccess.address(this,sourceIndex);if(!address.startsWith("rtsp://"))throw new Exception("Caméra non configurée");Uri uri=Uri.parse(address);
   SharedPreferences credentials=getSharedPreferences("nautic_camera_private",MODE_PRIVATE);String user=credentials.getString("username"+sourceIndex,credentials.getString("username","")),pass=credentials.getString("password"+sourceIndex,credentials.getString("password",""));if(user.isEmpty())throw new Exception("Identifiants à renseigner dans Paramètres");
   String tapoHost=Uri.parse(TrematageAccess.address(this,TrematageAccess.index(this))).getHost();String path=CameraStreamPolicy.preview(uri.getPath(),false,sourceIndex==1||java.util.Objects.equals(tapoHost,uri.getHost()));
   String stream="rtsp://"+Uri.encode(user)+":"+Uri.encode(pass)+"@"+uri.getHost()+":"+(uri.getPort()>0?uri.getPort():554)+path;
   ExoPlayer player=new ExoPlayer.Builder(this,new DefaultRenderersFactory(this).setEnableDecoderFallback(true)).build();players.add(player);player.setVideoTextureView(view);player.setVolume(0);
   player.addListener(new Player.Listener(){@Override public void onVideoSizeChanged(VideoSize size){if(size.width>0&&size.height>0){ratio[0]=(float)size.width*size.pixelWidthHeightRatio/size.height;resize.run();}}@Override public void onPlayerError(PlaybackException error){frame.setContentDescription("Caméra "+(40+index)+" indisponible, toucher pour ouvrir seule");}});
   player.setMediaSource(new RtspMediaSource.Factory().setForceUseRtpTcp(true).createMediaSource(MediaItem.fromUri(stream)));player.prepare();player.play();
  }catch(Exception e){frame.setContentDescription("Caméra "+(40+index)+" non disponible");}
  final String url=address;View.OnClickListener open=v->{if(!url.startsWith("rtsp://"))return;Intent i=new Intent(this,CameraActivity.class);i.putExtra("url",url);i.putExtra("cameraIndex",sourceIndex);i.putExtra("singleCamera",true);startActivity(i);};frame.setOnClickListener(open);view.setOnClickListener(open);return frame;
 }
 private void release(){for(ExoPlayer player:players)player.release();players.clear();}
 @Override protected void onPause(){release();super.onPause();}
 @Override protected void onStop(){release();super.onStop();}
 @Override protected void onDestroy(){release();super.onDestroy();}
}
