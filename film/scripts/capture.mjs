// Drives the capture page in headed Chrome (GPU via ANGLE/D3D11) and screenshots frames.
// Two pages, one Cesium viewer each (?side=left | ?side=right): each page draws the full HUD,
// we clip its own half, and ffmpeg hstacks the halves. (Two viewers in one page share Cesium's
// GPU resource cache across WebGL contexts and break.)
//
// node scripts/capture.mjs test                 -> day-1 go/no-go stills at 60/100/150 m
// node scripts/capture.mjs stills [--only=a,b]  -> key-moment stills (stills\*.jpg)
// node scripts/capture.mjs frames [from] [to]   -> frames\L\%05d.jpg + frames\R\%05d.jpg (resumes)
// node scripts/capture.mjs eval "<js>"          -> run JS in the left page
// Options: --notiles  --mse=8  --settle=4
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { start } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith('--' + k)); if (!a) return d; const v = a.split('=')[1]; return v === undefined ? true : v; };
const pos = args.filter((a) => !a.startsWith('--'));
const mode = pos[0] || 'stills';
const NOTILES = !!flag('notiles', false);
const PORT = 8765 + Math.floor(Math.random() * 200);
fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true });
const LOG = path.join(ROOT, 'logs', `capture-${mode}.log`);
const redact = (s) => String(s).replace(/([?&](key|session|access_token)=)[^&\s"']+/gi, '$1REDACTED');
const log = (...a) => { const line = redact(`[${new Date().toISOString()}] ` + a.join(' ')); console.log(line); fs.appendFileSync(LOG, line + '\n'); };

let token = null;
if (!NOTILES) {
  const tf = path.join(ROOT, 'cesium-token.txt');
  if (!fs.existsSync(tf)) { console.error('cesium-token.txt missing (run with --notiles for layout work)'); process.exit(2); }
  token = fs.readFileSync(tf, 'utf8').trim();
}

const srv = await start(PORT);
const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--disable-quic', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--window-size=1920,1080', '--window-position=0,0'],
});

