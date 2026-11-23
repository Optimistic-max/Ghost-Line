// Builds page/film-data.js from the race file and the design-v3 geometry.
// Every number in the film comes from here; nothing is typed by hand.
// Run: node scripts/build-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const race = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/race.json'), 'utf8'));
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data/design-data.js'), 'utf8'), ctx);
const D = ctx.window.DATA;

const hms = (s) => { const [h, m, x = '0'] = s.split(':'); return +h * 3600 + +m * 60 + +x; };

// --- the 10:00 row -------------------------------------------------------
const row = race.races.find((r) => r.t === '10:00');
assert.ok(row, 'race row t=10:00 missing');
assert.deepEqual(JSON.parse(JSON.stringify(D.row)), JSON.parse(JSON.stringify(row)), 'design-v3 row differs from race file');
const trip = race.today.trips[row.today.trip];
assert.equal(trip.i, row.today.trip);
assert.deepEqual(JSON.parse(JSON.stringify(D.trip)), JSON.parse(JSON.stringify(trip)), 'design-v3 trip differs from race file');

const start = hms(row.start);
const y = { dep: hms(row.y1938.dep), ride_min: race.y1938.ride_min, wait_min: row.y1938.wait, total_min: row.y1938.total };
y.arr = y.dep + y.ride_min * 60;
assert.equal((y.dep - start) / 60, y.wait_min, '1938 wait');
assert.equal((y.arr - start) / 60, y.total_min, '1938 total');

const t = {
  walk1_min: trip.board.walk_min, walk1_m: trip.board.walk_m,
  dep: hms(trip.dep), arr: hms(trip.arr), ride_min: trip.ride_min,
  walk2_min: trip.alight.walk_min, walk2_m: trip.alight.walk_m,
  wait_min: row.today.wait, total_min: row.today.total,
  board: { stop_id: trip.board.stop_id, name: trip.board.name },
  alight: { stop_id: trip.alight.stop_id, name: trip.alight.name },
  route: trip.route_display, headsign: trip.headsign_display, trip_id: trip.trip_id,
};
t.at_stop = start + t.walk1_min * 60;
t.finish = t.arr + t.walk2_min * 60;
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
close(t.walk1_min + t.wait_min, (t.dep - start) / 60, 0.001, 'walk1 + wait = bus dep');
close((t.arr - t.dep) / 60, t.ride_min, 0.001, 'bus ride');
close((t.finish - start) / 60, t.total_min, 0.001, 'today total');
close(row.today.total - row.y1938.total, row.margin, 1e-9, 'margin');

// --- the ghosts: recount from y1938.passes ------------------------------
const ghosts = race.y1938.passes.map(hms).filter((p) => p >= start && p < t.dep);
assert.equal(ghosts.length, 4, 'expected 4 trolleys before the bus leaves');
assert.ok(ghosts.includes(y.dep), "rider's own trolley must be one of the four");
assert.equal(ghosts[0], y.dep, "rider's trolley is the first");

// --- geometry ------------------------------------------------------------
const corner = (slug) => D.index.corners.find((c) => c.slug === slug).lonlat;
const origin = corner(race.origin), dest = corner(race.dest);
const R = 6371008.8, rad = Math.PI / 180;
const dist = (a, b) => { const x = (b[0] - a[0]) * rad * Math.cos(((a[1] + b[1]) / 2) * rad), yy = (b[1] - a[1]) * rad; return R * Math.hypot(x, yy); };
const hist = D.historical, bus = D.bus;
close(dist(origin, hist[0]), 0, 2, 'historical starts at origin corner');
close(dist(dest, hist.at(-1)), 0, 2, 'historical ends at dest corner');
close(dist(origin, D.board), t.walk1_m, 1, 'walk1 straight-line distance');
close(dist(D.alight, dest), t.walk2_m, 1, 'walk2 straight-line distance');

