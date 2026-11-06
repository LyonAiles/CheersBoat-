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
 interface Work{void run()throws Exception;}
 CameraControls(Activity activity,String host,String user,String password){
  this.activity=activity;camera=new OnvifCamera(host,user,password);
  content=new LinearLayout(activity);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(20,10,20,10);
  state=new TextView(activity);state.setPadding(8,8,8,8);state.setText("Recherche des fonctions locales…");content.addView(state);
 }
 void show(){
  ScrollView scroll=new ScrollView(activity);scroll.addView(content);
  dialog=new AlertDialog.Builder(activity).setTitle("Objectif 2 — commandes et alertes").setView(scroll).setNegativeButton("Fermer",null).create();
  dialog.setOnDismissListener(d->close());dialog.show();
  task(()->{camera.discover();ui(()->profiles());},"Fonctions détectées");
 }
 private void ui(Runnable r){activity.runOnUiThread(()->{if(!closed&&!activity.isFinishing())r.run();});}
 private void task(Work work,String success){
  if(closed)return;
  commands.execute(()->{try{work.run();ui(()->state.setText(success));}catch(Exception e){ui(()->state.setText(e.getMessage()==null?"Commande indisponible":e.getMessage()));}});
 }
 private TextView text(String message){TextView t=new TextView(activity);t.setText(message);t.setPadding(8,10,8,10);content.addView(t);return t;}
 private Button button(String label,Work work){Button b=new Button(activity);b.setText(label);content.addView(b);b.setOnClickListener(v->task(work,"Commande effectuée"));return b;}
 private void profiles(){
  if(camera.profiles.isEmpty()){text("Aucun profil vidéo ONVIF disponible.");return;}
  text("Choisir le profil de l’objectif mobile si plusieurs profils sont proposés.");
  Spinner selector=new Spinner(activity);List<String> names=new ArrayList<>();int choice=0;
  for(int i=0;i<camera.profiles.size();i++){
   Element p=camera.profiles.get(i);boolean ptz=!OnvifCamera.elements(p,"PTZConfiguration").isEmpty();
   names.add(OnvifCamera.value(p,"Name")+" · "+p.getAttribute("token")+(ptz?" · motorisé":""));if(ptz)choice=i;
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
  Button mute=new Button(activity);mute.setText("Son de l’objectif mobile : activer / couper");target.addView(mute);
  mute.setOnClickListener(v->{if(activity instanceof CameraActivity)((CameraActivity)activity).toggleMobileAudio();});
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
   Button watch=new Button(activity);watch.setText("Écouter les alertes locales");target.addView(watch);
   TextView log=new TextView(activity);log.setText("Écoute active uniquement pendant l’ouverture de ce panneau. Une alerte de mouvement ne signifie pas qu’un bateau approche.");target.addView(log);
   watch.setOnClickListener(v->{
    if(listening){listening=false;watch.setEnabled(false);watch.setText("Arrêt de l’écoute…");return;}
    listening=true;watch.setText("Arrêter l’écoute");
    events.execute(()->{
     try{
      camera.beginEvents();long renewed=System.currentTimeMillis();
      while(listening&&!closed){
       if(System.currentTimeMillis()-renewed>40000){camera.endEvents();camera.beginEvents();renewed=System.currentTimeMillis();}
       for(String message:camera.pullEvents()){
        String stamp=new java.text.SimpleDateFormat("HH:mm:ss",Locale.FRANCE).format(new Date());
        eventLog=stamp+" · "+message+"\n"+eventLog;if(eventLog.length()>6000)eventLog=eventLog.substring(0,6000);
        final String display=eventLog;ui(()->log.setText(display));
       }
      }
     }catch(Exception e){ui(()->log.setText("Écoute interrompue : "+e.getMessage()));}
     finally{camera.endEvents();listening=false;ui(()->{watch.setEnabled(true);watch.setText("Écouter les alertes locales");});}
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
     add(target,"Positions mémorisées",()->showPresets(p));
     add(target,"Mémoriser la position actuelle",()->ui(()->savePreset(p)));
    }
   });
  },"Commandes disponibles affichées");
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
 private void savePreset(Element p){
  EditText name=new EditText(activity);name.setSingleLine(true);name.setHint("Ex. Veille arrière");
  new AlertDialog.Builder(activity).setTitle("Nouvelle position").setView(name).setPositiveButton("Mémoriser",(d,w)->{
   String n=name.getText().toString().trim();if(!n.isEmpty())task(()->camera.ptz(p,"SetPreset","<c:PresetName>"+OnvifCamera.xml(n)+"</c:PresetName>"),"Position mémorisée");
  }).setNegativeButton("Annuler",null).show();
 }
 private void imageSettings(String ns,String token,Document current,Document options){
  LinearLayout form=new LinearLayout(activity);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(20,8,20,8);
  Map<String,EditText> fields=new LinkedHashMap<>();Map<String,float[]> ranges=new LinkedHashMap<>();
  String[] keys={"Brightness","Contrast","ColorSaturation","Sharpness"};String[] labels={"Luminosité","Contraste","Saturation","Netteté"};
  for(int i=0;i<keys.length;i++)try{
   String key=keys[i];List<Element> bounds=OnvifCamera.elements(options,key);if(bounds.isEmpty())continue;
   float min=Float.parseFloat(OnvifCamera.value(bounds.get(0),"Min")),max=Float.parseFloat(OnvifCamera.value(bounds.get(0),"Max"));
   ranges.put(key,new float[]{min,max});TextView label=new TextView(activity);label.setText(labels[i]+" ("+min+" à "+max+")");form.addView(label);
   EditText field=new EditText(activity);field.setInputType(android.text.InputType.TYPE_CLASS_NUMBER|android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL|android.text.InputType.TYPE_NUMBER_FLAG_SIGNED);field.setText(OnvifCamera.value(current,key));form.addView(field);fields.put(key,field);
  }catch(Exception ignored){}
  if(fields.isEmpty()){state.setText("Aucun réglage d’image modifiable annoncé");return;}
  AlertDialog edit=new AlertDialog.Builder(activity).setTitle("Image — profil sélectionné").setView(form).setPositiveButton("Appliquer",null).setNegativeButton("Annuler",null).create();edit.show();
  edit.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
   StringBuilder settings=new StringBuilder();
   for(String key:fields.keySet())try{
    float value=Float.parseFloat(fields.get(key).getText().toString().replace(',','.'));float[] range=ranges.get(key);
    if(Float.isNaN(value)||Float.isInfinite(value)||value<range[0]||value>range[1])throw new IllegalArgumentException();
    settings.append("<tt:").append(key).append(">").append(value).append("</tt:").append(key).append(">");
   }catch(Exception e){fields.get(key).setError("Valeur hors de la plage autorisée");return;}
   edit.dismiss();task(()->camera.call(camera.services.get(ns),ns,"SetImagingSettings",token+"<c:ImagingSettings>"+settings+"</c:ImagingSettings><c:ForcePersistence>true</c:ForcePersistence>"),"Image mise à jour");
  });
 }
 void close(){if(closed)return;closed=true;listening=false;commands.shutdownNow();events.shutdownNow();if(dialog!=null&&dialog.isShowing())dialog.dismiss();}
}
