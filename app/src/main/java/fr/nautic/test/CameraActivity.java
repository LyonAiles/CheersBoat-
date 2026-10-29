package fr.nautic.test;
import android.app.Activity;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import android.widget.VideoView;
import android.widget.MediaController;
import android.net.Uri;
public class CameraActivity extends Activity {
 private VideoView video;
 @Override public void onCreate(Bundle b){super.onCreate(b);
  getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setBackgroundColor(0xff071d2f);
  Button close=new Button(this);close.setText("✕ Fermer la caméra");close.setOnClickListener(v->finish());box.addView(close);
  TextView status=new TextView(this);status.setTextColor(-1);status.setText("Connexion RTSP… (compatibilité dépendante de la caméra et d’Android)");box.addView(status);
  video=new VideoView(this);box.addView(video,new LinearLayout.LayoutParams(-1,0,1));setContentView(box);
  String url=getIntent().getStringExtra("url");
  if(url==null||!url.startsWith("rtsp://")){status.setText("Adresse RTSP manquante");return;}
  video.setMediaController(new MediaController(this));
  video.setOnPreparedListener(mp->{status.setText("Flux connecté");mp.setOnInfoListener((m,what,extra)->false);});
  video.setOnErrorListener((mp,what,extra)->{status.setText("Flux RTSP non décodable ou inaccessible ("+what+" / "+extra+"). Vérifier Wi-Fi, identifiants et compatibilité.");return true;});
  try{video.setVideoURI(Uri.parse(url));video.start();}catch(Exception e){status.setText("Erreur de lecture : "+e.getMessage());}
 }
 @Override protected void onStop(){if(video!=null)video.stopPlayback();super.onStop();}
}
