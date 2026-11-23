// Timing checks from the brief, run against the same pure functions the page uses.
// Writes qa/timing.json (the "timing" block; render checks are merged in by qa-render.mjs).
// Run: node scripts/check-timing.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'page/film-data.js'), 'utf8'), ctx);
const FILM = ctx.window.FILM;
const TL = require(path.join(ROOT, 'page/timeline.js')).make(FILM);
const G = FILM.geo, Y = FILM.y1938, T = FILM.today;
const hms = (s) => { const [h, m, x = '0'] = s.split(':'); return +h * 3600 + +m * 60 + +x; };

const checks = [];
const add = (name, pass, detail) => { checks.push({ name, pass: !!pass, ...detail }); };
const near = (name, ll, src, extra = {}) => {
  const d = TL.distM(ll, src);
  add(name, d <= 2, { distance_m: +d.toFixed(3), source: src, ...extra });
};

const moments = [
  ['10:06:00', hms('10:06:00')], ['10:13', hms('10:13')], ['10:15:00', hms('10:15:00')], ['10:21', hms('10:21')],
  ['10:28', hms('10:28')], ['10:32:43', hms('10:32:43')], ['10:41:00', hms('10:41:00')], ['finish', T.finish],
];
const ghostIdx = (t) => FILM.ghosts.indexOf(t);
for (const [label, t] of moments) {
  const p = TL.positionAt(t), w = TL.watches(t);
  const fr = TL.filmAt(t) * TL.FPS;
  const base = { at: label, film_s: +TL.filmAt(t).toFixed(4), frame: +fr.toFixed(2) };
  add(`${label}: master clock`, TL.clockText(t).startsWith(label === 'finish' ? '10:45:09' : label.length === 5 ? label + ':00' : label), { ...base, clock: TL.clockText(t) + ' · scheduled' });
  add(`${label}: stopwatches`, true, { ...base, y1938: w.y1938.text + (w.y1938.frozen ? ' (frozen)' : ''), today: w.today.text + (w.today.frozen ? ' (frozen)' : '') });
  add(`${label}: tally`, p && TL.tally(t) === FILM.ghosts.filter((g) => g <= t).length, { ...base, tally: TL.tally(t) });
  const gi = ghostIdx(t);
  if (gi >= 0) near(`${label}: trolley car ${gi + 1} of 4 at ${FILM.names.origin}`, p.ghosts[gi].lonlat, G.historical[0], base);
  if (t === Y.dep) { near(`${label}: rider's trolley leaves ${FILM.names.origin}`, p.trolley.lonlat, G.historical[0], base); add(`${label}: trolley visible`, p.trolley.visible, base); }
  if (t === Y.arr) { near(`${label}: trolley at ${FILM.names.dest}`, p.trolley.lonlat, G.historical.at(-1), base); add(`${label}: 1938 stopwatch frozen at 15:00`, w.y1938.frozen && w.y1938.text === '15:00', { ...base, text: w.y1938.text }); }
  if (t === T.dep) {
    { const door = TL.toLL(TL.doors.DOOR2), d = TL.distM(door, G.board); add(`${label}: bus front door at stop ${T.board.stop_id}'s pole (within 6 m; the shape passes 5.2 m from it)`, d <= 6, { ...base, distance_m: +d.toFixed(2) }); }
    near(`${label}: today's rider at stop ${T.board.stop_id}`, p.riderToday.lonlat, G.board, base);
    add(`${label}: bus visible`, p.bus.visible, base);
    add(`${label}: tally is 4 when the bus leaves`, TL.tally(t) === 4, { ...base, tally: TL.tally(t) });
  }
  if (t === T.arr) {
    near(`${label}: bus at stop ${T.alight.stop_id} (the trip's shape end, where it lays over)`, p.bus.lonlat, G.bus.at(-1), base);
    const dd = TL.distM(p.riderToday.lonlat, TL.toLL(TL.doors.DOOR4)); add(`${label}: today's rider steps off beside the bus's front door (within 4 m)`, dd <= 4, { ...base, distance_m: +dd.toFixed(2) });
    let minD = 1e9; for (let s = 0; s <= TL.paths.WALK2.L; s += 0.5) minD = Math.min(minD, TL.distM(TL.toLL(TL.paths.WALK2.at(s)), G.alight));
    add(`the final walk passes stop ${T.alight.stop_id}'s own coordinates (within 2 m)`, minD <= 2, { distance_m: +minD.toFixed(2), note: 'the feed shape ends 39 m north of the stop pole' });
  }
  if (t === T.finish) { near(`finish: rider at ${FILM.names.dest}`, p.riderToday.lonlat, G.dest, base); add('finish: today stopwatch frozen at 45:00', w.today.frozen && w.today.text === '45:00', { ...base, text: w.today.text, source_total_min: T.total_min }); }
}
// at the walk-to-stop end
near(`${TL.clockText(T.at_stop)}: rider reaches stop ${T.board.stop_id}`, TL.positionAt(T.at_stop).riderToday.lonlat, G.board, { film_s: +TL.filmAt(T.at_stop).toFixed(3) });
near(`10:00: rider starts at ${FILM.names.origin}`, TL.positionAt(TL.START).riderToday.lonlat, G.origin, {});

