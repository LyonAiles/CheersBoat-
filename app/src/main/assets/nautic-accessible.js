(function(root){
 function compatibleSections(sections,limits,profile){
  const features=[];
  const unverified=[];
  let insufficient=0;
  for(const section of sections){
   const [draught,air,width]=limits[section.sourceId]||[];
   if((draught>0&&profile.draught>=draught)||(width>0&&profile.width>=width)||(air>0&&profile.air>=air)){
    insufficient++;continue;
   }
   const known=draught>0&&width>0&&(air>0||air===-1);
   const feature={type:'Feature',properties:{section:section.sourceId,status:known?'compatible':'unknown'},
    geometry:{type:'LineString',coordinates:section.geometry.map(point=>[point.lon,point.lat])}};
   (known?features:unverified).push(feature);
  }
  return {features,unverified,insufficient};
 }
 const api={compatibleSections};
 if(typeof module!=='undefined')module.exports=api;
 else root.NauticAccessible=api;
})(typeof window!=='undefined'?window:globalThis);
