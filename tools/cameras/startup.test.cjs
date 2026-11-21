const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let now=0,x=0,ready=0,shown=0,frames=[];
const element={getBoundingClientRect:()=>({x,y:0,width:100,height:50})};
const context={innerWidth:400,innerHeight:800,performance:{now:()=>now},requestAnimationFrame:fn=>frames.push(fn),document:{readyState:'complete',hidden:false,getElementById:()=>element,documentElement:{classList:{remove:()=>shown++}}},window:{NauticAndroid:{dashboardReady:()=>ready++}}};
vm.runInNewContext(fs.readFileSync('app/src/main/assets/nautic-startup.js','utf8'),context);
function tick(ms){now=ms;const batch=frames;frames=[];batch.forEach(fn=>fn());}
tick(0);tick(200);assert.equal(shown,0);x=10;tick(220);tick(400);assert.equal(shown,0);tick(480);assert.equal(shown,1);assert.equal(ready,0);tick(496);assert.equal(ready,1);
console.log('PASS: layout changes delay reveal; Android notified after next frame.');
