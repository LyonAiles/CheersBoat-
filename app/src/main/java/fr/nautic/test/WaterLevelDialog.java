package fr.nautic.test;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.text.InputType;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Toast;
import java.util.Calendar;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONObject;

import org.json.JSONArray;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

final class WaterLevelDialog {
 private static final String API = "https://smpadeitwacgcodkgllz.supabase.co/rest/v1";
 // Public client key already used by Mon bateau.
 private static final String KEY = "sb_publishable_CvLa1V9I_xF94OUwk5QY2w_Q2tA-m8P";

 private static String request(String path, JSONObject payload) throws Exception {
  HttpURLConnection connection = (HttpURLConnection) new URL(API + path).openConnection();
  connection.setConnectTimeout(10000);
  connection.setReadTimeout(10000);
  connection.setInstanceFollowRedirects(false);
  connection.setRequestProperty("apikey", KEY);
  try {
   if (payload != null) {
    connection.setRequestMethod("POST");
    connection.setDoOutput(true);
    connection.setRequestProperty("Content-Type", "application/json");
    connection.setRequestProperty("Prefer", "return=minimal");
    try (java.io.OutputStream out = connection.getOutputStream()) {
     out.write(payload.toString().getBytes(StandardCharsets.UTF_8));
    }
   }
   int status = connection.getResponseCode();
   if (status < 200 || status >= 300) throw new java.io.IOException("HTTP " + status);
   if (payload != null) return "";
   try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
    StringBuilder body = new StringBuilder();
    String line;
    while ((line = reader.readLine()) != null) body.append(line);
    return body.toString();
   }
  } finally {
   connection.disconnect();
  }
 }

 static void open(Activity activity) {
  Calendar date = Calendar.getInstance(TimeZone.getTimeZone("Europe/Paris"));
  LinearLayout fields = new LinearLayout(activity);
  fields.setOrientation(LinearLayout.VERTICAL);
  Button dateButton = new Button(activity);
  dateButton.setText(dateLabel(date));
  dateButton.setOnClickListener(v -> new DatePickerDialog(activity, (picker, year, month, day) -> {
   date.set(year, month, day);
   dateButton.setText(dateLabel(date));
  }, date.get(Calendar.YEAR), date.get(Calendar.MONTH), date.get(Calendar.DAY_OF_MONTH)).show());
  fields.addView(dateButton);

  EditText height = new EditText(activity);
  height.setHint("Hauteur en mètres, ex. 1,590");
  height.setSingleLine(true);
  height.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
  fields.addView(height);

  AlertDialog dialog = new AlertDialog.Builder(activity)
    .setTitle("Relevé de hauteur d’eau")
    .setView(fields)
    .setNegativeButton("Annuler", null)
    .setPositiveButton("Enregistrer le relevé", null)
    .create();
  dialog.setOnShowListener(d -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
   String value = height.getText().toString().trim().replace(',', '.');
   if (!value.matches("[0-9]+(\\.[0-9]+)?") || Double.parseDouble(value) > 5) {
    height.setError("Saisis une hauteur entre 0 et 5 m");
    return;
   }
   String selectedDate = dateLabel(date);
   Button save = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
   save.setEnabled(false);
   dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(false);
   dialog.setCancelable(false);
   new Thread(() -> {
    String message;
    boolean sent = false;
    try {
     JSONObject payload = new JSONObject().put("date", selectedDate).put("hauteur", Double.parseDouble(value));
     request("/releves_bief_saisies", payload);
     sent = true;
     JSONArray rows = new JSONArray(request("/releves_bief_partages?select=hauteur&date=eq." + selectedDate, null));
     boolean confirmed = false;
     for (int i = 0; i < rows.length(); i++) {
      if (Math.abs(rows.getJSONObject(i).getDouble("hauteur") - Double.parseDouble(value)) < 0.000001) confirmed = true;
     }
     message = confirmed ? "Relevé enregistré et vérifié" : "Envoi accepté. Vérification du relevé indisponible.";
    } catch (Exception e) {
     message = sent ? "Envoi accepté. Vérification du relevé indisponible."
       : "Enregistrement non confirmé. Vérifie la connexion et le relevé avant de réessayer.";
    }
    final String result = message;
    final boolean accepted = sent;
    activity.runOnUiThread(() -> {
     if (activity.isFinishing() || activity.isDestroyed()) return;
     Toast.makeText(activity, result, Toast.LENGTH_LONG).show();
     if (accepted) dialog.dismiss();
     else {
      save.setEnabled(true);
      dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setEnabled(true);
      dialog.setCancelable(true);
     }
    });
   }, "nautic-water-level").start();
  }));
  dialog.show();
 }

 private static String dateLabel(Calendar date) {
  return String.format(Locale.ROOT, "%04d-%02d-%02d", date.get(Calendar.YEAR),
    date.get(Calendar.MONTH) + 1, date.get(Calendar.DAY_OF_MONTH));
 }

}
