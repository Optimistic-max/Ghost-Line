// Writes the top-level "film" summary and "all_pass" in qa/timing.json from the current encode (ffprobe on
// film/race-split.mp4) and the timeline, and fails if they disagree. Run after encoding, check-timing and qa-render.
// node scripts/film-summary.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'page/film-data.js'), 'utf8'), ctx);
const TL = require(path.join(ROOT, 'page/timeline.js')).make(ctx.window.FILM);

const rel = 'film/race-split.mp4';
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0',
  '-show_entries', 'stream=codec_name,profile,width,height,r_frame_rate,nb_read_frames', '-show_entries', 'format=duration',
  '-of', 'json', path.join(ROOT, rel)], { encoding: 'utf8' }));
const s = probe.streams[0];
const [num, den] = s.r_frame_rate.split('/').map(Number);
const film = {
  file: rel,
  frames: +s.nb_read_frames,
  seconds: +(+probe.format.duration).toFixed(3),
  tile_seconds: +(TL.TILE_FRAMES / TL.FPS).toFixed(3),
  codec: `${s.codec_name} ${s.profile}`,
  size: `${s.width}x${s.height}`,
  fps: +(num / den).toFixed(3),
  matches_timeline: +s.nb_read_frames === TL.TOTAL_FRAMES && num / den === TL.FPS,
};

const out = path.join(ROOT, 'qa/timing.json');
const prev = JSON.parse(fs.readFileSync(out, 'utf8'));
const all_pass = !!(prev.timing?.all_pass && prev.render?.all_pass && film.matches_timeline);
fs.writeFileSync(out, JSON.stringify({ ...prev, all_pass, film }, null, 2));
console.log(JSON.stringify({ film, timing_pass: prev.timing?.all_pass, render_pass: prev.render?.all_pass, all_pass }));
process.exit(all_pass ? 0 : 1);
