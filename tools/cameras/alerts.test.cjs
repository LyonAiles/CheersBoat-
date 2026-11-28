const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/nautic-dashboard.js','utf8');
const start=source.indexOf(' function showAlertCamera(');
const end=source.indexOf(' function activateMapView(',start);
assert(start>=0&&end>start);
const context={logOperation(){},alertTrace:null,alertWaitReason:'',lastPresentedAlert:0,swappedMedallion:null,currentLens(feed){return feed.lens;},restoreMedallion(){},feeds:{},centerView:'central',mapCamera:{hidden:true,classList:{remove(){},contains(){return false;}}},speedCard:{setAttribute(){}},refreshMapViews(){},previews(){}};
vm.createContext(context);vm.runInContext(source.slice(start,end),context);
context.showAlertCamera(42,1,100);
assert.equal(context.feeds.central.camera,2);assert.equal(context.feeds.central.lens,2);
context.showAlertCamera(44,1,200);
assert.equal(context.feeds.central.camera,1);assert.equal(context.feeds.central.lens,1);
context.showAlertCamera(42,1,150);
assert.equal(context.feeds.central.lens,1,'An older alert must not replace a newer alert');
context.showAlertCamera(44,3,300);
assert.equal(context.feeds.central.camera,3);assert.equal(context.feeds.central.lens,1);
assert.equal(context.mapCamera.hidden,false);
console.log('PASS: alerts 42/fixed, 44/mobile, configured mobile source and newest alert priority');

// Run the actual manual switch and verify that a delayed earlier alert cannot undo it.
const switchStart=source.indexOf(' function switchMapCamera(');
const switchEnd=source.indexOf(' let centerReset=',switchStart);
vm.runInContext(source.slice(switchStart,switchEnd),context);
context.switchMapCamera();
assert.equal(context.feeds.central.lens,2);
context.showAlertCamera(44,3,Date.now()-1000);
assert.equal(context.feeds.central.lens,2,'A queued pre-click alert must not undo the manual lens choice');
context.showAlertCamera(44,3,context.lastPresentedAlert+1);
assert.equal(context.feeds.central.lens,1,'A genuinely new alert still takes priority');
console.log('PASS: manual change survives delayed alerts; new alerts retain priority');

// A fresh alert must resend the layout even when JS already believes the correct lens is selected.
let resent=0;context.previews=force=>{assert.equal(force,true);resent++};
context.showAlertCamera(44,3,context.lastPresentedAlert+1);
assert.equal(resent,1,'same logical feed must still refresh a stale native view');
console.log('PASS: repeated alert refreshes the native view even with an unchanged logical feed');
// Keep an alert pending while a dialog hides videos; deliver it through quiet mode when closed.
const tool={hidden:true,classList:{contains:()=>false},getBoundingClientRect:()=>({width:0}),cloneNode:()=>({querySelectorAll:()=>[]})};
let submitted=0,dialogOpen=true;
Object.assign(context,{previewViews:[],centerReset:0,bridge:{},innerWidth:800,mapCameraAlpha:1,mapHd:false,
 qualityTool:tool,medallionTool:tool,axisTool:tool,captureTool:tool,
 cameraConfig:()=>({}),refreshAxis(){},call(){submitted++},
 document:{hidden:false,documentElement:{},querySelector:()=>dialogOpen?{}:null},
 $:id=>id==='sondeurSettings'?{hidden:true}:id==='app'?{classList:{contains:()=>false}}:null,
 getComputedStyle:()=>({getPropertyValue:()=>'.5'}),window:{nauticQuietMode:true}});
context.mapCamera.style={};
vm.runInContext(source.slice(source.indexOf(' function previews('),source.indexOf(' window.nauticEvery(()=>{numberButtons();refresh();previews();}',source.indexOf(' function previews('))),context);
context.alertTrace={number:44,time:123,camera:3,lens:1};context.alertViewPending=true;
context.previews();assert.equal(context.alertViewPending,true,'dialog must not consume the pending alert');
dialogOpen=false;context.previews();assert.equal(submitted,2,'quiet mode must allow the pending alert layout');
assert.equal(context.alertViewPending,false);
context.previews();assert.equal(submitted,2,'normal quiet mode resumes once alert layout is submitted');
console.log('PASS: alert deferred by a dialog is submitted on close even in quiet mode');
