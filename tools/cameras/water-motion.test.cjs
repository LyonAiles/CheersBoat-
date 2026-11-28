const {readFileSync}=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let now=0,next=1;const timers=new Map(),frames=new Map(),values={},classes=new Set(),handlers={};
const root={style:{setProperty:(k,v)=>values[k]=Number(v)},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}};
const document={documentElement:root,hidden:false,addEventListener:(k,f)=>handlers[k]=f};
const window={NauticAndroid:{dashboardOpacity:v=>assert(v>=.12&&v<=1)}};
const context={window,document,setTimeout:(f,d)=>{let id=next++;timers.set(id,{f,t:now+d});return id},clearTimeout:id=>timers.delete(id),requestAnimationFrame:f=>{let id=next++;frames.set(id,f);return id},cancelAnimationFrame:id=>frames.delete(id)};
vm.runInNewContext(readFileSync('app/src/main/assets/nautic-water-motion.js','utf8'),context);
const advance=ms=>{now+=ms;for(const [id,v] of [...timers])if(v.t<=now){timers.delete(id);v.f()}};
const render=t=>{const pending=[...frames.values()];frames.clear();for(const f of pending)f(t)};
assert(Math.abs(values['--nautic-dashboard-opacity']-.3)<1e-6);
assert(Math.abs(values['--nautic-chart-opacity']-.45)<1e-6);
assert.equal(timers.size,0,'no animation before layout readiness');
window.nauticWater.start();advance(9999);assert.equal(frames.size,0);advance(1);render(10000);render(14500);
assert(Math.abs(values['--nautic-dashboard-opacity']-.23)<1e-6,'relative +10% transparency');
window.nauticUserActivity('0');assert.equal(frames.size,0);assert.equal(timers.size,0,'holding does not start idle timer');
assert(Math.abs(values['--nautic-dashboard-opacity']-.3)<1e-6);
window.nauticUserActivity('1');advance(10000);assert.equal(frames.size,1);
window.nauticWater.select(0);assert.equal(values['--nautic-chart-opacity'],1);
window.nauticWater.select(80);advance(10000);render(30000);render(34500);assert.equal(values['--nautic-dashboard-opacity'],.19999999999999996);
document.hidden=true;handlers.visibilitychange();assert.equal(timers.size,0);assert.equal(frames.size,0);
window.nauticWater.configure({waterTimer:false,chartLinked:false});
assert.equal(timers.size,0);assert.equal(frames.size,0);assert.equal(values['--nautic-chart-opacity'],1);
window.nauticWater.configure({waterTimer:true,waterAmplitude:0,waterSpeed:200,waterTransparencyAmplitude:0});
document.hidden=false;handlers.visibilitychange();advance(10000);render(40000);render(44500);
assert.equal(values['--nautic-dashboard-opacity'],1-.8);
window.nauticWater.configure({waterTimer:true,waterAmplitude:100,waterSpeed:200,waterTransparencyAmplitude:10});
window.nauticWater.select(30);advance(10000);render(50000);render(54500);
assert(Math.abs(values['--nautic-dashboard-opacity']-.7)<1e-6,'double speed completes half a cycle in 4.5 seconds');
const css=readFileSync('app/src/main/assets/nautic-dashboard.css','utf8');
assert(css.includes(':is(#map,#mapFallback,#nauticVectorMap)'),'both chart renderers share the opacity');
assert(css.includes('#mapWrap .sondeur-tools{opacity:var(--nautic-dashboard-opacity,.3)}'));

console.log('PASS: configurable timer, chart linking and startup 70%, chart offset, idle delay, relative oscillation, touch interruption and hidden-page suspension');

// Native activity lifecycle must suspend even if WebView visibility stays unchanged.
window.nauticWaterForeground('false');assert.equal(frames.size,0);assert.equal(timers.size,0);
window.nauticWaterForeground('true');advance(10000);assert.equal(frames.size,1);
const sounds=[];window.NauticAndroid.gestureSound=kind=>sounds.push(kind);
const target={closest:()=>target};
handlers.click({target,detail:1});handlers.click({target,detail:2});
assert.deepEqual(sounds,['click','double']);
handlers.pointerdown({target,clientX:0,clientY:0});
handlers.pointerup({target,clientX:0,clientY:40});
handlers.click({target,detail:1});
assert.deepEqual(sounds,['click','double','slide'],'drag produces one sound and suppresses synthetic click');
console.log('PASS: native background suspension, click, double click and drag feedback');
// Exercise the complete comparative measurement with virtual time, including cancellation.
const saved={},reports=[];let samples=0;
context.localStorage={getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v};
document.createElement=()=>({style:{},remove(){}});document.body={appendChild(){}};
window.NauticAndroid.timerPerformanceSample=reset=>{
 if(reset)return '{}';
 samples++;return JSON.stringify({wallMs:15000,cpuMs:300,frames:100,slow:2,renderMs:8});
};
window.NauticAndroid.timerPerformanceResult=text=>reports.push(text);
window.nauticWater.measure();
for(let i=0;i<3;i++){
 advance(3000);render(now);render(now+16);advance(15000);
}
assert.equal(reports.length,1);
assert.match(saved['nautic-timer-measurement'],/Sans effets \(avant\)/);
assert.match(reports[0],/Effets actifs/);assert.match(reports[0],/Sans effets \(après\)/);
const complete=saved['nautic-timer-measurement'];
window.nauticWater.measure();window.nauticUserActivity('0');advance(60000);
assert.match(reports[1],/interrompue/);
assert.equal(saved['nautic-timer-measurement'],complete,'cancelled run preserves last complete result');
console.log('PASS: three comparison phases, saved report and touch cancellation');
