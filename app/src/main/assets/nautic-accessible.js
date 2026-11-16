(function(root){
 const W=root.NauticWaterways||require('./nautic-waterways.js');
 function reachable(sections,limits,position,profile){
  if(!position)return {features:[],reason:'gps'};
  const adjacent=new Map();
  let start=null,nearest=150;
  for(const section of sections){
   const geometry=section.geometry;
   for(let i=1;i<geometry.length;i++){
    const {d}=W.project(position,geometry[i-1],geometry[i]);
    if(d<nearest){nearest=d;start=section;}
   }
   for(const id of [section.nodes[0],section.nodes.at(-1)]){
    if(!adjacent.has(id))adjacent.set(id,[]);
    adjacent.get(id).push(section);
   }
  }
  if(!start)return {features:[],reason:'off-network'};
  function restriction(section){
   const [draught,air,width]=limits[section.sourceId]||[];
   if(!draught||!air||!width)return 'unknown';
   if(profile.draught>=draught||profile.width>=width||(air!==-1&&profile.air>=air))return 'dimensions';
   return '';
  }
  const reason=restriction(start);
  if(reason)return {features:[],reason};
  const accepted=new Set([start]),visited=new Set(),pending=[start.nodes[0],start.nodes.at(-1)];
  while(pending.length){
   const node=pending.pop();
   if(visited.has(node))continue;
   visited.add(node);
   for(const section of adjacent.get(node)||[]){
    if(accepted.has(section)||restriction(section))continue;
    accepted.add(section);
    pending.push(section.nodes[0],section.nodes.at(-1));
   }
  }
  const features=[...accepted].map(section=>({type:'Feature',properties:{section:section.sourceId},
   geometry:{type:'LineString',coordinates:section.geometry.map(point=>[point.lon,point.lat])}}));
  return {features,reason:''};
 }
 const api={reachable};
 if(typeof module!=='undefined')module.exports=api;
 else root.NauticAccessible=api;
})(typeof window!=='undefined'?window:globalThis);
