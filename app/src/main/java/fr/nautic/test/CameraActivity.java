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
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
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
 private final FrameLayout[] cameraFrames=new FrameLayout[2];
 private final int[] retries=new int[2];
 private final boolean[] frames=new boolean[2];
 private FrameLayout root;
 private TextView status;
 private String baseUrl;
 private boolean swapped=false;
 private boolean settingsOnly=false;
 private boolean discovering=false;
 private int cameraIndex=1;
 private CameraControls controls;
 private boolean mobileAudio=false;
 void toggleMobileAudio(){mobileAudio=!mobileAudio;if(players[1]!=null)players[1].setVolume(mobileAudio?1f:0f);}
 private final org.json.JSONObject scanStatuses=new org.json.JSONObject();
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
  boolean discover=getIntent().getBooleanExtra("discover",false);
  if(settingsOnly){configure();return;}
  if(!discover&&(baseUrl==null||!baseUrl.startsWith("rtsp://"))){finish();return;}
  root=new FrameLayout(this);root.setBackgroundColor(Color.BLACK);setContentView(root);
  if(!discover&&credential("username").isEmpty()){configure();return;}
  openCamera();
 }
 private void openCamera(){
  if(getIntent().getBooleanExtra("discover",false))showDiscovery();
  else buildViews();
 }
 private String credential(String key){
  android.content.SharedPreferences prefs=getSharedPreferences(PREF,MODE_PRIVATE);
  return prefs.getString(key+cameraIndex,prefs.getString(key,""));
 }
 private void configure(){
  LinearLayout form=new LinearLayout(this);form.setPadding(dp(24),dp(8),dp(24),0);form.setOrientation(LinearLayout.VERTICAL);
  EditText user=new EditText(this);user.setSingleLine(true);user.setHint("Identifiant du compte caméra");
  user.setText(credential("username"));form.addView(user);
  EditText pass=new EditText(this);pass.setSingleLine(true);pass.setHint("Mot de passe caméra");
  pass.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);pass.setText(credential("password"));form.addView(pass);
  new AlertDialog.Builder(this).setTitle("Identifiants locaux — caméra "+cameraIndex).setView(form)
   .setPositiveButton("Enregistrer",(d,w)->{
    String u=user.getText().toString().trim(),p=pass.getText().toString();
    if(!u.isEmpty()){
     android.content.SharedPreferences old=getSharedPreferences(PREF,MODE_PRIVATE);
     old.edit().putString("username"+cameraIndex,u).putString("password"+cameraIndex,p.isEmpty()?credential("password"):p).apply();
    }
    if(settingsOnly)finish();else openCamera();
   }).setNegativeButton("Annuler",(d,w)->{if(settingsOnly||views[0]==null)finish();}).show();
 }
 private String stream(int lens){
  Uri uri=Uri.parse(baseUrl);
  String username=credential("username");
  String password=credential("password");
  String auth=Uri.encode(username)+":"+Uri.encode(password);
  return "rtsp://"+auth+"@"+uri.getHost()+(uri.getPort()>0?":"+uri.getPort():"")+(lens==0?"/stream1":"/stream6");
 }
 private PlayerView makeView(int lens){
  PlayerView pv=new PlayerView(this);pv.setUseController(false);pv.setKeepScreenOn(true);
  pv.setBackgroundColor(Color.TRANSPARENT);pv.setShutterBackgroundColor(Color.TRANSPARENT);
  pv.setResizeMode(androidx.media3.ui.AspectRatioFrameLayout.RESIZE_MODE_FIT);
  FrameLayout frame=new FrameLayout(this){
   @Override public boolean onInterceptTouchEvent(MotionEvent event){return true;}
  };
  frame.setBackgroundColor(Color.TRANSPARENT);
  frame.setClipChildren(true);frame.setClipToPadding(true);
  frame.addView(pv,new FrameLayout.LayoutParams(-1,-1));
  final float[] zoom={1f},lastX={0f},lastY={0f},downX={0f},downY={0f};
  final boolean[] pinching={false},dragging={false},held={false};
  final int slop=android.view.ViewConfiguration.get(this).getScaledTouchSlop();
  Runnable clamp=()->{
   float maxX=Math.max(0f,(zoom[0]-1f)*pv.getWidth()/2f);
   float maxY=Math.max(0f,(zoom[0]-1f)*pv.getHeight()/2f);
   pv.setTranslationX(Math.max(-maxX,Math.min(maxX,pv.getTranslationX())));
   pv.setTranslationY(Math.max(-maxY,Math.min(maxY,pv.getTranslationY())));
  };
  Runnable resetZoom=()->{
   zoom[0]=1f;pv.setScaleX(1f);pv.setScaleY(1f);
   pv.setTranslationX(0f);pv.setTranslationY(0f);
  };
  Runnable focus=()->{
   if(pinching[0]||dragging[0]||isFinishing())return;
   held[0]=true;
   float oldZoom=zoom[0];
   float pointX=(downX[0]-pv.getWidth()/2f-pv.getTranslationX())/oldZoom;
   float pointY=(downY[0]-pv.getHeight()/2f-pv.getTranslationY())/oldZoom;
   zoom[0]=4f;pv.setScaleX(zoom[0]);pv.setScaleY(zoom[0]);
   pv.setTranslationX(-pointX*zoom[0]);pv.setTranslationY(-pointY*zoom[0]);clamp.run();
  };
  ScaleGestureDetector scale=new ScaleGestureDetector(this,new ScaleGestureDetector.SimpleOnScaleGestureListener(){
   @Override public boolean onScaleBegin(ScaleGestureDetector d){
    frame.removeCallbacks(focus);pinching[0]=true;dragging[0]=false;return true;
   }
   @Override public boolean onScale(ScaleGestureDetector d){
    zoom[0]=Math.max(1f,Math.min(4f,zoom[0]*d.getScaleFactor()));
    pv.setScaleX(zoom[0]);pv.setScaleY(zoom[0]);clamp.run();return true;
   }
  });
  GestureDetector taps=new GestureDetector(this,new GestureDetector.SimpleOnGestureListener(){
   @Override public boolean onDown(MotionEvent e){return true;}
   @Override public boolean onDoubleTap(MotionEvent e){restart(lens,true);return true;}
   @Override public boolean onSingleTapConfirmed(MotionEvent e){
    if(zoom[0]>1.01f){resetZoom.run();return true;}
    if(getResources().getConfiguration().orientation==Configuration.ORIENTATION_LANDSCAPE
       &&((swapped?0:1)==lens)){swapped=!swapped;buildViews();}
    return true;
   }
  });
  taps.setIsLongpressEnabled(false);
  // Gestures use the untransformed frame so a zoom keeps touch coordinates stable.
  frame.setOnTouchListener((v,event)->{
   scale.onTouchEvent(event);
   switch(event.getActionMasked()){
    case MotionEvent.ACTION_DOWN:
     downX[0]=lastX[0]=event.getX();downY[0]=lastY[0]=event.getY();
     dragging[0]=false;pinching[0]=false;held[0]=false;
     frame.postDelayed(focus,1050);taps.onTouchEvent(event);break;
    case MotionEvent.ACTION_POINTER_DOWN:
     frame.removeCallbacks(focus);pinching[0]=true;break;
    case MotionEvent.ACTION_MOVE:
     if(event.getPointerCount()>1)break;
     if(Math.hypot(event.getX()-downX[0],event.getY()-downY[0])>slop){
      dragging[0]=true;frame.removeCallbacks(focus);
     }
     if(zoom[0]>1.01f&&dragging[0]&&!pinching[0]&&!held[0]){
      pv.setTranslationX(pv.getTranslationX()+event.getX()-lastX[0]);
      pv.setTranslationY(pv.getTranslationY()+event.getY()-lastY[0]);clamp.run();
     }
     lastX[0]=event.getX();lastY[0]=event.getY();break;
    case MotionEvent.ACTION_UP:
    case MotionEvent.ACTION_CANCEL:
     frame.removeCallbacks(focus);
     if(event.getActionMasked()==MotionEvent.ACTION_UP&&!dragging[0]&&!pinching[0]&&!held[0])taps.onTouchEvent(event);
     else{
      MotionEvent cancel=MotionEvent.obtain(event);cancel.setAction(MotionEvent.ACTION_CANCEL);
      taps.onTouchEvent(cancel);cancel.recycle();
     }
     break;
   }
   return true;
  });
  pv.setClickable(false);pv.setFocusable(false);
  cameraFrames[lens]=frame;
  views[lens]=pv;return pv;
 }
 private void buildViews(){
  release();root.removeAllViews();
  makeView(0);makeView(1);
  boolean landscape=getResources().getConfiguration().orientation==Configuration.ORIENTATION_LANDSCAPE;
  if(landscape){
   int large=swapped?1:0,small=1-large;
   root.addView(cameraFrames[large],new FrameLayout.LayoutParams(-1,-1));
   FrameLayout.LayoutParams inset=new FrameLayout.LayoutParams(dp(180),dp(110),Gravity.RIGHT|Gravity.BOTTOM);
   inset.setMargins(0,0,dp(12),dp(12));root.addView(cameraFrames[small],inset);
   // Single tap on the inset swaps lenses; double tap refreshes either stream.
  }else{
   LinearLayout stack=new LinearLayout(this);stack.setOrientation(LinearLayout.VERTICAL);
   root.addView(stack,new FrameLayout.LayoutParams(-1,-1));
   stack.addView(cameraFrames[0],new LinearLayout.LayoutParams(-1,0,1));
   stack.addView(cameraFrames[1],new LinearLayout.LayoutParams(-1,0,1));
  }
  TextView close=new TextView(this);close.setText("✕");close.setTextColor(Color.WHITE);close.setTextSize(23);
  close.setGravity(Gravity.CENTER);close.setBackground(bubble());
  FrameLayout.LayoutParams cp=new FrameLayout.LayoutParams(dp(42),dp(42),Gravity.RIGHT|Gravity.TOP);
  cp.setMargins(0,dp(8),dp(10),0);root.addView(close,cp);close.setOnClickListener(v->finish());
  status=new TextView(this);status.setTextColor(Color.WHITE);status.setTextSize(12);
  status.setPadding(dp(8),dp(4),dp(8),dp(4));status.setBackground(bubble());
  FrameLayout.LayoutParams sp=new FrameLayout.LayoutParams(-2,-2,Gravity.LEFT|Gravity.TOP);
  sp.setMargins(dp(8),dp(10),dp(55),0);root.addView(status,sp);
  TextView commands=new TextView(this);commands.setText("⚙ Objectif 2 · commandes");commands.setTextColor(Color.WHITE);
  commands.setPadding(dp(12),dp(10),dp(12),dp(10));commands.setBackground(bubble());
  FrameLayout.LayoutParams commandsLayout=new FrameLayout.LayoutParams(-2,-2,Gravity.LEFT|Gravity.BOTTOM);
  commandsLayout.setMargins(dp(8),0,dp(8),dp(8));root.addView(commands,commandsLayout);
  commands.setOnClickListener(v->{
   if(controls!=null)controls.close();
   controls=new CameraControls(this,Uri.parse(baseUrl).getHost(),credential("username"),credential("password"));controls.show();
  });
  for(int i=0;i<2;i++){retries[i]=0;restart(i,true);}
 }
 private void restart(int lens,boolean reset){
  if(reset)retries[lens]=0;
  frames[lens]=false;
  if(players[lens]!=null){views[lens].setPlayer(null);players[lens].release();players[lens]=null;}
  try{
   DefaultRenderersFactory renderers=new DefaultRenderersFactory(this).setEnableDecoderFallback(true);
   ExoPlayer p=new ExoPlayer.Builder(this,renderers).build();players[lens]=p;
   p.setVolume(lens==1&&mobileAudio?1f:0f);
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
  discovering=true;release();root.removeAllViews();
  LinearLayout column=new LinearLayout(this);column.setOrientation(LinearLayout.VERTICAL);
  column.setPadding(dp(8),dp(12),dp(8),dp(8));column.setBackgroundColor(0xff091c2b);
  root.addView(column,new FrameLayout.LayoutParams(-1,-1));
  TextView heading=new TextView(this);heading.setText("Recherche de services — Wi-Fi local");
  heading.setTextColor(Color.WHITE);heading.setTextSize(18);heading.setPadding(dp(4),dp(8),dp(4),dp(12));column.addView(heading);
  TextView progress=new TextView(this);progress.setText("32 adresses · ? = aucune réponse, 🔌 = réponse sans vidéo");
  progress.setTextColor(Color.WHITE);column.addView(progress);
  android.widget.GridLayout grid=new android.widget.GridLayout(this);grid.setColumnCount(4);
  android.widget.ScrollView scroll=new android.widget.ScrollView(this);
  scroll.addView(grid);column.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
  TextView[] cells=new TextView[32];
  for(int n=0;n<cells.length;n++){
   TextView cell=new TextView(this);cells[n]=cell;cell.setText("·");cell.setTextColor(0xffb9d9ee);
   cell.setTextSize(22);cell.setGravity(Gravity.CENTER);cell.setBackgroundColor(0xff142f43);
   android.widget.GridLayout.LayoutParams lp=new android.widget.GridLayout.LayoutParams();
   lp.width=0;lp.height=dp(86);lp.columnSpec=android.widget.GridLayout.spec(n%4,1f);
   lp.rowSpec=android.widget.GridLayout.spec(n/4);lp.setMargins(dp(2),dp(2),dp(2),dp(2));grid.addView(cell,lp);
  }
  TextView close=new TextView(this);close.setText("Fermer ✕");close.setTextColor(Color.WHITE);
  close.setTextSize(18);close.setPadding(dp(12),dp(16),dp(12),dp(16));
  close.setOnClickListener(v->finish());column.addView(close);
  new Thread(()->{
   android.net.wifi.WifiManager wifi=(android.net.wifi.WifiManager)getApplicationContext().getSystemService(WIFI_SERVICE);
   int ip=wifi==null?0:wifi.getConnectionInfo().getIpAddress();
   String prefix=ip!=0?(ip&255)+"."+((ip>>8)&255)+"."+((ip>>16)&255)+".":null;
   if(prefix==null&&baseUrl!=null&&Uri.parse(baseUrl).getHost()!=null){
    String host=Uri.parse(baseUrl).getHost();
    if(host.contains("."))prefix=host.substring(0,host.lastIndexOf('.')+1);
   }
   if(prefix==null){runOnUiThread(()->progress.setText("Wi-Fi local indisponible"));return;}
   final String subnet=prefix;
   java.util.ArrayList<String> hosts=new java.util.ArrayList<>();
   for(int n=101;n<=132;n++)hosts.add(subnet+n);
   try{org.json.JSONArray report=new org.json.JSONArray();for(String host:hosts){report.put(host);scanStatuses.put(host,"pending");}
    getSharedPreferences("nautic_settings",MODE_PRIVATE).edit().putString("nautic-network-last",report.toString()).putString("nautic-network-status",scanStatuses.toString()).apply();
   }catch(Exception ignored){}
   runOnUiThread(()->{
    if(!discovering||isFinishing())return;
    progress.setText("Analyse progressive : "+subnet+"101 à "+subnet+"132");
    scanPreviewInOrder(cells,hosts,0,progress);
   });
  }).start();
 }
 private boolean refusedConnection(Exception error){
  for(Throwable cause=error;cause!=null;cause=cause.getCause()){
   if(cause instanceof android.system.ErrnoException
      &&((android.system.ErrnoException)cause).errno==android.system.OsConstants.ECONNREFUSED)return true;
  }
  String message=error.getMessage();
  return message!=null&&(message.contains("ECONNREFUSED")||message.contains("Connection refused"));
 }
 private void scanPreviewInOrder(TextView[] cells,java.util.ArrayList<String> hosts,int index,TextView progress){
  if(!discovering||isFinishing())return;
  if(index>=cells.length){progress.setText("Analyse terminée — "+cells.length+" adresses");return;}
  String host=hosts.get(index);
  progress.setText("Test "+(index+1)+"/"+cells.length+" — "+host);
  final int next=index+1;
  TextView cell=cells[index];
  cell.setText(host+"\n◌");cell.setTextSize(12);
  new Thread(()->{
   boolean responding=false,rtsp=false;
   for(int port:new int[]{554,6668,6667,80,443}){
    try(java.net.Socket socket=new java.net.Socket()){
     socket.connect(new java.net.InetSocketAddress(host,port),650);
     responding=true;rtsp=port==554;break;
    }catch(Exception error){if(refusedConnection(error))responding=true;}
   }
   final boolean found=responding,videoService=rtsp;
   runOnUiThread(()->{
    if(!discovering||isFinishing())return;
    if(!found){
     cell.setText(host+"\n?");cell.setTextColor(0xffb9d9ee);rememberScanState(host,"offline");saveScanStatus(host,"offline");
     scanPreviewInOrder(cells,hosts,next,progress);
    }else if(videoService)previewTile(cell,host,()->scanPreviewInOrder(cells,hosts,next,progress));
    else{
     cell.setText(host+"\n🔌");rememberScanState(host,"unknown");saveScanStatus(host,"unknown");
     scanPreviewInOrder(cells,hosts,next,progress);
    }
   });
  }).start();
 }
 private void saveScanStatus(String host,String status){
  try{scanStatuses.put(host,status);getSharedPreferences("nautic_settings",MODE_PRIVATE).edit().putString("nautic-network-status",scanStatuses.toString()).apply();}catch(Exception ignored){}
 }
 private void previewTile(TextView cell,String host,Runnable next){
  String user=credential("username");
  String pass=credential("password");
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
   completed[0]=true;waiting.setVisibility(View.GONE);mark.setVisibility(View.VISIBLE);saveScanStatus(host,"unknown");next.run();
  };
  if(user.isEmpty()){tile.postDelayed(unknown,300);return;}
  String uri="rtsp://"+Uri.encode(user)+":"+Uri.encode(pass)+"@"+host+":554/stream2";
  ExoPlayer player=new ExoPlayer.Builder(this).build();previewPlayers.add(player);
  pv.setPlayer(player);
  player.addListener(new Player.Listener(){
   @Override public void onRenderedFirstFrame(){
    if(completed[0]||!discovering||isFinishing())return;
    completed[0]=true;waiting.setVisibility(View.GONE);mark.setVisibility(View.GONE);rememberScanState(host,"camera");saveScanStatus(host,"camera");
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
 private void rememberScanState(String host,String type){
  try{
   android.content.SharedPreferences prefs=getSharedPreferences("nautic_settings",MODE_PRIVATE);
   org.json.JSONObject states=new org.json.JSONObject(prefs.getString("nautic-network-states","{}"));
   states.put(host,type);
   prefs.edit().putString("nautic-network-states",states.toString()).apply();
  }catch(Exception ignored){}
 }
 private void confirmCamera(String host){
  if(getIntent().getBooleanExtra("chooseCamera",false)){
   new AlertDialog.Builder(this).setTitle("Associer "+host)
    .setItems(new String[]{"Caméra 1 — Roof","Caméra 2 — Côté","Caméra 3 — Fond"},(d,which)->{
     cameraIndex=which+1;saveCamera(host);
    }).setNegativeButton("Annuler",null).show();
  }else saveCamera(host);
 }
 private void saveCamera(String host){
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
 @Override public void onConfigurationChanged(Configuration config){super.onConfigurationChanged(config);if(controls!=null)controls.close();if(!settingsOnly&&!discovering&&root!=null&&views[0]!=null)buildViews();}
 @Override protected void onStart(){super.onStart();if(root!=null&&!settingsOnly&&!discovering&&views[0]!=null&&players[0]==null)buildViews();}
 @Override protected void onStop(){if(controls!=null)controls.close();release();releasePreviews();super.onStop();}
}
