/* Checkpointed static data only: live VNF closures/weather are not stored here. */
(function(root){
 const age=7*86400000;
 function tiles(point,radius=5000){
  const y=Math.floor(point.lat/.05),x=Math.floor((point.lon+180)/.075),spread=radius>1500?1:0,result=[];
  for(let dy=-spread;dy<=spread;dy++)for(let dx=-spread;dx<=spread;dx++){
   const row=y+dy,col=x+dx;result.push({id:`fr-${row}-${col}`,lat:(row+.5)*.05,lon:(col+.5)*.075-180,radius:6000});
  }
  return result.sort((a,b)=>Math.hypot(a.lat-point.lat,(a.lon-point.lon)*.7)-Math.hypot(b.lat-point.lat,(b.lon-point.lon)*.7));
 }
 async function sync({plan,read,fetch,progress,checkpoint,force=false,delay=()=>Promise.resolve()}){
  let done=0;const entries=[];
  for(const tile of plan){
   let entry=await read(tile.id);
   if(force||!entry||entry.id!==tile.id||!Number.isFinite(entry.updated)||!Array.isArray(entry.elements)||Date.now()-entry.updated>age){
    progress({done,total:plan.length,tile,source:'recherche'});
    const result=await fetch(tile,force);entry=result.entry;
    if(!entry||entry.id!==tile.id||!Array.isArray(entry.elements)||!Number.isFinite(entry.updated))throw Error('lot invalide');
    checkpoint(tile.id);entries.push(entry);done++;progress({done,total:plan.length,tile,entry,source:result.source});
    if(done<plan.length)await delay();
   }else{entries.push(entry);done++;checkpoint(tile.id);progress({done,total:plan.length,tile,entry,source:'locale'});}
  }
  return entries;
 }
 const api={tiles,sync,age};root.NauticLocalData=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
