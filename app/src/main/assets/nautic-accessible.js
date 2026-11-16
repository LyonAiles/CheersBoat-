(function(root){
 function compatibleSections(sections,limits,profile){
  const features=[];
  const unverified=[];
  const insufficient=[];
  for(const section of sections){
   const [draught,air,width]=limits[section.sourceId]||[];
   const tooSmall=(draught>0&&profile.draught>=draught)||(width>0&&profile.width>=width)||(air>0&&profile.air>=air);
   const known=draught>0&&width>0&&(air>0||air===-1);
   const status=tooSmall?'insufficient':known?'compatible':'unknown';
   const feature={type:'Feature',properties:{section:section.sourceId,status},
    geometry:{type:'LineString',coordinates:section.geometry.map(point=>[point.lon,point.lat])}};
   (tooSmall?insufficient:known?features:unverified).push(feature);
  }
  return {features,unverified,insufficient};
 }
 const api={compatibleSections};
 if(typeof module!=='undefined')module.exports=api;
 else root.NauticAccessible=api;
})(typeof window!=='undefined'?window:globalThis);
