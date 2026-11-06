package fr.nautic.test;
import org.junit.Test;
import static org.junit.Assert.*;
public class CameraStreamPolicyTest {
 @Test public void usesLightStreamsForTapoPreviews(){assertEquals("/stream2",CameraStreamPolicy.preview("/stream1",false,true));assertEquals("/stream7",CameraStreamPolicy.preview("/stream6",false,true));assertEquals("/stream7",CameraStreamPolicy.preview("/stream1",true,true));}
 @Test public void preservesOtherCameraPaths(){assertEquals("/live/main",CameraStreamPolicy.preview("/live/main",false,false));assertEquals("/stream1",CameraStreamPolicy.preview("/stream1",false,false));}
}
