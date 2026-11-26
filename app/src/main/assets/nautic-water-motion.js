/* Idle animation owns only transient display values, never persisted settings. */
(()=>{
 const root=document.documentElement;
 let base=70,ready=false,timer=0,frame=0,started=0,lastPaint=0,down=false;
 let options={waterTimer:true,waterAmplitude:100,waterSpeed:100,waterTransparencyAmplitude:10,chartLinked:true};
 const clamp=n=>Math.max(0,Math.min(80,n));
 const paint=value=>{
  const opacity=1-clamp(value)/100;
  root.style.setProperty('--nautic-dashboard-opacity',String(opacity));
  root.style.setProperty('--nautic-chart-opacity',String(options.chartLinked?Math.min(1,opacity+.15):1));
  try{window.NauticAndroid?.dashboardOpacity?.(opacity,base)}catch(_){}
 };
 const stop=()=>{clearTimeout(timer);cancelAnimationFrame(frame);frame=0;root.classList.remove('nautic-water-moving');root.style.setProperty('--nautic-water-transform','scale(1.02)');paint(base)};
 const tick=now=>{
  if(!started)started=now;
  if(now-lastPaint>=80){
   const phase=(now-started)*Math.PI/9000*options.waterSpeed/100;
   const amplitude=options.waterAmplitude/100,s=Math.sin(phase),c=Math.cos(phase);
   paint(base*(1+options.waterTransparencyAmplitude/100*s));
   root.style.setProperty('--nautic-water-transform',`scale(${1.02+.008*amplitude*s},${1.02-.008*amplitude*s}) skew(${.35*amplitude*s}deg,${.2*amplitude*c}deg) translate(${.3*amplitude*s}%,${.2*amplitude*c}%)`);
   lastPaint=now;
  }
  frame=requestAnimationFrame(tick);
 };
 const activity=()=>{
  stop();
  if(ready&&options.waterTimer&&!document.hidden&&!down)timer=setTimeout(()=>{
   started=0;lastPaint=0;root.classList.add('nautic-water-moving');frame=requestAnimationFrame(tick);
  },10000);
 };
 window.nauticWater={configure(value){
  const bounded=(key,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(value[key]))?Number(value[key]):fallback));
  options={waterTimer:value.waterTimer!==false,chartLinked:value.chartLinked!==false,waterAmplitude:bounded('waterAmplitude',0,200,100),waterSpeed:bounded('waterSpeed',25,300,100),waterTransparencyAmplitude:bounded('waterTransparencyAmplitude',0,30,10)};activity();
 },select(value){base=clamp(Number(value)||0);activity()},start(){ready=true;activity()},activity};
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
 window.nauticWater.configure(window.nauticWaterSettings?.()||options);
 paint(base);
})();
