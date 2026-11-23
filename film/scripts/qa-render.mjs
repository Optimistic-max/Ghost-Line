// Render QA: reads logs/frames.jsonl (written by capture.mjs frames), checks credits on every
// tile frame, overlay palette and banned words, makes a contact sheet of every 30th frame's
// attribution strip for a human look, and merges results into qa/timing.json.
// node scripts/qa-render.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// merge the two per-side logs: one record per frame, credits from both halves
const read = (s) => { const f = path.join(ROOT, `logs/frames-${s}.jsonl`); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []; };
const L = new Map(), R = new Map();
for (const r of read('left')) L.set(r.n, r); for (const r of read('right')) R.set(r.n, r);
const recs = [...L.keys()].sort((a, b) => a - b).map((n) => {
  const l = L.get(n), r = R.get(n);
  if (l.card) return { ...l };
  const audit = l.audit || r?.audit ? { colours: [...new Set([...(l.audit?.colours || []), ...(r?.audit?.colours || [])])], offPalette: [...(l.audit?.offPalette || []), ...(r?.audit?.offPalette || [])], banned: [...(l.audit?.banned || []), ...(r?.audit?.banned || [])] } : undefined;
  return { n, card: false, timeout: l.timeout || !r || r.timeout, missingRight: !r, credits: r ? [...l.credits, ...r.credits] : null, audit };
});
const tiles = recs.filter((r) => !r.card), cards = recs.filter((r) => r.card);
const checks = [];
const add = (name, pass, detail = {}) => checks.push({ name, pass: !!pass, ...detail });

const noGoogle = tiles.filter((r) => !r.credits || r.credits.some((c) => !/google/i.test(c.text + ' ' + c.logos.join(' '))));
const notLoaded = tiles.filter((r) => r.credits && r.credits.some((c) => c.logos.some((l) => /NOT LOADED/.test(l))));
const covered = tiles.filter((r) => r.credits && r.credits.some((c) => c.covered));
const timeouts = tiles.filter((r) => r.timeout);
add('Google attribution present in both halves of every tile frame (DOM check)', noGoogle.length === 0 && notLoaded.length === 0, { tile_frames: tiles.length, missing: noGoogle.map((r) => r.n).slice(0, 50), logos_not_loaded: notLoaded.map((r) => r.n).slice(0, 50), sample: tiles[0] && tiles[0].credits });
add('No overlay covers the attribution strip', covered.length === 0, { covered_frames: covered.map((r) => r.n).slice(0, 50) });
add('Every tile frame settled (no load timeout)', timeouts.length === 0, { timeouts: timeouts.map((r) => r.n) });
add('Frame count', tiles.length + cards.length === recs.length && recs.length === recs.at(-1).n + 1, { frames: recs.length, tile_frames: tiles.length, card_frames: cards.length });

