# Draft 5: Phase 3 brief, the map race (tilted desktop view, flat phone)

Status: draft, Nov 20. Not applied. Nothing in the repo has been changed or committed.
Stretch work: start it only once Phase 1 (story-layer, draft 04) and Phase 2 (the Skeptic spec) are done.
Built from drafts 01 (steering) and 02 (bus-map data, **schema v2**), with honesty rule 12, and corrected by Astra's section 5.
Marks: **⚠ UNSURE** means a fact I could not confirm or a decision that is yours.

## ⚠ Read first: the calendar

- Phase 1 is Astra's five working days. Starting Nov 21, it ends around Nov 25 or 26.
- Phase 2 (Skeptic) comes after that.
- Phase 3 needs about **3.5 to 4 Kiro-days** (section 5).

Before your Nov 27 code freeze, Phase 3 fits only if Phase 2 takes a day or less. Otherwise it starts after the freeze. **The freeze is your own date** (Astra: "user-supplied project constraints, not independently verified competition rules"). You decide whether to move it, or to ship Phase 3 between the freeze and the Dec 4 submission. Decide before you paste this.

---

## 0. Preconditions

1. Phase 1 is merged and its acceptance checks pass. This brief edits text that Phase 1 changed.
2. Phase 2 is done.
3. raw/ has the pinned feed (SHA-256 8cc37d54…), because the data part rebuilds from it.

---

## 1. Steering and spec edits (draft 01, rebased onto Phase 1)

Phase 1 already used section **3B** of screen-brief.md for the story layer, so the map race becomes section **3C**. Each edit below says whether draft 01's text applies as written or has changed.

### 1.1 `product.md`: draft 01 edits 1a, 1b and 1c, **as written**

Phase 1 didn't touch Scope "In", Scope "Out" or the honesty rules. Apply draft 01 edits 1a, 1b and 1c word for word, including **honesty rule 12**:

```
12. On the map, a vehicle's position comes only from the scheduled times and
    the route geometry, sped up like the lanes. It is never a real vehicle's
    position. The map race shows the same "scheduled" clock as the card, and
    no map text may suggest tracking ("live", "now", "here comes").
```

### 1.2 `ui.md`

**(a) Which section wins: changed, because Phase 1 edited it**

BEFORE (the text after Phase 1)
```
The full direction is docs/planning/screen-brief.md, sections 2, 3, 3A and 3B
(3B wins over 3A, and 3A over 2 and 3, where they differ). The pictures in
docs/planning/ui-mockups/ show the intended look on a phone and on a laptop;
match them closely, except where section 3B changes the layout.
```
AFTER
```
The full direction is docs/planning/screen-brief.md, sections 2, 3, 3A, 3B and
3C (3C wins over 3B, 3B over 3A, and 3A over 2 and 3, where they differ). The
pictures in docs/planning/ui-mockups/ show the intended look on a phone and on
a laptop; match them closely, except where sections 3B and 3C change it.
```

**(b) Vehicles: changed, because Phase 1 rewrote this paragraph. Only its last two sentences change.**

BEFORE (the end of the paragraph after Phase 1)
```
  map uses the simplified trolley marker. Vehicle size is style; only the bars
  are drawn to scale.
```
AFTER
```
  map carries two simplified markers, both flat SVG: the glowing trolley on the
  1938 route and a small flat --today bus on its own scheduled path
  (screen-brief.md 3C). Each appears on the map only from its scheduled
  departure. In the tilted view they stand upright, facing the viewer. Vehicle
  size is style; only the bars are drawn to scale.
```

**(c) Map: draft 01 edit 2c, with "3B" corrected to "3C"**

BEFORE
```
- Map: real streets as hairlines, the 1938 line as the brightest thing, its
  streets named along it. No neighbourhood names. Streets come from
  OpenStreetMap data or the base-map tiles; the route from route.geojson.
```
AFTER
```
- Map: real streets as hairlines, the 1938 line as the brightest thing, its
  streets named along it. No neighbourhood names. Streets come from
  OpenStreetMap data or the base-map tiles; the route from route.geojson; the
  bus paths and stops from the race file.
- Desktop map: tilted (screen-brief.md 3C sets the angle), buildings raised
  from the tiles' building heights in dark tones, never brighter than the
  1938 line. Phone map: flat. When the frame-rate watchdog drops to lite, the
  desktop map goes flat and the buildings are removed. Under reduced motion
  the camera never moves.
```

