package fr.nautic.test;

import android.app.*;
import android.graphics.Color;
import android.view.*;
import android.widget.*;
import java.util.*;
import java.util.concurrent.*;
import org.w3c.dom.*;

/** Controls for the second (motorised) lens. Network work never blocks the video/UI. */
final class CameraControls {
 private final Activity activity;
 private final OnvifCamera camera;
 private final ExecutorService commands=Executors.newSingleThreadExecutor();
 private final ExecutorService events=Executors.newSingleThreadExecutor();
 private final LinearLayout content;
 private final TextView state;
 private AlertDialog dialog;
 private volatile boolean closed=false,listening=false;
 private Element selected;
 private String eventLog="";
 private volatile String receptionReport="Aucun test de réception effectué dans ce panneau.";
 private final int cameraIndex;
 interface Work{void run()throws Exception;}
 CameraControls(Activity activity,String host,String user,String password,int cameraIndex){
  this.activity=activity;camera=new OnvifCamera(host,user,password);
  this.cameraIndex=cameraIndex;
  content=new LinearLayout(activity);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(20,10,20,10);
  state=new TextView(activity);state.setPadding(8,8,8,8);state.setText("Recherche des fonctions locales…");content.addView(state);
 }
 void show(){
  ScrollView scroll=new ScrollView(activity);scroll.addView(content);
  dialog=new AlertDialog.Builder(activity).setTitle("Outils caméra").setView(scroll).setNegativeButton("Fermer",null).create();
  dialog.setOnDismissListener(d->close());dialog.show();
  if(activity instanceof CameraActivity)((CameraActivity)activity).addPlaybackControls(content);
  task(()->{camera.discover();ui(()->profiles());},"Fonctions détectées");
 }
 private void ui(Runnable r){activity.runOnUiThread(()->{if(!closed&&!activity.isFinishing())r.run();});}
 private void task(Work work,String success){
  if(closed)return;
  commands.execute(()->{try{work.run();ui(()->state.setText(success));}catch(Exception e){ui(()->state.setText(e.getMessage()==null?"Commande indisponible":e.getMessage()));}});
 }
 private TextView text(String message){TextView t=new TextView(activity);t.setText(message);t.setPadding(8,10,8,10);content.addView(t);return t;}
 private void profiles(){
  if(camera.profiles.isEmpty()){text("Aucun profil vidéo ONVIF disponible.");return;}
  text("Profil ONVIF de la caméra");
  Spinner selector=new Spinner(activity);List<String> names=new ArrayList<>();int choice=0;
  for(int i=0;i<camera.profiles.size();i++){
   Element p=camera.profiles.get(i);boolean ptz=!OnvifCamera.elements(p,"PTZConfiguration").isEmpty();
   List<Element> encoders=OnvifCamera.elements(p,"VideoEncoderConfiguration");
   String resolution="";
   if(!encoders.isEmpty()){
    String width=OnvifCamera.value(encoders.get(0),"Width"),height=OnvifCamera.value(encoders.get(0),"Height");
    if(!width.isEmpty()&&!height.isEmpty())resolution=" · "+width+" × "+height;
   }
   names.add(OnvifCamera.value(p,"Name")+" · "+p.getAttribute("token")+resolution+(ptz?" · motorisé":""));if(ptz)choice=i;
  }
  selector.setAdapter(new ArrayAdapter<>(activity,android.R.layout.simple_spinner_dropdown_item,names));content.addView(selector);
  selector.setSelection(choice);
  selector.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){
   public void onNothingSelected(android.widget.AdapterView<?> a){}
   public void onItemSelected(android.widget.AdapterView<?> a,View v,int i,long id){selected=camera.profiles.get(i);loadProfile();}
  });
 }
 private LinearLayout profileControls;
 private void loadProfile(){
  if(profileControls!=null)content.removeView(profileControls);
  profileControls=new LinearLayout(activity);profileControls.setOrientation(LinearLayout.VERTICAL);content.addView(profileControls);
  final Element p=selected;final LinearLayout target=profileControls;
  StringBuilder inventory=new StringBuilder("Services annoncés :\n");
  for(String ns:camera.services.keySet())inventory.append(ns.substring(ns.lastIndexOf('/')+1)).append("\n");
  inventory.append("\nAlertes annoncées :\n");for(String topic:camera.topics)inventory.append(topic).append("\n");
  if(camera.topics.isEmpty())inventory.append("Aucune liste reçue.\n");
  for(String note:camera.notes)inventory.append(note).append("\n");
  inventory.append("\nLes réglages propres à Tapo (IA, suivi automatique, sirène, confidentialité…) ne sont pas garantis par ONVIF.");
  Button report=new Button(activity);report.setText("Inventaire des fonctions et alertes");target.addView(report);
  report.setOnClickListener(v->new AlertDialog.Builder(activity).setTitle("Fonctions de cette caméra").setMessage(inventory.toString()).setPositiveButton("Fermer",null).show());
  String imaging="http://www.onvif.org/ver20/imaging/wsdl";
  if(camera.services.containsKey(imaging)&&!OnvifCamera.elements(p,"VideoSourceConfiguration").isEmpty()){
   String source=OnvifCamera.value(OnvifCamera.elements(p,"VideoSourceConfiguration").get(0),"SourceToken");
   add(target,"Réglages de l’image",()->{
    String token="<c:VideoSourceToken>"+OnvifCamera.xml(source)+"</c:VideoSourceToken>";
    Document current=camera.call(camera.services.get(imaging),imaging,"GetImagingSettings",token);
    Document options=camera.call(camera.services.get(imaging),imaging,"GetOptions",token);
    ui(()->imageSettings(imaging,token,current,options));
   });
  }
  if(camera.services.containsKey(OnvifCamera.EVENTS)){
   Button watch=new Button(activity);watch.setText("Tester la réception réelle (30 s)");target.addView(watch);
   TextView log=new TextView(activity);log.setText("Ce test ne déplace pas la caméra. Passer devant elle après le début de l’écoute. Une réponse sans événement ne valide pas la détection.");target.addView(log);
   Button copy=new Button(activity);copy.setText("Copier le diagnostic de réception");target.addView(copy);
   copy.setOnClickListener(v->{android.content.ClipboardManager clipboard=(android.content.ClipboardManager)activity.getSystemService(android.content.Context.CLIPBOARD_SERVICE);clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Diagnostic caméra",receptionReport));state.setText("Diagnostic copié");});
   watch.setOnClickListener(v->{
    if(listening){listening=false;watch.setEnabled(false);watch.setText("Arrêt du test…");return;}
    listening=true;watch.setText("Arrêter le test");eventLog="";
    receptionReport="Caméra "+camera.host+"\nConnexion à l’abonnement ONVIF…";log.setText(receptionReport);
    events.execute(()->{
     int polls=0,messages=0,active=0,initialActive=0;java.util.Set<String> categories=new java.util.LinkedHashSet<>();String failure="";
     String started=new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss",Locale.FRANCE).format(new Date());
     try{
      camera.beginEvents();long deadline=System.nanoTime()+30000000000L;
      while(listening&&!closed&&!Thread.currentThread().isInterrupted()&&System.nanoTime()<deadline){
       java.util.List<CameraEvent> received=camera.readEvents();polls++;messages+=received.size();
       for(CameraEvent event:received){
        if(event.active){categories.add(event.category);if(event.initial)initialActive++;else active++;}
        String stamp=new java.text.SimpleDateFormat("HH:mm:ss",Locale.FRANCE).format(new Date());
        eventLog=stamp+" · "+event.category+" · "+(event.initial?(event.active?"ÉTAT INITIAL ACTIF":"état initial inactif"):event.active?"ACTIF":"inactif/non reconnu")+"\n"+event.topic+" — "+event.source+" — "+event.detail+" — UTC caméra="+event.utcTime+"\n"+eventLog;
        if(eventLog.length()>8000)eventLog=eventLog.substring(0,8000);
       }
       receptionReport="Caméra "+camera.host+" · test "+started+"\nAbonnement confirmé · réponses reçues : "+polls+"\nÉvénements reçus : "+messages+" · actifs hors initialisation : "+active+" · états initiaux actifs : "+initialActive+"\nCatégories signalées actives : "+(categories.isEmpty()?"aucune":categories.toString())+"\n\n"+eventLog;
       final String display=receptionReport;ui(()->log.setText(display));Thread.sleep(250);
      }
     }catch(Exception e){failure=e.getMessage()==null?e.getClass().getSimpleName():e.getMessage();}
     finally{
      camera.endEvents();listening=false;
      String conclusion=!failure.isEmpty()?"ÉCHEC : "+failure:active>0?"RÉCEPTION VALIDÉE pour : "+categories:initialActive>0?"RÉCEPTION VALIDÉE : états initiaux actifs "+categories+". Présence signalée ; nouvelle apparition non démontrée.":messages>0?"Événements reçus, mais aucune activation de détection confirmée.":"Aucun événement reçu : détection NON VALIDÉE.";
      receptionReport=conclusion+"\n"+receptionReport;final String display=receptionReport;
      activity.getSharedPreferences("nautic_trematage",Activity.MODE_PRIVATE).edit().putString("lastReceptionTest",display).apply();
      ui(()->{log.setText(display);watch.setEnabled(true);watch.setText("Recommencer le test (30 s)");});
     }
    });
   });
  }
  if(!camera.services.containsKey(OnvifCamera.PTZ)||OnvifCamera.elements(p,"PTZConfiguration").isEmpty()){
   TextView no=new TextView(activity);no.setText("Aucune motorisation annoncée pour ce profil.");target.addView(no);return;
  }
  task(()->{
   Element config=OnvifCamera.elements(p,"PTZConfiguration").get(0);
   Document nodes=camera.call(camera.services.get(OnvifCamera.PTZ),OnvifCamera.PTZ,"GetNode","<c:NodeToken>"+OnvifCamera.xml(OnvifCamera.value(config,"NodeToken"))+"</c:NodeToken>");
   boolean pan=!OnvifCamera.elements(nodes,"ContinuousPanTiltVelocitySpace").isEmpty();
   boolean zoom=!OnvifCamera.elements(nodes,"ContinuousZoomVelocitySpace").isEmpty();
   boolean home="true".equals(OnvifCamera.value(nodes,"HomeSupported"));
   int count=0;try{count=Integer.parseInt(OnvifCamera.value(nodes,"MaximumNumberOfPresets"));}catch(Exception ignored){}
   final int presets=count;
   ui(()->{if(selected!=p||profileControls!=target)return;
    if(pan){moveButton(target,p,"← Gauche",-.35,0,0);moveButton(target,p,"Droite →",.35,0,0);moveButton(target,p,"↑ Haut",0,.35,0);moveButton(target,p,"↓ Bas",0,-.35,0);}
    if(zoom){moveButton(target,p,"Zoom +",0,0,.3);moveButton(target,p,"Zoom −",0,0,-.3);}
    add(target,"Arrêter le mouvement",()->camera.ptz(p,"Stop","<c:PanTilt>true</c:PanTilt><c:Zoom>true</c:Zoom>"));
    if(home)add(target,"Position d’origine",()->camera.ptz(p,"GotoHomePosition",""));
    add(target,"Lire la position",()->{Document d=camera.ptz(p,"GetStatus","");String position=OnvifCamera.value(d,"MoveStatus");for(Element e:OnvifCamera.elements(d,"PanTilt"))position+=" x="+e.getAttribute("x")+" y="+e.getAttribute("y");final String info=position;ui(()->new AlertDialog.Builder(activity).setTitle("Position de l’objectif").setMessage(info.isEmpty()?"Position non fournie":info).setPositiveButton("Fermer",null).show());});
    if(presets>0){
     trematage(target,p);
     add(target,"Positions mémorisées",()->showPresets(p));

    }
   });
  },"Commandes disponibles affichées");
 }
 private void trematage(LinearLayout target,Element p){
  android.content.SharedPreferences prefs=activity.getSharedPreferences("nautic_trematage",Activity.MODE_PRIVATE);
  String key=camera.host+"|"+p.getAttribute("token");
  TrematageSession.Store store=new TrematageSession.Store(){
   public String backup(){return prefs.getString(key+".return","");}
   public boolean armed(){return prefs.getBoolean(key+".active",false);}
   public void save(String backup,boolean armed)throws Exception{if(!prefs.edit().putString(key+".return",backup).putBoolean(key+".active",armed).commit())throw new java.io.IOException("Sauvegarde de la position de retour impossible");}
  };
  TrematageSession session=new TrematageSession(camera,p,store);
  Runnable bindShortcut=()->prefs.edit().putInt("shortcutIndex",cameraIndex).putString("shortcutProfile",p.getAttribute("token")).putString("shortcutKey",key).apply();
  add(target,"Associer la position Trématage existante",()->{session.remember();bindShortcut.run();});
  Button repair=new Button(activity);repair.setText("Restaurer le nom BASE (ancien Nautic retour…)");target.addView(repair);
  repair.setOnClickListener(v->{repair.setEnabled(false);state.setText("Rappel de l’ancienne position et vérification…");task(()->{try{session.restoreBaseName();TrematageService.stop(activity,key);ui(()->new AlertDialog.Builder(activity).setTitle("BASE").setMessage("Le nom BASE et sa position ont été vérifiés.").setPositiveButton("Fermer",null).show());}finally{ui(()->repair.setEnabled(true));}},"BASE vérifiée");});
  Button toggle=new Button(activity);target.addView(toggle);
  Runnable refresh=()->toggle.setText(store.armed()?"Désactiver Trématage · BASE":"Activer Trématage");refresh.run();
  toggle.setOnClickListener(v->{
   toggle.setEnabled(false);
   task(()->{
    try{
     if(store.armed()){
      session.deactivate();TrematageService.stop(activity,key);
     }else{
      String other=prefs.getString("watchKey","");if(!other.isEmpty()&&!TrematageProfiles.sameCamera(other,key)&&prefs.getBoolean(other+".active",false))throw new java.io.IOException("Une position de retour est conservée sur une autre caméra ; revenir depuis ses commandes");
      session.activate();bindShortcut.run();TrematageService.start(activity,camera.host,cameraIndex,key);TrematageFeedback.activated(activity);
     }
    }finally{ui(()->{toggle.setEnabled(true);refresh.run();});}
   },"Commande Trématage effectuée");
  });
  add(target,"Reprendre l’écoute Trématage",()->{
   if(!store.armed())throw new java.io.IOException("Activer d’abord Trématage");
   TrematageService.start(activity,camera.host,cameraIndex,key);
  });
  add(target,"État et dernière alerte Trématage",()->ui(()->new AlertDialog.Builder(activity).setTitle("Trématage — test").setMessage((store.armed()?"Position de retour conservée\n":"Mode désactivé\n")+prefs.getString("watchStatus","Écoute non démarrée")+"\n\n"+prefs.getString("lastAlert","Aucune alerte reçue")+"\n\nDernier signal brut :\n"+prefs.getString("lastRawEvent","Aucun")+"\n\nLa catégorie et l’objectif source dépendent des informations transmises par la caméra.").setPositiveButton("Fermer",null).show()));
 }
 private void add(LinearLayout target,String label,Work work){Button b=new Button(activity);b.setText(label);target.addView(b);b.setOnClickListener(v->task(work,"Commande effectuée"));}
 private void moveButton(LinearLayout target,Element p,String label,double x,double y,double z){
  add(target,label,()->{
   String velocity=z==0?"<tt:PanTilt x='"+x+"' y='"+y+"'/>":"<tt:Zoom x='"+z+"'/>";
   camera.ptz(p,"ContinuousMove","<c:Velocity>"+velocity+"</c:Velocity><c:Timeout>PT0.4S</c:Timeout>");
   // A camera-side timeout bounds movement even if Wi-Fi is interrupted before Stop.
   Thread.sleep(400);
   camera.ptz(p,"Stop",z==0?"<c:PanTilt>true</c:PanTilt>":"<c:Zoom>true</c:Zoom>");
  });
 }
 private void showPresets(Element p)throws Exception{
  List<Element> presets=OnvifCamera.elements(camera.ptz(p,"GetPresets",""),"Preset");
  String[] names=new String[presets.size()];for(int i=0;i<names.length;i++)names[i]=OnvifCamera.value(presets.get(i),"Name");
  ui(()->{if(names.length==0){state.setText("Aucune position mémorisée");return;}
   new AlertDialog.Builder(activity).setTitle("Aller à une position").setItems(names,(d,i)->task(()->camera.ptz(p,"GotoPreset","<c:PresetToken>"+OnvifCamera.xml(presets.get(i).getAttribute("token"))+"</c:PresetToken>"),"Position rappelée")).setNegativeButton("Annuler",null).show();
  });
 }
 private interface ImageField {String change();}
 private void formLabel(LinearLayout form,String title){
  TextView label=new TextView(activity);label.setText(title);label.setPadding(0,12,0,2);form.addView(label);
 }
 private static Element child(Element parent,String name){
  if(parent==null)return null;
  for(Node node=parent.getFirstChild();node!=null;node=node.getNextSibling()){
   if(node instanceof Element&&name.equals(node.getLocalName()))return (Element)node;
  }
  return null;
 }
 private static String childValue(Element parent,String name){
  Element item=child(parent,name);return item==null?"":item.getTextContent().trim();
 }
 private void numberField(LinearLayout form,List<ImageField> fields,Element options,Element current,String key,String label){
  Element bounds=child(options,key);
  if(bounds==null)return;
  String initial=childValue(current,key);
  if(initial.isEmpty())return;
  final float min,max;
  try{
   min=Float.parseFloat(childValue(bounds,"Min"));max=Float.parseFloat(childValue(bounds,"Max"));
   if(Float.isNaN(min)||Float.isInfinite(min)||Float.isNaN(max)||Float.isInfinite(max)||min>max)return;
  }catch(NumberFormatException ignored){return;}
  formLabel(form,label+" ("+min+" à "+max+")");
  EditText value=new EditText(activity);
  value.setInputType(android.text.InputType.TYPE_CLASS_NUMBER|android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL|android.text.InputType.TYPE_NUMBER_FLAG_SIGNED);
  value.setText(initial);form.addView(value);
  fields.add(()->{
   String entered=value.getText().toString().trim().replace(',','.');
   if(entered.equals(initial))return "";
   try{
    float number=Float.parseFloat(entered);
    if(Float.isNaN(number)||Float.isInfinite(number)||number<min||number>max)throw new NumberFormatException();
    return "<tt:"+key+">"+number+"</tt:"+key+">";
   }catch(NumberFormatException e){value.setError("Valeur hors plage");return null;}
  });
 }
 private void modeField(LinearLayout form,List<ImageField> fields,Element options,Element current,
                        String group,String key,String title,String[] values,String[] labels){
  Element scope=group.isEmpty()?options:child(options,group);
  if(scope==null)return;
  Set<String> offered=new LinkedHashSet<>();
  for(Node node=scope.getFirstChild();node!=null;node=node.getNextSibling()){
   if(node instanceof Element&&key.equals(node.getLocalName()))offered.add(node.getTextContent().trim());
  }
  List<String> codes=new ArrayList<>(),names=new ArrayList<>();
  codes.add("");names.add("Conserver le réglage actuel");
  for(int i=0;i<values.length;i++)if(offered.contains(values[i])){codes.add(values[i]);names.add(labels[i]);}
  if(codes.size()==1)return;
  String initial=childValue(group.isEmpty()?current:child(current,group),key);
  formLabel(form,title);
  Spinner spinner=new Spinner(activity);
  spinner.setAdapter(new ArrayAdapter<>(activity,android.R.layout.simple_spinner_dropdown_item,names));
  form.addView(spinner);spinner.setSelection(Math.max(0,codes.indexOf(initial)));
  fields.add(()->{
   int i=spinner.getSelectedItemPosition();
   if(i<=0||initial.equals(codes.get(i)))return "";
   String setting="<tt:"+key+">"+codes.get(i)+"</tt:"+key+">";
   return group.isEmpty()?setting:"<tt:"+group+">"+setting+"</tt:"+group+">";
  });
 }
 private void imageSettings(String ns,String token,Document current,Document options){
  LinearLayout form=new LinearLayout(activity);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(20,8,20,8);
  List<Element> optionList=OnvifCamera.elements(options,"ImagingOptions");
  List<Element> currentList=OnvifCamera.elements(current,"ImagingSettings");
  Element limits=optionList.isEmpty()?null:optionList.get(0), settings=currentList.isEmpty()?null:currentList.get(0);
  List<ImageField> fields=new ArrayList<>();
  String[] onOff={"ON","OFF"}, enabled={"Activé","Désactivé"};
  String[] autoManual={"AUTO","MANUAL"}, automatic={"Automatique","Manuel"};
  // Emit fields in the ONVIF ImagingSettings20 schema order.
  modeField(form,fields,limits,settings,"BacklightCompensation","Mode","Compensation du contre-jour",onOff,enabled);
  numberField(form,fields,limits,settings,"Brightness","Luminosité");
  numberField(form,fields,limits,settings,"ColorSaturation","Saturation");
  numberField(form,fields,limits,settings,"Contrast","Contraste");
  modeField(form,fields,limits,settings,"Exposure","Mode","Exposition",autoManual,automatic);
  modeField(form,fields,limits,settings,"Focus","AutoFocusMode","Mise au point",autoManual,automatic);
  modeField(form,fields,limits,settings,"","IrCutFilter","Jour / nuit · filtre infrarouge",
   new String[]{"AUTO","ON","OFF"},new String[]{"Automatique","Jour","Nuit"});
  numberField(form,fields,limits,settings,"Sharpness","Netteté");
  modeField(form,fields,limits,settings,"WideDynamicRange","Mode","Plage dynamique (WDR)",onOff,enabled);
  modeField(form,fields,limits,settings,"WhiteBalance","Mode","Balance des blancs",autoManual,automatic);
  if(fields.isEmpty()){state.setText("Aucun réglage d’image modifiable annoncé");return;}
  ScrollView scroll=new ScrollView(activity);scroll.addView(form);
  AlertDialog edit=new AlertDialog.Builder(activity).setTitle("Image — profil sélectionné").setView(scroll).setPositiveButton("Appliquer",null).setNegativeButton("Annuler",null).create();edit.show();
  edit.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
   StringBuilder changes=new StringBuilder();
   for(ImageField field:fields){String change=field.change();if(change==null)return;changes.append(change);}
   if(changes.length()==0){edit.dismiss();return;}
   Button apply=edit.getButton(AlertDialog.BUTTON_POSITIVE);apply.setEnabled(false);
   task(()->{
    try{
     camera.call(camera.services.get(ns),ns,"SetImagingSettings",token+"<c:ImagingSettings>"+changes+"</c:ImagingSettings><c:ForcePersistence>true</c:ForcePersistence>");
     ui(edit::dismiss);
    }catch(Exception e){
     ui(()->{apply.setEnabled(true);new AlertDialog.Builder(activity).setMessage(e.getMessage()==null?"Réglage refusé par la caméra":e.getMessage()).setPositiveButton("Fermer",null).show();});
     throw e;
    }
   },"Image mise à jour");
  });
 }
 void close(){if(closed)return;closed=true;listening=false;commands.shutdownNow();events.shutdownNow();if(dialog!=null&&dialog.isShowing())dialog.dismiss();}
}
