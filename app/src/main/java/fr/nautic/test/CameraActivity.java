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
 private boolean discovering=false;
 private int cameraIndex=1;
 private final java.util.ArrayList<ExoPlayer> previewPlayers=new java.util.ArrayList<>();
 private static final String PREF="nautic_camera_private";
 private int dp(float n){return (int)(n*getResources().getDisplayMetrics().density+0.5f);}
 private GradientDrawable bubble(){GradientDrawable d=new GradientDrawable();d.setColor(0x77000000);d.setCornerRadius(dp(24));return d;}
 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
  baseUrl=getIntent().getStringExtra("url");
  settingsOnly=getIntent().getBooleanExtra("settings",false);
  cameraIndex=Math.max(1,Math.min(3,getIntent().getIntExtra("cameraIndex",1)));
  if(getIntent().getBooleanExtra("discover",false)){root=new FrameLayout(this);setContentView(root);showDiscovery();return;}
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
     }else{status.setText("Objectif "+(index==0?"fixe":"orientable")+" : "+e.getErrorCodeName());if(index==0&&!frames[0]&&!discovering)root.postDelayed(()->{if(!isFinishing()&&!frames[0])showDiscovery();},1000);}
    }
   });
   RtspMediaSource.Factory source=new RtspMediaSource.Factory().setForceUseRtpTcp(true);
   p.setMediaSource(source.createMediaSource(MediaItem.fromUri(Uri.parse(stream(lens)))));
   p.prepare();p.play();
  }catch(Exception e){status.setText("RTSP : "+e.getClass().getSimpleName());}
 }
 private void showDiscovery(){
  if(discovering)return;
  discovering=true;release();
  root.removeAllViews();
  LinearLayout column=new LinearLayout(this);column.setOrientation(LinearLayout.VERTICAL);
  column.setPadding(dp(8),dp(12),dp(8),dp(8));column.setBackgroundColor(0xff091c2b);
  root.addView(column,new FrameLayout.LayoutParams(-1,-1));
  TextView heading=new TextView(this);heading.setText("Recherche des équipements — Wi-Fi local");
  heading.setTextColor(Color.WHITE);heading.setTextSize(18);heading.setPadding(dp(4),dp(8),dp(4),dp(12));column.addView(heading);
  TextView progress=new TextView(this);progress.setText("Recherche des adresses disponibles…");
  progress.setTextColor(Color.WHITE);column.addView(progress);
  android.widget.GridLayout grid=new android.widget.GridLayout(this);grid.setColumnCount(5);
  column.addView(grid,new LinearLayout.LayoutParams(-1,-2));
  TextView[] cells=new TextView[10];
  for(int n=0;n<10;n++){
   TextView cell=new TextView(this);cells[n]=cell;cell.setText("·");cell.setTextColor(0xffb9d9ee);
   cell.setTextSize(22);cell.setGravity(Gravity.CENTER);cell.setBackgroundColor(0xff142f43);
   android.widget.GridLayout.LayoutParams lp=new android.widget.GridLayout.LayoutParams();
   lp.width=0;lp.height=dp(90);lp.columnSpec=android.widget.GridLayout.spec(n%5,1f);
   lp.rowSpec=android.widget.GridLayout.spec(n/5);lp.setMargins(dp(2),dp(2),dp(2),dp(2));grid.addView(cell,lp);
  }
  TextView close=new TextView(this);close.setText("Fermer ✕");close.setTextColor(Color.WHITE);
  close.setTextSize(18);close.setPadding(dp(12),dp(16),dp(12),dp(16));
  close.setOnClickListener(v->finish());column.addView(close);
  new Thread(()->{
   java.util.ArrayList<String> hosts=new java.util.ArrayList<>();
   try{
    android.net.wifi.WifiManager wifi=(android.net.wifi.WifiManager)getApplicationContext().getSystemService(WIFI_SERVICE);
    int ip=wifi==null?0:wifi.getConnectionInfo().getIpAddress();
    String prefix=ip!=0?(ip&255)+"."+((ip>>8)&255)+"."+((ip>>16)&255)+".":null;
    if(prefix==null&&baseUrl!=null&&Uri.parse(baseUrl).getHost()!=null){
     String host=Uri.parse(baseUrl).getHost();prefix=host.substring(0,host.lastIndexOf('.')+1);
    }
    if(prefix==null){runOnUiThread(()->progress.setText("Wi-Fi local indisponible"));return;}
    java.util.concurrent.ExecutorService pool=java.util.concurrent.Executors.newFixedThreadPool(24);
    java.util.List<java.util.concurrent.Future<?>> tasks=new java.util.ArrayList<>();
    final String subnet=prefix;
    for(int n=1;n<255;n++){
     final String host=subnet+n;
     tasks.add(pool.submit(()->{
      for(int port:new int[]{554,6668,6667,80,443}){
       try(java.net.Socket socket=new java.net.Socket()){
        socket.connect(new java.net.InetSocketAddress(host,port),350);
        synchronized(hosts){if(!hosts.contains(host))hosts.add(host);}
        break;
       }catch(Exception ignored){}
      }
     }));
    }
    for(java.util.concurrent.Future<?> task:tasks)try{task.get(15,java.util.concurrent.TimeUnit.SECONDS);}catch(Exception ignored){}
    pool.shutdownNow();
   }catch(Exception e){runOnUiThread(()->progress.setText("Erreur Wi-Fi : "+e.getClass().getSimpleName()));}
   java.util.Collections.sort(hosts,(a,b)->Integer.compare(Integer.parseInt(a.substring(a.lastIndexOf('.')+1)),Integer.parseInt(b.substring(b.lastIndexOf('.')+1))));
   try{org.json.JSONArray report=new org.json.JSONArray();for(String host:hosts)report.put(host);getSharedPreferences("nautic_settings",MODE_PRIVATE).edit().putString("nautic-network-last",report.toString()).apply();}catch(Exception ignored){}
   runOnUiThread(()->{
    if(isFinishing()||!discovering)return;
    progress.setText(hosts.isEmpty()?"Aucun équipement répondant sur les ports testés.":"Vérification de "+hosts.size()+" adresse(s) ayant répondu…");
    if(hosts.isEmpty())for(TextView cell:cells){cell.setText("✕");cell.setTextColor(0xffff5555);}
    scanPreviewInOrder(cells,hosts,0);
   });
  }).start();
 }
 private void scanPreviewInOrder(TextView[] cells,java.util.ArrayList<String> hosts,int index){
  if(!discovering||isFinishing())return;
  if(index>=cells.length)return;
  if(index>=hosts.size()){
   cells[index].setText("✕");cells[index].setTextColor(0xffff5555);
   scanPreviewInOrder(cells,hosts,index+1);return;
  }
  final int next=index+1;
  previewTile(cells[index],hosts.get(index),()->scanPreviewInOrder(cells,hosts,next));
 }
 private void previewTile(TextView cell,String host,Runnable next){
  String user=getSharedPreferences(PREF,MODE_PRIVATE).getString("username","");
  String pass=getSharedPreferences(PREF,MODE_PRIVATE).getString("password","");
  android.view.ViewGroup parent=(android.view.ViewGroup)cell.getParent();
  int index=parent.indexOfChild(cell);
  android.view.ViewGroup.LayoutParams layout=cell.getLayoutParams();
  FrameLayout tile=new FrameLayout(this);tile.setBackgroundColor(0xff142f43);
  parent.removeViewAt(index);parent.addView(tile,index,layout);
  PlayerView pv=new PlayerView(this);pv.setUseController(false);
  tile.addView(pv,new FrameLayout.LayoutParams(-1,-1));
  android.widget.ProgressBar waiting=new android.widget.ProgressBar(this);
  tile.addView(waiting,new FrameLayout.LayoutParams(dp(32),dp(32),Gravity.CENTER));
  TextView mark=new TextView(this);mark.setText("🔌");mark.setTextSize(22);
  mark.setTextColor(0xffb9d9ee);mark.setGravity(Gravity.CENTER);mark.setVisibility(View.GONE);
  tile.addView(mark,new FrameLayout.LayoutParams(-1,-1));
  TextView address=new TextView(this);address.setText(host);address.setTextColor(Color.WHITE);
  address.setTextSize(10);address.setGravity(Gravity.CENTER);address.setBackgroundColor(0x99000000);
  tile.addView(address,new FrameLayout.LayoutParams(-1,dp(18),Gravity.BOTTOM));
  final boolean[] completed={false};
  Runnable unknown=()->{
   if(completed[0]||!discovering||isFinishing())return;
   completed[0]=true;waiting.setVisibility(View.GONE);mark.setVisibility(View.VISIBLE);next.run();
  };
  if(user.isEmpty()){tile.postDelayed(unknown,300);return;}
  String uri="rtsp://"+Uri.encode(user)+":"+Uri.encode(pass)+"@"+host+":554/stream2";
  ExoPlayer player=new ExoPlayer.Builder(this).build();previewPlayers.add(player);
  pv.setPlayer(player);
  player.addListener(new Player.Listener(){
   @Override public void onRenderedFirstFrame(){
    if(completed[0]||!discovering||isFinishing())return;
    completed[0]=true;waiting.setVisibility(View.GONE);mark.setVisibility(View.GONE);
    tile.setOnClickListener(v->confirmCamera(host));
    pv.setOnClickListener(v->confirmCamera(host));
    next.run();
   }
   @Override public void onPlayerError(PlaybackException e){unknown.run();}
  });
  tile.postDelayed(unknown,9000);
  try{
   player.setMediaSource(new RtspMediaSource.Factory().setForceUseRtpTcp(true).createMediaSource(MediaItem.fromUri(uri)));
   player.prepare();player.play();
  }catch(Exception ignored){unknown.run();}
 }
 private void confirmCamera(String host){
  new AlertDialog.Builder(this).setTitle("Mémoriser cette caméra ?")
   .setMessage("Adresse "+host+" — caméra "+cameraIndex)
   .setPositiveButton("Mémoriser et ouvrir",(d,w)->{
    String key="cam"+cameraIndex;
    android.content.SharedPreferences prefs=getSharedPreferences("nautic_settings",MODE_PRIVATE);
    try{
     org.json.JSONObject cfg=new org.json.JSONObject(prefs.getString("nautic-v04","{}"));
     String old=cfg.optString(key,"");
     String path="/stream1";
     if(old.startsWith("rtsp://")){String p=Uri.parse(old).getPath();if(p!=null&&!p.isEmpty())path=p;}
     baseUrl="rtsp://"+host+":554"+path;
     cfg.put(key,baseUrl);
      if(!prefs.edit().putString("nautic-v04",cfg.toString()).commit())throw new IllegalStateException("Enregistrement non confirmé");
     discovering=false;releasePreviews();buildViews();
    }catch(Exception e){android.widget.Toast.makeText(this,"Sauvegarde impossible",android.widget.Toast.LENGTH_LONG).show();}
   }).setNegativeButton("Annuler",null).show();
 }
 private void releasePreviews(){for(ExoPlayer p:previewPlayers)p.release();previewPlayers.clear();}
 private void release(){for(int i=0;i<2;i++)if(players[i]!=null){views[i].setPlayer(null);players[i].release();players[i]=null;}}
 @Override public void onConfigurationChanged(Configuration config){super.onConfigurationChanged(config);if(!settingsOnly&&root!=null&&views[0]!=null)buildViews();}
 @Override protected void onStop(){release();releasePreviews();super.onStop();}
}
