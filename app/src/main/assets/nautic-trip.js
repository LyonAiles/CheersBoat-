/* Fluvial routing on connected OSM waterways, with kilometre posts where mapped. */
(function (root) {
 const W = root.NauticWaterways || require('./nautic-waterways.js');
 const maxBankOffset = 150;
 const maxPostDistance = 1500;
 const point = candidate => ({lat: candidate.lat, lon: candidate.lon});

 function snap(edges, position) {
  let best = null;
  for (const edge of edges) {
   const projection = W.project(position, edge.a, edge.b);
   if (!best || projection.d < best.d) best = {...projection, edge};
  }
  return best;
 }

 function reachableEdges(edges,start) {
  const adjacent=new Map();
  for(const edge of edges){
   for(const id of [edge.from,edge.to]){
    if(!adjacent.has(id))adjacent.set(id,[]);
    adjacent.get(id).push(edge);
   }
  }
  const reached=new Set(), visited=new Set([start.from]), pending=[start.from];
  while(pending.length){
   const id=pending.pop();
   for(const edge of adjacent.get(id)||[]){
    reached.add(edge);
    const to=edge.from===id?edge.to:edge.from;
    if(!visited.has(to)){visited.add(to);pending.push(to);}
   }
  }
  return [...reached];
 }

 function post(element) {
  const tags = element.tags || {};
  const units = tags['seamark:distance_mark:units'];
  const value = tags['seamark:distance_mark:distance'];
  if (element.type !== 'node' || !units?.match(/^kilomet(?:re|er)s?$/i) ||
      !value?.match(/^\d+(?:[.,]\d+)?$/)) return null;
  return {...point(element), pk: Number(value.replace(',', '.'))};
 }

 function shortestPath(edges, start, end) {
  const from = Symbol('start'), to = Symbol('end');
  const adjacency = new Map();
  function connect(a, b, p, q, edge, t1, t2) {
   const length = Math.abs(t2 - t1) * edge.length;
   if (!adjacency.has(a)) adjacency.set(a, []);
   if (!adjacency.has(b)) adjacency.set(b, []);
   adjacency.get(a).push({to: b, a: p, b: q, length, edge, t1, t2});
   adjacency.get(b).push({to: a, a: q, b: p, length, edge, t1: t2, t2: t1});
  }
  for (const edge of edges) connect(edge.from, edge.to, edge.a, edge.b, edge, 0, 1);
  for (const [id, projection] of [[from, start], [to, end]]) {
   const {edge, t} = projection;
   connect(id, edge.from, projection, edge.a, edge, t, 0);
   connect(id, edge.to, projection, edge.b, edge, t, 1);
  }
  if (start.edge === end.edge) connect(from, to, start, end, start.edge, start.t, end.t);
  const costs = new Map([[from, 0]]), parents = new Map();
  const queue = [[from, 0]];
  while (queue.length) {
   queue.sort((a, b) => b[1] - a[1]);
   const [id, cost] = queue.pop();
   if (cost !== costs.get(id)) continue;
   if (id === to) {
    const route = [];
    for (let node = to; node !== from;) {
     const {previous, leg} = parents.get(node);
     if (leg.length > 0) route.push(leg);
     node = previous;
    }
    return route.reverse();
   }
   for (const leg of adjacency.get(id) || []) {
    const next = cost + leg.length * (leg.edge.restricted ? 8 : 1);
    if (next >= (costs.get(leg.to) ?? Infinity)) continue;
    costs.set(leg.to, next);
    parents.set(leg.to, {previous: id, leg});
    queue.push([leg.to, next]);
   }
  }
  return null;
 }

 function create(elements, location, destination, destinationLimit = maxBankOffset) {
  const {edges} = W.parse(elements.filter(element => element.type === 'way'));
  const start=snap(edges,location);
  if(!start||start.d>maxBankOffset)return null;
  const graph=destinationLimit>maxBankOffset?reachableEdges(edges,start.edge):edges;
  const target=snap(graph,destination);
  if(!target||target.d>destinationLimit)return null;
  const posts = elements.map(post).filter(Boolean).map(p => {
   const projection = snap(edges, p);
   return {...projection, pk: p.pk};
  }).filter(p => p.d <= maxBankOffset);
  const candidates = posts.filter(p => p.edge.waterway === target.edge.waterway &&
   W.distance(p, target) <= maxPostDistance)
   .sort((a, b) => W.distance(a, destination) - W.distance(b, destination));
  const nearestPost = candidates[0];
  let endPost=nearestPost;
  let legs = shortestPath(graph, start, endPost || target);
  if(!legs&&endPost){endPost=null;legs=shortestPath(graph,start,target);}
  if (!legs) return null;

  const arrivalOffset=W.distance(destination,endPost||target);
  const departurePost = posts.find(p => p.edge.waterway === start.edge.waterway && W.distance(p, start) < 1);
  const singleWaterway = endPost && departurePost &&
   endPost.edge.waterway === departurePost.edge.waterway &&
   legs.every(leg => leg.edge.waterway === departurePost.edge.waterway);
  let length = 0;
  const anchors = [];
  const byEdge = new Map();
  for (const p of posts) {
   if (!byEdge.has(p.edge)) byEdge.set(p.edge, []);
   byEdge.get(p.edge).push(p);
  }
  for (const leg of legs) {
   leg.offset = length;
   for (const p of byEdge.get(leg.edge) || []) {
    const fraction = (p.t - leg.t1) / (leg.t2 - leg.t1);
    if ((fraction >= 0 || leg === legs[0]) && (fraction <= 1 || leg === legs.at(-1))) {
     anchors.push({at: length + fraction * leg.length, pk: p.pk, waterway: leg.edge.waterway});
    }
   }
   length += leg.length;
  }
  anchors.sort((a, b) => a.at - b.at);

  // Only subtract PKs on the same identified waterway. A numbering reset,
  // junction or sparsely mapped section keeps its geometric length.
  const intervals = [];
  for (let i = 1; i < anchors.length; i++) {
   const a = anchors[i - 1], b = anchors[i];
   const measured = b.at - a.at, pkLength = Math.abs(b.pk - a.pk) * 1000;
   if (a.waterway === b.waterway && a.at < length && b.at > 0 && measured > 0 && pkLength >= measured * .8 &&
       pkLength <= measured * 1.2 && legs.every(leg =>
        leg.offset >= b.at || leg.offset + leg.length <= a.at || leg.edge.waterway === a.waterway)) {
    intervals.push({start: Math.max(0, a.at), end: Math.min(length, b.at), factor: pkLength / measured});
   }
  }
  if (singleWaterway) {
   const direction = Math.sign(endPost.pk - departurePost.pk);
   const ordered = [departurePost, ...anchors.filter(p => p.at > 0 && p.at < length), endPost];
   if (direction && ordered.every((p, i) => !i || (p.pk - ordered[i - 1].pk) * direction >= 0)) {
    return {legs, end: point(endPost), pk: endPost.pk,
     total: Math.abs(endPost.pk - departurePost.pk), estimated: false, arrivalOffset};
   }
  }
  const calibrated = intervals.reduce((total, item) => total + item.end - item.start, 0);
  const correction = intervals.reduce((total, item) => total + (item.end - item.start) * (item.factor - 1), 0);
  return {
   legs, end: point(endPost || target), pk: endPost?.pk ?? null,
   total: (length + correction) / 1000, estimated: length - calibrated > 1, arrivalOffset
  };
 }

 function fromNetwork(elements, start, end, destinationLimit) {
  // Access restrictions describe navigation, not the physical waterway graph.
  const route=create(elements,start,end,destinationLimit);
  if(!route)return null;
  const coordinates=route.legs.length?[route.legs[0].a,...route.legs.map(leg=>leg.b)].map(point):[point(route.end)];
  const closedEdges=route.legs.flatMap((leg,i)=>leg.edge.restricted?[i]:[]);
  const openEdges=route.legs.flatMap((leg,i)=>leg.edge.chartedOpen&&!leg.edge.restricted?[i]:[]);
  return {coordinates,openEdges,arrivalOffset:route.arrivalOffset,total:route.total,pk:route.pk,estimated:route.estimated,restricted:closedEdges.length>0,closedEdges,wayIds:route.legs.map(leg=>leg.edge.wayId),restrictionVersion:3};
 }

 function geometry(coordinates) {
  let total=0;
  const offsets=coordinates.map((p,i)=>i?(total+=W.distance(coordinates[i-1],p)):0);
  return {offsets,total};
 }

 function locate(coordinates, position) {
  const {offsets}=geometry(coordinates);
  let best=null;
  for(let i=1;i<coordinates.length;i++){
   const hit=W.project(position,coordinates[i-1],coordinates[i]);
   if(!best||hit.d<best.distance)best={edgeIndex:i-1,point:point(hit),distance:hit.d,offset:offsets[i-1]+hit.t*(offsets[i]-offsets[i-1])};
  }
  return best;
 }

 function sections(trip, closures=[], verifiedEdges=[], startAt=0, vigilanceSections) {
  const {coordinates}=trip;
  const {offsets,total}=geometry(coordinates);
  const spans=[];
  for(const closure of closures){
   if(!closure.from||!closure.to){spans.push([0,total]);continue;}
   const a=locate(coordinates,closure.from),b=locate(coordinates,closure.to);
   if(a&&b&&a.distance<=300&&b.distance<=300)spans.push([Math.min(a.offset,b.offset),Math.max(a.offset,b.offset)]);
  }
  const known=new Set([...(trip.closedEdges||[]),...verifiedEdges]);
  const chartedOpen=new Set(trip.openEdges||[]);
  const cuts=spans.flat().sort((a,b)=>a-b);
  let cursor=0;
  const result=[];
  for(let i=1;i<coordinates.length;i++){
   const start=offsets[i-1],end=offsets[i];
   if(start===end||end<=startAt)continue;
   while(cursor<cuts.length&&cuts[cursor]<=start)cursor++;
   const stops=[Math.max(start,startAt)];
   while(cursor<cuts.length&&cuts[cursor]<end){
    if(cuts[cursor]>startAt)stops.push(cuts[cursor]);
    cursor++;
   }
   stops.push(end);
   const a=coordinates[i-1],b=coordinates[i];
   const at=d=>{
    if(d===start)return a;
    if(d===end)return b;
    const t=(d-start)/(end-start);
    return {lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t};
   };
   for(let j=1;j<stops.length;j++){
    const lo=stops[j-1],hi=stops[j],mid=(lo+hi)/2;
    if(lo===hi)continue;
    const closed=known.has(i-1)||spans.some(([from,to])=>from<=mid&&mid<=to);
    const state=closed?'closed':chartedOpen.has(i-1)?'open':'unknown';
    const previous=result.at(-1);
    const section=trip.wayIds?.[i-1];
    const vigilance=vigilanceSections?.has(section)?section:undefined;
    if(previous?.state===state&&previous.vigilance===vigilance)previous.coordinates.push(at(hi));
    else result.push({closed,state,vigilance,coordinates:[at(lo),at(hi)]});
   }
  }
  return result;
 }

 function resume(trip, gps, tolerance=300) {
  const hit=gps&&locate(trip.coordinates,gps);
  if(!hit||hit.distance>tolerance)return null;
  const length=geometry(trip.coordinates).total;
  return {offset:hit.offset,total:length?trip.total*(1-hit.offset/length):0};
 }

 function departurePlan(trip, restrictions, departureOffset=0) {
  const {offsets,total}=geometry(trip.coordinates);
  const spans=restrictions.flatMap(restriction=>{
   const {indices,from,to}=restriction;
   if(indices){
    return indices.flatMap(index=>offsets[index+1]>departureOffset?
     [{...restriction,fromOffset:Math.max(departureOffset,offsets[index])}]:[]);
   }
   const a=from&&locate(trip.coordinates,from),b=to&&locate(trip.coordinates,to);
   if(from&&(!a||!b||a.distance>300||b.distance>300))return [];
   const end=a?Math.max(a.offset,b.offset):total;
   if(end<=departureOffset)return [];
   return [{...restriction,fromOffset:Math.max(departureOffset,a?Math.min(a.offset,b.offset):0)}];
  });
  spans.sort((a,b)=>a.fromOffset-b.fromOffset||
   (b.date||'9999').localeCompare(a.date||'9999'));
  const stages=[];
  for(const item of spans){
   if(!item.date)break;
   if(!stages.length||item.date>stages.at(-1).date)stages.push(item);
  }
  const unknown=spans.some(item=>!item.date);
  return {stages,unknown,date:unknown?null:stages.at(-1)?.date||null,
   progressive:stages.length>1,firstOffset:spans[0]?.fromOffset-departureOffset};
 }

 const remaining = (totalKm, coveredMetres) => Math.max(0, totalKm - coveredMetres / 1000);
 const api = {create, fromNetwork, locate, sections, resume, departurePlan, remaining};
 if (typeof module !== 'undefined') module.exports = api;
 else root.NauticTrip = api;
})(typeof window !== 'undefined' ? window : globalThis);