**(d) Copy strings: changed, because Phase 1 edited it**

BEFORE (the text after Phase 1)
```
- Use only the copy strings in the race-screen and story-layer specs; where
  both have a row for the same place, the story-layer row wins. Do not write
  new wording.
```
AFTER
```
- Use only the copy strings in the race-screen, story-layer and map-race
  specs; where more than one has a row for the same place, the later spec wins
  (map-race over story-layer over race-screen). Do not write new wording.
```

### 1.3 `screen-brief.md`

- **Draft 01 edit 3a (line 64):** apply it, with "section 3B" replaced by "section 3C".
- **Draft 01 edits 3b and 3c** (the vehicle table's "On the map" row and the motion table's "Map marker" row): apply them, with "(section 3B)" replaced by "(section 3C)". Phase 1 didn't change either row.
- **Draft 01 edit 3d** (the new section) is replaced by the corrected section 3C below. It adds Astra's honesty fixes:
  - vehicles appear only from their departure;
  - passengers, not vehicles, wait;
  - an "illustrative" label;
  - a "buildings are today's" label;
  - the camera stays still.

```
## 3C. Fourth pass: the race on the map (map-race spec)

3C wins over 3B where they differ.

### 3C.1 What the map race shows
Both journeys play on the real map with the same clock as the lanes (3A.6, 3B):
1 real second = 4 scheduled minutes, at most 12 s. The lanes, captions and
numbers stay on the card; the map carries no number.

| Phase | 1938 | Today |
| --- | --- | --- |
| Wait | A small passenger dot at the origin corner. No trolley on the map yet. | A small passenger dot at the boarding stop, after its walk. No bus on the map yet. |
| Walk to the stop | - | The passenger dot travels a dotted straight line from the corner to the boarding stop (estimate). |
| Ride | The trolley marker appears at the corner at its scheduled departure and glides along the 1938 route. | The bus marker appears at the boarding stop at its scheduled departure and drives the trip's own path from the race file, never the 1938 line. |
| Walk from the stop | - | The dot walks the dotted line from the alighting stop to the destination corner. |
| Finish | The marker parks just short of the destination dot. | Same. |

Positions are linear in time along the path: illustrative, not tracked
(product.md rule 12). The first arrival is treated the same way whichever side
wins.

### 3C.2 Camera and look
- Desktop: tilted ⚠ (pitch 50 to 60 degrees; see the Nov 19 concept pictures),
  framed once per race on the selected corners, the 1938 stretch, the bus path
  and the walk lines. The camera does not move during a race.
- Buildings: raised from the tiles' render_height, in the --street family, at
  most ⚠ 70% opacity, never brighter than the 1938 line.
- Phone: flat, inside the story-layer route preview. The map race shows only
  when the visitor has opened "View route".
- Unselected stretches stay dimmed as in story-layer S10.

### 3C.3 Fallbacks
- No WebGL, a tile or style error, or the 8 s timeout: the bundled route
  drawing as now (race-screen R11.4); the card race is unchanged.
- Lite (under 30 frames per second): the desktop map goes flat, the building
  layer is removed, and the markers keep moving.
- Reduced motion: no marker or camera movement; both markers are parked at
  their finish.

### 3C.4 Labels
A short label on the map says the route is historical over today's map and
that movement is illustrative. With buildings shown, it also says the
buildings are today's. The labels are in the map-race copy table.
```

### 1.4 `race-screen/requirements.md`: draft 01 edits 4a, 4b and 4c, **as written**

Phase 1 only added pointers to other requirements. R11.1, R5.9 and the out-of-scope line are unchanged, so draft 01's text applies. Edit 4c names "the bus-geometry task (map-race spec)", which is M1 below.

### 1.5 `tech.md`

No edit needed. It's the same feed, the same libraries (pandas, pyproj, MapLibre) and the same tile host. The 100 KB rule already excludes the map.

---

## 2. Feature brief to paste into Kiro (new spec: map-race)

