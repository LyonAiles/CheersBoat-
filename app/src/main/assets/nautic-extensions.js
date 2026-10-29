/* Nautic full adjustments: runs after app.js, uses Android bridge for native functions. */
(()=>{
const get=id=>document.getElementById(id), native=window.NauticAndroid;
const stored=(k,d)=>{try{return Object.assign({},d,JSON.parse(localStorage.getItem(k)||'{}'))}catch(e){return {...d}}};
const state=stored('nautic-extensions',{boatPhoto:'',buttons:{},map:'osm',moveThreshold:8,stopMinutes:20,boatName:'Kotter',contacts:[],testMode:true,contactPhone:'',recentCalls:[]});
const persist=()=>{try{localStorage.setItem('nautic-extensions',JSON.stringify(state))}catch(e){alert('Stockage local indisponible : paramètres non enregistrés')}};
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
 #windWidget{left:calc(50% + 22px)!important;top:calc(50% + 28px)!important;pointer-events:none}
 #boatPhoto{width:100%;height:100%;object-fit:contain}
 dialog .choiceGrid{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
 dialog .choiceGrid button{flex:1 1 145px;min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere;line-height:1.25;min-height:48px;padding:9px 8px}
 dialog textarea,dialog select{width:100%;background:#09273b;color:white;border:1px solid #4a7b91;border-radius:7px;padding:8px}
 dialog textarea{min-height:110px}
 dialog .settingRow{display:grid;grid-template-columns:22px minmax(0,1fr);justify-content:start;align-items:center;gap:12px;margin:0;padding:9px 4px;min-height:44px;width:100%;text-align:left;line-height:1.25;font-size:15px} dialog .settingRow input[type=checkbox]{width:20px;height:20px;margin:0;justify-self:start;flex:none;accent-color:#31b9e9} dialog.nautic-full h3{margin:18px 0 8px;font-size:18px} dialog.nautic-full .dialogTop{flex:none;position:sticky;top:0;background:#0b293e;z-index:2;padding:4px 0 10px} dialog.nautic-full #dialogContent{padding-bottom:30px} dialog .choiceGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,145px),1fr));gap:9px} dialog .choiceGrid button{width:100%}
 .nautic-hidden{display:none!important} #nauticExitButton{flex:none;background:#77352c;border-color:#bd6c60} #nauticSettingsButton{flex:none} #recentCalls{width:100%;margin:8px 0} #recentCalls button{display:inline-flex;margin:3px 4px 3px 0;padding:8px;max-width:100%;overflow-wrap:anywhere} .testBadge{background:#75420c;color:#fff;padding:5px;border-radius:5px;font-weight:bold}
 `;document.head.append(css);
const openModal=(title,body,full=false)=>{dialog.classList.toggle('nautic-full',full);modal(title,body)};
dialog.addEventListener('close',()=>dialog.classList.remove('nautic-full'));
function nativeCall(fn,...args){if(native&&typeof native[fn]==='function'){native[fn](...args);return true}return false}
function callNumber(n){if(!nativeCall('call',n))location.href='tel:'+n.replace(/[^+0-9]/g,'')}
function smsNumber(n,msg){if(!nativeCall('sms',n,msg))location.href='sms:'+n.replace(/[^+0-9]/g,'')+'?body='+encodeURIComponent(msg)}
const head=document.querySelector('header');const settingsButton=document.createElement('button');
settingsButton.id='nauticSettingsButton';settingsButton.textContent='⚙';settingsButton.title='Paramètres';head.append(settingsButton);const exitButton=document.createElement('button');exitButton.id='nauticExitButton';exitButton.textContent='Quitter';exitButton.title='Fermer Nautic';head.append(exitButton);exitButton.onclick=()=>{if(!confirm('Quitter Nautic ? Le suivi GPS et le journal seront interrompus.'))return;if(!nativeCall('exitApp'))alert('La fermeture est disponible dans l’application Android.');};
const mapWrap=get('mapWrap');
const recenter=document.createElement('button');recenter.id='mapRecenter';recenter.textContent='⌖';recenter.title='Recentrer';mapWrap.append(recenter);
recenter.onclick=()=>{if(map&&latest){gpsFollowTarget={...latest};smoothCenter={lat:latest.lat,lon:latest.lon};map.setView([latest.lat,latest.lon],map.getZoom())}};
const layers=document.createElement('button');layers.id='mapLayers';layers.textContent='▤';layers.title='Fond de carte';mapWrap.append(layers);
const layerDefs={osm:{label:'OpenStreetMap',url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',maxZoom:19,attr:'© OpenStreetMap'},topo:{label:'Topographique',url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',maxZoom:17,attr:'© OpenTopoMap'},sat:{label:'Satellite',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maxZoom:19,attr:'© Esri'}};
let chosenLayer=null;
function setLayer(id){if(!map||!window.L)return;map.eachLayer(l=>{if(l instanceof L.TileLayer)map.removeLayer(l)});let d=layerDefs[id]||layerDefs.osm;chosenLayer=L.tileLayer(d.url,{maxZoom:d.maxZoom,attribution:d.attr}).addTo(map);state.map=id;persist();let foot=document.querySelector('.mapFoot');if(foot)foot.textContent='Carte '+d.label+' · suivi GPS'}
function mapDialog(){openModal('Choisir la carte',`<div class="choiceGrid">${Object.entries(layerDefs).map(([k,v])=>`<button data-map="${k}">${v.label}</button>`).join('')}</div><p class="muted">Conservation du zoom et du centrage. Ces fonds nécessitent une connexion Internet.</p>`);dialog.querySelectorAll('[data-map]').forEach(b=>b.onclick=()=>{setLayer(b.dataset.map);dialog.close()})}
layers.onclick=mapDialog;
const photoFallback='bateau.jpg';
function applyPhoto(){const sketch=document.querySelector('#boatCard .boatSketch');if(sketch)sketch.innerHTML=`<img id="boatPhoto" src="${state.boatPhoto||photoFallback}" alt="Photographie du bateau">`}
applyPhoto();
window.nauticSelectedImage=data=>{state.boatPhoto=data;persist();applyPhoto();boatDialog()};
function boatDialog(){openModal('Mon bateau',`<img src="${state.boatPhoto||photoFallback}" style="max-height:34vh;max-width:100%;object-fit:contain" alt="Bateau">
 <p>Kotter acier · 13,40 × 4,30 m · TE 1,35 m · TA 3,45 m</p>
 <div class="dialogActions"><button id="boatImage">Choisir une photo</button><button id="boatOpen">Ouvrir Mon bateau dans Nautic</button></div>
 <p class="muted">Le site Mon bateau s'ouvre dans une fenêtre Android intégrée, sans navigateur externe.</p>`,true);
 get('boatImage').onclick=()=>{if(!nativeCall('pickImage')){let f=document.createElement('input');f.type='file';f.accept='image/*';f.onchange=()=>{let file=f.files[0];if(!file)return;if(file.size>3000000){alert('Image trop volumineuse');return}let r=new FileReader();r.onload=()=>window.nauticSelectedImage(r.result);r.readAsDataURL(file)};f.click()}};
 get('boatOpen').onclick=()=>{if(!nativeCall('openBoat'))alert('Disponible dans l’application Android')};}
get('boatCard').onclick=boatDialog;
const contactDefaults=[
 {label:'Secours 112',phone:'112',mode:'call',type:'Urgence'},
 {label:'SAMU 15',phone:'15',mode:'call',type:'Urgence médicale'},
 {label:'Police / gendarmerie 17',phone:'17',mode:'call',type:'Urgence de sécurité'},
 {label:'Pompiers 18',phone:'18',mode:'call',type:'Incendie ou secours'},
 {label:'Urgence SMS 114',phone:'114',mode:'sms',type:'Urgence — communication écrite'},
 {label:'VNF locale',phone:'',mode:'call',type:'Difficulté de navigation'},
 {label:'Mécanicien local',phone:'',mode:'call',type:'Panne mécanique'},
 {label:'Contact personnel',phone:'',mode:'sms',type:'Demande d’assistance'}];
const testNumber='0607615420';
function contactPhone(){let n=(state.contactPhone||testNumber).replace(/[^+0-9]/g,'');return n.startsWith('0')?'+33'+n.slice(1):n}
function messageFor(c,address){const p=latest,now=new Date(),lines=[
 'URGENCE — Demande d’assistance',
 '',
 'Motif : '+c.type,
 'Bateau : '+(state.boatName||'Kotter'),
 '',
 'Latitude : '+(p?p.lat.toFixed(6):'GPS indisponible'),
 'Longitude : '+(p?p.lon.toFixed(6):'GPS indisponible'),
 'Précision GPS : '+(p?'± '+Math.round(p.acc)+' m':'inconnue'),
 '',
 'Adresse approximative : '+(address||'Non disponible'),
 'Localisation sur la carte :',
 p?'https://www.google.com/maps?q='+p.lat.toFixed(6)+','+p.lon.toFixed(6):'Position indisponible',
 '',
 'Téléphone : '+contactPhone(),
 'Date : '+now.toLocaleDateString('fr-FR'),
 'Heure : '+now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
 '',
 'Merci de me contacter.'
 ];return lines.join('\n')}
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
function emergencyDialog(){const contacts=[...contactDefaults,...state.contacts];
 openModal('Urgences — téléphone ou SMS',`<p class="${state.testMode?'testBadge':'muted'}">${state.testMode?'MODE TEST : tous les destinataires sont remplacés par ton numéro':'MODE RÉEL : vérifie le destinataire avant de contacter les secours'}</p>
 <label class="formLabel">Destinataire<select id="emTarget">${contacts.map((c,i)=>`<option value="${i}">${esc(c.label)}</option>`).join('')}</select></label>
 <label class="formLabel">Numéro<input id="emPhone" type="tel"></label>
 <div id="smsFields"><label class="formLabel">Message modifiable<textarea id="emText"></textarea></label></div>
 <div id="recentCalls"></div><div class="dialogActions"><button id="emAction">Appeler</button><button id="emContacts">Choisir un contact</button></div>
 <p class="muted">En mode réel, 15/17/18/112 : appel uniquement. Le 114 reçoit les urgences par SMS, selon les conditions du service. Aucun SMS n'est envoyé sans confirmation.</p>`);
 function renderRecent(){const box=get('recentCalls');if(!box)return;const list=Array.isArray(state.recentCalls)?state.recentCalls:[];box.innerHTML=list.length?'<p class="muted">Derniers numéros utilisés (nom abrégé à 7 caractères) :</p>'+list.map((c,i)=>'<button type="button" data-recent="'+i+'">'+esc(c.label.slice(0,7))+' · '+esc(c.number)+'</button>').join(''):'';box.querySelectorAll('[data-recent]').forEach(b=>b.onclick=()=>{const c=list[Number(b.dataset.recent)];get('emPhone').value=state.testMode?testNumber:c.number;const option=contacts.findIndex(x=>x.label===c.label);if(option>=0){get('emTarget').value=String(option);refresh()}get('emPhone').value=state.testMode?testNumber:c.number;});}
 function refresh(){let c=contacts[Number(get('emTarget').value)];get('emPhone').value=state.testMode?testNumber:c.phone;let isSms=c.mode==='sms';get('smsFields').hidden=!isSms;get('emAction').textContent=isSms?'✉ Préparer le SMS':'📞 Appeler';get('emText').value=messageFor(c,get('emText').dataset.address)}
 get('emTarget').onchange=refresh;refresh();renderRecent();
 resolveEmergencyAddress().then(address=>{const target=get('emTarget'),text=get('emText');if(target&&text&&document.activeElement!==text){const c=contacts[Number(target.value)];text.value=messageFor(c,address);text.dataset.address=address}});
 get('emAction').onclick=()=>{let n=get('emPhone').value.trim();if(!n){alert('Numéro manquant : renseigne-le dans les paramètres ou choisis un contact');return}let c=contacts[Number(get('emTarget').value)];if(!state.testMode){state.recentCalls=[{label:c.label,number:n},...(state.recentCalls||[]).filter(x=>x.number!==n)].slice(0,8);persist();}if(c.mode==='sms')smsNumber(n,get('emText').value);else callNumber(n)};
 get('emContacts').onclick=()=>{if(!nativeCall('pickContact'))alert('Sélection native des contacts disponible dans la version Android')};
}
get('gpsCard').onclick=emergencyDialog;
function cameraDialogNative(i){let key='cam'+i;openModal('Caméra '+i,`<div class="viewer" id="viewer"><span id="camMessage">Caméra non connectée</span><img id="cameraImg" hidden alt="Flux caméra"><video id="cameraVideo" autoplay muted playsinline hidden></video></div>
 ${field('Adresse réseau : RTSP, MJPEG ou image HTTP','cameraUrl',cfg[key])}
 <p class="muted">Pour RTSP : lecture Android native expérimentale. Pour MJPEG : lecture dans Nautic. Caméra et téléphone sur le même Wi-Fi.</p>
 <div class="dialogActions"><button id="cameraSave">Enregistrer / ouvrir</button><button id="cameraPhone">Caméra du téléphone</button></div>`,true);
 get('cameraSave').onclick=()=>{let url=get('cameraUrl').value.trim();cfg[key]=url;saveCfg();if(!url){get('camMessage').textContent='Renseigne une adresse';return}
  if(url.toLowerCase().startsWith('rtsp://')){if(!nativeCall('openRtsp',url))get('camMessage').textContent='Lecteur RTSP natif requis';return}
  if(!/^https?:\/\//i.test(url)){get('camMessage').textContent='Adresse HTTP(S) ou RTSP attendue';return}showCamUrl(url,i)};
 get('cameraPhone').onclick=async()=>{try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Capture indisponible depuis le contexte local de cette WebView');
  cameraStream?.getTracks().forEach(t=>t.stop());cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  get('cameraImg').hidden=true;get('cameraVideo').hidden=false;get('cameraVideo').srcObject=cameraStream;get('camMessage').hidden=true;
 }catch(e){get('camMessage').textContent='Accès caméra : '+e.message}};
 if(cfg[key]&&/^https?:\/\//i.test(cfg[key]))showCamUrl(cfg[key],i);
}
for(let i=1;i<=3;i++)get('cam'+i+'Card').onclick=()=>cameraDialogNative(i);
// One journal, one recenter button; no obsolete Nautic footer control.
get('routeCard').style.display='none';get('miniMap').style.display='none';let branding=document.querySelector('.branding');if(branding)branding.style.display='none';
const footer=document.querySelector('footer');if(footer)footer.style.display='none';
function applyVisibility(){const ids=['gpsCard','boatCard','fuelCard','logCard','cam1Card','cam2Card','cam3Card','speedCard','headingCard','weatherCard'];for(const id of ids){const e=get(id);if(!e)continue;const hidden=state.buttons[id]===false;e.classList.toggle('nautic-hidden',hidden);e.hidden=hidden;e.setAttribute('aria-hidden',hidden?'true':'false')}if(map)setTimeout(()=>map.invalidateSize(),80)}
function settingsDialog(){let buttons=[['gpsCard','Position GPS / urgences'],['boatCard','Mon bateau'],['fuelCard','Carburant'],['logCard','Journal'],['cam1Card','Caméra avant'],['cam2Card','Caméra côté'],['cam3Card','Caméra sous-marine'],['speedCard','Vitesse'],['headingCard','Cap'],['weatherCard','Météo']];
 openModal('Paramètres',`<h3>Tableau de bord</h3>${buttons.map(([id,label])=>`<label class="settingRow"><input type="checkbox" data-button="${id}" ${state.buttons[id]===false?'':'checked'}><span>${label}</span></label>`).join('')}
 <h3>Navigation</h3>${field('Seuil de déplacement confirmé (m)','settingMove',state.moveThreshold,'number')}${field('Arrêt prolongé (minutes)','settingStop',state.stopMinutes,'number')}
 <h3>Bateau</h3>${field('Nom du bateau','settingBoat',state.boatName)}${field('Téléphone de rappel (inclus dans les SMS)','settingContactPhone',state.contactPhone||testNumber,'tel')}
 <p>Carburant estimé consommé : <b>${(typeof fuelUsed==='number'?fuelUsed:0).toFixed(2)} L</b>. La consommation d'un arrêt de moins de ${state.stopMinutes} minutes est ajoutée à la reprise ; après ce délai elle est annulée.</p>
 <h3>Urgences</h3><p class="${state.testMode?'testBadge':'muted'}">${state.testMode?'Mode TEST actif':'Mode RÉEL actif'}</p>
 <button id="toggleEmergency">Basculer TEST / RÉEL (code)</button>
 <p class="muted">Mode TEST : tous les appels et SMS vers ${testNumber}. Mode réel : coordonnées vérifiées uniquement.</p>
 <h3>Contacts locaux et personnels</h3><p class="muted">Une ligne par contact : nom ; numéro ; motif ; appel ou sms. Exemple : Mécanicien ; 06… ; Panne moteur ; appel</p>
 <textarea id="contactList">${esc(state.contacts.map(c=>[c.label,c.phone,c.type,c.mode].join(' ; ')).join('\n'))}</textarea>
 <div class="dialogActions"><button id="settingsSave">Enregistrer</button><button id="settingsMaps">Choisir les cartes</button><button id="settingsReset">Rétablir les boutons</button></div>`,true);
 get('toggleEmergency').onclick=()=>{let pass=prompt('Code pour changer de mode :');if(pass==='xxx'){state.testMode=!state.testMode;persist();settingsDialog()}else if(pass!==null)alert('Code incorrect')};
 get('settingsSave').onclick=()=>{dialog.querySelectorAll('[data-button]').forEach(e=>state.buttons[e.dataset.button]=e.checked);
  state.moveThreshold=Math.max(3,Number(get('settingMove').value)||8);state.stopMinutes=Math.max(1,Number(get('settingStop').value)||20);
  state.boatName=get('settingBoat').value.trim();state.contactPhone=get('settingContactPhone').value.trim();
  state.contacts=get('contactList').value.split('\n').map(x=>x.split(';').map(v=>v.trim())).filter(a=>a.length>=2&&a[0]).map(a=>({label:a[0],phone:a[1],type:a[2]||'Assistance',mode:a[3]?.toLowerCase()==='appel'?'call':'sms'}));
  persist();applyVisibility();dialog.close();};
 get('settingsMaps').onclick=mapDialog;get('settingsReset').onclick=()=>{state.buttons={};persist();applyVisibility();settingsDialog()};
}
settingsButton.onclick=settingsDialog;applyVisibility();
setTimeout(()=>{if(map)setLayer(state.map)},1000);
})();
