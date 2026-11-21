# Story layer report

For Emmanuel. Task 23.2 of the story-layer spec. Range covered: 2208b69^ to HEAD.
No size, text size, golden value, facts file or test was changed to clear a finding.

## (a) Layout findings

Source: web/test-results/story-layout-report.md, the checkpoint spec, and the About button
measurements. Kept sizes: trolley 104 px (phone) and 150 px (desktop), bar markers 28 px,
phone route strip 100 px.

Measured and fine:
- Phone 375 x 667: trolley illustration 104 x 45.1 px, bus 84 x 32.3 px. Both are clear of the
  title and total, and the row is not taller than the illustration.
- Laptop 1280 x 800: trolley 150 x 65 px, bus 104 x 40 px. Same result.
- Markers are 28 x 12.5 px on both layouts. None is clipped, none touches the other lane, none
  is wider than its ride segment.
- Phone route strip is 375 x 100 px. No credit line, the toggle is shown, the drawing content
  (7 boxes) is shown, and nothing overlaps.
- No sideways scroll at 320, 375 and 899 px. The checkpoint spec reports 0 px overflow in all
  six pictures.
- Phone fit at the lead example's result moment (5800 ms): the caption area ends at 563.1 px
  of 667 (103.9 px to spare). The result line ends at 658.2 px (8.8 px to spare).
- The banner is clear of the result box and of the three next-step boxes at 375 and 320 px
  wide. Note: the banner was already closed at the 5800 ms result moment. Its last open box
  (seen at 5100 ms) was used for the comparison. At 375 px it was 343 x 72.6 px with its
  bottom at 76.6 px. At 320 px it was 288 x 72.6 px, bottom at 76.6 px.

Findings that need a decision or a note:

1. **Accepted: 35 px first-arrival overflow on the phone.** In the running race on a 375 x 667
   phone, the result box first appears at y 607.97 px, height 93.99 px. Its bottom is 35 px
   below the viewport. At the end of the race it settles at y 569.70 px, height 94.98 px, and
   is inside the viewport. The finished state is also inside (y 569.70). On the laptop the
   result box is inside the viewport at first arrival (y 482.24) and at the end (y 445.06).
2. **Unfixed, needs a decision: About "i" button overlaps race column text at 1280 x 800.**
   When the race column is scrolled, the About "i" button overlaps its text. Three measured
   overlaps:
   - scroll 50 px: 15.1 x 19.4 px
   - scroll 300 px: 30.0 x 24.5 px
   - scroll 536 px: 1.3 x 17.0 px
3. **Clipped width of #card-scroll: 674 px against 375 px.** The bar-marker boxes make the
   scrollable content 674 px wide. The visible width is 375 px, and the checkpoint spec shows
   0 px of sideways overflow, so nothing scrolls sideways. This is recorded, not changed.

Checkpoint spec on the pinned layouts (result box positions):
- Phone finished: x 16, y 569.70, 343 x 94.98, inside 375 x 667.
- Desktop finished: x 869, y 445.06, 383 x 104.89, inside 1280 x 800.
- Phone strip, before the race and finished: strip 375 x 100 at y 83.09. The button is
  80 x 44 at x 287. The drawing, the one corner name ("Aliceanna & Bond", 82 x 16 px) and the
  marker (28 x 12.5 px) keep apart from the button and from each other.

## (b) Task 17

Built. Commit 4c467be draws the pair's stretch bright over dimmed route lines on desktop.
Commit 3360351 extends the bright stretch from corner to corner (it used to stop where the
marker stops, short of the destination).

## (c) Superseded tests that changed

All edits were mechanical or follow a superseded rule. No assertion was weakened, and no
golden value or facts file changed. Pipeline: one approved edit,
`tests/unit/test_emit.py::test_key_order_is_fixed` (wait_most added), plus fixture-only
additions in `tests/unit/test_output_schemas.py` (`race_row()`, `race_doc()`, `summary_doc()`),
recorded in d4ed061.