```
Feature brief: map-race (Ghost Line, Phase 3)

Goal
Both journeys play on the real map, in step with the card: a tilted view with
raised buildings on laptops, a flat view on phones. Nothing becomes less
honest. Read product.md (especially rule 12), ui.md, tech.md and screen-brief.md
section 3C first. The story-layer spec (Phase 1) is built and stays in force.

M1 Bus geometry in the race files (pipeline; race schema v2)
Follow docs: the draft "bus-map data" (Emmanuel will paste its contents into
this spec's design). In short:
- StopRef gains lonlat (stops.txt, 6 decimals). Each trip gains path, an index
  into a new today.paths array: {i, shape_id, from_km, to_km, length_m,
  coords}.
- coords is the trip's shape cut between its boarding and alighting stop
  sequence, using stop_times.shape_dist_traveled (km). A blank on sequence 1
  means 0; any other blank projects the stop onto the shape (UTM 18N with
  pyproj), searching only past the boarding position.
- EligibleTrip carries board_seq, alight_seq and shape_id. No race choice and
  no race row changes.
- Build checks stop with a clear error: a missing shape, to_km <= from_km, a
  path end more than 30 m from its stop, length_m more than 2% off
  (to_km - from_km) * 1000. Never widen a threshold to pass; ask Emmanuel.
- Schema "ghostline.race.v2". Tests: unit, Hypothesis, golden (lead pair: 1
  path, about 2,080 m from the feed's own distances 19.2496 and 21.3291 km,
  stops 8564 and 9486), every existing golden test unchanged, deterministic
  rebuild, fake-feed fixture gains shapes.txt and shape_dist_traveled.
- One commit with the pipeline, schema, tests, fixtures and rebuilt data.

M2 Site reads v2
- data/shape.ts checkRace accepts v2 only: lonlat inside a Baltimore bounding
  box, valid path indices, at least two coords per path.
- A failed path check makes the map fall back; it never blocks the card race
  (race-screen R11.4, R14). The site's fake race data gains the v2 fields.

M3 Markers and passenger dots on the map
- Phases as in screen-brief 3C.1. The trolley and bus markers appear only from
  their scheduled departure. Passenger dots show waits and walks.
- Ride positions are linear in elapsed ride time along the path, by length:
  the 1938 route between the two corners (the existing helper), and the bus's
  coords by length_m.
- The same clock drives the lanes and the map; the map never waits and never
  leads.
- Markers are flat SVG DOM markers (the simplified trolley; the story-layer
  small bus). In the tilted view they use pitchAlignment "viewport" so they
  stand upright.

M4 Desktop tilt and buildings (900 px and up)
- Pitch ⚠ 50 to 60 degrees, one framing per race fitted to the selected
  corners, 1938 stretch, bus path and walk lines. No camera movement during a
  race.
- A fill-extrusion layer from the tiles' building source layer, height from
  render_height (and render_min_height), colour from the --street family, at
  most ⚠ 70% opacity, below the route layers. If the dark style already has a
  flat building layer, hide it.
- No new library, no new URL, no 3D model.

M5 Phone (below 900 px)
- Flat map inside the story-layer route preview. The race plays on it only
  when "View route" is open. The card is unchanged.

M6 Fallbacks and motion levels
- No WebGL, tile or style error, or 8 s timeout: the route drawing (race-screen
  R11.4).
- lite: pitch 0, building layer removed, markers keep moving.
- Reduced motion: no marker or camera movement; markers parked at the finish.

M7 Honesty on the map (product.md rule 12)
- The map labels of the copy table show whenever the map race does.
- No map text says live, now, here comes, tracking or similar. No number on
  the map.
- The bus is never drawn on the 1938 line.
- The scheduled clock row is on screen whenever a marker moves.

M8 Budgets
- npm run check:size stays under 100 KB (map chunk excluded). Print the map
  chunk's size.
- npm run perf keeps the race-start median under 5,000 ms. The race never
  waits for the map.

Out of scope
three.js or any 3D library, 3D vehicle models, camera flights or follow
cameras, sound, HOLC, census numbers, overhead wires on the map, more lines.

Done when
All acceptance checks of this spec pass. The race-engine, race-screen and
story-layer suites pass unchanged (except the tests M1 and M2 name). Emmanuel
has reviewed the npm run screens pictures.
```

---

## 3. Copy table (map-race)

| Where | String |
| --- | --- |
| Map label, desktop with buildings (M7) | "Historical route over today's map. Buildings are today's. Movement between stops is illustrative." |
| Map label, flat or lite (M7) | "Historical route over today's map. Movement between stops is illustrative." |
| Sources, method line for bus paths (M1) | "Bus paths are the feed's own route shapes between the boarding and alighting stops. Walks are drawn as straight lines between the corner and the stop (estimate)." |

