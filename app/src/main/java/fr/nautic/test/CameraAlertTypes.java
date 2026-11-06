package fr.nautic.test;

import android.content.Context;
import org.json.JSONObject;

/** Separate alert filters, read live by each watch. Defaults preserve vehicle-only watches. */
final class CameraAlertTypes {
 static boolean enabled(Context context,String watch,String category){
  String key="véhicule".equals(category)?"vehicle":"personne".equals(category)?"person":"mouvement générique".equals(category)?"motion":"";
  if(key.isEmpty())return false;
  try{
   JSONObject settings=new JSONObject(context.getSharedPreferences("nautic_settings",Context.MODE_PRIVATE).getString("nautic-extensions","{}"));
   JSONObject all=settings.optJSONObject("alertTypes");JSONObject choice=all==null?null:all.optJSONObject(watch);
   return choice==null?"vehicle".equals(key):choice.optBoolean(key,"vehicle".equals(key));
  }catch(Exception e){return "vehicle".equals(key);}
 }
}
