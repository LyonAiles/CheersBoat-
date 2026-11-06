/* Compact dashboard and native local camera previews. */
(()=>{
 const $=id=>document.getElementById(id),bridge=window.NauticAndroid;
 const call=(name,...args)=>{if(bridge&&typeof bridge[name]==='function')return bridge[name](...args);};
 const icon=(id,symbol,label)=>{const e=$(id);if(!e)return;e.textContent=symbol;e.title=label;e.setAttribute('aria-label',label);};
 icon('nauticExitButton','⏻','Sortie');icon('nauticPlugsButton','🔌','Prises');icon('nauticContactsButton','☎↶','Derniers appels');
 const headerControls=$('nauticHeaderControls'),contacts=$('nauticContactsButton');
 if(headerControls&&contacts)headerControls.appendChild(contacts);
 const slot=$('nauticCallsSlot');if(slot){slot.innerHTML='<button type="button" id="dashboardPhone" aria-label="Téléphone" title="Téléphone">☎</button>';$('dashboardPhone').onclick=()=>contacts?.click();}
 for(const [id,symbol,label] of [['gpsCard','🆘','Urgences'],['boatCard','⚓','Mon bateau'],['logCard','▤','Journal']]){
  const e=$(id);if(!e)continue;e.classList.add('dashboard-symbol');e.setAttribute('aria-label',label);e.title=label;
  const h=e.querySelector('h3');if(h)h.innerHTML='<span class="dashboard-symbol-icon" aria-hidden="true">'+symbol+'</span>';
 }
 const fuel=$('fuelCard');if(fuel){fuel.title='Consommation et autonomie';const h=fuel.querySelector('h3');if(h)h.textContent='⛽';fuel.classList.add('dashboard-fuel');}
 const right=document.querySelector('#app .right');
 const trematage=document.createElement('section');trematage.id='trematageCard';trematage.className='camCard click';trematage.tabIndex=0;trematage.setAttribute('role','button');trematage.setAttribute('aria-label','Activer ou désactiver Trématage');trematage.title='Trématage · toucher pour activer/désactiver · appui long pour régler';
 trematage.innerHTML='<h3><span aria-hidden="true">◀◀</span> <b>Trématage</b><span id="trematageIndicator">○</span></h3><div class="camBody" id="trematagePreview">📷</div><div id="trematageState" aria-live="polite">○</div>';
 right?.prepend(trematage);
 let pending=false,lastAlert=0,alarmUntil=0,activationUntil=0,resultUntil=0,resultText='';
 function refresh(){try{
  const s=JSON.parse(call('trematageStatus')||'{}');
  trematage.classList.toggle('trematage-active',!!s.active);trematage.setAttribute('aria-pressed',String(!!s.active));
  $('trematageIndicator').textContent=s.active?'●':'○';
  if(Number(s.alertTime)>lastAlert){lastAlert=Number(s.alertTime);if(Date.now()-lastAlert<30000)alarmUntil=lastAlert+30000;}
  activationUntil=Number(s.activationTime||0)+4000;
  trematage.classList.toggle('trematage-alert',Date.now()<alarmUntil||(s.active&&Date.now()<activationUntil));
  $('trematageState').textContent=pending?'Positionnement…':Date.now()<alarmUntil?(s.alert||'⚠'):Date.now()<resultUntil?resultText:s.active?'↶ Revenir':'▶ Activer';
  trematage.setAttribute('aria-label',s.active?'Revenir à la position précédente':'Activer la position Trématage');
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
   tiles.push({id,x:r.left,y:r.top,w:r.width,h:r.height,label:mobile?'Trématage':heading?.textContent.trim()||'📷',active:mobile&&card.classList.contains('trematage-active'),alarm:mobile&&card.classList.contains('trematage-alert'),status:mobile?$('trematageState').textContent:''});
  }
  call('dashboardPreviews',JSON.stringify({width:innerWidth,tiles}));
 }
 // Use real HTTP/MJPEG previews in web builds; Android handles RTSP without a relay.
 if(!bridge)for(let i=1;i<=3;i++){try{const saved=JSON.parse(localStorage.getItem('nautic-v04')||'{}'),url=saved['cam'+i];if(/^https?:\/\//i.test(url||'')){const img=new Image();img.alt='Caméra '+i;img.src=url;$('cam'+i+'Body').replaceChildren(img);}}catch(e){}}
 setInterval(()=>{refresh();previews();},800);
 window.nauticDashboardResume=()=>{refresh();for(let i=1;i<=3;i++){const e=$('cam'+i+'Body');if(e)delete e.dataset.previewUrl;}previews();};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)window.nauticDashboardResume();else previews();});window.addEventListener('resize',previews);
 new MutationObserver(previews).observe($('dialog'),{attributes:true,attributeFilter:['open']});
 refresh();previews();setTimeout(previews,200);setTimeout(previews,600);
})();
