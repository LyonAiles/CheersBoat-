/* Pause dashboard work, not map gesture processing or camera event surveillance. */
(()=>{
 const root=window,bridge=root.NauticAndroid;let releaseTimer=null,watchdog=null,pointers=new Set(),waiters=[];
 root.nauticMapInteracting=false;root.nauticQuietMode=false;
 // All camera moves (drag, city search, route overview) use the same free-pan flag.
 // Boat weather remains valid for the boat, never for a remotely explored location.
 let freePan=false;
 Object.defineProperty(root,'nauticMapFreePan',{configurable:true,
  get:()=>freePan,
  set:value=>{freePan=!!value;document.documentElement.classList.toggle('nautic-map-exploring',freePan);}
 });
 root.nauticMapFreePan=false;
 root.nauticDataUpdating=false;
 root.nauticSetDataUpdating=value=>{
  root.nauticDataUpdating=!!value;
  try{bridge?.mapInteraction?.(root.nauticDataUpdating||root.nauticQuietMode||root.nauticMapInteracting);}catch(_){}
  root.dispatchEvent(new Event('nauticdatapriority'));
  if(!root.nauticDataUpdating)root.nauticDashboardResume?.();
 };
 root.nauticEvery=(callback,delay,priority=false)=>setInterval(()=>{if(!root.nauticDataUpdating&&!root.nauticMapInteracting&&(!root.nauticQuietMode||priority))callback();},delay);
 root.nauticMapIdle=()=>root.nauticMapInteracting?new Promise(resolve=>waiters.push(resolve)):Promise.resolve();
 function finish(){clearTimeout(releaseTimer);clearTimeout(watchdog);pointers.clear();if(!root.nauticMapInteracting)return;root.nauticMapInteracting=false;try{bridge?.mapInteraction?.(root.nauticDataUpdating||root.nauticQuietMode);}catch(_){}for(const done of waiters.splice(0))done();if(root.nauticDeferredPosition){const p=root.nauticDeferredPosition;root.nauticDeferredPosition=null;onPos(p);}if(!root.nauticQuietMode)root.nauticDashboardResume?.();root.dispatchEvent(new Event('nauticmapidle'));}
 function begin(){clearTimeout(releaseTimer);clearTimeout(watchdog);if(!root.nauticMapInteracting){root.nauticMapInteracting=true;try{bridge?.mapInteraction?.(true);}catch(_){}root.dispatchEvent(new Event('nauticmapbusy'));}watchdog=setTimeout(finish,30000);}
 function end(){if(!pointers.size){clearTimeout(releaseTimer);releaseTimer=setTimeout(finish,650);}}
 function bind(){const el=document.getElementById('mapWrap');if(!el)return;
  el.addEventListener('pointerdown',e=>{if(e.target.closest?.('#mapCameraQuality'))return;pointers.add(e.pointerId);begin();},{capture:true,passive:true});
  root.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);end();},{capture:true,passive:true});root.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);end();},{capture:true,passive:true});
  el.addEventListener('pointermove',()=>{if(pointers.size)begin();},{passive:true});el.addEventListener('wheel',()=>{begin();end();},{capture:true,passive:true});
  root.addEventListener('blur',finish);document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
 }
 root.nauticResumeMapFollow=()=>{root.nauticMapFreePan=false;root.dispatchEvent(new Event('nauticmapfollow'));};
 root.nauticSetQuietMode=value=>{root.nauticQuietMode=!!value;try{bridge?.mapInteraction?.(root.nauticDataUpdating||root.nauticQuietMode||root.nauticMapInteracting);}catch(_){}if(!root.nauticQuietMode&&!root.nauticMapInteracting)root.nauticDashboardResume?.();root.dispatchEvent(new Event('nauticquietchange'));};
 root.nauticEndMapInteraction=finish;bind();
})();
