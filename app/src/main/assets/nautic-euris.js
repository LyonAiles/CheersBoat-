(function(root){
 function decode(line){
  const result=[];
  let index=0,lat=0,lon=0;
  function delta(){
   let value=0,scale=1,byte;
   do{byte=line.charCodeAt(index++)-63;value+=(byte&31)*scale;scale*=32;}while(byte>=32);
   return value%2?-(value+1)/2:value/2;
  }
  while(index<line.length){
   lat+=delta();lon+=delta();
   result.push({lat:lat/1e6,lon:lon/1e6});
  }
  return result;
 }
 function network(rows){
  return rows.map(([code,from,to,name,closed,scope,line],row)=>{
   const geometry=decode(line);
   const nodes=geometry.map((_,i)=>i===0?from:i===geometry.length-1?to:'euris/'+row+'/'+i);
   return {type:'way',id:'euris/'+row,sourceId:code,scope,tags:{waterway:'fairway',name,boat:closed?'no':undefined},nodes,geometry};
  });
 }
 function scopeId(value){
  return /^FR[A-Z]{2}[0-9]{3}$/.test(value)?'FR'+value.slice(-3):value;
 }
 function objectScope(isrs){
  return typeof isrs==='string'&&isrs.length===20?scopeId(isrs.slice(0,2)+isrs.slice(5,10)):'';
 }
 function catalog(elements){
  const sections=new Map(),groups=new Map();
  for(const element of elements){
   if(!element.scope)continue;
   const scope=scopeId(element.scope);
   sections.set(element.sourceId,scope);
   if(!groups.has(scope))groups.set(scope,[]);
   groups.get(scope).push(element);
  }
  return {sections,groups};
 }
 function merge(previous,latest){
  const updated=new Set(latest.scopes);
  const affects=item=>updated.has(objectScope(item.isrsStart||item.isrs))||updated.has(objectScope(item.isrsEnd));
  const items=[...(previous.items||[]).filter(item=>!affects(item)),...latest.items];
  const used=new Set(items.flatMap(item=>[item.isrsStart||item.isrs,item.isrsEnd]));
  const refs=new Map([...(previous.refs||[]),...latest.refs].filter(ref=>used.has(ref.isrs)).map(ref=>[ref.isrs,ref]));
  return {scopes:[...new Set([...(previous.scopes||[]),...latest.scopes])],items,refs:[...refs.values()]};
 }
 function compile(feed,graph,calc){
  const items=[];
  const refs=new Map((feed.refs||[]).map(item=>[item.isrs,item]));
  for(const item of feed.items||[]){
   const start=Date.parse(item.dateStart),end=Date.parse(item.dateEnd);
   if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||typeof item.title!=='string')continue;
   const from=item.isrsStart||item.isrs,to=item.isrsEnd;
   const first=refs.get(from),last=refs.get(to);
   const scope=objectScope(from),elements=graph.groups.get(scope);
   const valid=point=>point&&Number.isFinite(point.lat)&&Number.isFinite(point.lon)&&
    Math.abs(point.lat)<=90&&Math.abs(point.lon)<=180;
   const paths=new Map();
   if(valid(first)&&valid(last)&&scope===objectScope(to)&&elements){
    const trace=calc.fromNetwork(elements,first,last,100);
    if(trace){
     trace.wayIds.forEach((id,i)=>{
      if(!paths.has(id))paths.set(id,[]);
      paths.get(id).push([trace.coordinates[i],trace.coordinates[i+1]]);
     });
    }
   }
   items.push({title:item.title,reference:item.ntsNumber||'',start,end,scope,paths,
    point:!to&&valid(first)?first:null,
    closure:item.type==='TOT'&&item.direction===3&&item.targetGroup==='ALL'});
  }
  return items;
 }
 function matching(trip,items,graph,calc,now=Date.now()){
  const matches=[];
  const scopes=new Set((trip?.wayIds||[]).map(id=>graph.sections.get(id)));
  const coordinates=trip?.coordinates||[];
  for(const item of items){
   if(!scopes.has(item.scope)||now>=item.end)continue;
   const indices=[];
   if(item.paths.size){
    trip.wayIds.forEach((id,i)=>{
     const lines=item.paths.get(id);
     if(!lines?.length)return;
     const [a,b]=[coordinates[i],coordinates[i+1]];
     const mid={lat:(a.lat+b.lat)/2,lon:(a.lon+b.lon)/2};
     if(lines.some(line=>calc.locate(line,mid)?.distance<8))indices.push(i);
    });
    if(!indices.length)continue;
   }else if(item.point){
    const hit=calc.locate(coordinates,item.point);
    if(!hit||hit.distance>60)continue;
    const index=hit.edgeIndex;
    if(graph.sections.get(trip.wayIds[index])!==item.scope)continue;
    indices.push(index);
   }
   matches.push({...item,indices,active:now>=item.start});
  }
  return matches;
 }
 if(typeof module!=='undefined')module.exports={network,catalog,merge,compile,matching};
 else root.NauticEuris={network,catalog,merge,compile,matching};
})(typeof window!=='undefined'?window:globalThis);
