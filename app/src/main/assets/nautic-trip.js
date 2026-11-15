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
    const next = cost + leg.length;
    if (next >= (costs.get(leg.to) ?? Infinity)) continue;
    costs.set(leg.to, next);
    parents.set(leg.to, {previous: id, leg});
    queue.push([leg.to, next]);
   }
  }
  return null;
 }

 function create(elements, location, destination) {
  const {edges} = W.parse(elements.filter(element => element.type === 'way'));
  const start = snap(edges, location), target = snap(edges, destination);
  if (!start || start.d > maxBankOffset || !target || target.d > maxBankOffset) return null;
  const posts = elements.map(post).filter(Boolean).map(p => {
   const projection = snap(edges, p);
   return {...projection, pk: p.pk};
  }).filter(p => p.d <= maxBankOffset);
  const candidates = posts.filter(p => p.edge.waterway === target.edge.waterway &&
   W.distance(p, target) <= maxPostDistance)
   .sort((a, b) => W.distance(a, destination) - W.distance(b, destination));
  const nearestPost = candidates[0];
  const legs = shortestPath(edges, start, nearestPost || target);
  if (!legs) return null;

  const departurePost = posts.find(p => p.edge.waterway === start.edge.waterway && W.distance(p, start) < 1);
  const singleWaterway = nearestPost && departurePost &&
   nearestPost.edge.waterway === departurePost.edge.waterway &&
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
   const direction = Math.sign(nearestPost.pk - departurePost.pk);
   const ordered = [departurePost, ...anchors.filter(p => p.at > 0 && p.at < length), nearestPost];
   if (direction && ordered.every((p, i) => !i || (p.pk - ordered[i - 1].pk) * direction >= 0)) {
    return {legs, end: point(nearestPost), pk: nearestPost.pk,
     total: Math.abs(nearestPost.pk - departurePost.pk), estimated: false};
   }
  }
  const calibrated = intervals.reduce((total, item) => total + item.end - item.start, 0);
  const correction = intervals.reduce((total, item) => total + (item.end - item.start) * (item.factor - 1), 0);
  return {
   legs, end: point(nearestPost || target), pk: nearestPost?.pk ?? null,
   total: (length + correction) / 1000, estimated: length - calibrated > 1
  };
 }

 function fromNetwork(elements, start, end) {
  const permitted = elements.filter(element => {
   if(element.type !== 'way')return true;
   const tags = element.tags || {};
   return tags.boat !== 'no' && tags.motorboat !== 'no';
  });
  const available = create(permitted, start, end);
  const route = available || (permitted.length < elements.length ? create(elements, start, end) : null);
  if(!route)return null;
  const coordinates = route.legs.length ? [route.legs[0].a, ...route.legs.map(leg=>leg.b)].map(point) : [point(route.end)];
  return {coordinates, total:route.total, pk:route.pk, estimated:route.estimated, restricted:!available};
 }

 function approximate(start, end, via = []) {
  const coordinates = [start,...via,end].map(point);
  const total = coordinates.reduce((sum,p,i)=>i ? sum+W.distance(coordinates[i-1],p)/1000 : sum,0);
  return {coordinates,total,pk:null,estimated:true,restricted:false,approximate:true};
 }

 const remaining = (totalKm, coveredMetres) => Math.max(0, totalKm - coveredMetres / 1000);
 const api = {create, fromNetwork, approximate, remaining};
 if (typeof module !== 'undefined') module.exports = api;
 else root.NauticTrip = api;
})(typeof window !== 'undefined' ? window : globalThis);