| Commit | File | Test | Why |
|---|---|---|---|
| 11f7fc3 (3.1) | web/tests/dom/playback.test.ts | racing and finished width assertions (3) | Trolley sizes now from VEHICLE_SIZES.phone.trolley |
| 11f7fc3 | web/tests/dom/vehicles.test.ts | trackless trolley build; route-number rear panel; narrower-than-cut-off; mockup 18 placement | New sizes. Route number shows only at 150 px, so these use the desktop trolley |
| 11f7fc3 | web/tests/dom/states.test.ts | builds No. 21, 1938 and the trolley number | Number expected on desktop, absent on phone |
| 11f7fc3 | web/tests/unit/tokens.test.ts | matches the vehicle sizes of config.ts; matches the phone zones of ui.md | New size keys, --map-strip-h added, --card-top check dropped (layout gone) |
| 87ebb2e (3.3) | web/tests/dom/board.test.ts | fills the next chip on each side only... | Bus row label is now BOARD_TODAY |
| 87ebb2e | web/tests/unit/copy-table.test.ts | rendered copy, frequency, everyMinutesOr, WHAT tests | Story-layer copy rows win over race-screen rows |
| 87ebb2e | web/tests/support/copytable.ts (helper) | n/a | Adds storyCopyTable and effectiveCopyTable |
| c5b9d96 (4.1) | web/tests/unit/state.test.ts | data/ready dispatches | Adds guided: false |
| cdfcd61 (5.1) | web/tests/dom/app.test.ts | starts at the New York time of day when it is inside the slider range, and says so | A clock start now needs a valid share link |
| cdfcd61 | web/tests/dom/states.test.ts | ready with the schedule line... ; names row.start in a notice... | Same: boots gain the lead pair's link |
| cdfcd61 | web/tests/dom/a11y.test.ts, sheets.test.ts, playback.test.ts | photo finish (the lead pair at 10:30) cases; playback finished-card test | Same |
| cdfcd61 | web/tests/support/states.ts | beforeTable and photoFinish states | Same |
| 398d425 (5.2) | web/tests/dom/playback.test.ts, app.test.ts, board.test.ts, a11y.test.ts, sheets.test.ts, web/tests/support/states.ts | timing waits | 2,000 ms first start on a guided visit; race-start mark set at first draw |
| 07b086d | web/tests/e2e/screens.spec.ts | TEN_OH_EIGHT, shoot(), phone race layout moments, vehicle front edge pause | Orientation pause added to waits (values only) |
| 07b086d | web/tests/e2e/race.spec.ts | first-race result wait, Skip wait, no-WebGL wait | Same |
| 07b086d | web/tests/e2e/perf.spec.ts | comment only | Mark name unchanged |
| 1d25dee (7.2) | web/tests/dom/states.test.ts | names row.start in a notice in place of the schedule line; shows the chip by its name and the caution | Schedule line stays under notices: toBeNull became not.toBeNull (race-screen R6.7 superseded) |
| 5d5ea80 (8.2) | web/tests/dom/vehicles.test.ts | vehicle sizes come from config.ts... | Reads sizes from screen-brief 3A.2 (same values) |
| 5d5ea80 | web/tests/dom/playback.test.ts | today marker --x | Read from .bar-marker, not the removed .runner |
| 76dadae (10.2) | web/tests/dom/card.test.ts | slider end labels; slider-time exclusion; loose-number scan | 12-hour end labels, new start row, chart readout |
| 76dadae | web/tests/dom/wording.test.ts | lineOf | Gains .start-row for the time rule |
| 76dadae | web/tests/unit/copy-table.test.ts | START_TIME row | Dropped. "Start time" added to REPLACED |
| 31341e8 (13.1) | web/tests/dom/board.test.ts, web/tests/dom/a11y.test.ts | board tests | Board now sits in the Scheduled departures section |
| 4cea529 (14.1) | web/tests/dom/shell.test.ts | writes no wording of its own | PHONE_INTRO added to allowed copy strings |
| 7f0a4d8 (15.1) | web/tests/dom/map.test.ts | credit line; Caroline Street; map chunk tests | On a phone the map loads only after View route: run on desktop or press View route first |
| 4805253 (16.1) | web/tests/unit/copy-table.test.ts | rendered map and kept-until list | METHOD_RIDE_VERDICTS removed. Old ride-same line added to REPLACED |
| 4805253 | web/tests/dom/wording.test.ts | COUNTS | Gains count-wins-today |
| 0c60ffd | web/tests/dom/pageflow.test.ts | page order | Chart now after the next-step actions, before departures |
| 0ab71a9 | web/tests/build/deploy.test.ts | serves committed data (listRepoFiles) | Skips tool caches (.git, .hypothesis, .pytest_cache, __pycache__, node_modules) |
| 5bdda57, 942f751 | deploy test; map area test | raw/ check; hidden strip names | Check made able to fail; hidden strip names allowed |
| 3360351 | web/tests/unit/mapstyle.test.ts | stretch starts and ends at the two corners | Stretch runs corner to corner |
| 158f338 (20.3) | web/tests/e2e/race.spec.ts | a whole race with the tile host blocked and no WebGL; axe "with the map drawn [map]"; axe "the map unavailable: the route drawing and the notice" | Phone presses View route first. Assertions unchanged. tabTo gained an optional limit |
| dd4b099 (23.1) | web/tests/e2e/screens.spec.ts | nine phone pictures (03, 04, 05, 06, 07, 10, 11, 12, 22) | Map loads only after View route. Now assert the strip is closed. Other assertions kept |
| dd4b099 | screens.spec.ts | phone race layout | Boxes visible below the card top and above the strip, strip is position static (Req 12.1) |
| dd4b099 | screens.spec.ts | vehicle front edges on the filled end of the ride (phone, laptop) | Renamed "illustrations stay put, finish mark and glow on each bar". Marker position is measured in race.spec.ts |
| dd4b099 | screens.spec.ts | desktop pair names on one line | Timeout scaled to the number of pairs |

Timeouts under load (not test edits): maplabels, nextsteps, routestrip and deploy tests hit
the 5 s limit during full runs on a busy machine. All pass alone. Vitest was set to 2
workers in b8b7462.

## (d) Performance

Five runs against the deployed page https://optimistic-max.github.io/Ghost-Line/:
2144, 2070, 1903, 1745, 1925 ms. Median 1925 ms, under the 5,000 ms limit.

The deployed page may predate the story layer. A run on a local build, on a quiet machine,
is left to Emmanuel (race-screen 23.4).

## (e) Budgets

- First load: 73,447 bytes compressed of 100,000, map chunk excluded.
- No new runtime dependency in web/package.json.

## (f) Test totals

- Pipeline pytest: 763 passed.
- npm test: 1011 passed in 70 files.
- test:e2e: 89 passed, 3 skipped.
- Checkpoint spec (re-run for this report): 12 passed.
