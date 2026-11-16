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
 const api={compatibleSections,exceeded};
 if(typeof module!=='undefined')module.exports=api;
 else root.NauticAccessible=api;
})(typeof window!=='undefined'?window:globalThis);
