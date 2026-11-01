'use strict';
const $=id=>document.getElementById(id), KEY='nautic-v04';let cfg={fuel:400,tank:600,cons:4,emergency:'',cam1:'',cam2:'',cam3:''};try{
 const bridge=window.NauticAndroid;
 const saved=bridge&&typeof bridge.readSetting==='function'?bridge.readSetting(KEY):'';
 const previous=localStorage.getItem(KEY)||'';
 Object.assign(cfg,JSON.parse(saved||previous||'{}'));
 if(!saved&&previous&&bridge&&typeof bridge.writeSetting==='function')bridge.writeSetting(KEY,previous);
}catch(e){};
let speedSamples=[],speedLastMotion=0;const WIND_PERIOD=300000;let windBusy=false;let map,boatMarker,routeLine,watchId=null,latest=null,prev=null,heading=null,speed=null,recording=false,started=0,travel=0,points=[],weatherAt=0,weather=null;
try{points=JSON.parse(localStorage.getItem('nautic-v04-points')||'[]');travel=Number(localStorage.getItem('nautic-v04-travel')||0)}catch(e){}
const fmt=n=>Number(n).toLocaleString('fr-FR',{maximumFractionDigits:2});
function clock(){let d=new Date();$('clock').textContent=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});$('clock').title=d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});}clock();setInterval(clock,1000);
function modal(title,body){$('dialogTitle').textContent=title;$('dialogContent').innerHTML=body;$('dialog').showModal()}$('dialogClose').onclick=()=>$('dialog').close();
function field(label,id,value,type='text'){return `<label class="formLabel">${label}<input id="${id}" type="${type}" value="${String(value??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')}"></label>`}
function saveCfg(){
 const value=JSON.stringify(cfg),bridge=window.NauticAndroid;
 if(bridge&&typeof bridge.writeSetting==='function'){
  if(!bridge.writeSetting(KEY,value)||bridge.readSetting(KEY)!==value)throw Error('Paramètres Android non mémorisés');
 }
 try{localStorage.setItem(KEY,value)}catch(e){if(!bridge)throw e}
 fuelUpdate();
}
function fuelRemaining(){
 const total=Math.max(0,Number(fuelUsed)||0)+Math.max(0,Number(heatingUsed)||0);
 if(!Number.isFinite(Number(cfg.fuelBaseline))) {
  cfg.fuelBaseline=Math.max(0,Number(cfg.fuel)||0);
  cfg.usedBaseline=total;
  try{localStorage.setItem(KEY,JSON.stringify(cfg))}catch(e){}
 }
 return Math.max(0,Math.min(Math.max(1,Number(cfg.tank)||1),Number(cfg.fuelBaseline)-Math.max(0,total-Number(cfg.usedBaseline||0))));
}
function fuelUpdate(){let f=fuelRemaining(),t=Math.max(1,Number(cfg.tank)||1),c=Number(cfg.cons)||0;$('fuelbar').style.width=Math.min(100,100*f/t)+'%';$('fuelQty').textContent=fmt(f)+' L';$('fuelMax').textContent='/ '+fmt(t)+' L';$('consValue').textContent=fmt(c);$('hours').textContent=c>0?fmt(f/c):'—'}// Chauffage : estimation horodatée, conservée entre deux ouvertures de Nautic.
let heatingRate=Number(localStorage.getItem('nautic-heating-rate')??2.5);
if(!Number.isFinite(heatingRate)||heatingRate<0)heatingRate=2.5;
let heatingActive=localStorage.getItem('nautic-heating-active')!=='false';
let heatingUsed=Number(localStorage.getItem('nautic-heating-used')||0);
let heatingLast=Number(localStorage.getItem('nautic-heating-last')||Date.now());
function heatingTick(){
 const now=Date.now(),dt=Math.max(0,now-heatingLast);
 if(heatingActive)heatingUsed+=dt/86400000*heatingRate;
 heatingLast=now;
 localStorage.setItem('nautic-heating-last',String(now));
 localStorage.setItem('nautic-heating-used',String(heatingUsed));
}
setInterval(()=>{heatingTick();fuelUpdate()},60000);
function openFuel(){heatingTick();modal('Carburant',field('Carburant restant (L)','inFuel',fuelRemaining(),'number')+field('Capacité du réservoir (L)','inTank',cfg.tank,'number')+field('Consommation de référence (L/h)','inCons',cfg.cons,'number')+
field('Chauffage — consommation quotidienne (L/jour)','inHeatingRate',heatingRate,'number')+field('Consommation navigation suivie (L)','inNavUsed',fuelUsed,'number')+field('Consommation chauffage suivie (L)','inHeatUsed',heatingUsed,'number')+
'<label class="settingRow"><input type="checkbox" id="inHeatingActive" '+(heatingActive?'checked':'')+'> Chauffage en service</label>'+
'<div id="fuelTriptych" style="margin:14px 0"><div style="display:flex;height:24px;border-radius:8px;overflow:hidden;border:1px solid #8ca5b2;background:#f0f2f4"><div id="fuelEmptySeg" style="background:#25bf73"></div><div id="fuelNavSeg" style="background:#e6a039"></div><div id="fuelHeatSeg" style="background:#d95359"></div><div id="fuelOtherSeg" style="background:repeating-linear-gradient(45deg,#8796a2 0px,#8796a2 6px,#a5b2bc 6px,#a5b2bc 12px)"></div></div><div id="fuelLegend" style="display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:8px;font-size:13px"></div></div>'+
'<p class="muted">Chauffage estimé : '+heatingUsed.toFixed(2)+' L depuis le début du suivi. Moteur estimé : '+fuelUsed.toFixed(2)+' L. Total : '+(heatingUsed+fuelUsed).toFixed(2)+' L. Les consommations suivies sont déduites du carburant restant à partir du dernier enregistrement.</p><button id="saveFuel">Enregistrer</button>');const updateTriptych=()=>{
 const cap=Math.max(1,Number($('inTank').value)||1);
 const remaining=Math.min(cap,Math.max(0,Number($('inFuel').value)||0));
 const consumed=cap-remaining;
 const nav=Math.max(0,Number($('inNavUsed').value)||0),heat=Math.max(0,Number($('inHeatUsed').value)||0);
 // Les cumuls ne couvrent pas nécessairement toute l'histoire du réservoir.
 const tracked=nav+heat,scale=tracked>consumed&&tracked>0?consumed/tracked:1;
 const a=nav*scale,b=heat*scale,other=Math.max(0,consumed-a-b);
 $('fuelNavSeg').style.width=(100*a/cap)+'%';
 $('fuelHeatSeg').style.width=(100*b/cap)+'%';
 $('fuelOtherSeg').style.width=(100*other/cap)+'%';
 $('fuelEmptySeg').style.width=(100*remaining/cap)+'%';
 $('fuelLegend').innerHTML='<span>🟠 Navigation suivie : '+fmt(a)+' L</span><span>🔴 Chauffage suivi : '+fmt(b)+' L</span><span>◩ Consommé non attribué : '+fmt(other)+' L</span><span>⚪ Restant : '+fmt(remaining)+' L</span><span>Total consommé : '+fmt(consumed)+' L sur '+fmt(cap)+' L</span>'+(tracked>consumed?'<small>Les cumuls suivis dépassent la consommation du réservoir : répartition ajustée, vérifier les saisies.</small>':'');

};updateTriptych();$('inTank').addEventListener('input',updateTriptych);$('inFuel').addEventListener('input',updateTriptych);$('inNavUsed').addEventListener('input',updateTriptych);$('inHeatUsed').addEventListener('input',updateTriptych);$('saveFuel').onclick=()=>{cfg.fuel=Math.max(0,Number($('inFuel').value));cfg.tank=Math.max(1,Number($('inTank').value));cfg.cons=Math.max(.1,Number($('inCons').value));heatingTick();fuelUsed=Math.max(0,Number($('inNavUsed').value)||0);heatingUsed=Math.max(0,Number($('inHeatUsed').value)||0);localStorage.setItem('nautic-fuel-used',String(fuelUsed));localStorage.setItem('nautic-heating-used',String(heatingUsed));cfg.fuelBaseline=cfg.fuel;cfg.usedBaseline=fuelUsed+heatingUsed;heatingRate=Math.max(0,Number($('inHeatingRate').value)||0);heatingActive=$('inHeatingActive').checked;localStorage.setItem('nautic-heating-rate',String(heatingRate));localStorage.setItem('nautic-heating-active',String(heatingActive));saveCfg();$('dialog').close()}}
function openBoat(){modal('Mon bateau','<p>Kotter acier · 13,40 × 4,30 m · tirant d’eau 1,35 m · tirant d’air 3,45 m.</p><div class="dialogActions"><button id="openBoat">Ouvrir Mon bateau</button><button id="embedBoat">Afficher dans Nautic</button></div><div id="boatEmbed"></div><p class="muted">L’intégration dans une fenêtre dépend des autorisations du site existant. La base de données n’est pas encore fusionnée.</p>');$('openBoat').onclick=()=>window.open('https://cerulean-mochi-747b13.netlify.app','_blank','noopener');$('embedBoat').onclick=()=>{$('boatEmbed').innerHTML='<iframe title="Mon bateau" src="https://cerulean-mochi-747b13.netlify.app" style="width:100%;height:50vh;border:1px solid #41768b;border-radius:8px;background:white"></iframe>'}}
function sms(){if(!latest){startGps();modal('Position GPS','Le GPS cherche une position. Réessaie lorsque les coordonnées apparaissent.');return}modal('SMS d’urgence',field('Numéro du destinataire (à choisir)','emergencyNumber',cfg.emergency,'tel')+`<p>Position : ${latest.lat.toFixed(6)}, ${latest.lon.toFixed(6)}<br>Précision annoncée : ±${Math.round(latest.acc)} m</p><p class="muted">Le SMS sera préparé dans l’application de messagerie ; tu devras confirmer son envoi. Ne remplace pas l’appel aux secours ou la VHF.</p><button id="smsSend">Préparer le SMS</button>`);$('smsSend').onclick=()=>{let n=$('emergencyNumber').value.trim();if(!n){alert('Renseigne un numéro.');return}cfg.emergency=n;saveCfg();let m=`Position du bateau : ${latest.lat.toFixed(6)}, ${latest.lon.toFixed(6)} (précision GPS ±${Math.round(latest.acc)} m). https://maps.google.com/?q=${latest.lat},${latest.lon}`;location.href='sms:'+encodeURIComponent(n)+'?body='+encodeURIComponent(m)}}
function rad(x){return x*Math.PI/180}function distanceM(a,b){let d1=rad(b.lat-a.lat),d2=rad(b.lon-a.lon),q=Math.sin(d1/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(d2/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(q)))}function bearing(a,b){let dl=rad(b.lon-a.lon),x=Math.sin(dl)*Math.cos(rad(b.lat)),y=Math.cos(rad(a.lat))*Math.sin(rad(b.lat))-Math.sin(rad(a.lat))*Math.cos(rad(b.lat))*Math.cos(dl);return(Math.atan2(x,y)*180/Math.PI+360)%360}
function initMap(){if(!window.L){$('mapFallback').style.display='grid';return}map=L.map('map',{zoomControl:false}).setView([47.5911,2.7521],14);L.control.zoom({position:'bottomright'}).addTo(map);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);routeLine=L.polyline(points.map(p=>[p.lat,p.lon]),{color:'#28bdf1',weight:4}).addTo(map);map.on('tileerror',()=>{$('mapFallback').style.display='grid'});map.on('tileload',()=>{$('mapFallback').style.display='none'});map.on('moveend zoomend',rotateMap);map.dragging.disable();enableMapRotation()}
// Heading-up is a visual CSS rotation; geographic marker placement is handled by Leaflet.
let userMapRotation=0;let rotationGesture=null;
function enableMapRotation(){const el=document.getElementById('map');if(!el)return;const angle=(a,b)=>Math.atan2(b.clientY-a.clientY,b.clientX-a.clientX)*180/Math.PI;
 el.addEventListener('touchstart',e=>{if(e.touches.length===2)rotationGesture={angle:angle(e.touches[0],e.touches[1]),base:userMapRotation}},{passive:true});
 el.addEventListener('touchmove',e=>{if(e.touches.length!==2||!rotationGesture)return;userMapRotation=rotationGesture.base+angle(e.touches[0],e.touches[1])-rotationGesture.angle;rotateMap()},{passive:true});
 el.addEventListener('touchend',e=>{if(e.touches.length<2)rotationGesture=null},{passive:true});}
