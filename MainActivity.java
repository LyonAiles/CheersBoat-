package fr.nautic.test;
import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;
public class MainActivity extends Activity {
 @Override public void onCreate(Bundle b) { super.onCreate(b);
  LinearLayout root = new LinearLayout(this); root.setOrientation(1); root.setGravity(Gravity.CENTER); root.setPadding(24,24,24,24); root.setBackgroundColor(Color.rgb(5,33,53));
  TextView title = new TextView(this); title.setText("⚓ Nautic"); title.setTextSize(36); title.setTextColor(Color.WHITE); title.setGravity(Gravity.CENTER); root.addView(title);
  TextView msg = new TextView(this); msg.setText("Application Android — test réussi\nVersion 0.1 · Hors ligne"); msg.setTextSize(18); msg.setTextColor(Color.rgb(138,220,238)); msg.setGravity(Gravity.CENTER); msg.setPadding(0,32,0,0); root.addView(msg);
  setContentView(root);
 }
}