That's all. The story-layer captions already describe each phase, and the map carries no numbers and no other text.

---

## 4. Acceptance checks

1. **Data (M1).** Every test in draft 02's table passes. All 20 race files validate as v2. The existing golden values don't move. `verify` and `check_sources` pass.
2. **No bus on the 1938 line.** At sampled clock moments, every bus-marker position lies within 1 m of its own path's coords. No bus marker exists before its trip's scheduled departure.
3. **Positions follow the clock.** At ten clock moments in the lead race at 10:00 and in the first `summary.today_wins` race:
   - each marker sits at the fraction of its ride elapsed along its path, within 2 px on screen;
   - the passenger dots sit at the corner or stop, or on the walk line, as 3C.1 says;
   - the lane markers (story-layer S2) and the map markers report the same elapsed time.
4. **Departure rule.** Before its departure, a side shows only its passenger dot; the vehicle appears at the departure moment.
5. **Desktop look.** At 1280 × 800: pitch greater than 0, the building layer present below the route layers, and the map labels shown. The camera's centre, zoom, pitch and bearing don't change between race start and finish.
6. **Phone.** At 375 × 667: pitch 0 and no building layer. With the route preview closed, no map race runs. Opened, it does.
7. **Lite.** A forced slow-frame watchdog brings pitch to 0, removes the building layer and swaps to the flat label, and the markers keep moving.
8. **Reduced motion.** No marker or camera movement; markers parked at their finish positions.
9. **Fallbacks.** With the tile host blocked, with WebGL absent and with a style error, on both layouts, the route drawing shows as now and the card race and captions are unchanged (race-screen R17.6).
10. **Wording (M7).** The banned-word scan covers every map text in every state. No digit appears on the map. The scheduled clock row is visible whenever a marker moves.
11. **Budgets (M8).** `check:size` is under 100 KB and prints the map chunk's size. `npm run perf` keeps its median under 5,000 ms; it's a timing test, run on a quiet machine.
12. **Your laptop.** Watch the lead race on your own laptop in Chrome and confirm it doesn't stutter. Automated tests can't judge frame rate.
13. **Pictures.** `npm run screens` adds: desktop tilted racing and finished; desktop lite (flat); phone with the route preview open while racing; map unavailable on both layouts.

---

## 5. Effort, order, and what to cut

| Order | Work | ⚠ Kiro-days |
| --- | --- | --- |
| 1 | M1 data and M2 site check | 1 |
| 2 | M3 markers and dots, flat map first | 1 to 1.5 |
| 3 | M4 tilt and buildings, M6 levels | 0.5 to 1 |
| 4 | M5 phone, M7 labels, M8 budgets, verification | 0.5 |
| | **Total** | **about 3.5 to 4** |

The flat map race (steps 1 and 2) works on its own. If time runs out, ship that.

**If it slips, cut in this order:**
1. M4 buildings (keep the tilt).
2. The tilt (keep the flat map race).
3. Passenger dots on the walk lines (keep the dots at the corner and stop).

Never cut:
- M7 honesty;
- M6 fallbacks;
- the departure rule.

---

## 6. Unsure, to check before Kiro

1. ⚠ **The calendar.** Phase 3 probably lands after Nov 27 unless Phase 2 is short. It's your decision.
2. ⚠ **The look.** The pitch angle (50 to 60°), the 70% building opacity and the single still framing per race. Check them in the first screenshot.
3. ⚠ **The dark style's flat building layer.** Whether the dark style already draws flat buildings, and whether OpenFreeMap's building heights cover these streets well. The Nov 19 concept extruded them on the same tiles, but nobody checked coverage street by street.
4. ⚠ **Phone.** The map race only plays inside the opened route preview. Check that this is what you want.
5. ⚠ **M1's open items** (from draft 02):
   - the 30 m and 2% thresholds, which must be frozen after the first run;
   - loops, where a trip visits the same stop twice;
   - how long reading shapes.txt takes.
6. ⚠ **Label wording.** Shortening "Movement between stops is illustrative." to "Movement is illustrative." would be wrong, because the walk lines are estimates too. Keep the longer form, or write a version that covers both.