// --- walks along real streets (OSM centrelines, offset to the sidewalk) --
// Emmanuel (Nov 23): the straight walk lines cut through buildings. The drawn walk now follows the
// named streets; its duration is still the scheduled estimate (walk_min), so only the drawn path changes.
const osm = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/osm.json'), 'utf8'));
const LAT0 = (origin[1] + dest[1]) / 2, LON0 = (origin[0] + dest[0]) / 2;
const KX = R * rad * Math.cos(LAT0 * rad), KY = R * rad;
const toXY = (ll) => [(ll[0] - LON0) * KX, (ll[1] - LAT0) * KY];
const toLL = (p) => [+(p[0] / KX + LON0).toFixed(7), +(p[1] / KY + LAT0).toFixed(7)];
function streetRoute(nameRe, fromLL, toLLp) {
  // graph of the named ways' vertices
  const key = (p) => p.map((v) => v.toFixed(7)).join(',');
  const pos = new Map(), adj = new Map();
  for (const w of osm.elements) {
    if (w.type !== 'way' || !w.tags || !w.tags.highway || !nameRe.test(w.tags.name || '') || !w.geometry) continue;
    const pts = w.geometry.map((g) => [g.lon, g.lat]);
    for (let i = 0; i < pts.length; i++) {
      const k = key(pts[i]); pos.set(k, toXY(pts[i])); if (!adj.has(k)) adj.set(k, []);
      if (i) { const a = key(pts[i - 1]), d = Math.hypot(pos.get(k)[0] - pos.get(a)[0], pos.get(k)[1] - pos.get(a)[1]); adj.get(k).push([a, d]); adj.get(a).push([k, d]); }
    }
  }
  const nearestNode = (ll) => { const p = toXY(ll); let best = null, bd = 1e9; for (const [k, q] of pos) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = k; } } return best; };
  const s = nearestNode(fromLL), t = nearestNode(toLLp);
  const dist = new Map([[s, 0]]), prev = new Map(), done = new Set();
  while (true) {
    let u = null, ud = Infinity; for (const [k, d] of dist) if (!done.has(k) && d < ud) { u = k; ud = d; }
    if (u === null || u === t) break; done.add(u);
    for (const [v, w] of adj.get(u)) if (ud + w < (dist.get(v) ?? Infinity)) { dist.set(v, ud + w); prev.set(v, u); }
  }
  assert.ok(dist.has(t), `no street route for ${nameRe}`);
  const nodes = []; for (let k = t; k; k = prev.get(k)) nodes.unshift(pos.get(k));
  return nodes;
}
function offsetRight(pts, d) {   // offset a centreline to the right of the walking direction (miter joins)
  const n = (a, b) => { const x = b[0] - a[0], y = b[1] - a[1], L = Math.hypot(x, y) || 1; return [y / L, -x / L]; };
  return pts.map((p, i) => {
    const n1 = i > 0 ? n(pts[i - 1], p) : n(p, pts[i + 1]), n2 = i < pts.length - 1 ? n(p, pts[i + 1]) : n1;
    let m = [n1[0] + n2[0], n1[1] + n2[1]]; const ml = Math.hypot(m[0], m[1]) || 1; m = [m[0] / ml, m[1] / ml];
    const k = d / Math.max(0.5, m[0] * n1[0] + m[1] * n1[1]);
    return [p[0] + m[0] * k, p[1] + m[1] * k];
  });
}
function simplify(pts, minGap = 1.5) { const out = [pts[0]]; for (const p of pts.slice(1)) if (Math.hypot(p[0] - out.at(-1)[0], p[1] - out.at(-1)[1]) >= minGap) out.push(p); return out; }
function walkPath(nameRe, a, b, sidewalk) {
  const centre = streetRoute(nameRe, a, b);
  const side = offsetRight(simplify(centre), sidewalk);
  // snap: start exactly at a, end exactly at b (the source coordinates); drop offset points that double back
  const A = toXY(a), B = toXY(b);
  return [a, ...side.map(toLL), b];
}
const SIDEWALK = 7; // m from the street centreline
const walk1Path = walkPath(/Caroline Street/i, origin, D.board, SIDEWALK);
const walk2Path = walkPath(/Caroline Street|Aliceanna Street/i, D.alight, dest, SIDEWALK);
const plen = (l) => l.reduce((s, p, i) => (i ? s + dist(l[i - 1], p) : 0), 0);
console.log('walk1 path', walk1Path.length, 'pts', plen(walk1Path).toFixed(1), 'm (straight', t.walk1_m, ') | walk2 path', walk2Path.length, 'pts', plen(walk2Path).toFixed(1), 'm (straight', t.walk2_m, ')');
t.walk1_path_m = +plen(walk1Path).toFixed(1); t.walk2_path_m = +plen(walk2Path).toFixed(1);

