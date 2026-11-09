package fr.nautic.test;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import org.json.JSONArray;
import org.json.JSONObject;

import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

final class NauticUpdates {
 private static final String REPO = "LyonAiles/CheersBoat-";
 private static final String RELEASES = "https://github.com/" + REPO + "/releases/";

 static void check(Activity activity) {
  new Thread(() -> {
   HttpURLConnection connection = null;
   try {
    int installed = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionCode;
    connection = (HttpURLConnection)new URL("https://api.github.com/repos/" + REPO + "/releases?per_page=10").openConnection();
    connection.setConnectTimeout(5000);
    connection.setReadTimeout(5000);
    connection.setInstanceFollowRedirects(false);
    connection.setRequestProperty("Accept", "application/vnd.github+json");
    if (connection.getResponseCode() != 200) return;

    JSONArray releases;
    try (InputStream input = connection.getInputStream()) {
     ByteArrayOutputStream output = new ByteArrayOutputStream();
     byte[] buffer = new byte[4096];
     for (int length; (length = input.read(buffer)) != -1; ) {
      if (output.size() + length > 262144) return;
      output.write(buffer, 0, length);
     }
     releases = new JSONArray(new String(output.toByteArray(), StandardCharsets.UTF_8));
    }

    int latest = installed;
    for (int i = 0; i < releases.length(); i++) {
     JSONObject release = releases.getJSONObject(i);
     String tag = release.optString("tag_name");
     if (release.optBoolean("draft") || release.optBoolean("prerelease") ||
         !tag.matches("nautic-0[.]4[.][0-9]{1,9}")) continue;
     int version = Integer.parseInt(tag.substring("nautic-0.4.".length()));
     JSONArray assets = release.getJSONArray("assets");
     for (int j = 0; j < assets.length(); j++) {
      if (assets.getJSONObject(j).optString("name").equals("app-release.apk")) {
       latest = Math.max(latest, version);
       break;
      }
     }
    }
    if (latest == installed) return;

    String version = "0.4." + latest;
    activity.runOnUiThread(() -> {
     if (activity.isFinishing() || activity.isDestroyed()) return;
     new AlertDialog.Builder(activity)
       .setTitle("Nautic " + version + " disponible")
       .setMessage("Télécharge l’APK signé, puis confirme la mise à jour dans Android.")
       .setNegativeButton("Plus tard", null)
       .setPositiveButton("Télécharger", (dialog, button) -> {
        try {
         activity.startActivity(new Intent(Intent.ACTION_VIEW,
           Uri.parse(RELEASES + "download/nautic-" + version + "/app-release.apk")));
        } catch (android.content.ActivityNotFoundException e) {
         android.widget.Toast.makeText(activity, "Navigateur indisponible", android.widget.Toast.LENGTH_LONG).show();
        }
       }).show();
    });
   } catch (Exception ignored) {
    // Startup remains available offline.
   } finally {
    if (connection != null) connection.disconnect();
   }
  }, "nautic-update-check").start();
 }
}
