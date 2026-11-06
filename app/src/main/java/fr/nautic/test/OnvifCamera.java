package fr.nautic.test;

import android.util.Base64;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.text.SimpleDateFormat;
import java.util.*;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.*;

/** Local ONVIF client. Only advertised services/profiles are offered to the user. */
class OnvifCamera {
 static final String DEVICE="http://www.onvif.org/ver10/device/wsdl", MEDIA="http://www.onvif.org/ver10/media/wsdl",
  PTZ="http://www.onvif.org/ver20/ptz/wsdl", EVENTS="http://www.onvif.org/ver10/events/wsdl";
 final String host,user,password;
 final Map<String,String> services=new LinkedHashMap<>();
 final List<Element> profiles=new ArrayList<>();
 final List<String> topics=new ArrayList<>(),notes=new ArrayList<>();
 String device,subscription="";
 String subscriptionHeaders="";
 OnvifCamera(String host,String user,String password){this.host=host;this.user=user;this.password=password;}
 static String xml(String s){return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&apos;");}
 static List<Element> elements(Node n,String name){
  NodeList list=((n instanceof Document)?((Document)n).getDocumentElement():(Element)n).getElementsByTagNameNS("*",name);
  List<Element> out=new ArrayList<>();for(int i=0;i<list.getLength();i++)out.add((Element)list.item(i));return out;
 }
 static String value(Node n,String name){List<Element> e=elements(n,name);return e.isEmpty()?"":e.get(0).getTextContent();}
 static Document parse(byte[] bytes)throws Exception{
  String source=new String(bytes,StandardCharsets.UTF_8);
  if(java.util.regex.Pattern.compile("<!\\s*(DOCTYPE|ENTITY)",java.util.regex.Pattern.CASE_INSENSITIVE).matcher(source).find())throw new org.xml.sax.SAXException("DTD interdite");
  DocumentBuilderFactory f=DocumentBuilderFactory.newInstance();f.setNamespaceAware(true);
  javax.xml.parsers.DocumentBuilder builder=f.newDocumentBuilder();
  builder.setEntityResolver((publicId,systemId)->{throw new org.xml.sax.SAXException("Entité externe interdite");});
  return builder.parse(new ByteArrayInputStream(bytes));
 }
 static String b64(byte[] b){return Base64.encodeToString(b,Base64.NO_WRAP);}
 private String security()throws Exception{
  byte[] nonce=new byte[20];new SecureRandom().nextBytes(nonce);
  SimpleDateFormat f=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'",Locale.US);f.setTimeZone(TimeZone.getTimeZone("UTC"));
  String created=f.format(new Date());MessageDigest sha=MessageDigest.getInstance("SHA-1");
  sha.update(nonce);sha.update(created.getBytes(StandardCharsets.UTF_8));sha.update(password.getBytes(StandardCharsets.UTF_8));
  String ws="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-";
  return "<wsse:Security xmlns:wsse='"+ws+"wssecurity-secext-1.0.xsd' xmlns:wsu='"+ws+"wssecurity-utility-1.0.xsd'><wsse:UsernameToken><wsse:Username>"+xml(user)+"</wsse:Username><wsse:Password Type='"+ws+"username-token-profile-1.0#PasswordDigest'>"+b64(sha.digest())+"</wsse:Password><wsse:Nonce EncodingType='"+ws+"soap-message-security-1.0#Base64Binary'>"+b64(nonce)+"</wsse:Nonce><wsu:Created>"+created+"</wsu:Created></wsse:UsernameToken></wsse:Security>";
 }
 // Reject advertised addresses on a different host; credentials remain on the selected camera.
 String endpoint(String address)throws Exception{
  URI u=new URI(address);if(!host.equalsIgnoreCase(u.getHost())||!("http".equals(u.getScheme())||"https".equals(u.getScheme())))throw new IOException("Adresse ONVIF différente de la caméra");
  return address;
 }
 static String actionFor(String ns,String operation){
  String action=ns+"/"+operation;
  if(EVENTS.equals(ns))action=ns+("PullMessages".equals(operation)?"/PullPointSubscription/PullMessagesRequest":"/EventPortType/"+operation+"Request");
  if("Unsubscribe".equals(operation))action=ns+"/UnsubscribeRequest";
  return action;
 }
 Document call(String address,String ns,String operation,String body)throws Exception{
  String action=actionFor(ns,operation);
  String envelope="<s:Envelope xmlns:s='http://www.w3.org/2003/05/soap-envelope' xmlns:tt='http://www.onvif.org/ver10/schema' xmlns:wsa='http://www.w3.org/2005/08/addressing'><s:Header>"+security()+"<wsa:Action>"+xml(action)+"</wsa:Action><wsa:MessageID>urn:uuid:"+UUID.randomUUID()+"</wsa:MessageID><wsa:To>"+xml(address)+"</wsa:To>"+(address.equals(subscription)?subscriptionHeaders:"")+"</s:Header><s:Body><c:"+operation+" xmlns:c='"+ns+"'>"+body+"</c:"+operation+"></s:Body></s:Envelope>";
  HttpURLConnection c=(HttpURLConnection)new URL(endpoint(address)).openConnection();
  c.setConnectTimeout(3500);c.setReadTimeout(9000);c.setInstanceFollowRedirects(false);c.setRequestMethod("POST");c.setDoOutput(true);
  c.setRequestProperty("Content-Type","application/soap+xml; charset=utf-8; action=\""+action+"\"");
  try{
   try(OutputStream out=c.getOutputStream()){out.write(envelope.getBytes(StandardCharsets.UTF_8));}
   int code=c.getResponseCode();InputStream in=code<400?c.getInputStream():c.getErrorStream();
   if(code==401||code==403)throw new IOException("Identifiants ONVIF refusés ; vérifier le compte caméra et son horloge");
   if(in==null)throw new IOException("ONVIF : HTTP "+code);
   ByteArrayOutputStream out=new ByteArrayOutputStream();try(InputStream input=in){byte[] b=new byte[4096];int n;while((n=input.read(b))!=-1){if(out.size()+n>1048576)throw new IOException("Réponse trop longue");out.write(b,0,n);}}
   Document d=parse(out.toByteArray());if(!elements(d,"Fault").isEmpty())throw new IOException("Commande non disponible : "+operation);
   if(code>=400)throw new IOException("ONVIF : HTTP "+code);return d;
  }finally{c.disconnect();}
 }
 void discover()throws Exception{
  Exception last=null;
  for(int port:new int[]{2020,80})try{
   device="http://"+host+":"+port+"/onvif/device_service";
   Document d=call(device,DEVICE,"GetServices","<c:IncludeCapability>false</c:IncludeCapability>");
   for(Element s:elements(d,"Service")){String ns=value(s,"Namespace"),url=value(s,"XAddr");if(!url.isEmpty())services.put(ns,endpoint(url));}
   last=null;break;
  }catch(Exception e){last=e;}
  if(last!=null)throw last;
  if(services.containsKey(MEDIA))profiles.addAll(elements(call(services.get(MEDIA),MEDIA,"GetProfiles",""),"Profiles"));
  if(services.containsKey(EVENTS))try{
   Document d=call(services.get(EVENTS),EVENTS,"GetEventProperties","");
   for(Element set:elements(d,"TopicSet"))collectTopics(set,"");
  }catch(Exception e){notes.add("Liste des alertes indisponible");}
 }
 private void collectTopics(Element node,String path){
  NodeList children=node.getChildNodes();for(int i=0;i<children.getLength();i++)if(children.item(i) instanceof Element){
   Element e=(Element)children.item(i);String next=path.isEmpty()?e.getLocalName():path+"/"+e.getLocalName();
   if("true".equals(e.getAttributeNS("http://docs.oasis-open.org/wsn/t-1","topic")))topics.add(next);
   collectTopics(e,next);
  }
 }
 String token(Element profile){return "<c:ProfileToken>"+xml(profile.getAttribute("token"))+"</c:ProfileToken>";}
 Document ptz(Element p,String op,String body)throws Exception{return call(services.get(PTZ),PTZ,op,token(p)+body);}
 void beginEvents()throws Exception{
  Document d=call(services.get(EVENTS),EVENTS,"CreatePullPointSubscription","<c:InitialTerminationTime>PT60S</c:InitialTerminationTime>");
  List<Element> references=elements(d,"SubscriptionReference");
  if(references.isEmpty())throw new IOException("La caméra n’a pas confirmé l’abonnement aux événements");
  subscription=endpoint(value(references.get(0),"Address"));subscriptionHeaders=referenceHeaders(references.get(0));
 }
 static String referenceHeaders(Element reference)throws Exception{
  StringBuilder headers=new StringBuilder();
  for(Element parameters:elements(reference,"ReferenceParameters")){
   NodeList children=parameters.getChildNodes();for(int i=0;i<children.getLength();i++)if(children.item(i) instanceof Element){
    Element e=(Element)children.item(i).cloneNode(true);e.setAttributeNS("http://www.w3.org/2005/08/addressing","wsa:IsReferenceParameter","true");
    java.io.StringWriter writer=new java.io.StringWriter();javax.xml.transform.Transformer transformer=javax.xml.transform.TransformerFactory.newInstance().newTransformer();
    transformer.setOutputProperty(javax.xml.transform.OutputKeys.OMIT_XML_DECLARATION,"yes");transformer.transform(new javax.xml.transform.dom.DOMSource(e),new javax.xml.transform.stream.StreamResult(writer));headers.append(writer);
   }
  }return headers.toString();
 }
 List<String> pullEvents()throws Exception{
  List<String> out=new ArrayList<>();for(CameraEvent event:readEvents())out.add(event.topic+" — "+event.detail);return out;
 }
 List<CameraEvent> readEvents()throws Exception{return CameraEvent.parse(call(subscription,EVENTS,"PullMessages","<c:Timeout>PT3S</c:Timeout><c:MessageLimit>20</c:MessageLimit>"));}
 void endEvents(){if(!subscription.isEmpty())try{call(subscription,"http://docs.oasis-open.org/wsn/bw-2/SubscriptionManager","Unsubscribe","");}catch(Exception ignored){}finally{subscription="";subscriptionHeaders="";}}
}
