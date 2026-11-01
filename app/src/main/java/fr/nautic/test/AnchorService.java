package fr.nautic.test;
import android.app.*;
import android.content.*;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.view.*;
import android.widget.TextView;
public class AnchorService extends Service {
 private WindowManager wm;private View anchor;
 @Override public IBinder onBind(Intent i){return null;}
 @Override public int onStartCommand(Intent i,int flags,int id){
  if(anchor!=null)return START_STICKY;
  if(Build.VERSION.SDK_INT>=26)((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel("anchor","Ancre Nautic",NotificationManager.IMPORTANCE_LOW));
  Intent open=new Intent(this,MainActivity.class);open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
  PendingIntent pi=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|(Build.VERSION.SDK_INT>=23?PendingIntent.FLAG_IMMUTABLE:0));
  Notification.Builder nb=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,"anchor"):new Notification.Builder(this);
  startForeground(1212,nb.setSmallIcon(android.R.drawable.ic_menu_compass).setContentTitle("Nautic réduit").setContentText("Toucher pour ouvrir Nautic").setContentIntent(pi).setOngoing(true).build());
  try{
   wm=(WindowManager)getSystemService(WINDOW_SERVICE);
   TextView b=new TextView(this);b.setText("⚓");b.setTextSize(29);b.setGravity(Gravity.CENTER);b.setTextColor(-1);
   GradientDrawable bg=new GradientDrawable();bg.setColor(0xee09283e);bg.setCornerRadius(52);bg.setStroke(2,0xff31b9e9);b.setBackground(bg);
   int size=(int)(58*getResources().getDisplayMetrics().density);
   WindowManager.LayoutParams p=new WindowManager.LayoutParams(size,size,Build.VERSION.SDK_INT>=26?WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY:WindowManager.LayoutParams.TYPE_PHONE,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,PixelFormat.TRANSLUCENT);
   p.gravity=Gravity.TOP|Gravity.START;p.x=12;p.y=(int)(80*getResources().getDisplayMetrics().density);
   b.setAlpha(0f);b.setScaleX(.35f);b.setScaleY(.35f);wm.addView(b,p);anchor=b;
   final float[] down={0,0};final int[] start={0,0};final boolean[] moved={false};
   b.setOnTouchListener((v,e)->{
    if(e.getAction()==MotionEvent.ACTION_DOWN){down[0]=e.getRawX();down[1]=e.getRawY();start[0]=p.x;start[1]=p.y;moved[0]=false;return true;}
    if(e.getAction()==MotionEvent.ACTION_MOVE){int dx=(int)(e.getRawX()-down[0]),dy=(int)(e.getRawY()-down[1]);if(Math.abs(dx)>12||Math.abs(dy)>12)moved[0]=true;if(moved[0]){p.x=Math.max(0,start[0]+dx);p.y=Math.max(0,start[1]+dy);wm.updateViewLayout(b,p);}return true;}
    if(e.getAction()==MotionEvent.ACTION_UP){if(!moved[0]){startActivity(open);stopSelf();}return true;}
    return true;
   });
   b.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(320).start();
  }catch(Exception e){stopSelf();}
  return START_STICKY;
 }
 @Override public void onDestroy(){if(anchor!=null&&wm!=null)try{wm.removeView(anchor);}catch(Exception ignored){}super.onDestroy();}
}