/* Reveal the local dashboard only after its actual layout has settled. */
(()=>{
 const ids=['app','clock','gpsCard','boatCard','fuelCard','logCard','notesCard','speedCard','weatherCard','mapWrap','trematageCard','cam1Card','cam2Card','cam3Card'];
 function begin(){
  window.nauticArrangeDashboard?.();window.nauticNumberDashboard?.();
  let previous='',stableSince=performance.now();
  function measure(){
   if(document.hidden){requestAnimationFrame(measure);return;}
   const nodes=ids.map(id=>document.getElementById(id));
   if(nodes.some(node=>!node)){requestAnimationFrame(measure);return;}
   const signature=nodes.map(node=>{
    const r=node.getBoundingClientRect();return [node.id,r.x,r.y,r.width,r.height].map(v=>typeof v==='number'?Math.round(v):v).join(',');
   }).join('|')+'|'+innerWidth+'|'+innerHeight;
   const now=performance.now();
   if(signature!==previous){previous=signature;stableSince=now;}
   if(now-stableSince<250){requestAnimationFrame(measure);return;}
   document.documentElement.classList.remove('nautic-starting');
   requestAnimationFrame(()=>{
    window.nauticDashboardResume?.();
    window.NauticAndroid?.dashboardReady?.();
   });
  }
  requestAnimationFrame(measure);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});else begin();
})();
