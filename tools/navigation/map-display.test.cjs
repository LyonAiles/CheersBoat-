const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const vector=fs.readFileSync('app/src/main/assets/nautic-vector.js','utf8');
const extensions=fs.readFileSync('app/src/main/assets/nautic-extensions.js','utf8');
let tileRequests=0,starts=0,clears=0,restores=0,removed=0;
const pane={style:{}},leaflet={setView(){return this},on(){return this},dragging:{enable(){}}};
const L={map:()=>leaflet,control:{zoom:()=>({addTo(){}})},tileLayer:()=>{tileRequests++;return {addTo(){}}},polyline:()=>({addTo:()=>({})})};
const context={window:{L,nauticClearChart:()=>clears++,nauticRestoreLegacy:()=>restores++},L,
 $:()=>pane,map:null,routeLine:null,points:[],layoutNavigationMap(){},rotateMap(){},enableMapRotation(){},
 options:{},read:()=>({}),lastQuery:0,signButton:{},request:0,failed:false,active:false,host:{style:{}},
 vector:null,start:()=>starts++,renderWorks(){},lastRender:''};
vm.createContext(context);
vm.runInContext(app.slice(app.indexOf('const MAX_VECTOR_PITCH='),app.indexOf('let mapPitch=')),context);
vm.runInContext(app.match(/^function initMap\(\).*$/m)[0],context);
vm.runInContext('initMap()',context);
assert.equal(tileRequests,0,'initial Leaflet geometry must not download a default raster');
assert.equal(vm.runInContext('navigationMapEngine(undefined)',context),'none');
assert.equal(vm.runInContext('navigationMapEngine("unexpected")',context),'vector');
assert.equal(vm.runInContext('clampMapPitch(80)',context),80);
assert.equal(vm.runInContext('clampMapPitch(95)',context),80);
assert.equal(vm.runInContext('clampMapPitch(80,MAX_CLASSIC_PITCH)',context),45);
vm.runInContext(vector.match(/^ function settings\(next\).*$/m)[0],context);
context.settings({});assert.equal(starts,0);assert.equal(clears,1);
context.settings({mapEngine:'vector'});assert.equal(starts,1);assert.equal(restores,0);
context.vector={remove:()=>removed++};context.active=true;
context.settings({mapEngine:'none'});assert.equal(removed,1);assert.equal(context.active,false);
context.settings({mapEngine:'legacy'});assert.equal(restores,1,'only explicit legacy restores a raster');
vm.runInContext(vector.match(/^ function fallback\(message\).*$/m)[0],Object.assign(context,{notice(){}}));
context.fallback('unavailable');assert.equal(restores,1,'vector failure must not assign a classic chart');
assert(!extensions.includes('setTimeout(()=>{if(map)setLayer(state.map)},1000)'));
console.log('PASS: no startup raster, explicit chart choices, clear background on failure and 80-degree vector pitch');
