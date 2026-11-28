/* Idle animation owns only transient display values, never persisted settings. */
(()=>{
 const root=document.documentElement;
 let base=70,ready=false,timer=0,frame=0,started=0,lastPaint=0,down=false,foreground=true;
 let measuring=false,cancelMeasurement=()=>{};
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
  if(measuring)return;
  stop();
  if(ready&&options.waterTimer&&foreground&&!document.hidden&&!down)timer=setTimeout(()=>{
   started=0;lastPaint=0;root.classList.add('nautic-water-moving');frame=requestAnimationFrame(tick);
  },10000);
 };
 window.nauticWater={configure(value){
  const bounded=(key,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(value[key]))?Number(value[key]):fallback));
  options={waterTimer:value.waterTimer!==false,chartLinked:value.chartLinked!==false,waterAmplitude:bounded('waterAmplitude',0,200,100),waterSpeed:bounded('waterSpeed',25,300,100),waterTransparencyAmplitude:bounded('waterTransparencyAmplitude',0,30,10)};activity();
 },select(value){base=clamp(Number(value)||0);activity()},start(){ready=true;activity()},activity};
 window.nauticWaterForeground=value=>{if(value==="false")cancelMeasurement();foreground=value!=="false";down=false;activity()};
 window.nauticUserActivity=action=>{
  if(action==='0'){cancelMeasurement();down=true;}
  if(action==='1'||action==='3')down=false;
  activity();
 };
 window.nauticDashboardTransparencyGesture=payload=>{
  const [value,save]=String(payload).split(':');window.nauticSetDashboardTransparency?.(Number(value),save==='true');
 };
 const sound=kind=>{try{window.NauticAndroid?.gestureSound?.(kind)}catch(_){}};
 let gesture=null,suppressClickUntil=0;
 const control=target=>target.closest?.('button,[role="button"],.click,input,select,[data-id]');
 for(const event of ['pointerdown','pointermove','pointerup','pointercancel','keydown','wheel','input','click'])
  document.addEventListener(event,e=>{
   if(event==='pointerdown'){cancelMeasurement();down=true;}
   if(event==='pointerup'||event==='pointercancel')down=false;
   activity();
   if(event==='pointerdown')gesture={x:e.clientX,y:e.clientY,time:Date.now(),target:control(e.target)};
   if(event==='pointercancel')gesture=null;
   if(event==='pointerup'&&gesture){
    if(gesture.target){
     if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>12){sound('slide');suppressClickUntil=Date.now()+400}
     else if(Date.now()-gesture.time>=600){sound('hold');suppressClickUntil=Date.now()+400}
    }
    gesture=null;
   }
   if(event==='click'&&control(e.target)&&Date.now()>suppressClickUntil)sound(e.detail>=2?'double':'click');
  },{capture:true,passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelMeasurement();down=false;activity()});
 const resultKey='nautic-timer-measurement';
 const report=text=>{try{if(window.NauticAndroid?.timerPerformanceResult)window.NauticAndroid.timerPerformanceResult(text);else window.alert(text)}catch(_){}};
 window.nauticWater.lastMeasurement=()=>report(localStorage.getItem(resultKey)||'Aucune mesure enregistrée.');
 window.nauticWater.measure=()=>{
  if(measuring)return;
  if(document.hidden||!foreground)return;
  stop();measuring=true;
  let task=0,probe=0,previous=0,gaps=[],runs=[],index=0;
  const badge=document.createElement('div');
  badge.style.cssText='position:fixed;left:8px;bottom:8px;z-index:2147483647;background:#071d2f;color:white;padding:8px;font-size:12px;pointer-events:none';
  document.body.appendChild(badge);
  const native=reset=>{try{return JSON.parse(window.NauticAndroid?.timerPerformanceSample?.(reset)||'{}')}catch(_){return {}}};
  const cleanup=()=>{clearTimeout(task);cancelAnimationFrame(probe);stop();native(false);badge.remove();measuring=false;cancelMeasurement=()=>{};activity()};
  cancelMeasurement=()=>{if(!measuring)return;cleanup();report('Mesure interrompue : interaction ou application masquée. Aucun résultat partiel conservé.');};
  const sample=time=>{if(previous)gaps.push(time-previous);previous=time;probe=requestAnimationFrame(sample)};
  const percent=n=>Number.isFinite(n)?n.toFixed(1)+' %':'indisponible';
  const finish=()=>{
   cleanup();
   const cpu=r=>r.wallMs>0?r.cpuMs/r.wallMs*100:NaN;
   const lines=runs.map((r,i)=>{
    const sorted=r.gaps.slice().sort((a,b)=>a-b),p95=sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)];
    return ['Sans effets (avant)','Effets actifs','Sans effets (après)'][i]+
     '\nCPU appli : '+percent(cpu(r))+' ; rendu moyen : '+(r.frames?r.renderMs.toFixed(2)+' ms':'indisponible')+
     '\nImages hors budget : '+(r.frames?percent(r.slow/r.frames*100):'indisponible')+' ; délai rAF p95 : '+(p95?p95.toFixed(1)+' ms':'indisponible');
   });
   const delta=cpu(runs[1])-(cpu(runs[0])+cpu(runs[2]))/2;
   const text=new Date().toLocaleString()+'\n'+lines.join('\n\n')+
    '\n\nÉcart CPU effets / référence : '+(Number.isFinite(delta)?delta.toFixed(1)+' points':'indisponible')+
    '\nCPU du processus Nautic uniquement : le moteur WebView séparé et le GPU sont exclus. Les temps de rendu et rAF complètent cette mesure. Aucune estimation de consommation batterie.\nRéseau et vidéos peuvent faire varier les résultats ; répéter dans les mêmes conditions.';
   try{localStorage.setItem(resultKey,text)}catch(_){}
   report(text);
  };
  const phase=()=>{
   if(index===3){finish();return;}
   stop();
   if(index===1){started=0;lastPaint=0;root.classList.add('nautic-water-moving');frame=requestAnimationFrame(tick)}
   badge.textContent='Test timer '+(index+1)+'/3 · '+(index===1?'effets actifs':'sans effets')+' · ne pas toucher';
   task=setTimeout(()=>{
    native(true);gaps=[];previous=0;probe=requestAnimationFrame(sample);
    task=setTimeout(()=>{cancelAnimationFrame(probe);runs.push({...native(false),gaps});index++;phase()},15000);
   },3000);
  };
  phase();
 };
 window.nauticWater.configure(window.nauticWaterSettings?.()||options);
 paint(base);
})();
