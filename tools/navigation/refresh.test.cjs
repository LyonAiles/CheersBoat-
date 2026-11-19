const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('app/src/main/assets/nautic-vector.js','utf8');
const snippet=source.slice(source.indexOf(' let worksTask=null,'),source.indexOf(' const signCacheKey='));
function setup(){
 const messages=[],renders=[];let requests=0,respond;
 const ctx={Map,Date,JSON,Array,Error,Promise,setTimeout,clearTimeout,AbortController,
  options:{},busy:false,status:{hidden:true},data:{old:true},lastList:[{id:'old'}],lastRender:'',lastWorksCompute:0,lastQuery:Date.now(),selectedWorkPoint:{lat:47,lon:2},workRegions:[],
  cache:{center:{lat:47,lon:2},radius:5000,signature:'lock',time:Date.now(),elements:[]},
  workArea:()=>({p:{lat:47,lon:2},radius:5000}),selectedSignature:()=> 'lock',
  W:{distance:()=>0,parse:elements=>({items:elements})},visibleWorks:()=>ctx.data.items||ctx.lastList,
  renderWorks:()=>renders.push(ctx.lastList),notice:s=>messages.push(s),query:()=> '[out:json][timeout:45];node;out;',localStorage:{setItem(){}},window:{},
  native:{searchMapWorks(id){requests++;respond=elements=>ctx.window.nauticMapWorksResult(JSON.stringify({request:id,elements}));}}
 };
 vm.createContext(ctx);vm.runInContext(snippet,ctx);
 return {ctx,messages,renders,get requests(){return requests},reply(elements){respond(elements)}};
}
(async()=>{
 const t=setup();await t.ctx.updateWorks();assert.equal(t.requests,0,'automatic query uses fresh cache');
 const first=t.ctx.updateWorks(true);assert.equal(t.requests,1,'manual refresh bypasses fresh cache and throttle');
 const queued=t.ctx.updateWorks(true);assert.equal(t.requests,1,'manual refresh waits for busy query');
 t.reply([{id:'fresh'}]);await first;await Promise.resolve();assert.equal(t.requests,2,'queued manual query really runs');
 t.reply([{id:'newer'}]);await queued;
 assert.equal(t.ctx.lastList[0].id,'newer');assert(t.messages.some(m=>m.includes('actualisés à')));
 const f=setup();f.ctx.native.searchMapWorks=id=>f.ctx.window.nauticMapWorksResult(JSON.stringify({request:id,error:'HTTP 429'}));
 await f.ctx.updateWorks(true);assert(f.messages.at(-1).includes('HTTP 429'));assert.equal(f.ctx.lastList[0].id,'old');assert.equal(f.ctx.busy,false);
 console.log('PASS: forced refresh bypasses cache, queues during busy query, renders new data, reports errors and preserves cache');
})().catch(e=>{console.error(e);process.exitCode=1});