// sweep: every frame and a fine scheduled-time sweep
let busEarly = 0, tallyBad = 0, watchBack = 0, lastY = -1, lastT = -1, maxTally = 0;
const tallySteps = [];
let prevTally = 0;
for (let n = 0; n < TL.TILE_FRAMES; n++) {
  const s = TL.frameState(n);
  if (s.pos.bus.visible && (s.sched < TL.FILM.busSched.knots[0][0] || TL.distM(s.pos.bus.lonlat, TL.toLL(TL.busPointAtDist(TL.busDistAt(s.sched)))) > 0.01)) busEarly++;
  if (s.tally > 4) tallyBad++;
  if (s.tally !== prevTally) { tallySteps.push({ frame: n, film_s: +s.f.toFixed(3), clock: s.clock, tally: s.tally }); prevTally = s.tally; }
  maxTally = Math.max(maxTally, s.tally);
  if (s.watches.y1938.sec < lastY || s.watches.today.sec < lastT) watchBack++;
  lastY = s.watches.y1938.sec; lastT = s.watches.today.sec;
}
for (let t = TL.START; t < TL.FILM.busSched.knots[0][0]; t += 0.25) if (TL.positionAt(t).bus.visible) busEarly++;
const knotErr = TL.FILM.busSched.knots.map(([kt, kd, id]) => ({ stop: id, clock: TL.clockText(kt), m: +TL.distM(TL.positionAt(kt).bus.lonlat, TL.toLL(TL.busPointAtDist(kd))).toFixed(3) }));
const layoverOK = [T.arr + 1, T.arr + 120, T.finish + 60].every((tt) => TL.distM(TL.positionAt(tt).bus.lonlat, G.bus.at(-1)) < 0.5);
add('the bus is shown only where its scheduled times put it: not before stop 4021 at 10:30:00, at each stop at its stop time, linear between stops along the GTFS shape, laid over at 9486 after 10:41:00 (its next trip leaves 11:04)', busEarly === 0 && knotErr.every((k) => k.m < 0.5) && layoverOK && !TL.positionAt(TL.FILM.busSched.knots[0][0] - 0.01).bus.visible, { violations: busEarly, stops: knotErr, layover: TL.FILM.busSched.layover });
add('tally counts exactly 4, at the right times', tallyBad === 0 && maxTally === 4 && tallySteps.length === 4 &&
  tallySteps.every((st, i) => Math.abs(TL.schedAt(st.film_s) - FILM.ghosts[i]) < 4.01), { steps: tallySteps, passes: FILM.ghosts.map((g) => TL.clockText(g)) });

