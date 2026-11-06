package fr.nautic.test;
import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;

public class CameraEventTest {
 CameraEvent event(String topic,String operation,String data)throws Exception{
  String xml="<r xmlns='urn:test'><NotificationMessage><Topic>"+topic+"</Topic><Message><Message PropertyOperation='"+operation+"'><Source><SimpleItem Name='VideoSource' Value='mobile'/></Source><Data>"+data+"</Data></Message></Message></NotificationMessage></r>";
  return CameraEvent.parse(OnvifCamera.parse(xml.getBytes(StandardCharsets.UTF_8))).get(0);
 }
 @Test public void personEventAndInitializationArePreserved()throws Exception{
  CameraEvent e=event("RuleEngine/PeopleDetector","Initialized","<SimpleItem Name='IsPeople' Value='true'/><SimpleItem Name='Confidence' Value='0'/>");
  assertEquals("personne",e.category);assertTrue(e.active);assertTrue(e.initial);assertTrue(e.source.contains("mobile"));
 }
 @Test public void falseIsNotAnAlarmAndVehicleIsDistinct()throws Exception{
  CameraEvent e=event("VehicleDetector","Changed","<SimpleItem Name='State' Value='false'/>");assertFalse(e.active);assertEquals("véhicule",e.category);
 }
 @Test public void genericMotionIsNeverPromotedToVehicle()throws Exception{
  CameraEvent e=event("CellMotionDetector/Motion","Changed","<SimpleItem Name='IsMotion' Value='true'/>");assertTrue(e.active);assertEquals("mouvement générique",e.category);
 }
 @Test public void falsePersonFlagDoesNotSuppressOrMislabelTrueMotion()throws Exception{
  CameraEvent e=event("CellMotionDetector/Motion","Changed","<SimpleItem Name='IsMotion' Value='true'/><SimpleItem Name='IsPeople' Value='false'/>");assertTrue(e.active);assertEquals("mouvement générique",e.category);
 }
 @Test public void inactiveMotionFlagDoesNotSuppressTrueVehicle()throws Exception{
  CameraEvent e=event("VehicleDetector","Changed","<SimpleItem Name='IsVehicle' Value='true'/><SimpleItem Name='IsMotion' Value='false'/>");assertTrue(e.active);assertEquals("véhicule",e.category);
 }
}
