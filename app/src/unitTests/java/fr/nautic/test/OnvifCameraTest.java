package fr.nautic.test;
import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import org.w3c.dom.Document;

public class OnvifCameraTest {
 private Document parse(String s)throws Exception{return OnvifCamera.parse(s.getBytes(StandardCharsets.UTF_8));}
 @Test public void rejectsExternalEntities()throws Exception{
  try{parse("<!DOCTYPE x [<!ENTITY secret SYSTEM 'file:///etc/passwd'>]><x>&secret;</x>");fail("DTD accepted");}catch(org.xml.sax.SAXException expected){}
 }
 @Test public void neverSendsCredentialsToAdvertisedForeignHost()throws Exception{
  OnvifCamera c=new OnvifCamera("192.168.1.101","user","pass");
  assertEquals("http://192.168.1.101:2020/a",c.endpoint("http://192.168.1.101:2020/a"));
  for(String url:new String[]{"http://example.org/a","file:///a","http://192.168.1.102/a"})try{c.endpoint(url);fail(url);}catch(java.io.IOException expected){}
 }
 @Test public void discoversProfilesAndNestedEventsWithoutAssumingAiCategories()throws Exception{
  OnvifCamera c=new OnvifCamera("192.168.1.101","u","p"){
   @Override Document call(String address,String ns,String operation,String body)throws Exception{
    if(operation.equals("GetServices"))return OnvifCameraTest.this.parse("<r xmlns='urn:test'><Service><Namespace>"+MEDIA+"</Namespace><XAddr>http://192.168.1.101/media</XAddr></Service><Service><Namespace>"+EVENTS+"</Namespace><XAddr>http://192.168.1.101/events</XAddr></Service></r>");
    if(operation.equals("GetProfiles"))return OnvifCameraTest.this.parse("<r xmlns='urn:test'><Profiles token='fixed'><Name>Fixe</Name></Profiles><Profiles token='mobile'><Name>Mobile</Name><PTZConfiguration><NodeToken>node2</NodeToken></PTZConfiguration></Profiles></r>");
    if(operation.equals("GetEventProperties"))return OnvifCameraTest.this.parse("<r xmlns='urn:test' xmlns:wstop='http://docs.oasis-open.org/wsn/t-1'><TopicSet><RuleEngine><CellMotionDetector><Motion wstop:topic='true'/></CellMotionDetector></RuleEngine></TopicSet></r>");
    throw new AssertionError(operation);
   }
  };
  c.discover();assertEquals(2,c.profiles.size());assertEquals("mobile",c.profiles.get(1).getAttribute("token"));
  assertEquals(java.util.Collections.singletonList("RuleEngine/CellMotionDetector/Motion"),c.topics);
  assertFalse(c.services.containsKey(OnvifCamera.PTZ));
 }
 @Test public void escapesPresetAndProfileValues(){
  assertEquals("A&amp;B&lt;&quot;&apos;",OnvifCamera.xml("A&B<\"'"));
 }
 @Test public void eventActionsMatchOnvifWsdl(){
  assertEquals(OnvifCamera.EVENTS+"/EventPortType/CreatePullPointSubscriptionRequest",OnvifCamera.actionFor(OnvifCamera.EVENTS,"CreatePullPointSubscription"));
  assertEquals(OnvifCamera.EVENTS+"/EventPortType/GetEventPropertiesRequest",OnvifCamera.actionFor(OnvifCamera.EVENTS,"GetEventProperties"));
  assertEquals(OnvifCamera.EVENTS+"/PullPointSubscription/PullMessagesRequest",OnvifCamera.actionFor(OnvifCamera.EVENTS,"PullMessages"));
  assertEquals(OnvifCamera.PTZ+"/Stop",OnvifCamera.actionFor(OnvifCamera.PTZ,"Stop"));
 }
}