// --- v3: vehicles arrive along their real paths, at scheduled times -----
// Bus: trip 4110804's own stop_times and shape (pinned feed, extracted to data/gtfs).
const csv = (f) => { const [h, ...rows] = fs.readFileSync(path.join(ROOT, 'data/gtfs', f), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/); const k = h.split(','); return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [k[i], v]))); };
const stopTimes = csv('stop_times-4110804.txt').sort((a, b) => +a.stop_sequence - +b.stop_sequence);
const shapePts = csv('shape-172100.txt').sort((a, b) => +a.shape_pt_sequence - +b.shape_pt_sequence).map((p) => [+p.shape_pt_lon, +p.shape_pt_lat, +p.shape_dist_traveled]);
const sIdx = stopTimes.findIndex((s) => s.stop_id === trip.board.stop_id), aIdx = stopTimes.findIndex((s) => s.stop_id === trip.alight.stop_id);
assert.equal(stopTimes[sIdx].departure_time, trip.dep, 'stop_times dep matches race file');
assert.equal(stopTimes[aIdx].arrival_time, trip.arr, 'stop_times arr matches race file');
assert.equal(aIdx, stopTimes.length - 1, '9486 is the last stop of this trip');
const from = stopTimes[sIdx - 2];                          // two stops upstream: the bus enters from well outside the frame
const pointAtDist = (d) => { let i = 1; while (i < shapePts.length - 1 && shapePts[i][2] < d) i++; const a = shapePts[i - 1], b = shapePts[i]; const u = (d - a[2]) / ((b[2] - a[2]) || 1); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
// where the shape passes closest to stop 8564's own coordinates (the feed's shape_dist for 8564 lies 16 m away, in the intersection)
let dP = null, best = 1e9;
for (let d = +stopTimes[sIdx - 1].shape_dist_traveled; d <= +stopTimes[sIdx + 1].shape_dist_traveled; d += 0.0005) { const q = dist(pointAtDist(d), D.board); if (q < best) { best = q; dP = d; } }
const busShape = shapePts.filter((p) => p[2] >= +from.shape_dist_traveled - 1e-9);
const knots = stopTimes.slice(sIdx - 2).map((s) => [hms(s.arrival_time), +s.shape_dist_traveled, s.stop_id]);
const k8564 = knots.find((k) => k[2] === trip.board.stop_id);
const DOOR_KM = 4.7 / 1000;                                // the bus's front door is 4.7 m ahead of its centre
k8564[1] = dP - DOOR_KM;                                   // the bus stops with its front door at the stop pole
// the same bus (block 4805) next leaves stop 9486 at 11:04 (trip 4110916): it lays over at the stop after 10:41
const layover = { until: '11:04:00', next_trip: '4110916', note: 'trips.txt block 4805, service 2251' };
console.log('bus: enters at', from.stop_id, from.arrival_time, '| 8564 at shape', +stopTimes[sIdx].shape_dist_traveled, '-> nearest to the pole', dP.toFixed(4), `(${best.toFixed(1)} m from the pole)`, '| knots', knots.length);
// 1938 cars: the timetable's 8 minutes from Brevard & Preston to Preston & Caroline (route diagram id/201)
const route = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/route.geojson'), 'utf8'));
const prestonEb = route.features.find((f) => f.properties.direction === 'eastbound' && f.properties.street === 'Preston Street').geometry.coordinates;
const brevardPreston = [-76.620068, 39.304363];             // timing point (no21-1938.yaml), 9 m west of the Preston St line's start
const approach = [brevardPreston, ...prestonEb];
close(dist(approach.at(-1), origin), 0, 2, 'approach ends at Preston & Caroline');
const APPROACH_MIN = 8;                                    // no21-1938.yaml: Preston & Caroline is 8 minutes after Brevard & Preston

const out = {
  generated: new Date().toISOString(),
  sources: {
    race_file: 'Ghost line/web/public/data/race/preston-caroline__aliceanna-bond.json',
    geometry: 'design-v3/assets/data.js (DATA.historical, DATA.bus, DATA.board, DATA.alight, DATA.index.corners)',
    feed_version: race.feed_version, service_date: race.service_date, feed_sha256: race.feed_sha256,
    y1938: race.y1938.sources,
  },
  row, start, y1938: y, today: t, ghosts, margin_min: row.margin,
  geo: { origin, dest, board: D.board, alight: D.alight, historical: hist, bus, walk1: walk1Path, walk2: walk2Path, approach },
  busSched: { shape: busShape, knots, layover, enter_stop: from.stop_id, door_m: 4.7, pole_8564_dist: dP },
  approach_min: APPROACH_MIN,
  names: { origin: D.index.corners.find((c) => c.slug === race.origin).name, dest: D.index.corners.find((c) => c.slug === race.dest).name },
};
fs.writeFileSync(path.join(ROOT, 'page/film-data.js'), '// generated by scripts/build-data.mjs — do not edit\nwindow.FILM = ' + JSON.stringify(out) + ';\n');
console.log('ok: start', row.start, '1938', row.y1938.dep, '->', y.arr / 3600, 'ghosts', ghosts.map((g) => g / 60), 'bus', trip.dep, trip.arr, 'finish(s)', t.finish);
