package fr.nautic.test;
import org.junit.Test;
import static org.junit.Assert.*;
public class CameraStreamPolicyTest {
 @Test public void usesLightStreamsForTapoPreviews(){assertEquals("/stream2",CameraStreamPolicy.preview("/stream1",false,true));assertEquals("/stream7",CameraStreamPolicy.preview("/stream6",false,true));assertEquals("/stream7",CameraStreamPolicy.preview("/stream1",true,true));}
 @Test public void switchesQualityWithoutChangingLens(){
  assertEquals("/stream2",CameraStreamPolicy.viewingQuality("/stream1",true));
  assertEquals("/stream1",CameraStreamPolicy.viewingQuality("/stream2",false));
  assertEquals("/stream7",CameraStreamPolicy.viewingQuality("/stream6",true));
  assertEquals("/stream6",CameraStreamPolicy.viewingQuality("/stream7",false));
  assertEquals("/live/main",CameraStreamPolicy.viewingQuality("/live/main",true));
 }
 @Test public void preservesOtherCameraPaths(){assertEquals("/live/main",CameraStreamPolicy.preview("/live/main",false,false));assertEquals("/stream1",CameraStreamPolicy.preview("/stream1",false,false));}
}
