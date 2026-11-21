# Implementation Plan: Story Layer

## Overview

Implements `requirements.md` and `design.md` in this folder. "Req N.M" is a requirement and criterion of the story-layer requirements; "Property N" is a correctness property of the story-layer design; "R" and "P" numbers with no "Req" prefix point at the race-screen spec. Section numbers refer to the design.

## Rules for running these tasks

- Run in order, one task at a time. After each task run the tests for the files it touched; run the full `npm test` in web/ after every site task, and `python -m pipeline check` after every pipeline task. Commit "Task N: title" only when green, and include `.kiro/` in every commit.
- Stop and report to Emmanuel, without committing, on any of: a computed value that differs from a value in the requirements, the brief, a golden test or the data (for example the lead race at 10:00 not giving `wait_most` true); any fix that would edit a golden value, a facts file, a test expectation or a tolerance to make a check pass; any conflict between this spec and a steering file; any need for the network, a write under raw/ or a change under data/lines/.
- The one approved edit to an existing pipeline test is `tests/unit/test_emit.py::test_key_order_is_fixed` (decision 18, Req 1.11). Emmanuel also approved (during task 1.3) adding `"wait_most": False` to the rows of the `race_row()` helper in `tests/unit/test_output_schemas.py`; the task 1.11 commit message names that file as well. Emmanuel further approved, during task 1.3, fixture-only additions of `wait_most`, `ride_same_rule` or `sources.ride_same_rule` to test fixture and helper dicts where the schemas now require them (no assertion, expected value, threshold or test logic changes; golden tests, facts files and `test_key_order_is_fixed` not covered); the one file touched so far is `tests/unit/test_output_schemas.py` (`summary_doc()` gained `ride_same_rule` and its `sources` entry), and the task 1.11 commit message names every file touched this way. Every other existing pipeline test, every golden test and every facts file stays unchanged. Race-screen site tests that this spec supersedes may change only where a task below names them, and each commit message names every test it changes (Req 16.16).
- The site never computes a race result or compares waits (principle P-A). No count, time or minute value from the brief, the requirements or the data is typed into `web/src/` or into tests of the real data path. Every visible string comes from the story copy table or the race-screen copy table, the story-layer row winning (Req 13.8).
- Layout sizes are starting values: the 104 px and 150 px trolley, the 28 px markers and the 100 px route strip. If a picture or a geometry test shows a clip, an overlap or a phone-fit miss, record it for Emmanuel with the pixel amount and keep the size (Req 5.7, 6.10, 12.3, 12.7). Never shrink text or change a size to hide a problem.
- Windows: every npm script and hook command is one command, with no `&&`, pipes or shell-specific syntax.
- `web/public/data/` is written only by `python -m pipeline build`. Never edit it by hand. No network is needed by any task here.
- Property tests use Hypothesis (Python) and fast-check (TypeScript), at least 100 runs each, each tagged with a comment `Feature: story-layer, Property N: title`.
- Tests are part of the task that adds the behaviour, as in race-screen. Nothing here is marked optional except task 17, which the requirements say to cut first.

## Tasks

### Pipeline

