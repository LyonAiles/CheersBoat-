package fr.nautic.test;

import org.junit.Test;
import static org.junit.Assert.*;

public class CameraCropTest {
 @Test public void remembersNormalizedPanAcrossDifferentPreviewShapes() {
  CameraCrop drag=CameraCrop.CENTER.drag(35,-15,140,60);
  CameraCrop saved=CameraCrop.read(drag.encode());
  assertEquals(15,saved.translateX(60),.001);
  assertEquals(-5,saved.translateY(20),.001);
  assertEquals(25,saved.translateX(100),.001);
  assertEquals(0,saved.translateY(0),.001);
 }

 @Test public void keepsTheWholeViewportCoveredAtBothLimits() {
  CameraCrop drag=CameraCrop.CENTER.drag(500,-500,100,100);
  assertEquals(20,drag.translateX(40),.001);
  assertEquals(-30,drag.translateY(60),.001);
  assertEquals(0,CameraCrop.read("NaN,Infinity").x,.001);
  assertSame(CameraCrop.CENTER,CameraCrop.read("invalid"));
  assertTrue(CameraCrop.supported(1));
  assertTrue(CameraCrop.supported(2));
  assertFalse(CameraCrop.supported(3));
 }
}
