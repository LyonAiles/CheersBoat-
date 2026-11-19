const assert=require('assert'),D=require('../../app/src/main/assets/nautic-local-data.js');
(async()=>{
 const plan=D.tiles({lat:48.4,lon:2.7},100000);assert.equal(plan.length,9);assert.equal(new Set(plan.map(t=>t.id)).size,9);assert(plan.every(t=>t.radius===6000));
 const disk=new Map(),completed=[];let fetched=0;
 const run=()=>D.sync({plan:plan.slice(0,3),read:key=>disk.get(key),fetch:async tile=>{
  fetched++;if(fetched===2)throw Error('network lost');
  const entry={id:tile.id,updated:Date.now(),elements:[]};disk.set(tile.id,entry);return {entry,source:'externe'};
 },progress(){},checkpoint:id=>completed.push(id)});
 await assert.rejects(run(),/network lost/);assert.equal(disk.size,1);assert.equal(completed.length,1);
 await run();assert.equal(disk.size,3);assert.equal(fetched,4,'resume skips successfully committed first lot');
 let calls=0;await D.sync({plan:plan.slice(0,3),read:key=>disk.get(key),fetch(){calls++},progress(){},checkpoint(){}});assert.equal(calls,0,'fresh local data require no network');
 console.log('PASS: bounded region, unique lots, restart skips saved lots, fresh local data skip network');
})().catch(e=>{console.error(e);process.exitCode=1});
