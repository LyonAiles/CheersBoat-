package fr.nautic.test;
import android.graphics.*;
import android.graphics.drawable.Drawable;
import android.os.SystemClock;
/** Animated perimeter only: the video stays steady and unobscured. */
final class CameraGarland extends Drawable implements Runnable {
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private final float density;
 CameraGarland(float density){this.density=density;}
 @Override public void draw(Canvas canvas){
  Rect b=getBounds();float inset=2*density;Path path=new Path();path.addRoundRect(new RectF(b.left+inset,b.top+inset,b.right-inset,b.bottom-inset),8*density,8*density,Path.Direction.CW);
  // Soft light-green shimmer: no moving dots and no video brightness changes.
  float shimmer=(float)((1+Math.sin(SystemClock.uptimeMillis()*Math.PI/1500))/2);
  paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(3*density);paint.setColor(Color.argb((int)(190+45*shimmer),165,238,175));canvas.drawPath(path,paint);
  unscheduleSelf(this);scheduleSelf(this,SystemClock.uptimeMillis()+120);
 }
 public void run(){invalidateSelf();}
 public void setAlpha(int alpha){paint.setAlpha(alpha);}public void setColorFilter(ColorFilter filter){paint.setColorFilter(filter);}public int getOpacity(){return PixelFormat.TRANSLUCENT;}
}
