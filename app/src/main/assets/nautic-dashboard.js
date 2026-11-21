/* Compact dashboard and native local camera previews. */
(()=>{
 const $=id=>document.getElementById(id),bridge=window.NauticAndroid;
 const call=(name,...args)=>{if(bridge&&typeof bridge[name]==='function')return bridge[name](...args);};
 const icon=(id,symbol,label)=>{const e=$(id);if(!e)return;e.textContent=symbol;e.title=label;e.setAttribute('aria-label',label);};
 icon('nauticExitButton','−','Réduire Nautic');icon('nauticPlugsButton','🔌','Prises');icon('nauticContactsButton','☎↶','Derniers appels');
 const exit=$('nauticExitButton');if(exit)exit.innerHTML='<svg viewBox="0 0 24 24" width="25" height="25" aria-hidden="true"><path d="M5 15h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
 const compass=$('compass');if(compass){for(const node of [...compass.childNodes])if(node.nodeType===3)node.remove();compass.title='Orientation de la carte';compass.setAttribute('aria-label','Orientation de la carte');}
 const headerControls=$('nauticHeaderControls'),contacts=$('nauticContactsButton');
 if(contacts)contacts.remove();
 const slot=$('nauticCallsSlot');if(slot){slot.innerHTML='<button type="button" id="dashboardPhone" aria-label="Téléphone" title="Téléphone">☎</button>';$('dashboardPhone').onclick=()=>contacts?.click();}
 for(const [id,symbol,label] of [['gpsCard','🆘','Urgences'],['boatCard','⚓','Mon bateau'],['logCard','▤','Journal']]){
  const e=$(id);if(!e)continue;e.classList.add('dashboard-symbol');e.setAttribute('aria-label',label);e.title=label;
  const h=e.querySelector('h3');if(h)h.innerHTML='<span class="dashboard-symbol-icon" aria-hidden="true">'+symbol+'</span>';
 }
 const fuel=$('fuelCard');if(fuel){fuel.title='Consommation et autonomie';const h=fuel.querySelector('h3');if(h)h.textContent='⛽';fuel.classList.add('dashboard-fuel');}
 const notes=document.createElement('section');notes.id='notesCard';notes.className='card click dashboard-symbol';notes.tabIndex=0;notes.setAttribute('role','button');notes.setAttribute('aria-label','Bloc-notes');notes.title='Bloc-notes';notes.innerHTML='<h3><span class="dashboard-symbol-icon" aria-hidden="true">📝</span></h3>';
 notes.onclick=()=>{if(bridge)call('openNotes');else alert('Le bloc-notes est disponible dans l’application Android.');};notes.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();notes.click();}};
 const left=document.querySelector('#app .left');if(slot){slot.classList.add('card','click');slot.title='Téléphone';}
 document.querySelector('.mapFoot')?.remove();
 const right=document.querySelector('#app .right');
 const trematage=document.createElement('section');trematage.id='trematageCard';trematage.className='camCard click';trematage.tabIndex=0;trematage.setAttribute('role','button');trematage.setAttribute('aria-label','Activer ou désactiver Trématage');trematage.title='Trématage · toucher pour activer/désactiver · appui long pour régler';
 trematage.innerHTML='<h3><span aria-hidden="true">◀◀</span> <b>Trématage</b><span id="trematageIndicator">○</span></h3><div class="camBody" id="trematagePreview">📷</div><div id="trematageState" aria-live="polite">○</div>';
 window.nauticArrangeDashboard=()=>{
  if(left){for(const id of ['gpsCard','boatCard','fuelCard','logCard'])if($(id))left.appendChild($(id));if(slot)left.appendChild(slot);left.appendChild(notes);}
  const gauges=document.querySelector('#app .gauges');if(gauges&&$('speedCard'))gauges.insertBefore(trematage,$('speedCard'));
 };
 window.nauticArrangeDashboard();
 const camera42=$('cam2Card'),open42=camera42?.onclick;
 let pending42=false;
 window.nauticBindCamera42=()=>{for(const index of [1,3]){const card=$('cam'+index+'Card');if(!card)continue;card.onclick=()=>call('openDashboardCamera',index);card.oncontextmenu=e=>{e.preventDefault();call('openCameraMosaic');};card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}};}if(camera42){camera42.onclick=()=>{if(pending42||!bridge)return;pending42=true;call('toggleCamera42');};camera42.oncontextmenu=e=>{e.preventDefault();if(open42)open42.call(camera42,e);};camera42.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();camera42.click();}};}};window.nauticBindCamera42();
 window.nauticCamera42Result=message=>{pending42=false;if(camera42)camera42.title=message||'';refresh();previews();};
 let pending=false,pendingSince=0,lastAlert42=0,lastPresentedAlert=0,lastAlert=0,alarmUntil=0,activationUntil=0,resultUntil=0,resultText='';
 let extraNumbers={};try{extraNumbers=JSON.parse(call('readSetting','nautic-control-numbers')||localStorage.getItem('nautic-control-numbers')||'{}');}catch(_){}
 const fixedNumbers={clock:10,clockDate:11,nauticSettingsButton:20,nauticExitButton:21,nauticPlugsButton:22,gpsCard:31,boatCard:32,logCard:33,fuelCard:34,nauticCallsSlot:35,speedCard:36,weatherCard:37,headingCard:38,notesCard:39,nativeNotesCarry:391,mapWrap:40,cam1Card:41,cam2Card:42,cam3Card:43,trematageCard:44,mapCameraPort:45,mapCameraPreview:46,mapCameraStarboard:47,mapCameraQuality:146,mapCameraAxis:148,mapCameraCaptureMenu:149,mapCameraMedallionToggle:147,nauticSignButton:583,waterwayCall:584,waterwayWebsite:585,nauticRefreshWorks:586,nauticDataCounter:587,nauticRefreshWork:588,nauticRefreshNotices:589,mapGps:50,windWidget:51,compass:52,mapLayers:53,mapRecenter:54,fullscreenToggle:55,mapZoomIn:56,mapZoomOut:57,nauticDestinationStatus:58,nauticAccessibleStatus:59,sondeurReplay:294,sondeurToggle:297,sondeurOptions:299};
 const reservedNumbers=new Set(Object.values(fixedNumbers));
 const hiddenNumbers=new Set([87,586,587]);
 const controls='button,[role=button],input:not([type=hidden]),select,textarea,summary,.leaflet-bar a';
 function numberButtons(){
  let enabled=true;try{enabled=JSON.parse(call('readSetting','nautic-extensions')||localStorage.getItem('nautic-extensions')||'{}').objectNumbers!==false;}catch(_){}
  document.querySelector('.leaflet-control-zoom-in')?.setAttribute('id','mapZoomIn');
  document.querySelector('.leaflet-control-zoom-out')?.setAttribute('id','mapZoomOut');
  const extras=['app','dialog','nauticWeatherPopup'].flatMap(id=>[...($(id)?.querySelectorAll(controls)||[])]);
  const entries=new Map(Object.keys(fixedNumbers).map(id=>[$(id),id]).filter(([node])=>node));
  extras.forEach((node,i)=>{
   if(node.id==='dashboardPhone'||entries.has(node))return; // The phone already carries its container number.
   entries.set(node,node.id||'#'+(node.closest('dialog')?.querySelector('h2')?.textContent||'tableau')+'/'+i);
  });
  let next=Math.max(59,...reservedNumbers,...Object.values(extraNumbers).filter(Number.isInteger))+1;
  let dirty=false;
  for(const [node,key] of entries){
   let number=fixedNumbers[key];
   if(number===undefined&&enabled){
    if(!Number.isInteger(extraNumbers[key])||extraNumbers[key]<60||reservedNumbers.has(extraNumbers[key])){
     extraNumbers[key]=next++;
     dirty=true;
    }
    number=extraNumbers[key];
   }
   // Resolve saved identifiers even when the number badges are switched off.
   node.classList.toggle('nautic-control-hidden',hiddenNumbers.has(number??extraNumbers[key]));
   node.dataset.objectNumber=enabled?String(number):'';
   const field=node.matches('input,select,textarea');
   if(field){
    let tag=node.previousElementSibling;
    if(!tag?.classList.contains('nautic-field-number'))tag=null;
    if(!enabled){tag?.remove();continue;}
    if(!tag){tag=document.createElement('span');tag.className='nautic-object-tag nautic-field-number';node.before(tag);}
    tag.setAttribute('aria-hidden','true');
    if(tag.textContent!==String(number))tag.textContent=String(number);
    continue;
   }
   let tag=[...node.children].find(child=>child.classList.contains('nautic-object-tag')&&!child.classList.contains('nautic-field-number'));
   if(!enabled){tag?.remove();continue;}
   if(!tag){tag=document.createElement('span');tag.className='nautic-object-tag';tag.setAttribute('aria-hidden','true');node.appendChild(tag);}
   if(tag.textContent!==String(number))tag.textContent=String(number);
   if(getComputedStyle(node).position==='static')node.style.position='relative';
  }
  if(dirty){
   const saved=JSON.stringify(extraNumbers);
   if(bridge)call('writeSetting','nautic-control-numbers',saved);
   else try{localStorage.setItem('nautic-control-numbers',saved);}catch(_){}
  }
  const directory=$('nauticNumberDirectory');
  if(directory)directory.textContent=enabled?'41–43 · Caméras | 45 · Médaillon gauche | 46 · Vue centrale | 47 · Médaillon droit | 48 · Objectif central':'';
 }
 window.nauticNumberDashboard=()=>{numberButtons();previews();};
 function refresh(){try{
  const w=JSON.parse(call('camera42Status')||'{}');
  if(camera42){camera42.classList.toggle('trematage-active',!!w.active);camera42.setAttribute('aria-pressed',String(!!w.active));camera42.dataset.watchStatus=pending42?'Connexion…':w.active?'● Veille active':'▶ Veille';}
  const s=JSON.parse(call('trematageStatus')||'{}');
  if(Number(w.alertTime)>lastAlert42){lastAlert42=Number(w.alertTime);if(Date.now()-lastAlert42<30000)showAlertCamera(42,s.index,lastAlert42);}
  if(pending&&s.busy===false&&Date.now()-pendingSince>2000)pending=false;
  trematage.classList.toggle('trematage-active',!!s.active);trematage.setAttribute('aria-pressed',String(!!s.active));
  $('trematageIndicator').textContent=s.active?'●':'○';
  if(Number(s.alertTime)>lastAlert){
   lastAlert=Number(s.alertTime);
   if(Date.now()-lastAlert<30000){alarmUntil=lastAlert+30000;showAlertCamera(44,s.index,lastAlert);}
  }
  activationUntil=Number(s.activationTime||0)+4000;
  trematage.classList.toggle('trematage-alert',Date.now()<alarmUntil||(s.active&&Date.now()<activationUntil));
  $('trematageState').textContent=pending?'Positionnement…':Date.now()<alarmUntil?(s.alert||'⚠'):Date.now()<resultUntil?resultText:s.active?'↶ BASE':'▶ Activer';
  trematage.setAttribute('aria-label',s.active?'Revenir à BASE':'Activer la position Trématage');
  trematage.title=(s.active?'Trématage actif':'Trématage inactif')+' · '+(s.status||'appui long pour régler');
 }catch(e){}}
 trematage.onclick=()=>{if(pending)return;if(!bridge){$('trematageState').textContent='Application Android requise';return;}pending=true;pendingSince=Date.now();refresh();try{if(typeof bridge.toggleTrematage!=='function')throw new Error('Commande Trématage indisponible');call('toggleTrematage');}catch(e){window.nauticTrematageResult(e.message);}};
 trematage.oncontextmenu=e=>e.preventDefault();
 trematage.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();trematage.click();}};
 window.nauticTrematageResult=message=>{pending=false;resultText=message||'';resultUntil=Date.now()+7000;refresh();previews();};
 window.nauticTrematageAlert=()=>{
  alarmUntil=Date.now()+30000;
  refresh();
  const status=JSON.parse(call('trematageStatus')||'{}');
  showAlertCamera(44,status.index,Number(status.alertTime)||Date.now());
 };
 window.nauticCameraAlert=payload=>{
  try{
   const event=JSON.parse(payload),number=Number(event.number);
   if(number!==42&&number!==44)return;
   const status=JSON.parse(call('trematageStatus')||'{}');
   if(number===44)alarmUntil=Date.now()+30000;
   refresh();showAlertCamera(number,status.index,Number(event.time)||Date.now());
  }catch(_){}
 };
 const mapCamera=document.createElement('div');
 mapCamera.hidden=true;
 const leftMedallion='mapCameraPort', centerView='mapCameraPreview', rightMedallion='mapCameraStarboard';
 let swappedMedallion=null;
 const mapViews=[centerView,leftMedallion,rightMedallion]; // Draw the medallions above the central image.
 const feeds={
  [leftMedallion]:{camera:1},
  [centerView]:{camera:2,lens:2},
  [rightMedallion]:{camera:3}
 };
 for(const id of mapViews){
  const view=document.createElement('div');
  view.id=id;
  view.className='map-camera-view';
  view.setAttribute('role','button');
  view.tabIndex=0;
  view.onclick=()=>activateMapView(id);
  view.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();view.click();}};
  const label=document.createElement('span');
  label.className='map-camera-label';
  label.setAttribute('aria-hidden','true');
  view.append(label);
  mapCamera.append(view);
 }
 mapCamera.id='mapCameraOverlay';
 const qualityTool=document.createElement('button');
 qualityTool.type='button';qualityTool.id='mapCameraQuality';qualityTool.hidden=true;
 qualityTool.title='Qualité vidéo commune aux objectifs';
 qualityTool.setAttribute('aria-label',qualityTool.title);
 const qualityKey='nautic-map-camera-quality';
 let mapHd=false;
 try{mapHd=(call('readSetting',qualityKey)||localStorage.getItem(qualityKey))==='hd';}catch(_){}
 qualityTool.onclick=()=>{
  mapHd=!mapHd;
  try{
   if(bridge)call('writeSetting',qualityKey,mapHd?'hd':'sd');
   else localStorage.setItem(qualityKey,mapHd?'hd':'sd');
  }catch(_){}
  refreshMapViews();previews();
 };
 const medallionTool=document.createElement('button');
 medallionTool.type='button';medallionTool.id='mapCameraMedallionToggle';
 medallionTool.textContent='◉';medallionTool.setAttribute('aria-label','Afficher ou masquer les médaillons');medallionTool.hidden=true;
 medallionTool.onclick=()=>window.nauticToggleMapMedallions();
 const axisTool=document.createElement('button');
 axisTool.type='button';axisTool.id='mapCameraAxis';axisTool.hidden=true;
 axisTool.textContent='✥';
 axisTool.setAttribute('aria-label','Positions de l’objectif mobile');
 axisTool.onclick=openAxisMenu;
 const captureTool=document.createElement('button');
 captureTool.id='mapCameraCaptureMenu';captureTool.type='button';captureTool.hidden=true;
 captureTool.textContent='📷';captureTool.setAttribute('aria-label','Photo, vidéo et captures');
 captureTool.onclick=()=>call('cameraCapture','menu');
 $('mapWrap').append(mapCamera,qualityTool,medallionTool,axisTool,captureTool);
 function refreshAxis(){
  axisTool.hidden=!bridge?.openCameraOrientations||mapCamera.hidden||mapCamera.classList.contains('nautic-hidden');
 }
 function openAxisMenu(){
  if(!mapCamera.hidden&&!mapCamera.classList.contains('nautic-hidden'))
   call('openCameraOrientations',feeds[centerView].camera);
 }
 let mapCameraAlpha=1;
 function cameraConfig(){
  try{return JSON.parse(call('readSetting','nautic-v04')||localStorage.getItem('nautic-v04')||'{}');}
  catch(_){return {};}
 }
 const lensPath=/\/stream([1267])(?=[?#]|$)/i;
 function currentLens(feed){
  if(feed.lens)return feed.lens;
  const url=cameraConfig()['cam'+feed.camera]||'';
  const match=url.match(lensPath);
  if(feed.camera===2||feed.camera===1&&(!url||match)||match&&/[67]/.test(match[1])){
   return match&&/[67]/.test(match[1])?1:2;
  }
  return 0;
 }
 function refreshMapViews(){
  for(const id of mapViews){
   const view=$(id);
   const camera=40+feeds[id].camera;
   const label=id===centerView?'Vue centrale':'Médaillon '+(id===leftMedallion?'gauche':'droit');
   view.setAttribute('aria-label',label+' · caméra '+camera+(id===centerView?'':' · échanger avec la vue centrale'));
   view.querySelector('.map-camera-label').textContent=String(camera);
  }
  qualityTool.hidden=mapCamera.hidden||mapCamera.classList.contains('nautic-hidden');
  medallionTool.hidden=mapCamera.hidden||mapCamera.classList.contains('nautic-hidden');
  medallionTool.setAttribute('aria-pressed',String(!$('app').classList.contains('hide-mapCameraMedallions')));
  refreshAxis();
  qualityTool.textContent='▧';
  qualityTool.title='Qualité vidéo · '+(mapHd?'HD':'SD');qualityTool.setAttribute('aria-label',qualityTool.title);
  qualityTool.setAttribute('aria-pressed',String(mapHd));
 }
 function switchMapCamera(){
  const feed=feeds[centerView],lens=currentLens(feed);
  if(mapCamera.hidden||mapCamera.classList.contains('nautic-hidden')||!lens)return;
  feeds[centerView]={...feed,lens:3-lens};
  previews();
 }
 let centerReset=0;
 function restoreMedallion(){
  centerReset++;
  if(!swappedMedallion)return;
  [feeds[centerView],feeds[swappedMedallion]]=[feeds[swappedMedallion],feeds[centerView]];
  swappedMedallion=null;
 }
 function showAlertCamera(number,index,time){
  if(time<=lastPresentedAlert)return;
  lastPresentedAlert=time;
  restoreMedallion();
  const mobile=number===42,camera=mobile?Number(index):2;
  feeds[centerView]={camera:[1,2,3].includes(camera)?camera:1,lens:mobile?1:2};
  mapCamera.hidden=false;
  mapCamera.classList.remove('nautic-hidden');
  speedCard.setAttribute('aria-pressed','true');
  refreshMapViews();
  previews(true);
 }
 function activateMapView(id){
  if(mapCamera.hidden||mapCamera.classList.contains('nautic-hidden'))return;
  if(id===centerView){
   if(!dragged)switchMapCamera();
   dragged=false;
   return;
  }
  if($('app')?.classList.contains('hide-mapCameraMedallions'))return;
  const previous=swappedMedallion;
  restoreMedallion();
  if(previous!==id){
   [feeds[centerView],feeds[id]]=[feeds[id],feeds[centerView]];
   swappedMedallion=id;
  }
  refreshMapViews();
  previews();
 }
 window.addEventListener('nauticvisibility',()=>{
  if($('app')?.classList.contains('hide-mapCameraMedallions'))restoreMedallion();
  refreshMapViews();
  previews(true);
 });
 refreshMapViews();
 window.nauticMapCameraAlpha=value=>{
  mapCameraAlpha=Number(value);
  mapCamera.style.opacity=mapCameraAlpha;
 };
 const center=$('mapCameraPreview');
 let drag=null;
 let dragged=false;
 let axisHold=null;
 let axisPressed=false;
 function cancelAxisHold(){clearTimeout(axisHold);axisHold=null;}
 center.oncontextmenu=e=>e.preventDefault();
 center.onpointerdown=e=>{
  if(e.button!==0||!e.isPrimary)return;
  dragged=false;axisPressed=false;
  const bounds=center.getBoundingClientRect();
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,alpha:mapCameraAlpha,
   center:Math.abs(e.clientX-bounds.left-bounds.width/2)<=bounds.width/6};
  center.setPointerCapture(e.pointerId);
  cancelAxisHold();
  axisHold=setTimeout(()=>{axisPressed=true;openAxisMenu();},600);
 };
 center.onpointermove=e=>{
  if(drag?.id!==e.pointerId||axisPressed)return;
  const delta=e.clientY-drag.y;
  if(Math.hypot(e.clientX-drag.x,delta)>8)cancelAxisHold();
  if(drag.center&&(dragged||Math.abs(delta)>8)){
   dragged=true;
   window.nauticMapCameraAlpha(Math.max(.15,Math.min(1,drag.alpha+delta/center.clientHeight)));
  }
 };
 center.onpointerup=()=>{cancelAxisHold();drag=null;if(axisPressed)dragged=true;};
 center.onpointercancel=()=>{cancelAxisHold();drag=null;dragged=false;};
 const speedCard=$('speedCard');
 speedCard.setAttribute('aria-pressed','false');
 function toggleMapCamera(){
  if(mapCamera.classList.contains('nautic-hidden'))return;
  mapCamera.hidden=!mapCamera.hidden;
  refreshMapViews();
  speedCard.setAttribute('aria-pressed',String(!mapCamera.hidden));
  previews();
 }
 speedCard.onclick=toggleMapCamera;
 speedCard.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleMapCamera();}};
 window.addEventListener('DOMContentLoaded',()=>{
  const settings=$('sondeurSettings');
  if(settings)new MutationObserver(previews).observe(settings,{attributes:true,attributeFilter:['hidden']});
 });
 window.nauticDashboardClick=id=>{if(id===qualityTool.id||id===medallionTool.id||id===axisTool.id||id===captureTool.id)$(id).click();else if(id===centerView)switchMapCamera();else if(mapViews.includes(id))activateMapView(id);else if(id==='trematagePreview')trematage.click();else $(id.replace('Body','Card'))?.click();};
 window.nauticDashboardHold=id=>{if(id===centerView)openAxisMenu();else if(id==='trematagePreview')return;else $(id.replace('Body','Card'))?.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));};
 const clampCrop=value=>Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;
 const cropKey=camera=>'nautic-camera-crop-'+camera;
 const liveCrops=new Map();
 function readCrop(camera){
  let value='';
  try{value=call('readSetting',cropKey(camera))||localStorage.getItem(cropKey(camera))||'';}catch(_){}
  const [x,y]=value.split(',').map(Number);
  return liveCrops.get(Number(camera))||{x:clampCrop(x),y:clampCrop(y)};
 }
 function showCrop(view,camera){
  if(!camera){view.style.removeProperty('--camera-position');return;}
  const {x,y}=readCrop(camera);
  view.style.setProperty('--camera-position',`${50-50*x}% ${50-50*y}%`);
 }
 for(const id of [leftMedallion,rightMedallion]){
  const view=$(id);
  let gesture=null,suppressClick=false;
  view.addEventListener('pointerdown',event=>{
   if(event.button!==0||!event.isPrimary||!view.querySelector('img'))return;
   suppressClick=false;
   const camera=feeds[id].camera;
   gesture={id:event.pointerId,camera,x:event.clientX,y:event.clientY,initial:readCrop(camera),dragged:false};
  });
  view.addEventListener('pointermove',event=>{
   if(gesture?.id!==event.pointerId)return;
   const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
   if(!gesture.dragged){
    if(Math.hypot(dx,dy)<=8)return;
    gesture.dragged=true;
    view.setPointerCapture(event.pointerId);
   }
   const bounds=view.getBoundingClientRect();
   liveCrops.set(gesture.camera,{x:clampCrop(gesture.initial.x+2*dx/Math.max(1,bounds.width)),
    y:clampCrop(gesture.initial.y+2*dy/Math.max(1,bounds.height))});
   showCrop($('cam'+gesture.camera+'Body'),gesture.camera);
   for(const slot of mapViews)if(feeds[slot].camera===gesture.camera)showCrop($(slot),gesture.camera);
  });
  function finishCrop(event){
   if(gesture?.id!==event.pointerId)return;
   suppressClick=gesture.dragged&&event.type==='pointerup';
   if(suppressClick){
    const {x,y}=liveCrops.get(gesture.camera);
    const value=x+','+y;
    try{
     if(bridge)call('writeSetting',cropKey(gesture.camera),value);
     else localStorage.setItem(cropKey(gesture.camera),value);
    }catch(_){}
   }
   liveCrops.delete(gesture.camera);gesture=null;previews();
  }
  view.addEventListener('pointerup',finishCrop);
  view.addEventListener('pointercancel',finishCrop);
  view.addEventListener('click',event=>{
   if(!suppressClick||!event.detail)return;
   suppressClick=false;
   event.stopImmediatePropagation();
  },true);
 }

 const previewViews=['cam1Body','cam2Body','cam3Body',...mapViews];
 const retryHttp=new Set();
 function clearHttpStill(view){view.querySelector('.camera-still')?.remove();}
 function freezeHttpPreviews(){
  for(const id of previewViews){
   const view=$(id),img=view.querySelector('img');
   if(!view.dataset.previewUrl)continue;
   retryHttp.add(id);
   if(!img?.naturalWidth||!img.naturalHeight||view.querySelector('.camera-still'))continue;
   const still=document.createElement('canvas');
   const scale=Math.min(1,320/Math.max(img.naturalWidth,img.naturalHeight));
   still.width=Math.max(1,Math.round(img.naturalWidth*scale));
   still.height=Math.max(1,Math.round(img.naturalHeight*scale));
   still.className='camera-still';
   still.setAttribute('aria-hidden','true');
   try{
    still.getContext('2d').drawImage(img,0,0,still.width,still.height);
    img.after(still);
   }catch(_){}
  }
 }
 function updateHttpPreview(view,url,index){
  const changed=view.dataset.previewUrl!==url;
  const retry=retryHttp.delete(view.id);
  if(!changed&&!retry){
   if(view.querySelector('img')?.naturalWidth)clearHttpStill(view);
   return;
  }
  if(changed)clearHttpStill(view);
  const img=new Image();
  img.alt='Caméra '+(40+Number(index));img.draggable=false;
  img.onload=()=>{if(!document.hidden&&img.parentElement===view)clearHttpStill(view);};
  img.src=url;
  const previous=view.querySelector('img');
  if(previous)previous.replaceWith(img);
  else if(view.classList.contains('map-camera-view'))view.prepend(img);
  else view.replaceChildren(img);
  view.dataset.previewUrl=url;
 }

 function previews(force=false){
  const sonarSettings=$('sondeurSettings');
  const settingsOpen=sonarSettings&&!sonarSettings.hidden;
  mapCamera.style.visibility=settingsOpen?'hidden':'';
  const hidden=settingsOpen||document.hidden||document.querySelector('dialog[open]')||$('app')?.classList.contains('nautic-edit');
  qualityTool.hidden=!!hidden||mapCamera.hidden||mapCamera.classList.contains('nautic-hidden');
  medallionTool.hidden=!!hidden||mapCamera.hidden||mapCamera.classList.contains('nautic-hidden');
  refreshAxis();
  if(hidden)axisTool.hidden=true;
  const centralUrl=cameraConfig()['cam'+feeds[centerView].camera]||'';
  const captureHidden=!!hidden||mapCamera.hidden||mapCamera.classList.contains('nautic-hidden')||!bridge?.cameraCapture;
  captureTool.hidden=captureHidden||(/^https?:/i.test(centralUrl)&&!call('hasLatestCameraVideo'));
  if(!hidden&&window.nauticQuietMode&&force!==true)return;
  const tiles=[];
  const config=cameraConfig();
  if(!hidden)for(const id of ['trematagePreview',...previewViews]){
   const feed=feeds[id],inMap=!!feed;
   const e=$(id);
   if(!e||e.closest('[hidden],.nautic-hidden')||getComputedStyle(e).display==='none')continue;
   const mobile=id==='trematagePreview';
   if(!mobile){
    const index=feed?.camera||id.charAt(3);
    let url=config['cam'+index]||'';
    if(inMap&&/^https?:/i.test(url)){
     url=url.replace(lensPath,(_,stream)=>{
      const mobile=feed.lens?feed.lens===1:/[67]/.test(stream);
      return '/stream'+(mobile?(mapHd?6:7):(mapHd?1:2));
     });
    }
    if(/^https?:\/\//i.test(url)){
     showCrop(e,index);
     updateHttpPreview(e,url,index);
     continue;
    }
    if(e.dataset.previewUrl){e.querySelector('img')?.remove();clearHttpStill(e);delete e.dataset.previewUrl;}
   }
   const r=e.getBoundingClientRect();if(r.width<2||r.height<2)continue;
   const card=e.closest('.camCard');
   const heading=card?.querySelector('h3')?.cloneNode(true);heading?.querySelectorAll('.nautic-object-tag').forEach(t=>t.remove());
   tiles.push({id,x:r.left,y:r.top,w:r.width,h:r.height,camera:feed?.camera,lens:feed?.lens,
    label:mobile?'Trématage':heading?.textContent.trim()||'📷',number:(inMap?e:card)?.dataset.objectNumber||'',
    active:(mobile||id==='cam2Body')&&card.classList.contains('trematage-active'),
    alarm:mobile&&card.classList.contains('trematage-alert'),status:mobile?$('trematageState').textContent:id==='cam2Body'?camera42?.dataset.watchStatus||'':''});
  }
  const controlBounds=control=>{
   const r=control.getBoundingClientRect();
   const caption=control.cloneNode(true);caption.querySelectorAll('.nautic-object-tag').forEach(tag=>tag.remove());
   return !control.hidden&&!control.classList.contains('nautic-hidden')&&r.width>0
    ?{x:r.left,y:r.top,w:r.width,h:r.height,label:caption.textContent,number:control.dataset.objectNumber,
      pressed:control.getAttribute('aria-pressed')==='true'}:null;
  };
  call('dashboardPreviews',JSON.stringify({width:innerWidth,mapCameraAlpha,mapHd,centerReset,tiles,
   qualityButton:controlBounds(qualityTool),medallionButton:controlBounds(medallionTool),axisButton:controlBounds(axisTool),
   captureButton:controlBounds(captureTool)}));
 }
 window.nauticEvery(()=>{numberButtons();refresh();previews();},800);
 window.nauticDashboardResume=()=>{if(window.nauticDataUpdating)return;if(window.nauticQuietMode){previews();return;}refresh();previews();};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)window.nauticDashboardResume();else{freezeHttpPreviews();previews();}});window.addEventListener('resize',previews);
 new MutationObserver(previews).observe($('dialog'),{attributes:true,attributeFilter:['open']});
 numberButtons();refresh();previews();setTimeout(previews,200);setTimeout(previews,600);
})();