// tile detail per half: mean absolute luminance gradient of the 3D canvas; blank or half-loaded frames score low
const lowDetail = [];
const detailStats = {};
for (const [side, map] of [['left', L], ['right', R]]) {
  const rows = [...map.values()].filter((r) => !r.card && r.detail);
  const g = rows.map((r) => r.detail.grad).sort((a, b) => a - b);
  const med = g[Math.floor(g.length / 2)] || 0;
  detailStats[side] = { frames: rows.length, median_grad: med, min_grad: g[0], min_std: Math.min(...rows.map((r) => r.detail.std)) };
  for (const r of rows) if (r.detail.grad < 0.45 * med || r.detail.std < 12) lowDetail.push({ side, n: r.n, ...r.detail });
}
add('Tile detail: no half is blank or blurry (gradient >= 45% of its median, contrast std >= 12)', lowDetail.length === 0 && Object.values(detailStats).every((s) => s.frames > 0), { stats: detailStats, flagged: lowDetail.slice(0, 40) });
// the 60 x 40 px around the moving vehicle must not be a dark melted-mesh smear (dark AND flat)
const smears = [...L.values(), ...R.values()].filter((r) => !r.card && r.vehicle && r.vehicle.mean < 45 && r.vehicle.std < 12).map((r) => ({ side: r.side, n: r.n, ...r.vehicle }));
const vehRows = [...L.values(), ...R.values()].filter((r) => !r.card && r.vehicle);
add('Vehicle never sits on a dark smear (60 x 40 px around it: not mean < 45 with std < 12)', smears.length === 0 && vehRows.length > 0, { frames_measured: vehRows.length, flagged: smears.slice(0, 30) });
const riderSmears = [...R.values()].filter((r) => !r.card && r.rider && r.rider.mean < 45 && r.rider.std < 12).map((r) => ({ n: r.n, ...r.rider }));
add("Today's rider never stands on a dark smear while walking (60 x 40 px around them)", riderSmears.length === 0 && [...R.values()].some((r) => r.rider), { frames_measured: [...R.values()].filter((r) => r.rider).length, flagged: riderSmears.slice(0, 30) });
const clamps = [...L.values(), ...R.values()].filter((r) => !r.card && r.clamp > 1);
const clear = [...L.values(), ...R.values()].filter((r) => !r.card && typeof r.clearance === 'number' && isFinite(r.clearance)).map((r) => r.clearance);
add('Camera never inside a roof or tree (clearance >= 12 m above the mesh under it)', clear.length > 0 && Math.min(...clear) >= 11.9, { min_clearance_m: clear.length ? +Math.min(...clear).toFixed(1) : null, frames_backed_out: clamps.map((r) => `${r.side}:${r.n}`).slice(0, 40) });

const auditFiles = ['left', 'right'].map((s) => path.join(ROOT, `logs/audit-${s}.jsonl`)).filter((f) => fs.existsSync(f));
const audits = auditFiles.length
  ? auditFiles.flatMap((f) => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => { const r = JSON.parse(l); return { n: r.n, side: r.side, ...r.audit }; }))
  : recs.filter((r) => r.audit).map((r) => ({ n: r.n, ...r.audit }));
const off = [...new Set(audits.flatMap((a) => a.offPalette))];
const banned = [...new Set(audits.flatMap((a) => a.banned))];
add('No overlay colour outside the palette (#FFE7A8 #F47C5A #ECE7F2 #17121F, any alpha)', off.length === 0 && audits.length > 0, { audited_frames: audits.map((a) => a.n), colours_seen: [...new Set(audits.flatMap((a) => a.colours))], off_palette: off });
add('No banned word (live, now, real-time, citywide)', banned.length === 0 && audits.length > 0, { found: banned });

// contact sheet of the bottom strip of every 30th tile frame (for the visual check)
const qa = path.join(ROOT, 'qa');
const sample = tiles.filter((r) => r.n % 30 === 0).map((r) => r.n);
const listDir = path.join(qa, 'credit-strips');
fs.mkdirSync(listDir, { recursive: true });
for (const [i, n] of sample.entries()) {
  const nm = String(n).padStart(5, '0') + '.jpg', a = path.join(ROOT, 'frames', 'L', nm), b = path.join(ROOT, 'frames', 'R', nm);
  if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', a, '-i', b, '-filter_complex', 'hstack,crop=1920:150:0:930', '-q:v', '3', path.join(listDir, `s${String(i).padStart(5, '0')}.jpg`)]);
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'sequence', '-start_number', '0', '-i', path.join(listDir, 's%05d.jpg'), '-vf', 'tile=1x' + Math.min(sample.length, 27), '-frames:v', '1', path.join(qa, 'credit-strips.jpg')]);
add('Contact sheet of every 30th tile frame written for the visual check', fs.existsSync(path.join(qa, 'credit-strips.jpg')), { frames: sample, file: 'qa/credit-strips.jpg', visual_check: 'pending (see notes.md)' });

const out = path.join(qa, 'timing.json');
const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
const render = { generated: new Date().toISOString(), all_pass: checks.every((c) => c.pass), checks };
fs.writeFileSync(out, JSON.stringify({ ...prev, render }, null, 2));
for (const c of checks) console.log(c.pass ? 'PASS' : 'FAIL', c.name);
console.log(render.all_pass ? 'ALL RENDER CHECKS PASS' : 'SOME RENDER CHECKS FAIL');
