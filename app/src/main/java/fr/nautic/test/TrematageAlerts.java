package fr.nautic.test;

import android.app.Activity;
import android.content.*;
import android.os.Build;
import android.widget.Toast;

/** Shows incoming watch messages on either the chart or camera activity. */
final class TrematageAlerts {
 static BroadcastReceiver attach(Activity activity){
  BroadcastReceiver receiver=new BroadcastReceiver(){@Override public void onReceive(Context c,Intent i){String message=i.getStringExtra("message");if(message!=null){Toast.makeText(activity,message,Toast.LENGTH_LONG).show();if(activity instanceof MainActivity)((MainActivity)activity).dashboardAlert(message);}}};
  IntentFilter filter=new IntentFilter(TrematageService.ACTION);
  if(Build.VERSION.SDK_INT>=33)activity.registerReceiver(receiver,filter,Context.RECEIVER_NOT_EXPORTED);else activity.registerReceiver(receiver,filter);
  return receiver;
 }
}
