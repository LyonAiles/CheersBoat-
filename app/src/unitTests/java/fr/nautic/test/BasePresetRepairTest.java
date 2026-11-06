package fr.nautic.test;

import org.junit.Test;
import static org.junit.Assert.*;
import org.w3c.dom.*;
import java.util.*;

public class BasePresetRepairTest {
 static String coordinates="<PanTilt x='0.25' y='-0.1'/><Zoom x='0.2'/>";
 static class Camera extends OnvifCamera {
  boolean renamed=false,existing=false,positions=true,atTarget=true;int writes=0;
  List<String> calls=new ArrayList<>();
  Camera(){super("127.0.0.1","u","p");}
  @Override Document ptz(Element p,String op,String body)throws Exception{
   calls.add(op);
   if(op.equals("GetPresets"))return TrematageSessionTest.doc("<r xmlns='urn:test'><Preset token='oldbase'><Name>"+(renamed||existing?"BASE":"Nautic retour mobile")+"</Name>"+(positions?"<PTZPosition>"+coordinates+"</PTZPosition>":"")+"</Preset><Preset token='rear'><Name>Trématage</Name></Preset></r>");
   if(op.equals("GetStatus")){
    if(!atTarget)throw new java.io.IOException("Position non confirmée");
    return TrematageSessionTest.doc("<r xmlns='urn:test'><Position>"+coordinates+"</Position><MoveStatus><PanTilt>IDLE</PanTilt><Zoom>IDLE</Zoom></MoveStatus></r>");
   }
   if(op.equals("SetPreset")){assertTrue(body.contains("<c:PresetName>BASE</c:PresetName>"));assertTrue(body.contains("<c:PresetToken>oldbase</c:PresetToken>"));writes++;renamed=true;}
   return TrematageSessionTest.doc("<r/>");
  }
 }
 Element profile()throws Exception{return TrematageSessionTest.doc("<Profile token='mobile'/>").getDocumentElement();}
 @Test public void repairRecallsAndVerifiesCoordinatesBeforeRenaming()throws Exception{
  Camera c=new Camera();assertEquals("oldbase",new BasePresetRepair(c,profile()).restore("oldbase"));
  assertEquals(1,c.writes);assertTrue(c.calls.indexOf("GotoPreset")<c.calls.indexOf("GetStatus"));assertTrue(c.calls.indexOf("GetStatus")<c.calls.indexOf("SetPreset"));assertEquals("GetPresets",c.calls.get(c.calls.size()-1));
 }
 @Test public void existingBaseIsNeverRewritten()throws Exception{
  Camera c=new Camera();c.existing=true;assertEquals("oldbase",new BasePresetRepair(c,profile()).restore("oldbase"));assertEquals(0,c.writes);
 }
 @Test public void missingOrUnconfirmedCoordinatesNeverRename()throws Exception{
  for(boolean missing:new boolean[]{true,false}){Camera c=new Camera();c.positions=!missing;c.atTarget=missing;
   try{new BasePresetRepair(c,profile()).restore("oldbase");fail();}catch(java.io.IOException expected){}assertEquals(0,c.writes);
  }
 }
 @Test public void rejectsDifferentOrUnknownPositions()throws Exception{
  Element a=TrematageSessionTest.doc("<Position>"+coordinates+"</Position>").getDocumentElement();
  Element b=TrematageSessionTest.doc("<Position><PanTilt x='0.7' y='-0.1'/><Zoom x='0.2'/></Position>").getDocumentElement();
  assertTrue(BasePresetRepair.samePosition(a,a));assertFalse(BasePresetRepair.samePosition(a,b));assertFalse(BasePresetRepair.samePosition(a,null));
 }
}