// v3 holds: the clock pauses for boarding and getting off; pausing adds no scheduled time
{
  const rows = []; let bad = 0, labelBad = 0;
  for (let n = 0; n < TL.TILE_FRAMES; n++) {
    const s = TL.frameState(n), pz = s.pause;
    if (pz) {
      if (s.sched !== pz.t || s.clock !== TL.clockText(pz.t)) labelBad++;
      const w = TL.watches(pz.t); if (s.watches.y1938.text !== w.y1938.text || s.watches.today.text !== w.today.text) labelBad++;
      rows.push(pz.k);
    } else {
      const acc = TL.PAUSES.filter((p) => TL.filmAt(p.t) + p.d <= s.f + 1e-9).reduce((a, p) => a + p.d, 0);
      const expect = Math.max(TL.START, TL.START + (s.f - TL.EST - acc) * TL.SPEED);
      if (Math.abs(s.sched - expect) > 1e-6) bad++;
    }
  }
  const per = TL.PAUSES.map((p, k) => rows.filter((r) => r === k).length);
  add('pauses: 1938 holds 0.6 s (18 frames) at 10:06:00 and 10:15:00; bus holds 0.9 s (27 frames) at 10:32:43 and 10:41:00', per.join(',') === '18,18,27,27' && TL.PAUSES.map((p) => TL.clockText(p.t)).join(',') === '10:06:00 AM,10:15:00 AM,10:32:43 AM,10:41:00 AM', { frames_per_hold: per, holds: TL.PAUSES.map((p) => ({ at: TL.clockText(p.t), who: p.who, kind: p.kind, from_frame: +(TL.filmAt(p.t) * TL.FPS).toFixed(1), to_frame: +((TL.filmAt(p.t) + p.d) * TL.FPS).toFixed(1), seconds: p.d })) });
  add('pauses change no scheduled time label: during a hold the clock and both stopwatches show the event time; outside the holds every frame is exactly START + (film - holds so far) x 120', labelBad === 0 && bad === 0, { label_violations: labelBad, mapping_violations: bad });
}
add('stopwatches never run backwards', watchBack === 0, { violations: watchBack });
add('film race length', Math.abs(TL.RACE_FILM - 22.578) < 0.01, { race_s: +TL.RACE_FILM.toFixed(3), trolley_leaves_s: +(TL.filmAt(Y.dep) - TL.EST).toFixed(3), trolley_arrives_s: +(TL.filmAt(Y.arr) - TL.EST).toFixed(3), rider_at_stop_s: +(TL.filmAt(T.at_stop) - TL.EST).toFixed(3), bus_leaves_s: +(TL.filmAt(T.dep) - TL.EST).toFixed(3), bus_arrives_s: +(TL.filmAt(T.arr) - TL.EST).toFixed(3), finish_s: +(TL.filmAt(T.finish) - TL.EST).toFixed(3) });
add('Google-tile footage <= 29 s (margin under the 30 s cap)', TL.TILE_FRAMES / TL.FPS <= 29, { tile_seconds: +(TL.TILE_FRAMES / TL.FPS).toFixed(3), card_seconds: TL.CARD, total_frames: TL.TOTAL_FRAMES });

// headings: every vehicle faces its direction of travel, no flips (sweep every 1 s scheduled)
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const headingBad = [];
let maxTurn = 0;
const vehicles = [['trolley', (p) => p.trolley], ['bus', (p) => p.bus], ...FILM.ghosts.map((_, i) => [`ghost${i + 1}`, (p) => p.ghosts[i]])];
for (const [name, get] of vehicles) {
  let prevH = null;
  for (let t = TL.START; t <= T.finish; t += 0.25) {
    const a = get(TL.positionAt(t)), a0 = get(TL.positionAt(t - 1.5)), b = get(TL.positionAt(t + 1.5));   // travel over about one vehicle length
    if (!a.visible || !a.moving && a.moving !== undefined) { prevH = null; continue; }
    const q = TL.toXY(a0.lonlat), r = TL.toXY(b.lonlat), d = Math.hypot(r[0] - q[0], r[1] - q[1]);
    if (d > 0.3) { const travel = TL.bearing([r[0] - q[0], r[1] - q[1]]); if (angDiff(travel, a.heading) > 45) headingBad.push({ name, clock: TL.clockText(t), heading: +a.heading.toFixed(1), travel: +travel.toFixed(1) }); }
    if (prevH !== null) maxTurn = Math.max(maxTurn, angDiff(prevH, a.heading));
    prevH = a.heading;
  }
}
add('vehicles face their direction of travel (within 45° of the travel over one vehicle length, checked every 0.25 s), ghosts included', headingBad.length === 0, { violations: headingBad.slice(0, 20) });
add('no heading flips (no jump over 90° per 0.25 s scheduled; the 90° Caroline-to-Aliceanna corner is a turn)', maxTurn < 90, { max_deg_per_quarter_s: +maxTurn.toFixed(1) });

