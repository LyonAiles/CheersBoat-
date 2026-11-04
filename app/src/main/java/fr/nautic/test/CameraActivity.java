package fr.nautic.test;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.rtsp.RtspMediaSource;
import androidx.media3.ui.PlayerView;

/** TC47 dual-view RTSP, entirely local. Tapping a view restarts it; tapping inset swaps views. */
public class CameraActivity extends Activity {
 private final ExoPlayer[] players=new ExoPlayer[2];
 private final PlayerView[] views=new PlayerView[2];
 private final int[] retries=new int[2];
 private final boolean[] frames=new boolean[2];
 private FrameLayout root;
 private TextView status;
 private String baseUrl;
 private boolean swapped=false;
 private boolean settingsOnly=false;
 private static final String PREF="nautic_camera_private";
 private int dp(float n){return (int)(n*getResources().getDisplayMetrics().density+0.5f);}
 private GradientDrawable bubble(){GradientDrawable d=new GradientDrawable();d.setColor(0x77000000);d.setCornerRadius(dp(24));return d;}
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
  baseUrl=getIntent().getStringExtra("url");
  settingsOnly=getIntent().getBooleanExtra("settings",false);
  if(settingsOnly){configure();return;}
  if(baseUrl==null||!baseUrl.startsWith("rtsp://")){finish();return;}
  root=new FrameLayout(this);root.setBackgroundColor(Color.BLACK);setContentView(root);
  if(getSharedPreferences(PREF,MODE_PRIVATE).getString("username","").isEmpty()){configure();return;}
  buildViews();
 }
 private void configure(){
  LinearLayout form=new LinearLayout(this);form.setPadding(dp(24),dp(8),dp(24),0);form.setOrientation(LinearLayout.VERTICAL);
  EditText user=new EditText(this);user.setSingleLine(true);user.setHint("Identifiant du compte caméra");
  user.setText(getSharedPreferences(PREF,MODE_PRIVATE).getString("username",""));form.addView(user);
  EditText pass=new EditText(this);pass.setSingleLine(true);pass.setHint("Mot de passe caméra");
  pass.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);pass.setText(getSharedPreferences(PREF,MODE_PRIVATE).getString("password",""));form.addView(pass);
  new AlertDialog.Builder(this).setTitle("Paramètres — caméra TC47").setView(form)
   .setPositiveButton("Enregistrer",(d,w)->{
    String u=user.getText().toString().trim(),p=pass.getText().toString();
    if(!u.isEmpty()){
     android.content.SharedPreferences old=getSharedPreferences(PREF,MODE_PRIVATE);
     old.edit().putString("username",u).putString("password",p.isEmpty()?old.getString("password",""):p).apply();
    }
    if(settingsOnly)finish();else buildViews();
   }).setNegativeButton("Annuler",(d,w)->{if(settingsOnly||views[0]==null)finish();}).show();
 }
 private String stream(int lens){
  Uri uri=Uri.parse(baseUrl);
  String username=getSharedPreferences(PREF,MODE_PRIVATE).getString("username","");
  String password=getSharedPreferences(PREF,MODE_PRIVATE).getString("password","");
  String auth=Uri.encode(username)+":"+Uri.encode(password);
  return "rtsp://"+auth+"@"+uri.getHost()+(uri.getPort()>0?":"+uri.getPort():"")+(lens==0?"/stream1":"/stream6");
 }
 private PlayerView makeView(int lens){
  PlayerView pv=new PlayerView(this);pv.setUseController(false);pv.setKeepScreenOn(true);
  pv.setBackgroundColor(Color.BLACK);pv.setResizeMode(androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT);
  pv.setOnClickListener(v->restart(lens,true));
  views[lens]=pv;return pv;
 }
 private void buildViews(){
  release();root.removeAllViews();
  makeView(0);makeView(1);
  boolean landscape=getResources().getConfiguration().orientation==Configuration.ORIENTATION_LANDSCAPE;
  if(landscape){
   int large=swapped?1:0,small=1-large;
   root.addView(views[large],new FrameLayout.LayoutParams(-1,-1));
   FrameLayout.LayoutParams inset=new FrameLayout.LayoutParams(dp(180),dp(110),Gravity.RIGHT|Gravity.BOTTOM);
   inset.setMargins(0,0,dp(12),dp(12));root.addView(views[small],inset);
   // Tapping the inset swaps the two cameras; tapping the large image refreshes it.
   views[small].setOnClickListener(v->{swapped=!swapped;buildViews();});
  }else{
   LinearLayout stack=new LinearLayout(this);stack.setOrientation(LinearLayout.VERTICAL);
   root.addView(stack,new FrameLayout.LayoutParams(-1,-1));
   stack.addView(views[0],new LinearLayout.LayoutParams(-1,0,1));
   stack.addView(views[1],new LinearLayout.LayoutParams(-1,0,1));
  }
  TextView close=new TextView(this);close.setText("✕");close.setTextColor(Color.WHITE);close.setTextSize(23);
  close.setGravity(Gravity.CENTER);close.setBackground(bubble());
  FrameLayout.LayoutParams cp=new FrameLayout.LayoutParams(dp(42),dp(42),Gravity.RIGHT|Gravity.TOP);
  cp.setMargins(0,dp(8),dp(10),0);root.addView(close,cp);close.setOnClickListener(v->finish());
  status=new TextView(this);status.setTextColor(Color.WHITE);status.setTextSize(12);
  status.setPadding(dp(8),dp(4),dp(8),dp(4));status.setBackground(bubble());
  FrameLayout.LayoutParams sp=new FrameLayout.LayoutParams(-2,-2,Gravity.LEFT|Gravity.TOP);
  sp.setMargins(dp(8),dp(10),dp(55),0);root.addView(status,sp);
  for(int i=0;i<2;i++){retries[i]=0;restart(i,true);}
 }
 private void restart(int lens,boolean reset){
  if(reset)retries[lens]=0;
  frames[lens]=false;
  if(players[lens]!=null){views[lens].setPlayer(null);players[lens].release();players[lens]=null;}
  try{
   DefaultRenderersFactory renderers=new DefaultRenderersFactory(this).setEnableDecoderFallback(true);
   ExoPlayer p=new ExoPlayer.Builder(this,renderers).build();players[lens]=p;
   views[lens].setPlayer(p);
   final int index=lens;
   p.addListener(new Player.Listener(){
    @Override public void onRenderedFirstFrame(){frames[index]=true;status.setText("Vidéo locale");}
    @Override public void onPlayerError(PlaybackException e){
     if(!frames[index]&&retries[index]<1){
      retries[index]++;
      status.setText("Relance objectif "+(index==0?"fixe":"orientable")+"…");
      root.postDelayed(()->{if(!isFinishing()&&players[index]==p)restart(index,false);},1200);
     }else status.setText("Objectif "+(index==0?"fixe":"orientable")+" : "+e.getErrorCodeName()+" — toucher l’image pour réessayer");
    }
   });
   RtspMediaSource.Factory source=new RtspMediaSource.Factory().setForceUseRtpTcp(true);
   p.setMediaSource(source.createMediaSource(MediaItem.fromUri(Uri.parse(stream(lens)))));
   p.prepare();p.play();
  }catch(Exception e){status.setText("RTSP : "+e.getClass().getSimpleName());}
 }
 private void release(){for(int i=0;i<2;i++)if(players[i]!=null){views[i].setPlayer(null);players[i].release();players[i]=null;}}
 @Override public void onConfigurationChanged(Configuration config){super.onConfigurationChanged(config);if(!settingsOnly&&root!=null&&views[0]!=null)buildViews();}
 @Override protected void onStop(){release();super.onStop();}
}
