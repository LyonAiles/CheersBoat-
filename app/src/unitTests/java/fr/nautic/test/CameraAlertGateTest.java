package fr.nautic.test;
import org.junit.Test;
import static org.junit.Assert.*;

public class CameraAlertGateTest {
 CameraEvent vehicle(boolean active,boolean initial){return new CameraEvent("tns1:RuleEngine/VehicleDetector/Vehicle","IsVehicle="+active,"véhicule","VideoSourceConfigurationToken=vsconf;Rule=MyVehicleDetectorRule;",active,initial);}
 @Test public void repeatedInitializedVehicleIsAnnouncedOnceAfterSettling(){
  CameraAlertGate gate=new CameraAlertGate();CameraEvent e=vehicle(true,true);
  for(int t=0;t<4000;t+=100)assertFalse(gate.receive(e,false,t));
  assertTrue(gate.receive(e,true,4000));
  for(int t=4100;t<90000;t+=100)assertFalse(gate.receive(e,true,t));
 }
 @Test public void disappearanceThenReappearanceAllowsANewAlert(){
  CameraAlertGate gate=new CameraAlertGate();assertTrue(gate.receive(vehicle(true,false),true,1000));
  assertFalse(gate.receive(vehicle(false,true),true,7000));assertFalse(gate.receive(vehicle(true,true),true,8000));
  assertTrue(gate.receive(vehicle(true,true),true,9100));assertFalse(gate.receive(vehicle(true,true),true,10000));
 }
 @Test public void firstInitialStateNeedsASecondStableObservation(){
  CameraAlertGate gate=new CameraAlertGate();assertFalse(gate.receive(vehicle(true,true),true,10000));assertFalse(gate.receive(vehicle(true,true),true,10500));assertTrue(gate.receive(vehicle(true,true),true,11000));
 }
 @Test public void realChangedEventsRemainImmediateAndDuplicateSafe(){
  CameraAlertGate gate=new CameraAlertGate();assertTrue(gate.receive(vehicle(true,false),true,1000));assertFalse(gate.receive(vehicle(true,false),true,2000));assertFalse(gate.receive(vehicle(false,false),true,7000));assertTrue(gate.receive(vehicle(true,false),true,8000));
 }
 @Test public void peopleAndGenericMotionNeverTriggerTrematage(){
  CameraAlertGate gate=new CameraAlertGate();for(String category:new String[]{"personne","mouvement générique","autre"})assertFalse(gate.receive(new CameraEvent("rule","State=true",category,"vsconf",true,false),true,10000));
 }
 @Test public void selectedPersonAndMotionCanAlertButDisabledVehicleCannot(){
  CameraAlertGate gate=new CameraAlertGate();
  assertFalse(gate.receive(vehicle(true,false),true,10000,false));
  for(String category:new String[]{"personne","mouvement générique"})assertTrue(gate.receive(new CameraEvent(category,"State=true",category,"vsconf",true,false),true,10000,true));
 }
 @Test public void disablingThenEnablingResetsTheCategoryEpisode(){
  CameraAlertGate gate=new CameraAlertGate();assertTrue(gate.receive(vehicle(true,false),true,1000,true));
  assertFalse(gate.receive(vehicle(true,false),true,2000,false));assertTrue(gate.receive(vehicle(true,false),true,3000,true));
 }
}
