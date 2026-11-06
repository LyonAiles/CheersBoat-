/* Nautic full adjustments: runs after app.js, uses Android bridge for native functions. */
(()=>{
const get=id=>document.getElementById(id), native=window.NauticAndroid;
const readSetting=(key)=>{try{
 const fromAndroid=native&&typeof native.readSetting==='function'?native.readSetting(key):'';
 if(fromAndroid)return fromAndroid;
 const old=localStorage.getItem(key)||'';
 if(old&&native&&typeof native.writeSetting==='function')native.writeSetting(key,old);
 return old;
}catch(e){try{return localStorage.getItem(key)||''}catch(_){return ''}}};
const stored=(k,d)=>{try{return Object.assign({},d,JSON.parse(readSetting(k)||'{}'))}catch(e){return {...d}}};
const state=stored('nautic-extensions',{boatPhoto:'',buttons:{},map:'osm',moveThreshold:8,stopMinutes:20,boatName:'',contacts:[],testMode:true,contactPhone:'',recentCalls:[],objectNumbers:true});
mapPitch=Math.max(0,Math.min(45,Number(state.mapPitch)||0));
// L'horloge reste affichée, indépendamment des anciens réglages de visibilité.
state.buttons.clock=true;
if(!readSetting('nautic-object-numbers-v2')){state.objectNumbers=true;try{localStorage.setItem('nautic-object-numbers-v2','1')}catch(e){}}
const plugDefaults=[{label:'Prise 1',ip:'192.168.1.102'},{label:'Prise 2',ip:'192.168.1.103'},{label:'Prise 3',ip:'192.168.1.105'}];
state.smartPlugs=plugDefaults.map((d,i)=>({...d,...(Array.isArray(state.smartPlugs)?state.smartPlugs[i]||{}:{})}));
const persist=()=>{try{
 const value=JSON.stringify(state);
 if(native&&typeof native.writeSetting==='function'){
  if(!native.writeSetting('nautic-extensions',value)||native.readSetting('nautic-extensions')!==value)throw Error('Écriture Android non confirmée');
 }
 try{localStorage.setItem('nautic-extensions',value)}catch(_){}
 return true;
}catch(e){alert('Échec de mémorisation des paramètres : '+e.message);return false}};
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const dialog=get('dialog');
const css=document.createElement('style');css.textContent=`
 dialog.nautic-full{width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;border-radius:0;display:flex;flex-direction:column}
 dialog.nautic-full:not([open]){display:none}
 dialog.nautic-full #dialogContent{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column}
 dialog.nautic-full .viewer{flex:1;min-height:20vh;height:auto}
 #nauticSettingsButton{margin-left:4px}
 #mapRecenter,#mapLayers{position:absolute;z-index:800;right:8px}
 #mapRecenter{top:88px;bottom:auto}#mapLayers{top:140px;bottom:auto}
 #windWidget{left:calc(50% + 22px)!important;top:calc(66.666667% + 28px)!important;pointer-events:none}
 #mapBoat{top:66.666667%!important;left:50%!important}
 #boatPhoto{width:100%;height:100%;object-fit:contain}
 dialog .choiceGrid{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
 dialog .choiceGrid button{flex:1 1 145px;min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere;line-height:1.25;min-height:48px;padding:9px 8px}
 dialog textarea,dialog select{width:100%;background:#09273b;color:white;border:1px solid #4a7b91;border-radius:7px;padding:8px}
 dialog textarea{min-height:110px}
 dialog .settingRow{display:grid;grid-template-columns:22px minmax(0,1fr);justify-content:start;align-items:center;gap:12px;margin:0;padding:9px 4px;min-height:44px;width:100%;text-align:left;line-height:1.25;font-size:15px} dialog .settingRow input[type=checkbox]{width:20px;height:20px;margin:0;justify-self:start;flex:none;accent-color:#31b9e9} dialog.nautic-full h3{margin:18px 0 8px;font-size:18px} dialog.nautic-full .dialogTop{flex:none;position:sticky;top:0;background:#0b293e;z-index:2;padding:4px 0 10px} dialog.nautic-full #dialogContent{padding-bottom:30px} dialog .choiceGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,145px),1fr));gap:9px} dialog .choiceGrid button{width:100%}
 .nautic-hidden{display:none!important} #nauticExitButton{flex:none;background:#77352c;border-color:#bd6c60} #nauticSettingsButton{flex:none} #recentCalls{width:100%;margin:8px 0} #recentCalls button{display:inline-flex;margin:3px 4px 3px 0;padding:8px;max-width:100%;overflow-wrap:anywhere}
 .emChoices{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,175px),1fr));gap:9px;margin:10px 0 20px}.emChoice{min-height:72px;display:flex;align-items:center;gap:9px;text-align:left;background:#103d56;padding:10px;line-height:1.2}.emChoice span{font-size:26px;flex:none}.emChoice strong{font-size:15px}.emChoice small{font-size:12px}.emChoice.active{border:2px solid #74d9f0;background:#245e75}.emPanel{padding:12px 0;border-top:1px solid #42788f}.emAction{display:block;width:100%;min-height:65px;margin:12px 0;font-size:21px;font-weight:800;background:#126b59;border:2px solid #70d6b6}.emUrgentAction{background:#b52d2d;border:2px solid #ff9b9b;color:white;font-size:23px}.emPanel #emContacts{margin-bottom:12px}

 dialog.nautic-full .nauticCameraStage{position:relative;flex:1;min-height:0;background:#000;overflow:hidden;border-radius:7px}dialog.nautic-full .nauticCameraStage .viewer{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;min-height:0;height:100%;width:100%;background:#000}dialog.nautic-full .nauticCameraStage img,dialog.nautic-full .nauticCameraStage video{width:100%;height:100%;object-fit:contain} .camOverlay{position:absolute;top:12px;right:12px;display:flex;gap:8px;z-index:5}.camOverlay button{background:#06253b99;backdrop-filter:blur(3px);min-width:44px;min-height:44px}.camMove{position:absolute;bottom:15px;left:15px;z-index:5;background:#06253b77;padding:8px;border-radius:12px;text-align:center}.camMove button{background:#092e4b99;min-width:46px;min-height:46px;margin:2px}.camMove[hidden]{display:none!important}dialog.nautic-full:has(.nauticCameraStage) .dialogTop{display:none}dialog.nautic-full:has(.nauticCameraStage) #dialogContent{padding:0;overflow:hidden} 
 .testBadge{background:#75420c;color:#fff;padding:5px;border-radius:5px;font-weight:bold}
 `;document.head.append(css);
const openModal=(title,body,full=false)=>{dialog.classList.remove('nautic-settings');dialog.querySelector('.dialogTop #settingsSave')?.remove();dialog.classList.toggle('nautic-full',full);modal(title,body)};
dialog.addEventListener('close',()=>dialog.classList.remove('nautic-full'));
function nativeCall(fn,...args){if(native&&typeof native[fn]==='function'){native[fn](...args);return true}return false}
function callNumber(n){if(!nativeCall('call',n))location.href='tel:'+n.replace(/[^+0-9]/g,'')}
function smsNumber(n,msg){if(!nativeCall('sms',n,msg))location.href='sms:'+n.replace(/[^+0-9]/g,'')+'?body='+encodeURIComponent(msg)}
const head=document.querySelector('header');const headerControls=document.createElement('div');headerControls.id='nauticHeaderControls';head.appendChild(headerControls);const settingsButton=document.createElement('button');
settingsButton.id='nauticSettingsButton';settingsButton.textContent='⚙';settingsButton.title='Paramètres';headerControls.append(settingsButton);const exitButton=document.createElement('button');exitButton.id='nauticExitButton';exitButton.textContent='Sortie';exitButton.title='Fermer Nautic';headerControls.append(exitButton);exitButton.onclick=()=>{if(!nativeCall('exitApp'))alert('La fermeture est disponible dans l’application Android.');};
window.nauticCameraAddressSync=raw=>{
 try{
  const saved=JSON.parse(raw);
  const report=get('settingNetworkReport');if(report)report.innerHTML=networkAddressReport();
  for(let i=1;i<=3;i++)if(typeof saved['cam'+i]==='string'&&saved['cam'+i])cfg['cam'+i]=saved['cam'+i];
 }catch(e){}
};
const plugsButton=document.createElement('button');plugsButton.id='nauticPlugsButton';plugsButton.textContent='🔌 Prises';plugsButton.title='Prises intelligentes';
function equipmentDialog(camera=0){
 openModal('Équipements Nautic',`<p class="muted">10 emplacements · recherche sur demande · commandes Tuya non activées</p><div id="equipmentGrid" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px"></div><button id="equipmentSearch">🔎 Rechercher les équipements</button><div id="equipmentResults" class="muted"></div>`,true);
 const grid=get('equipmentGrid');
 for(let n=0;n<10;n++){
  const b=document.createElement('button');b.style.cssText='min-height:80px;min-width:0;padding:4px;font-size:12px;overflow-wrap:anywhere';
  if(n<3){const i=n+1;b.textContent='📷 '+(state['camera'+i]?.name||'Caméra '+i);b.onclick=()=>{dialog.close();cameraDialogNative(i)}}
  else if(n<6){b.textContent='🔌 '+state.smartPlugs[n-3].label;b.onclick=()=>alert('Commande Tuya non encore opérationnelle.')}
  else{b.textContent='＋ Libre '+(n+1);b.onclick=()=>settingsDialog()}
  grid.append(b);
 }
 get('equipmentSearch').onclick=()=>scanEquipment(get('equipmentResults'),camera);
}
function scanEquipment(box,camera=0){
 box.textContent='Recherche de 32 adresses, de .101 à .132…';
 const opened=camera?nativeCall('discoverForCamera',camera):nativeCall('scanLocalDevices');
 if(!opened)box.textContent='Recherche disponible dans l’application Android.';
}
function networkAddressReport(){
 let rows=[],states={};
 try{rows=JSON.parse(readSetting('nautic-network-last')||'[]').map(ip=>({ip}))}catch(e){}
 try{states=JSON.parse(readSetting('nautic-network-status')||readSetting('nautic-network-states')||'{}')}catch(e){}
 if(!rows.length){try{rows=JSON.parse(readSetting('nautic-network-results')||'[]')}catch(e){}}
 rows.sort((a,b)=>Number(a.ip.split('.').pop())-Number(b.ip.split('.').pop()));
 return rows.length?'<p class="muted">Dernière analyse mémorisée (🔌 = réponse sans vidéo · ❔ = aucune réponse aux tests) :</p><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px">'+rows.map(d=>{
 const kind=states[d.ip]||(d.responding===false?'offline':d.rtsp?'unknown':d.responding?'unknown':'pending');
 const symbol=kind==='camera'?'📷':kind==='offline'?'❔':kind==='unknown'?'🔌':'◌';
 return '<div class="emPanel">'+symbol+' '+esc(d.ip)+'</div>';
 }).join('')+'</div>':'<p class="muted">Aucune analyse enregistrée.</p>';
}
function plugsDialog(){equipmentDialog()}
plugsButton.onclick=plugsDialog;
const mapWrap=get('mapWrap');
const recenter=document.createElement('button');recenter.id='mapRecenter';recenter.textContent='⌖';recenter.title='Recentrer';mapWrap.append(recenter);
recenter.onclick=()=>{if(map&&latest){gpsFollowTarget={...latest};smoothCenter={lat:latest.lat,lon:latest.lon};manualRotationUntil=0;userMapRotation=0;map.setView([latest.lat,latest.lon],map.getZoom());rotateMap()}};
const layers=document.createElement('button');layers.id='mapLayers';layers.textContent='▤';layers.title='Fond de carte';mapWrap.append(layers);
const layerDefs={osm:{label:'OpenStreetMap',url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',maxZoom:19,attr:'© OpenStreetMap'},topo:{label:'Topographique',url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',maxZoom:17,attr:'© OpenTopoMap'},sat:{label:'Satellite',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maxZoom:19,attr:'© Esri'},
 streets:{label:'Routière Esri',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',maxZoom:19,attr:'Tiles © Esri · HERE · Garmin · contributeurs'},
 relief:{label:'Topographique Esri',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',maxZoom:19,attr:'Tiles © Esri · contributeurs'},
 sea:{label:'OpenSeaMap — balisage',url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',maxZoom:18,attr:'© OpenStreetMap'}};
let chosenLayer=null;
function setLayer(id){if(!map||!window.L)return;layoutNavigationMap();map.invalidateSize();map.eachLayer(l=>{if(l instanceof L.TileLayer)map.removeLayer(l)});let d=layerDefs[id]||layerDefs.osm;chosenLayer=L.tileLayer(d.url,{maxZoom:d.maxZoom,attribution:d.attr}).addTo(map);if(id==='sea')L.tileLayer('https://t1.openseamap.org/seamark/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenSeaMap',zIndex:5}).addTo(map);state.map=id;persist();let foot=document.querySelector('.mapFoot');if(foot)foot.textContent='Carte '+d.label+' · suivi GPS';rotateMap()}
window.nauticRestoreLegacy=()=>setLayer(state.map);
function mapDialog(){
 openModal('Choisir la carte',`<button type="button" id="chooseVectorMap">MapLibre · vectorielle · libellés horizontaux</button><div class="choiceGrid">${Object.entries(layerDefs).map(([k,v])=>`<button data-map="${k}" aria-pressed="${state.map===k}">${v.label}</button>`).join('')}</div>
 <label>Inclinaison de la carte <output id="mapPitchValue">${mapPitch}°</output><input type="range" id="mapPitch" min="0" max="45" step="5" value="${mapPitch}"></label>
 <p class="muted">Vue en perspective. OpenSeaMap ajoute le balisage disponible. Connexion Internet nécessaire.</p>`);
 get('chooseVectorMap').onclick=()=>{state.mapEngine='vector';persist();window.nauticApplyNavigation?.(state);dialog.close();};
 dialog.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>{state.mapEngine='legacy';window.nauticApplyNavigation?.(state);setLayer(b.dataset.map);dialog.querySelectorAll('[data-map]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))});
 get('mapPitch').oninput=()=>{mapPitch=Number(get('mapPitch').value);get('mapPitchValue').textContent=mapPitch+'°';rotateMap()};
 get('mapPitch').onchange=()=>{state.mapPitch=mapPitch;persist()};
}
layers.onclick=mapDialog;
const photoFallback='bateau.jpg';
function applyPhoto(){const card=get('boatCard');if(!card)return;const src=state.boatPhoto||photoFallback;card.style.backgroundImage=`linear-gradient(0deg,rgba(3,20,32,.82),rgba(3,20,32,.20)),url("${src.replaceAll('"','%22')}")`;card.style.backgroundSize='cover';card.style.backgroundPosition='center';const sketch=card.querySelector('.boatSketch');if(sketch)sketch.style.display='none'}
applyPhoto();
window.nauticSelectedImage=data=>{if(window.nauticCameraPhotoPending){const i=window.nauticCameraPhotoPending;window.nauticCameraPhotoPending=0;state['camera'+i].image=data;persist();updateCameras();return}state.boatPhoto=data;persist();applyPhoto();boatDialog()};
function boatDialog(){openModal('Mon bateau',`<img src="${state.boatPhoto||photoFallback}" style="max-height:34vh;max-width:100%;object-fit:contain" alt="Bateau">
 <p>Kotter acier · 13,40 × 4,30 m · TE 1,35 m · TA 3,45 m</p>
 <div class="dialogActions"><button id="boatImage">Choisir une photo</button><button id="boatOpen">Ouvrir Mon bateau dans Nautic</button></div>
 <p class="muted">Le site Mon bateau s'ouvre dans une fenêtre Android intégrée, sans navigateur externe.</p>`,true);
 get('boatImage').onclick=()=>{if(!nativeCall('pickImage')){let f=document.createElement('input');f.type='file';f.accept='image/*';f.onchange=()=>{let file=f.files[0];if(!file)return;if(file.size>3000000){alert('Image trop volumineuse');return}let r=new FileReader();r.onload=()=>window.nauticSelectedImage(r.result);r.readAsDataURL(file)};f.click()}};
 get('boatOpen').onclick=()=>{if(!nativeCall('openBoat'))alert('Disponible dans l’application Android')};}
get('boatCard').onclick=()=>{if(!nativeCall('openBoat'))boatDialog()};
const contactDefaults=[
 {label:'Secours 112',phone:'112',mode:'call',type:'Urgence',icon:'🆘',urgent:true},
 {label:'SAMU 15',phone:'15',mode:'call',type:'Urgence médicale',icon:'✚',urgent:true},
 {label:'Police / gendarmerie 17',phone:'17',mode:'call',type:'Urgence de sécurité',icon:'🛡',urgent:true},
 {label:'Pompiers 18',phone:'18',mode:'call',type:'Incendie ou secours',icon:'🚒',urgent:true},
 {label:'Urgence SMS 114',phone:'114',mode:'sms',type:'Urgence — communication écrite',icon:'✉',urgent:true},
 {label:'VNF locale',phone:'',mode:'call',type:'Difficulté de navigation'},
 {label:'Mécanicien local',phone:'',mode:'call',type:'Panne mécanique'},
 {label:'Contact personnel',phone:'',mode:'call',type:'Contact personnel'}];
const testNumber='0607615420';
function contactPhone(){let n=(state.contactPhone||testNumber).replace(/[^+0-9]/g,'');return n.startsWith('0')?'+33'+n.slice(1):n}
function messageFor(c,address){const p=latest,now=new Date(),a=String(address||'Non disponible').replace(/,\\s*/g,'\\n');return [
 'URGENCE',
 'Demande d’assistance',
 '',
 'Date : '+now.toLocaleDateString('fr-FR'),
 'Heure : '+now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
 'Téléphone : '+contactPhone(),
 'Bateau : '+(state.boatName?.trim()||'voir paramètres'),
 '',
 'Adresse approximative :',
 a,
 '',
 'Localisation sur la carte :',
 p?'https://www.google.com/maps?q='+p.lat.toFixed(6)+','+p.lon.toFixed(6):'Position GPS indisponible',
 '',
 'Merci de me contacter.'
 ].join('\\n')}
async function emergencyPhoto(){const src=state.boatPhoto||photoFallback;if(src.startsWith('data:image/'))return src;const response=await fetch(src);if(!response.ok)throw Error('Photo du bateau indisponible');const blob=await response.blob();return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})}
async function shareEmergencyPhoto(number,message){try{const photo=await emergencyPhoto();if(!nativeCall('shareEmergencyPhoto',number,message,photo))throw Error('Partage photo non pris en charge par cette version Android')}catch(e){alert('Photo non jointe : '+e.message+'\\nLe message texte reste disponible.');smsNumber(number,message)}}
async function resolveEmergencyAddress(){
 const p=latest;if(!p)return 'GPS indisponible';
 try{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
  const u='https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat='+encodeURIComponent(p.lat)+'&lon='+encodeURIComponent(p.lon);
  const response=await fetch(u,{signal:controller.signal,headers:{'Accept':'application/json'}});
  clearTimeout(timer);if(!response.ok)throw Error('Adresse indisponible');
  const data=await response.json();const a=data.address||{};
  return [a.house_number,a.road||a.pedestrian||a.path,a.postcode,a.city||a.town||a.village||a.municipality].filter(Boolean).join(' ')||data.display_name||'Non disponible';
 }catch(e){return 'Non disponible (GPS indiqué ci-dessus)'}
}
window.nauticSelectedContact=number=>{let input=get('emPhone');if(input)input.value=number};
let phoneHistory=[];
window.nauticPhoneCallHistory=json=>{try{phoneHistory=JSON.parse(json).filter(c=>c.number);const box=get('recentCalls');if(box&&dialog.open)box.dispatchEvent(new Event('nautic-history-ready'))}catch(e){phoneHistory=[]}};
function emergencyDialog(mode='urgent'){
 const contacts=[...contactDefaults,...state.contacts.map(c=>({...c,mode:'call'}))];
 let selected=mode==='urgent'?0:Math.max(0,contacts.findIndex(c=>!c.urgent)),selectedRecent=null,autoMessage='';
 openModal(mode==='urgent'?'Urgences':'Derniers appels',`${mode==='urgent'?`<p class="${state.testMode?'testBadge':'muted'}">${state.testMode?'MODE TEST — aucun appel aux secours : numéro personnel uniquement':'MODE RÉEL — vérifie avant de contacter les secours'}</p>`:''}
 ${mode==='urgent'?'<h3>🚨 URGENCES</h3><div id="emUrgent" class="emChoices"></div>':''}

 ${mode==='contacts'?'<section class="emPanel"><h3>Derniers numéros</h3><div id="recentCalls" class="emChoices"></div></section>':''}
 <section class="emPanel"><h3 id="emSelected"></h3><label class="formLabel">Numéro<input id="emPhone" type="tel"></label>
 <div id="smsFields"><label class="formLabel">Message<textarea id="emText"></textarea></label>
 <label class="settingRow"><input type="checkbox" id="emAttachPhoto"><span>Joindre la photo du bateau (partage/MMS compatible)</span></label></div>
 <button id="emAction" class="emAction">📞 CONTACTER</button>
 <button id="emContacts">Choisir dans les contacts du téléphone</button></section>
 <p class="muted">Les appels ouvrent le composeur ; les messages restent à confirmer dans l'application de messagerie. Le 114 est un service d'urgence par écrit.</p>`,true);
 function draw(){
  const drawGroup=(id,items)=>{const box=get(id);box.innerHTML=items.map(([c,i])=>`<button type="button" class="emChoice ${selectedRecent===null&&selected===i?'active':''}" data-target="${i}"><span>${esc(c.icon|| (c.mode==='sms'?'✉':'☎'))}</span><strong>${esc(c.label)}</strong></button>`).join('');box.querySelectorAll('[data-target]').forEach(el=>el.onclick=()=>{selected=Number(el.dataset.target);selectedRecent=null;draw();refresh()})};
  if(mode==='urgent')drawGroup('emUrgent',contacts.map((c,i)=>[c,i]).filter(([c])=>c.urgent));

  const list=[...phoneHistory,...(Array.isArray(state.recentCalls)?state.recentCalls:[])].filter((c,i,arr)=>arr.findIndex(x=>x.number===c.number)===i).slice(0,12);
  if(mode==='contacts')get('recentCalls').innerHTML=list.length?list.map((c,i)=>`<button type="button" class="emChoice ${selectedRecent===i?'active':''}" data-recent="${i}"><span>↺</span><strong>${esc(c.label)}</strong><small>${esc(c.number)}</small></button>`).join(''):'<p class="muted">Aucun contact récent</p>';
  if(mode==='contacts')get('recentCalls').querySelectorAll('[data-recent]').forEach(el=>el.onclick=()=>{selectedRecent=Number(el.dataset.recent);draw();refresh()});
 }
 function refresh(){
  const recent=selectedRecent!==null?[...phoneHistory,...(state.recentCalls||[])].filter((c,i,arr)=>arr.findIndex(x=>x.number===c.number)===i)[selectedRecent]:null;
  const c=recent?{label:recent.label,phone:recent.number,mode:recent.mode||'call',type:recent.label}:contacts[selected];
  get('emSelected').textContent=(c.icon||'☎')+' '+c.label;
  get('emPhone').value=state.testMode?testNumber:c.phone;
  const isSms=mode==='urgent'&&c.mode==='sms';get('smsFields').hidden=!isSms;
  get('emAction').classList.toggle('emUrgentAction',!!c.urgent);
  get('emAction').textContent=isSms?'✉ PRÉPARER LE MESSAGE':'📞 '+(c.urgent?'APPELER LES SECOURS':'APPELER');
  if(isSms){autoMessage=messageFor(c,get('emText').dataset.address);get('emText').value=autoMessage;}
 }
 draw();refresh();
 if(mode==='contacts'){get('recentCalls').addEventListener('nautic-history-ready',()=>{selectedRecent=null;draw();refresh()});nativeCall('recentPhoneCalls');}
 resolveEmergencyAddress().then(address=>{const field=get('emText');if(!field)return;const previous=autoMessage;field.dataset.address=address;const c=contacts[selected];autoMessage=messageFor(c,address);if(field.value===previous)field.value=autoMessage});
 get('emAction').onclick=()=>{
  const n=get('emPhone').value.trim();if(!n){alert('Numéro manquant. Renseigne-le dans les paramètres.');return}
  const recent=selectedRecent!==null?[...phoneHistory,...(state.recentCalls||[])].filter((c,i,arr)=>arr.findIndex(x=>x.number===c.number)===i)[selectedRecent]:null;
  const c=recent?{label:recent.label,phone:recent.number,mode:recent.mode||'call',type:recent.label}:contacts[selected];
  if(!state.testMode){state.recentCalls=[{label:c.label,number:n,mode:c.mode},...(state.recentCalls||[]).filter(x=>x.number!==n)].slice(0,8);persist()}
  if(mode==='urgent'&&c.mode==='sms'){const msg=get('emText').value;if(get('emAttachPhoto').checked)shareEmergencyPhoto(n,msg);else smsNumber(n,msg)}else callNumber(n)
 };
 get('emContacts').onclick=()=>{if(!nativeCall('pickContact'))alert('Sélecteur de contacts indisponible')};
}
get('gpsCard').onclick=()=>emergencyDialog('urgent');

const contactButton=document.createElement('button');contactButton.id='nauticContactsButton';contactButton.textContent='☎ Derniers appels';contactButton.title='Contacts, assistance et derniers numéros';contactButton.onclick=()=>emergencyDialog('contacts');
const header=document.querySelector('#app header');
// Derniers appels occupe l'emplacement 35, à gauche du compteur de vitesse.
const gauges=document.querySelector('#app .gauges');
if(gauges){const slot=document.createElement('div');slot.id='nauticCallsSlot';slot.appendChild(contactButton);gauges.insertBefore(slot,gauges.firstChild);}else header.appendChild(contactButton);
function cameraDialogNative(i){
 const key='cam'+i,url=cfg[key]||'';
 openModal('Caméra '+i,`<div class="nauticCameraStage" id="cameraStage">
 <div class="viewer" id="viewer"><span id="camMessage">Caméra non connectée — adresse à configurer dans Paramètres</span><img id="cameraImg" hidden alt="Flux caméra"><video id="cameraVideo" autoplay muted playsinline hidden></video></div>
 <div class="camOverlay"><button id="camClose" aria-label="Fermer">✕</button><button id="camPTZ" title="Commandes de mouvement">✥</button><button id="camQuality" title="Résolution">HD</button><button id="camPhone" title="Caméra du téléphone">📷</button></div>
 <div class="camMove" id="camMove" hidden><button data-dir="up">▲</button><div><button data-dir="left">◀</button><button data-dir="right">▶</button></div><button data-dir="down">▼</button></div>
 </div>`,true);
 get('camClose').onclick=()=>dialog.close();
 get('camPTZ').onclick=()=>get('camMove').hidden=!get('camMove').hidden;
 get('camMove').querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>alert('Commande PTZ '+b.dataset.dir+' : configuration du protocole de la caméra nécessaire dans une prochaine version.'));
 get('camQuality').onclick=()=>alert('Résolution : réglage disponible uniquement si le flux ou le protocole de la caméra le permet.');
 get('camPhone').onclick=async()=>{try{
  cameraStream?.getTracks().forEach(t=>t.stop());
  cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  get('cameraImg').hidden=true;get('cameraVideo').hidden=false;get('cameraVideo').srcObject=cameraStream;get('camMessage').hidden=true;
 }catch(e){get('camMessage').textContent='Accès caméra : '+e.message}};
 if(url.toLowerCase().startsWith('rtsp://')){if(!nativeCall('openRtsp',url))get('camMessage').textContent='Lecteur RTSP Android indisponible';}
 else if(/^https?:\/\//i.test(url))showCamUrl(url,i);
}
for(let i=1;i<=3;i++)get('cam'+i+'Card').onclick=()=>cameraDialogNative(i);
const tapoCam=get('cam1Card');
tapoCam.querySelector('h3').innerHTML='▣ Roof — TC47 <span>⛶</span>';
get('cam1Body').innerHTML='<span>📷 Roof<br><small>Ouvrir Tapo</small></span>';
tapoCam.onclick=()=>{if(!nativeCall('openTapo'))alert('Application Tapo indisponible')};
// One journal, one recenter button; no obsolete Nautic footer control.
get('routeCard').style.display='none';get('miniMap').style.display='none';let branding=document.querySelector('.branding');if(branding)branding.style.display='none';
const footer=document.querySelector('footer');if(footer)footer.style.display='none';
function applyVisibility(){const ids=['nauticSettingsButton','nauticExitButton','nauticPlugsButton','nauticContactsButton','nauticCallsSlot','mapWrap','gpsCard','boatCard','fuelCard','logCard','cam1Card','cam2Card','cam3Card','speedCard','headingCard','weatherCard'];for(const id of ids){const e=get(id);if(!e)continue;const hidden=state.buttons[id]===false;e.classList.toggle('nautic-hidden',hidden);e.hidden=hidden;e.setAttribute('aria-hidden',hidden?'true':'false')}if(map)setTimeout(()=>map.invalidateSize(),80)}

const cameraDefaults=[
 {name:'Roof',app:'tapo',package:'com.tplink.iot',scheme:'',image:''},
 {name:'Côté',app:'stream',package:'',scheme:'',image:''},
 {name:'Fond',app:'stream',package:'',scheme:'',image:''}
];
for(let i=1;i<=3;i++)state['camera'+i]=Object.assign({},cameraDefaults[i-1],state['camera'+i]||{});
function updateCameras(){
 for(let i=1;i<=3;i++){
  const c=state['camera'+i],card=get('cam'+i+'Card'),body=get('cam'+i+'Body');
  if(!card||!body)continue;
  card.querySelector('h3').innerHTML='▣ '+esc(c.name||'Caméra '+i)+' <span>⛶</span>';
  body.innerHTML='<span>📷 '+esc(c.name||'Caméra '+i)+'</span>';
  body.style.backgroundImage=c.image?'linear-gradient(#001b2a33,#001b2a55),url("'+c.image.replaceAll('"','%22')+'")':'';
  body.style.backgroundSize='cover';body.style.backgroundPosition='center';
  card.oncontextmenu=e=>{e.preventDefault();equipmentDialog(i)};
  card.onclick=()=>{
   const address=(cfg['cam'+i]||(i===1?'rtsp://192.168.1.101:554/stream1':'')).trim();
   if(/^rtsp:\/\//i.test(address)){if(!nativeCall('openRtspForCamera',address,i))nativeCall('openRtsp',address);}
   else if(c.app==='other'&&c.package.trim())nativeCall('openCameraApp',c.package.trim(),c.scheme);
   else if(!nativeCall('discoverForCamera',i))equipmentDialog(i);
  };
 }
 window.nauticBindCamera42?.();
}
updateCameras();
const appearanceDefaults={theme:'nautic',background:'gradient',buttons:'rounded',labels:'both',scale:100,accent:'#31b9e9',panel:'#09283e',layout:'navigation',order:[]};
state.appearance=Object.assign({},appearanceDefaults,state.appearance||{});
const movableIds=['gpsCard','boatCard','fuelCard','logCard','speedCard','headingCard','weatherCard','cam1Card','cam2Card','cam3Card'];
const themeColors={nautic:['#31b9e9','#09283e'],day:['#176a9d','#dbeaf0'],night:['#d75a5a','#241719'],contrast:['#ffff00','#000000']};
const appearanceCSS=document.createElement('style');
appearanceCSS.textContent=`
:root{--nautic-accent:#31b9e9;--nautic-panel:#09283e;--nautic-radius:12px;--nautic-scale:1}
#app .card,#app .camCard,#app .gauge,#app .route,#app .miniMap{background:var(--nautic-panel);border-color:var(--nautic-accent);border-radius:var(--nautic-radius)}
#app .card h3,#app .camCard h3{color:var(--nautic-accent)}
#app button{border-radius:var(--nautic-radius)}
#app{font-size:calc(14px * var(--nautic-scale))}
#app.nautic-bg-flat{background:var(--nautic-panel)}
#app.nautic-bg-clear .card,#app.nautic-bg-clear .camCard,#app.nautic-bg-clear .gauge{background:color-mix(in srgb,var(--nautic-panel) 58%,transparent)}
#app.nautic-btn-flat button{box-shadow:none;border-radius:0}
#app.nautic-btn-round button{border-radius:30px}
#app.nautic-btn-outline button{background:transparent;border:2px solid var(--nautic-accent)}
#app.nautic-layout-manoeuvres .layout{grid-template-columns:minmax(145px,16%) minmax(0,1fr) minmax(260px,33%)}
#app.nautic-layout-manoeuvres .center{grid-template-rows:minmax(0,1fr) 110px}
#app.nautic-layout-manoeuvres .camCard{flex:1}
#app.nautic-layout-custom .left,#app.nautic-layout-custom .right{overflow-y:auto}
#app.nautic-layout-custom .card,#app.nautic-layout-custom .camCard{flex:0 0 auto;min-height:90px}
#app.nautic-edit .card,#app.nautic-edit .camCard,#app.nautic-edit .gauge{outline:2px dashed var(--nautic-accent);touch-action:none;cursor:grab}
#app.nautic-edit .nautic-dragging{opacity:.45}
@media(orientation:portrait){
 #app .left,#app .right{display:flex;flex-direction:row;align-items:stretch;justify-content:center;gap:6px}
 #app .left>.card{flex:0 1 calc((100% - 18px)/4);min-width:0}
 #app .right>.camCard{flex:0 1 calc((100% - 12px)/3);min-width:0}
}
#app .gauges{display:flex;align-items:stretch;justify-content:center;gap:6px}
#app .gauges>.gauge{flex:0 1 calc((100% - 12px)/3);min-width:0}\n#app.nautic-edit,#app.nautic-edit *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}\n#app.nautic-edit .card *,#app.nautic-edit .camCard *,#app.nautic-edit .gauge *{pointer-events:none!important}
#nauticEditBanner{position:fixed;z-index:900;top:50%;left:50%;transform:translate(-50%,-50%);background:#16445b;border:2px solid #f4ce56;border-radius:10px;padding:8px 12px;color:white}
#nauticEditBanner button{margin-left:10px;background:#1c7b61}
#dialog.nautic-settings .dialogTop{position:sticky;top:0;z-index:12;background:#082438}
#dialog.nautic-settings #settingsSave{background:#235f4b;border:2px solid #6ad7a8;min-width:110px;font-weight:bold}
#dialog.nautic-settings #settingsSave.nautic-dirty{background:#b46515;border-color:#ffd47b}
#dialog.nautic-settings #dialogContent{overflow-y:auto}
#dialog .nautic-select{display:block;width:100%;padding:8px;background:#09273b;color:white;border:1px solid #4a7b91;border-radius:7px;margin:5px 0 12px}
#dialog .nautic-colors{display:flex;gap:12px;flex-wrap:wrap}
#dialog .nautic-colors label{display:flex;flex-direction:column;gap:5px}
#dialog .nautic-colors input{width:72px;height:40px;padding:2px}
#nauticContactsButton{font-size:clamp(10px,1.5vw,14px);white-space:nowrap;padding:6px 9px}
dialog.nautic-full #dialogContent .emChoices{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:6px}
dialog.nautic-full #dialogContent .emChoice{min-height:48px}
dialog.nautic-full #dialogContent .emPanel{margin:4px 0;padding:5px}
dialog.nautic-full #dialogContent h3{margin:7px 0 4px}
#boatCard h3,#boatCard p{position:relative;text-shadow:0 1px 4px #000,0 1px 9px #000;background:transparent!important}
@media(orientation:portrait){#nauticContactsButton{padding:5px 6px;font-size:10px}dialog.nautic-full #dialogContent .emChoices{grid-template-columns:repeat(auto-fit,minmax(95px,1fr))}}
`;
document.head.appendChild(appearanceCSS);
function applyAppearance(){
 const a=state.appearance,app=get('app');
 if(!app)return;
 document.documentElement.style.setProperty('--nautic-accent',a.accent);
 document.documentElement.style.setProperty('--nautic-panel',a.panel);
 document.documentElement.style.setProperty('--nautic-radius',a.buttons==='square'?'0px':a.buttons==='round'?'30px':'12px');
 document.documentElement.style.setProperty('--nautic-scale',String((Number(a.scale)||100)/100));
 app.classList.remove('nautic-bg-flat','nautic-bg-clear','nautic-btn-flat','nautic-btn-round','nautic-btn-outline','nautic-layout-manoeuvres','nautic-layout-custom');
 if(a.background==='flat')app.classList.add('nautic-bg-flat');
 if(a.background==='clear')app.classList.add('nautic-bg-clear');
 if(a.buttons==='square')app.classList.add('nautic-btn-flat');
 if(a.buttons==='round')app.classList.add('nautic-btn-round');
 if(a.buttons==='outline')app.classList.add('nautic-btn-outline');
 if(a.layout==='manoeuvres')app.classList.add('nautic-layout-manoeuvres');
 if(a.layout==='custom')app.classList.add('nautic-layout-custom');
 if(Array.isArray(a.order)&&a.order.length){
  for(const id of a.order){const el=get(id);if(el&&el.parentElement)el.parentElement.appendChild(el)}
 }
 window.nauticArrangeDashboard?.();
 if(map)setTimeout(()=>map.invalidateSize(),120);
}
let editingLayout=false,dragging=null;
function stopLayoutEdit(){
 editingLayout=false;get('app').classList.remove('nautic-edit');
 get('nauticEditBanner')?.remove();dragging=null;
 state.appearance.order=[...document.querySelectorAll('.left > [id],.right > [id],.gauges > [id]')].map(e=>e.id).filter(id=>movableIds.includes(id));
 persist();
}
function beginLayoutEdit(){
 if(editingLayout)return;
 editingLayout=true;get('app').classList.add('nautic-edit');
 const banner=document.createElement('div');banner.id='nauticEditBanner';banner.innerHTML='Disposition : glisser les panneaux <button id="nauticEditDone">✓ Terminer</button>';
 document.body.appendChild(banner);get('nauticEditDone').onclick=stopLayoutEdit;
}
document.addEventListener('contextmenu',e=>{if(editingLayout&&get('app').contains(e.target))e.preventDefault()},true);
document.addEventListener('selectstart',e=>{if(editingLayout&&get('app').contains(e.target))e.preventDefault()},true);
for(const id of movableIds){
 const el=get(id);if(!el)continue;
 el.addEventListener('pointerdown',e=>{
  if(!editingLayout||e.button!==0)return;
  dragging={el,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY};
  el.classList.add('nautic-dragging');
  e.preventDefault();
 });
 el.addEventListener('click',e=>{if(editingLayout){e.stopImmediatePropagation();e.preventDefault()}},true);
}
document.addEventListener('pointermove',e=>{
 if(!editingLayout||!dragging||e.pointerId!==dragging.pointerId)return;
 dragging.x=e.clientX;dragging.y=e.clientY;
 e.preventDefault();
},{passive:false});
document.addEventListener('pointerup',e=>{
 if(!dragging||e.pointerId!==dragging.pointerId)return;
 const {el,x,y,startX,startY}=dragging;
 el.classList.remove('nautic-dragging');
 dragging=null;
 if(!editingLayout||Math.hypot(x-startX,y-startY)<12)return;
 const parent=el.parentElement;
 const candidates=[...parent.children].filter(node=>node!==el&&movableIds.includes(node.id)&&!node.hidden);
 const target=candidates.find(node=>{const r=node.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;});
 if(target){
  // Échanger les positions sans perdre le suivi tactile lors d'un déplacement DOM.
  const all=[...parent.children],from=all.indexOf(el),to=all.indexOf(target);
  all.splice(from,1);all.splice(to,0,el);
  all.forEach(node=>parent.appendChild(node));
  state.appearance.order=[...document.querySelectorAll('.left > [id],.right > [id],.gauges > [id]')].map(node=>node.id).filter(id=>movableIds.includes(id));
  persist();
 }
});
document.addEventListener('pointercancel',()=>{if(dragging){dragging.el.classList.remove('nautic-dragging');dragging=null}});

applyAppearance();

function settingsDialog(){let buttons=[['nauticSettingsButton','20 · Paramètres'],['nauticExitButton','21 · Sortie'],['nauticPlugsButton','22 · Prises'],['nauticCallsSlot','35 · Conteneur Derniers appels'],['gpsCard','31 · Position GPS / urgences'],['boatCard','32 · Mon bateau'],['fuelCard','34 · Carburant'],['logCard','33 · Journal'],['cam1Card','41 · Caméra Roof'],['cam2Card','42 · Caméra Côté'],['cam3Card','43 · Caméra Fond'],['speedCard','36 · Vitesse'],['headingCard','38 · Cap'],['weatherCard','37 · Météo'],['mapWrap','40 · Carte']];
 openModal('Paramètres',`<h3>Repérage des objets</h3><label class="settingRow"><input type="checkbox" id="settingObjectNumbers" ${state.objectNumbers?'checked':''}><span>Afficher les numéros temporaires des objets</span></label><p class="muted">Les petits numéros restent attachés à leur objet. Le 35 peut être masqué dans Tableau de bord.</p><p id="nauticNumberDirectory" class="muted" style="font-size:11px;line-height:1.6"></p><p class="muted">Nautic accepte le redimensionnement Android. Le mode fenêtre flottante dépend du téléphone.</p><h3>Apparence et disposition</h3>
 <label>Modèle de présentation<select class="nautic-select" id="settingLayout"><option value="navigation">Navigation</option><option value="manoeuvres">Manœuvres — caméras agrandies</option><option value="custom">Personnalisé</option></select></label>
 <button type="button" id="settingArrange">↔ Déplacer les panneaux</button>
 <label>Thème<select class="nautic-select" id="settingTheme"><option value="nautic">Nautic bleu</option><option value="day">Jour clair</option><option value="night">Nuit rouge</option><option value="contrast">Contraste élevé</option><option value="custom">Couleurs personnalisées</option></select></label>
 <div class="nautic-colors"><label>Couleur principale<input type="color" id="settingAccent" value="${esc(state.appearance.accent)}"></label><label>Fond des panneaux<input type="color" id="settingPanel" value="${esc(state.appearance.panel)}"></label></div>
 <label>Fond<select class="nautic-select" id="settingBackground"><option value="gradient">Dégradé</option><option value="flat">Uni</option><option value="clear">Panneaux translucides</option></select></label>
 <label>Forme des boutons<select class="nautic-select" id="settingButtons"><option value="rounded">Arrondis</option><option value="square">Carrés / plats</option><option value="round">Très arrondis</option><option value="outline">Contours seuls</option></select></label>
 <label>Taille générale : <output id="settingScaleValue">${state.appearance.scale}%</output><input type="range" id="settingScale" min="80" max="130" step="5" value="${state.appearance.scale}"></label>
 <h3>Tableau de bord</h3>${buttons.map(([id,label])=>`<label class="settingRow"><input type="checkbox" data-button="${id}" ${state.buttons[id]===false?'':'checked'}><span>${label}</span></label>`).join('')}
 <h3>Navigation</h3>${field('Seuil de déplacement confirmé (m)','settingMove',state.moveThreshold,'number')}${field('Arrêt prolongé (minutes)','settingStop',state.stopMinutes,'number')}
 <h3>Carte et ouvrages fluviaux</h3>
 <label>Moteur de carte<select class="nautic-select" id="settingMapEngine"><option value="vector" ${(state.mapEngine||'vector')==='vector'?'selected':''}>MapLibre · libellés horizontaux</option><option value="legacy" ${state.mapEngine==='legacy'?'selected':''}>Carte classique · retour arrière</option></select></label>
 <p class="muted">MapLibre utilise le fond vectoriel OpenFreeMap. Si le chargement ou WebGL échoue, retour automatique à la carte classique. Les réglages classiques sont conservés.</p>
 <label class="settingRow"><input type="checkbox" id="settingWaterwayWorks" ${state.waterwayWorks===false?'':'checked'}><span>Afficher les ouvrages fluviaux OpenStreetMap</span></label>
 <label>Périmètre de recherche<select class="nautic-select" id="settingWaterwayRadius">${[2000,5000,10000].map(r=>`<option value="${r}" ${(Number(state.waterwayRadius)||5000)===r?'selected':''}>${r/1000} km</option>`).join('')}</select></label>
 <p class="muted">Écluses, ponts, barrages, seuils et tunnels selon les données disponibles. Actualisation après progression ; cache local. Les distances par le réseau ne désignent pas un itinéraire choisi : bifurcations à confirmer. Sans raccordement, distance à vol d’oiseau explicitement indiquée.</p>
 <h3>Bateau</h3>${field('Nom du bateau','settingBoat',state.boatName)}${field('Téléphone de rappel (inclus dans les SMS)','settingContactPhone',state.contactPhone||testNumber,'tel')}
 <p>Carburant estimé consommé : <b>${(typeof fuelUsed==='number'?fuelUsed:0).toFixed(2)} L</b>. La consommation d'un arrêt de moins de ${state.stopMinutes} minutes est ajoutée à la reprise ; après ce délai elle est annulée.</p>
 <h3>Urgences</h3><p class="${state.testMode?'testBadge':'muted'}">${state.testMode?'Mode TEST actif':'Mode RÉEL actif'}</p>
 <button id="toggleEmergency">Basculer TEST / RÉEL (code)</button>
 <p class="muted">Mode TEST : tous les appels et SMS vers ${testNumber}. Mode réel : coordonnées vérifiées uniquement.</p>
 <h3>Analyse du réseau local</h3><button type="button" id="settingPlugsButton">🔌 Prises</button><button type="button" id="settingDiscoverDevices">🔎 Analyser le réseau Wi-Fi</button><div id="settingNetworkReport">${networkAddressReport()}</div><div id="settingDiscoverResults" class="muted">Aucune adresse ne sera remplacée sans validation.</div><h3>Prises intelligentes — libellés et adresses</h3>
 ${state.smartPlugs.map((p,i)=>`<section class="emPanel"><h3>Prise ${i+1}</h3>${field('Libellé','settingPlug'+i+'Label',p.label)}${field('Adresse IP locale','settingPlug'+i+'Ip',p.ip)}</section>`).join('')}
 <p class="muted">Ces paramètres préparent la connexion locale Tuya. Les interrupteurs ne seront activés qu'après validation du protocole de commande.</p>
 <h3>Caméras — réglages indépendants</h3>
 <p class="muted">Appui de plus d’une seconde pour zoomer sur un point, puis simple toucher pour revenir. Double-touche une vidéo pour la relancer. Pince pour zoomer, puis glisse pour déplacer l’image. En paysage, touche le médaillon pour inverser les vues.</p>
 ${[1,2,3].map(i=>`<section class="emPanel"><h3>Caméra ${i}</h3>
 ${field('Nom du panneau','settingCam'+i+'Name',state['camera'+i].name)}
 <label>Application<select class="nautic-select" id="settingCam${i}App"><option value="tapo">Tapo</option><option value="stream">Flux réseau</option><option value="other">Autre application Android</option></select></label>
 ${field('Paquet Android','settingCam'+i+'Package',state['camera'+i].package)}
 ${field('Lien profond (facultatif)','settingCam'+i+'Scheme',state['camera'+i].scheme)}
 ${field('Adresse RTSP / MJPEG / HTTP','settingCam'+i,cfg['cam'+i])}
 <button type="button" id="settingCam${i}Credentials">Identifiants locaux RTSP</button>
 <button type="button" id="settingCam${i}Photo">🖼 Image du panneau</button>
 <button type="button" id="settingCam${i}Scan">🔎 Tester les activités Android</button>
 <div id="settingCam${i}ScanResults" class="muted"></div>
 </section>`).join('')}

 <h3>Liaison avec une jumelle distante</h3><button type="button" id="settingRemoteTwin">Configurer / activer la liaison</button><p class="muted">Module préparatoire : appareil à bord et appareil distant, relais HTTPS à configurer. États et dernières alertes uniquement.</p>
 <h3>Alertes des caméras</h3><p class="muted">Choisis les types reçus pour chaque veille. Active ou arrête ensuite la veille depuis son bouton sur l’accueil. Seuls les événements transmis par la caméra peuvent déclencher une alerte.</p>
 ${[['44','Trématage · caméra mobile'],['42','Caméra '+esc(state.camera2.name)]].map(([id,name])=>`<section class="emPanel"><h3>${name}</h3><label>Son d’alerte<select class="nautic-select" data-alert-sound="${id}">${[['ding','Ding'],['dingding','Ding-ding'],['bell','Cloche'],['warning','Warning'],['horn','Klaxon du bateau'],['silent','Silencieux']].map(([value,label])=>`<option value="${value}" ${(state.alertSounds?.[id]??(id==='42'?'ding':'horn'))===value?'selected':''}>${label}</option>`).join('')}</select></label><button type="button" data-preview-sound="${id}">▶ Écouter</button>${[['vehicle','Véhicule'],['person','Personne'],['motion','Mouvement général']].map(([type,label])=>`<label class="settingRow"><input type="checkbox" data-alert-watch="${id}" data-alert-type="${type}" ${(state.alertTypes?.[id]?.[type]??(type==='vehicle'))?'checked':''}><span>${label}</span></label>`).join('')}</section>`).join('')}
 <p class="muted">Mouvement général peut aussi signaler des remous ou de la végétation. Aucun type coché : aucune alerte pour cette veille.</p>
 <h3>Contacts locaux et personnels</h3><p class="muted">Une ligne par contact : nom ; numéro ; motif. Contacts personnels : appels téléphoniques uniquement.</p>
 <textarea id="contactList">${esc(state.contacts.map(c=>[c.label,c.phone,c.type].join(' ; ')).join('\n'))}</textarea>
 <div class="dialogActions"><button id="settingsMaps">Choisir les cartes</button><button id="settingsReset">Rétablir les boutons</button></div>`,true);
 dialog.classList.add('nautic-settings');
 const content=get('dialogContent');let group=null;
 for(const node of [...content.children]){
  if(node.tagName==='H3'){
   const details=document.createElement('details');details.className='nautic-settings-group';
   const summary=document.createElement('summary');summary.textContent=node.textContent;details.appendChild(summary);content.insertBefore(details,node);node.remove();group=details;
  }else if(group&&!node.classList.contains('dialogActions'))group.appendChild(node);
 }
 for(const panel of [...content.querySelectorAll('.emPanel')]){
  const heading=panel.querySelector('h3');if(!heading)continue;
  const details=document.createElement('details');details.className='nautic-settings-subgroup';const summary=document.createElement('summary');summary.textContent=heading.textContent;details.appendChild(summary);heading.remove();while(panel.firstChild)details.appendChild(panel.firstChild);panel.replaceWith(details);
 }

 dialog.querySelectorAll('[data-preview-sound]').forEach(button=>{button.onclick=()=>nativeCall('previewAlertSound',dialog.querySelector('[data-alert-sound="'+button.dataset.previewSound+'"]').value);});
 get('settingObjectNumbers').onchange=e=>{state.objectNumbers=e.target.checked;persist();applyObjectNumbers();};
 applyObjectNumbers();

 get('settingRemoteTwin').onclick=()=>nativeCall('openRemoteTwin');
 get('settingPlugsButton').onclick=()=>equipmentDialog();
 get('settingDiscoverDevices').onclick=()=>scanEquipment(get('settingDiscoverResults'));
 get('settingNetworkReport').innerHTML=networkAddressReport();
 const top=dialog.querySelector('.dialogTop');
 const saveButton=document.createElement('button');saveButton.id='settingsSave';saveButton.textContent='✓ Enregistré';saveButton.disabled=true;
 top.insertBefore(saveButton,get('dialogClose'));
 for(let i=1;i<=3;i++){
  get('settingCam'+i+'App').value=state['camera'+i].app;
  get('settingCam'+i+'Credentials').onclick=()=>nativeCall('configureRtsp',i);
  get('settingCam'+i+'Photo').onclick=()=>{window.nauticCameraPhotoPending=i;nativeCall('pickImage')};
  get('settingCam'+i+'Scan').onclick=()=>{
   const pkg=get('settingCam'+i+'Package').value.trim()||(get('settingCam'+i+'App').value==='tapo'?'com.tplink.iot':'');
   const box=get('settingCam'+i+'ScanResults');box.textContent='Recherche des activités accessibles…';
   window.nauticCameraActivities=json=>{
    let rows=[];try{rows=JSON.parse(json)}catch(e){}
    box.replaceChildren();
    if(!rows.length){box.textContent='Aucune activité accessible détectée.';return}
    rows.forEach(a=>{const btn=document.createElement('button');btn.type='button';btn.style.cssText='display:block;width:100%;margin:5px 0;white-space:normal;overflow-wrap:anywhere;text-align:left';btn.textContent=(a.label||'Activité')+' — '+a.name;btn.onclick=()=>nativeCall('launchCameraActivity',pkg,a.name);box.append(btn)});
   };
   if(!nativeCall('cameraActivities',pkg))box.textContent='Diagnostic disponible dans la nouvelle APK Android.';
  };
 }
 const a=state.appearance;
 for(const [id,value] of [['settingLayout',a.layout],['settingTheme',a.theme],['settingBackground',a.background],['settingButtons',a.buttons]])get(id).value=value;
 const markDirty=()=>{saveButton.disabled=false;saveButton.textContent='● Enregistrer';saveButton.classList.add('nautic-dirty')};
 dialog.querySelectorAll('#dialogContent input,#dialogContent select,#dialogContent textarea').forEach(el=>{el.addEventListener('input',markDirty);el.addEventListener('change',markDirty)});
 get('settingScale').addEventListener('input',e=>get('settingScaleValue').textContent=e.target.value+'%');
 get('settingTheme').addEventListener('change',()=>{
  const t=get('settingTheme').value,colors=themeColors[t];
  if(colors){get('settingAccent').value=colors[0];get('settingPanel').value=colors[1]}
 });
 get('settingAccent').addEventListener('input',()=>{get('settingTheme').value='custom'});
 get('settingPanel').addEventListener('input',()=>{get('settingTheme').value='custom'});
 get('settingArrange').onclick=()=>{
  get('settingLayout').value='custom';
  saveButton.disabled=false;
  saveButton.click();
  beginLayoutEdit();
 };
 get('dialogClose').addEventListener('click',()=>dialog.classList.remove('nautic-settings'),{once:true});
 get('toggleEmergency').onclick=()=>{let pass=prompt('Code pour changer de mode :');if(pass==='xxx'){state.testMode=!state.testMode;persist();settingsDialog()}else if(pass!==null)alert('Code incorrect')};
 get('settingsSave').onclick=()=>{
  const previous=JSON.stringify(state), previousCfg=JSON.stringify(cfg);
  dialog.querySelectorAll('[data-button]').forEach(e=>state.buttons[e.dataset.button]=e.checked);
  state.mapEngine=get('settingMapEngine').value;
  state.waterwayWorks=get('settingWaterwayWorks').checked;
  state.waterwayRadius=Number(get('settingWaterwayRadius').value);
  state.alertSounds={};dialog.querySelectorAll('[data-alert-sound]').forEach(e=>{state.alertSounds[e.dataset.alertSound]=e.value;});
  state.alertTypes={};
  dialog.querySelectorAll('[data-alert-watch]').forEach(e=>{const id=e.dataset.alertWatch;if(!state.alertTypes[id])state.alertTypes[id]={};state.alertTypes[id][e.dataset.alertType]=e.checked;});
  state.moveThreshold=Math.max(3,Number(get('settingMove').value)||8);
  state.stopMinutes=Math.max(1,Number(get('settingStop').value)||20);
  state.boatName=get('settingBoat').value.trim();
  state.smartPlugs=state.smartPlugs.map((p,i)=>({...p,label:get('settingPlug'+i+'Label').value.trim()||'Prise '+(i+1),ip:get('settingPlug'+i+'Ip').value.trim()}));
  state.contactPhone=get('settingContactPhone').value.trim();
  state.contacts=get('contactList').value.split('\n').map(x=>x.split(';').map(v=>v.trim())).filter(a=>a.length>=2&&a[0]).map(a=>({label:a[0],phone:a[1],type:a[2]||'Assistance',mode:'call'}));
  for(let i=1;i<=3;i++)cfg['cam'+i]=get('settingCam'+i).value.trim();
  for(let i=1;i<=3;i++)state['camera'+i]={...state['camera'+i],name:get('settingCam'+i+'Name').value.trim()||'Caméra '+i,app:get('settingCam'+i+'App').value,package:get('settingCam'+i+'Package').value.trim(),scheme:get('settingCam'+i+'Scheme').value.trim()};
  state.appearance={...state.appearance,
   layout:get('settingLayout').value,theme:get('settingTheme').value,
   accent:get('settingAccent').value,panel:get('settingPanel').value,
   background:get('settingBackground').value,buttons:get('settingButtons').value,
   scale:Number(get('settingScale').value)};
  if(!persist()){Object.assign(state,JSON.parse(previous));Object.assign(cfg,JSON.parse(previousCfg));return}
  try{
    saveCfg();
    const saved=JSON.parse(readSetting(KEY)||'{}');
    if([1,2,3].some(i=>saved['cam'+i]!==cfg['cam'+i]))throw Error('Caméras non conservées');
  }catch(e){
    Object.assign(cfg,JSON.parse(previousCfg));
    alert('Échec de sauvegarde des caméras : '+e.message);
    return;
  }
  applyVisibility();applyAppearance();updateCameras();window.nauticApplyNavigation?.(state);
  dialog.classList.remove('nautic-settings');
  dialog.close();
 };

 get('settingsMaps').onclick=mapDialog;get('settingsReset').onclick=()=>{state.buttons={};persist();applyVisibility();settingsDialog()};
}
get('weatherCard').onclick=weatherDialog;
// Horloge explicite : les anciens styles cachaient les éléments <time>.
// Horloge déplacée hors du header, où des règles historiques se contredisent.
const fixedClock=document.getElementById('clock');
if(fixedClock){document.body.appendChild(fixedClock);fixedClock.hidden=false;fixedClock.removeAttribute('aria-hidden');}
const clockElement=document.getElementById('clock');
if(clockElement){clockElement.hidden=false;clockElement.classList.remove('nautic-hidden');clockElement.removeAttribute('aria-hidden');}
if(clockElement){clockElement.textContent=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});setInterval(()=>{clockElement.textContent=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})},10000);}
if(clockElement){
 clockElement.style.setProperty('display','block','important');
 clockElement.style.setProperty('visibility','visible','important');
 clockElement.style.setProperty('opacity','1','important');
 clockElement.style.setProperty('z-index','999','important');
 clockElement.style.setProperty('color','#fff','important');
}
const brand=document.querySelector('header .brand');
if(brand){
 const version=document.createElement('small');
 version.id='nauticVersion';
 version.style.cssText='margin-left:7px;font-size:11px;font-weight:400;opacity:.72;white-space:nowrap';
 version.textContent='v'+(native&&typeof native.versionName==='function'?native.versionName():'?');
 brand.appendChild(version);
}
function applyObjectNumbers(){
 if(window.nauticNumberDashboard){window.nauticNumberDashboard();return;}
 document.querySelectorAll('.nautic-object-tag').forEach(e=>e.remove());
 if(!state.objectNumbers)return;
 const named=[['clock',10,'Horloge'],['nauticSettingsButton',20,'Paramètres'],['nauticExitButton',21,'Sortie'],['gpsCard',31,'GPS'],['boatCard',32,'Mon bateau'],['logCard',33,'Journal'],['fuelCard',34,'Carburant'],['nauticCallsSlot',35,'Conteneur appels'],['speedCard',36,'Vitesse'],['weatherCard',37,'Météo'],['headingCard',38,'Cap'],['mapWrap',40,'Carte'],['cam1Card',41,'Caméra Roof'],['cam2Card',42,'Caméra Côté'],['cam3Card',43,'Caméra Fond']];
 const used=new Set(named.map(x=>x[0]));
 // Les commandes et les objets possédant un identifiant conservent un numéro stable.
 const extras=[...document.querySelectorAll('#app [id]')].filter(e=>!used.has(e.id)&&!e.closest('dialog')&&!e.closest('.leaflet-container')&&(/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.tagName)||e.classList.contains('mapWidget')));
 extras.forEach((el,i)=>named.push([el.id,String(50+i),el.title||el.textContent.trim().slice(0,35)||el.id]));
 const summary=get('nauticNumberDirectory');
 if(summary)summary.textContent=named.map(([id,n,label])=>n+' · '+label).join('  |  ');
 named.forEach(([id,num])=>{const el=get(id);if(!el||el.hidden||el.closest('[hidden]'))return;
  if(getComputedStyle(el).position==='static')el.style.position='relative';
  const tag=document.createElement('span');tag.className='nautic-object-tag';tag.textContent=num;
  tag.style.cssText='position:absolute;top:1px;left:1px;z-index:500;background:#ffe24b;color:#111;font:bold 10px Arial;border-radius:3px;padding:1px 3px;pointer-events:none';
  el.appendChild(tag);
 });

}

applyObjectNumbers();
settingsButton.onclick=settingsDialog;applyVisibility();
setTimeout(()=>{if(map)setLayer(state.map)},1000);
})();

/* Contacts : noms et numéros lisibles, sans colonnes étroites. */
(function(){const style=document.createElement('style');style.textContent=`
#dialog #recentCalls{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:7px}
#dialog #recentCalls .emChoice{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;min-width:0;min-height:56px;height:auto;padding:8px 12px;gap:2px;text-align:left}
#dialog #recentCalls .emChoice>span{display:none}
#dialog #recentCalls .emChoice strong{display:block;max-width:100%;font-size:clamp(13px,1.4vw,19px);line-height:1.15;overflow-wrap:anywhere;word-break:normal;white-space:normal}
#dialog #recentCalls .emChoice small{display:block;max-width:100%;font-size:clamp(11px,1.1vw,15px);line-height:1.2;overflow-wrap:anywhere;white-space:normal}
@media(orientation:portrait){#dialog #recentCalls{grid-template-columns:repeat(2,minmax(0,1fr))}#dialog #recentCalls .emChoice{padding:6px;min-height:58px}}
`;document.head.appendChild(style)})();
