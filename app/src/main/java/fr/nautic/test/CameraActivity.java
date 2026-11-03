package fr.nautic.test;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.net.Uri;
import android.view.WindowManager;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.text.InputType;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.rtsp.RtspMediaSource;
import androidx.media3.ui.PlayerView;

/** Lecteur RTSP local. Identifiants conservés uniquement dans les préférences privées Android. */
public class CameraActivity extends Activity {
 private ExoPlayer player;
 private TextView status;
 private PlayerView view;
 private String cameraUrl;
 private static final String PREF="nautic_camera_private";
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
  cameraUrl=getIntent().getStringExtra("url");
  LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(0xff000000);
  Button close=new Button(this);close.setText("✕ FERMER LA CAMÉRA");close.setOnClickListener(v->finish());root.addView(close);
  status=new TextView(this);status.setTextColor(-1);status.setPadding(12,8,12,8);status.setText("Connexion RTSP…");root.addView(status);
  Button credentials=new Button(this);credentials.setText("Identifiants caméra");credentials.setOnClickListener(v->askCredentials());root.addView(credentials);
  view=new PlayerView(this);view.setUseController(false);root.addView(view,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
  if(cameraUrl==null||!cameraUrl.toLowerCase().startsWith("rtsp://")){status.setText("Adresse RTSP invalide");return;}
  String saved=getSharedPreferences(PREF,MODE_PRIVATE).getString("username","");
  if(saved.isEmpty())askCredentials();else play();
 }
 private void askCredentials(){
  LinearLayout form=new LinearLayout(this);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(32,12,32,0);
  EditText username=new EditText(this);username.setSingleLine(true);username.setHint("Compte caméra (identifiant)");username.setText(getSharedPreferences(PREF,MODE_PRIVATE).getString("username",""));form.addView(username);
  EditText password=new EditText(this);password.setSingleLine(true);password.setHint("Mot de passe caméra");password.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);form.addView(password);
  new AlertDialog.Builder(this).setTitle("Accès local Tapo").setView(form)
   .setPositiveButton("Connecter",(d,w)->{
    String u=username.getText().toString().trim(),p=password.getText().toString();
    if(u.isEmpty()||p.isEmpty()){status.setText("Identifiants manquants");return;}
    getSharedPreferences(PREF,MODE_PRIVATE).edit().putString("username",u).putString("password",p).apply();play();
   }).setNegativeButton("Annuler",null).show();
 }
 private void play(){
  release();
  try{
   Uri original=Uri.parse(cameraUrl);
   String username=getSharedPreferences(PREF,MODE_PRIVATE).getString("username","");
   String password=getSharedPreferences(PREF,MODE_PRIVATE).getString("password","");
   // Les identifiants restent dans Android ; ils ne sont ni publiés dans GitHub ni injectés dans la page Web.
   String host=original.getHost();if(host==null)throw new IllegalArgumentException("Hôte manquant");
   String auth=Uri.encode(username)+":"+Uri.encode(password);
   String address="rtsp://"+auth+"@"+host+(original.getPort()>0?":"+original.getPort():"")+
     (original.getEncodedPath()==null?"/stream1":original.getEncodedPath());
   status.setText("Connexion locale…");
   // If the first hardware codec cannot start, try other Android decoders (including software codecs when available).
   DefaultRenderersFactory renderers=new DefaultRenderersFactory(this).setEnableDecoderFallback(true);
   player=new ExoPlayer.Builder(this,renderers).build();
   view.setPlayer(player);
   player.addListener(new Player.Listener(){
    @Override public void onPlaybackStateChanged(int state){
     if(state==Player.STATE_READY)status.setText("Vidéo locale connectée");
     else if(state==Player.STATE_BUFFERING)status.setText("Chargement de la vidéo…");
    }
    @Override public void onPlayerError(PlaybackException error){
     status.setText("Échec vidéo : "+error.getErrorCodeName()+". Décodeur indisponible ou incompatible. Essayer le flux secondaire /stream2 ou /stream7, et le mode H.264 dans Tapo si disponible.");
    }
   });
   RtspMediaSource.Factory factory=new RtspMediaSource.Factory().setForceUseRtpTcp(true);
   player.setMediaSource(factory.createMediaSource(MediaItem.fromUri(Uri.parse(address))));
   player.prepare();player.play();
  }catch(Exception e){status.setText("Impossible d'ouvrir le flux RTSP : "+e.getClass().getSimpleName());}
 }
 private void release(){if(player!=null){player.release();player=null;}}
 @Override protected void onStop(){release();super.onStop();}
}
