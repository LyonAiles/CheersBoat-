/* Compact dashboard and native local camera previews. */
(()=>{
 const $=id=>document.getElementById(id),bridge=window.NauticAndroid;
 const call=(name,...args)=>{if(bridge&&typeof bridge[name]==='function')return bridge[name](...args);};
 const icon=(id,symbol,label)=>{const e=$(id);if(!e)return;e.textContent=symbol;e.title=label;e.setAttribute('aria-label',label);};
 icon('nauticExitButton','⏻','Sortie');icon('nauticPlugsButton','🔌','Prises');icon('nauticContactsButton','☎↶','Derniers appels');
 const exit=$('nauticExitButton');if(exit)exit.innerHTML='<svg viewBox="0 0 24 24" width="25" height="25" aria-hidden="true"><path d="M12 2v9M6.3 5.5a8.5 8.5 0 1 0 11.4 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
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
 if(camera42){camera42.onclick=()=>{if(pending42||!bridge)return;pending42=true;call('toggleCamera42');};camera42.oncontextmenu=e=>{e.preventDefault();if(open42)open42.call(camera42,e);};}
 window.nauticCamera42Result=message=>{pending42=false;if(camera42)camera42.title=message||'';refresh();previews();};
 let pending=false,lastAlert=0,alarmUntil=0,activationUntil=0,resultUntil=0,resultText='';
 let extraNumbers={};try{extraNumbers=JSON.parse(call('readSetting','nautic-control-numbers')||localStorage.getItem('nautic-control-numbers')||'{}');}catch(_){}
 function numberButtons(){
  let enabled=true;try{enabled=JSON.parse(call('readSetting','nautic-extensions')||localStorage.getItem('nautic-extensions')||'{}').objectNumbers!==false;}catch(_){}
  if(!enabled){document.querySelectorAll('.nautic-object-tag').forEach(e=>e.remove());document.querySelectorAll('[data-object-number]').forEach(e=>e.dataset.objectNumber='');}
  const fixed={clock:10,nauticSettingsButton:20,nauticExitButton:21,nauticPlugsButton:22,gpsCard:31,boatCard:32,logCard:33,fuelCard:34,nauticCallsSlot:35,speedCard:36,weatherCard:37,headingCard:38,notesCard:39,mapWrap:40,cam1Card:41,cam2Card:42,cam3Card:43,trematageCard:44,mapGps:50,windWidget:51,compass:52,mapLayers:53,mapRecenter:54,fullscreenToggle:55,mapZoomIn:56,mapZoomOut:57};
  const zoomIn=document.querySelector('.leaflet-control-zoom-in'),zoomOut=document.querySelector('.leaflet-control-zoom-out');if(zoomIn)zoomIn.id='mapZoomIn';if(zoomOut)zoomOut.id='mapZoomOut';
  const elements=new Set(Object.keys(fixed).map($).filter(Boolean));for(const e of document.querySelectorAll('#app button,#app [role=button],#app .leaflet-bar a,#dialog button'))if(e.id!=='dashboardPhone')elements.add(e);
  for(const e of elements){if(!e.id)e.id='nauticControl'+[...document.querySelectorAll('#app button,#app [role=button],#app .leaflet-bar a,#dialog button')].indexOf(e);let n=fixed[e.id];if(n===undefined){if(!Number.isInteger(extraNumbers[e.id])||extraNumbers[e.id]<60){extraNumbers[e.id]=Math.max(59,...Object.values(extraNumbers).filter(x=>Number.isInteger(x)&&x>=60))+1;const saved=JSON.stringify(extraNumbers);if(bridge)call('writeSetting','nautic-control-numbers',saved);else try{localStorage.setItem('nautic-control-numbers',saved);}catch(_){}}n=extraNumbers[e.id];}e.dataset.objectNumber=enabled?String(n):'';let tag=[...e.children].find(x=>x.classList.contains('nautic-object-tag'));if(!enabled){tag?.remove();continue;}if(!tag){tag=document.createElement('span');tag.className='nautic-object-tag';e.appendChild(tag);}tag.textContent=String(n);if(getComputedStyle(e).position==='static')e.style.position='relative';tag.style.cssText='position:absolute;top:1px;left:1px;z-index:500;background:#ffe24b;color:#111;font:bold 10px Arial;border-radius:3px;padding:1px 3px;pointer-events:none';}
 }
 window.nauticNumberDashboard=()=>{numberButtons();previews();};
 function refresh(){try{
  const w=JSON.parse(call('camera42Status')||'{}');
  if(camera42){camera42.classList.toggle('trematage-active',!!w.active);camera42.setAttribute('aria-pressed',String(!!w.active));camera42.dataset.watchStatus=pending42?'Connexion…':w.active?'● Veille véhicule':'▶ Veille';}
  const s=JSON.parse(call('trematageStatus')||'{}');
  trematage.classList.toggle('trematage-active',!!s.active);trematage.setAttribute('aria-pressed',String(!!s.active));
  $('trematageIndicator').textContent=s.active?'●':'○';
  if(Number(s.alertTime)>lastAlert){lastAlert=Number(s.alertTime);if(Date.now()-lastAlert<30000)alarmUntil=lastAlert+30000;}
  activationUntil=Number(s.activationTime||0)+4000;
  trematage.classList.toggle('trematage-alert',Date.now()<alarmUntil||(s.active&&Date.now()<activationUntil));
  $('trematageState').textContent=pending?'Positionnement…':Date.now()<alarmUntil?(s.alert||'⚠'):Date.now()<resultUntil?resultText:s.active?'↶ BASE':'▶ Activer';
  trematage.setAttribute('aria-label',s.active?'Revenir à BASE':'Activer la position Trématage');
  trematage.title=(s.active?'Trématage actif':'Trématage inactif')+' · '+(s.status||'appui long pour régler');
 }catch(e){}}
 trematage.onclick=()=>{if(pending)return;if(!bridge){$('trematageState').textContent='Application Android requise';return;}pending=true;refresh();call('toggleTrematage');};
 trematage.oncontextmenu=e=>{e.preventDefault();call('openTrematageCamera');};
 trematage.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();trematage.click();}};
 window.nauticTrematageResult=message=>{pending=false;resultText=message||'';resultUntil=Date.now()+7000;refresh();previews();};
 window.nauticTrematageAlert=()=>{alarmUntil=Date.now()+30000;refresh();};
 window.nauticDashboardClick=id=>{if(id==='trematagePreview')trematage.click();else $(id.replace('Body','Card'))?.click();};
 window.nauticDashboardHold=id=>{if(id==='trematagePreview')call('openTrematageCamera');else $(id.replace('Body','Card'))?.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));};
 function previews(){
  if(!bridge)return;
  const hidden=document.hidden||document.querySelector('dialog[open]')||$('app')?.classList.contains('nautic-edit');
  const tiles=[];
  if(!hidden)for(const id of ['trematagePreview','cam1Body','cam2Body','cam3Body']){
   const e=$(id);if(!e||e.closest('[hidden],.nautic-hidden')||getComputedStyle(e).display==='none')continue;
   if(id!=='trematagePreview'){
    const index=id.charAt(3);let url='';try{url=JSON.parse(call('readSetting','nautic-v04')||'{}')['cam'+index]||'';}catch(_){}
    if(/^https?:\/\//i.test(url)){if(e.dataset.previewUrl!==url){const img=new Image();img.alt='Caméra '+index;img.src=url;e.replaceChildren(img);e.dataset.previewUrl=url;}continue;}
   }
   const r=e.getBoundingClientRect();if(r.width<2||r.height<2)continue;
   const card=e.closest('.camCard'),mobile=id==='trematagePreview';
   const heading=card?.querySelector('h3')?.cloneNode(true);heading?.querySelectorAll('.nautic-object-tag').forEach(t=>t.remove());
   tiles.push({id,x:r.left,y:r.top,w:r.width,h:r.height,label:mobile?'Trématage':heading?.textContent.trim()||'📷',number:card?.dataset.objectNumber||'',active:(mobile||id==='cam2Body')&&card.classList.contains('trematage-active'),alarm:mobile&&card.classList.contains('trematage-alert'),status:mobile?$('trematageState').textContent:id==='cam2Body'?camera42?.dataset.watchStatus||'':''});
  }
  call('dashboardPreviews',JSON.stringify({width:innerWidth,tiles}));
 }
 // Use real HTTP/MJPEG previews in web builds; Android handles RTSP without a relay.
 if(!bridge)for(let i=1;i<=3;i++){try{const saved=JSON.parse(localStorage.getItem('nautic-v04')||'{}'),url=saved['cam'+i];if(/^https?:\/\//i.test(url||'')){const img=new Image();img.alt='Caméra '+i;img.src=url;$('cam'+i+'Body').replaceChildren(img);}}catch(e){}}
 setInterval(()=>{numberButtons();refresh();previews();},800);
 window.nauticDashboardResume=()=>{refresh();for(let i=1;i<=3;i++){const e=$('cam'+i+'Body');if(e)delete e.dataset.previewUrl;}previews();};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)window.nauticDashboardResume();else previews();});window.addEventListener('resize',previews);
 new MutationObserver(previews).observe($('dialog'),{attributes:true,attributeFilter:['open']});
 numberButtons();refresh();previews();setTimeout(previews,200);setTimeout(previews,600);
})();
