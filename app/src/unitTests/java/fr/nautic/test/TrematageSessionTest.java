package fr.nautic.test;

import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.w3c.dom.*;

public class TrematageSessionTest {
 static Document doc(String xml)throws Exception{return OnvifCamera.parse(xml.getBytes(StandardCharsets.UTF_8));}
 static class Memory implements TrematageSession.Store{
  String backup="";boolean armed;
  public String backup(){return backup;}public boolean armed(){return armed;}
  public void save(String b,boolean a){backup=b;armed=a;}
 }
 static class Camera extends OnvifCamera{
  List<String> commands=new ArrayList<>();boolean failGo=false,missing=false;int captures;
  Camera(){super("127.0.0.1","u","p");}
  @Override Document ptz(Element p,String op,String body)throws Exception{
   commands.add(op+body);
   if(op.equals("GetPresets"))return doc("<r xmlns='urn:test'>"+(missing?"":"<Preset token='rear'><Name>Trématage</Name></Preset>")+(captures>0?"<Preset token='return'><Name>Nautic retour mobile</Name></Preset>":"")+"</r>");
   if(op.equals("SetPreset")){captures++;return doc("<r xmlns='urn:test'><PresetToken>return</PresetToken></r>");}
   if(op.equals("GotoPreset")&&failGo)throw new java.io.IOException("Wi-Fi coupé");
   return doc("<r/>");
  }
 }
 Element profile()throws Exception{return doc("<Profile token='mobile'/>").getDocumentElement();}
 @Test public void activationCapturesOnceAndReturnSurvivesNewController()throws Exception{
  Camera c=new Camera();Memory s=new Memory();TrematageSession t=new TrematageSession(c,profile(),s);
  t.activate();t.activate();assertEquals(1,c.captures);assertTrue(s.armed);
  assertTrue(c.commands.get(c.commands.size()-1).contains("rear"));
  new TrematageSession(c,profile(),s).deactivate();assertFalse(s.armed);
  assertTrue(c.commands.get(c.commands.size()-1).contains("return"));
  t.activate();assertEquals(2,c.captures);assertTrue(c.commands.get(c.commands.size()-2).contains("<c:PresetToken>return</c:PresetToken>"));
 }
 @Test public void failedMoveNeverLosesReturn()throws Exception{
  Camera c=new Camera();Memory s=new Memory();TrematageSession t=new TrematageSession(c,profile(),s);c.failGo=true;
  try{t.activate();fail();}catch(java.io.IOException expected){}
  assertTrue(s.armed);assertEquals("return",s.backup);
  try{t.deactivate();fail();}catch(java.io.IOException expected){}
  assertTrue(s.armed);c.failGo=false;t.deactivate();assertFalse(s.armed);
 }
 @Test public void missingDestinationDoesNotCaptureOrMove()throws Exception{
  Camera c=new Camera();c.missing=true;Memory s=new Memory();
  try{new TrematageSession(c,profile(),s).activate();fail();}catch(java.io.IOException expected){}
  assertEquals(0,c.captures);assertFalse(s.armed);assertEquals(1,c.commands.size());
 }
 @Test public void matchesExactNameWithOrWithoutAccent(){assertTrue(TrematageSession.named(" Trématage "));assertTrue(TrematageSession.named("TREMATAGE"));assertFalse(TrematageSession.named("Trématage 2"));}
}