function rotateMap(){if(!map)return;let pane=map.getPane('mapPane'),pos=L.DomUtil.getPosition(pane)||L.point(0,0),center=map.getSize().divideBy(2).subtract(pos);pane.style.transform=`translate3d(${pos.x}px,${pos.y}px,0) rotate(${-(heading??0)+userMapRotation}deg)`;pane.style.transformOrigin=`${center.x}px ${center.y}px`;let tile=map.getPane('tilePane');tile.style.transformOrigin='center center';$('compass').style.transform=`rotate(${(heading??0)-userMapRotation}deg)`;}
// GPS filtering: boat stays visually fixed, map follows accepted positions smoothly.
// Only confirmed displacement counts; brief stops count as engine-on, long stops do not.
let stableFix=null, movingCandidate=null, movementConfirm=0, gpsFollowTarget=null, smoothCenter=null;
let lastFuelTick=Date.now(), fuelPending=0, fuelUsed=Number(localStorage.getItem('nautic-fuel-used')||0), stationarySince=0;
fuelUpdate();
function motionConfig(){try{let c=JSON.parse(localStorage.getItem('nautic-extensions')||'{}');return {threshold:Math.max(3,Number(c.moveThreshold)||8),stopMs:Math.max(1,Number(c.stopMinutes)||20)*60000}}catch(e){return {threshold:8,stopMs:1200000}}}
function fuelTick(now,moving){
 let dt=Math.max(0,Math.min(10000,now-lastFuelTick));lastFuelTick=now;
 const rate=(Number(cfg.cons)||0)/3600000;
 const opt=motionConfig();
 if(moving){
  if(stationarySince&&now-stationarySince<opt.stopMs)fuelUsed+=fuelPending;
  fuelPending=0;stationarySince=0;fuelUsed+=dt*rate;
 }else{
  if(!stationarySince)stationarySince=now;
  if(now-stationarySince<opt.stopMs)fuelPending+=dt*rate;
  else fuelPending=0;
 }
 localStorage.setItem('nautic-fuel-used',String(fuelUsed));
}
setInterval(()=>{fuelTick(Date.now(),!!stableFix&&stationarySince===0);fuelUpdate();},1000);
function animateFollow(){
 if(!map||!gpsFollowTarget)return;
 if(!smoothCenter)smoothCenter={lat:gpsFollowTarget.lat,lon:gpsFollowTarget.lon};
 let delta=distanceM(smoothCenter,gpsFollowTarget);
 if(delta>.15){
  let factor=Math.min(.22,Math.max(.045,delta/100));
  smoothCenter.lat+=(gpsFollowTarget.lat-smoothCenter.lat)*factor;
  smoothCenter.lon+=(gpsFollowTarget.lon-smoothCenter.lon)*factor;
  map.panTo([smoothCenter.lat,smoothCenter.lon],{animate:false,noMoveStart:true});
 }
}
setInterval(animateFollow,80);
function onPos(result){
 const c=result.coords,now=Date.now();
 const p={lat:c.latitude,lon:c.longitude,acc:c.accuracy,t:now,speed:c.speed,head:c.heading};
 latest=p;
 speed=c.speed==null?null:Math.max(0,c.speed*3.6);
 if(speed!==null){
  speedSamples.push({v:speed,t:now});speedSamples=speedSamples.filter(x=>now-x.t<6500);
  const avg=speedSamples.reduce((a,x)=>a+x.v,0)/speedSamples.length;
  if(avg>=1.5)speedLastMotion=now;
  speed=(avg<1.5&&now-speedLastMotion>3500)?0:avg;
 }
 $('coords').textContent=p.lat.toFixed(5)+'° N\n'+p.lon.toFixed(5)+'° E';
 $('connection').textContent='GPS actif · précision ±'+Math.round(p.acc)+' m';
 $('mapGps').textContent='GPS ±'+Math.round(p.acc)+' m';
 $('speedValue').textContent=speed==null?'—':speed.toFixed(1);
 $('speedCard').style.setProperty('--speedRotation',(-70+Math.min(30,speed||0)/30*140)+'deg');
 if(!stableFix){stableFix=p;gpsFollowTarget=p;smoothCenter={lat:p.lat,lon:p.lon};}
 const opt=motionConfig();
 const d=distanceM(stableFix,p);
 const uncertainty=Math.min(25,Math.max(opt.threshold,(p.acc+(stableFix.acc||p.acc))*.35));
 const valid=p.acc<=35;
 let confirmed=false;
 if(valid&&d>uncertainty){
  if(movingCandidate&&distanceM(movingCandidate,p)<Math.max(uncertainty*2,30))movementConfirm++;
  else movementConfirm=1;
  movingCandidate=p;
  if(movementConfirm>=2){confirmed=true;movingCandidate=null;movementConfirm=0;}
 }else if(d<opt.threshold){movingCandidate=null;movementConfirm=0;}
 if(confirmed){
  if(Number.isFinite(c.heading)&&speed>1)heading=c.heading;
  else heading=bearing(stableFix,p);
  stableFix=p;gpsFollowTarget=p;
  stationarySince=0;
  fuelTick(now,true);
  if(recording){let last=points.at(-1);
   if(!last||distanceM(last,p)>=opt.threshold){
    if(last){let leg=distanceM(last,p);if(leg<200)travel+=leg;}
    points.push(p);if(points.length>12000)points.shift();
    localStorage.setItem('nautic-v04-points',JSON.stringify(points));
    localStorage.setItem('nautic-v04-travel',String(travel));
    if(routeLine)routeLine.setLatLngs(points.map(x=>[x.lat,x.lon]));updateLog();
   }
  }
 }
 if(!confirmed&&stationarySince===0)stationarySince=now;
 if(!confirmed&&now-stationarySince>=opt.stopMs)fuelPending=0;
 $('headingValue').textContent=heading==null?'—°':Math.round(heading)+'°';
 $('mapBoat').style.transform='translate(-50%,-50%)';
 if(map){let ll=[stableFix.lat,stableFix.lon];
  if(!boatMarker){boatMarker=L.circleMarker(ll,{radius:7,color:'white',weight:2,fillColor:'#00d9ed',fillOpacity:1}).addTo(map);map.setView(ll,16)}
  else boatMarker.setLatLng(ll);
  rotateMap();
 }
 prev=p;
 if(now-weatherAt>600000)loadWeather();
}
function startGps(){if(watchId!==null)return;if(!navigator.geolocation){$('connection').textContent='GPS non pris en charge';return}$('connection').textContent='Recherche GPS…';watchId=navigator.geolocation.watchPosition(onPos,e=>{$('connection').textContent='GPS : '+e.message}, {enableHighAccuracy:true,maximumAge:1000,timeout:20000})}
const weatherIcon=code=>code===0?'☀️':code<=2?'🌤️':code===3?'☁️':code<=48?'🌫️':code<=67?'🌧️':code<=77?'❄️':code<=82?'🌦️':code<=86?'🌨️':'⛈️';
async function loadWeather(){
 if(!latest||windBusy)return;windBusy=true;
 try{
  const u=`https://api.open-meteo.com/v1/forecast?latitude=${latest.lat}&longitude=${latest.lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,weather_code&wind_speed_unit=kmh`;
  const r=await fetch(u);if(!r.ok)throw Error('Réseau');
  weather=(await r.json()).current;weatherAt=Date.now();
  $('windSpeed').textContent=Math.round(weather.wind_speed_10m)+' km/h';
  $('windDirection').textContent=Math.round(weather.wind_direction_10m)+'°';
  $('weatherLabel').textContent=weatherIcon(weather.weather_code)+' '+Math.round(weather.temperature_2m)+'°C';
  const symbol=$('weatherCard').querySelector('.weatherSymbol');if(symbol)symbol.textContent=weatherIcon(weather.weather_code);
  const angle=(weather.wind_direction_10m+180-(heading??0))%360;$('windArrow').style.transform=`rotate(${angle}deg)`;
  updateWindCountdown();
 }catch(e){$('weatherTime').textContent='Météo indisponible · toucher pour réessayer'}
 finally{windBusy=false}
}
function updateWindCountdown(){
 const el=$('weatherTime');if(!el||!weatherAt)return;
 const remain=Math.max(0,WIND_PERIOD-(Date.now()-weatherAt)),mins=Math.floor(remain/60000),secs=Math.floor(remain%60000/1000);
 const v=Math.round(weather?.wind_speed_10m??0),g=weather?.wind_gusts_10m;
 el.textContent='Vent '+v+' · Raf. '+(Number.isFinite(g)?Math.round(g):'—')+' km/h · '+String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');
 const bar=$('windRefreshBar');if(bar)bar.style.width=(100-remain/WIND_PERIOD*100).toFixed(1)+'%';
}
setInterval(()=>{if(latest)loadWeather()},WIND_PERIOD);
setInterval(updateWindCountdown,1000);
function updateLog(){$('distance').textContent=(travel/1000).toFixed(2)+' km';$('routeDistance').textContent=(travel/1000).toFixed(2)+' km';$('recordState').textContent=recording?'Enregistrement actif':'En pause';$('recordDot').classList.toggle('live',recording);if(recording){let s=Math.floor((Date.now()-started)/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;$('elapsed').textContent=[h,m,ss].map(x=>String(x).padStart(2,'0')).join(':')}}setInterval(updateLog,1000);updateLog();
function exportCsv(){let csv=['date,latitude,longitude,precision_m,vitesse_m_s,cap_deg',...points.map(p=>[new Date(p.t).toISOString(),p.lat,p.lon,p.acc,p.speed??'',p.head??''].join(','))].join('\n');let u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='nautic-journal.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function logDialog(){modal('Journal de bord',`<p>Points enregistrés : ${points.length}<br>Distance GPS estimée : ${(travel/1000).toFixed(2)} km</p><p class="muted">Le navigateur doit rester ouvert pour enregistrer le trajet. Le suivi en arrière-plan n’est pas garanti.</p><div class="dialogActions"><button id="recordBtn">${recording?'Arrêter':'Démarrer'} l’enregistrement</button><button id="csvBtn">Exporter CSV</button><button id="eraseBtn">Effacer</button></div>`);$('recordBtn').onclick=()=>{recording=!recording;if(recording){started=Date.now();startGps()}updateLog();logDialog()};$('csvBtn').onclick=exportCsv;$('eraseBtn').onclick=()=>{if(confirm('Effacer le trajet et la distance enregistrée ?')){points=[];travel=0;localStorage.removeItem('nautic-v04-points');localStorage.removeItem('nautic-v04-travel');if(routeLine)routeLine.setLatLngs([]);updateLog();logDialog()}}}
let cameraStream=null;function cameraDialog(i){let key='cam'+i;modal('Caméra '+i,`<div class="viewer" id="viewer"><span id="camMessage">Flux local non configuré</span><img id="cameraImg" hidden alt="Flux caméra"><video id="cameraVideo" autoplay muted playsinline hidden></video></div>${field('Adresse HTTP d’un flux MJPEG ou d’une image locale', 'cameraUrl',cfg[key])}<p class="muted">Les flux RTSP Tapo TC47 ne sont pas directement lisibles par le navigateur : un relais local RTSP → WebRTC/MJPEG est nécessaire. Une page HTTPS peut bloquer un flux HTTP.</p><div class="dialogActions"><button id="saveCamera">Enregistrer / essayer</button><button id="fullCamera">Agrandir la vidéo</button><button id="deviceCam">Tester caméra tablette</button></div>`);$('saveCamera').onclick=()=>{cfg[key]=$('cameraUrl').value.trim();saveCfg();showCamUrl(cfg[key],i)};$('fullCamera').onclick=()=>$('viewer').requestFullscreen?.();$('deviceCam').onclick=async()=>{try{cameraStream?.getTracks().forEach(t=>t.stop());cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});$('cameraImg').hidden=true;$('cameraVideo').hidden=false;$('cameraVideo').srcObject=cameraStream;$('camMessage').hidden=true}catch(e){$('camMessage').textContent=e.message}};if(cfg[key])showCamUrl(cfg[key],i)}
function showCamUrl(u,i){if(!u)return;let img=$('cameraImg');img.hidden=false;img.src=u;img.onerror=()=>{$('camMessage').hidden=false;$('camMessage').textContent='Flux inaccessible ou format non pris en charge';img.hidden=true};img.onload=()=>{$('camMessage').hidden=true};let body=$('cam'+i+'Body');body.innerHTML='';let preview=document.createElement('img');preview.src=u;preview.alt='Aperçu caméra '+i;preview.style.cssText='width:100%;height:100%;object-fit:contain';preview.onerror=()=>{body.textContent='Caméra '+i+' : flux indisponible'};body.append(preview)}
function weatherDialog(){modal('Météo locale',`<p>Source : Open-Meteo, conditions actuelles près de la position GPS.</p><p>Vent : ${weather?Math.round(weather.wind_speed_10m)+' km/h, provenance '+Math.round(weather.wind_direction_10m)+'°':'non disponible'}</p><p>Actualisation automatique : <b>toutes les 10 minutes</b>, avec connexion Internet.</p><button id="refreshWind">Actualiser maintenant</button>`);$('refreshWind').onclick=()=>{loadWeather();$('dialog').close()}}
function speedDialog(){modal('Vitesse GPS','<p>Le cadran est gradué de <b>0 à 30 km/h</b>. La vitesse affichée provient du GPS.</p><p class="muted">La mesure peut être instable à très faible vitesse. Aucune vitesse fictive n’est affichée.</p>')}
function headingDialog(){modal('Cap et orientation','<p>La carte suit le cap de progression fourni par le GPS lorsque le bateau avance.</p><p class="muted">À l’arrêt, le dernier cap reste affiché. La rotation du fond Leaflet est expérimentale : ne pas s’y fier seule pour les manœuvres délicates.</p>')}
function keyClick(id,fn){let el=$(id);el.onclick=fn;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}}}
keyClick('gpsCard',sms);keyClick('boatCard',openBoat);keyClick('fuelCard',openFuel);keyClick('logCard',logDialog);keyClick('routeCard',logDialog);keyClick('speedCard',speedDialog);keyClick('headingCard',headingDialog);keyClick('weatherCard',weatherDialog);for(let i=1;i<=3;i++)keyClick('cam'+i+'Card',()=>cameraDialog(i));keyClick('miniMap',()=>{if(map&&latest)map.setView([latest.lat,latest.lon],16)});
$('dialog').addEventListener('close',()=>{cameraStream?.getTracks().forEach(t=>t.stop());cameraStream=null});initMap();startGps();


