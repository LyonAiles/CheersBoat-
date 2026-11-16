const assert = require('node:assert/strict');
const {create, remaining, fromNetwork, locate, sections} = require('../../app/src/main/assets/nautic-trip.js');

const p = (lat, lon = 0) => ({lat, lon});
const way = (id, nodes, geometry, name = 'Canal') => ({
 type: 'way', id, nodes, geometry, tags: {waterway: 'canal', name}
});
const pk = (id, position, distance) => ({
 type: 'node', id, ...position,
 tags: {'seamark:distance_mark:distance': String(distance), 'seamark:distance_mark:units': 'kilometres'}
});
const water = [
 way(1, [1, 2], [p(0), p(.009)]),
 way(2, [2, 3, 4], [p(.009), p(.009, .004), p(.018, .004)])
];
const elements = [...water, pk(10, p(0), 42), pk(11, p(.009), 43), pk(12, p(.018, .004), 44.4)];
const trip = create(elements, p(0), p(.0175, .004));
assert.equal(trip.pk, 44.4);
assert.equal(trip.estimated, false);
assert(Math.abs(trip.total - 2.4) < 1e-8);
assert.equal(remaining(22, 5800), 16.2);
assert.equal(remaining(22, 23000), 0);
const pkExample = [...water, pk(20, p(0), 192), pk(21, p(.018, .004), 170)];
assert.equal(create(pkExample, p(0), p(.018, .004)).total, 22);
assert.equal(create(pkExample, p(.018, .004), p(0)).total, 22);

const reverse = create(elements, p(.018, .004), p(0));
assert.equal(reverse.pk, 42);
assert(Math.abs(reverse.total - 2.4) < 1e-8);
const partial = create(elements, p(.0045), p(.018, .004));
assert(Math.abs(partial.total - 1.9) < 1e-8);

const uncalibrated = create(water, p(0), p(.018, .004));
assert.equal(uncalibrated.pk, null);
assert.equal(uncalibrated.estimated, true);
assert(uncalibrated.total > 2.4);
assert.equal(create(water, p(0), p(.022, .004)), null);
assert.equal(create([...water, way(3, [5, 6], [p(.02, .004), p(.024, .004)])], p(0), p(.024, .004)), null);

const reset = create([
 water[0], way(2, [2, 3, 4], [p(.009), p(.009, .004), p(.018, .004)], 'Autre canal'),
 pk(10, p(0), 42), pk(11, p(.009), 43), pk(12, p(.018, .004), 1)
], p(0), p(.018, .004));
assert.equal(reset.pk, 1);
assert.equal(reset.estimated, true);
assert(reset.total > 2 && reset.total < 3);
console.log('PASS: PK calibration, partial segment, reverse direction, GPS distance subtraction, missing PK, network gaps and numbering changes');

const denied = {...water[1],tags:{...water[1].tags,motorboat:'no'}};
const restricted = fromNetwork([water[0],denied],p(0),p(.018,.004));
assert.equal(restricted.restricted,true);
assert(restricted.coordinates.length>2);
assert.equal(fromNetwork(water,p(0),p(.018,.004)).restricted,false);
assert.deepEqual(restricted.closedEdges,[1,2]);
const drawn = sections(restricted);
assert.deepEqual(drawn.map(part=>part.closed),[false,true]);
assert.deepEqual(drawn[0].coordinates.at(-1),p(.009));
assert.deepEqual(drawn[1].coordinates,[p(.009),p(.009,.004),p(.018,.004)]);

const route = fromNetwork(water,p(0),p(.018,.004));
const mark = {from:p(.0135,.004),to:p(.0045)};
const marked = sections(route,[mark]);
assert.deepEqual(marked.map(part=>part.closed),[false,true,false]);
assert(Math.abs(marked[1].coordinates[0].lat-.0045)<1e-9);
assert.deepEqual(marked[1].coordinates.slice(1,3),[p(.009),p(.009,.004)]);
assert(Math.abs(marked[1].coordinates.at(-1).lat-.0135)<1e-9);
assert(locate(route.coordinates,p(.006,.00005)).distance<6);
assert(sections(route,[{date:'2027-03-01'}]).every(part=>part.closed));
console.log('PASS: restrictions and manual closures color only their portions, following the waterway');