// walks: on the street, never inside a building (OSM snapshot, ODbL), timing unchanged
{
  const osm = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/osm.json'), 'utf8'));
  const geomXY = (g) => g.map((p) => TL.toXY([p.lon, p.lat]));
  const near = (pts) => pts.some((p) => Math.abs(p[0]) < 1500 && Math.abs(p[1]) < 1800);
  const streets = [], buildings = [];
  for (const e of osm.elements) {
    if (e.type === 'way' && e.geometry && e.tags) {
      const g = geomXY(e.geometry); if (!near(g)) continue;
      if (e.tags.highway && !/^(footway|path|steps|cycleway|service|corridor)$/.test(e.tags.highway)) streets.push(g);
      if (e.tags.building) buildings.push(g);
    }
    if (e.type === 'relation' && e.tags && e.tags.building && e.members) for (const m of e.members) if (m.role === 'outer' && m.geometry) { const g = geomXY(m.geometry); if (g.length > 3 && Math.hypot(g[0][0] - g.at(-1)[0], g[0][1] - g.at(-1)[1]) < 0.5) buildings.push(g); }
  }
  const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1; const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy); };
  const streetDist = (p) => { let d = Infinity; for (const g of streets) for (let i = 1; i < g.length; i++) d = Math.min(d, segDist(p, g[i - 1], g[i])); return d; };
  const inside = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  let maxD = 0, inB = [], far = [], n = 0;
  for (let t = TL.START; t <= T.finish + 30; t += 0.25) {
    const r = TL.positionAt(t).riderToday; if (!r.visible) continue;
    const p = TL.toXY(r.lonlat); n++;
    const d = streetDist(p); maxD = Math.max(maxD, d); if (d > 9) far.push({ clock: TL.clockText(t), m: +d.toFixed(1) });
    if (buildings.some((b) => inside(p, b))) inB.push(TL.clockText(t));
  }
  // the 1938 rider stands at Preston & Caroline (a street corner)
  const r1 = TL.doors.CURB1, r3 = TL.doors.CURB3;
  add("today's rider stays within about 8 m (limit 9 m) of a street centreline, every 0.25 s scheduled, walks and waits", far.length === 0 && n > 0, { note: 'the MTA stop 9486 coordinate itself is 8.5 m from the centreline (on the sidewalk); sidewalk path offset 7 m', samples: n, max_m: +maxD.toFixed(1), violations: far.slice(0, 10), streets: streets.length, osm: 'data/osm.json (OpenStreetMap contributors, ODbL; snapshot 2026-11-23)' });
  add("today's rider is never inside an OSM building footprint", inB.length === 0, { samples: n, buildings: buildings.length, violations: inB.slice(0, 10) });
  add('1938 rider (waiting at Preston & Caroline, then at Aliceanna & Bond) is on the street, not in a building', [r1, r3].every((q) => streetDist(q) <= 9 && !buildings.some((b) => inside(q, b))), { m: [r1, r3].map((q) => +streetDist(q).toFixed(1)) });
  add('walk timing unchanged: walk 1 10:00:00-10:02:15.48 (2.258 min), walk 2 10:41:00-10:45:09.36 (4.156 min)',
    Math.abs(T.at_stop - TL.START - T.walk1_min * 60) < 1e-6 && Math.abs(T.finish - T.arr - T.walk2_min * 60) < 1e-6 && T.walk1_min === 2.258 && T.walk2_min === 4.156 && T.dep === hms('10:32:43') && T.arr === hms('10:41:00'),
    { walk1: `${TL.clockText(TL.START)} to ${TL.clockText(T.at_stop)}`, walk2: `${TL.clockText(T.arr)} to ${TL.clockText(T.finish)}`, drawn_path_m: { walk1: T.walk1_path_m, walk2: T.walk2_path_m }, source_straight_m: { walk1: T.walk1_m, walk2: T.walk2_m } });
}

