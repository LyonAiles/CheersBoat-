const assert=require('assert'),W=require('../../app/src/main/assets/nautic-waterways.js');
const line={type:'way',id:1,tags:{waterway:'canal'},nodes:[1,2,3],geometry:[{lat:47,lon:2},{lat:47.01,lon:2},{lat:47.02,lon:2}]};
const lock=(id,lat)=>({type:'node',id,lat,lon:2,tags:{waterway:'lock_gate',name:'Écluse '+id}});
const data=W.parse([line,lock(2,47.015),lock(3,47.002),{type:'way',id:4,tags:{bridge:'yes',highway:'road',name:'Pont'},geometry:[{lat:47.018,lon:1.999},{lat:47.018,lon:2.001}]},{type:'node',id:5,lat:47.003,lon:2,tags:{waterway:'lock_gate',name:'Écluse 3'}}]);
assert.equal(data.items.filter(x=>x.type==='Pont').length,1);
let north=W.nearby(data,{lat:47.005,lon:2},5000,0);assert(north.some(x=>x.name==='Écluse 2'));assert(!north.some(x=>x.name==='Écluse 3'));assert(north.every(x=>x.mode==='réseau'));
let south=W.nearby(data,{lat:47.005,lon:2},5000,180);assert(south.some(x=>x.name==='Écluse 3'));assert(!south.some(x=>x.name==='Écluse 2'));
assert(Math.abs(north.find(x=>x.name==='Écluse 2').distance-1112)<5);
assert.equal(W.nearby(data,{lat:47.005,lon:2},500,0).length,0);
const off=W.nearby(data,{lat:47.005,lon:2.01},5000,0);assert(off.every(x=>x.mode==='proximité'));
console.log('PASS: forward/backward filtering, network distance, perimeter, bridges and explicit straight-line fallback');

const facilities=W.parse([{type:'node',id:10,lat:47,lon:2,tags:{leisure:'marina',name:'Port test'}},{type:'node',id:11,lat:47.1,lon:2,tags:{mooring:'yes',name:'Halte test'}},{type:'node',id:12,lat:47.2,lon:2,tags:{leisure:'slipway'}},{type:'way',id:13,center:{lat:47.3,lon:2},tags:{bridge:'yes',highway:'road'}}]);
assert.deepEqual(facilities.items.map(x=>x.category),['port','halt','slipway','bridge']);assert.equal(W.nearby(facilities,{lat:47,lon:2},100000,null,true).length,4);assert.equal(W.nearby(facilities,{lat:47,lon:2},5000,null,true).length,1);const around=W.nearby(data,{lat:47.005,lon:2},5000,0,true);assert(around.some(x=>x.name==='Écluse 3'));console.log('PASS: ports, halts, slipways, distant bridge centres, 100 km radius and all-around selection');
