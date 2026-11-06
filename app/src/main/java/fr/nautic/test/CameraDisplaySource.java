package fr.nautic.test;
import android.content.Context;
import org.json.JSONObject;
/** Simulation affects displayed streams only, never saved addresses or PTZ profiles. */
final class CameraDisplaySource {
 static int index(Context context,int index){if(index!=1&&index!=3)return index;try{return new JSONObject(context.getSharedPreferences("nautic_settings",Context.MODE_PRIVATE).getString("nautic-extensions","{}")).optBoolean("cameraSimulation42",true)?2:index;}catch(Exception e){return index;}}
}
