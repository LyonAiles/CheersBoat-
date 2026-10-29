
/* Nautic adjustments. Load after app.js. */
(()=>{
const $=id=>document.getElementById(id);
const stored=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const state=stored('nautic-extensions',{boatPhoto:'',buttons:{},map:'osm',moveThreshold:8,stopMinutes:20,consumption:0,pending:0,stopAt:0,lastMoving:0,boatName:'Kotter',contacts:[]});
const persist=()=>localStorage.setItem('nautic-extensions',JSON.stringify(state));
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const camStyle=document.createElement('style');
camStyle.textContent=`
dialog.nautic-full{width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;border-radius:0;display:flex;flex-direction:column}
dialog.nautic-full:not([open]){display:none}
dialog.nautic-full #dialogContent{flex:1;min-height:0;display:flex;flex-direction:column;overflow:auto}
dialog.nautic-full .viewer{flex:1;min-height:0;height:auto}
#nauticSettingsButton,#mapRecenter,#mapLayers{position:absolute;z-index:800}
#mapRecenter{right:9px;bottom:34px}
#mapLayers{right:9px;bottom:79px}
#nauticSettingsButton{position:static;margin-left:4px}
#boatPhoto{width:100%;height:100%;object-fit:contain}
#windWidget{top:57%;left:54%;transform:none;pointer-events:none}
dialog .choiceGrid{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}
dialog .choiceGrid button{flex:1;min-width:95px}
dialog textarea,dialog select{width:100%;background:#09273b;color:white;border:1px solid #4a7b91;border-radius:7px;padding:8px}
dialog textarea{min-height:90px}
dialog .settingRow{display:flex;align-items:center;gap:8px;margin:8px 0}
`;
document.head.append(camStyle);
const dlg=$('dialog');
dlg.addEventListener('close',()=>dlg.classList.remove('nautic-full'));
const fullModal=(title,body)=>{dlg.classList.add('nautic-full');modal(title,body)};
const head=document.querySelector('header');
const settingsBtn=document.createElement('button');
settingsBtn.id='nauticSettingsButton';settingsBtn.textContent='⚙';settingsBtn.title='Paramètres';
head.append(settingsBtn);
const mapWrap=$('mapWrap');
const recenter=document.createElement('button');
recenter.id='mapRecenter';recenter.textContent='⌖';recenter.title='Recentrer la carte';
mapWrap.append(recenter);
recenter.onclick=()=>{if(window.map&&window.latest){map.setView([latest.lat,latest.lon],map.getZoom(),{animate:true})}};
const layers=document.createElement('button');
layers.id='mapLayers';layers.textContent='▤';layers.title='Choisir la carte';
mapWrap.append(layers);
const layerDefs={
osm:{name:'OpenStreetMap',url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',attribution:'© OpenStreetMap',maxZoom:19},
topo:{name:'Topographique',url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',attribution:'© OpenTopoMap',maxZoom:17},
sat:{name:'Satellite',url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',attribution:'© Esri',maxZoom:19}
};
let selectedLayer=null;
function setMapLayer(id){
 if(!window.map||!window.L)return;
 if(selectedLayer)map.removeLayer(selectedLayer);
 // Original OSM base layer is removed only once, after map is ready.
 map.eachLayer(layer=>{if(layer instanceof L.TileLayer && layer!==selectedLayer)map.removeLayer(layer)});
 const d=layerDefs[id]||layerDefs.osm;
 selectedLayer=L.tileLayer(d.url,{maxZoom:d.maxZoom,attribution:d.attribution}).addTo(map);
 state.map=id;persist();
}
function layersDialog(){
 modal('Choix des cartes',`<div class="choiceGrid">${Object.entries(layerDefs).map(([k,v])=>`<button data-layer="${k}">${esc(v.name)}</button>`).join('')}</div><p class="muted">Le zoom et le centrage restent inchangés. Les fonds nécessitent Internet ; leur disponibilité dépend du fournisseur.</p>`);
 dlg.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{setMapLayer(b.dataset.layer);dlg.close()});
}
layers.onclick=layersDialog;
const oldBoat=$('boatCard');
function photoApply(){
 let sk=oldBoat.querySelector('.boatSketch');
 if(sk&&state.boatPhoto)sk.innerHTML=`<img id="boatPhoto" src="${state.boatPhoto}" alt="Photographie du bateau">`;
}
photoApply();
function boatDialog(){
 fullModal('Mon bateau',`<p>Kotter acier · 13,40 × 4,30 m · TE 1,35 m · TA 3,45 m.</p>
 <img src="${state.boatPhoto||''}" alt="Bateau" style="max-height:25vh;max-width:100%;object-fit:contain" ${state.boatPhoto?'':'hidden'}>
 <label class="formLabel">Photographie du bateau<input type="file" id="boatFile" accept="image/*"></label>
 <div class="dialogActions"><button id="boatSite">Ouvrir le tableau « Mon bateau » dans Nautic</button></div>
 <div id="boatFrame" style="flex:1;min-height:30vh"></div>
 <p class="muted">L'affichage intégré du site dépend des règles de sécurité de son hébergeur.</p>`);
 $('boatFile').onchange=e=>{const f=e.target.files[0];if(!f)return;
  if(f.size>4_000_000){alert('Choisir une image de moins de 4 Mo.');return}
  const rd=new FileReader();rd.onload=()=>{state.boatPhoto=rd.result;persist();photoApply();boatDialog()};rd.readAsDataURL(f)};
 $('boatSite').onclick=()=>{$('boatFrame').innerHTML='<iframe title="Mon bateau" src="https://cerulean-mochi-747b13.netlify.app" style="width:100%;height:100%;border:1px solid #41768b;background:white"></iframe>'};
}
oldBoat.onclick=boatDialog;
const contactDefaults=[
 {label:'Urgences — appel',phone:'112',mode:'call',type:'Urgence vitale'},
 {label:'Pompiers — appel',phone:'18',mode:'call',type:'Incendie ou secours'},
 {label:'Gendarmerie — appel',phone:'17',mode:'call',type:'Sécurité'},
 {label:'Urgence SMS 114',phone:'114',mode:'sms',type:'Urgence — communication écrite'},
 {label:'VNF locale',phone:'',mode:'call',type:'Difficulté de navigation'},
 {label:'Mécanicien local',phone:'',mode:'call',type:'Panne mécanique'},
 {label:'Contact personnel',phone:'',mode:'sms',type:'Demande d’assistance'}
];
function contactMessage(item){
 const p=window.latest;
 const pos=p?`${p.lat.toFixed(6)}, ${p.lon.toFixed(6)} (précision ±${Math.round(p.acc)} m)`:'position GPS non disponible';
 return `Nautic — ${item.type}. Bateau : ${state.boatName||'Kotter'}. Position : ${pos}. Date : ${new Date().toLocaleString('fr-FR')}. Merci de me contacter.`;
}
function emergencyDialog(){
 const contacts=[...contactDefaults,...state.contacts];
 modal('Appel ou SMS d’urgence',`<label class="formLabel">Destinataire<select id="emTarget">${contacts.map((c,i)=>`<option value="${i}">${esc(c.label)}</option>`).join('')}</select></label>
 <label class="formLabel">Numéro de téléphone<input id="emPhone" type="tel"></label>
 <label class="formLabel">Message à adapter<textarea id="emText"></textarea></label>
 <div class="choiceGrid"><button id="emCall">📞 Téléphoner</button><button id="emSms">✉ SMS</button><button id="emContacts">Contacts du téléphone</button></div>
 <p class="muted">Les numéros d’urgence 112, 17 et 18 sont à appeler. Pour les urgences par SMS en France : 114. L’envoi d’un SMS nécessite une confirmation dans l’application de messagerie.</p>`);
 function pick(){const c=contacts[Number($('emTarget').value)];$('emPhone').value=c.phone;$('emText').value=contactMessage(c)}
 $('emTarget').onchange=pick;pick();
 $('emCall').onclick=()=>{let n=$('emPhone').value.trim();if(n)location.href='tel:'+encodeURIComponent(n)};
 $('emSms').onclick=()=>{let n=$('emPhone').value.trim();if(n)location.href='sms:'+encodeURIComponent(n)+'?body='+encodeURIComponent($('emText').value)};
 $('emContacts').onclick=async()=>{
  if(navigator.contacts?.select){try{
   let c=await navigator.contacts.select(['name','tel'],{multiple:false});
   if(c?.length){$('emPhone').value=c[0].tel?.[0]||'';return}
  }catch(e){}}
  alert('Accès direct aux contacts indisponible dans cette version Android. Tu peux saisir le numéro dans ce champ ou l’enregistrer dans Paramètres.');
 };
}
$('gpsCard').onclick=emergencyDialog;
function cameraFullscreen(i){
 const key='cam'+i;
 fullModal('Caméra '+i,`<div class="viewer" id="viewer"><span id="camMessage">Flux local non configuré</span><img id="cameraImg" hidden alt="Flux caméra"><video id="cameraVideo" autoplay muted playsinline hidden></video></div>
 ${field('Adresse HTTP MJPEG ou image réseau local','cameraUrl',cfg[key])}
 <p class="muted">Les flux RTSP des caméras IP nécessitent un lecteur natif ou un relais local. Tester la caméra du téléphone est une fonction distincte.</p>
 <div class="dialogActions"><button id="saveCamera">Enregistrer / essayer</button><button id="deviceCam">Tester caméra du téléphone</button></div>`);
 $('saveCamera').onclick=()=>{cfg[key]=$('cameraUrl').value.trim();saveCfg();if(cfg[key])showCamUrl(cfg[key],i)};
 $('deviceCam').onclick=async()=>{try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('WebView ne permet pas encore la capture depuis cette origine locale');
  cameraStream?.getTracks().forEach(t=>t.stop());
  cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  $('cameraImg').hidden=true;$('cameraVideo').hidden=false;$('cameraVideo').srcObject=cameraStream;$('camMessage').hidden=true
 }catch(e){$('camMessage').hidden=false;$('camMessage').textContent='Accès refusé : '+e.message}};
 if(cfg[key])showCamUrl(cfg[key],i);
}
for(let i=1;i<=3;i++)$('cam'+i+'Card').onclick=()=>cameraFullscreen(i);
const oldRoute=$('routeCard');oldRoute.style.display='none';
const oldBrand=document.querySelector('.branding');if(oldBrand)oldBrand.style.display='none';
const oldMini=$('miniMap');if(oldMini)oldMini.style.display='none';
const f=document.querySelector('footer');f.style.gridTemplateColumns='1fr';f.style.display='none';
function settingsDialog(){
 const items=[['gpsCard','Position GPS'],['boatCard','Mon bateau'],['fuelCard','Carburant'],['logCard','Journal'],['cam1Card','Caméra avant'],['cam2Card','Caméra côté'],['cam3Card','Caméra sous-marine'],['speedCard','Vitesse'],['headingCard','Cap'],['weatherCard','Météo']];
 fullModal('Paramètres',`
 <h3>Affichage du tableau de bord</h3>
 ${items.map(([id,name])=>`<label class="settingRow"><input type="checkbox" data-toggle="${id}" style="width:auto" ${state.buttons[id]===false?'':'checked'}> ${name}</label>`).join('')}
 <h3>Navigation et consommation</h3>
 ${field('Seuil de mouvement GPS (m)','moveThreshold',state.moveThreshold,'number')}
 ${field('Immobilisation avant annulation (minutes)','stopMinutes',state.stopMinutes,'number')}
 ${field('Nom du bateau','boatName',state.boatName)}
 <h3>Contacts locaux / personnels</h3>
 <p class="muted">Un contact par ligne : nom ; numéro ; motif. Exemple : Mécanicien ; 06… ; Panne moteur</p>
 <textarea id="contactList">${esc(state.contacts.map(c=>[c.label,c.phone,c.type].join(' ; ')).join('\n'))}</textarea>
 <div class="dialogActions"><button id="settingSave">Enregistrer</button><button id="settingMaps">Choisir les cartes</button><button id="settingReset">Réinitialiser l'affichage</button></div>
 <p class="muted">Les paramètres sont enregistrés localement sur ce téléphone.</p>`);
 $('settingSave').onclick=()=>{
  dlg.querySelectorAll('[data-toggle]').forEach(c=>state.buttons[c.dataset.toggle]=c.checked);
  state.moveThreshold=Math.max(2,Number($('moveThreshold').value)||8);
  state.stopMinutes=Math.max(1,Number($('stopMinutes').value)||20);
  state.boatName=$('boatName').value.trim();
  state.contacts=$('contactList').value.split('\n').map(x=>x.split(';').map(y=>y.trim())).filter(a=>a.length>=2&&a[0]).map(a=>({label:a[0],phone:a[1],type:a[2]||'Demande d’aide',mode:'sms'}));
  persist();applyVisibility();dlg.close();
 };
 $('settingMaps').onclick=layersDialog;
 $('settingReset').onclick=()=>{state.buttons={};persist();applyVisibility();settingsDialog()};
}
settingsBtn.onclick=settingsDialog;
function applyVisibility(){
 Object.entries(state.buttons).forEach(([id,yes])=>{const e=$(id);if(e)e.style.display=yes===false?'none':''});
}
applyVisibility();
setTimeout(()=>{if(window.map)setMapLayer(state.map)},900);
// Indicateur de vent près du symbole du bateau, pas en haut de carte.
const wind=$('windWidget');wind.style.top='calc(53% + 22px)';wind.style.left='calc(50% + 22px)';
})();
