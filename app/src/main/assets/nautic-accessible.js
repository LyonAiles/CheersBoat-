(function(root){
 function exceeded(limits,profile){
  const [draught,air,width]=limits||[];
  return Object.entries({draught,air,width})
   .filter(([key,limit])=>limit>0&&profile[key]>=limit)
   .map(([key,limit])=>({key,limit,value:profile[key]}));
 }
 function compatibleSections(sections,limits,profile){
  const features=[];
  const unverified=[];
  const insufficient=[];
  for(const section of sections){
   const [draught,air,width]=limits[section.sourceId]||[];
   const tooSmall=exceeded([draught,air,width],profile).length>0;
   const known=draught>0&&width>0&&(air>0||air===-1);
   const status=tooSmall?'insufficient':known?'compatible':'unknown';
   const feature={type:'Feature',properties:{section:section.sourceId,status},
    geometry:{type:'LineString',coordinates:section.geometry.map(point=>[point.lon,point.lat])}};
   (tooSmall?insufficient:known?features:unverified).push(feature);
  }
  return {features,unverified,insufficient};
 }
 // Seuil d’affichage de vigilance, en centimètres.
 const vigilanceGap=10;
 function vigilanceLimits(limits,profile){
  const [draught,air,width]=limits||[];
  return Object.entries({draught,air,width})
   .filter(([key,limit])=>Number.isFinite(limit)&&limit>0&&limit-profile[key]<=vigilanceGap)
   .map(([key,limit])=>({key,limit,value:profile[key]}));
 }
 function routeBottlenecks(trip,limits,distance,departureOffset=0){
  const result={draught:{minimum:null,unknown:0},air:{minimum:null,unknown:0}};
  const seen=new Set();
  let offset=0;
  for(let i=0;i<trip.coordinates.length-1;i++){
   const start=offset;
   offset+=distance(trip.coordinates[i],trip.coordinates[i+1]);
   if(offset<=departureOffset)continue;
   const section=trip.wayIds?.[i];
   const key=section??'edge-'+i;
   if(seen.has(key))continue;
   seen.add(key);
   const [draught,air]=limits[section]||[];
   for(const [dimension,limit] of Object.entries({draught,air})){
    const summary=result[dimension];
    if(dimension==='air'&&limit===-1)continue;
    if(!Number.isFinite(limit)||limit<=0){summary.unknown++;continue;}
    if(!summary.minimum||limit<summary.minimum.limit){
     summary.minimum={limit,section,offset:Math.max(0,start-departureOffset)};
    }
   }
  }
  return result;
 }
 const api={compatibleSections,exceeded,vigilanceLimits,routeBottlenecks};
 if(typeof module!=='undefined')module.exports=api;
 else root.NauticAccessible=api;
})(typeof window!=='undefined'?window:globalThis);
