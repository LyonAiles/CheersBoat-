package fr.nautic.test;
import android.graphics.*;
import android.graphics.drawable.Drawable;
import android.os.SystemClock;
/** Animated perimeter only: the video stays steady and unobscured. */
final class CameraGarland extends Drawable implements Runnable {
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private final float density;
 CameraGarland(float density){this.density=density;}
 @Override public void draw(Canvas canvas){
  Rect b=getBounds();float inset=3*density;Path path=new Path();path.addRoundRect(new RectF(b.left+inset,b.top+inset,b.right-inset,b.bottom-inset),8*density,8*density,Path.Direction.CW);
  paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(4*density);paint.setStrokeCap(Paint.Cap.ROUND);
  float phase=(SystemClock.uptimeMillis()%1600)/1600f*24*density;
  paint.setColor(0xff58efb0);paint.setPathEffect(new DashPathEffect(new float[]{2*density,22*density},phase));canvas.drawPath(path,paint);
  paint.setColor(0xff86dfff);paint.setPathEffect(new DashPathEffect(new float[]{2*density,22*density},phase+12*density));canvas.drawPath(path,paint);
  unscheduleSelf(this);scheduleSelf(this,SystemClock.uptimeMillis()+100);
 }
 public void run(){invalidateSelf();}
 public void setAlpha(int alpha){paint.setAlpha(alpha);}public void setColorFilter(ColorFilter filter){paint.setColorFilter(filter);}public int getOpacity(){return PixelFormat.TRANSLUCENT;}
}