const fs = require('node:fs');
const vm = require('node:vm');
const embedded = {window:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../../app/src/main/assets/nautic-waterways-briare.js'),'utf8'), embedded);
const localWaterways = embedded.window.NauticLocalWaterways;
const chatillonPort = p(47.5932873,2.758253);
const montargis = p(48.001,2.732);
const localRoute = fromNetwork(localWaterways,chatillonPort,montargis,1000);
assert(localRoute.total>55 && localRoute.total<65);
assert(localRoute.coordinates.length>500);
assert(localRoute.coordinates.some(q=>q.lat>47.63&&q.lat<47.65&&q.lon>2.72&&q.lon<2.75));
const blockedAfterBriare = sections(localRoute,[{from:p(47.639,2.745),to:localRoute.coordinates.at(-1)}]);
assert.deepEqual(blockedAfterBriare.map(section=>section.closed),[false,true]);
assert(blockedAfterBriare[1].coordinates.length>500);
console.log('PASS: actual connected Châtillon–Briare–Montargis canal geometry without network access');

const notices = require('../../app/src/main/assets/nautic-notices.js');
assert.equal(notices.dateInFrance(new Date('2026-11-15T23:01:00Z')), '2026-11-16');
const upcoming = notices.relevant(localRoute,{},'2026-11-15');
assert.equal(upcoming.length,2);
assert.deepEqual(notices.closedEdges(localRoute,upcoming),[]);
const active = notices.relevant(localRoute,{},'2026-11-16');
const closed = notices.closedEdges(localRoute,active);
assert.equal(active.length,2);
assert(closed.length>0 && closed.length<localRoute.wayIds.length);
const officialSections = sections(localRoute,[],closed);
assert(officialSections.some(section=>section.closed));
assert(officialSections.some(section=>!section.closed));
assert.deepEqual(notices.relevant(localRoute,{},'2027-01-01'),[]);
const published = {countryCode:'FR',number:'2026/8405/0',state:80,limitations:['OBSTRU'],dateStart:'2026-11-16',dateEnd:'2027-02-28'};
const verified = notices.verifyResponse([published]);
assert.equal(notices.relevant(localRoute,verified,'2027-01-01').length,1);
assert.deepEqual(notices.verifyResponse([{...published,state:1}]),{});
assert.deepEqual(notices.verifyResponse([{...published,limitations:[]}]),{});
console.log('PASS: French dates, mapped VNF closures, unknown reaches, and confirmed extensions');

const {resume}=require('../../app/src/main/assets/nautic-trip.js');
const resumed=resume(route,p(.006,.00005));
assert(resumed.offset>0 && resumed.total<route.total);
assert.equal(resume(route,p(.1)),null);
assert.equal(resume(route,null),null);
const resumedSections=sections(route,[mark],[],resumed.offset);
assert(Math.abs(resumedSections[0].coordinates[0].lat-.006)<1e-9);
assert(resumedSections[0].closed);
assert.deepEqual(resumedSections.at(-1).coordinates.at(-1),route.coordinates.at(-1));
assert.equal(resume(route,route.coordinates.at(-1)).total,0);
assert.deepEqual(sections(route,[],[],resume(route,route.coordinates.at(-1)).offset),[]);
console.log('PASS: reopening uses the GPS projection along the stored route and preserves intersected closures');

const region = require('../../app/src/main/assets/nautic-waterways-regional.js');
const avignon = p(43.9416,4.8333);
assert.equal(fromNetwork(region,chatillonPort,avignon),null);
const longTrip = fromNetwork(region,chatillonPort,avignon,5000);
assert(longTrip.total>650 && longTrip.total<720);
assert(longTrip.arrivalOffset>150 && longTrip.arrivalOffset<2500);
assert(longTrip.coordinates.some(q=>q.lat>46.79&&q.lat<46.82&&q.lon>4.85&&q.lon<4.88));
const loireNotices = notices.relevant(longTrip,{},'2026-11-16');
const verifiedLongEdges = notices.closedEdges(longTrip,loireNotices);
assert(verifiedLongEdges.length>500);
const states = sections(longTrip,[],verifiedLongEdges);
assert(states.some(part=>part.state==='closed') && states.some(part=>part.state==='open') &&
       states.some(part=>part.state==='unknown'));
assert.equal(states[0].state,'closed');
console.log('PASS: connected Châtillon–Avignon itinerary, waterway arrival, and three distinct navigation states');

const euris = require('../../app/src/main/assets/nautic-euris.js');
const nation = {window:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../../app/src/main/assets/nautic-euris-data.js'),'utf8'),nation);
vm.runInNewContext(fs.readFileSync(require.resolve('../../app/src/main/assets/nautic-euris-seed.js'),'utf8'),nation);
const nationalNetwork=euris.network(nation.NauticEurisRows);
const nationalCatalog=euris.catalog(nationalNetwork);
const seed=nation.window.NauticEurisSeed;
const impacts=euris.compile(seed,nationalCatalog,{fromNetwork,locate});
const moment=Date.parse('2026-11-16T09:00:00+01:00');
assert(impacts.every(item=>item.paths.size>0));
for(const [destination,min,max] of [[avignon,650,720],[p(48.5833,7.7458),650,750],[p(50.847,4.352),570,650]]){
 const full=fromNetwork(nationalNetwork,chatillonPort,destination,5000);
 assert(full?.total>min&&full.total<max);
 assert(full.arrivalOffset<2500);
 const blocked=euris.matching(full,impacts,nationalCatalog,{locate},moment);
 assert(blocked.some(item=>item.closure&&item.active&&item.indices.length));
 assert(!euris.matching(full,impacts,nationalCatalog,{locate},moment-24*3600*1000).some(item=>item.active));
 const states=sections(full,[],blocked.flatMap(item=>item.indices));
 assert(states.some(section=>section.closed)&&states.some(section=>section.state==='unknown'));
}
const updated=euris.merge(seed,{scopes:['FR150'],items:[],refs:[]});
assert.equal(updated.items.length,2);
assert.match(updated.items[0].ntsNumber,/8405/);
assert.equal(updated.refs.length,4);
console.log('PASS: national routes to Avignon, Strasbourg and Brussels and official impact boundaries');

const oldCentre=notices.relevant(longTrip,{},'2026-11-16').find(item=>item.number==='2026/8407/0');
assert(oldCentre?.active);
const newCentre=euris.matching(fromNetwork(nationalNetwork,chatillonPort,avignon,5000),impacts,nationalCatalog,{locate},moment)
 .find(item=>item.reference.includes('8407'));
assert(newCentre?.active && newCentre.indices.length>100);
console.log('PASS: the Canal du Centre closure applies to saved OSM and EuRIS Avignon routes');

const {departurePlan}=require('../../app/src/main/assets/nautic-trip.js');
const reopening=departurePlan(longTrip,[
 {indices:[20,21],date:'2026-12-01'},{indices:[230],date:'2026-12-14'}
]);
assert.equal(reopening.date,'2026-12-14');
assert.deepEqual(reopening.stages.map(item=>item.date),['2026-12-01','2026-12-14']);
assert(reopening.progressive);
const notProgressive=departurePlan(longTrip,[
 {indices:[20],date:'2026-12-14'},{indices:[230],date:'2026-12-01'}
]);
assert.equal(notProgressive.date,'2026-12-14');
assert(!notProgressive.progressive);
assert(departurePlan(longTrip,[{indices:[20],date:null}]).unknown);
const resumedAt=locate(longTrip.coordinates,longTrip.coordinates[22]).offset;
assert.equal(departurePlan(longTrip,[{indices:[20],date:null}],resumedAt).unknown,false);
console.log('PASS: departure date, progressive closures, unknown dates and already passed restrictions');

const access=require('../../app/src/main/assets/nautic-accessible.js');
const connected=[
 {sourceId:'A',scope:'FRVN150',nodes:['1','2'],geometry:[p(0),p(.01)],tags:{}},
 {sourceId:'B',scope:'FRVN150',nodes:['2','3'],geometry:[p(.01),p(.02)],tags:{boat:'no'}},
 {sourceId:'C',scope:'FRVN150',nodes:['3','4'],geometry:[p(.02),p(.03)],tags:{}},
 {sourceId:'D',scope:'FRVN150',nodes:['8','9'],geometry:[p(.04),p(.05)],tags:{}}
];
const capacities={A:[200,400,500],B:[200,360,500],C:[200,-1,500],D:[200,-1,500]};
const profile={draught:150,air:345,width:430};
const visible=(dimensions=profile,limits=capacities)=>access.compatibleSections(connected,limits,dimensions);
const ids=result=>result.features.map(f=>f.properties.section);
assert.deepEqual(ids(visible()),['A','B','C','D']);
assert.deepEqual(ids(visible({...profile,air:375})),['A','C','D']);
assert.deepEqual(ids(visible({...profile,width:550})),[]);
assert.deepEqual(ids(visible({...profile,draught:210})),[]);
const missing=visible(profile,{...capacities,A:[200,0,500]});
assert.deepEqual(ids(missing),['B','C','D']);
assert.deepEqual(missing.unverified.map(f=>f.properties.section),['A']);
assert.equal(missing.unverified[0].properties.status,'unknown');
const tooWide=visible({...profile,width:550},{...capacities,A:[200,0,500]});
assert.equal(tooWide.insufficient.length,4);
assert(tooWide.insufficient.every(item=>item.properties.status==='insufficient'));
assert.equal(tooWide.unverified.length,0);
console.log('PASS: France-wide dimensions filter includes disconnected and closed sections without GPS');
assert.deepEqual(access.exceeded([100,180,230],{draught:100,air:200,width:200}),[
 {key:'draught',limit:100,value:100},{key:'air',limit:180,value:200}
]);
assert.deepEqual(access.exceeded([0,-1,200],{draught:100,air:200,width:210}),[
 {key:'width',limit:200,value:210}
]);
