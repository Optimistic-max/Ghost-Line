# Race film — notes

## Hand-off (final, v3b, approved Nov 23, 2026)
**Final files (in `race-film\`):**
- `film\race-split-with-sfx.mp4` (v3b, **the one to use**): the film with its synthesized sound (-16.0 LUFS, true peak -1.2 dBFS, AAC 192 kb/s; the WAV is `film\race-split-sfx.wav`). Sent to Emmanuel Nov 23 with `thumbs\thumb-main.jpg`; waiting on his headphone check (too loud / too quiet / fine).
- `thumbs\thumb-main.jpg`: main thumbnail ("Same ride, longer wait."). Backup: `thumbs\thumb-b-15-vs-45.jpg`.
- `film\race-split.mp4` (v3b): the same film, silent. 32.7 s (981 frames), 1920×1080, 30 fps, H.264 High, +faststart, no audio. 0:00–0:02.6 establishing, then the race at a constant ×120 with four holds: 1938 boarding and getting off 0.6 s each (frames 168–186, 321–339), bus boarding and getting off 0.9 s each (604.8–631.8, 756–783). Then 0.5 s on the finish and a 4 s end card (frames 861–980, no map imagery). `film\race-split-with-sfx.mp4` is the same video with the synthesized sound.
- `film\wait-loop.mp4`: an optional 7.1 s silent loop of today's wait (v3b frames 342–553: right half, ghosts 3 and 4 leave the corner and pass the rider, credits visible), centred on a 1920×1080 dark frame. It is Google-tile footage too (see below).
- `film\bus-boarding-sample.mp4`, `film\ghost-pass-sample.mp4` (v2): short review samples only.
- Backups: `race-split-v3a.mp4` (v3 with 0.6 s bus holds; `-v3a-with-sfx`), `race-split-v2-final.mp4` (the v2 final, sent to Emmanuel Nov 23), `race-split-v1-140m.mp4` (first, wide take), `-v2a` (straight walks), `-v2b` (street walks), `-v2c-pre`, `-v2d` (walk labels with metres).
- `qa\cues.json`: sound cues for the edit, in film seconds and frames (30 fps), regenerated for v3b. `qa\sfx-events.json` (what the sound track was built from) matches it exactly. Main v3b cues:
  - 0:00 establishing; 0:02.6 race start (10:00:00); 0:03.73 today's rider reaches stop 8564.
  - Ghost passes (bells): 6.419, 9.919, 14.519, 18.019 s (frames 192.6, 297.6, 435.6, 540.6).
  - Holds (door chimes): 1938 boards 5.6 s (frames 168–186), 1938 gets off 10.7 s (321–339, stopwatch freezes at 15:00), bus boards 20.158 s (604.75–631.75), bus gets off 25.2 s (756–783).
  - Today's rider finishes 28.178 s (45:00, rounded); end card 28.7 s (frame 861); film end 32.7 s (frame 981).
- `qa\timing.json` (timing + render QA, all pass), `qa\checklist.json` (director's checklist), `stills\` (review frames), `PROGRESS.md` (how to re-render, about 15 min).

**Google-tile footage:** 28.7 s in race-split.mp4 (v3b: 2.6 s establishing + 22.6 s race + 3.0 s holds + 0.5 s hold), under 29 s, inside the 30 s promotional limit. `wait-loop.mp4` (v3b: 7.1 s, frames 342–553, between the 1938 holds and the boarding close-in) is more Google footage: if the edit uses it, cut the same amount from the race clip so the whole video stays at 30 s or less. Never crop the bottom credit strip, and keep "For promotional purposes only" on screen whenever tiles show.

**Credits for the video's end card and the YouTube description:**
> Race footage: Google Photorealistic 3D Tiles, rendered with CesiumJS via Cesium ion. Map data: Google, Data SIO, NOAA, U.S. Navy, NGA, GEBCO, Landsat / Copernicus, IBCAO. For promotional purposes only.
> Schedules: Baltimore No. 21 trackless trolley timetable and route diagram, effective March 6, 1938 (Digital Maryland, collections.digitalmaryland.org, btjk id/201 and id/202). MDOT MTA local bus GTFS schedule, feed version 20260821, weekday service of November 4, 2026 (not endorsed by MDOT MTA).
> Streets: © OpenStreetMap contributors (ODbL). Vehicles: original illustrative models made in Blender for Ghost Line.

**Secret check before publishing (Nov 23, v3b): PASS, 0 hits.** `node scripts\secret-scan.mjs .` scanned all 98 files (16.3 MB, binaries included) under `page\`, `scripts\`, `data\`, `models\`, `qa\` and `notes.md`. It looked for:
- the Cesium ion token, read at runtime from `cesium-token.txt`, both whole and as each of its JWT parts;
- any URL parameter `key=`, `session=`, `access_token=`, `token=`, `sig=` or `signature=` with a real value;
- Bearer headers, JWT-shaped strings and Google API keys (`AIza…`).

It found nothing. A control run on a planted fake token and a fake keyed tile URL found all 4 planted hits, so the patterns work. The scanner prints only paths and counts, never a value. Copy only those folders: `cesium-token.txt` must never be copied (it is in `.gitignore`), and `logs\`, `frames\` and `node_modules\` should not be copied either. The logs have tile URLs with `key=` and `session=` redacted, but they are not evidence and are not needed.

(Earlier takes, for the record: v1 was 140 m drone cameras; v2 moved them close after Emmanuel's review, 30.1 s with 26.1 s of tiles; v3 added on-schedule arrivals and the four holds. Details in the sections below and in PROGRESS.md.)

## Director's checklist (Nov 23): all 13 PASS
Full detail in `qa\checklist.json`. In short:
1. 1938/Today obvious in 2 s. 2. Rider is a person with name and waiting caption. 3. Ghosts labelled; tally true on screen. 4. All text 28 px or larger. 5. Vehicles never hidden by trees (every 15th chase frame checked). 6. Constant ×120, smooth camera, 0 timeouts. 7. Headings follow travel, no flips. 8. No half-loaded frames (automated detail check on every frame). 9. Nothing before its departure. 10. 45:00 marked rounded. 11. Attribution in every tile frame, 28.7 s of tiles. 12. cues.json. 13. wait-loop.mp4.

## Camera (v2)
- Left: chase about 50 m behind and 32° to the side of the trolley, about 33 m up, pitch -42°; from 10:15 it holds close on the parked trolley at Aliceanna & Bond until the end.
- Right: the wait is shot from about 46 m up, facing north up Caroline St (Preston & Caroline in the upper frame, the rider lower-middle), so each ghost leaves the corner and passes the rider. For the bus the camera keeps facing north and leads it (the bus drives toward the viewer), which avoids a 180° swing; then it follows the rider's last walk, with a gentle pull-back only in the final 0.5 s hold.
- On screen: trolley about 200–250 px long, bus about 220 px. The camera is held at least 12 m above any mesh under it.

## Walks along real streets (v2b, Nov 23)
Emmanuel spotted today's rider walking through buildings on the final walk: the straight line from stop 9486 to Aliceanna & Bond cut across blocks. Both walks are now drawn along OpenStreetMap street centrelines (`data\osm.json`, the 2026-11-23 Overpass snapshot, ODbL), offset 7 m to the right-hand sidewalk, with the ends snapped to the source coordinates (`scripts\build-data.mjs`):
- Walk 1: Preston & Caroline → west sidewalk of Caroline St → stop 8564. Drawn 134.9 m (the straight line was 125.3 m and crossed a building for about 8 m).
- Walk 2: stop 9486 → west sidewalk of Caroline St south to Aliceanna St → south sidewalk of Aliceanna east to Bond St → the corner. Drawn 334.7 m (the straight line was 230.2 m and crossed buildings for about 98 m).
- Timing is unchanged: the walks still take the scheduled estimates (2.258 and 4.156 min) and the rider moves linearly by length. So the implied pace on the drawn paths is about 60 and 81 m/min. That's honest to the data, which estimates walks from straight-line distance; the caption still says "Walks estimated". Worth knowing: the app's 4.156 min walk estimate is short for the real 335 m street route.
- QA (timing.json): the rider is within 9 m of a street centreline at every 0.25 s (stop 9486 itself is 8.5 m from the centreline, on the sidewalk); never inside any of the 6,132 OSM building footprints; walk start and end times unchanged.
- `film\race-split-v2a.mp4` is the previous take, with straight walks.

## v2c (Nov 23): why labels, ghost look, readable passes, fresh-eyes pass
### NEW COPY ("why" labels, main session's wording)
- Opening card, line 2: "The 1938 car is listed at this corner. Today's bus stops are a short walk away. Walks are estimates."
- 1938 rider name: "1938 rider · boards at the corner" (the "Waiting for the 10:06 AM trolley (scheduled)" caption stays).
- Today's rider while walking: "Walking to stop 8564 (estimate)" and "Walking to Aliceanna & Bond (estimate)". The metres were dropped (main session, final round): the drawn street route (135 m and 335 m) would contradict the app's straight-line figures (125 m, 230 m), whose walk minutes already include a 1.3 detour factor.
- Stop labels: "Stop 8564 · Biddle St & Caroline", "Stop 9486 · Caroline St & Eastern Ave" (GTFS names BIDDLE ST & CAROLINE AVE eb, CAROLINE ST & EASTERN AVE fs sb; asserted in copy.js).
- Banners, about 3 s each: "10:32:43 AM · bus leaves stop 8564", then "10:41:00 AM · bus reaches stop 9486" (hidden once the rider finishes).

### Ghost look: kept vs dropped (compared side by side with v2b)
- Kept: the race trolley is solid cream with softly lit cream edges (silhouette) and warmer light, so windows and poles stay crisp. Ghost cars are 65% cream fill with a cream outline, and their poles are visible. Overhead wires use a soft glow line (slightly brighter, still thin). Tiny brief sparks at the pole tips while moving (about 28% of frames, deterministic), plus a 3% shimmer at 1 Hz (not noticeable as flicker). The bus is unchanged (solid, plain).
- Dropped: 85% translucency on the race trolley (it read as a muddy tan capsule, poles and windows lost). 45% ghosts (too faint and muddy at the wide shot; raised to 65% with an outline, per Emmanuel's fallback). The soft glow halo around the 1938 cars: screen-blended it was invisible over sunlit tiles, and a stronger one fogged the photo, so it didn't make the story clearer.

### Ghost passes
- The wait shot is now about 99 m up, straight down Caroline St: Preston & Caroline at the top, the rider lower-middle, and more street beyond. Each car leaves the corner in view and is on screen about 0.6 s (constant ×120).
- After-trail: a thin warm line with a pale core along the route where the car has just been, fading over about 1.5 s (each point is where the car was at that scheduled time).
- On the pass: a soft ring pulses around the rider and the matching tally pip pulses (0.5 s). Every car is labelled from the corner until about 1 s after it passes ("1938 rider's trolley (scheduled)" for the 10:06 car, which really is the 1938 rider's car; "Another 1938 trolley (scheduled)" for the others), placed right of the car, clear of the rider's labels.
- cues.json has each pass frame: 186.6, 291.6, 411.6, 516.6 (10:06:26, 10:13:26, 10:21:26, 10:28:26).

### Fresh-eyes pass (every 10th frame, sound off, as a first-time judge)
1. Opening, frames 10–80: the "Preston & Caroline" label peeks out behind the rules card. Fixed: place labels are hidden while the card is up.
2. Left, 10:00:40–10:03: a dark church spire in front of the 1938 rider. Fixed: the wait camera sits south-east of the corner (nothing tall in front).
3. Left, 10:06: the camera swung 120° just as the trolley left, and the trolley started under the mini-map. Fixed: the camera orbits round to the chase angle between 10:03:30 and 10:05:30, and the chase starts centred on the corner.
4. Left, 10:06: the "Preston & Caroline" label sat on the departing trolley. Fixed: hidden once the trolley leaves.
5. Left, 10:07:20: the trolley over a dark melted-mesh patch. Fixed: the chase runs on the east side at a steeper pitch (-50°). New QA check: the 60 × 40 px around the vehicle is never a dark flat smear.
6. Left, 10:14: a tall building cut across the trolley. Fixed by the steeper pitch.
7. Right, the ghost leaving the corner sat behind the Today panel (top right). Fixed: the corner is now top-centre in the wide shot.
8. Right, the waiting caption ran under the tally panel, and later the corner label hit it. Fixed: the tally moved to the middle right (y 500), clear of the corner, the rider and the pass labels.
9. Right, walking from the corner, the caption ran into the Today panel. Fixed: while walking, the caption extends to the left of the rider.
10. Right, 10:32:40: the camera started zooming toward the bus 0.4 s before it existed. Fixed: the right camera smooths over the past only.
11. Right, 10:41–10:45: the "bus reaches stop 9486" banner lingered over the finish. Fixed: it hides when the rider finishes.
12. Right, 10:41:24 (QA caught it: an overlay touched the credit strip): after the bus arrived, the camera kept facing the bus while the rider appeared off-frame at the bottom. Fixed: the camera keeps its heading and moves onto the rider within 10 scheduled s; markers never draw in the bottom strip.
13. Right, the final walk caption ran under the tally panel. Fixed: the tally fades out at 10:41 (its count is final, and the end card repeats it).
14. Right, at each pass the car's label collided with the rider's waiting caption. Fixed: the rider's caption runs to the left of the rider, car labels to the right of the route, and both mini-maps moved up to just under the side panels.
15. Right, 10:02: the stop label met 'Today's rider' as the rider arrived. Fixed: the stop label lifts above the rider's name.
16. Right, walk 2 (main session): the camera looked down on a warehouse roof with melted mesh. Fixed: a clean cut at the bus's 10:41:00 arrival to a street-side view (camera over the roadway beside and behind the rider, looking along Caroline St, then Aliceanna St); the tally fades out just before the cut.
17. Checked and left as is: the far horizon is softer at the top edge on some frames (normal level of detail); the parked trolley's creep is slow by design.

## v3 (Nov 23): vehicles arrive and leave on schedule; boarding and getting-off holds
Emmanuel: "the vehicles appear out of nowhere, especially the bus; you hardly see the rider get on or off."
- **The bus** now runs on its own trip's stop_times (trip 4110804, pinned feed; extracts in `data\gtfs\`) along its GTFS shape: from stop 4021 at 10:30:00 and 9480 at 10:31:03 it pulls in along Biddle St to stop 8564 at 10:32:43, then passes every intermediate stop at its scheduled time (linear by distance between stops) to 9486 at 10:41:00. It is shown only where those times put it (not before 10:30:00; checked in timing.json).
  - Stop 8564: the feed's shape_dist for this stop is in the Caroline/Biddle intersection, 16 m from the stop's own coordinates. The film stops the bus where its shape passes closest to the stop pole (5.2 m), with the front door at the pole.
  - Stop 9486 is the last stop of this trip (drop-off only). The same bus (block 4805) next leaves 9486 at 11:04 (trip 4110916), so by the schedule it lays over at the stop: it stays parked after 10:41:00 rather than pulling away. The feed's shape ends 39 m north of the 9486 pole, so the rider steps off there and the drawn walk passes the pole on the way to the corner.
- **The 1938 cars** drive in along Preston St (route.geojson eastbound) using the timetable's 8 minutes from Brevard & Preston to Preston & Caroline (no21-1938.yaml timing points, id/201), and turn down Caroline. The wires now run along that approach too.
- **Holds**: four 0.6 s holds where the scheduled clock stops: 10:06:00 (1938 rider boards), 10:15:00 (1938 rider gets off), 10:32:43 (today's rider boards), 10:41:00 (today's rider gets off). Both halves pause together. The clock and both stopwatches hold, the badge reads "clock paused · boarding" or "clock paused · getting off", and the rider walks the last few metres to the door and fades in, or appears at the door and steps onto the curb. The holds add 2.4 s of film and no scheduled time (checked: every non-hold frame is exactly START + (film − holds so far) × 120).
- The camera moves in on the bus during its boarding hold (same heading, no turn) and turns into the chase after it; it holds on the bus while the rider gets off at 9486, then cuts to the street-side walk.
- NEW COPY: "clock paused · boarding", "clock paused · getting off", "BOARDING", "GETTING OFF" (state lines), "1938 rider" (name after arrival).
- Google-tile footage: 28.5 s (3 s establishing + 22.6 s race + 2.4 s holds + 0.5 s hold), inside the 30 s cap.
- The capture re-renders any frame whose tiles timed out (up to twice) before saving it.

### v3b (main session's review of the 10:32:43 boarding)
- The camera now moves in from 200 to 60 scheduled s before 10:32:43 (about 1.2 s of film, during the bus's approach), so it has settled about 55 m from the bus at the pole, looking north, with the bus's door side to camera (about 270 px long). The bus pulls in along Biddle St into that close frame, and the rider walks the last metres into the door.
- During the close-in and the boarding hold, the tally panel fades to 30%, and the rider's name and the stop label move below the rider, so nothing covers the bus or the rider.
- Both bus holds are now 0.9 s (27 frames); the 1938 holds stay 0.6 s (18 frames). The establishing shot was trimmed from 3.0 s to 2.6 s, so the Google tiles total 28.7 s (checked ≤ 29 s). The hold QA checks the exact frame counts.

## Sound
Every sound in `film\race-split-sfx.wav` is synthesized in this folder by `scripts\sfx.py` (numpy/scipy sine partials and filtered noise), driven by `qa\sfx-events.json`. That file is generated by `scripts\sfx-events.mjs` from the same timeline as the picture and matches `qa\cues.json`. There is no third-party audio, so nothing to license or credit. There is no music: Emmanuel adds that in the edit from the YouTube Audio Library.
- **Bells:** a soft warm bell (four inharmonic sine partials, exponential decay, about 1.2 s) as each 1938 car passes today's rider (v3b: 6.42, 9.92, 14.52, 18.02 s; see qa\sfx-events.json), panned toward the right half.
- **Freeze bell:** one lower, longer bell at the trolley's 15:00 freeze (v3b: 10.70 s), after 0.4 s of near-silence (the hum ducks), panned left.
- **Door chimes:** a gentle two-note chime (E5 then C5) at each hold (v3b: 5.60, 10.95 just after the freeze bell, 20.16 and 25.20 s).
- **Hum:** a low electric hum (120 Hz plus soft 240/360 Hz harmonics, very quiet) while the 1938 trolley rides (v3b: 6.2–10.7 s).
- **Rumble:** a muted low rumble (brown noise low-passed at 160 Hz) while the bus is on screen and moving: its last 20 scheduled s into stop 8564, then from the end of the boarding hold to 9486.
- **Ticks:** a soft clock tick about once per real second during today's wait, silent while the clock is paused.
- The end card is quiet.
- Mix: -16.0 LUFS integrated, true peak -1.2 dBFS, 48 kHz stereo, 24-bit WAV. `film\race-split-with-sfx.mp4` is the same video stream copied, with AAC at 192 kb/s. `film\race-split.mp4` stays silent.
- Re-make: `node scripts/sfx-events.mjs`, then `python scripts\sfx.py`, then ffmpeg (volume about +4.8 dB, measured by a loudnorm pass each time, to reach -16 LUFS; v3b used +4.85 dB). Regenerated from the v3b cues; the waveform (`qa\sfx-waveform.png`, 1 s grid) lines up with every cue.
- **Waiting on Emmanuel:** one listen with headphones, then too loud, too quiet or fine. To change the level, change the target in the ffmpeg step and re-mux; the picture is untouched.

## Thumbnails (`thumbs\`, 1280 × 720 JPEG, each under 300 KB; `scripts\thumbs.mjs`)
- **Main: `thumb-main.jpg`** (was option A): the split at 10:21:26 (clean render without panels). The parked glowing 1938 trolley with its rider on the left; today's rider waiting as the third 1938 car passes on the right. Text: the app's own headline, "Same ride, longer wait." The frame's own Google / Cesium credit strip is visible and uncovered, plus "For promotional purposes only". Sent to Emmanuel.
- **Backup: `thumb-b-15-vs-45.jpg`**: the end-card bars redrawn at thumbnail size (app rounding: wait 6 · ride 9 = 15; walk 2 · wait 31 · ride 8 · walk 4 = 45). Text: "15 min vs 45 min." and "Baltimore, scheduled times". No map imagery, so no attribution needed.
- Option C ("4 trolleys before your bus", a crop of the trolley on Caroline St) was dropped in review. It and the old A text are kept in `thumbs\old\` only for reference.
- Clean source frames: `node scripts/capture.mjs stills --clean --frameset=240,448`.

## How it was made
CesiumJS 1.135 + Google Photorealistic 3D Tiles via Cesium ion (Emmanuel's token, read from `cesium-token.txt` at run time and never logged). Headed Chrome through Playwright, Intel HD 620 over ANGLE/D3D11. One viewer per page (`?side=left|right`). Each frame: set the scheduled time, place everything with the pure `positionAt()` in `page\timeline.js`, set the camera from a smoothed pure function of time, render until `tileset.tilesLoaded` holds for 4 renders, then screenshot the half. The halves are joined with ffmpeg `hstack`. Ground heights are sampled once per run in memory (25th percentile over ±18 m to skip trees and parked cars) and never saved. Vehicles are our own Blender 5.2 models at real scale (`scripts\vehicles.py`), with a thin dark silhouette and an overlay ground ring in the lane colour.

## Render time (Nov 23, HD 620)
- v2: left pass 7.5 min (783 tile frames + 120 card frames), right pass 6.5 min, plus about 1 min page start-up each (height sampling); encode about 1.5 min; audit about 3 min. About 20 min per take. (v1 at 140 m took about 36 min.)
- 0 frames hit the settle timeout. Per-frame records: `logs\frames-left.jsonl`, `logs\frames-right.jsonl`.

## NEW COPY (on-screen words not given in the brief; all in `page\copy.js`)
- "TRIP TIME" (label above each stopwatch)
- v2 additions: "1938 rider", "Today's rider", "Waiting for the 10:06 AM trolley (scheduled)", "Waiting for the 10:32:43 AM bus (scheduled)", "1938 rider's trolley (scheduled)", "Another 1938 trolley (scheduled)", "(rounded, as in the app)" after "ARRIVED · 45:00", and the tally "1938 trolleys scheduled past this corner while you wait".
- v2 caption (main session's one-line wording, replacing the brief's longer sentence so it fits at 28 px): "Scheduled times: 1938 timetable; MTA weekday schedule, Nov 4, 2026. Positions interpolated. Present-day buildings. Vehicles illustrative. Walks estimated." The brief's original: "Scheduled times: 1938 timetable (Mar 6, 1938) and MTA weekday schedule as of Nov 4, 2026. Positions interpolated along the route. Present-day buildings. Vehicles illustrative. Walks are estimates."
- "WAITING", "WALKING", "RIDING", "ON THE BUS" (state line under each stopwatch); "WAITING" also under the rider markers
- "ARRIVED · 15:00", "ARRIVED · 45:00" (brief's pattern, used on both sides)
- "No. 21 trackless trolley" (left subtitle, from the race index line and mode)
- "CityLink Lime bus" (right subtitle, `route_display` of trip 4110804)
- Rules card, 0–3 s: "Both riders leave Preston & Caroline at 10:00 AM" / "Every time on screen is a scheduled time"
- "10:32:43 AM · bus leaves stop 8564" (callout for 2 s after the bus departs)
- Place labels: "Preston & Caroline", "Aliceanna & Bond", "Stop 8564", "Stop 9486"
- "Gold lines: 1938 overhead wires, illustration" (beside "For promotional purposes only", under the caption)
- End card: "15 min vs 45 min." and "Four trolleys were scheduled past this corner before today's bus left." (both from the brief); bar labels "wait 6", "ride 9" and "walk 2", "wait 31", "ride 8", "walk 4" (the app's sum-preserving rounding, so the parts add up to the 45 shown; the raw wait is 30.458 and the bar widths stay exact); totals "15 min", "45 min"; footer "Scheduled trip from Preston & Caroline to Aliceanna & Bond, leaving at 10:00 AM. Bars to scale."
- Brief copy used as given: "For promotional purposes only", "×120 · 1 s = 2 min", "10:32:43 AM · scheduled" (clock format), "1938 trolleys scheduled past this corner", "1938", "Today".

## Honesty decisions
- Every time and count comes from `preston-caroline__aliceanna-bond.json` (row 10:00, trip index 2) and is asserted in `scripts\build-data.mjs`. The four ghosts are recounted from `y1938.passes` (10:06, 10:13, 10:21, 10:28; the first is the rider's own car).
- Vehicles appear exactly at their scheduled departure. The bus provably does not exist before 10:32:43 (every frame plus a 0.25 s sweep).
- Today's stopwatch stops at the rounded total, 45:00, so it never shows 45:09 and jumps back. The master clock shows the true 10:45:09 finish.
- The bus runs along the GTFS shape slice. Its ends are 15.9 m and 38.8 m from the stop coordinates (the GTFS shape and stop points differ), and the walks use the stop coordinates, as in design-v3.
- The 10:36 trolley (after the bus leaves) is not drawn, so the tally stays the four "before today's bus left".
- The left half shows only the rider's own trolley. The other three cars would arrive on top of the parked car at Aliceanna & Bond.
- v2: the camera target follows each vehicle with only a 0.08 s ease, so the camera never moves noticeably before its vehicle does; the vehicles themselves never move before their scheduled departure.

## Not done / for the edit
- No audio (as briefed). Exact cue times are in `qa\cues.json`: bells (ghost passes) at 0:06.42, 0:09.92, 0:14.52 and 0:18.02 of this clip; door chimes at the holds at 0:05.6, 0:10.7, 0:20.16 and 0:25.2; the trolley finishes at 0:10.7 and today's rider at 0:28.18; the end card starts at 0:28.7.
- The Cesium ion credit reads "Upgrade for commercial use." (Community plan). Left as shown, because the attribution must not be altered.
- The trolley's poles end at the wire height but don't animate; at drone height that reads fine.
- Tiles at the top edge of some frames (far distance) are softer, which is normal level-of-detail.
