package fr.nautic.test;
import android.content.Context;
final class TrematageFeedback {
 static void activated(Context context){TrematageAccess.prefs(context).edit().putLong("activationTime",System.currentTimeMillis()).apply();playAlert(context);}
 static void playAlert(Context context){CameraAlertSounds.play(context,"44",null);}
}