// end card: shown parts add up to the shown total in both rows (app's largest-remainder rounding)
for (const [row, parts, labels] of [['1938', TL.cardRows.y1938, ['wait', 'ride']], ['today', TL.cardRows.today, ['walk', 'wait', 'ride', 'walk']]]) {
  const sum = parts.shown.reduce((a, b) => a + b, 0);
  add(`end card ${row}: shown parts add up to the shown total`, sum === parts.shownTotal, { shown: parts.shown.map((v, i) => `${labels[i]} ${v}`).join(' · '), sum, shown_total: parts.shownTotal });
}
add('end card values match the app: today walk 2 · wait 31 · ride 8 · walk 4 = 45; 1938 wait 6 · ride 9 = 15',
  TL.cardRows.today.shown.join(',') === '2,31,8,4' && TL.cardRows.today.shownTotal === 45 && TL.cardRows.y1938.shown.join(',') === '6,9' && TL.cardRows.y1938.shownTotal === 15, { today: TL.cardRows.today, y1938: TL.cardRows.y1938 });

// edit hand-off: exact cue times (film seconds and frames, 30 fps)
const cue = (label, sched, extra = {}) => ({ label, scheduled: TL.clockText(sched), film_s: +TL.filmAt(sched).toFixed(3), frame: +(TL.filmAt(sched) * TL.FPS).toFixed(2), ...extra });
const cues = {
  fps: TL.FPS, speed: '×120 (1 s = 2 scheduled min)', tile_footage_s: +(TL.TILE_FRAMES / TL.FPS).toFixed(3),
  cues: [
    { label: 'film start (establishing shot)', film_s: 0, frame: 0 },
    cue('race start: both riders leave Preston & Caroline', TL.START),
    cue("today's rider reaches stop " + T.board.stop_id, T.at_stop),
    ...TL.PASSES.map((p, i) => cue(`1938 trolley ${i + 1} of 4 passes today's rider at stop ${T.board.stop_id} (bell ${i + 1}, alternative to the corner departure)`, p, { sound: 'bell (pass)' })),
    ...FILM.ghosts.map((g, i) => cue(i === 0 ? "1938 trolley leaves Preston & Caroline (the 1938 rider's car; bell 1)" : `1938 trolley ${i + 1} of 4 leaves Preston & Caroline (bell ${i + 1})`, g, { sound: 'bell' })),
    cue('1938 trolley arrives at Aliceanna & Bond (stopwatch freezes 15:00)', Y.arr),
    ...TL.PAUSES.map((p) => ({ label: `hold: clock paused, ${p.who === '1938' ? '1938 rider' : "today's rider"} ${p.kind === 'board' ? 'boards' : 'gets off'} (door chime / bell)`, scheduled: TL.clockText(p.t), film_s: +TL.filmAt(p.t).toFixed(3), frame: +(TL.filmAt(p.t) * TL.FPS).toFixed(2), end_frame: +((TL.filmAt(p.t) + p.d) * TL.FPS).toFixed(2), hold_s: p.d, sound: 'door chime' })),
    cue('bus leaves stop ' + T.board.stop_id, T.dep),
    cue('bus arrives at stop ' + T.alight.stop_id, T.arr),
    cue("today's rider finishes at Aliceanna & Bond (stopwatch 45:00, rounded)", T.finish),
    { label: 'end card (no map imagery)', film_s: +(TL.TILE_FRAMES / TL.FPS).toFixed(3), frame: TL.TILE_FRAMES },
    { label: 'film end', film_s: +(TL.TOTAL_FRAMES / TL.FPS).toFixed(3), frame: TL.TOTAL_FRAMES },
  ],
};
fs.writeFileSync(path.join(ROOT, 'qa/cues.json'), JSON.stringify(cues, null, 2));

const out = path.join(ROOT, 'qa/timing.json');
const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
const timing = { generated: new Date().toISOString(), all_pass: checks.every((c) => c.pass), checks };
fs.writeFileSync(out, JSON.stringify({ ...prev, timing }, null, 2));
for (const c of checks) console.log(c.pass ? 'PASS' : 'FAIL', c.name, c.distance_m !== undefined ? `(${c.distance_m} m)` : '');
console.log(timing.all_pass ? 'ALL TIMING CHECKS PASS' : 'SOME TIMING CHECKS FAIL');
process.exit(timing.all_pass ? 0 : 1);
