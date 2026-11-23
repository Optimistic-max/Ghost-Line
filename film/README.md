# Race film

The source and QA of the split-screen race film in the Ghost Line video. It was built with Claude Code during planning, not with Kiro, and it is not part of the app. The video file itself is not in this repository.

## What it is

The lead race, Preston & Caroline to Aliceanna & Bond at 10:00 AM, as two side-by-side views over Google Photorealistic 3D Tiles: the 1938 trolley on the left, today's bus and rider on the right. Rendered with CesiumJS in headed Chrome through Playwright, one frame at a time, then joined with ffmpeg.

**Final take, v3b (Nov 23, 2026), from `notes.md` and `qa/timing.json`:**
- 32.7 s, 981 frames, 1920 x 1080 at 30 fps.
- 28.7 s of Google-tile footage (861 frames), under the 30 s promotional limit; then a 4 s end card with no map imagery.
- The race runs at a constant x120 (1 s of film = 2 scheduled minutes), with four short holds where the clock pauses for boarding and getting off. The holds add film time, never scheduled time.
- The on-screen caption: "Scheduled times: 1938 timetable; MTA weekday schedule, Nov 4, 2026. Positions interpolated. Present-day buildings. Vehicles illustrative. Walks estimated."

## Where the positions and times come from

- `data/race.json` is a copy of `web/public/data/race/preston-caroline__aliceanna-bond.json`. `scripts/build-data.mjs` reads the 10:00 row and its trip, asserts the waits, rides, totals and margin, and recounts the 1938 cars from `y1938.passes`.
- The bus runs on its own trip's stop_times and shape from the pinned MTA feed (`data/gtfs/`). The 1938 cars use the route diagram's running minutes. Walks follow OpenStreetMap street centrelines (`data/osm.json`, see `data/osm-provenance.md`) and keep the app's walk-time estimates.
- `page/timeline.js` places everything from the scheduled time alone. `scripts/check-timing.mjs` and `scripts/qa-render.mjs` write `qa/timing.json`: every timing check and every render check passes (`all_pass: true` in both).

## The Cesium token

The Cesium ion token is read at run time from `cesium-token.txt`, which `.gitignore` excludes and which is not in this repository. `node_modules/` and `frames/` are excluded too. `scripts/secret-scan.mjs` checks the folder for the token and for keyed tile URLs before publishing (results in `notes.md`).

## Attribution rules

- Never crop or cover the Google and Cesium credit strip at the foot of each tile frame. `qa/timing.json` checks it is present in both halves of every tile frame and that nothing covers it.
- Keep "For promotional purposes only" on screen whenever tiles show.
- Keep all Google-tile footage in the final video at 30 s or less. The race film uses 28.7 s; any extra tile footage (for example `wait-loop.mp4`) must come out of it.
- Credit the film in the video's end card and the YouTube description with the credits text in `notes.md` ("Credits for the video's end card and the YouTube description").

## Re-make

See `PROGRESS.md` ("Commands"). You need your own Cesium ion token in `cesium-token.txt`, Chrome and `npm install` in this folder.
