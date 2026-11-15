package fr.nautic.test;

import org.junit.Test;
import org.w3c.dom.Document;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

public class MapCameraControlsTest {
 @Test public void onlyAdvertisedDayNightModesAreOffered()throws Exception{
  Document options=OnvifCamera.parse(("<ImagingOptions><IrCutFilter>AUTO</IrCutFilter>"+
   "<IrCutFilter>ON</IrCutFilter></ImagingOptions>").getBytes(StandardCharsets.UTF_8));
  assertTrue(MapCameraControls.supportsNightMode(options,"AUTO"));
  assertTrue(MapCameraControls.supportsNightMode(options,"ON"));
  assertFalse(MapCameraControls.supportsNightMode(options,"OFF"));
 }
 @Test public void genericRelaysAreNeverUsedAsLights(){
  assertTrue(MapCameraControls.isLightRelay("spotlight_1",""));
  assertTrue(MapCameraControls.isLightRelay("relay1","Projecteur"));
  assertFalse(MapCameraControls.isLightRelay("relay1","Alarme"));
  assertFalse(MapCameraControls.isLightRelay("","Spotlight"));
 }
}
