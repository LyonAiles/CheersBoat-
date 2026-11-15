/* VNF notices FR/2026/08405-0 and 08406-0 via EuRIS NtS v3.
 * Limits matched to OpenStreetMap ways at Venon / Reinette and the north Loire lateral canal.
 * API/Service Notices to Skippers incorporated from EuRIS (eurisportal.eu).
 */
(function(root){
 const catalog=[
  {number:'2026/8405/0',reference:'FR/2026/08405-0',title:'Canal de Briare · Venon à la Reinette',
   start:'2026-11-16',end:'2026-12-31',tentative:'2027-02-28',ways:new Set([43280563,91027811,43280564,91027812,465906907,465906906,43280565,91031432,465906908,465906909,43206383,43363493,91033501,91033498,43363504,91300297,43363509,91300278,43363724,91300289,43363725,43363857,91300284,43363858,91300300,43364367,91300282,43364368,91300272,43364498,91300304,97588328,91404562,43367646,91404560,43367725,91404559,43367837,97588331,91439774,43369616,91404561,43371079,97588337,91404556,43380262,196661903,196661902,91412063,43381396,91412067,43382152,97588792,97590096,91412062,43542931,91441388,43542978,91441852,43543229,91442980,43543346,91444632,43543690,91445868,91551837,97591544,97590312,43545615,91552289,43545703])},
  {number:'2026/8406/0',reference:'FR/2026/08406-0',title:'Canal latéral à la Loire',
   start:'2026-11-16',end:'2026-12-31',tentative:'2027-02-28',ways:new Set([51387068,74284235,74284239,77800757,85733766,85734400,85734402,140757604,141790856,141790857,144618632,144618635,173301366,235851125,366350861,366350862,562074286])}
 ];
 function dateInFrance(date=new Date()){
  const local=new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'});
  const parts=Object.fromEntries(local.formatToParts(date).map(({type,value})=>[type,value]));
  return parts.year+'-'+parts.month+'-'+parts.day;
 }
 function mapped(trip){
  const ids=new Set(trip?.wayIds||[]);
  return catalog.filter(notice=>[...notice.ways].some(id=>ids.has(id)));
 }
 function relevant(trip,live={},today=dateInFrance()){
  return mapped(trip).flatMap(notice=>{
   const update=live[notice.number];
   if(update?.withdrawn)return [];
   const start=update?.start||notice.start,end=update?.end||notice.end;
   if(today>end)return [];
   return [{...notice,start,end,active:today>=start,live:!!update}];
  });
 }
 function closedEdges(trip,notices){
  const blocked=new Set(notices.filter(n=>n.active).flatMap(n=>[...n.ways]));
  return (trip?.wayIds||[]).flatMap((id,i)=>blocked.has(id)?[i]:[]);
 }
 function verifyResponse(items){
  const result={};
  if(!Array.isArray(items))return result;
  const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&v;
  for(const known of catalog){
   const item=items.find(i=>i?.countryCode==='FR'&&i.number===known.number);
   if(!item)continue;
   if(item.stateMessage==='Withdrawn'||item.stateMessage==='Cancelled'){result[known.number]={withdrawn:true};continue;}
   if(item.state!==80||!item.limitations?.includes?.('OBSTRU'))continue;
   const start=date(item.dateStart),end=date(item.dateEnd);
   if(start&&end&&start<=end)result[known.number]={start,end};
  }
  return result;
 }
 const api={dateInFrance,mapped,relevant,closedEdges,verifyResponse};
 if(typeof module!=='undefined')module.exports=api;
 else root.NauticNotices=api;
})(typeof window!=='undefined'?window:globalThis);
