// Sound events in film seconds, from the same pure timeline as the picture (and matching qa/cues.json).
// node scripts/sfx-events.mjs  -> qa/sfx-events.json
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
const Y = FILM.y1938, T = FILM.today;
const r3 = (x) => +x.toFixed(3);

// the bus is audible while it is on screen and moving: from 20 scheduled s before it stops at 8564
// (when it enters the wide shot along Biddle St), and from the end of the boarding hold to 9486
const busOn = [[TL.filmAt(T.dep - 20), TL.filmAt(T.dep)], [TL.filmAt(T.dep) + TL.holdD(T.dep), TL.filmAt(T.arr)]];
const ev = {
  duration_s: r3(TL.TOTAL_FRAMES / TL.FPS),
  tile_end_s: r3(TL.TILE_FRAMES / TL.FPS),
  bells: TL.PASSES.map((p, i) => ({ t: r3(TL.filmAt(p)), what: `1938 car ${i + 1} of 4 passes today's rider` })),
  chimes: TL.PAUSES.map((p) => ({ t: r3(TL.filmAt(p.t)), d: p.d, what: `${p.who} ${p.kind}` })),
  hum: { from: r3(TL.filmAt(Y.dep) + TL.holdD(Y.dep)), to: r3(TL.filmAt(Y.arr)), what: '1938 trolley riding' },
  rumble: busOn.map(([a, b]) => ({ from: r3(a), to: r3(b) })),
  ticks: { from: r3(TL.filmAt(T.at_stop)), to: r3(TL.filmAt(T.dep)), every_s: 1.0, what: "today's wait" },
  hush_before_freeze: { from: r3(TL.filmAt(Y.arr) - 0.4), to: r3(TL.filmAt(Y.arr)) },
  freeze_bell: { t: r3(TL.filmAt(Y.arr)), what: '1938 stopwatch freezes at 15:00' },
};
fs.writeFileSync(path.join(ROOT, 'qa/sfx-events.json'), JSON.stringify(ev, null, 2));
console.log(JSON.stringify(ev));
