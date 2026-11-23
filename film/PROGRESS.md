# Race film — progress

Brief: `..\race-film-brief.md`. Research: `C:\Users\Emmanuel\Projects\Extern\reports\Cinematic trolley race video.md`.

## Status (Nov 23, day 1)
- [x] Folder, `.gitignore` (cesium-token.txt, node_modules, frames), data copied into `data\` (race.json from the read-only repo, design-data.js from design-v3).
- [x] npm: `cesium@1.135.0`, `playwright-core@1.56.1` (uses installed Chrome via `channel: 'chrome'`).
- [x] `scripts\build-data.mjs` → `page\film-data.js`. Asserts the 10:00 row, the trip, wait/ride/total arithmetic, margin 30.156, and recounts the ghosts from `y1938.passes` (10:06, 10:13, 10:21, 10:28 = 4, first is the rider's own).
- [x] `page\timeline.js` — pure `positionAt(sched)`, clocks, stopwatches, tally, smoothed cameras.
- [x] `scripts\check-timing.mjs` → `qa\timing.json`: 47/47 PASS.
- [x] Vehicles in Blender 5.2 → `models\trolley1938.glb`, `bus-today.glb`, `halo-ghost.glb`, `halo-today.glb` (`scripts\vehicles.py`; preview `stills\vehicles-closeup.png`). Cesium needs `forwardAxis: Axis.X` for these.
- [x] Capture page `page\index.html` + `film.js` + `copy.js` (all on-screen words), `scripts\serve.mjs`, `scripts\capture.mjs` (modes test / stills / frames / eval; `--notiles` for layout work). No-tiles stills `stills\notiles-*.jpg` checked: layout, end card, vehicle headings, finish framing.
- [x] Token file present (Emmanuel, Nov 23). Never read into logs; injected via Playwright addInitScript.
- [x] Day-1 go/no-go (Nov 23): **GO.** `stills\go-no-go\caroline-{60,100,150}m-s*.jpg`. Sharp at 100–150 m; trees melt a little at 60 m → film flies ~135–150 m. Google Maps logo + data credits visible. Three stills sent to Emmanuel.
- [x] Fixed: two viewers in one page share Cesium's GPU resource cache across WebGL contexts ("object does not belong to this context") → now one viewer per page (`?side=left|right`), halves clipped and joined with ffmpeg hstack.
- [x] Fixed: `ERR_QUIC_PROTOCOL_ERROR` on tile.googleapis.com left tiles unloaded → Chrome `--disable-quic`. Tile URLs carry a session key → logs redact `key=`/`session=`.
- [x] Fixed: two pages at once still starve each other (90 s timeouts) → capture runs the left page, closes it, then the right page. Frames settle in 0.3–20 s.
- [x] Readability: vehicles stay real scale; added a 1.5 px dark silhouette and overlay ground rings (perspective-correct ellipse, lane colour) instead of the faint glb halos (halo glbs no longer loaded).
- [x] Key stills on tiles checked (`stills\sec07.jpg`, `1028-car4.jpg`, `103243-bus-leaves.jpg`). Moved the bus-leaves callout off the stop label.
- [x] Take 1 rendered + encoded (30.1 s, 903 frames, 0 timeouts). Timing 47/47 PASS, render QA PASS after tightening the palette audit to drawing elements (SVG containers inherited a default black fill that draws nothing; the SVG root now has an explicit #ECE7F2 fill).
- [x] Visual check of `qa\credit-strips.jpg`: credits present in every sample, but white Cesium/Google text was hard to read on bright roofs → Cesium's own credit strip now has a #17121F 85% backing (nothing overlays it).
- [x] **Take 2 = final** (Nov 23, 08:17 UTC): left 20.2 min, right 15.9 min, 0 timeouts. `film\race-split.mp4` 30.1 s / 903 frames / 24.8 MB, H.264 High 1080p30, faststart, no audio. Google-tile footage 26.1 s.
- [x] `qa\timing.json`: `all_pass: true` (timing 47/47; render: attribution in both halves of every tile frame, nothing covers it, no timeouts, palette, banned words; visual check of `qa\credit-strips.jpg` recorded).
- [x] Stills in `stills\` (sec00–sec26, every departure and arrival, exact-time 10:32:43 / finish / rider-at-stop, end card). Dev and no-tiles stills in `stills\dev\`.
- [x] Frames deleted after the MP4 was checked (re-render with `node scripts/capture.mjs frames`, about 40 min).
- [x] MP4 + key stills sent to Emmanuel.

## Round 2 (Nov 23, after review by the main session and Emmanuel: "vehicles barely visible, too far")
The take-2 film above is superseded once round 2 renders. Done so far:
- [x] Tight cameras in `page\timeline.js`: about 50–56 m from the subject, about 33–38 m up, pitch -42°, behind and about 30° to the side. Target follows the vehicle exactly (0.08 s ease); heading/range/pitch smoothed ±0.4 s. Wait shot centred between the rider at stop 8564 and the trolley route. Bus chase, then the rider's final walk, then a gentle pull-back in the 0.5 s hold.
- [x] Overlays: all text ≥ 28 px (caption on two lines), person markers with names and "Waiting for the … (scheduled)" captions, ghost labels and fading trails, north-up mini-maps per half, tally moved bottom-right with the new wording, "(rounded, as in the app)" on today's finish.
- [x] Models: darker reflective glass, soft contact-shadow glbs (`shadow-trolley.glb`, `shadow-bus.glb`), vehicles 12 cm above the sampled street, ghosts 60% opacity.
- [x] Page: camera clearance clamp (≥ 12 m above the mesh under it), tile-detail metric per frame.
- [x] QA: heading checks + `qa\cues.json` (check-timing), detail + clearance checks (qa-render).
- [x] Nine review stills `stills\review-*.jpg` checked at full size and sent to the main session (not yet to Emmanuel).
- [x] Main session approved with 4 fixes, all done: left holds close on the parked trolley 10:15–end; the right wait faces north (corner in frame, tally back to "past this corner while you wait"); ghosts at 55% with outline and poles (OIT off); one-line caption.
- [x] **v2 rendered** (Nov 23 09:18 UTC): `film\race-split.mp4` 30.1 s / 903 frames / 24.8 MB; v1 kept as `film\race-split-v1-140m.mp4`. Every timing and render check passes; checklist 13/13 PASS (`qa\checklist.json`); `qa\cues.json`; `film\wait-loop.mp4` (`scripts\wait-loop.ps1`); samples `stills\v2-samples\`.
- [x] Main session approved v2 with one fix: end-card today labels now use the app's sum-preserving rounding (walk 2 · wait 31 · ride 8 · walk 4 = 45). Only the 120 end-card frames were re-rendered; re-encoded; QA passes (new check in timing.json, checklist item 14).
- [x] Frames deleted. MP4 sent to Emmanuel.
- [x] **v2b (Nov 23, 10:18 UTC):** walks routed along OSM streets (Emmanuel: rider walked through buildings). `scripts\build-data.mjs` builds `geo.walk1/walk2` from `data\osm.json` (Caroline St; Caroline St + Aliceanna St), offset 7 m to the sidewalk; timing unchanged. New timing.json checks: within 9 m of a street centreline, never in a building, walk times unchanged. Full re-render (frames had been deleted; the mini-map draws the walks in every right frame), encoded, all QA passes; wait-loop rebuilt. Previous take kept as `film\race-split-v2a.mp4`. Walk frames `stills\v2b-walk\`.
- [x] **v2c (Nov 23, 11:54 UTC):** why labels, the 3 s banners (leave and arrive), restrained 1938 look (solid race trolley with cream edges, 65% ghosts with an outline, glow-line wires, tiny sparks; glow halo and 85%/45% translucency dropped, see notes.md), wide wait shot about 99 m up down Caroline St, after-trails, pass pulses, car labels held 1 s after the pass, no spire or melted patch, pass frames in cues.json, plus a fresh-eyes pass (15 fixes in notes.md). New QA: dark-smear check, walk-metre check. Every check passes. Backups: race-split-v2b.mp4 (streets walks), race-split-v2c-pre.mp4 (before the fresh-eyes fixes). Review frames `stills\v2c-review\`, clip `film\ghost-pass-sample.mp4`.
- [x] **v2d (Nov 23, 12:04 UTC):** walk 2 is street-side (a cut at 10:41:00). Right frames 690-782 re-rendered, encoded, every check passes. Frames deleted (re-render: `node scripts/capture.mjs frames`, about 15 min). Review frames `stills\v2d-review\`, clip `film\ghost-pass-sample.mp4`, wait-loop rebuilt.
- [x] **v3 (Nov 23, 17:05 UTC):** the bus runs on trip 4110804's stop_times along its GTFS shape (from 4021 at 10:30:00; front door at the 8564 pole; lays over at 9486 after 10:41, next trip 11:04). The 1938 cars drive in along Preston St (the timetable's 8 min from Brevard & Preston). Four 0.6 s boarding/getting-off holds with the clock paused. 975 frames, 32.5 s, Google tiles 28.5 s. Every timing and render check passes, including the new bus-schedule and hold checks. Backup of v2-final: `film\race-split-v2-final.mp4`. Review frames `stills\v3-review\`, clip `film\bus-boarding-sample.mp4`. Frames kept until the main session approves.
- [x] **v3b extras (Nov 23):** SFX regenerated from the v3b cues (-16.0 LUFS, -1.2 dBTP); waveform checked against qa\cues.json. Thumbnails: `thumb-main.jpg` (A, text now "Same ride, longer wait."), `thumb-b-15-vs-45.jpg` backup, C dropped (old files in `thumbs\old\`). `film\race-split-with-sfx.mp4` and `thumb-main.jpg` sent to Emmanuel, asking for one headphone listen (too loud / too quiet / fine). Waiting on his answer.
- [x] **v3b (Nov 23, 18:05 UTC):** boarding close-in (the camera settles about 55 m from the bus at the pole before it arrives; bus about 270 px, door side to camera; the tally fades to 30% and the labels move below the rider), bus holds 0.9 s, establishing 2.6 s. 981 frames, 32.7 s, Google tiles 28.7 s. Every timing and render check passes. SFX regenerated (-16.0 LUFS, -1.2 dBTP), with-sfx MP4 re-muxed, thumbnails rebuilt, wait loop 7.1 s. v3 kept as `film\race-split-v3a.mp4` (+`-v3a-with-sfx`). Review `stills\v3b-review\`, clip `film\bus-boarding-sample.mp4`. Frames kept until approval.
- [x] **v3 extras (Nov 23):** synthesized SFX (`scripts\sfx-events.mjs` → `qa\sfx-events.json` → `scripts\sfx.py` → ffmpeg +4.81 dB): `film\race-split-sfx.wav` (-16.0 LUFS, -1.2 dBTP, 48 kHz stereo) and `film\race-split-with-sfx.mp4` (video copied, AAC 192k). Three thumbnails in `thumbs\` (`scripts\thumbs.mjs`). Waiting for the main session's review.
- [x] v2 FINAL (Nov 23, 12:24 UTC): v2d approved; walk labels without metres ("Walking to stop 8564 (estimate)", "Walking to Aliceanna & Bond (estimate)"); rider smear QA added. Full re-render (frames had been deleted), encoded, all timing + render QA PASS, labels checked at full size. Previous take kept as `film\race-split-v2d.mp4`. Final `film\race-split.mp4` sent to Emmanuel. Hand-off at the top of notes.md. Frames deleted. **Done.**

## Next (optional, not required by the brief)
- The ghost cars on the right are 45% opacity with a 60% ring and read subtly; raise `ringGroup('#FFE7A8', 0.6)` / the ghost alpha in `page\film.js` and re-render if Emmanuel wants them stronger.
- The edit: bell cues at 0:06.0, 0:09.5, 0:13.5, 0:17.0 of this clip (see notes.md).: `node scripts/capture.mjs frames` → `frames\L`, `frames\R`, log `logs\capture-frames.log`, per-frame records `logs\frames-{left,right}.jsonl`. Resumable: rerun the same command.
- [ ] Full render, encode, QA, send

## Commands
```
cd "C:\Users\Emmanuel\Documents\Ghost Line Chat 2\race-film"
node scripts/build-data.mjs
node scripts/check-timing.mjs
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup -P scripts\vehicles.py -- "$PWD"
node scripts/capture.mjs stills --notiles          # layout stills, no Google tiles
node scripts/capture.mjs test                      # go/no-go stills (tiles)
node scripts/capture.mjs stills                    # key stills (tiles)
node scripts/capture.mjs frames                    # full render -> frames\ (resumable)
powershell -File scripts\encode.ps1                # -> film\race-split.mp4
node scripts/qa-render.mjs                         # render QA -> qa\timing.json
node scripts/film-summary.mjs                      # "film" block + top-level all_pass from the encoded mp4 (ffprobe)
```

## Decisions
- Film = 3.0 s establishing + 22.578 s race + 0.5 s hold = 783 tile frames (26.1 s) + 4 s end card (120 frames, no tiles). 30 fps, ×120.
- Bus runs along the GTFS shape slice (DATA.bus); its endpoints are 15.9 m / 38.8 m from the stop coordinates. The checks compare the bus to the shape ends and the rider to the stop coordinates (same convention as design-v3).
- Today's stopwatch is capped at the rounded total (45:00) so it never shows 45:09 then jumps back; the master clock shows the true 10:45:09 finish.
- All vehicles appear at their scheduled departure (no fade-in before it), so the bus provably does not exist before 10:32:43.
- Left half shows only the rider's own trolley (ghost cars arriving at Aliceanna & Bond would overlap the parked car). Right half shows all four as ghosts.

## Problems
- Git Bash tool hangs in this environment; use PowerShell.
