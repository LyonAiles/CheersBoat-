package fr.nautic.test;

/** Where the available overscan sits in a cropped camera preview. */
final class CameraCrop {
 static final CameraCrop CENTER = new CameraCrop(0, 0);
 final float x, y;

 CameraCrop(float x, float y) {
  this.x = clamp(x);
  this.y = clamp(y);
 }

 private static float clamp(float value) {
  return !Float.isNaN(value) && !Float.isInfinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
 }

 CameraCrop drag(float dx, float dy, int width, int height) {
  return new CameraCrop(x + 2 * dx / Math.max(1, width), y + 2 * dy / Math.max(1, height));
 }

 static CameraCrop read(String value) {
  int separator = value.indexOf(',');
  if (separator < 0) return CENTER;
  try {
   return new CameraCrop(Float.parseFloat(value.substring(0, separator)),
    Float.parseFloat(value.substring(separator + 1)));
  } catch (NumberFormatException ignored) {
   return CENTER;
  }
 }

 String encode() { return x + "," + y; }

 static String key(int camera) { return "nautic-camera-crop-" + camera; }

 static boolean supported(int camera) { return camera >= 1 && camera <= 3; }

 float translateX(float overflow) { return x * Math.max(0, overflow) / 2; }
 float translateY(float overflow) { return y * Math.max(0, overflow) / 2; }
}
