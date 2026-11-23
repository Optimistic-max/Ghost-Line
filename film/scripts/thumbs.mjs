// YouTube thumbnail options, 1280x720 JPEG (< 2 MB), from film frames + Barlow Condensed text.
// Tile-based thumbnails keep Cesium's own Google / Cesium credit strip from the frame, uncovered.
// node scripts/thumbs.mjs   (needs: node scripts/capture.mjs stills --clean --times=10:21:26,10:08:48)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'page/film-data.js'), 'utf8'), ctx);
const FILM = ctx.window.FILM;
const TL = require(path.join(ROOT, 'page/timeline.js')).make(FILM);
const b64 = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(ROOT, f)).toString('base64');
const font = 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'page/barlow.woff2')).toString('base64');
fs.mkdirSync(path.join(ROOT, 'thumbs'), { recursive: true });

const base = `@font-face{font-family:B;font-weight:600;src:url(${font}) format('woff2')}
*{margin:0;box-sizing:border-box} html,body{width:1280px;height:720px;overflow:hidden;background:#17121F;font-family:B,sans-serif;font-weight:600;color:#ECE7F2}
.h{position:absolute;left:0;right:0;text-align:center;font-size:104px;line-height:1;color:#FFE7A8;text-shadow:0 4px 18px rgba(23,18,31,.9),0 0 3px rgba(23,18,31,.9)}
.promo{position:absolute;right:14px;bottom:44px;font-size:22px;color:#ECE7F2;background:rgba(23,18,31,.85);padding:3px 10px;border-radius:6px}`;

const card = TL.cardRows;
const Y = FILM.y1938, T = FILM.today, px = 900 / 46;
const seg = (name, min, shown, rgb, kind) => `<div style="width:${(min * px).toFixed(1)}px;height:100%;display:flex;align-items:center;justify-content:center;font-size:30px;border-right:4px solid #17121F;${kind === 'wait' ? `background:repeating-linear-gradient(135deg,rgba(${rgb},.45) 0 16px,rgba(${rgb},.22) 16px 32px);color:#ECE7F2` : kind === 'walk' ? `background:rgba(${rgb},.7);color:#17121F` : `background:rgb(${rgb});color:#17121F`}">${min * px > 70 ? name + ' ' : ''}${shown}</div>`;
const bars = `<div style="position:absolute;left:120px;top:330px;height:110px;display:flex">${seg('wait', Y.wait_min, card.y1938.shown[0], '255,231,168', 'wait')}${seg('ride', Y.ride_min, card.y1938.shown[1], '255,231,168', 'ride')}</div>
<div style="position:absolute;left:20px;top:360px;width:90px;text-align:right;font-size:44px;color:#FFE7A8">1938</div>
<div style="position:absolute;left:${120 + Y.total_min * px + 22}px;top:352px;font-size:60px;white-space:nowrap;color:#FFE7A8">${card.y1938.shownTotal} min</div>
<div style="position:absolute;left:120px;top:490px;height:110px;display:flex">${seg('walk', T.walk1_min, card.today.shown[0], '244,124,90', 'walk')}${seg('wait', T.wait_min, card.today.shown[1], '244,124,90', 'wait')}${seg('ride', T.ride_min, card.today.shown[2], '244,124,90', 'ride')}${seg('walk', T.walk2_min, card.today.shown[3], '244,124,90', 'walk')}</div>
<div style="position:absolute;left:0px;top:520px;width:110px;text-align:right;font-size:44px;color:#F47C5A">Today</div>
<div style="position:absolute;left:${120 + T.total_min * px + 22}px;top:512px;font-size:60px;white-space:nowrap;color:#F47C5A">${card.today.shownTotal} min</div>`;

const thumbs = [
  // Main (was option A): the split at a ghost pass: the parked 1938 trolley (left) and today's rider waiting as a
  // 1938 car passes (right), under the app's own headline
  { name: 'thumb-main', html: `<img src="${b64('stills/clean-review-102126.jpg')}" style="position:absolute;left:0;top:0;width:1280px;height:720px">
     <div style="position:absolute;left:0;right:0;top:0;height:200px;background:linear-gradient(rgba(23,18,31,.85),rgba(23,18,31,0))"></div>
     <div class="h" style="top:34px">Same ride, longer wait.</div>
     <div style="position:absolute;left:24px;top:150px;font-size:46px;color:#FFE7A8;text-shadow:0 2px 10px #17121F">1938</div>
     <div style="position:absolute;right:24px;top:150px;font-size:46px;color:#F47C5A;text-shadow:0 2px 10px #17121F">Today</div>
     <div class="promo">For promotional purposes only</div>` },
  // Backup (option B): the end-card bars (pure graphic, no map imagery, no attribution needed)
  { name: 'thumb-b-15-vs-45', html: `<div class="h" style="top:70px;font-size:150px">15 min vs 45 min.</div>
     <div style="position:absolute;left:0;right:0;top:238px;text-align:center;font-size:40px;color:#ECE7F2">Baltimore, scheduled times</div>${bars}` },
  // (option C, "4 trolleys before your bus", was dropped in review)
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
for (const t of thumbs) {
  await page.setContent(`<!doctype html><html><head><style>${base}</style></head><body>${t.html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(ROOT, 'thumbs', t.name + '.jpg');
  await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
  console.log(t.name, (fs.statSync(out).size / 1024).toFixed(0), 'KB');
}
await browser.close();
