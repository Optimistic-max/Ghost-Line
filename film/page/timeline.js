// Pure timing and placement for the race film. No Cesium, no DOM.
// Every input comes from window.FILM (built by scripts/build-data.mjs).
// Works in the browser (window.Timeline) and in Node (module.exports).
(function (root) {
  'use strict';

  const FPS = 30;
  const SPEED = 120;          // 1 film second = 120 scheduled seconds (2 min)
  const EST = 2.6;            // establishing shot before the race clock starts (film s; trimmed for the longer bus holds)
  const HOLD = 0.5;           // hold on the finish before the end card (film s)
  const CARD = 4.0;           // pure-graphic end card (film s, no tiles)

  function make(FILM) {
    const START = FILM.start;
    const Y = FILM.y1938, T = FILM.today, G = FILM.geo;
    const RACE_FILM = (T.finish - START) / SPEED;              // 22.578 s of scheduled time
    const HOLDS_S = 0.6 + 0.6 + 0.9 + 0.9;                     // boarding / getting-off holds (see PAUSES)
    const TILE_END = EST + RACE_FILM + HOLDS_S + HOLD;            // last tile second
    const TILE_FRAMES = Math.ceil(TILE_END * FPS);               // frames 0..TILE_FRAMES-1 show tiles
    const CARD_FRAMES = Math.round(CARD * FPS);
    const TOTAL_FRAMES = TILE_FRAMES + CARD_FRAMES;

    // ---- local metric frame (equirectangular about route centre; cm-accurate over 3 km)
    const R = 6371008.8, rad = Math.PI / 180;
    const LAT0 = (G.origin[1] + G.dest[1]) / 2, LON0 = (G.origin[0] + G.dest[0]) / 2;
    const KX = R * rad * Math.cos(LAT0 * rad), KY = R * rad;
    const toXY = (ll) => [(ll[0] - LON0) * KX, (ll[1] - LAT0) * KY];
    const toLL = (p) => [p[0] / KX + LON0, p[1] / KY + LAT0];
    const lerp = (a, b, u) => a + (b - a) * u;
    const lerp2 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
    const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
    const distM = (a, b) => { const p = toXY(a), q = toXY(b); return Math.hypot(p[0] - q[0], p[1] - q[1]); };
    // bearing in degrees clockwise from north, from metric vector
    const bearing = (v) => (Math.atan2(v[0], v[1]) / rad + 360) % 360;

    function Path(lls) {
      const pts = lls.map(toXY);
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const L = cum[cum.length - 1];
      function at(s) {
        s = clamp(s, 0, L);
        let i = 1;
        while (i < cum.length - 1 && cum[i] < s) i++;
        const seg = cum[i] - cum[i - 1] || 1;
        return lerp2(pts[i - 1], pts[i], (s - cum[i - 1]) / seg);
      }
      function tangent(s, w = 60) {
        const a = at(s - w), b = at(s + w);
        return [b[0] - a[0], b[1] - a[1]];
      }
      return { pts, cum, L, at, tangent, lls };
    }
    const HIST = Path(G.historical);
    // walks follow real streets (OSM centrelines offset to the sidewalk); timing is the scheduled estimate
    const WALK1 = Path(G.walk1 || [G.origin, G.board]);

    // ---- v3: 1938 cars drive in along Preston St (route.geojson), timed by the timetable's 8 minutes
    // from Brevard & Preston to Preston & Caroline, then follow the route as before.
    const APPROACH_S = (FILM.approach_min || 0) * 60;
    const CAR = Path([...(G.approach || [G.origin]).slice(0, -1), ...G.historical]);
    const S_CORNER = CAR.cum[(G.approach || [G.origin]).length - 1];
    function carS(dep, sched) {
      const arr = dep + Y.ride_min * 60;
      if (sched < dep - APPROACH_S) return null;                       // not yet on the stretch we model
      if (sched < dep) return S_CORNER * (sched - (dep - APPROACH_S)) / APPROACH_S;
      return S_CORNER + clamp((sched - dep) / (arr - dep), 0, 1) * (CAR.L - S_CORNER);
    }

    // ---- v3: the bus from trip 4110804's stop_times along its GTFS shape (two stops upstream of 8564 on)
    const BS = FILM.busSched;
    const BSH = BS ? BS.shape.map((p) => ({ xy: toXY([p[0], p[1]]), d: p[2] })) : null;
    const KN = BS ? BS.knots : null;
    function busPointAtDist(d) {
      let i = 1; while (i < BSH.length - 1 && BSH[i].d < d) i++;
      const a = BSH[i - 1], b = BSH[i], u = clamp((d - a.d) / ((b.d - a.d) || 1), 0, 1);
      return lerp2(a.xy, b.xy, u);
    }
    function busDistAt(sched) {                                          // null = before the modelled stretch
      if (sched < KN[0][0]) return null;
      if (sched >= KN.at(-1)[0]) return KN.at(-1)[1];                    // trip ends at 9486; the bus lays over there
      let i = 1; while (i < KN.length - 1 && KN[i][0] <= sched) i++;
      const a = KN[i - 1], b = KN[i]; return lerp(a[1], b[1], (sched - a[0]) / ((b[0] - a[0]) || 1));
    }
    function busAt(sched) {
      const d = busDistAt(sched);
      if (d === null) return { visible: false, moving: false, xy: BSH[0].xy, lonlat: toLL(BSH[0].xy), heading: 90, d: null };
      const p = busPointAtDist(d), a = busPointAtDist(d - 0.006), b = busPointAtDist(d + 0.006);
      return { visible: true, moving: sched < T.arr && !(sched === T.dep), xy: p, lonlat: toLL(p), heading: bearing([b[0] - a[0], b[1] - a[1]]), d };
    }
    const BUS = Path(BS ? BS.shape.map((p) => [p[0], p[1]]) : G.bus);   // the bus's drawn lane, approach included

    // doors: model +X forward; the trolley's door is 3.5 m ahead on the right, the bus's front door 4.7 m ahead on the right
    const fwdV = (hd) => [Math.sin(hd * rad), Math.cos(hd * rad)], rightV = (hd) => [Math.cos(hd * rad), -Math.sin(hd * rad)];
    const offset = (xy, hd, f, r) => { const a = fwdV(hd), b = rightV(hd); return [xy[0] + a[0] * f + b[0] * r, xy[1] + a[1] * f + b[1] * r]; };
    const carAtCorner = (() => { const a = CAR.at(S_CORNER - 2), b = CAR.at(S_CORNER + 9); return { xy: CAR.at(S_CORNER), heading: bearing([b[0] - a[0], b[1] - a[1]]) }; })();
    const carAtEnd = { xy: CAR.at(CAR.L), heading: bearing(CAR.tangent(CAR.L, 6)) };
    const DOOR1 = offset(carAtCorner.xy, carAtCorner.heading, 3.5, 1.3), CURB1 = offset(carAtCorner.xy, carAtCorner.heading, 3.5, 3.8);
    const DOOR3 = offset(carAtEnd.xy, carAtEnd.heading, 3.5, 1.3), CURB3 = offset(carAtEnd.xy, carAtEnd.heading, 3.5, 3.8);
    const busDep = BS ? busAt(T.dep) : null, busArr = BS ? busAt(T.arr) : null;
    const DOOR2 = BS ? offset(busDep.xy, busDep.heading, 4.7, 1.4) : toXY(G.board);
    const DOOR4 = BS ? offset(busArr.xy, busArr.heading, 4.7, 1.4) : toXY(G.alight), CURB4 = BS ? offset(busArr.xy, busArr.heading, 4.7, 3.6) : toXY(G.alight);
    // the final walk starts on the sidewalk beside the bus door and passes stop 9486's own coordinates (the shape ends 39 m short of them)
    const WALK2 = Path(BS ? [toLL(CURB4), ...(G.walk2 || [G.alight, G.dest])] : (G.walk2 || [G.alight, G.dest]));

    // ---- v3: four 0.6 s holds where the scheduled clock stops while a rider boards or gets off.
    // Pausing adds no scheduled time: the clock, the stopwatches and every scheduled position hold.
    const PD = 0.6;                                                     // the 1938 holds; the bus holds are 0.9 s
    const PAUSES = [
      { t: Y.dep, kind: 'board', who: '1938', d: 0.6 }, { t: Y.arr, kind: 'alight', who: '1938', d: 0.6 },
      { t: T.dep, kind: 'board', who: 'today', d: 0.9 }, { t: T.arr, kind: 'alight', who: 'today', d: 0.9 },
    ].sort((a, b) => a.t - b.t);
    const holdD = (t) => (PAUSES.find((p) => p.t === t) || { d: 0 }).d;
    function pauseAt(f) {
      let acc = 0;
      for (let k = 0; k < PAUSES.length; k++) {
        const fp = EST + (PAUSES[k].t - START) / SPEED + acc;
        if (f < fp - 1e-9) return null;
        if (f < fp + PAUSES[k].d - 1e-9) return { ...PAUSES[k], k, u: (f - fp) / PAUSES[k].d, f0: fp };
        acc += PAUSES[k].d;
      }
      return null;
    }
    function schedAt(f) {
      let acc = 0;
      for (const p of PAUSES) {
        const fp = EST + (p.t - START) / SPEED + acc;
        if (f < fp - 1e-9) break;
        if (f < fp + p.d - 1e-9) return p.t;
        acc += p.d;
      }
      return START + Math.max(0, f - EST - acc) * SPEED;
    }
    const filmAt = (sched) => EST + (sched - START) / SPEED + PAUSES.filter((p) => p.t < sched).reduce((a, p) => a + p.d, 0);

    // linear-in-time by length between departure and arrival
    function along(path, dep, arr, sched) {
      const u = clamp((sched - dep) / (arr - dep), 0, 1);
      return u * path.L;
    }
    function place(path, s) {
      const p = path.at(s);
      return { xy: p, lonlat: toLL(p), heading: bearing(path.tangent(s, 6)) };
    }
    // 1938 cars: heading looks slightly ahead, so a car stopped at the corner already points down Caroline St
    function placeCar(s) { const p = CAR.at(s), a = CAR.at(s - 2), b = CAR.at(s + 9); return { xy: p, lonlat: toLL(p), heading: bearing([b[0] - a[0], b[1] - a[1]]) }; }

    // ------------------------------------------------------------------
    // positionAt(sched): every vehicle and marker at a scheduled time.
    function positionAt(sched) {
      const out = {};
      // 1938: the rider's own trolley (left half): drives in along Preston St, then the route; parked after arrival
      const ts = carS(Y.dep, sched);
      out.trolley = ts === null ? { visible: false, moving: false, xy: CAR.at(0), lonlat: toLL(CAR.at(0)), heading: 90 }
        : { visible: true, moving: sched < Y.arr && sched !== Y.dep, ...placeCar(ts) };
      // the four scheduled cars (right half, ghosts)
      out.ghosts = FILM.ghosts.map((dep) => {
        const arr = dep + Y.ride_min * 60, s = carS(dep, sched);
        return { dep, arr, visible: s !== null && sched <= arr, ...(s === null ? placeCar(0) : placeCar(s)) };
      });
      // 1938 rider: waits on the curb at the corner, boards at dep; steps off at Aliceanna & Bond at arr
      if (sched < Y.dep) out.rider1938 = { visible: true, xy: CURB1, lonlat: toLL(CURB1), waitFrac: clamp((sched - START) / (Y.dep - START), 0, 1) };
      else if (sched < Y.arr) out.rider1938 = { visible: false, xy: CURB1, lonlat: toLL(CURB1), waitFrac: 1 };
      else out.rider1938 = { visible: true, arrived: true, xy: CURB3, lonlat: toLL(CURB3), waitFrac: 1 };
      // today's rider
      let r;
      if (sched < T.at_stop) {
        const s = along(WALK1, START, T.at_stop, sched);
        r = { phase: 'walk', visible: true, ...place(WALK1, s), waitFrac: 0 };
      } else if (sched < T.dep) {
        r = { phase: 'wait', visible: true, lonlat: G.board, xy: toXY(G.board), waitFrac: clamp((sched - T.at_stop) / (T.dep - T.at_stop), 0, 1) };
      } else if (sched < T.arr) {
        r = { phase: 'bus', visible: false, lonlat: G.board, xy: toXY(G.board), waitFrac: 1 };
      } else if (sched < T.finish) {
        const s = along(WALK2, T.arr, T.finish, sched);
        r = { phase: 'walk2', visible: true, ...place(WALK2, s), waitFrac: 1 };
      } else {
        r = { phase: 'done', visible: true, lonlat: G.dest, xy: toXY(G.dest), waitFrac: 1 };
      }
      out.riderToday = r;
      // today's bus: shown only where its scheduled stop times put it
      out.bus = BS ? busAt(sched) : { visible: sched >= T.dep, moving: sched >= T.dep && sched < T.arr, ...place(BUS, along(BUS, T.dep, T.arr, sched)) };
      return out;
    }

    // the holds: riders walk the last few metres to the door and vanish, or appear at the door and step onto the curb
    function applyPause(pos, pz) {
      if (!pz) return pos;
      const u = pz.u, inU = smooth(u / 0.7), fadeOut = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25, fadeIn = Math.min(1, u / 0.2), outU = smooth((u - 0.2) / 0.8);
      const mk = (xy, alpha, phase) => ({ visible: alpha > 0.02, alpha, xy, lonlat: toLL(xy), waitFrac: 1, phase });
      if (pz.who === '1938' && pz.kind === 'board') pos.rider1938 = mk(lerp2(CURB1, DOOR1, inU), fadeOut, 'board');
      if (pz.who === '1938' && pz.kind === 'alight') pos.rider1938 = { ...mk(lerp2(DOOR3, CURB3, outU), fadeIn, 'alight'), arrived: true };
      if (pz.who === 'today' && pz.kind === 'board') pos.riderToday = mk(lerp2(toXY(G.board), DOOR2, inU), fadeOut, 'board');
      if (pz.who === 'today' && pz.kind === 'alight') pos.riderToday = mk(lerp2(DOOR4, CURB4, outU), fadeIn, 'alight');
      return pos;
    }
    // ------------------------------------------------------------------
    // Clocks and counters
    const pad = (n) => String(n).padStart(2, '0');
    function clockText(sched) {
      const s = Math.floor(sched + 1e-6);
      let h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60), x = s % 60;
      const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
      return `${h}:${pad(m)}:${pad(x)} ${ap}`;
    }
    const watchText = (sec) => { const s = Math.floor(sec + 1e-6); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
    function watches(sched) {
      const el = Math.max(0, sched - START);
      const capY = Y.total_min * 60;                         // 15:00 exactly
      const capT = Math.round(T.total_min) * 60;             // display rounds 45.156 -> 45:00
      return {
        y1938: { sec: Math.min(el, capY), frozen: sched >= Y.arr, text: watchText(Math.min(el, capY)) },
        today: { sec: Math.min(el, capT), frozen: sched >= T.finish, text: watchText(Math.min(el, capT)) },
      };
    }
    const tally = (sched) => FILM.ghosts.filter((d) => sched >= d).length;

    // ------------------------------------------------------------------
    // Cameras: tight drone chase, 45-70 m from the subject (Emmanuel: "too far").
    // Pose = look-at target (local xy), heading (deg), pitch (deg), range (m).
    // The target follows the subject exactly (tiny 0.08 s ease so starts/stops don't jolt);
    // heading, range and pitch are smoothed over +-0.4 s. All pure functions of film time.
    const CLOSE = { range: 52, pitch: -50, off: -30, ahead: 9 };  // ~33 m up; trolley ~150+ px long (camera on the east side: cleaner street mesh)
    const LWAIT = { range: 54, pitch: -50, off: -150 };           // 1938 rider at the corner, seen from the south-east: no spire in front
    const BUSCAM = { range: 56, pitch: -42, off: 26, ahead: -4 };
    const WAITCAM = { range: 56, pitch: -42, off: 8, ahead: 0 };  // rider centred; ghosts pass alongside // rider at stop 8564; ghosts pass 14 m east
    const EASE = (f) => smooth(f / EST);
    const H0 = bearing(HIST.tangent(0, 120));
    const HEND = bearing(HIST.tangent(HIST.L, 120));
    const fwd = (hd) => [Math.sin(hd * rad), Math.cos(hd * rad)];
    const aheadOf = (xy, hd, m) => { const v = fwd(hd); return [xy[0] + v[0] * m, xy[1] + v[1] * m]; };
    const pushIn = (f, near) => { const u = EASE(f); return { range: lerp(300, near.range, u), pitch: lerp(-58, near.pitch, u) }; };

    function rawLeft(f) {
      const sched = schedAt(f);
      const c = CLOSE;
      if (f < EST || sched < Y.dep) {                       // the 1938 rider waits at the corner
        const pr = f < EST ? pushIn(f, c) : c;
        // in the last 1.5 scheduled minutes before departure, orbit gently round to the chase angle,
        // so the trolley's departure isn't hidden by a camera swing
        const lw = LWAIT, pw = f < EST ? pushIn(f, lw) : lw, o = smooth((sched - (Y.dep - 150)) / 120);
        return { xy: lerp2(HIST.at(0), aheadOf(HIST.at(0), H0, c.ahead), o), heading: H0 + lw.off + (c.off - lw.off) * o, range: lerp(pw.range, c.range, o), pitch: lerp(pw.pitch, c.pitch, o) };
      }
      if (sched < Y.arr) {                                  // chase
        const s = along(HIST, Y.dep, Y.arr, sched);
        const hd = bearing(HIST.tangent(s, 60));
        const ah = c.ahead * smooth((sched - Y.dep) / 30);   // start centred on the corner, then lead slightly
        return { xy: aheadOf(HIST.at(s), hd, ah), heading: hd + c.off, range: c.range, pitch: c.pitch };
      }
      const u = clamp((f - filmAt(Y.arr)) / 15, 0, 1);      // parked at Aliceanna & Bond: hold close, slow creep
      return { xy: aheadOf(HIST.at(HIST.L), HEND, 4), heading: HEND + c.off + 25 * u, range: lerp(c.range, 46, u), pitch: c.pitch };
    }

    const HWALK = bearing([toXY(G.board)[0] - toXY(G.origin)[0], toXY(G.board)[1] - toXY(G.origin)[1]]); // overall: down Caroline            // down Caroline toward the stop
    // wait framing: halfway between the rider at stop 8564 and the trolley route beside it
    const PASS_S = (() => { const b = toXY(G.board); let best = 0, bd = 1e9; for (let s = 0; s < 400; s += 0.5) { const q = HIST.at(s), d = Math.hypot(q[0] - b[0], q[1] - b[1]); if (d < bd) { bd = d; best = s; } } return best; })();
    const WAITC = lerp2(toXY(G.board), HIST.at(PASS_S), 0.5);
    // when each scheduled 1938 car passes the waiting rider (closest point of the route to stop 8564)
    const PASSES = FILM.ghosts.map((d) => d + (PASS_S / HIST.L) * Y.ride_min * 60);
    // Right half. Wait: camera south of stop 8564, about 50 m up, facing north up Caroline St, so
    // Preston & Caroline is in the upper frame and the rider in the lower middle; each ghost leaves
    // the corner and glides down past the rider. Bus: the camera keeps facing north and leads the bus
    // (the bus drives toward the viewer), so there is no 180-degree swing at departure.
    const NORTH = (HWALK + 180) % 360;
    const WAITN = { range: 140, pitch: -45, off: 0 };   // ~99 m up, straight down Caroline St                    // ~46 m up
    const WAITT = (() => { const o = toXY(G.origin); const d = [o[0] - WAITC[0], o[1] - WAITC[1]], L = Math.hypot(d[0], d[1]); return [WAITC[0] + d[0] / L * 40, WAITC[1] + d[1] / L * 40]; })();
    const BUSF = { range: 56, pitch: -42, off: -18, behind: 6 };         // lead camera, bus in the lower middle
    function busPose(sched) {
      const b = busAt(sched), hd = b.heading;
      return { xy: aheadOf(b.xy, hd, -BUSF.behind), heading: (hd + 180 + BUSF.off) % 360, range: BUSF.range, pitch: BUSF.pitch };
    }
    function rawRight(f) {
      const sched = schedAt(f);
      const w = WAITN, waitPose = { xy: WAITT, heading: NORTH + w.off, range: w.range, pitch: w.pitch };
      if (f < EST) { const pr = pushIn(f, w); return { ...waitPose, range: pr.range, pitch: pr.pitch }; }
      // boarding: move in from 200 to 60 scheduled s before 10:32:43 (~1.2 s of film) so the camera has settled when the bus
      // pulls in; hold ~55 m from the bus at the pole, looking north, so its door side (south) faces the camera
      const holdPose = { xy: lerp2(busAt(T.dep).xy, toXY(G.board), 0.4), heading: waitPose.heading, range: 55, pitch: -42 };
      if (sched < T.dep - 200) return waitPose;                           // rider walks down to the stop and waits
      if (sched <= T.dep && !(sched === T.dep && f > filmAt(T.dep) + holdD(T.dep) - 1e-9)) {
        const u = smooth((sched - (T.dep - 200)) / 140);                 // settled 60 scheduled s before the bus stops
        return { xy: lerp2(WAITT, holdPose.xy, u), heading: waitPose.heading, range: lerp(w.range, holdPose.range, u), pitch: lerp(w.pitch, holdPose.pitch, u) };
      }
      if (sched < T.arr) {                                                // after the hold, turn into the lead camera over 30 scheduled s
        const bp = busPose(sched), u = smooth((sched - T.dep) / 30);
        return { xy: lerp2(holdPose.xy, bp.xy, u), heading: angLerp(holdPose.heading, bp.heading, u), range: lerp(holdPose.range, bp.range, u), pitch: lerp(holdPose.pitch, bp.pitch, u) };
      }
      if (sched <= T.arr) return busPose(sched);                          // at 10:41:00 it holds on the bus while the rider steps off
      const s = along(WALK2, T.arr, T.finish, sched);
      const hw = bearing(WALK2.tangent(s, 25));                           // the last walk, along the street: rider walks toward the camera
      const pull = clamp((sched - T.finish) / 60, 0, 1);                  // gentle pull-back during the final hold only
      // keep the camera's heading (no swing) and move straight onto the rider within 10 scheduled s,
      // a little wider so the stop, the rider and the street ahead stay in frame
      // street-side view: camera over the roadway behind and beside the rider (the rider is on the right-hand
      // sidewalk, so the camera sits to their left), looking along Caroline St and then along Aliceanna St.
      // A clean cut at the bus's arrival (no smoothing across it), not a swing.
      return { xy: aheadOf(WALK2.at(s), hw, 12), heading: (hw + 40) % 360, range: lerp(62, 100, smooth(pull)), pitch: lerp(-35, -50, smooth(pull)) };
    }
    function angLerp(a, b, u) { let d = ((b - a + 540) % 360) - 180; return (a + d * u + 360) % 360; }

    function filtered(raw, f) {
      let x = 0, y = 0, nT = 0, hx = 0, hy = 0, r = 0, p = 0, nS = 0;
      for (let i = -4; i <= 4; i++) { const q = raw(f + (i / 4) * 0.08); x += q.xy[0]; y += q.xy[1]; nT++; }
      for (let i = -12; i <= 12; i++) { const q = raw(f + (i / 12) * 0.4); hx += Math.sin(q.heading * rad); hy += Math.cos(q.heading * rad); r += q.range; p += q.pitch; nS++; }
      const xy = [x / nT, y / nT];
      return { lonlat: toLL(xy), xy, heading: bearing([hx, hy]), range: r / nS, pitch: p / nS };
    }
    const camLeft = (f) => filtered(rawLeft, f);
    // the right camera smooths over the past only, so it never starts moving before the bus exists
    function filteredPast(raw, f) {
      let x = 0, y = 0, nT = 0, hx = 0, hy = 0, r = 0, p = 0, nS = 0;
      for (let i = -4; i <= 4; i++) { const q = raw(f + (i / 4) * 0.08); x += q.xy[0]; y += q.xy[1]; nT++; }
      for (let j = 0; j <= 24; j++) { const q = raw(f - (j / 24) * 0.8); hx += Math.sin(q.heading * rad); hy += Math.cos(q.heading * rad); r += q.range; p += q.pitch; nS++; }
      const xy = [x / nT, y / nT];
      return { lonlat: toLL(xy), xy, heading: bearing([hx, hy]), range: r / nS, pitch: p / nS };
    }
    const F_ARR = filmAt(T.arr) + holdD(T.arr);                                     // the cut to the street-side walk comes after the getting-off hold
    const camRight = (f) => filteredPast(f >= F_ARR ? (g) => rawRight(Math.max(g, F_ARR)) : (g) => rawRight(Math.min(g, F_ARR - 1e-6)), f);

    // Display rounding, ported from the app (web/src/format/rounding.ts roundParts, R7.3): round every
    // part down, then give one minute each to the parts with the largest fractions (ties to the earlier
    // phase) until the parts add up to the shown total. Shown values only; stored minutes never change.
    const round6 = (x) => Math.round(x * 1e6) / 1e6;
    const roundTotal = (stored) => Math.floor(round6(stored) + 0.5);
    function roundParts(parts, storedTotal) {
      const exact = parts.map(round6), shownTotal = roundTotal(storedTotal);
      const shown = exact.map((p) => Math.floor(p));
      const missing = shownTotal - shown.reduce((a, b) => a + b, 0);
      const byFraction = exact.map((p, i) => ({ i, fraction: round6(p - Math.floor(p)) })).filter((x) => x.fraction > 0).sort((x, y) => y.fraction - x.fraction || x.i - y.i);
      if (missing < 0 || missing > byFraction.length) throw new Error(`parts ${parts.join(', ')} cannot add up to ${shownTotal}`);
      for (const { i } of byFraction.slice(0, missing)) shown[i] += 1;
      return { shownTotal, shown };
    }
    const cardRows = {
      y1938: roundParts([Y.wait_min, Y.ride_min], Y.total_min),
      today: roundParts([T.walk1_min, T.wait_min, T.ride_min, T.walk2_min], T.total_min),
    };
    // ------------------------------------------------------------------
    function frameState(n) {
      const f = n / FPS;
      const sched = schedAt(f), pause = pauseAt(f);
      return {
        n, f, sched, pause, card: n >= TILE_FRAMES, establishing: f < EST,
        clock: clockText(sched), watches: watches(sched), tally: tally(sched),
        pos: applyPause(positionAt(sched), pause), camLeft: camLeft(f), camRight: camRight(f),
      };
    }

    return {
      FPS, SPEED, EST, HOLD, CARD, RACE_FILM, TILE_END, TILE_FRAMES, CARD_FRAMES, TOTAL_FRAMES,
      START, Y, T, G, FILM,
      toXY, toLL, distM, bearing, schedAt, filmAt, positionAt, clockText, watchText, watches, tally,
      camLeft, camRight, frameState, paths: { HIST, BUS, WALK1, WALK2, CAR }, roundParts, cardRows, PASSES, PASS_S,
      PAUSES, PD, holdD, pauseAt, busAt, busDistAt, busPointAtDist, S_CORNER, APPROACH_S, carS, doors: { DOOR1, CURB1, DOOR2, DOOR3, CURB3, DOOR4, CURB4 },
    };
  }

  const api = { make };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Timeline = api;
})(typeof window !== 'undefined' ? window : globalThis);