- [x] 1. Wait-most flag and same-ride tolerance (Req 1, Req 2)
  - [x] 1.1 In `pipeline/emit.py` add `display_round_parts(parts, stored_total)` and `_wait_most(...)` as in design 1.1 and 1.2: the same rule as `web/src/format/rounding.ts` `roundParts` (inputs rounded at six decimals with `floor(x * 1e6 + 0.5) / 1e6`, totals with `floor(x + 0.5)`, remainder ties to the earlier phase, `ValidationError` naming pair and `t` when the parts cannot add up). Inputs are the emitted three-decimal values: 1938 `[wait, ride_min]`, today `[board walk, wait, ride_min, alight walk]`. `_race_doc` sets `wait_most` as the last key of every row, after `margin` when present. False for photo finish and no one-seat ride without rounding. Use `2 * d > margin` on integers.
    - Write `tests/unit/test_wait_most.py`: examples (a 1938 win with shown waits 31 and 6 and shown margin 30 gives true; a today win; a photo finish; a no-ride row; exactly half the margin gives false; the unreachable-rounding case raises `ValidationError`), and a source scan that `display_round_parts` is called only from `_wait_most`.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 1.10_
  - [x] 1.2 In `pipeline/emit.py` `_summary_doc` add `"ride_same_rule": {"minutes": _r(SAME_FLOOR_MIN), "fraction_pct": _r(SAME_FRACTION * 100)}` after `ride_slower_today`, importing the two constants from `pipeline/summary.py` (no number typed in emit; `fraction_pct` written as the integer 15 through `_r`). Add the one `summary.sources` entry `"ride_same_rule": ["method"]` so `check_source_coverage` passes (decision 17).
    - _Requirements: 2.1, 2.2, 2.6_
  - [x] 1.3 Schemas: `pipeline/schemas/race.schema.json` `$defs.RaceRow` gains `wait_most` (boolean) in `properties` and `required`; `pipeline/schemas/summary.schema.json` gains required `ride_same_rule` (object, required `minutes` and `fraction_pct` numbers, `additionalProperties: false`). Check both are still valid JSON Schema.
    - Approved during this task: Emmanuel approved adding `"wait_most": False` to the rows of the `race_row()` helper in `tests/unit/test_output_schemas.py`. The task 1.11 commit message names that file as well.
    - Also approved during this task: fixture-only additions of `wait_most`, `ride_same_rule` or `sources.ride_same_rule` to test fixture/helper dicts where the schemas now require them. Files touched this way: `tests/unit/test_output_schemas.py` (`summary_doc()` gained `"ride_same_rule": {"minutes": 1.5, "fraction_pct": 15}` and the `ride_same_rule` key in its `sources`). The task 1.11 commit message names every such file.
    - _Requirements: 1.5, 2.3_
  - [x] 1.4 Approved edit (decision 18): in `tests/unit/test_emit.py::test_key_order_is_fixed` add `"wait_most"` at the end of the expected row key list. Change nothing else in that test or file. The commit message of task 1.11 names this test.
    - _Requirements: 1.10, 1.11_
  - [x] 1.5 Write `tests/property/test_wait_most_properties.py`. **Property 1: The wait-most flag is the shown-wait predicate** (an independent oracle in the test; false for every photo finish and no-ride row). **Property 2: Python display rounding keeps the R7 invariants** (parts sum to the shown total, each within one minute of its stored part, whole parts unchanged, deterministic, shown total `floor(round6(total) + 0.5)`).
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.7**
  - [x] 1.6 Extend `tests/unit/test_summary.py` and `tests/unit/test_output_schemas.py` (new test functions only): `ride_same_rule` equals the two constants read through `pipeline/summary.py`, `fraction_pct` is the integer 15, `sources["ride_same_rule"] == ["method"]`, the schemas accept the new fields and reject a missing or extra key, and a row without `wait_most` is rejected.
    - _Requirements: 1.5, 2.1, 2.2, 2.3, 2.4_
  - [x] 1.7 Write `tests/golden/test_story_layer_golden.py` on the pinned feed (skips with a clear message when raw/ is missing): every row of every race file has a boolean `wait_most`; `wait_most` is false for every photo finish and no-ride row; the lead pair's `10:00` row is true (brief check 9). If it is not true, STOP and report to Emmanuel; do not change the test or the rule.
    - _Requirements: 1.6, 1.7_
  - [x] 1.8 Rebuild and compare, without committing yet: run `python -m pipeline build`. Then a one-off comparison script (not kept as a test, not committed): load each regenerated file and `git show HEAD:web/public/data/...`; drop `wait_most` from every row and `ride_same_rule` plus `sources.ride_same_rule` from the summary; require the two to be equal, including every other `sources` key. `index.json` and `route.geojson` must be byte-identical. Report the result. Any other difference: STOP and report.
    - Verified by: the comparison output, and `python -m pipeline validate`.
    - _Requirements: 1.9, 2.5, 2.6_
  - [x] 1.9 Site data layer, landing with the pipeline change (design Data Models): `web/src/data/types.ts` (`RaceRow.wait_most`, `RideSameRule`, `Summary.ride_same_rule`); `web/src/data/shape.ts` checks `wait_most` is a boolean on every row and `ride_same_rule` is an object with two finite numbers and nothing else; update `web/tests/fixtures/make-fake.mjs` to write `wait_most` on every made-up row (computed in test code from its own made-up totals, with one row where walking and riding make up most of the margin so it is false) and a made-up `ride_same_rule` that differs from the real file, then regenerate `web/tests/fixtures/fake/`. Extend the shape tests: all real files validate; mutated copies (missing, non-boolean `wait_most`; missing or extra `ride_same_rule` key) fail; the existing `shape-contract.test.ts` passes with the new schema fields.
    - Verified by: `npm test` in web/.
    - _Requirements: 1.5, 2.3, 16.8_
  - [x] 1.10 Write `web/tests/real/waitmost.test.ts`: **Property 13: Site rounding agrees with the stored flag on every real row.** For every row of all 20 committed race files, apply `roundParts` to the stored parts and the Req 1.2 predicate (kept in `web/tests/support/`, never in `src/`) to the shown values; the result equals the stored `wait_most`. Exhaustive, not sampled. A mismatch is a STOP and report.
    - **Validates: Requirements 1.8**
  - [x] 1.11 Full pipeline checks and commit: `python -m pipeline validate`, `python -m pipeline check`, `python -m pipeline verify`, `python -m pipeline check_sources`, then `npm test` in web/. Commit the 20 race files, `summary.json`, both schemas, the pipeline code and tests, the site data layer and `.kiro/` together. The commit message names `tests/unit/test_emit.py::test_key_order_is_fixed` as the one approved test edit.
    - Depends on: tasks 1.1 to 1.10
    - _Requirements: 1.9, 1.11, 2.5, 2.6_

