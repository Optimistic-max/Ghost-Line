// The capture page: two Cesium viewers (1938 | Today), HTML overlays, renderFrame(n).
// ?notiles=1 runs without Google tiles (plain ground) for layout work.
(async function () {
  'use strict';
  const C = Cesium, P = new URLSearchParams(location.search);
  const NOTILES = P.has('notiles');
  const MSE = +(P.get('mse') || 8);
  const SETTLE = +(P.get('settle') || 4);
  // one Cesium viewer per page (two viewers in one page share GPU caches across WebGL contexts)
  const SIDE = P.get('side') || 'both';
  const TL = Timeline.make(FILM);
  if (P.has('clean')) document.body.classList.add('clean');
  const K = window.COPY;
  const rad = Math.PI / 180;
  const $ = (id) => document.getElementById(id);
  window.__log = [];
  const log = (...a) => { window.__log.push(a.join(' ')); console.log(...a); };

  // ---------------------------------------------------------------- viewers
  if (!NOTILES) {
    if (!window.__ION) throw new Error('No Cesium ion token injected');
    C.Ion.defaultAccessToken = window.__ION;
  }
  const LIGHT_TIME = C.JulianDate.fromIso8601('2026-11-04T15:15:00Z'); // 10:15 AM EST, scheduled date
  function makeViewer(el) {
    const v = new C.Viewer(el, {
      useDefaultRenderLoop: false, shouldAnimate: false, animation: false, timeline: false,
      baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
      navigationHelpButton: false, fullscreenButton: false, infoBox: false, selectionIndicator: false,
      baseLayer: false, globe: NOTILES ? undefined : false, useBrowserRecommendedResolution: false,
      contextOptions: { webgl: { preserveDrawingBuffer: true, alpha: false, antialias: true } },
      msaaSamples: 4, orderIndependentTranslucency: false,
    });
    v.clock.currentTime = LIGHT_TIME; v.clock.shouldAnimate = false;
    v.scene.light = new C.SunLight({ intensity: 2.2 });
    v.scene.postProcessStages.fxaa.enabled = true;
    v.scene.fog.enabled = false;
    v.resolutionScale = 1;
    v.scene.screenSpaceCameraController.enableInputs = false;
    if (NOTILES) { v.scene.globe.baseColor = C.Color.fromCssColorString('#5a5a5e'); v.scene.globe.showGroundAtmosphere = false; }
    return v;
  }
  const VL = SIDE !== 'right' ? makeViewer($('left')) : null, VR = SIDE !== 'left' ? makeViewer($('right')) : null;
  const viewers = [VL, VR].filter(Boolean);
  const tilesets = [];
  if (!NOTILES) {
    for (const v of viewers) {
      const ts = await C.createGooglePhotorealistic3DTileset(undefined, { showCreditsOnScreen: true, maximumScreenSpaceError: MSE });
      v.scene.primitives.add(ts);
      tilesets.push(ts);
    }
  }

  // ---------------------------------------------------------------- ground heights (sampled once, in memory only)
  const paths = TL.paths;
  const samplePts = []; // {xy, lonlat, h}
  function densify(path, step) { const out = []; for (let s = 0; s <= path.L + 1e-6; s += step) out.push(path.at(s)); out.push(path.at(path.L)); return out; }
  const approachPts = []; for (let s = Math.max(0, TL.S_CORNER - 500); s <= TL.S_CORNER; s += 6) approachPts.push(paths.CAR.at(s));   // v3: Preston St approach
  const groups = [densify(paths.HIST, 6), densify(paths.BUS, 6), densify(paths.WALK1, 6), densify(paths.WALK2, 6), approachPts];
  async function sampleHeights() {
    if (NOTILES) { for (const g of groups) for (const xy of g) samplePts.push({ xy, h: 0 }); return; }
    for (const g of groups) {
      const cartos = g.map((xy) => { const ll = TL.toLL(xy); return C.Cartographic.fromDegrees(ll[0], ll[1]); });
      // sample on whichever viewer; both stream the same tileset
      // the default render loop is off, so keep rendering while the most-detailed pick resolves
      let res = null;
      viewers[0].scene.sampleHeightMostDetailed(cartos, [], 0.5).then((r) => { res = r; }, (e) => { res = e; });
      const t0 = performance.now();
      while (res === null) { viewers[0].render(); await sleep(15); if (performance.now() - t0 > 600000) throw new Error('height sampling timed out'); }
      if (res instanceof Error) throw res;
      log('heights group', g.length, 'in', Math.round(performance.now() - t0), 'ms');
      const raw = res.map((c) => (c && isFinite(c.height) ? c.height : NaN));
      // robust: 25th percentile over +-3 samples (+-18 m) to ignore trees, awnings, parked cars
      const filt = raw.map((_, i) => { const w = raw.slice(Math.max(0, i - 3), i + 4).filter(isFinite).sort((a, b) => a - b); return w.length ? w[Math.floor(w.length * 0.25)] : NaN; });
      g.forEach((xy, i) => samplePts.push({ xy, h: filt[i], raw: raw[i] }));
    }
    const bad = samplePts.filter((p) => !isFinite(p.h)).length;
    log('heights sampled', samplePts.length, 'missing', bad);
    const good = samplePts.filter((p) => isFinite(p.h));
    for (const p of samplePts) if (!isFinite(p.h)) p.h = nearest(p.xy, good, 3);
  }
  function nearest(xy, pts, k) {
    if (!pts.length) return 0;
    const d = pts.map((p) => [Math.hypot(p.xy[0] - xy[0], p.xy[1] - xy[1]), p.h]).sort((a, b) => a[0] - b[0]).slice(0, k);
    let w = 0, s = 0; for (const [dd, h] of d) { const ww = 1 / (dd + 0.5); w += ww; s += ww * h; } return s / w;
  }
  const groundAt = (xy) => nearest(xy, samplePts, 3);
  const camGroundAt = (xy) => { const near = samplePts.filter((p) => Math.hypot(p.xy[0] - xy[0], p.xy[1] - xy[1]) < 80); return near.length ? near.reduce((a, p) => a + p.h, 0) / near.length : groundAt(xy); };

  // ---------------------------------------------------------------- models
  async function model(v, file, opts = {}) {
    if (!v) return { show: false, ready: true, modelMatrix: null };
    const m = await C.Model.fromGltfAsync({ url: '../models/' + file, forwardAxis: C.Axis.X, ...opts });
    v.scene.primitives.add(m); return m;
  }
  // vehicles at real scale; a thin dark silhouette keeps the outline crisp from drone height
  const INK = C.Color.fromCssColorString('#17121F');
  const solid = { silhouetteColor: INK, silhouetteSize: 1.5 };
  // 1938 is the ghost of a dead line: a warm, gaslight-like cream glow (soft, no neon). Today's bus stays plain.
  const GHOSTLY = P.get('look') !== 'v2b';
  const CREAM = C.Color.fromCssColorString('#FFE7A8');
  const glowLight = new C.Cartesian3(1.5, 1.45, 1.3);       // brighter warm light on 1938 models only (reads as self-lit)
  const M = {
    // solid body (keeps windows and poles crisp) with softly lit cream edges; 85% read as a muddy capsule
    trolley: await model(VL, 'trolley1938.glb', GHOSTLY ? { color: CREAM, colorBlendMode: C.ColorBlendMode.MIX, colorBlendAmount: 0.15, silhouetteColor: CREAM, silhouetteSize: 2.0 } : solid),
    ghosts: [],
    bus: await model(VR, 'bus-today.glb', solid),
  };
  for (let i = 0; i < FILM.ghosts.length; i++) {
    M.ghosts.push(await model(VR, 'trolley1938.glb', GHOSTLY
      ? { color: CREAM.withAlpha(0.65), colorBlendMode: C.ColorBlendMode.MIX, colorBlendAmount: 0.35, silhouetteColor: CREAM, silhouetteSize: 2.0 }  // light fill + cream outline
      : { color: C.Color.WHITE.withAlpha(0.55), colorBlendMode: C.ColorBlendMode.MIX, colorBlendAmount: 0.0, silhouetteColor: CREAM.withAlpha(0.9), silhouetteSize: 1.5 }));
  }
  if (GHOSTLY) for (const m of [M.trolley, ...M.ghosts]) if (m.modelMatrix !== null || m.lightColor !== undefined) m.lightColor = glowLight;
  // soft contact shadows so the vehicles sit on the street
  M.shTrolley = await model(VL, 'shadow-trolley.glb');
  M.shBus = await model(VR, 'shadow-bus.glb');
  M.shGhosts = [];
  for (let i = 0; i < FILM.ghosts.length; i++) M.shGhosts.push(await model(VR, 'shadow-trolley.glb', { color: C.Color.WHITE.withAlpha(0.5) }));
  const allModels = [M.trolley, M.bus, ...M.ghosts, M.shTrolley, M.shBus, ...M.shGhosts];
  function placeModel(m, xy, bearingDeg, lift = 0) {
    const ll = TL.toLL(xy);
    const pos = C.Cartesian3.fromDegrees(ll[0], ll[1], groundAt(xy) + lift);
    const hpr = new C.HeadingPitchRoll((bearingDeg - 90) * rad, 0, 0); // model +X forward; HPR heading 0 = east
    m.modelMatrix = C.Transforms.headingPitchRollToFixedFrame(pos, hpr);
  }

  // ---------------------------------------------------------------- ghost wire (two thin lines ~5.5 m up)
  function addWire(v) {
    if (!v) return;
    const pc = v.scene.primitives.add(new C.PolylineCollection());
    const pts = densify(paths.CAR, 6);   // v3: the wires run along the approach on Preston St too
    for (const side of [-0.3, 0.3]) {
      const positions = pts.map((xy, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        const tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1;
        const q = [xy[0] - (ty / L) * side, xy[1] + (tx / L) * side];
        const ll = TL.toLL(q);
        return C.Cartesian3.fromDegrees(ll[0], ll[1], groundAt(xy) + 5.5);
      });
      pc.add(GHOSTLY
        ? { positions, width: 6.0, material: C.Material.fromType('PolylineGlow', { color: C.Color.fromCssColorString('#FFE7A8').withAlpha(0.95), glowPower: 0.22, taperPower: 1.0 }) }
        : { positions, width: 2.0, material: C.Material.fromType('Color', { color: C.Color.fromCssColorString('#FFE7A8').withAlpha(0.8) }) });
    }
  }
  // today's lane: the bus route, a thin coral line just above the street
  function addBusLane(v) {
    if (!v) return;
    const pc = v.scene.primitives.add(new C.PolylineCollection());
    const positions = densify(paths.BUS, 6).map((xy) => { const ll = TL.toLL(xy); return C.Cartesian3.fromDegrees(ll[0], ll[1], groundAt(xy) + 1.2); });
    pc.add({ positions, width: 3.0, material: C.Material.fromType('Color', { color: C.Color.fromCssColorString('#F47C5A').withAlpha(0.7) }) });
  }

  // ---------------------------------------------------------------- render helpers
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function settle(maxMs) {
    const t0 = performance.now(); let stable = 0, renders = 0, timeout = false;
    while (true) {
      for (const v of viewers) v.render();
      renders++;
      const ok = tilesets.every((t) => t.tilesLoaded) && allModels.every((m) => m.ready);
      stable = ok ? stable + 1 : 0;
      if (stable >= SETTLE) break;
      if (performance.now() - t0 > maxMs) { timeout = true; break; }
      await sleep(ok ? 0 : 25);
    }
    return { renders, ms: Math.round(performance.now() - t0), timeout };
  }
  function setCam(v, cam) {
    if (!v) return;
    const ll = cam.lonlat;
    const tgt = C.Cartesian3.fromDegrees(ll[0], ll[1], camGroundAt(cam.xy));
    v.camera.lookAt(tgt, new C.HeadingPitchRange(cam.heading * rad, cam.pitch * rad, cam.range * (cam.rangeScale || 1)));
    v.camera.lookAtTransform(C.Matrix4.IDENTITY);
  }
  // safety: how far the camera is above whatever mesh is directly under it
  function cameraClearance(v) {
    const c = v.camera.positionCartographic;
    const h = v.scene.sampleHeight(new C.Cartographic(c.longitude, c.latitude), allModels.filter((m) => m.modelMatrix));
    return h === undefined ? Infinity : c.height - h;
  }
  // the 60 x 40 px of 3D canvas around a vehicle: a dark, flat patch means it sits on a melted-mesh smear
  const vprobe = document.createElement('canvas'); vprobe.width = 60; vprobe.height = 40;
  const vctx = vprobe.getContext('2d', { willReadFrequently: true });
  function vehicleRegion(v, xy) {
    const ll = TL.toLL(xy);
    const p = C.SceneTransforms.worldToWindowCoordinates(v.scene, C.Cartesian3.fromDegrees(ll[0], ll[1], groundAt(xy) + 1));
    if (!p || p.x < 30 || p.x > 930 || p.y < 20 || p.y > 1060) return null;
    vctx.drawImage(v.scene.canvas, p.x - 30, p.y - 20, 60, 40, 0, 0, 60, 40);
    const d = vctx.getImageData(0, 0, 60, 40).data; let s = 0, s2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; s += l; s2 += l * l; n++; }
    const mean = s / n; return { mean: +mean.toFixed(1), std: +Math.sqrt(s2 / n - mean * mean).toFixed(1) };
  }  // tile-detail metric of the 3D canvas (mean absolute luminance gradient): low = blurry or blank
  const probe = document.createElement('canvas'); probe.width = 240; probe.height = 270;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  function detail(v) {
    pctx.drawImage(v.scene.canvas, 0, 0, 240, 270);
    const d = pctx.getImageData(0, 0, 240, 230).data; // skip the bottom (credit strip)
    let g = 0, n = 0, s = 0, s2 = 0;
    const L = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    for (let y = 0; y < 229; y++) for (let x = 0; x < 239; x++) {
      const i = (y * 240 + x) * 4, l = L(i);
      g += Math.abs(l - L(i + 4)) + Math.abs(l - L(i + 960)); s += l; s2 += l * l; n++;
    }
    const mean = s / n;
    return { grad: +(g / n).toFixed(2), std: +Math.sqrt(s2 / n - mean * mean).toFixed(2) };
  }
  function project(v, xy, lift, offsetX) {
    if (!v) return null;
    const ll = TL.toLL(xy);
    const p = C.SceneTransforms.worldToWindowCoordinates(v.scene, C.Cartesian3.fromDegrees(ll[0], ll[1], groundAt(xy) + lift));
    if (!p) return null;
    if (p.x < -50 || p.x > 1010 || p.y < -50 || p.y > 1130) return null;
    return [p.x + offsetX, p.y];
  }

  // ---------------------------------------------------------------- overlays
  $('subToday').textContent = K.subToday;
  $('capText').textContent = K.caption;
  $('capPromo').textContent = K.promo + '  ·  ' + K.wire;
  $('rulesA').textContent = K.rulesA; $('rulesB').textContent = K.rulesB;
  $('badge').textContent = K.badge;
  $('wl1938').textContent = $('wlToday').textContent = K.tripTime;
  document.querySelector('#tally .lbl').textContent = K.tally;

  const SVGNS = 'http://www.w3.org/2000/svg';
  const svg = $('svg');
  function el(tag, attrs, parent = svg) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; }
  // a rider: a person glyph standing on the spot, a WAITING ring that fills over the wait,
  // a name above and a caption below
  function markerGroup(color) {
    const g = el('g', {});
    const ringBg = el('circle', { r: 34, cy: -22, fill: 'rgba(23,18,31,0.85)', stroke: 'rgba(23,18,31,0.85)', 'stroke-width': 10 }, g);
    const ring = el('circle', { r: 34, cy: -22, fill: 'none', stroke: color, 'stroke-width': 7, 'stroke-linecap': 'round', transform: 'rotate(-90 0 -22)' }, g);
    const person = el('g', {}, g);
    el('circle', { cx: 0, cy: -38, r: 8, fill: color, stroke: '#17121F', 'stroke-width': 2.5 }, person);
    el('path', { d: 'M -11 -4 L -11 -18 Q -11 -28 0 -28 Q 11 -28 11 -18 L 11 -4 Z', fill: color, stroke: '#17121F', 'stroke-width': 2.5 }, person);
    el('ellipse', { cx: 0, cy: 0, rx: 12, ry: 4, fill: '#17121F', opacity: 0.6 }, g);
    const name = el('text', { y: -70, 'text-anchor': 'middle', class: 'plabel' }, g);
    const cap = el('text', { y: 44, 'text-anchor': 'middle', class: 'plabel' }, g);
    name.style.fill = color; cap.style.fill = color;
    return { g, ring, ringBg, name, cap };
  }
  function setMarker(mk, p, frac, name, caption, showRing, alpha, below) {
    mk.name.setAttribute('y', below ? 46 : -70); mk.cap.setAttribute('y', below ? 80 : 44);
    mk.g.style.opacity = alpha === undefined ? '1' : alpha.toFixed(3);
    if (!p || p[1] > 900) { mk.g.style.display = 'none'; return; }   // never into the caption/credit strip
    mk.g.style.display = '';
    mk.g.setAttribute('transform', `translate(${p[0].toFixed(1)},${p[1].toFixed(1)})`);
    const C2 = 2 * Math.PI * 34;
    mk.ring.style.display = showRing ? '' : 'none';
    mk.ringBg.setAttribute('fill', showRing ? 'rgba(23,18,31,0.85)' : 'none');
    mk.ringBg.style.display = showRing ? '' : 'none';
    mk.ring.setAttribute('stroke-dasharray', `${(C2 * frac).toFixed(2)} ${C2.toFixed(2)}`);
    mk.name.textContent = name || '';
    mk.cap.textContent = caption || '';
  }
  function placeLabel(text) { const t = el('text', { class: 'plabel', 'text-anchor': 'middle' }); t.textContent = text; t.dataset.place = '1'; return t; }
  const EST_HIDE = TL.EST;
  function setLabel(t, p, dy = -34, maxY = 900) {
    if (t.dataset.place && hud.hidePlaces) { t.style.display = 'none'; return; }
    if (!p || p[1] + dy > maxY || p[1] + dy < 230) { t.style.display = 'none'; return; }
    t.style.display = ''; t.setAttribute('x', p[0].toFixed(1)); t.setAttribute('y', (p[1] + dy).toFixed(1));
  }
  // ground rings: a perspective-correct ellipse on the street around each vehicle (lane colour)
  const defs = el('defs', {}); const flt = el('filter', { id: 'soft', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  el('feGaussianBlur', { stdDeviation: 4 }, flt);
  const ringLayer = el('g', {});
  function ringGroup(color, strength) {
    const g = el('g', { opacity: strength }, ringLayer);
    const glow = el('polygon', { fill: 'none', stroke: color, 'stroke-width': 10, 'stroke-opacity': 0.55, filter: 'url(#soft)' }, g);
    const line = el('polygon', { fill: color, 'fill-opacity': 0.16, stroke: color, 'stroke-width': 2.5 }, g);
    return { g, glow, line };
  }
  function setRing(rg, v, offX, half, xy, headingDeg, a, b) {
    if (!v || !xy) { rg.g.style.display = 'none'; return; }
    const c = project(v, xy, 0, offX);
    if (!clipHalf(c, half) || c[1] > 940 || c[1] < 0) { rg.g.style.display = 'none'; return; }
    const h = headingDeg * rad, fx = Math.sin(h), fy = Math.cos(h); // forward unit (east, north)
    const pts = [];
    for (let i = 0; i < 28; i++) {
      const t = (i / 28) * 2 * Math.PI, u = Math.cos(t) * a, w = Math.sin(t) * b;
      const p = project(v, [xy[0] + fx * u + fy * w, xy[1] + fy * u - fx * w], 0.3, offX);
      if (!p) { rg.g.style.display = 'none'; return; }
      pts.push(p[0].toFixed(1) + ',' + p[1].toFixed(1));
    }
    rg.g.style.display = '';
    rg.glow.setAttribute('points', pts.join(' ')); rg.line.setAttribute('points', pts.join(' '));
  }
  const RG = { trolley: ringGroup('#FFE7A8', 1), bus: ringGroup('#F47C5A', 1), ghosts: FILM.ghosts.map(() => ringGroup('#FFE7A8', 0.6)) };
  // ghost after-trails: a thin warm line along the route where each car has just been, fading over
  // about 1.5 s of film (180 scheduled s). Honest: every point is where the car was at that scheduled time.
  const trailLayer = el('g', {});
  const TRAIL_SEGS = 14, TRAIL_LIFE = 180, TRAIL_GAP = 2.2;
  // a pale core (so it reads against the gold wire) inside a soft warm band
  const TR = FILM.ghosts.map(() => Array.from({ length: TRAIL_SEGS }, () => { const g = el('g', {}, trailLayer); el('line', { stroke: '#FFE7A8', 'stroke-width': 9, 'stroke-linecap': 'round', filter: 'url(#soft)' }, g); el('line', { stroke: '#ECE7F2', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, g); return g; }));
  function setTrail(segs, ghostIdx, sched) {
    const dep = FILM.ghosts[ghostIdx], arr = dep + FILM.y1938.ride_min * 60;
    const sAt = (t) => (Math.min(Math.max(t, dep), arr) - dep) / (arr - dep) * paths.HIST.L;
    for (let k = 0; k < TRAIL_SEGS; k++) {
      const a0 = TRAIL_GAP + (k / TRAIL_SEGS) * TRAIL_LIFE, a1 = TRAIL_GAP + ((k + 1) / TRAIL_SEGS) * TRAIL_LIFE; // ages (s)
      const ln = segs[k];
      if (sched - a0 < dep || sched - a1 > arr) { ln.style.display = 'none'; continue; }
      const lines = ln.querySelectorAll('line');
      const p = clipHalf(project(VR, paths.HIST.at(sAt(sched - a0)), 0.6, 960), 1), q = clipHalf(project(VR, paths.HIST.at(sAt(sched - a1)), 0.6, 960), 1);
      if (!p || !q || (p[0] === q[0] && p[1] === q[1])) { ln.style.display = 'none'; continue; }
      ln.style.display = ''; for (const L of lines) { L.setAttribute('x1', p[0].toFixed(1)); L.setAttribute('y1', p[1].toFixed(1)); L.setAttribute('x2', q[0].toFixed(1)); L.setAttribute('y2', q[1].toFixed(1)); }
      ln.setAttribute('opacity', (0.55 * (1 - ((a0 + a1) / 2 - TRAIL_GAP) / TRAIL_LIFE)).toFixed(3));
    }
  }
  // warm glow and pole sparks on the 1938 cars (screen-blended, so it brightens like gaslight, never darkens)
  const glowLayer = el('g', {});
  const fltG = el('filter', { id: 'warm', x: '-80%', y: '-80%', width: '260%', height: '260%' }, defs); el('feGaussianBlur', { stdDeviation: 9 }, fltG);
  const fltS = el('filter', { id: 'spark', x: '-200%', y: '-200%', width: '500%', height: '500%' }, defs); el('feGaussianBlur', { stdDeviation: 2.2 }, fltS);
  function glowGroup(strength) {
    const g = el('g', {}, glowLayer);
    const body = el('polygon', { fill: '#FFE7A8', 'fill-opacity': strength, filter: 'url(#warm)' }, g);
    const sparks = [0, 1].map(() => { const sg = el('g', {}, g); el('circle', { r: 5, fill: '#FFE7A8', 'fill-opacity': 0.9, filter: 'url(#spark)' }, sg); el('circle', { r: 1.8, fill: '#ECE7F2' }, sg); return sg; });
    return { g, body, sparks };
  }
  const hash01 = (x) => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };
  function setGlow(gg, v, offX, half, xy, headingDeg, moving, n, salt, shimmer) {
    if (!GHOSTLY || !v || !xy) { gg.g.style.display = 'none'; return; }
    const c = clipHalf(project(v, xy, 1.5, offX), half);
    if (!c || c[1] > 940) { gg.g.style.display = 'none'; return; }
    const h = headingDeg * rad, f = [Math.sin(h), Math.cos(h)], l = [-Math.cos(h), Math.sin(h)];
    const pts = [];
    for (let i = 0; i < 20; i++) { const t = (i / 20) * 2 * Math.PI, u = Math.cos(t) * 6.2, w = Math.sin(t) * 2.4; const p = project(v, [xy[0] + f[0] * u + l[0] * w, xy[1] + f[1] * u + l[1] * w], 1.6, offX); if (!p) { gg.g.style.display = 'none'; return; } pts.push(p[0].toFixed(1) + ',' + p[1].toFixed(1)); }
    gg.g.style.display = ''; gg.body.setAttribute('points', pts.join(' '));
    gg.body.style.display = 'none'; // dropped: invisible over sunlit tiles, and a stronger glow fogged the photo (notes.md)
    gg.g.setAttribute('opacity', shimmer.toFixed(3));
    [-0.3, 0.3].forEach((side, k) => {   // tiny brief sparks where the two poles meet the wires, only while moving
      const tip = [xy[0] + f[0] * -5.4 + l[0] * side, xy[1] + f[1] * -5.4 + l[1] * side];
      const p = moving ? project(v, tip, 5.6, offX) : null;
      const on = p && hash01(n * 7.13 + k * 3.7 + salt) < 0.28;
      gg.sparks[k].style.display = on ? '' : 'none';
      if (on) gg.sparks[k].setAttribute('transform', `translate(${p[0].toFixed(1)},${p[1].toFixed(1)})`);
    });
  }
  const GG = { trolley: glowGroup(0.42), ghosts: FILM.ghosts.map(() => glowGroup(0.5)) };
  // a soft pulse around today's rider (and the matching tally pip) as each 1938 car passes them
  const pulse = el('circle', { r: 40, cy: -22, fill: 'none', stroke: '#FFE7A8', 'stroke-width': 4 });
  pulse.style.display = 'none';  const GL = FILM.ghosts.map((_, i) => { const t = el('text', { class: 'plabel', 'text-anchor': 'start' }); t.textContent = i === 0 ? K.ghostFirst : K.ghostOther; t.style.fill = '#FFE7A8'; return t; });

  // mini-maps: the whole route, north up, one per half (no camera pull-back needed for context)
  const allPts = [...paths.HIST.pts, ...paths.BUS.pts, ...paths.WALK1.pts, ...paths.WALK2.pts];
  const mm = { minX: Math.min(...allPts.map((p) => p[0])), maxX: Math.max(...allPts.map((p) => p[0])), minY: Math.min(...allPts.map((p) => p[1])), maxY: Math.max(...allPts.map((p) => p[1])) };
  const MMH = 330, MMPAD = 16, MMK = (MMH - 2 * MMPAD) / (mm.maxY - mm.minY), MMW = Math.ceil((mm.maxX - mm.minX) * MMK) + 2 * MMPAD + 24;
  function miniMap(x0, y0) {
    const g = el('g', { class: 'mm' });
    el('rect', { x: x0, y: y0, width: MMW, height: MMH, rx: 10, fill: 'rgba(23,18,31,0.85)' }, g);
    const P = (xy) => [x0 + 12 + MMPAD + (xy[0] - mm.minX) * MMK, y0 + MMPAD + (mm.maxY - xy[1]) * MMK];
    const line = (path, attrs) => el('polyline', { points: path.pts.map((p) => P(p).map((v) => v.toFixed(1)).join(',')).join(' '), fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...attrs }, g);
    const dot = (attrs) => el('circle', { r: 6, ...attrs }, g);
    return { g, P, line, dot };
  }
  const MM = {};
  if (VL) {
    const m = miniMap(28, 312); m.line(paths.HIST, { stroke: '#FFE7A8', 'stroke-width': 3 });
    const o = m.P(paths.HIST.at(0)), d = m.P(paths.HIST.at(paths.HIST.L));
    el('circle', { cx: o[0], cy: o[1], r: 7, fill: 'none', stroke: '#FFE7A8', 'stroke-width': 3 }, m.g);
    el('rect', { x: d[0] - 7, y: d[1] - 7, width: 14, height: 14, fill: '#FFE7A8' }, m.g);
    MM.left = { m, veh: m.dot({ fill: '#FFE7A8', stroke: '#17121F', 'stroke-width': 3, r: 8 }), rider: m.dot({ fill: '#ECE7F2', stroke: '#FFE7A8', 'stroke-width': 3, r: 5 }) };
  }
  if (VR) {
    const m = miniMap(988, 312);
    m.line(paths.HIST, { stroke: '#FFE7A8', 'stroke-width': 2, 'stroke-opacity': 0.4 });
    m.line(paths.WALK1, { stroke: '#F47C5A', 'stroke-width': 2.5, 'stroke-dasharray': '3 4' });
    m.line(paths.BUS, { stroke: '#F47C5A', 'stroke-width': 3 });
    m.line(paths.WALK2, { stroke: '#F47C5A', 'stroke-width': 2.5, 'stroke-dasharray': '3 4' });
    const o = m.P(paths.WALK1.at(0)), d = m.P(paths.WALK2.at(paths.WALK2.L));
    el('circle', { cx: o[0], cy: o[1], r: 7, fill: 'none', stroke: '#F47C5A', 'stroke-width': 3 }, m.g);
    el('rect', { x: d[0] - 7, y: d[1] - 7, width: 14, height: 14, fill: '#F47C5A' }, m.g);
    MM.right = { m, ghosts: FILM.ghosts.map(() => m.dot({ fill: '#FFE7A8', 'fill-opacity': 0.75, r: 5 })), veh: m.dot({ fill: '#F47C5A', stroke: '#17121F', 'stroke-width': 3, r: 8 }), rider: m.dot({ fill: '#ECE7F2', stroke: '#F47C5A', 'stroke-width': 3, r: 5 }) };
  }
  function mmDot(c, mmObj, xy, show) { if (!show || xy[0] < mm.minX - 20 || xy[0] > mm.maxX + 20 || xy[1] < mm.minY - 20 || xy[1] > mm.maxY + 20) { c.style.display = 'none'; return; } const p = mmObj.P(xy); c.style.display = ''; c.setAttribute('cx', p[0].toFixed(1)); c.setAttribute('cy', p[1].toFixed(1)); }
  const MK = { r1938: markerGroup('#FFE7A8'), rToday: markerGroup('#F47C5A') };
  const LB = {
    lOrigin: placeLabel(K.labelOrigin), lDest: placeLabel(K.labelDest),
    rOrigin: placeLabel(K.labelOrigin), rBoard: placeLabel(K.labelBoard), rAlight: placeLabel(K.labelAlight), rDest: placeLabel(K.labelDest),
  };
  // clip each half's markers to its half
  function clipHalf(p, half) { if (!p) return null; const lo = half ? 960 : 0; return p[0] > lo + 10 && p[0] < lo + 950 ? p : null; }

  function card(k) {
    const box = $('card');
    if (!box.dataset.built) {
      box.dataset.built = '1';
      const Y = FILM.y1938, T = FILM.today;
      const pxPerMin = 1440 / 46;
      const head = document.createElement('div'); head.className = 'head';
      head.innerHTML = `<span id="cardHead"></span><span class="sub" id="cardSub"></span>`;
      box.appendChild(head);
      $('cardHead').textContent = K.cardHead; $('cardSub').textContent = K.cardSub;
      const lanes = [
        { top: 520, name: K.name1938, color: '#FFE7A8', total: Y.total_min, shown: TL.cardRows.y1938, segs: [[K.seg.wait, Y.wait_min, 0.45], [K.seg.ride, Y.ride_min, 1]] },
        { top: 680, name: K.nameToday, color: '#F47C5A', total: T.total_min, shown: TL.cardRows.today, segs: [[K.seg.walk, T.walk1_min, 0.7], [K.seg.wait, T.wait_min, 0.45], [K.seg.ride, T.ride_min, 1], [K.seg.walk, T.walk2_min, 0.7]] },
      ];
      for (const L of lanes) {
        const bar = document.createElement('div'); bar.className = 'bar'; bar.style.top = L.top + 'px';
        bar.dataset.full = (L.total * pxPerMin).toFixed(1);
        const lane = document.createElement('div'); lane.className = 'lane'; lane.textContent = L.name; lane.style.color = L.color; bar.appendChild(lane);
        const segs = document.createElement('div'); segs.className = 'segs'; bar.appendChild(segs);
        const rgb = L.color === '#FFE7A8' ? '255,231,168' : '244,124,90';
        L.segs.forEach(([name, min], si) => {
          const label = L.shown.shown[si]; // sum-preserving display minutes (as in the app); width stays exact
          const s = document.createElement('div'); s.className = 'seg';
          s.style.width = (min * pxPerMin).toFixed(1) + 'px'; s.style.flex = 'none';
          if (name === K.seg.wait) { // waiting: striped, light text
            s.style.background = `repeating-linear-gradient(135deg, rgba(${rgb},0.42) 0 14px, rgba(${rgb},0.22) 14px 28px)`; s.style.color = '#ECE7F2';
          } else if (name === K.seg.walk) { s.style.background = `rgba(${rgb},0.7)`; }
          else { s.style.background = L.color; }
          s.textContent = min * pxPerMin > 70 ? `${name} ${label}` : `${label}`;
          segs.appendChild(s);
        });
        const tot = document.createElement('div'); tot.className = 'tot'; tot.style.color = L.color;
        tot.style.left = (L.total * pxPerMin + 24).toFixed(1) + 'px'; tot.textContent = K.total(L.shown.shownTotal); bar.appendChild(tot);
        box.appendChild(bar);
      }
      const foot = document.createElement('div'); foot.className = 'foot'; foot.textContent = K.cardFoot; box.appendChild(foot);
    }
    const u = Math.min(1, k / 30), e = u * u * (3 - 2 * u);
    for (const sg of box.querySelectorAll('.segs')) sg.style.clipPath = `inset(0 ${((1 - e) * 100).toFixed(2)}% 0 0)`;
    for (const t of box.querySelectorAll('.tot')) t.style.opacity = Math.min(1, Math.max(0, (k - 24) / 10)).toFixed(2);
    box.style.display = 'block';
  }

  function hud(s) {
    const W = s.watches, P = s.pos, T = FILM.today, Y = FILM.y1938;
    $('clockT').innerHTML = `${s.clock} <small>${K.scheduled}</small>`;
    const w1 = $('w1938'), w2 = $('wToday');
    w1.textContent = W.y1938.text; w1.classList.toggle('frozen', W.y1938.frozen);
    w2.textContent = W.today.text; w2.classList.toggle('frozen', W.today.frozen);
    const pz = s.pause;
    $('badge').textContent = pz ? (pz.kind === 'board' ? K.pauseBoard : K.pauseAlight) : K.badge;
    $('s1938').textContent = pz && pz.who === '1938' ? (pz.kind === 'board' ? K.stateBoarding : K.stateAlighting) : W.y1938.frozen ? K.arrived(W.y1938.text) : s.sched > Y.dep ? K.riding : s.establishing ? '' : K.waiting;
    const ph = P.riderToday.phase;
    $('sToday').textContent = pz && pz.who === 'today' ? (pz.kind === 'board' ? K.stateBoarding : K.stateAlighting) : W.today.frozen ? K.arrived(W.today.text) + ' ' + K.roundedNote : s.establishing ? '' : ph === 'walk' || ph === 'walk2' ? K.walking : ph === 'wait' ? K.waiting : K.onBus;
    $('tallyN').textContent = s.tally;
    // the count is final once the bus has arrived (the end card repeats it): fade the panel to free the final walk
    // boarding close-in (from 2 scheduled min before 10:32:43 to the end of the boarding hold): nothing covers the bus or rider
    const closeIn = s.sched >= T.dep - 200 && (s.sched < T.dep || (s.pause && s.pause.who === 'today' && s.pause.kind === 'board'));
    hud.closeIn = closeIn;
    $('tally').style.opacity = closeIn ? '0.3' : s.sched >= T.arr - 30 ? Math.max(0, 1 - (s.sched - (T.arr - 30)) / 30).toFixed(3) : '1';   // gone by the cut at 10:41:00
    // pass moments: each 1938 car passing today's rider (closest point of the route to stop 8564)
    const passAge = TL.PASSES.map((p) => s.sched - p);
    for (let i = 0; i < 4; i++) {
      const pip = $('p' + i); pip.classList.toggle('on', s.tally > i);
      const a = passAge[i], u = a >= 0 && a < 60 ? 1 - a / 60 : 0;   // 0.5 s pulse
      pip.style.transform = u ? `scale(${(1 + 0.5 * u).toFixed(3)})` : ''; pip.style.boxShadow = u ? `0 0 ${(12 + 18 * u).toFixed(0)}px #FFE7A8` : '';
    }
    // event banners, about 3 s each: the bus leaving stop 8564, then reaching stop 9486
    const ev = $('event'); const dDep = s.sched - T.dep, dArr = s.sched - T.arr, BAN = 360;
    const banner = dArr >= 0 && dArr < BAN && s.sched < T.finish ? [K.busArrives, dArr] : dDep >= 0 && dDep < BAN ? [K.busLeaves, dDep] : null;
    ev.textContent = banner ? banner[0] : ''; ev.style.opacity = banner ? Math.min(1, (BAN - banner[1]) / 30).toFixed(3) : 0;
    // rules card during the establishing shot
    const ro = s.f < 0.3 ? s.f / 0.3 : s.f < TL.EST - 0.5 ? 1 : Math.max(0, (TL.EST - s.f) / 0.5);
    $('rules').style.opacity = ro.toFixed(3);
    // ground rings under the vehicles
    setRing(RG.trolley, VL, 0, 0, P.trolley.visible ? P.trolley.xy : null, P.trolley.heading, 9, 5);
    setRing(RG.bus, VR, 960, 1, P.bus.visible ? P.bus.xy : null, P.bus.heading, 10, 5);
    const shimmer = 1 + 0.03 * Math.sin(2 * Math.PI * s.f);       // ~3% at 1 Hz, deterministic
    setGlow(GG.trolley, VL, 0, 0, P.trolley.visible ? P.trolley.xy : null, P.trolley.heading, P.trolley.moving, s.n, 0, shimmer);
    P.ghosts.forEach((g, i) => {
      setRing(RG.ghosts[i], VR, 960, 1, g.visible ? g.xy : null, g.heading, 9, 5);
      setTrail(TR[i], i, s.sched);
      setGlow(GG.ghosts[i], VR, 960, 1, g.visible ? g.xy : null, g.heading, g.visible, s.n, i + 1, shimmer);
      // label each car from the corner until about 1 s after it passes the rider, kept inside the frame
      let q = null;
      if (s.sched >= g.dep && passAge[i] < 120) {
        const pr = project(VR, TL.positionAt(Math.min(s.sched, TL.PASSES[i] + 30)).ghosts[i].xy, 0, 960);
        if (pr) q = [Math.min(1500, Math.max(1100, pr[0] + 30)), Math.min(880, Math.max(330, pr[1] + 10))]; // right of the car, clear of the rider's labels
      }
      setLabel(GL[i], q, 0, 900);
    });
    // mini-maps
    if (MM.left) { mmDot(MM.left.veh, MM.left.m, P.trolley.xy, P.trolley.visible); mmDot(MM.left.rider, MM.left.m, P.rider1938.xy, P.rider1938.visible); }
    if (MM.right) { P.ghosts.forEach((g, i) => mmDot(MM.right.ghosts[i], MM.right.m, g.xy, g.visible)); mmDot(MM.right.veh, MM.right.m, P.bus.xy, P.bus.visible); mmDot(MM.right.rider, MM.right.m, P.riderToday.xy, P.riderToday.visible); }
    // the riders, as people
    const r1 = P.rider1938, rt = P.riderToday;
    const r1wait = !r1.arrived && !r1.phase;
    setMarker(MK.r1938, r1.visible && !s.establishing ? clipHalf(project(VL, r1.xy, 0, 0), 0) : null, r1.waitFrac, r1.arrived ? K.rider1938Short : K.rider1938, r1wait ? K.waitTrolley : '', r1wait, r1.alpha);
    const rtP = rt.visible && !s.establishing ? clipHalf(project(VR, rt.xy, 0, 960), 1) : null;
    setMarker(MK.rToday, rtP, rt.waitFrac, K.riderToday, hud.closeIn ? '' : ph === 'wait' ? K.waitBus : ph === 'walk' ? K.walk1 : ph === 'walk2' ? K.walk2 : '', ph === 'wait', rt.alpha, hud.closeIn);
    // walking from the corner the rider is near the top-right panels: let the caption run to the left
    // the rider's caption runs to the LEFT, so passing-car labels (to the right of the route) never collide with it
    MK.rToday.cap.setAttribute('text-anchor', 'end'); MK.rToday.cap.setAttribute('x', 30);
    const pa = passAge.find((a) => a >= 0 && a < 60);
    if (rtP && pa !== undefined) { const u = pa / 60; pulse.style.display = ''; pulse.setAttribute('transform', `translate(${rtP[0].toFixed(1)},${rtP[1].toFixed(1)})`); pulse.setAttribute('r', (40 + 46 * u).toFixed(1)); pulse.setAttribute('stroke-opacity', (0.9 * (1 - u)).toFixed(3)); } else pulse.style.display = 'none';
    const G = FILM.geo, toXY = TL.toXY;
    hud.hidePlaces = s.f < EST_HIDE;    // the rules card is up: keep place labels from peeking out behind it
    setLabel(LB.lOrigin, s.sched < Y.dep ? clipHalf(project(VL, toXY(G.origin), 0, 0), 0) : null, r1.visible ? -112 : -40);
    setLabel(LB.lDest, s.sched > Y.dep + 300 ? clipHalf(project(VL, toXY(G.dest), 0, 0), 0) : null, s.sched >= Y.arr - 30 ? -150 : -48);
    setLabel(LB.rOrigin, clipHalf(project(VR, toXY(G.origin), 0, 960), 1), s.sched < T.at_stop - 20 ? -112 : -40);
    setLabel(LB.rBoard, s.sched < T.dep + 60 ? clipHalf(project(VR, toXY(G.board), 0, 960), 1) : null, hud.closeIn ? 118 : s.sched >= T.at_stop - 60 && s.sched < T.dep ? -112 : -40, 940);
    setLabel(LB.rAlight, s.sched > T.dep + 240 ? clipHalf(project(VR, toXY(G.alight), 0, 960), 1) : null, s.sched >= T.arr && s.sched < T.arr + 40 ? -112 : -40);
    setLabel(LB.rDest, s.sched > T.arr - 60 ? clipHalf(project(VR, toXY(G.dest), 0, 960), 1) : null, s.sched >= T.finish - 40 ? -112 : -40);
    // keep the caption strip just above the attribution, whatever its height
    const bottoms = viewers.map((v) => v.bottomContainer.getBoundingClientRect().height);
    $('caption').style.bottom = Math.max(46, Math.ceil(Math.max(...bottoms)) + 12) + 'px';
  }

  // ---------------------------------------------------------------- frame
  function placeAll(s) {
    const P = s.pos;
    // vehicles ride 12 cm above the sampled street so the mesh never swallows the tyres
    M.trolley.show = M.shTrolley.show = P.trolley.visible;
    if (P.trolley.visible) { placeModel(M.trolley, P.trolley.xy, P.trolley.heading, 0.12); placeModel(M.shTrolley, P.trolley.xy, P.trolley.heading, 0.06); }
    P.ghosts.forEach((g, i) => { M.ghosts[i].show = M.shGhosts[i].show = g.visible; if (g.visible) { placeModel(M.ghosts[i], g.xy, g.heading, 0.12); placeModel(M.shGhosts[i], g.xy, g.heading, 0.06); } });
    M.bus.show = M.shBus.show = P.bus.visible;
    if (P.bus.visible) { placeModel(M.bus, P.bus.xy, P.bus.heading, 0.12); placeModel(M.shBus, P.bus.xy, P.bus.heading, 0.06); }
  }

  window.renderFrame = async function (n, opts = {}) {
    const s = opts.sched !== undefined ? stateAtSched(opts.sched) : TL.frameState(n);
    if (s.card) {
      $('halves').style.visibility = 'hidden'; $('hud').style.display = 'none'; $('divider').style.display = 'none';
      card(n - TL.TILE_FRAMES);
      return { n, card: true, ms: 0 };
    }
    $('card').style.display = 'none'; $('halves').style.visibility = 'visible'; $('hud').style.display = ''; $('divider').style.display = '';
    placeAll(s);
    setCam(VL, s.camLeft); setCam(VR, s.camRight);
    let st = await settle(opts.maxMs || 90000);
    // never inside a roof or a tree: back the camera out (same angle) until it clears the mesh by 12 m
    let clamp = 1;
    for (const v of viewers) {
      const cam = v === VL ? s.camLeft : s.camRight;
      while (cameraClearance(v) < 12 && clamp < 2) { clamp *= 1.12; setCam(v, { ...cam, rangeScale: clamp }); v.render(); }
    }
    if (clamp > 1) st = await settle(opts.maxMs || 90000);
    hud(s);
    for (const v of viewers) v.render();
    return { n, sched: s.sched, clock: s.clock, tally: s.tally, ...st, clamp: +clamp.toFixed(3), clearance: viewers.map((v) => +cameraClearance(v).toFixed(1)), detail: viewers.map(detail), vehicle: VL ? (s.pos.trolley.visible ? vehicleRegion(VL, s.pos.trolley.xy) : null) : (s.pos.bus.visible && s.pos.bus.moving ? vehicleRegion(VR, s.pos.bus.xy) : null), rider: VR && /walk/.test(s.pos.riderToday.phase) ? vehicleRegion(VR, s.pos.riderToday.xy) : null, credits: creditInfo() };
  };
  // attribution audit: what each viewer's credit strip shows, and whether any overlay covers it
  function creditInfo() {
    const visible = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === 'none' || +cs.opacity === 0) return false; } return true; };
    const hudRects = [...document.querySelectorAll('#hud .panel, #hud svg text, #hud svg circle')].filter(visible)
      .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    return viewers.map((v) => {
      const b = v.bottomContainer.getBoundingClientRect();
      const imgs = [...v.bottomContainer.querySelectorAll('img')].filter((i) => i.offsetParent !== null);
      const covered = hudRects.some((r) => r.bottom > b.top + 1 && r.top < b.bottom && r.right > b.left && r.left < b.right);
      return { text: v.bottomContainer.innerText.replace(/\s+/g, ' ').trim().slice(0, 300), logos: imgs.map((i) => (i.alt || i.src.split('/').pop()).slice(0, 60) + (i.complete && i.naturalWidth > 0 ? '' : ' (NOT LOADED)')), top: Math.round(b.top), covered };
    });
  }
  // palette and wording audit over the overlays
  window.__audit = function () {
    const PAL = ['255,231,168', '244,124,90', '236,231,242', '23,18,31'];
    const seen = new Set(), off = [];
    const els = [...document.querySelectorAll('#hud *, #card *, #hud, #card')];
    const grab = (str, where) => { for (const m of String(str).matchAll(/rgba?\(([^)]+)\)/g)) { const p = m[1].split(',').map((x) => x.trim()); const a = p[3] === undefined ? 1 : +p[3]; if (a === 0) continue; const k = p.slice(0, 3).map((x) => Math.round(+x)).join(','); seen.add(k); if (!PAL.includes(k)) off.push(where + ': rgb(' + k + ')'); } };
    for (const e of els) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none') continue;
      for (const prop of ['color', 'background-color', 'background-image', 'border-top-color', 'fill', 'stroke', 'box-shadow', 'text-shadow']) {
        const val = cs.getPropertyValue(prop);
        if (prop.startsWith('border') && cs.borderTopWidth === '0px') continue;
        if ((prop === 'fill' || prop === 'stroke') && !/^(circle|ellipse|polygon|polyline|path|rect|line|text)$/i.test(e.tagName)) continue; // only elements that draw
        if (prop === 'stroke' && val === 'none') continue;
        grab(val, (e.id || e.className.baseVal || e.className || e.tagName) + ' ' + prop);
      }
    }
    const text = [document.getElementById('hud').innerText, document.getElementById('card').innerText, JSON.stringify(window.COPY, (k, v) => (typeof v === 'function' ? v('00:00') : v))].join(' ');
    const banned = [...text.matchAll(/\b(live|now|real-time|realtime|citywide)\b/gi)].map((m) => m[0]);
    return { colours: [...seen], offPalette: [...new Set(off)], banned };
  };
  // still at an exact scheduled time (for key-moment stills)
  function stateAtSched(sched) { const f = TL.filmAt(sched); const s = TL.frameState(f * TL.FPS); return s; }

  // ---------------------------------------------------------------- test camera (go/no-go): look down Caroline St from a height
  window.testView = async function (alt, which = 'both', sAlong = 600) {
    const xy = paths.HIST.at(sAlong);
    const hd = TL.bearing(paths.HIST.tangent(sAlong, 150));
    const pitch = -35, range = alt / Math.sin(-pitch * rad);
    for (const v of viewers) setCam(v, { lonlat: TL.toLL(xy), xy, heading: hd, pitch, range });
    placeAll(TL.frameState(0));
    const st = await settle(120000);
    hud(TL.frameState(0));
    for (const v of viewers) v.render();
    return st;
  };

  // ---------------------------------------------------------------- init
  for (let i = 0; i < 400 && !allModels.every((m) => m.ready); i++) { for (const v of viewers) v.render(); await sleep(20); }
  setCam(VL, TL.camLeft(0)); setCam(VR, TL.camRight(0));
  log('models ready; sampling heights');
  await sampleHeights();
  addWire(VL); addWire(VR); addBusLane(VR);
  window.TL = TL;
  window.__dbg = { tilesets, allModels, viewers, M };
  window.__heights = () => samplePts.map((p) => ({ xy: p.xy, h: p.h, raw: p.raw }));
  window.__ready = true;
  log('ready', NOTILES ? '(no tiles)' : '(google tiles)', 'frames', TL.TOTAL_FRAMES);
})().catch((e) => { window.__error = String(e && e.stack || e); console.error(e); });
