package fr.nautic.test;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.os.Bundle;
import android.text.InputType;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONObject;

public class BoatActivity extends Activity {
 private static final String SITE = "https://cerulean-mochi-747b13.netlify.app";
 private WebView web;
 private String pendingDate;
 private String pendingHeight;

 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);

  LinearLayout page = new LinearLayout(this);
  page.setOrientation(LinearLayout.VERTICAL);
  Button measure = new Button(this);
  measure.setText("Saisir une hauteur d’eau");
  measure.setOnClickListener(v -> openMeasurement());
  page.addView(measure);

  web = new WebView(this);
  web.getSettings().setJavaScriptEnabled(true);
  web.getSettings().setDomStorageEnabled(true);
  web.setWebViewClient(new WebViewClient() {
   @Override public void onPageFinished(WebView view, String url) {
    if (pendingDate != null && (SITE.equals(url) || (SITE + "/").equals(url))) {
     prefillMeasurement();
    }
   }
  });
  page.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
  setContentView(page);
  web.loadUrl(SITE);
 }

 private void openMeasurement() {
  Calendar date = Calendar.getInstance(TimeZone.getTimeZone("Europe/Paris"));
  LinearLayout fields = new LinearLayout(this);
  fields.setOrientation(LinearLayout.VERTICAL);
  Button dateButton = new Button(this);
  dateButton.setText(dateLabel(date));
  dateButton.setOnClickListener(v -> new DatePickerDialog(this, (picker, year, month, day) -> {
   date.set(year, month, day);
   dateButton.setText(dateLabel(date));
  }, date.get(Calendar.YEAR), date.get(Calendar.MONTH), date.get(Calendar.DAY_OF_MONTH)).show());
  fields.addView(dateButton);

  EditText height = new EditText(this);
  height.setHint("Hauteur en mètres, ex. 1,590");
  height.setSingleLine(true);
  height.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
  fields.addView(height);

  AlertDialog dialog = new AlertDialog.Builder(this)
    .setTitle("Relevé de hauteur d’eau")
    .setView(fields)
    .setNegativeButton("Annuler", null)
    .setPositiveButton("Préparer le relevé", null)
    .create();
  dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
   String value = height.getText().toString().trim().replace(',', '.');
   if (!value.matches("[0-9]+(\\.[0-9]+)?") || Double.parseDouble(value) > 5) {
    height.setError("Saisis une hauteur entre 0 et 5 m");
    return;
   }
   pendingDate = dateLabel(date);
   pendingHeight = value;
   dialog.dismiss();
   String url = web.getUrl();
   if (SITE.equals(url) || (SITE + "/").equals(url)) prefillMeasurement();
   else web.loadUrl(SITE);
  }));
  dialog.show();
 }

 private static String dateLabel(Calendar date) {
  return String.format(Locale.ROOT, "%04d-%02d-%02d", date.get(Calendar.YEAR),
    date.get(Calendar.MONTH) + 1, date.get(Calendar.DAY_OF_MONTH));
 }

 private void prefillMeasurement() {
  final String date = pendingDate;
  final String height = pendingHeight;
  String script = "(function(){"
    + "if(location.origin!==" + JSONObject.quote(SITE) + ")return false;"
    + "const date=document.getElementById('measureDate'),height=document.getElementById('measureHeight');"
    + "const unlock=document.getElementById('unlockBox'),edit=document.getElementById('editPanel');"
    + "if(!date||!height||!unlock||!edit||!document.getElementById('addMeasure'))return false;"
    + "date.value=" + JSONObject.quote(date) + ";height.value=" + JSONObject.quote(height) + ";"
    + "(edit.hidden?unlock:edit).scrollIntoView({block:'start'});return true;})()";
  web.evaluateJavascript(script, result -> {
   if (!date.equals(pendingDate) || !height.equals(pendingHeight)) return;
   if ("true".equals(result)) {
    pendingDate = null;
    pendingHeight = null;
    Toast.makeText(this, "Relevé prêt. Enregistre-le dans Mon bateau.", Toast.LENGTH_LONG).show();
   } else if (web.getProgress() == 100) {
    Toast.makeText(this, "Formulaire indisponible. Recharge Mon bateau pour réessayer.", Toast.LENGTH_LONG).show();
   }
  });
 }

 @Override public void onBackPressed() {
  if (web.canGoBack()) web.goBack();
  else super.onBackPressed();
 }

 @Override protected void onDestroy() {
  web.destroy();
  super.onDestroy();
 }
}
