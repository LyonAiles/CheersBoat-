(function(root){
 function compatibleSections(sections,limits,profile){
  const features=[];
  let unknown=0;
  for(const section of sections){
   const [draught,air,width]=limits[section.sourceId]||[];
   if(!draught||!air||!width){unknown++;continue;}
   if(profile.draught>=draught||profile.width>=width||(air!==-1&&profile.air>=air))continue;
   features.push({type:'Feature',properties:{section:section.sourceId},
    geometry:{type:'LineString',coordinates:section.geometry.map(point=>[point.lon,point.lat])}});
  }
  return {features,unknown};
 }
 const api={compatibleSections};
 if(typeof module!=='undefined')module.exports=api;
 else root.NauticAccessible=api;
})(typeof window!=='undefined'?window:globalThis);
