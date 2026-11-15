package fr.nautic.test;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;

/** Simulation fills unconfigured preview slots while keeping explicitly configured sources. */
final class CameraDisplaySource {
 static int index(Context context,int index){
  if(index!=1&&index!=3)return index;
  try{
   SharedPreferences settings=context.getSharedPreferences("nautic_settings",Context.MODE_PRIVATE);
   JSONObject config=new JSONObject(settings.getString("nautic-v04","{}"));
   if(!config.optString("cam"+index,"").trim().isEmpty())return index;
   boolean simulation=new JSONObject(settings.getString("nautic-extensions","{}")).optBoolean("cameraSimulation42",true);
   return simulation?2:index;
  }catch(Exception e){return index;}
 }
}