async function openPage(side) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { const t = m.text(); if (!/token|GL_INVALID|too many errors/i.test(t)) fs.appendFileSync(LOG, redact(`  [${side}] ` + t.slice(0, 400)) + '\n'); });
  page.on('pageerror', (e) => log('PAGE ERROR', side, String(e.stack || e).slice(0, 1500)));
  if (token) await page.addInitScript((t) => { window.__ION = t; }, token);
  const q = new URLSearchParams({ side });
  if (NOTILES) q.set('notiles', '1');
  if (flag('mse')) q.set('mse', flag('mse'));
  if (flag('settle')) q.set('settle', flag('settle'));
  if (flag('look')) q.set('look', flag('look'));
  if (flag('clean')) q.set('clean', '1');
  await page.goto(`http://127.0.0.1:${PORT}/page/index.html?${q}`);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 900000 });
  const err = await page.evaluate(() => window.__error);
  if (err) { log('INIT ERROR', side, err); await browser.close(); srv.close(); process.exit(1); }
  return page;
}
log('open', NOTILES ? 'notiles' : 'tiles', 'mode', mode);
// pages run one at a time: two live Cesium pages starve each other's tile loading
const LCLIP = { x: 0, y: 0, width: 960, height: 1080 }, RCLIP = { x: 960, y: 0, width: 960, height: 1080 };
const CLIP = { left: LCLIP, right: RCLIP };
const hstack = (a, b, out) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', a, '-i', b, '-filter_complex', 'hstack', '-q:v', '2', out]);
const sides = flag('side') ? [flag('side')] : ['left', 'right'];
let info = null;
async function withPage(side, fn) {
  const page = await openPage(side);
  if (!info) {
    const gl = await page.evaluate(() => { const c = document.querySelector('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
    log('renderer', gl);
    info = await page.evaluate(() => ({ total: TL.TOTAL_FRAMES, tiles: TL.TILE_FRAMES, fps: TL.FPS, dep: FILM.today.dep, arr: FILM.today.arr, fin: FILM.today.finish, at: FILM.today.at_stop }));
  }
  try { return await fn(page); } finally { await page.context().close(); }
}
// render a frame; if its tiles didn't finish loading in time, render it again (tiles keep loading), up to twice
const call = async ([k, s]) => { let r; for (let i = 0; i < 3; i++) { r = await window.renderFrame(k, s !== undefined ? { sched: s } : {}); if (!r.timeout) break; r.retries = i + 1; } return r; };

if (mode === 'eval') {
  await withPage('left', async (PL) => {
    const r = await PL.evaluate(async (code) => { const f = new Function('return (async () => {' + code + '})()'); return await f(); }, pos.slice(1).join(' '));
    console.log(JSON.stringify(r, null, 1));
  });
} else if (mode === 'test') {
  const dir = path.join(ROOT, 'stills', 'go-no-go');
  fs.mkdirSync(dir, { recursive: true });
  await withPage('left', async (PL) => {
    for (const alt of [60, 100, 150]) for (const s of [300, 1300, 2300]) {
      const f = path.join(dir, `caroline-${alt}m-s${s}.jpg`);
      const r = await PL.evaluate(([a, ss]) => window.testView(a, 'both', ss), [alt, s]);
      await PL.screenshot({ path: f, type: 'jpeg', quality: 92, clip: LCLIP });
      log('test', alt, 'm at', s, 'm along:', JSON.stringify(r));
    }
  });
} else if (mode === 'stills') {
  const dir = path.join(ROOT, 'stills'), tmp = path.join(ROOT, 'frames', 'tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const hms = (h, m, s = 0) => h * 3600 + m * 60 + s;
  const only = flag('only');
  const names = [];
  for (const side of ['left', 'right']) {
    await withPage(side, async (pg) => {
      const list = [];
      for (let sec = 0; sec <= Math.floor(info.tiles / info.fps); sec++) list.push([`sec${String(sec).padStart(2, '0')}`, Math.min(sec * info.fps, info.tiles - 1), undefined]);
      const keys = [['1006-trolley-leaves', hms(10, 6)], ['1013-car2', hms(10, 13)], ['1015-trolley-arrives', hms(10, 15)], ['1021-car3', hms(10, 21)], ['1028-car4', hms(10, 28)],
        ['103243-bus-leaves', info.dep], ['1041-bus-arrives', info.arr], ['finish', info.fin], ['rider-at-stop', info.at]];
      for (const [k, s] of keys) list.push([k, 0, s]);
      list.push(['card', info.tiles + 60, undefined]);
      if (flag('frameset')) { list.length = 0; for (const n of String(flag('frameset')).split(',')) list.push([`frame-${String(n).padStart(4, '0')}`, +n, undefined]); }
      if (flag('times')) { // review set at exact scheduled times, e.g. --times=10:00,10:21:20,finish
        list.length = 0;
        for (const tm of String(flag('times')).split(',')) {
          if (tm === 'finish') { list.push(['review-finish', 0, info.fin]); continue; }
          const [h, m, s = 0] = tm.split(':').map(Number);
          list.push([`review-${tm.replace(/:/g, '')}`, 0, hms(h, m, s)]);
        }
      }
      for (const [name, n, sched] of list) {
        if (only && !String(only).split(',').includes(name)) continue;
        const isCard = n >= info.tiles && sched === undefined;
        if (isCard && side === 'right') continue;
        const r = await pg.evaluate(call, [n, sched]);
        await pg.screenshot({ path: path.join(tmp, `${name}-${side}.jpg`), type: 'jpeg', quality: 92, clip: CLIP[side] });
        if (isCard) await pg.screenshot({ path: path.join(tmp, `${name}-right.jpg`), type: 'jpeg', quality: 92, clip: RCLIP });
        if (side === 'left') names.push(name);
        log('still', side, name, JSON.stringify({ clock: r.clock, ms: r.ms, renders: r.renders, timeout: r.timeout }));
      }
    });
  }
  for (const name of names) hstack(path.join(tmp, `${name}-left.jpg`), path.join(tmp, `${name}-right.jpg`), path.join(dir, (NOTILES ? 'notiles-' : '') + (flag('look') ? flag('look') + '-' : '') + (flag('clean') ? 'clean-' : '') + name + '.jpg'));
  log('stills joined', names.length);
} else if (mode === 'audit') {
  // re-run the overlay palette/wording audit on every 30th frame (and one card frame)
  for (const side of sides) await withPage(side, async (pg) => {
    const out = path.join(ROOT, 'logs', `audit-${side}.jsonl`); fs.writeFileSync(out, '');
    for (let n = 0; n < info.total; n++) {
      if (!(n % 30 === 0 || n === info.tiles + 40) || (side === 'right' && n >= info.tiles)) continue;
      await pg.evaluate(call, [n, undefined]);
      const a = await pg.evaluate(() => window.__audit());
      fs.appendFileSync(out, JSON.stringify({ n, side, audit: a }) + '\n');
    }
    log('audit', side, 'done');
  });
} else if (mode === 'frames') {
  for (const side of sides) {
    await withPage(side, async (pg) => {
      const from = +(pos[1] ?? 0), to = +(pos[2] ?? info.total - 1);
      const dirL = path.join(ROOT, 'frames', 'L'), dirR = path.join(ROOT, 'frames', 'R');
      fs.mkdirSync(dirL, { recursive: true }); fs.mkdirSync(dirR, { recursive: true });
      const own = side === 'left' ? dirL : dirR;
      const t0 = Date.now(); let done = 0, timeouts = 0;
      for (let n = from; n <= to; n++) {
        const isCard = n >= info.tiles;
        if (isCard && side === 'right') continue;
        const name = String(n).padStart(5, '0') + '.jpg';
        const f = path.join(own, name);
        if (fs.existsSync(f) && fs.statSync(f).size > 8000 && (!isCard || fs.existsSync(path.join(dirR, name)))) continue;
        const r = await pg.evaluate(call, [n, undefined]);
        await pg.screenshot({ path: f, type: 'jpeg', quality: 92, clip: CLIP[side] });
        if (isCard) await pg.screenshot({ path: path.join(dirR, name), type: 'jpeg', quality: 92, clip: RCLIP });
        const rec = { n, side, card: isCard, clock: r.clock, timeout: !!r.timeout, ms: r.ms, renders: r.renders, clamp: r.clamp, clearance: r.clearance && r.clearance[0], detail: r.detail && r.detail[0], vehicle: r.vehicle, rider: r.rider, credits: isCard ? null : r.credits };
        if (n % 30 === 0 || n === info.tiles + 40) rec.audit = await pg.evaluate(() => window.__audit());
        fs.appendFileSync(path.join(ROOT, 'logs', `frames-${side}.jsonl`), JSON.stringify(rec) + '\n');
        done++; if (rec.timeout) timeouts++;
        const el = (Date.now() - t0) / 1000;
        log(`${side} frame ${n} ${isCard ? 'card' : r.clock} ms=${r.ms ?? 0} renders=${r.renders ?? 0}${rec.timeout ? ' TIMEOUT' : ''} | ${done} done, ${(el / done).toFixed(1)} s/frame, eta ${((to - n) * el / done / 60).toFixed(0)} min`);
      }
      log(side, 'frames done', done, 'timeouts', timeouts, 'elapsed', ((Date.now() - t0) / 60000).toFixed(1), 'min');
    });
  }
}await browser.close();
srv.close();
