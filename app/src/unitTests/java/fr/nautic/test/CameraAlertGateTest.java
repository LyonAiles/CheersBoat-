package fr.nautic.test;
import org.junit.Test;
import static org.junit.Assert.*;

public class CameraAlertGateTest {
 CameraEvent person(boolean active,boolean initial){return new CameraEvent("tns1:RuleEngine/PeopleDetector/People","IsPeople="+active,"personne","VideoSourceConfigurationToken=vsconf;Rule=MyPeopleDetectorRule;",active,initial);}
 @Test public void repeatedInitializedPersonIsAnnouncedOnceAfterSettling(){
  CameraAlertGate gate=new CameraAlertGate();CameraEvent e=person(true,true);
  for(int t=0;t<4000;t+=100)assertFalse(gate.receive(e,false,t));
  assertTrue(gate.receive(e,true,4000));
  for(int t=4100;t<90000;t+=100)assertFalse(gate.receive(e,true,t));
 }
 @Test public void disappearanceThenReappearanceAllowsANewAlert(){
  CameraAlertGate gate=new CameraAlertGate();assertTrue(gate.receive(person(true,false),true,1000));
  assertFalse(gate.receive(person(false,true),true,7000));assertFalse(gate.receive(person(true,true),true,8000));
  assertTrue(gate.receive(person(true,true),true,9100));assertFalse(gate.receive(person(true,true),true,10000));
 }
 @Test public void firstInitialStateNeedsASecondStableObservation(){
  CameraAlertGate gate=new CameraAlertGate();assertFalse(gate.receive(person(true,true),true,10000));assertFalse(gate.receive(person(true,true),true,10500));assertTrue(gate.receive(person(true,true),true,11000));
 }
 @Test public void realChangedEventsRemainImmediateAndDuplicateSafe(){
  CameraAlertGate gate=new CameraAlertGate();assertTrue(gate.receive(person(true,false),true,1000));assertFalse(gate.receive(person(true,false),true,2000));assertFalse(gate.receive(person(false,false),true,7000));assertTrue(gate.receive(person(true,false),true,8000));
 }
}