// Fullscreen with safe fallback: browser controls may remain on some mobile browsers.
const fullBtn=document.getElementById('fullscreenToggle');
fullBtn?.addEventListener('click',async()=>{try{if(document.fullscreenElement){await document.exitFullscreen()}else if(document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen()}else{fullBtn.title='Plein écran indisponible sur ce navigateur'}}catch(e){fullBtn.title='Plein écran refusé par le navigateur'}});
document.addEventListener('fullscreenchange',()=>{if(fullBtn)fullBtn.textContent=document.fullscreenElement?'⤢':'⛶';setTimeout(()=>{if(map)map.invalidateSize()},120)});
window.addEventListener('resize',()=>{if(map)requestAnimationFrame(()=>map.invalidateSize())});
window.addEventListener('orientationchange',()=>setTimeout(()=>{if(map)map.invalidateSize()},300));

(function(){
 const style=document.createElement('style');style.textContent=`
 #speedCard{position:relative;justify-self:center;align-self:stretch;max-width:100%;overflow:hidden}
 #speedCard .gaugeTop{font-variant-numeric:tabular-nums;font-size:clamp(29px,4.5vw,56px)!important;font-weight:800;text-shadow:0 0 13px #24b9e680;margin:0 auto 3px}
 #speedCard .arc{width:min(180px,88%);aspect-ratio:2/1;border:10px solid #153e53;border-bottom:0;border-radius:160px 160px 0 0;overflow:visible;box-shadow:0 -3px 12px #0e6a8b55}
 #speedCard .arc::before{border-color:#39d3ff;border-right-color:transparent;border-bottom:0;filter:drop-shadow(0 0 3px #26d6ff)}
 #speedCard .arcInner{font-size:13px;left:calc(50% - 5px);bottom:-6px;color:#f6dc76}
 #speedCard .speedScale{width:min(190px,94%);display:flex;justify-content:space-between;margin:3px auto 0;font-size:12px;font-weight:800;color:#c7eaf8}
 #speedCard .speedUnit{font-size:10px;opacity:.75;margin-top:2px}
 #weatherCard{cursor:pointer}
 `;document.head.appendChild(style);
 const card=$('speedCard'),old=card.querySelector('small');if(old)old.remove();
 const scale=document.createElement('div');scale.className='speedScale';scale.innerHTML='<span>0</span><span>30</span>';card.appendChild(scale);
 const unit=document.createElement('small');unit.className='speedUnit';unit.textContent='km/h';card.appendChild(unit);
 const weatherCard=$('weatherCard');weatherCard.title='Toucher pour actualiser le vent';weatherCard.addEventListener('click',()=>{if(!windBusy)loadWeather()});
 const wind=$('windWidget');if(wind){wind.style.pointerEvents='auto';wind.title='Toucher pour actualiser le vent';wind.addEventListener('click',()=>{if(!windBusy)loadWeather()})}
})();