- [ ] 2. Checkpoint: pipeline phase
  - Ensure all tests pass, ask the user if questions arise. Report to Emmanuel: lead `10:00` `wait_most` value, the comparison result, and the five command results.

## Site foundation

- [x] 3. Constants and copy (Req 3, Req 11.3, Req 13)
  - [x] 3.1 `web/src/config.ts`: add `EXAMPLE_START = '10:00'` beside `FALLBACK_START` (comment cites product.md, "the labelled example start"), `TIMINGS.orientationMs = 2000`, `VEHICLE_SIZES` as `{ phone: { trolley: 104, bus: 84, barMarker: 28, mapMarker: 28 }, desktop: { trolley: 150, bus: 104, barMarker: 28, mapMarker: 58 } }`, and `MAP_LAYOUT.phonePreview` (375 x 100 starting value). Update every use of the removed racing/finished trolley sizes so the build compiles; tests that assert the old sizes change only as needed and are named in the commit message.
    - Verified by: `npm run build`, the config test (any URL or credit text still in tech.md's list), `npm test`.
    - _Requirements: 3.1, 4.1, 5.2, 6.1, 12.3_
  - [x] 3.2 `web/src/copy/copy.ts` and `copy/announce.ts` untouched where unchanged; add one constant or template per story copy table row: example label, intro line, orientation line, the caption clauses with the `still` rule and `captionText(key)`, takeaway heading and rows, the "most of the difference" sentence, next-step labels, today-win notice, slider label and 12-hour ends, chart heading, prompt heading, subheading, legend, readout, hatch label, accessible name, "View route" and "Hide route", the departures button, `boardHeader` ("Scheduled departures after {h:mm}"), `BOARD_1938` ("1938 trolley, at this corner"), new `BOARD_TODAY` ("Today's bus, from the boarding stop"; `LANE_TITLE_TODAY` stays "Today's bus"), the honest lines with "covered starts", the "The {wins_today} races today wins" heading, the new "what a number is" lines, the walk-sum method line, the frequency sentence, `METHOD_RACE_COUNTS` with the covered-starts text (used by `races`, `wins_1938` and `wins_today`, decision 22) and `methodRideVerdicts(minutes, fractionPct)`. No caption template takes a number parameter.
    - _Requirements: 3.1, 7.2, 7.8, 8.1, 9.7, 9.12, 10.1, 11.3, 12.2, 13.1, 13.2, 13.3, 13.5, 13.7, 13.8_
  - [x] 3.3 Update the tests the copy change makes stale, and no others: `web/tests/dom/board.test.ts` (the bus row label now asserts `C.BOARD_TODAY`, the 1938 row `C.BOARD_1938`, the header follows `C.boardHeader`) and `web/tests/unit/copy-table.test.ts` (reads both copy tables, applies the story-layer-row-wins rule for rows the story table marks as replacing, adds `BOARD_TODAY` and the new `BOARD_1938` text). Grep `web/tests/` for any other assertion on a replaced string (honest lines, `METHOD_RACE_COUNTS`, "Start time" input name, 24-hour end labels, `trolleyFirst`) and change only those, each named in the commit message. The fixed-phrase and banned-word tests still pass.
    - Verified by: `npm test`.
    - Depends on: task 3.2
    - _Requirements: 13.8, 16.16, 16.20_

- [x] 4. State model, actions and lookups (Req 3.4, 3.5, 10.4 to 10.6, 11.2, 12.8)
  - [x] 4.1 `web/src/state/model.ts` and `actions.ts`: add `guided`, `oriented`, `todayWinNext`, `todayWinNotice`, `departuresOpen`, `routeOpen` and the actions of design 2.2 (`data/ready` takes `guided` and keeps the first value across a retry; `guided/end` idempotent; `race/oriented`; `todaywin/select`; `departures/toggle`; `route/toggle`; `pair/set`, `pair/swap`, `minute/set` and `minute/step` clear `todayWinNotice` when they change the pair or minute). `web/src/data/lookup.ts` gains `cycleAt(list, k)` returning the entry at `k mod n` and the next position.
    - _Requirements: 3.4, 3.5, 10.4, 10.5, 10.6, 11.2, 12.8_
  - [x] 4.2 Reducer property tests (fast-check). **Property 4: Guided parts end at the first Visitor_Input and stay gone** (over random action sequences; skip, sheets, departures and route toggles never change `guided`). **Property 10: The today-win shortcut walks the list in file order** (k presses select entry (k-1) mod n, with pair, minute, notice and `encode(pair)` agreeing; an empty list does nothing). **Property 11: The today-win notice leaves with the next pair or time change.**
    - **Validates: Requirements 3.4, 3.5, 4.5, 10.4, 10.5, 10.6**
    - Depends on: task 4.1

- [x] 5. Guided visit, orientation pause and the race-start mark (Req 3, Req 4)
  - [x] 5.1 `web/src/view/app.ts` boot (design 2.4): load as today, judge the link before `data/ready` (`valid = namesAPair(query) && !checked.bad && samePair(...)`), start from `EXAMPLE_START` with `guided: true` when not valid, else `defaultStart(now, first, last)` with `guided: false`; show the bad-link or shared-link banner as today; a query with neither `from` nor `to` is no query. Add `visitorInput()` dispatching `guided/end`, called from the slider input, minus, plus, the picker completing a pair (card and map), swap and each Next_Step_Action handler (wired in task 12), and not from skip, sheets, departures or route. Show the example label (time as plain text) and the chart prompt heading only while `guided`; drop both at the first Visitor_Input; keep "Start time is the time now." only for an unguided clock-derived start.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [x] 5.2 Orientation pause (design 2.5): `scheduleRace()` waits `TIMINGS.orientationMs` when `guided && !oriented && motion !== 'reduced'`, else the 300 ms pause; `startRace()` dispatches `race/oriented`; the card shows the orientation line in the caption area, the clock row and "Skip to result" during the pause; `skip` during a pending start cancels it, starts the race and skips to finished; a Visitor_Input during the pause runs `holdRace()` and the next start uses 300 ms; reduced motion runs no pause and draws the finished card with the orientation line while `guided && !oriented`. Move `performance.mark('race-start')` out of `startRace()` into `draw()` the first time a card with data is drawn; `tests/e2e/perf.spec.ts` keeps reading the same mark name. Name any race-screen test this changes in the commit message.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  - [x] 5.3 Tests. **Property 3: The start time follows the link's validity** (fast-check over query strings and instants). DOM tests `web/tests/dom/guided.test.ts` with fake timers: no query, bad link with banner, valid link with a fixed clock and no example label; the mark is set before the 2,000 ms pause; 2,000 ms then clock start; skip during the pause; input during the pause; reduced motion; after each kind of Visitor_Input the Guided_Parts are gone and stay gone and captions work on the next race.
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.7, 4.1, 4.4, 4.5, 4.6, 4.7, 16.2, 16.3**
    - Depends on: tasks 5.1, 5.2

- [x] 6. Checkpoint: site foundation
  - Ensure all tests pass, ask the user if questions arise. Run `npm test` and `npm run build` in web/ and `python -m pipeline check`.

## Story parts

- [x] 7. Captions (Req 7)
  - [x] 7.1 `web/src/state/captions.ts`: `captionFor` and `phaseOf` as in design 3.1, taking the phase from `play/timeline.ts` `laneFrame` so a caption never names a phase the lane is not in; both-arrived, 1938-only (no `still`) and orientation cases.
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.9_
  - [x] 7.2 Wiring: `view/card.ts` adds `<p class="caption" id="race-caption">` under the lanes, reserved at two lines in every state, plain text, outside `#result-status` and any live region; `view/racer.ts` rewrites it only when the key changes; the finished and skip states and reduced motion show the finished caption (or the orientation line on a guided visit); "Scheduled, not live." stays visible through the schedule line.
    - _Requirements: 7.1, 7.7, 7.9, 7.10, 7.13, 15.3, 15.4_
  - [x] 7.3 Tests. **Property 6: Captions name the phases the lanes show** (rows sampled from all 20 files and the fixtures, random elapsed times; `still` only while the other side has arrived). **Property 7: Caption text carries no number, no present-tense marker and no place** (no digit, no whole word "now" or "currently", no "at the stop", no street or corner name read from index.json, for every key including the orientation line). DOM tests `web/tests/dom/captions.test.ts` with fake timers: the caption sequence equals the sequence worked out in the test from stored boundaries for the lead race at 10:00, the first `summary.today_wins` entry (read from the file), the lead pair at 10:30, the lead pair at 9:00, one Brevard pair and the no-one-seat-ride fixture; the caption area is not in a live region; "Scheduled, not live." is visible at each of those moments.
    - **Validates: Requirements 7.2 to 7.13, 16.4, 16.5, 16.18**
    - Depends on: task 7.2

- [x] 8. Lane illustrations and bar markers (Req 5, Req 6)
  - [x] 8.1 `web/src/view/vehicles.ts`: add `busMarkerSvg` (small flat bus, `--today`, no glow). `web/src/view/layout.ts`: add `markerCentre(layout, frame, barPx, segGapPx)` (ride start before the ride, filled end during it, ride end after it; park position for reduced motion).
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.9_
  - [x] 8.2 `web/src/view/lanes.ts`, `view/racer.ts` and the lane CSS: each lane's title row holds its illustration (trolley at the config width with its two hairline wires; flat bus), the old travelling `.vehicle-row` runner is removed, a marker track (bar width plus half a marker each side, extended into `--pad`) holds one `.bar-marker` positioned by `transform: translateX` from `--x`; marker still before the ride and, for today, through both walks and the wait; the trolley no longer swaps size at the finish; bob, sparks, hubs and glow keyed to `.lane-1938.is-moving` only; no winner class on markers; only transform and opacity animated (the stylesheet scan test still passes). Name any race-screen test changed (vehicle sizes, the finish swap) in the commit message.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.5, 6.6, 6.7, 6.8_
  - [x] 8.3 Tests. **Property 5: Markers sit on the ride's filled end and move only during the ride** (random phase minutes with zeros, random elapsed times; non-decreasing, constant while walking or waiting, at the ride end at the finish). DOM tests: the box size of each illustration is the same before, during and after a race; the trolley route number appears only at 150 px; the bus has no pole, wire or glow.
    - **Validates: Requirements 5.3, 5.5, 5.6, 6.2, 6.3, 6.4, 6.5, 6.9**
    - Depends on: task 8.2

- [ ] 9. Where the time goes (Req 8)
  - [x] 9.1 `web/src/state/derive.ts`: add `takeaway` to `RaceView` from the lane legends' shown parts and `sumShown` of the two shown walks, with `waitMost` read from `row.wait_most` (no comparison anywhere in the site). `web/src/state/specs.ts`: `takeawayNumbers` (`take-wait-1938`, `take-ride-1938`, `take-wait-today`, `take-ride-today`, `take-walk-today` with `walk: true` and the sum method line). New `web/src/view/takeaway.ts`; `resultElements` appends it after the honest line, so it shows with the result box and at once under reduced motion; trolley rows only when there is no one-seat ride; the "most of the difference" sentence only when `waitMost`.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  - [x] 9.2 Tests. **Property 8: The takeaway repeats the lane values and follows the stored flag** (including a copy of the row with the flag flipped). DOM tests with real data and the fixture row where `wait_most` is false; the no-ride fixture shows trolley rows only; every takeaway number is a Number_Button with a Sources row.
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 16.8**
    - Depends on: task 9.1

- [ ] 10. Start-time chart and slider (Req 9)
  - [x] 10.1 `web/src/view/layout.ts`: `chartPlan(race)` and `chartPath(series, max, height)` as in design 6.1 (one column per row, step paths, shared scale from 0, hatch range from `before_table`, today series null when every row has no one-seat ride).
    - _Requirements: 9.3, 9.4, 9.5, 9.9_
  - [x] 10.2 New `web/src/view/chart.ts` and `view/slider.ts` split into `startRow` (example label while guided, large start time) and `sliderRow` (minus, input, plus, 12-hour ends from the first and last row `t`): inline SVG with `role="img"` and the accessible name, `viewBox` by column, `preserveAspectRatio="none"`, `pointer-events: none` and no listeners, two paths in `--ghost` and `--today`, hatched rect and its label, cursor moved by `transform`, heading (prompt heading while guided), subheading, legend, readout with Number_Buttons `readout-1938` and `readout-today` (specs as `total-1938` and `total-today`). Visible label "Choose a scheduled start time" and no `aria-label` "Start time". `--thumb` custom property shared by the slider thumb rules and the chart inset. `updateChart(minute)` on the held-slider path. A pair, swap or shortcut change redraws the chart from the new race file before the race starts, fetching nothing extra. Name any race-screen test changed (input name, end labels) in the commit message.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12_
  - [x] 10.3 Tests. **Property 9: The chart is the race file's stored totals** (random race files from the fixture generator and the 20 real files; readout equals `roundTotal` of the stored totals). DOM tests: columns, hatch, cursor, readout, prompt heading versus normal heading, no listeners; with the made-up race file the chart follows it; after every pair change, swap and shortcut the series equal the new file and the loader's fetch log has no extra race file.
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.7, 9.8, 9.9, 16.8, 16.9**
    - Depends on: task 10.2

- [ ] 11. Notices under the schedule line (decision 16, Req 7.13, Req 12.2)
  - [x] 11.1 `web/src/view/card.ts`: always render the schedule line ("... Scheduled, not live."), removing the race-screen condition that hid it while a notice showed (race-screen R6.7, superseded); render the before-the-table notice, the inferred-corner notice and the today-win notice in one `.notices` block directly after it. The today-win notice shows the pair names from index.json and the entry's `t` in 12-hour form as plain text (no Number_Button, no Sources row). Run `grep` for `.schedule` in `web/tests/`; change only the assertions that expect the line hidden while a notice shows, and name each in the commit message.
    - _Requirements: 7.13, 10.5, 12.2_
  - [x] 11.2 Write `web/tests/dom/notices.test.ts`: with each of the three notices showing, the schedule line containing "Scheduled, not live." is visible and the notice follows it directly in DOM order; the today-win notice and example label times contain no `button.num`.
    - **Validates: Requirements 3.8, 7.13, 10.5, 16.19**
    - Depends on: task 11.1

- [ ] 12. Next-step actions and the today-win shortcut (Req 10)
  - [ ] 12.1 New `web/src/view/nextsteps.ts` with the three buttons in order, each at least 44 x 44 px; `view/buttons.ts` `cardButtons()` becomes Sources and Share this race as outline secondary buttons after them. "Try another time": `visitorInput()`, focus `#start-time`, scroll it into view (a plain jump under reduced motion). "Try other corners": `visitorInput()`, `picker/open`. "Show a race today wins": `visitorInput()`, stop any race, close any sheet, `todaywin/select`, update the address bar through the existing `pair/set` subscription, and play that race when its file has arrived. Empty `today_wins` does nothing.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7, 10.8_
  - [ ] 12.2 Tests. DOM: order, keyboard reach, 44 px targets, focus moves to the slider, picker opens, each action ends the Guided_Parts. Real data `web/tests/real/todaywins.test.ts`: presses equal to `summary.today_wins.length` (read from the file) then one more to show the wrap, each with the address equal to `encode(pair)`, the notice shown and a race whose result is "today". Made-up summary: the order and notice follow the fixture (Req 16.6).
    - **Validates: Requirements 10.1 to 10.8, 16.6, 16.10**
    - Depends on: task 12.1

- [ ] 13. Scheduled departures section (Req 11)
  - [ ] 13.1 New `web/src/view/departures.ts` wrapping the existing `boardView` in a section with a `<button aria-expanded aria-controls>` "Scheduled departures" and a region hidden unless `departuresOpen`; `boardShown` true on both layouts and stages; `racer.finish()` keeps the board; `view/board.ts` uses `BOARD_TODAY` for the bus row. Board content rules (R8.2, R8.3, R8.5) unchanged. Number buttons inside a closed section still register their Sources rows.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  - [ ] 13.2 DOM tests: closed by default, `aria-expanded` toggles, labels, every time and gap is a Number_Button when open, the P3 crawl finds a registry row for each whether open or closed, board contents equal the file's lists.
    - **Validates: Requirements 11.1 to 11.5**
    - Depends on: task 13.1

- [ ] 14. Phone reading order and page flow (Req 12.1, 12.2, 12.4 to 12.7, 12.11)
  - [ ] 14.1 `web/index.html` adds the phone-only intro line (text equal to the `copy.ts` constant); `styles/layout-phone.css`: `.app` loses `height: 100dvh; overflow: hidden`, `.card-scroll` loses its inside scrolling and bottom padding, `.card-buttons` loses the pinned strip and flows after the content; the phone pair row is two lines (origin, then "→ destination") with the swap button; the DOM order is as Req 12.2 for phone and the same from the pair names down on desktop. Sheets, scrim and banners stay overlays; the scrim is `display: none` with no sheet; on a phone the banner is a compact strip at the top of the viewport that never covers the result box or the Next_Step_Actions, and its close control always clears it. No text size is reduced.
    - _Requirements: 12.1, 12.2, 12.4, 12.5, 12.11_
  - [ ] 14.2 Tests. DOM: the order of Req 12.2 on both layouts including the notices directly under the schedule line; the intro line equals the constant. jsdom/CSS scan: no `position: fixed` or `sticky` rule displays on a phone with no sheet and no banner. (The geometry checks run in task 20.)
    - **Validates: Requirements 12.1, 12.2, 12.4, 16.12**
    - Depends on: task 14.1

- [ ] 15. Route preview on phones (Req 12.3, 12.8 to 12.10)
  - [ ] 15.1 `web/src/view/mapview.ts` and `map/routedrawing.ts`: on a phone the map area is the 100 px strip of the bundled route drawing with the two chosen corners and a "View route" button, with no MapLibre code and no tile request until it is pressed; pressing it dispatches `route/toggle`, expands to the 150 px map, lazy-imports `map/map` and reads "Hide route"; "Hide route" calls `stopMap()` (no map instance, no further tiles), redraws the strip and does not stay open. Desktop keeps the idle load and shows no preview or toggle. `route.geojson` still loads after the card is on screen on both layouts; a failure shows "Map unavailable." and the toggle still tries the map. The race never waits for either.
    - _Requirements: 12.3, 12.8, 12.9, 12.10, 14.3_
  - [ ] 15.2 DOM tests for the toggle states, `aria-expanded`, the strip versus the map drawing, desktop having no toggle, and the failure paths (import, WebGL, tile) leaving the race unaffected. The request-log checks run in task 20.
    - **Validates: Requirements 12.3, 12.8, 12.9, 12.10**
    - Depends on: task 15.1

- [ ] 16. Sources specs and counts (Req 2, Req 13)
  - [ ] 16.1 `web/src/state/specs.ts` and `view/sheets/sources.ts`: the `races`, `wins_1938` and `wins_today` rows use the covered-starts method line; the ride-same row fills `methodRideVerdicts` with `String(summary.ride_same_rule.minutes)` and `String(summary.ride_same_rule.fraction_pct)` as plain text (no Number_Button); the "When today wins" sheet heading "The {wins_today} races today wins" with `wins_today` as Number_Button `count-wins-today` ("covered starts where today's bus arrives first"); the replaced "what a number is" lines; the frequency sentence; the honest lines with counts read from `summary.json`.
    - _Requirements: 2.1, 13.1, 13.2, 13.3, 13.4, 13.6_
  - [ ] 16.2 Tests. **Property 12: The tolerance line shows the file's numbers** (any finite non-negative minutes and percentage; plain text, no Number_Button). Made-up summary: every count, the heading, the shortcut order and the Sources method lines show the fixture's values; the three counts show the covered-starts line; `today_wins` list length equals the file's.
    - **Validates: Requirements 2.1, 13.2, 13.3, 13.4, 13.6, 16.6**
    - Depends on: task 16.1

- [ ] 17. Map dimming on desktop (cut first if late; Req 14)
  - [ ] 17.1 Only if time allows, and only after task 18 is otherwise green: `web/src/map/map.ts` and `map/style.ts` add a source for the selected pair's stretch (the polyline `layout.ts` `markerTrack` builds), drawn bright over the route, with the route lines at lower `line-opacity`; symbol layers keep opacity at 0.8 or more; updated on pair change through `map.corners(plan)`; phone and fallback drawing unchanged. Extend the `style.ts` unit test (no label below 80% opacity). If skipped, record it as cut in the final report; nothing else depends on it.
    - _Requirements: 14.1, 14.2, 14.3_

- [ ] 18. Checkpoint: site features
  - Ensure all tests pass, ask the user if questions arise. Run `npm test`, `npm run build` and `npm run check:size` in web/. Report to Emmanuel whether task 17 is built or cut.

## Cross-cutting tests, pictures and budgets

- [ ] 19. Rule tests across the whole screen (Req 13, Req 15, Req 16)
  - [ ] 19.1 Extend `web/tests/dom/wording.test.ts` and the P3 crawl: every new part and state (first visit, racing with a caption, finished with takeaway, today-win notice, open departures, expanded route preview, no-ride fixture) has no banned word except "Scheduled, not live." and "Start time is the time now."; no "citywide"; every time carries "scheduled"; walks say "estimate"; every new number is a Number_Button with a Sources row; singular for 1 in every new minute string. Extend the count test: a made-up summary changes every count on screen.
    - _Requirements: 13.4, 13.5, 13.6, 13.7, 16.6, 16.11_
  - [ ] 19.2 Digit scan and principle test: no digit string from the real `summary.json` appears under `web/src/` (extending race-screen 19.3), and `web/tests/unit/principle.test.ts` passes with its allowlist unchanged (all new arithmetic is in `format/rounding.ts`, `format/gaps.ts`, `format/time.ts`, `play/timeline.ts`, `play/clock.ts`, `view/layout.ts` or `data/lookup.ts`).
    - _Requirements: 8.7, 16.7_
  - [ ] 19.3 Extend the made-up race file test set: chart columns equal its stored totals, its before-table minutes are hatched, the readout, takeaway, "most of the difference" sentence (one row with `wait_most` false) and captions follow the fixture.
    - _Requirements: 16.8_
  - [ ] 19.4 axe-core in jsdom and keyboard tests: the first visit, racing, finished, the today-win notice, the open departures section and the expanded route preview, on both layouts; keyboard alone reaches the three Next_Step_Actions, the chart readout buttons, the departures toggle and the route toggle, each with a visible focus ring; the result is announced once per race and the caption area is never in a live region.
    - _Requirements: 15.1, 15.2, 15.3, 15.4_
  - Depends on: tasks 7 to 16

- [ ] 20. Playwright end to end (Req 5, 6, 9, 12, 14, 16)
  - [ ] 20.1 `web/tests/e2e/race.spec.ts` (extend): marker geometry for the lead race at 10:00 at ten clock moments on 375 x 667 and 1280 x 800, with the trolley marker travelling its full ride segment within 1 px; illustration box sizes unchanged at three moments; chart cursor and slider thumb centre within 1 px at the first, middle and last minute.
    - _Requirements: 5.3, 6.3, 9.1, 16.1_
  - [ ] 20.2 `race.spec.ts` (extend): no sideways scroll at 320, 375 and 899 px; with no sheet and no banner no displayed element is fixed or sticky and nothing scrolls inside the card, and the DOM order matches Req 12.2; request log with no MapLibre chunk and no tile host until "View route", and after "Hide route" no map instance and no further tile requests; a bad-link Guided_Visit at 375 x 667 and 320 wide, at the result moment, the banner's box does not intersect the result box or any Next_Step_Action box (overlaps are reported by pixels, not fixed by shrinking); "Scheduled, not live." visible while each notice shows.
    - _Requirements: 7.13, 12.1, 12.2, 12.3, 12.6, 12.9, 12.11, 16.12, 16.19_
  - [ ] 20.3 `race.spec.ts` (extend): the whole story with the tile host blocked and WebGL absent; reduced motion (finished at once, takeaway shown at once, no caption sequence); the first race reaches `race-start` before the pause (the mark is present and earlier than the clock start); the keyboard-only run now includes the new controls; axe in the browser with every rule on for the new states on both layouts.
    - _Requirements: 4.7, 14.3, 15.1, 15.2, 15.4, 16.14_
  - Depends on: tasks 19.1 to 19.4

- [ ] 21. Layout report and pictures (Req 5.7, 6.10, 12.3, 12.7, 16.15)
  - [ ] 21.1 `web/tests/e2e/screens.spec.ts` (extend) with the layout report of design section 9, on the phone (375 x 667) and laptop (1280 x 800) projects, using `getBoundingClientRect`: illustration against its title and total (overlap, clip, row growth); markers (clipped at either track end, overlapping another lane's content, wider than their ride segment); the 100 px strip (credit line, toggle and route drawing overlap); the banner against the result box and Next_Step_Action boxes at 375 x 667 and 320 wide; and the phone fit at the lead example's result moment (bottom of the caption area and of the result line against 667, with the pixels cut off). Each finding is written as a line to `web/test-results/story-layout-report.md` (git-ignored) and attached as a test annotation. The step never fails the run and never changes a size. A separate failing assertion covers only no sideways scroll at 320, 375 and 899 px.
    - _Requirements: 5.7, 6.10, 12.3, 12.6, 12.7, 12.11, 16.19_
  - [ ] 21.2 `npm run screens` adds pictures of the first visit, racing with a caption, finished with the takeaway, the today-win notice, the chart, and the phone page at the lead example's result moment. Run it (no network needed beyond the dev server) and copy the report's lines into the task summary for Emmanuel.
    - _Requirements: 16.15_
    - Depends on: task 21.1

- [ ] 22. Budgets and timing (Req 16.13, 16.14)
  - [ ] 22.1 Run `npm run check:size` (first-screen under 100,000 bytes compressed, map chunk excluded, no new runtime dependency in `web/package.json`) and the `web/tests/build/budget.test.ts` checks (no static import of the map chunk; the dynamic import in `app.ts` remains the only reference). Confirm `npm run perf` still reads the `race-start` mark and the median stays under 5,000 ms; on a slow or noisy machine report the five runs to Emmanuel and leave the quiet-machine run to him (race-screen 23.4). If the size is over budget, STOP and report which file grew.
    - _Requirements: 4.7, 16.13, 16.14_
  - Depends on: task 20

## Final validation

- [ ] 23. Final checkpoint
  - [ ] 23.1 Run, each as its own command: `python -m pipeline check`, `python -m pipeline verify`, `python -m pipeline check_sources`, then in web/ `npm test`, `npm run build`, `npm run test:e2e`, `npm run check:size`. All must pass, including every race-screen and race-engine test (Req 16.17), with every golden value and facts file unchanged since task 1.
  - [ ] 23.2 Write the report for Emmanuel: any layout finding from the report file with its pixel amount (104, 150, 28 and 100 px kept); whether task 17 was built or cut; every superseded race-screen test that changed; the perf numbers. Do not change a size, a text size, a golden value or a test to clear a finding.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- The data change lands first and alone with its schema, shape validators and fixtures, so the site never reads a file the validators reject.
- `.kiro/` is committed with every change and never ignored.
- Race-screen tasks follow the convention that tests belong to their task and are not optional, so none of these sub-tasks carries the `*` mark. Task 17 is the cut-first item.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "1.6", "1.7"] },
    { "id": 3, "tasks": ["1.8"] },
    { "id": 4, "tasks": ["1.9"] },
    { "id": 5, "tasks": ["1.10"] },
    { "id": 6, "tasks": ["1.11"] },
    { "id": 7, "tasks": ["3.1"] },
    { "id": 8, "tasks": ["3.2"] },
    { "id": 9, "tasks": ["3.3", "4.1"] },
    { "id": 10, "tasks": ["4.2", "5.1"] },
    { "id": 11, "tasks": ["5.2"] },
    { "id": 12, "tasks": ["5.3"] },
    { "id": 13, "tasks": ["7.1"] },
    { "id": 14, "tasks": ["7.2"] },
    { "id": 15, "tasks": ["7.3", "8.1"] },
    { "id": 16, "tasks": ["8.2"] },
    { "id": 17, "tasks": ["8.3"] },
    { "id": 18, "tasks": ["9.1"] },
    { "id": 19, "tasks": ["9.2", "10.1"] },
    { "id": 20, "tasks": ["10.2"] },
    { "id": 21, "tasks": ["10.3", "11.1"] },
    { "id": 22, "tasks": ["11.2", "12.1"] },
    { "id": 23, "tasks": ["12.2"] },
    { "id": 24, "tasks": ["13.1"] },
    { "id": 25, "tasks": ["13.2"] },
    { "id": 26, "tasks": ["14.1"] },
    { "id": 27, "tasks": ["14.2", "15.1"] },
    { "id": 28, "tasks": ["15.2", "16.1"] },
    { "id": 29, "tasks": ["16.2", "17.1"] },
    { "id": 30, "tasks": ["19.1", "19.3", "19.4"] },
    { "id": 31, "tasks": ["19.2"] },
    { "id": 32, "tasks": ["20.1", "21.1"] },
    { "id": 33, "tasks": ["20.2", "21.2"] },
    { "id": 34, "tasks": ["20.3"] },
    { "id": 35, "tasks": ["22.1"] },
    { "id": 36, "tasks": ["23.1"] },
    { "id": 37, "tasks": ["23.2"] }
  ]
}
```
