const assert = require('node:assert/strict');
const {create, remaining, fromNetwork, approximate} = require('../../app/src/main/assets/nautic-trip.js');

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
const direct = approximate(p(0),p(.018,.004));
const indicative = approximate(p(0),p(.018,.004),[p(.009)]);
assert.equal(direct.approximate,true);
assert(indicative.total>direct.total);
assert.equal(indicative.coordinates.length,3);
console.log('PASS: restricted paths remain traceable and offline waypoints refine the distance');
