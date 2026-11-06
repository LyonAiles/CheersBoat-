package fr.nautic.test;

import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.w3c.dom.*;

public class TrematageProfilesTest {
 List<Element> profiles()throws Exception{return OnvifCamera.elements(OnvifCamera.parse(("<r xmlns='urn:test'><Profiles token='fixed'/><Profiles token='mobileHD'><PTZConfiguration/></Profiles><Profiles token='mobileSD'><PTZConfiguration/></Profiles></r>").getBytes(StandardCharsets.UTF_8)),"Profiles");}
 @Test public void activeReturnWinsOverAnotherStreamPreference()throws Exception{
  Map<String,Object> saved=new HashMap<>();saved.put("192.168.1.101|mobileSD.active",true);
  assertEquals("mobileSD",TrematageProfiles.select(profiles(),"192.168.1.101","mobileHD",saved).getAttribute("token"));
 }
 @Test public void staleWatchDoesNotChooseAnotherCameraOrFixedLens()throws Exception{
  Map<String,Object> saved=new HashMap<>();saved.put("watchKey","192.168.1.101|old");saved.put("192.168.1.102|mobileSD.active",true);
  assertEquals("mobileHD",TrematageProfiles.select(profiles(),"192.168.1.101","fixed",saved).getAttribute("token"));
 }
 @Test public void streamProfilesBelongToSameCamera(){assertTrue(TrematageProfiles.sameCamera("192.168.1.101|HD","192.168.1.101|SD"));assertFalse(TrematageProfiles.sameCamera("192.168.1.101|HD","192.168.1.102|HD"));assertFalse(TrematageProfiles.sameCamera("","192.168.1.101|HD"));}
}
