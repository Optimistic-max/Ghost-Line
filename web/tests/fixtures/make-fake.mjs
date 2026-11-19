// Writes the made-up "fake" line used by the site's tests into tests/fixtures/fake/.
// Run from web/:  node tests/fixtures/make-fake.mjs
//
// Every corner, time and number here is made up. The files have the same shape
// as the generated files in public/data, and are never written under public/.
// The race rows are filled by a simple made-up rule so that totals, results and
// margins agree with each other; this is test data, not the race engine.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'fake');
const TAG = 'Test fixture: a made-up line and made-up numbers. Not Baltimore data.';
const FIRST = 9 * 60;
const LAST = 13 * 60 + 52;
const WINDOW = [9 * 60, 14 * 60];
// The made-up photo-finish band: unlike the real one, so tests catch any typed value.
const BAND = 2;
const R3 = (x) => Math.round(x * 1000) / 1000;
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const hhmmss = (m) => {
  const s = Math.round(m * 60);
  const h = Math.floor(s / 3600);
  return `${String(h).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const range = (from, to, step) => {
  const out = [];
  for (let m = from; m <= to; m += step) out.push(m);
  return out;
};
const alternating = (from, to, steps) => {
  const out = [];
  for (let m = from, k = 0; m <= to; m += steps[k % steps.length], k += 1) out.push(m);
  return out;
};
const gaps = (times) => {
  const inWindow = times.filter((t) => t >= WINDOW[0] && t < WINDOW[1]);
  const diffs = inWindow.slice(1).map((t, k) => R3(t - inWindow[k]));
  return diffs.length ? [Math.min(...diffs), Math.max(...diffs)] : [null, null];
};

const SOURCES_1938 = ['guide1938_diagram', 'guide1938_timetable'];
const SOURCES_TODAY = ['mta_gtfs', 'method'];
const SOURCES_RACES = ['guide1938_diagram', 'guide1938_timetable', 'mta_gtfs', 'method'];

const corners = [
  { slug: 'fake-first', name: 'Fake & First', lonlat: [0.01, 0.01], inferred: false, note: null },
  { slug: 'fake-second', name: 'Fake & Second', lonlat: [0.02, 0.012], inferred: false, note: null },
  { slug: 'fake-third', name: 'Fake & Third', lonlat: [0.03, 0.014], inferred: true, note: 'Made-up note: this fake corner is inferred.' },
  { slug: 'fake-fourth', name: 'Fake & Fourth', lonlat: [0.04, 0.012], inferred: false, note: null },
  { slug: 'fake-fifth', name: 'Fake & Fifth', lonlat: [0.05, 0.01], inferred: false, note: null },
];

/** Made-up pairs: the 1938 car times and ride, and the made-up bus trips. */
const PAIRS = [
  {
    // Every result: 1938 wins, today wins and photo finishes. Before the table until 09:10.
    origin: 'fake-first', dest: 'fake-second', direction: 'eastbound',
    ride1938: 10, passes: range(9 * 60 + 10, 14 * 60 + 10, 6),
    trips: range(9 * 60 + 5.5, 14 * 60 + 45.5, 20).map((dep) => ({ dep, ride: 4, walkTo: 1, walkFrom: 1, route: 'FAKE 1' })),
    routes: { 'FAKE 1': 'Fake One' },
  },
  {
    // Two routes; gaps of 9 and 11 minutes; 1938 every 7 or 8.
    origin: 'fake-second', dest: 'fake-first', direction: 'westbound',
    ride1938: 10, passes: alternating(9 * 60 + 3, 14 * 60 + 10, [7, 8]),
    trips: alternating(9 * 60 + 2, 14 * 60 + 40, [9, 11]).map((dep, k) => ({ dep, ride: 6.5, walkTo: 0.8, walkFrom: 1.6, route: k % 2 ? 'FAKE 2' : 'FAKE 1' })),
    routes: { 'FAKE 1': 'Fake One', 'FAKE 2': 'Fake Two' },
  },
  {
    // No one-seat ride: no trips at all, so null gaps and every row today: null.
    origin: 'fake-first', dest: 'fake-fifth', direction: 'eastbound',
    ride1938: 25, passes: range(9 * 60, 14 * 60 + 10, 6),
    trips: [],
    routes: {},
  },
  {
    // Trips only until about 11:00, so later rows have today: null. Two trips 0.3 min
    // apart make a lower gap that rounds to 0. Today's ride is slower than 1938's.
    origin: 'fake-fifth', dest: 'fake-first', direction: 'westbound',
    ride1938: 25, passes: range(9 * 60 + 2, 14 * 60 + 10, 6),
    trips: [9 * 60 + 20, 9 * 60 + 20.3, ...range(9 * 60 + 35, 11 * 60, 15)].map((dep) => ({ dep, ride: 30, walkTo: 2, walkFrom: 2, route: 'FAKE 3' })),
    routes: { 'FAKE 3': 'Fake Three' },
  },
  {
    // A pair with the inferred corner.
    origin: 'fake-third', dest: 'fake-fourth', direction: 'eastbound',
    ride1938: 6, passes: range(9 * 60 + 1, 14 * 60 + 10, 6),
    trips: range(9 * 60 + 4.25, 14 * 60 + 40, 12).map((dep) => ({ dep, ride: 5, walkTo: 1.5, walkFrom: 1.5, route: 'FAKE 1' })),
    routes: { 'FAKE 1': 'Fake One' },
  },
];

const stop = (id, name, walkMin) => ({ stop_id: id, name, walk_m: R3((walkMin * 60 * 1.2) / 1.3), walk_min: walkMin });

function buildRace(p) {
  const coveredFrom = p.passes[0];
  const allTrips = p.trips.map((t, i) => ({
    i,
    trip_id: `fake-trip-${p.origin}-${i}`,
    route: t.route,
    route_display: p.routes[t.route],
    headsign: p.direction === 'eastbound' ? 'FAKE EAST' : 'FAKE WEST',
    headsign_display: p.direction === 'eastbound' ? 'Fake East' : 'Fake West',
    board: stop(`fake-stop-${p.origin}`, `FAKE STOP AT ${p.origin.toUpperCase()}`, t.walkTo),
    alight: stop(`fake-stop-${p.dest}`, `FAKE STOP AT ${p.dest.toUpperCase()}`, t.walkFrom),
    dep: hhmmss(t.dep),
    arr: hhmmss(t.dep + t.ride),
    ride_min: t.ride,
    _dep: t.dep,
    _t: t,
  }));
  let lastUsed = -1;
  const races = [];
  for (let t = FIRST; t <= LAST; t += 1) {
    const start = Math.max(t, coveredFrom);
    const dep = p.passes.find((x) => x >= start);
    const y1938 = { dep: hhmm(dep), wait: R3(dep - start), total: R3(dep - start + p.ride1938) };
    const trip = allTrips.find((x) => x._dep - x._t.walkTo >= start);
    let today = null;
    if (trip) {
      lastUsed = Math.max(lastUsed, trip.i);
      const wait = R3(trip._dep - start - trip._t.walkTo);
      today = { trip: trip.i, wait, total: R3(trip._t.walkTo + wait + trip._t.ride + trip._t.walkFrom) };
    }
    const row = { t: hhmm(t), start: hhmm(start), before_table: t < coveredFrom, y1938, today };
    if (!today) row.result = 'no_one_seat_ride';
    else {
      const diff = R3(today.total - y1938.total);
      row.result = Math.abs(diff) < BAND ? 'photo_finish' : diff > 0 ? '1938' : 'today';
      row.margin = Math.abs(diff);
    }
    races.push(row);
  }
  const trips = allTrips.slice(0, lastUsed === -1 ? 0 : lastUsed + 4).map(({ _dep, _t, ...trip }) => trip);
  const [tMin, tMax] = gaps(trips.map((x) => p.trips[x.i].dep));
  const [yMin, yMax] = gaps(p.passes);
  const routeNames = [...new Set(trips.map((x) => x.route_display))];
  return {
    schema: 'ghostline.race.v1',
    line: 'fake',
    origin: p.origin,
    dest: p.dest,
    direction: p.direction,
    inferred: [p.origin, p.dest].some((s) => corners.find((c) => c.slug === s).inferred),
    service_date: '2000-01-05',
    feed_version: 'fake-feed-1',
    feed_sha256: '0'.repeat(64),
    radius_m: 400,
    y1938: {
      ride_min: p.ride1938,
      covered_from: hhmm(coveredFrom),
      passes: p.passes.map(hhmm),
      gap_min: yMin,
      gap_max: yMax,
      sources: { ride_min: 'https://example.org/fake/diagram', passes: 'https://example.org/fake/timetable' },
    },
    today: { gap_min: tMin, gap_max: tMax, window_from: hhmm(WINDOW[0]), window_to: hhmm(WINDOW[1]), route_names: routeNames, trips },
    races,
    sources: { y1938: SOURCES_1938, today: SOURCES_TODAY, races: SOURCES_RACES, radius_m: ['method'] },
  };
}

const entry = (label, what, year, url) => ({ label, what, year, where: 'Made-up page', url });
const index = {
  schema: 'ghostline.index.v1',
  fixture_tag: TAG,
  line: 'fake',
  mode: 'trackless_trolley',
  effective: '1900-01-01',
  corners,
  pairs: PAIRS.map(({ origin, dest }) => ({ origin, dest })),
  service_date: '2000-01-05',
  feed_version: 'fake-feed-1',
  feed_sha256: '0'.repeat(64),
  street_order_checked: true,
  photo_finish_min: BAND,
  sources: {
    guide1938_diagram: entry('Fake 1938 diagram', 'Made-up route diagram', 1900, 'https://example.org/fake/diagram'),
    guide1938_timetable: entry('Fake 1938 timetable', 'Made-up timetable', 1900, 'https://example.org/fake/timetable'),
    guide1938_route: entry('Fake 1938 route description', 'Made-up route description', 1900, 'https://example.org/fake/route'),
    mta_gtfs: entry('Fake bus schedule feed', 'Made-up bus schedule feed', 2000, 'https://example.org/fake/feed'),
    osm: entry('Fake street data', 'Made-up street data', 2000, 'https://example.org/fake/streets'),
    method: { label: 'Fake method', what: 'Made-up method: walk minutes = metres x 1.3 / 1.2 / 60', year: null, where: 'Made-up page', url: null },
  },
};

const races = PAIRS.map(buildRace);

function verdict(delta) {
  if (delta === null) return null;
  if (delta < -1.5) return 'faster today';
  if (delta > 1.5) return 'slower today';
  return 'same';
}

const pairs = races.map((race) => {
  const counted = race.races.filter((r) => !r.before_table);
  const rides = counted.filter((r) => r.today).map((r) => race.today.trips[r.today.trip].ride_min).sort((a, b) => a - b);
  const median = rides.length ? rides[Math.floor(rides.length / 2)] : null;
  const delta = median === null ? null : R3(median - race.y1938.ride_min);
  return {
    origin: race.origin,
    dest: race.dest,
    races: counted.length,
    wins_1938: counted.filter((r) => r.result === '1938').length,
    wins_today: counted.filter((r) => r.result === 'today').length,
    photo_finishes: counted.filter((r) => r.result === 'photo_finish').length,
    ride_1938: race.y1938.ride_min,
    ride_today_median: median,
    delta,
    ride_verdict: verdict(delta),
  };
});

const sum = (key) => pairs.reduce((s, p) => s + p[key], 0);
const countVerdict = (v) => pairs.filter((p) => p.ride_verdict === v).length;
const summaryKeys = ['races', 'wins_1938', 'wins_today', 'photo_finishes', 'ride_same', 'ride_faster_today', 'ride_slower_today', 'pairs_without_one_seat_ride', 'today_wins', 'pairs'];
const summary = {
  schema: 'ghostline.summary.v1',
  definition: 'Made-up fixture: race at each whole minute 09:00-13:52',
  races: sum('races'),
  wins_1938: sum('wins_1938'),
  wins_today: sum('wins_today'),
  photo_finishes: sum('photo_finishes'),
  ride_same: countVerdict('same'),
  ride_faster_today: countVerdict('faster today'),
  ride_slower_today: countVerdict('slower today'),
  pairs_without_one_seat_ride: pairs.filter((p) => p.ride_verdict === null).length,
  today_wins: races.flatMap((race) =>
    race.races.filter((r) => !r.before_table && r.result === 'today').map((r) => ({ origin: race.origin, dest: race.dest, t: r.t, margin: r.margin })),
  ),
  pairs,
  sources: Object.fromEntries(summaryKeys.map((k) => [k, SOURCES_RACES])),
};

const leg = (a, b, direction, street, method, note) => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [a.lonlat, b.lonlat] },
  properties: { direction, street, method, note, length_m: 1000 },
});
const streets = ['Fake Street', 'Made-up Avenue', 'Pretend Road', 'Example Lane'];
const eastbound = corners.slice(1).map((c, k) => {
  const inferred = c.inferred || corners[k].inferred;
  return leg(corners[k], c, 'eastbound', streets[k], inferred ? 'inferred' : 'osm', inferred ? 'Made-up note: inferred stretch.' : null);
});
const westbound = eastbound.map((f) => ({
  ...f,
  geometry: { ...f.geometry, coordinates: [...f.geometry.coordinates].reverse() },
  properties: { ...f.properties, direction: 'westbound' },
}));
const route = {
  type: 'FeatureCollection',
  features: [...eastbound, ...westbound],
  sources: { features: ['guide1938_route', 'osm', 'method'] },
};

mkdirSync(join(OUT, 'race'), { recursive: true });
const write = (name, data) => writeFileSync(join(OUT, name), `${JSON.stringify(data)}\n`);
write('index.json', index);
write('summary.json', summary);
write('route.geojson', route);
for (const race of races) write(`race/${race.origin}__${race.dest}.json`, race);
console.log(`wrote ${3 + races.length} files to ${OUT}`);
