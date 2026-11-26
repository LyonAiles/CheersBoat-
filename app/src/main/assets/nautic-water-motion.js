/* Idle animation owns only transient display values, never persisted settings. */
(()=>{
 const root=document.documentElement;
 let base=30,ready=false,timer=0,frame=0,started=0,lastPaint=0,down=false;
 const clamp=n=>Math.max(0,Math.min(80,n));
 const paint=value=>{
  const opacity=1-clamp(value)/100;
  root.style.setProperty('--nautic-dashboard-opacity',String(opacity));
  root.style.setProperty('--nautic-chart-opacity',String(1-Math.max(0,clamp(value)-15)/100));
  try{window.NauticAndroid?.dashboardOpacity?.(opacity,base)}catch(_){}
 };
 const stop=()=>{clearTimeout(timer);cancelAnimationFrame(frame);frame=0;root.classList.remove('nautic-water-moving');paint(base)};
 const tick=now=>{
  if(!started)started=now;
  if(now-lastPaint>=80){paint(base*(1+.1*Math.sin((now-started)*Math.PI/9000)));lastPaint=now}
  frame=requestAnimationFrame(tick);
 };
 const activity=()=>{
  stop();
  if(ready&&!document.hidden&&!down)timer=setTimeout(()=>{
   started=0;lastPaint=0;root.classList.add('nautic-water-moving');frame=requestAnimationFrame(tick);
  },10000);
 };
 window.nauticWater={select(value){base=clamp(Number(value)||0);activity()},start(){ready=true;activity()},activity};
 window.nauticUserActivity=action=>{
  if(action==='0')down=true;
  if(action==='1'||action==='3')down=false;
  activity();
 };
 window.nauticDashboardTransparencyGesture=payload=>{
  const [value,save]=String(payload).split(':');window.nauticSetDashboardTransparency?.(Number(value),save==='true');
 };
 for(const event of ['pointerdown','pointermove','pointerup','pointercancel','keydown','wheel','input','click'])
  document.addEventListener(event,e=>{
   if(event==='pointerdown')down=true;
   if(event==='pointerup'||event==='pointercancel')down=false;
   activity();
   if(event==='click'&&e.target.closest?.('button,[role="button"],.click')){
    try{window.NauticAndroid?.commandSound?.()}catch(_){}
   }
  },{capture:true,passive:true});
 document.addEventListener('visibilitychange',()=>{down=false;activity()});
 paint(base);
})();
