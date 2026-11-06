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
import androidx.media3.ui.PlayerView;
import org.json.JSONObject;
import java.util.ArrayList;

/** Three camera view: 42 above, 41 and 43 below. Dashboard decoders are released before entry. */
public class CameraMosaicActivity extends Activity {
 private final ArrayList<ExoPlayer> players=new ArrayList<>();
 private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
 @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);}
 @Override protected void onStart(){super.onStart();build();}
 private void build(){
  release();FrameLayout root=new FrameLayout(this);root.setBackgroundColor(0xff052336);LinearLayout rows=new LinearLayout(this);rows.setOrientation(LinearLayout.VERTICAL);root.addView(rows,new FrameLayout.LayoutParams(-1,-1));
  rows.addView(tile(2),new LinearLayout.LayoutParams(-1,0,1));LinearLayout bottom=new LinearLayout(this);rows.addView(bottom,new LinearLayout.LayoutParams(-1,0,1));bottom.addView(tile(1),new LinearLayout.LayoutParams(0,-1,1));bottom.addView(tile(3),new LinearLayout.LayoutParams(0,-1,1));
  Button close=new Button(this);close.setText("×");close.setContentDescription("Fermer la vue des trois caméras");FrameLayout.LayoutParams cp=new FrameLayout.LayoutParams(dp(44),dp(44),Gravity.TOP|Gravity.RIGHT);root.addView(close,cp);close.setOnClickListener(v->finish());setContentView(root);
 }
 private FrameLayout tile(int index){
  FrameLayout frame=new FrameLayout(this);frame.setPadding(dp(2),dp(2),dp(2),dp(2));frame.setBackgroundColor(0xff387b96);
  PlayerView view=new PlayerView(this);view.setUseController(false);frame.addView(view,new FrameLayout.LayoutParams(-1,-1));
  TextView title=new TextView(this);title.setTextColor(Color.WHITE);title.setTextSize(14);title.setGravity(Gravity.CENTER);title.setBackgroundColor(0x99075e9f);title.setPadding(dp(5),dp(5),dp(5),dp(5));frame.addView(title,new FrameLayout.LayoutParams(-1,-2,Gravity.TOP));
  TextView message=new TextView(this);message.setTextColor(Color.WHITE);message.setGravity(Gravity.CENTER);message.setTextSize(13);message.setText("Connexion…");frame.addView(message,new FrameLayout.LayoutParams(-1,-1));
  String address="";try{
   JSONObject settings=new JSONObject(getSharedPreferences("nautic_settings",MODE_PRIVATE).getString("nautic-extensions","{}"));JSONObject camera=settings.optJSONObject("camera"+index);String label=camera==null?"Caméra "+index:camera.optString("name","Caméra "+index);title.setText((settings.optBoolean("objectNumbers",true)?(40+index)+" · ":"")+label);
   address=TrematageAccess.address(this,index);if(!address.startsWith("rtsp://"))throw new Exception("Caméra non configurée");Uri uri=Uri.parse(address);
   SharedPreferences credentials=getSharedPreferences("nautic_camera_private",MODE_PRIVATE);String user=credentials.getString("username"+index,credentials.getString("username","")),pass=credentials.getString("password"+index,credentials.getString("password",""));if(user.isEmpty())throw new Exception("Identifiants à renseigner dans Paramètres");
   String tapoHost=Uri.parse(TrematageAccess.address(this,TrematageAccess.index(this))).getHost();String path=CameraStreamPolicy.preview(uri.getPath(),false,index==1||java.util.Objects.equals(tapoHost,uri.getHost()));
   String stream="rtsp://"+Uri.encode(user)+":"+Uri.encode(pass)+"@"+uri.getHost()+":"+(uri.getPort()>0?uri.getPort():554)+path;
   ExoPlayer player=new ExoPlayer.Builder(this,new DefaultRenderersFactory(this).setEnableDecoderFallback(true)).build();players.add(player);view.setPlayer(player);player.setVolume(0);
   player.addListener(new Player.Listener(){@Override public void onRenderedFirstFrame(){message.setVisibility(View.GONE);}@Override public void onPlayerError(PlaybackException error){message.setText("Vidéo indisponible · toucher pour ouvrir seule");message.setVisibility(View.VISIBLE);}});
   player.setMediaSource(new RtspMediaSource.Factory().setForceUseRtpTcp(true).createMediaSource(MediaItem.fromUri(stream)));player.prepare();player.play();
  }catch(Exception e){message.setText(e.getMessage());}
  final String url=address;View.OnClickListener open=v->{if(!url.startsWith("rtsp://"))return;Intent i=new Intent(this,CameraActivity.class);i.putExtra("url",url);i.putExtra("cameraIndex",index);i.putExtra("singleCamera",true);startActivity(i);};frame.setOnClickListener(open);view.setOnClickListener(open);message.setOnClickListener(open);title.setOnClickListener(open);return frame;
 }
 private void release(){for(ExoPlayer player:players)player.release();players.clear();}
 @Override protected void onPause(){release();super.onPause();}
 @Override protected void onStop(){release();super.onStop();}
 @Override protected void onDestroy(){release();super.onDestroy();}
}
