package fr.nautic.test;
import org.junit.Test;
import static org.junit.Assert.*;
import org.w3c.dom.Document;

public class OnvifSubscriptionTest {
 @Test public void usesSubscriptionAddressAndPreservesReferenceParameters()throws Exception{
  OnvifCamera c=new OnvifCamera("192.168.1.101","u","p"){
   @Override Document call(String address,String ns,String op,String body)throws Exception{
    return TrematageSessionTest.doc("<s:Envelope xmlns:s='http://www.w3.org/2003/05/soap-envelope' xmlns:wsa='http://www.w3.org/2005/08/addressing'><s:Header><wsa:ReplyTo><wsa:Address>http://www.w3.org/2005/08/addressing/anonymous</wsa:Address></wsa:ReplyTo></s:Header><s:Body><Response><SubscriptionReference><wsa:Address>http://192.168.1.101:2020/pullpoint</wsa:Address><wsa:ReferenceParameters><SubscriptionId xmlns='urn:camera'>42</SubscriptionId></wsa:ReferenceParameters></SubscriptionReference></Response></s:Body></s:Envelope>");
   }
  };
  c.services.put(OnvifCamera.EVENTS,"http://192.168.1.101:2020/events");c.beginEvents();
  assertEquals("http://192.168.1.101:2020/pullpoint",c.subscription);assertTrue(c.subscriptionHeaders.contains("SubscriptionId"));assertTrue(c.subscriptionHeaders.contains("42"));assertTrue(c.subscriptionHeaders.contains("IsReferenceParameter"));
 }
 @Test public void missingSubscriptionCannotBeReportedAsListening()throws Exception{
  OnvifCamera c=new OnvifCamera("192.168.1.101","u","p"){@Override Document call(String address,String ns,String op,String body)throws Exception{return TrematageSessionTest.doc("<Response/>");}};
  try{c.beginEvents();fail();}catch(java.io.IOException expected){assertTrue(c.subscription.isEmpty());}
 }
}
