# Story Layer: Design

## Overview

This design implements `requirements.md` in this folder (Requirements 1 to 16, decisions 1 to 15). It extends the race-screen design (`.kiro/specs/race-screen/design.md`) and changes it only where the story-layer requirements say so. The race-screen principles P-A to P-E, its data contract and its correctness properties P1 to P13 still hold. The race-engine pipeline structure (one module per step, all three-decimal rounding in `pipeline/emit.py`) is unchanged.

Status: approved by Emmanuel with his answers to the open questions folded in (requirements decisions 16 to 23). Nothing is built. The answers are recorded at the end under "Open questions (all resolved)".

The work splits in two:

1. **Pipeline (Requirements 1 and 2).** `pipeline/emit.py` gains one display-rounding function and writes `wait_most` on every race row; `summary.json` gains `ride_same_rule`. Both schemas change. All 20 race files and `summary.json` are rebuilt and committed. No other value changes.
2. **Site (Requirements 3 to 16).** New view parts (example label, orientation line, captions, takeaway, start-time chart, next-step actions, departures section, route preview), a guided-visit flag in the store, bar markers in place of travelling vehicles, and a phone layout in normal page flow. The site still only looks up, rounds, lays out and animates. It reads `wait_most`; it never compares waits.

What the browser computes stays inside the seven modules that `web/tests/unit/principle.test.ts` allows to do arithmetic (`format/rounding.ts`, `format/gaps.ts`, `format/time.ts`, `play/timeline.ts`, `play/clock.ts`, `view/layout.ts`, `data/lookup.ts`). Every new piece of arithmetic in this design is placed in one of them, so that test's whitelist does not change.

### Research and findings that shape the design

The design was checked against the code and the committed data, not only the briefs. Findings:

- **The lead race at 10:00.** `web/public/data/race/preston-caroline__aliceanna-bond.json`, row `10:00`: `y1938` wait 6, total 15, ride_min 9; today wait 30.458, total 45.156, trip 2 with walks 2.258 and 4.156 and ride 8.283. The race-screen rounding gives shown totals 15 and 45, shown parts 1938 (6, 9) and today (2, 31, 8, 4), shown margin 30. The loser's shown wait minus the winner's is 31 − 6 = 25, more than 15, so `wait_most` is true, as brief check 9 expects.
- **Summary.** `summary.json` has `races` 5666, `wins_1938` 5582, `wins_today` 25, 25 entries in `today_wins` (first: Westwood & Carey → Dolphin & Myrtle at 11:23). These values are named here only to confirm Requirement 16.10's "count read from the file"; no code or test of the real data path types them (race-screen P-C).
- **Float residue.** In Python `0.15 * 100` is `15.000000000000002`. Requirement 2.2 needs `fraction_pct` written as exactly 15, so the value goes through `emit._r` (three decimals, whole numbers as integers), which writes `15`.
- **Rounding parity.** The site's `roundParts` (`web/src/format/rounding.ts`) rounds inputs at six decimals with `Math.round(x * 1e6) / 1e6`, rounds totals with `Math.floor(x + 0.5)`, and breaks fraction ties by phase order. Python's `round()` rounds halves to even, so the Python copy must use `math.floor(x * 1e6 + 0.5) / 1e6` and `math.floor(x + 0.5)` to give the same answer on the same IEEE doubles. It must also start from the emitted three-decimal values, because those are what the site reads.
- **Source coverage.** `emit.check_source_coverage` fails any top-level numeric field of `summary.json` that has no entry in `summary.sources`. `ride_same_rule` holds numbers, so it needs an entry, which changes the value of `summary.sources`. Requirement 2.6 allows exactly this one added entry (Q2, resolved: decision 17).
- **Key-order test.** `tests/unit/test_emit.py::test_key_order_is_fixed` asserts the exact key list of a race row. Adding `wait_most` makes it fail. Emmanuel approved adding `"wait_most"` at the end of that list (Q3, resolved: decision 18, Requirement 1.11). It is the only existing pipeline test expectation that changes.
- **"Scheduled, not live." under notices.** The phrase is the end of the schedule line (`copy.ready`). Race-screen R6.7 hid the schedule line while a notice showed (before the table, inferred corner). Emmanuel decided the schedule line stays visible and the notices sit directly under it (Q1, resolved: decision 16). Race-screen R6.7 carries a superseded pointer. The card change is in section 7.
- **First-screen budget.** `npm run check:size` today: 67.5 KB of the 100 KB budget (JS 31.2 KB, CSS 6.0 KB, font 22.3 KB, the three data files 7.1 KB, all gzip). The map chunks (302.7 KB and 1.6 KB) are not counted. The lead race file is 4.8 KB gzip; 293 `wait_most` flags add a few hundred bytes after gzip. Largest race file is 5.8 KB gzip against the pipeline's 20 KB limit.
- **The map loads on its own today.** `view/mapview.ts` starts the MapLibre chunk on idle on both layouts. Requirement 12.3 needs no MapLibre code and no tile request on a phone until "View route" is pressed, so the phone path changes; desktop keeps the idle load.
- **Slider geometry.** A native range input's thumb centre travels from half a thumb width in from the left edge to half a thumb width in from the right edge. For each slider minute to line up with its chart column (Requirement 9.1), the chart is inset by half the thumb width on both sides, with the thumb width as one CSS custom property used by both.

## Architecture

```mermaid
flowchart LR
  subgraph Pipeline [pipeline/ (Python)]
    race[race.py<br/>RaceRow, full precision] --> emit
    summary[summary.py<br/>SAME_FLOOR_MIN, SAME_FRACTION] --> emit
    emit[emit.py<br/>_r three decimals<br/>display_round_parts + wait_most<br/>ride_same_rule] --> files
    schemas[schemas/race + summary<br/>.schema.json] --> emit
  end
  files[(web/public/data<br/>20 race files: + wait_most<br/>summary.json: + ride_same_rule)]
  subgraph Site [web/src (TypeScript)]
    load[data/load + shape] --> store
    store[state/store<br/>+ guided, todayWin, departuresOpen, routeOpen] --> derive
    derive[state/derive<br/>RaceView + takeaway + chart view] --> card
    timeline[play/timeline<br/>laneFrame, markerAt] --> racer
    captions[state/captions<br/>phases to caption keys] --> racer
    card[view/card + new parts] --> racer[view/racer<br/>markers, captions]
    mapview[view/mapview<br/>phone preview gate] -.lazy import on View route / idle on desktop.-> map[map/map.ts chunk]
  end
  files --> load
```

### Where each requirement lives

| Concern | Module (existing unless marked new) | Arithmetic? |
| --- | --- | --- |
| R7 rounding in Python, `wait_most` | `pipeline/emit.py`: `display_round_parts`, `_wait_most` | yes, pipeline |
| `ride_same_rule` | `pipeline/emit.py`: `_summary_doc` reads `pipeline/summary.py` constants | `_r` only |
| Guided visit, today-win cycling, notices, toggles | `state/actions.ts`, `state/model.ts` | no (cycle index from `data/lookup.ts`) |
| Example start | `config.ts` (`EXAMPLE_START`), `view/app.ts` boot | no |
| Caption choice | new `state/captions.ts` | no |
| Caption, takeaway, chart, notice strings | `copy/copy.ts` | no |
| Bar marker position | `play/timeline.ts` (`laneFrame`) and `view/layout.ts` | yes, allowed |
| Chart geometry (columns, scale, hatch range, cursor) | `view/layout.ts`: new `chartPlan` | yes, allowed |
| Chart drawing | new `view/chart.ts` | no |
| Takeaway | new `view/takeaway.ts`; values from `state/derive.ts` | sums via `format/rounding.ts` `sumShown` |
| Next-step actions, secondary buttons | `view/buttons.ts`, new `view/nextsteps.ts` | no |
| Departures section | `view/board.ts` wrapped by new `view/departures.ts` | no |
| Route preview (phone) | `view/mapview.ts`, `map/routedrawing.ts` | geometry stays in `layout.ts` |
| Map dimming (desktop, cut first) | `map/map.ts`, `map/style.ts` | geometry in `layout.ts` |
| Phone flow | `styles/layout-phone.css`, `index.html` | no |
| Layout report to Emmanuel | `tests/e2e/screens.spec.ts` | test code |

## Components and Interfaces

### 1. Pipeline

#### 1.1 Display rounding in Python (Requirement 1.4)

One function, in `pipeline/emit.py` next to `_r`, because emit is where every rounding of emitted values already lives and the flag must be computed from emitted values. No new pipeline module is added (structure.md lists the modules).

```python
def display_round_parts(parts: list[float], stored_total: float) -> tuple[int, list[int]]:
    """Race-screen R7 display rounding, the same rule as web/src/format/rounding.ts roundParts.

    Used only by _wait_most. Never used for a stored value.
    shown_total = floor(round6(stored_total) + 0.5); each part floors; the missing
    minutes go one each to the largest fractional remainders, ties to the earlier
    phase. round6(x) = floor(x * 1e6 + 0.5) / 1e6 (Math.round for x >= 0).
    Raises ValidationError when the parts cannot add up to the shown total with
    each part within one minute (the site's RoundingError case).
    """
```

The inputs are the values as emitted, after `_r`: for 1938 `[row["y1938"]["wait"], doc["y1938"]["ride_min"]]` with total `row["y1938"]["total"]`; for today `[trip["board"]["walk_min"], row["today"]["wait"], trip["ride_min"], trip["alight"]["walk_min"]]` with total `row["today"]["total"]`, where `trip` is the emitted trip at index `row["today"]["trip"]`. These are exactly the arrays `state/derive.ts` passes to `roundParts` (`lane1938`, `laneToday`), so the two languages round the same doubles the same way.

A source scan test checks that `display_round_parts` is called from `_wait_most` only.

#### 1.2 The flag (Requirements 1.1 to 1.3)

```python
def _wait_most(result: str, parts_1938, total_1938, parts_today, total_today) -> bool:
    """True only for a win where the loser's shown wait minus the winner's shown
    wait is more than half the shown margin, all as display-rounded values."""
```

- `result` "photo_finish" or "no_one_seat_ride" returns False without rounding.
- Otherwise: `t38, s38 = display_round_parts(parts_1938, total_1938)`, `tt, st = display_round_parts(parts_today, total_today)`, `wait38 = s38[0]`, `wait_today = st[1]`, `margin = abs(t38 - tt)`. For "1938" the loser is today: `d = wait_today - wait38`; for "today", `d = wait38 - wait_today`. Return `2 * d > margin`, which compares integers and avoids a half.

`_race_doc` builds the trips list first, then each row with `_race_row`, then sets `out["wait_most"]` from the row's emitted values and the emitted trip. Key position (decision 18): the last key of the row, after `margin` when present.

`margin` stays as stored (`row.margin`, three decimals). The shown margin used inside the flag is never written.

#### 1.3 `ride_same_rule` (Requirement 2)

`_summary_doc` adds, after `ride_slower_today`:

```python
"ride_same_rule": {"minutes": _r(SAME_FLOOR_MIN), "fraction_pct": _r(SAME_FRACTION * 100)},
```

`SAME_FLOOR_MIN` and `SAME_FRACTION` are imported from `pipeline/summary.py`; no number is typed in emit. `_r` gives `1.5` and `15`. The source mapping needed by `check_source_coverage` is the one added entry `"ride_same_rule": ["method"]` in `summary.sources` (decision 17).

#### 1.4 Schemas

- `pipeline/schemas/race.schema.json`, `$defs.RaceRow`: add `"wait_most": {"type": "boolean"}` to `properties` and to `required`. The row keeps `additionalProperties: false`.
- `pipeline/schemas/summary.schema.json`: add `ride_same_rule` to `required` and `properties` as `{"type": "object", "required": ["minutes", "fraction_pct"], "additionalProperties": false, "properties": {"minutes": {"type": "number"}, "fraction_pct": {"type": "number"}}}`. `summary.sources` gains `ride_same_rule: ["method"]` under its existing `additionalProperties` rule, with no schema change needed there.

#### 1.5 Rebuild and commit (Requirements 1.9, 2.5, 2.6)

One task makes both changes, runs `python -m pipeline build`, and commits the 20 race files, `summary.json` and both schemas together. Before committing, the task runs a one-off comparison (not a lasting test): load each regenerated file and the version at `HEAD` (`git show HEAD:web/public/data/...`), drop `wait_most` from every row, and `ride_same_rule` plus its one `sources.ride_same_rule` entry from the summary, and require the two to be equal. The comparison also fails if any other `sources` key differs. `index.json` and `route.geojson` must be byte-identical. Then `python -m pipeline validate`, `check`, `verify` and `check_sources` must pass, with every golden test unchanged.

### 2. Site state

#### 2.1 New state fields (`state/model.ts`)

```ts
type AppState = {
  ...existing,
  /** Requirement 3: true from data ready on a visit without a valid share link, until the first Visitor_Input. */
  guided: boolean;
  /** Requirement 4: the orientation pause has run (or been skipped) in this visit. */
  oriented: boolean;
  /** Requirement 10.4: the index of the next summary.today_wins entry the shortcut selects. */
  todayWinNext: number;
  /** Requirement 10.5: the entry the shortcut selected, while its notice shows. */
  todayWinNotice: TodayWin | null;
  /** Requirement 11.2: the departures section is open. */
  departuresOpen: boolean;
  /** Requirement 12.8: the phone route preview is expanded. */
  routeOpen: boolean;
};
```

#### 2.2 New actions (`state/actions.ts`, pure reducers)

| Action | Effect |
| --- | --- |
| `data/ready` gains `guided: boolean` | sets `guided` on the first ready only (a retry keeps the visit's value) |
| `guided/end` | `guided: false`. Idempotent. |
| `race/oriented` | `oriented: true` |
| `todaywin/select` | reads `summary.today_wins` at `todayWinNext` through `cycleAt` (`data/lookup.ts`), sets pair and minute through the existing `setPair` and `setMinute`, then `todayWinNotice` to that entry and `todayWinNext` to the next position |
| `departures/toggle` | flips `departuresOpen` |
| `route/toggle` | flips `routeOpen` (phone only; ignored on desktop by the view) |
| `pair/set`, `pair/swap`, `minute/set`, `minute/step` | as today, and also clear `todayWinNotice` when they change the pair or the minute (Requirement 10.6) |

`cycleAt(list, k)` returns `{ entry: list[k mod n], next: (k + 1) mod n }`; it is a lookup by position and lives in `data/lookup.ts`. With an empty `today_wins` the shortcut does nothing; on the real data the list has entries.

#### 2.3 Visitor_Input (Requirements 3.5, 4.5)

`view/app.ts` has one helper, `visitorInput()`, that dispatches `guided/end`. It is called, before the action's own handling, from exactly the handlers the glossary lists:

- the slider `input` event, `minus`, `plus`;
- the corner picker when it completes a pair (`picker/choose` in its second step, from the sheet or from the map);
- `swap`;
- each of the three Next_Step_Actions.

It is not called for "Skip to result", opening any sheet, the departures toggle or the route toggle. A DOM test fires every kind of input and checks the Guided_Parts are gone and stay gone (Requirement 16.3).

#### 2.4 The guided-visit state machine (Requirements 3, 4)

```mermaid
stateDiagram-v2
  [*] --> Booting
  Booting --> Shared: query names a pair and it is valid
  Booting --> Guided: no query, a query with neither from nor to, or a bad link
  Shared --> Racing: default start = R3.4 clock time, 300 ms pause
  Guided --> Orienting: card drawn at 10:00 with example label, chart prompt and orientation line; race-start mark
  Orienting --> Racing: 2,000 ms pass
  Orienting --> Finished: Skip to result (pause and race skipped)
  Orienting --> Unguided: Visitor_Input (pause ends, input handled as in race-screen)
  Racing --> Finished
  Racing --> Unguided: Visitor_Input
  Finished --> Unguided: Visitor_Input
  Unguided --> Racing: 300 ms after the input
  note right of Guided
    Reduced motion: no Orienting; the card is drawn finished,
    the caption area shows the orientation line.
  end note
```

Boot (`view/app.ts` `boot`) is reordered so the link is judged before `data/ready`:

1. Load as today (the named pair first, the lead pair on failure).
2. `checked = decode(query, index slugs)`; `valid = namesAPair(query) && !checked.bad && samePair(checked.pair, pair)`.
3. `start = valid ? defaultStart(now, first, last) : { minute: minutesOf(EXAMPLE_START), fromClock: false }`.
4. Dispatch `data/ready` with `start` and `guided: !valid`; show the shared or bad-link banner as today.

`EXAMPLE_START = '10:00'` is added to `config.ts` beside `FALLBACK_START`, citing product.md ("the labelled example start, 10:00 AM"). It is a product rule, not data, like `FALLBACK_START`.

A query with neither `from` nor `to` (for example only a tracking tag) counts as no query, which is how race-screen `decode` already treats it (`bad` false, no banner).

#### 2.5 Orientation pause and the race-start mark (Requirements 4, 16.14)

In `view/app.ts`:

- `draw()` calls `timers.mark('race-start')` the first time it draws a card with data (any stage). On the Guided_First_Race that card already shows the orientation line in the caption area. The mark moves out of `startRace()`, so neither the 2,000 ms pause nor the 300 ms pause counts against the 5,000 ms limit. `tests/e2e/perf.spec.ts` keeps reading the same mark name.
- `scheduleRace()` uses `TIMINGS.orientationMs` (new, 2000) when `guided && !oriented && motion !== 'reduced'`, else `TIMINGS.racePauseMs`. `startRace()` dispatches `race/oriented`.
- During the pause the card is in the racing stage at elapsed 0, so the clock row and "Skip to result" are already on screen (Requirement 4.3). The `skip` handler gains one branch: if a start is pending, `cancelStart()`, `startRace()`, then `clock.skip()`. The orientation line is replaced by the finished caption.
- A Visitor_Input during the pause runs `holdRace()` as today, which cancels the pending start; `guided/end` makes the next start use the 300 ms pause.
- Reduced motion: the reducer already gives the finished state at once; no pause runs (`scheduleRace` is not used for timing a clock). The caption area shows the orientation line while `guided && !oriented`, and the finished caption afterwards.

### 3. Captions (Requirement 7)

#### 3.1 Choice: a pure function (`state/captions.ts`, new)

```ts
type Side38 = 'waiting' | 'riding' | 'arrived';
type SideToday = 'walking-to-stop' | 'waiting' | 'riding' | 'walking-to-destination' | 'arrived';
type CaptionKey =
  | { kind: 'orientation' }
  | { kind: 'both-arrived' }
  | { kind: 'clauses'; p1938: { phase: Side38; still: boolean }; today: { phase: SideToday; still: boolean } | null };

function captionFor(input: { p1938: Side38; today: SideToday | null; orientation: boolean }): CaptionKey;
function phaseOf(lane: Lane, frame: LaneFrame): Side38 | SideToday;   // frame.arrived -> 'arrived', else lane.phases[frame.current].kind mapped
```

Rules:

- `orientation` true: `{ kind: 'orientation' }`.
- No bus side (`today` null): the 1938 clause alone, `still` false (Requirement 7.6). When the 1938 side has arrived this is the arrived clause, which is also the finished caption for that case (Requirement 7.9).
- Both arrived: `both-arrived` (Requirement 7.5).
- Otherwise both clauses, with `still` true on a side exactly when that side has not arrived and the other has (Requirement 7.4).

The phase comes from `play/timeline.ts` `laneFrame`, the same frame that draws the bars, so a caption cannot name a phase the lane is not in (Requirement 7.3). Zero-length phases are already skipped by `laneFrame.current`.

`copy/copy.ts` gains the caption templates of the Story_Copy_Table as functions of `still: boolean` (inserting the literal "still " or nothing) and one `captionText(key)` that joins the clauses with a space. No template has a number parameter, so a digit cannot enter (Requirement 7.8).

#### 3.2 Drawing

`view/card.ts` adds `<p class="caption" id="race-caption">` under `.lanes`. CSS gives it `min-height: calc(2 * line-height)` so it is reserved at two lines in every state (Requirement 7.1). It sits outside `#result-status` and has no `aria-live` (Requirement 7.7, 15.3). `view/racer.ts` computes the key each frame from the two lane frames and rewrites the text only when the key changes. On `finish()` and in the finished stage, the card draws the finished caption.

"Scheduled, not live." stays visible through the schedule line in every state (Requirement 7.13). The card no longer hides the schedule line when a notice shows: `view/card.ts` renders the schedule line always, then the notices directly under it (section 7).

### 4. Lanes: illustrations and markers (Requirements 5, 6)

#### 4.1 Title row

`view/lanes.ts` `laneView` builds the lane as: title row (illustration, title, total), marker track, bar, status line or legend. The `.vehicle-row` with its travelling `.runner` is removed.

- 1938 title row: the detailed trolley (`trolleySvg`) at the starting width, with its two hairline wires across the title row behind it (the existing `.wire` elements, moved). `trolleySvg` already omits the route number under `ROUTE_NUMBER_MIN_WIDTH` (150 px), so the phone illustration (104 px) has no number and the desktop one (150 px) has it (Requirement 5.6).
- Today title row: `busSvg` at the existing bus widths (84 px phone, 104 px desktop; the requirements set no new bus size).
- `config.ts` `VEHICLE_SIZES` becomes `{ phone: { trolley: 104, bus: 84, barMarker: 28, mapMarker: 28 }, desktop: { trolley: 150, bus: 104, barMarker: 28, mapMarker: 58 } }`. The racing and finished trolley sizes merge into one; `racer.finish()` no longer swaps the trolley. Map marker sizes are unchanged (the map is out of scope).
- Liveliness: the existing CSS for bob, sparks, hubs and glow breathing moves its selectors to `.lane-1938.is-moving .lane-art`; `racer.ts` already toggles `is-moving` from `laneFrame.moving`, which is true only during the 1938 ride (Requirement 5.4). The bus has none of these (Requirement 5.5).

#### 4.2 Marker track and geometry

The marker track is a row the height of the marker, directly above the bar, holding one `.bar-marker` element: `markerSvg` (the simplified trolley) on the 1938 lane and a new `busMarkerSvg` (small flat bus, `--today`, no glow) on today's lane, both 28 px wide (Requirement 6.1).

Track padding (Requirement 6.6): the bar keeps its race-screen width, and therefore its scale (`layout.ts` `laneLayout`: each phase's share of the longer stored total). The marker track is the bar's width plus 14 px (half the marker) on each side, extended into the card's side padding (`--pad`) the way `.vehicle-row` already does with `margin: 0 calc(var(--pad) * -1)`. A marker at either end of the bar is then fully inside the track and never clips. If `--pad` on some layout is under 14 px, the layout report flags it (section 9) rather than the design changing the bar.

Position: `laneFrame(...).vehicle` already returns the filled end of the ride as a share of the scale: the ride start before the ride, linear during it, the ride end after it. The marker uses it as its centre instead of its front edge:

```css
.bar-marker { transform: translateX(calc(14px + var(--x) * var(--bar-w) + var(--gaps) * var(--seg-gap) - 50%)); }
```

`--bar-w` is the bar's pixel width (the track width minus 28 px, from CSS `calc`), `--gaps` the number of segment gaps before the ride. The 1938 marker is still during the wait; today's marker is still during both walks and the wait (`rideFill` is 0 before the ride and 1 after it), and the walk dots stay as they are (Requirement 6.5). Only `transform` changes per frame (Requirement 6.7). The marker carries no winner class; arrival emphasis stays on `.bar-end` (Requirement 6.8).

A pure helper `markerCentre(layout: LaneLayout, frame: LaneFrame, barPx: number, segGapPx: number): number` in `view/layout.ts` returns the same position in pixels, for the geometry tests (Requirement 16.1) and the property test.

Reduced motion: the card is drawn finished, so `--x` is `layout.park`: each marker parks at the end of its ride segment (Requirement 6.9).

### 5. Takeaway (Requirement 8)

`state/derive.ts` adds to `RaceView`:

```ts
takeaway: {
  wait1938: number; ride1938: number;                 // lane1938 shown parts
  today: { wait: number; walk: number; ride: number } | null;  // laneToday shown wait, walkShown, shown ride
  waitMost: boolean;                                  // row.wait_most, read as stored
};
```

Values are the lane legend's shown parts (same `roundParts` call) and `walkShown` (`sumShown` of the two shown walks), so they always match the legends (Requirement 8.2, 8.3). `waitMost` is `row.wait_most`; nothing in the site compares waits (Requirement 8.7).

`view/takeaway.ts` renders the heading and rows of the Story_Copy_Table with each value a Number_Button. Source specs (in `state/specs.ts`, new `takeawayNumbers`):

| id | what | method | sources |
| --- | --- | --- | --- |
| `take-wait-1938`, `take-ride-1938` | as `wait-1938`, `ride-1938` | as those | as those |
| `take-wait-today`, `take-ride-today` | as `wait-today`, `ride-today` | as those | as those |
| `take-walk-today` | "walks to and from the stop, together (estimate)" | "Sum of the two walks as shown, to and from the stop." | `mta_gtfs`, `method`; `walk: true` |

The takeaway is appended by `resultElements` after the honest line, so it appears with the result box (and at once under reduced motion, Requirement 8.8, 15.4). With no one-seat ride only the trolley rows render (Requirement 8.4). The "most of the difference" sentence renders when `waitMost` is true (Requirements 8.5, 8.6).

### 6. Start-time chart (Requirement 9)

#### 6.1 Plan (`view/layout.ts`, new `chartPlan`)

```ts
type ChartPlan = {
  columns: number;                    // race.races.length
  max: number;                        // the largest stored total in the file, both series; scale is 0..max
  series1938: number[];               // row.y1938.total for each row, as stored
  seriesToday: number[] | null;       // row.today.total for each row; null when every row has today null
  hatch: { from: number; to: number } | null;  // the column range where before_table is true (a prefix of the file)
};
function chartPlan(race: RaceFile): ChartPlan;
function chartPath(series: number[], max: number, height: number): string;  // step path in viewBox units
```

The path is a step series: column k spans x from k − 0.5 to k + 0.5 at y = height × (1 − value / max). No smoothing, no averaging (Requirement 9.3). The vertical scale starts at 0 and is shared (Requirement 9.4). The scale's top is layout, never shown as a number.

#### 6.2 Drawing (`view/chart.ts`, new)

- An inline `<svg role="img" aria-label="{chart accessible name}">` with `viewBox="-0.5 0 {columns} {H}"` and `preserveAspectRatio="none"`, so columns map to slider minutes without JS measurement. The SVG has `pointer-events: none` and no listeners (Requirement 9.10). Strokes use `vector-effect: non-scaling-stroke`.
- Two `<path>`s: 1938 in `--ghost`, today in `--today` (Requirement 9.3). With no one-seat ride only the 1938 path renders (Requirement 9.9).
- The hatch: a `<rect>` filled with a hatched `<pattern>` over the `hatch` range, and the hatch label as HTML text positioned over it by a percentage from the plan (Requirement 9.5).
- The cursor: a `<line>` at x = the slider minute's column, moved by `transform` when the slider moves (Requirement 9.6).
- Heading and subheading and legend from the Story_Copy_Table. The heading is the prompt heading while `guided`, else the normal heading (Requirement 3.4, 3.5).
- Readout under the chart: "At {h:mm AM/PM}: trolley {n} min, today's bus {m} min." where n and m are `roundTotal` of the slider minute's stored totals, as Number_Buttons with ids `readout-1938` and `readout-today` (sources as `total-1938` and `total-today`) (Requirement 9.7).
- Alignment: the chart box has `margin-inline: calc(var(--thumb) / 2)` inside the slider track's width, where `--thumb` is the slider thumb's width set once in `card.css` and used by the `::-webkit-slider-thumb` and `::-moz-range-thumb` rules. An e2e test checks the cursor and the thumb centre agree within 1 px at the first, middle and last minute (Requirement 9.1).

The chart is drawn by `renderCard` from the race file on screen. A pair change, swap or Today_Win_Shortcut loads a new race file, which redraws the whole card, chart included, before `scheduleRace` starts the race (Requirement 9.8). It fetches nothing (Requirement 9.2). While the slider is held, `render()`'s held path calls `updateSlider`, `redrawBoard` and a new `updateChart(minute)`, which moves the cursor and rewrites the readout.

#### 6.3 Slider changes (Requirement 9.12)

`view/slider.ts` splits into `startRow` (example label while guided, with its time as plain text like the slider's start time (decision 19), then the large start time) and `sliderRow` (minus, input, plus, ends). The input gets a visible `<label for="start-time">` "Choose a scheduled start time" and loses its `aria-label` "Start time". The ends use `label12(first)` and `label12(last)` ("9:00 AM", "1:52 PM" on the real data, read from the file).

### 7. Next steps, departures, notices and buttons (Requirements 10, 11)

- `view/nextsteps.ts` renders the three buttons in order with `data-action` values `try-time`, `try-corners`, `today-win`. `try-time`: `visitorInput()`, focus `#start-time`, `scrollIntoView({ block: 'center' })` (a plain jump under reduced motion). `try-corners`: `visitorInput()`, `picker/open`. `today-win`: `visitorInput()`, then the existing `selectTodayWin` path with `todaywin/select` (stop the race, close any sheet, set pair and minute, start after the race file arrives or after the usual pause for the same pair). The address bar follows through the existing `pair/set` subscription (`encode(pair)`, Requirement 10.5).
- Schedule line and notices (decision 16): `view/card.ts` always renders the schedule line (the `copy.ready` line that ends "Scheduled, not live.") after the slider and removes the race-screen condition that hid it when `view.notices` is non-empty. The race-screen notices (before the table, inferred corner) and the today-win notice are rendered in one `.notices` block directly under the schedule line. This changes the phone height by up to one schedule line in notice states; the phone-fit report (section 9) measures it, and no text size is shrunk.
- Today-win notice: rendered in that `.notices` block while `todayWinNotice` is set, with corner names from `index.json` and the start time from the entry's `t` in 12-hour form as plain text, like the slider's start time (decision 19). It is not a Number_Button, so it adds no Sources row.
- Secondary buttons: `view/buttons.ts` `cardButtons()` becomes Sources (outline) and Share this race (outline), after the Next_Step_Actions. Each control is at least 44 × 44 px (Requirement 10.8).
- Departures: `view/departures.ts` wraps the existing `boardView` in a section with a `<button aria-expanded aria-controls>` "Scheduled departures" and a region `hidden` unless `departuresOpen`. `boardShown` becomes true on both layouts and stages, and `racer.finish()` keeps the board, because the section holds it (supersedes race-screen R8.4 per its pointer). The header and row labels use the Story_Copy_Table rows (Requirement 11.3). `copy/copy.ts` changes `BOARD_1938` to "1938 trolley, at this corner" and adds `BOARD_TODAY = "Today's bus, from the boarding stop"`; `view/board.ts` uses `BOARD_TODAY` for the bus row instead of `LANE_TITLE_TODAY`, which keeps the lane title "Today's bus" (decision 23). `boardHeader` becomes "Scheduled departures after {h:mm}". The race-screen board content rules are unchanged (Requirement 11.4). Number buttons inside a closed section still register their Sources rows, so P3 holds whether it is open or closed.

### 8. Phone flow and the route preview (Requirement 12)

#### 8.1 DOM order

`index.html` gains a phone-only intro line `<p class="intro-line">` between the top bar and the map area, with the Story_Copy_Table text (a test checks it equals the `copy.ts` constant, as for the headline). The map area becomes the Route_Preview on a phone. Inside the card the order is:

pair row (phone: two lines, origin, then "→ destination", with the swap button; desktop keeps the one-line fitted row of R1.3), start row, slider row, schedule line, notices (before the table, inferred corner, today-win; directly under the schedule line), lanes, caption, clock row (while racing), result box, honest line, takeaway, next-step actions, chart (heading, key, plot, readout; after the next-step actions so the result is above the fold, decision 24), departures section, then `#card-buttons` (Sources, Share this race), then `#card-footer` (About and credits).

#### 8.2 CSS

`styles/layout-phone.css`: `.app` loses `height: 100dvh; overflow: hidden`; `.card-scroll` loses `overflow-y: auto` and the bottom padding for the pinned strip; `.card-buttons` loses its pinned strip (`--strip-h`, solid panel band) and flows after the content. The page scrolls; nothing in the card scrolls (Requirement 12.1). Text sizes stay at the race-screen minimums (Requirement 12.5). Sheets, scrim and banners (share, bad-link) remain overlays and are outside the "no fixed or sticky element" rule (decision 20, Requirement 12.1). The scrim is `display: none` when no sheet is open, so with no sheet and no banner nothing fixed is displayed. A banner must never cover the result box or the Next_Step_Actions (Requirement 12.11): on a phone the banner is a compact strip anchored at the top of the viewport, one or two lines tall, and the layout report (section 9) measures its box against the result box and Next_Step_Action boxes at 375 × 667 and 320 wide. If the strip overlaps, the finding is reported with pixels to Emmanuel and the banner is not shrunk by guessing; dismissing the banner (its existing close control) always clears it.

#### 8.3 Route preview (Requirements 12.3, 12.8 to 12.10)

- Collapsed (default, phone): the map area is 100 px tall (`--preview-h`, a starting value) and shows the route drawing from `map/routedrawing.ts`, drawn by `mapview.drawFor` for the chosen pair, with a "View route" button. `config.ts` `MAP_LAYOUT` gains `phonePreview: { size: { width: 375, height: 100 }, padding: … }`, starting from the phone padding scaled to the strip; any overlap of the credit line, the toggle and the route is reported, not resolved by guessing (section 9). Checkpoint 18 (Emmanuel): the toggle has its own column on the strip's right (`phonePreview.button`, 80 × 44 px, 8 px from the right and 4 px from the top, with a 4 px gap), which the route, the dots and the corner names never enter (the strip's right padding is that column). The corner names on the strip keep clear of the trolley marker where it stands (at the origin and short of the destination), the rule the map's street names follow: the usual places beside the dot first, then the same places a pixel further out (up to `labelMaxOffset`), over-or-under places also sliding sideways while they still span the dot; a place also clear of the route's lines, the other dots and names wins where one exists. Names stay above the 9 px the card's rounded top covers (`phonePreview.cardOverlap`). Checked by `tests/unit/routestrip.test.ts` for every pair and by `tests/e2e/checkpoint.spec.ts` in the browser.
- `view/mapview.ts`: `startMap` runs on desktop when idle (unchanged) and on a phone only when `routeOpen` becomes true. `painted()` still loads `route.geojson` after the card is on screen on both layouts (it is needed for the strip and is not part of the first-screen set).
- "View route": `route/toggle`; the area becomes 150 px (`MAP_LAYOUT.phone`), the drawing is redrawn for that size, and the MapLibre chunk is imported (the `import('../map/map')` in `startPage`). The button reads "Hide route" and carries `aria-expanded="true"`.
- "Hide route": `route/toggle`; `stopMap()` removes the MapLibre instance (no further tile requests), the drawing is redrawn at 100 px, the button reads "View route". The preview never stays open (decision 21, Requirement 12.9). The chunk itself cannot be unloaded once imported, which is accepted: Requirement 12.3 applies to the collapsed state before "View route" is first pressed, and Requirement 12.9 applies after "Hide route" (no map instance, no further tiles).
- Desktop: no preview, no toggle, map unchanged (Requirement 12.10).
- The race never waits for the drawing or the map (race-screen R11.4, Requirement 14.3).

### 9. Layout reporting to Emmanuel (Requirements 5.7, 6.10, 12.3, 12.7)

The starting sizes (trolley 104 and 150 px, markers 28 px, preview 100 px) are not tuned by the build. `tests/e2e/screens.spec.ts` gains a `layout report` step that, on the phone (375 × 667) and laptop (1280 × 800) projects, measures with `getBoundingClientRect`:

- title row: whether the illustration overlaps the title or total, is clipped by its row, or pushes the row taller than the illustration;
- markers: whether a marker is clipped by its track at either end, overlaps another lane's content, or is wider than its ride segment;
- route preview: whether the credit line, toggle and route drawing overlap in the 100 px strip;
- banner: on a bad-link Guided_Visit at 375 × 667 and 320 wide, at the result moment, whether the banner's box intersects the result box or any Next_Step_Action box, by how many pixels (Requirement 12.11, 16.19);
- phone fit: at the lead example's result moment, the bottom of the caption area and of the result line against the viewport height (Requirement 12.7).

Each finding is written as a line to `web/test-results/story-layout-report.md` (git-ignored) and attached to the test as an annotation, with the element, layout and pixel amount. The step does not fail the run and never changes a size. The task that runs `npm run screens` copies the report's lines into its summary for Emmanuel. A separate, failing assertion covers what is not a size question: no sideways scroll at 320, 375 and 899 px (Requirement 12.6).

### 10. Copy, Sources lines and counts (Requirement 13)

- `copy/copy.ts` gains every Story_Copy_Table row as a constant or template, and the replaced rows change in place: `trolleyFirst` reads "Trolley first in {wins_1938} of {races} covered starts."; the board header, row labels, slider input name, frequency sentence, races-count method and ride-same method follow the table.
- `METHOD_RACE_COUNTS` takes the new races-count text. It is also the method line of the `wins_1938` and `wins_today` counts today (`specs.ts` `honestNumbers`); the new text is accurate for them too, since they count the same covered starts. Emmanuel confirmed this for all three counts (Q7, resolved: decision 22, Requirement 13.2).
- The ride-same method is a template `methodRideVerdicts(minutes: string, fractionPct: string)`, filled with `String(summary.ride_same_rule.minutes)` and `String(summary.ride_same_rule.fraction_pct)` as plain text in the Sources row (Requirement 13.3). Those two numbers are not Number_Buttons (decision 11).
- "When today wins" sheet heading "The {wins_today} races today wins": `wins_today` is a Number_Button (`count-wins-today`) with what "covered starts where today's bus arrives first" (Requirement 13.4, 13.6).
- `web/tests/unit/copy-table.test.ts` reads both copy tables (race-screen and story-layer) and applies the "story-layer row wins" rule when a race-screen row is marked replaced.

### 11. Map dimming on desktop (Requirement 14, cut first)

Only if time allows. `map/map.ts` adds a GeoJSON source holding the selected pair's stretch, the polyline that `layout.ts` `markerTrack` already builds between the two corners, as a bright line layer over the route; the existing route line layers get a lower `line-opacity`. Symbol layers keep their opacity at 0.8 or more (Requirement 14.2). Updated on pair change through `map.corners(plan)`. The phone and the fallback drawing are unchanged.

## Data Models

### Race row (web/public/data/race/*.json, `races[]`)

```json
{"t":"10:00","start":"10:00","before_table":false,
 "y1938":{"dep":"10:06","wait":6,"total":15},
 "today":{"trip":2,"wait":30.458,"total":45.156},
 "result":"1938","margin":30.156,"wait_most":true}
```

`wait_most` is the only new key, written last (after `margin` when present; decision 18). Every other key and value is unchanged.

### Summary (web/public/data/summary.json)

```json
{"schema":"ghostline.summary.v1", "definition":"…", "races":…, "wins_1938":…, "wins_today":…,
 "photo_finishes":…, "ride_same":…, "ride_faster_today":…, "ride_slower_today":…,
 "ride_same_rule":{"minutes":1.5,"fraction_pct":15},
 "pairs_without_one_seat_ride":…, "today_wins":[…], "pairs":[…], "sources":{…}}
```

`sources` gains the one entry `"ride_same_rule": ["method"]` (decision 17).

### Site types (`web/src/data/types.ts`, `web/src/data/shape.ts`)

```ts
type RaceRow = { …existing; wait_most: boolean };
type RideSameRule = { minutes: number; fraction_pct: number };
type Summary = { …existing; ride_same_rule: RideSameRule };
```

`shape.ts` checks `wait_most` is a boolean on every row, and `ride_same_rule` is an object with two finite numbers and nothing else. The existing contract test compares the validators' required fields with the schemas' `required` arrays, so the pipeline and site changes must land together.

### View additions (`web/src/state/model.ts`)

```ts
type RaceView = { …existing; takeaway: Takeaway };
type Takeaway = { wait1938: number; ride1938: number; today: { wait: number; walk: number; ride: number } | null; waitMost: boolean };
type ChartView = { plan: ChartPlan; minute: number; readout: { n: number; m: number | null } };
type CaptionKey = /* section 3.1 */;
```

### Constants (`web/src/config.ts`)

```ts
export const EXAMPLE_START = '10:00';           // product.md, the labelled example start
TIMINGS.orientationMs = 2000;                    // decision 5
VEHICLE_SIZES = { phone: { trolley: 104, bus: 84, barMarker: 28, mapMarker: 28 },
                  desktop: { trolley: 150, bus: 104, barMarker: 28, mapMarker: 58 } };  // decision 7, starting values
MAP_LAYOUT.phonePreview = { size: { width: 375, height: 100 }, padding: … };          // decision 12, starting value
```

None of these is a race number, count, time from the data or minute value; `config.ts`'s header rule still holds.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

These are numbered for this spec (Property 1 to Property 13) and add to the race-screen properties P1 to P13, which still hold. P3 (every number has a Sources row), P5 (counts read from summary.json), P6 (no banned word) and P13 (minute words) are extended to every new part and state; they are not restated here. Properties 1 and 2 are tested with Hypothesis in Python; Properties 3 to 12 with fast-check in TypeScript; Property 13 is an exhaustive check over the committed data.

### Property 1: The wait-most flag is the shown-wait predicate

*For any* result and any non-negative three-decimal parts and totals whose parts sum to within 0.5 of their total, `_wait_most` is false when the result is "photo_finish" or "no_one_seat_ride", and otherwise equals `2 × (loser's shown wait − winner's shown wait) > shown margin`, where shown values come from the R7 rounding rule as an oracle written in the test.

**Validates: Requirements 1.1, 1.2, 1.3, 1.7**

### Property 2: Python display rounding keeps the R7 invariants

*For any* list of non-negative parts and a stored total within 0.5 of their sum, `display_round_parts` returns parts that sum to the shown total, each within one minute of its stored part, whole-number parts unchanged, the same answer on every call, and the shown total `floor(round6(total) + 0.5)`.

**Validates: Requirements 1.4**

### Property 3: The start time follows the link's validity

*For any* query string and any instant, the boot start is the example start 10:00 with `guided` true when the query does not name a valid pair, and is `defaultStart(instant)` (inside the slider range, race-screen P2) with `guided` false when it does.

**Validates: Requirements 3.1, 3.2, 3.3, 3.7**

### Property 4: Guided parts end at the first Visitor_Input and stay gone

*For any* sequence of actions after a guided boot, `guided` is true at every step before the first Visitor_Input action and false at that step and every step after it; non-Visitor_Input actions (skip, sheets, departures toggle, route toggle) never change it.

**Validates: Requirements 3.4, 3.5, 4.5**

### Property 5: Markers sit on the ride's filled end and move only during the ride

*For any* lane (phase minutes, zeros allowed) and any elapsed time, `markerCentre` equals the ride start before the ride, the filled end of the ride segment (within 1 px) during it and the ride end after it; it is non-decreasing in elapsed time, constant while the lane walks or waits, and at the ride end at the finish (the reduced-motion position).

**Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.9**

### Property 6: Captions name the phases the lanes show

*For any* race row (sampled from all 20 files and the fixtures) and any elapsed time, the caption's clauses name the phase each lane is in according to its stored phase boundaries; "still " is on a clause exactly when that side has not arrived and the other has; both arrived gives "Both passengers have arrived."; a row with no one-seat ride gives the 1938 clause alone and never "still ".

**Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6, 7.9, 16.5**

### Property 7: Caption text carries no number, no present-tense marker and no place

*For any* caption key the caption function can return, including the orientation line, the text has no digit, no whole word "now" or "currently" (any case), no phrase "at the stop", and no street or corner name from index.json.

**Validates: Requirements 7.8, 7.12, 16.18**

### Property 8: The takeaway repeats the lane values and follows the stored flag

*For any* race row and trip, the takeaway's waits and rides equal the lanes' shown parts, its walk equals the sum of the two shown walks, and the "most of the difference" sentence is present exactly when the row's `wait_most` is true, including when the flag is flipped in a copy of the row.

**Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.6, 8.7**

### Property 9: The chart is the race file's stored totals

*For any* race file, the chart plan has one column per row, the 1938 series equals each row's `y1938.total`, the today series equals each row's `today.total` (absent when every row has no one-seat ride), the scale starts at 0 and covers both series, the hatched range is exactly the rows with `before_table` true, and the readout at any minute shows `roundTotal` of that row's two stored totals.

**Validates: Requirements 9.3, 9.4, 9.5, 9.7, 9.9**

### Property 10: The today-win shortcut walks the list in file order

*For any* non-empty `today_wins` list and any number of presses k, press k selects entry (k − 1) mod n, sets that entry's pair and minute, makes the address equal `encode(pair)` and sets the notice to that entry.

**Validates: Requirements 10.4, 10.5, 16.10**

### Property 11: The today-win notice leaves with the next pair or time change

*For any* state with a today-win notice and any action that changes the pair or the minute (slider, minus, plus, picker, swap), the notice is null afterwards; actions that change neither leave it as it was.

**Validates: Requirements 10.6**

### Property 12: The tolerance line shows the file's numbers

*For any* `ride_same_rule` with finite non-negative `minutes` and `fraction_pct`, the ride-same Sources method line contains `String(minutes)` and `String(fraction_pct) + "%"` as plain text and no Number_Button.

**Validates: Requirements 2.1, 13.3, 13.6, 16.6**

### Property 13: Site rounding agrees with the stored flag on every real row

*For all* 5,860 rows of the 20 committed race files, applying `roundParts` to the stored parts and the predicate of Requirement 1.2 to the shown values gives the stored `wait_most`. This is an exhaustive check, not a sampled one; it runs in the site suite (the committed data is present in hosted CI).

**Validates: Requirements 1.8**

## Error Handling

| Condition | Result |
| --- | --- |
| `display_round_parts` cannot make the parts add up (parts and total more than 0.5 apart) | `ValidationError` naming the pair and `t`; the build stops at the emit step. The same input makes the site's `roundParts` throw `RoundingError` (data error), so neither side shows it |
| `wait_most` or `ride_same_rule` missing or of the wrong type in a loaded file | `shape.ts` throws `ShapeError`; the screen goes to the data-error state (no number anywhere), as for any shape failure |
| `ride_same_rule` coverage missing in `summary.sources` | `check_source_coverage` fails the build; the build writes `ride_same_rule: ["method"]` so it passes |
| A computed value differs from a golden value (for example the lead `wait_most`) | the test fails; the task stops and reports to Emmanuel; no golden, facts file or test is edited |
| `today_wins` is empty | the Today_Win_Shortcut does nothing; it never invents a race |
| Race file for a shortcut entry fails to load | data-error state, as for any on-demand race file |
| "View route" and the map chunk, WebGL or tiles fail | the preview stays the route drawing with the race-screen "Map unavailable" line; the race is unaffected (R11.4, Requirement 14.3) |
| `route.geojson` fails on a phone | the preview area is the plain background with "Map unavailable."; "View route" still tries the map |
| A layout size causes overlap, clipping or a phone-fit miss | written to the layout report for Emmanuel; the size stays (section 9) |
| Data-error state | no caption, no takeaway, no chart, no readout, no next-step actions and no example label: the error view replaces the card as today (race-screen P7) |

## Testing Strategy

Both kinds of test are used: example and golden tests pin the specific cases the requirements name, and property tests cover the input space. Property tests use Hypothesis (pipeline) and fast-check (site), never a hand-rolled generator, with at least 100 runs each (`@settings(max_examples=100)` or more; `fc.assert(..., { numRuns: 100 })` or more). Each property is one test, tagged with a comment:

`# Feature: story-layer, Property 1: The wait-most flag is the shown-wait predicate` (Python) or `// Feature: story-layer, Property 6: Captions name the phases the lanes show` (TypeScript).

### Pipeline (pytest, Hypothesis)

| File | What |
| --- | --- |
| `tests/unit/test_wait_most.py` (new) | examples: brief check 9 shape (shown waits 31 and 6, margin 30 gives true), a today win, a photo finish, no one-seat ride, a tie at exactly half the margin (false), the `RoundingError` case raising `ValidationError`; a source scan that `display_round_parts` is called only from `_wait_most` |
| `tests/property/test_wait_most_properties.py` (new) | Property 1, Property 2 |
| `tests/unit/test_summary.py`, `tests/unit/test_output_schemas.py` | `ride_same_rule == {"minutes": SAME_FLOOR_MIN, "fraction_pct": 15}` read through the constants, `fraction_pct` is the integer 15, the schemas accept the new fields and reject a missing or extra key |
| `tests/golden/test_story_layer_golden.py` (new) | on the pinned feed: lead `10:00` row has `wait_most` true; every row of every file has a boolean; skips with a clear message when `raw/` is missing |
| existing golden tests | unchanged, must pass |
| `tests/unit/test_emit.py::test_key_order_is_fixed` | Emmanuel-approved edit (decision 18, Requirement 1.11): add `"wait_most"` at the end of the expected row key list, so it reads `["t", "start", "before_table", "y1938", "today", "result", "margin", "wait_most"]` (with `margin` absent where the file omits it). This is the only existing pipeline test whose expectation changes, and an explicit approval under product.md's "never edit a test to make a check pass" rule. The task's commit message names this test. |
| `tests/unit/test_summary.py` or `test_output_schemas.py` | also asserts `summary["sources"]["ride_same_rule"] == ["method"]` and that every other `sources` key equals its value before this change |

Commands: `python -m pipeline check` (build then pytest) before the commit; `python -m pipeline verify` and `check_sources` after the regenerated data is committed.

### Site (vitest, fast-check, jsdom, axe-core, Playwright)

| Layer | File (new unless noted) | What |
| --- | --- | --- |
| Property | `tests/property/captions.property.test.ts` | Property 6, Property 7 |
| Property | `tests/property/marker.property.test.ts` | Property 5 |
| Property | `tests/property/guided.property.test.ts` | Property 3, Property 4 |
| Property | `tests/property/todaywin.property.test.ts` | Property 10, Property 11 |
| Property | `tests/property/chart.property.test.ts` | Property 9 |
| Property | `tests/property/takeaway.property.test.ts` | Property 8, Property 12 |
| Real data | `tests/real/waitmost.test.ts` | Property 13 over all 20 files; the predicate lives in `tests/support/`, never in `src/` |
| Real data | `tests/real/todaywins.test.ts` | 16.10: presses equal to `summary.today_wins.length` (read from the file), then one more to show the wrap; each race's result is "today" |
| DOM | `tests/dom/guided.test.ts` | 3.1 to 3.6, 4.1 to 4.7 with fake timers (mark order, 2,000 ms, skip during pause, input during pause, reduced motion), 16.2, 16.3 |
| DOM | `tests/dom/captions.test.ts` | 16.4: caption sequences with fake timers for the lead race at 10:00, the first `summary.today_wins` entry, lead at 10:30, lead at 9:00, one Brevard pair and the no-one-seat-ride fixture, each against a sequence worked out in the test from stored boundaries; 7.7, 7.13, 16.18's visibility check |
| DOM | `tests/dom/story.test.ts` | takeaway, chart (columns, hatch, cursor, readout, prompt heading, no listeners), next steps, departures toggle, today-win notice, 16.8 with a made-up race file, 16.9 (series equal the new file; the loader's fetch log has no extra race file) |
| DOM | existing `a11y.test.ts`, `wording.test.ts`, `sheets.test.ts`, `states.test.ts` (extended) | axe on the six states of 15.1; P3 crawl, P6 scan and P13 forms over new parts (16.11); the ride-same method line and today-win heading from a made-up summary (16.6) |
| Unit | existing `copy-table.test.ts` (extended) | reads both copy tables; the story-layer row wins (13.8). Changed for decision 23: its copy-constant table (around the `BOARD_1938` and `boardHeader` entries) adds `BOARD_TODAY` and takes the new `BOARD_1938` and `boardHeader` text; the race-screen copy-table rows it reads for the board header and row labels are marked replaced. Named in the commit message (16.16) |
| DOM | existing `tests/dom/board.test.ts` (changed) | line 72 asserted `.board-row-today .board-label` equals `C.LANE_TITLE_TODAY`; it now asserts `C.BOARD_TODAY` ("Today's bus, from the boarding stop") and the 1938 row asserts the new `C.BOARD_1938`. Its `boardHeader` assertions follow the constant. Named in the commit message |
| DOM | existing `tests/dom/states.test.ts` (checked) | its `.board-head` assertion follows `C.boardHeader`, so it needs no edit; its `LANE_TITLE_TODAY` assertion is for the lane title, which is unchanged |
| DOM | existing `tests/dom/states.test.ts` and any e2e check on `.schedule` (changed if needed) | any assertion that the schedule line is hidden or absent while a notice shows (race-screen R6.7, superseded by decision 16) is changed to assert it is visible with the notice after it; the task greps `.schedule` in `web/tests/` and names each changed test in the commit message |
| DOM | `tests/dom/notices.test.ts` (new) | 7.13, 12.2: with the before-the-table notice, the inferred-corner notice and the today-win notice each showing, the schedule line containing "Scheduled, not live." is visible and the notice follows it directly in DOM order; the today-win notice time is plain text (no `button.num`) and the example label time is plain text |
| DOM | existing `sheets.test.ts`/wording tests (extended) | the three counts (`races`, `wins_1938`, `wins_today`) show the "covered starts" method line (13.2) |
| Unit | existing `shape-contract.test.ts` | the new required fields match the schemas |
| Unit | existing `principle.test.ts` | unchanged whitelist; new modules must pass it |
| Build | existing `budget.test.ts`, `npm run check:size` | under 100 KB with the map excluded; no runtime dependency added (16.13) |
| E2E | `tests/e2e/race.spec.ts` (extended) | 16.1 marker geometry at ten clock moments on 375 × 667 and 1280 × 800, the trolley marker travelling its full ride segment within 1 px; 5.3 box sizes at three moments; 9.1 cursor and thumb within 1 px; 12.1, 12.2, 12.6, 16.12; 12.3 request log (no MapLibre chunk, no tile host) until "View route"; 14.3 the whole story with tiles blocked and WebGL off |
| E2E | `tests/e2e/screens.spec.ts` (extended) | 16.15 pictures and the layout report of section 9 |
| E2E | `tests/e2e/race.spec.ts` (extended) | 16.19: bad-link Guided_Visit at 375 × 667 and 320 wide, at the result moment, the banner box does not intersect the result box or any Next_Step_Action box; overlaps are reported by pixels. 16.12 runs with no sheet open and no banner showing. 12.9: after "Hide route" no map instance exists and no further tile request is made |
| Timing | `npm run perf` | 16.14, on a quiet machine, with the moved `race-start` mark |

Fixtures: `web/tests/fixtures/make-fake.mjs` writes `wait_most` on every made-up row (from its own made-up totals, in test code) and `ride_same_rule` with values that differ from the real file, then regenerates `web/tests/fixtures/fake/`. One made-up row has `wait_most` false where walking and riding make up most of the margin (16.8). The fixtures stay under `web/tests/fixtures/`, are named fake and are never written to `web/public/data`.

Race-screen tests of superseded requirements that change (vehicle sizes and the finish swap, the pinned phone strip, the board leaving at the finish on a phone, the slider end labels, the input name "Start time", the `race-start` mark point, the 300 ms first-race pause on a guided visit) are each named in the commit message that changes them; none is deleted silently (16.16). The race-screen and race-engine suites must pass afterwards (16.17).

Windows: no new npm script is needed (`test`, `test:e2e`, `screens`, `check:size`, `perf` exist, each one command). No hook changes. Nothing uses `&&`, pipes or shell-specific syntax.

## Requirement coverage

| Requirement | Design section | Properties and tests |
| --- | --- | --- |
| 1 wait_most | 1.1, 1.2, 1.4, 1.5 | Property 1, Property 2, Property 13, golden |
| 2 ride_same_rule | 1.3, 1.4, 1.5 | Property 12, unit, schema |
| 3 First visit | 2.3, 2.4 | Property 3, Property 4, DOM |
| 4 Orientation pause | 2.5 | DOM with fake timers, perf |
| 5 Illustrations | 4.1, 9 | e2e, layout report |
| 6 Markers | 4.2, 9 | Property 5, e2e, layout report |
| 7 Captions | 3 | Property 6, Property 7, DOM |
| 8 Takeaway | 5 | Property 8, DOM |
| 9 Chart | 6 | Property 9, DOM, e2e |
| 10 Next steps | 7, 2.2 | Property 10, Property 11, real data |
| 11 Departures | 7 | DOM |
| 12 Phone flow, preview | 8, 9 | e2e, layout report |
| 13 Copy and Sources | 10 | Property 12, P3, P5, P6, P13, copy-table |
| 14 Map dimming | 11 | e2e (if built) |
| 15 Accessibility | 3.2, 6.2, 7, 8.3 | axe, keyboard |
| 16 Tests and budgets | Testing Strategy | as listed |


## Open questions (all resolved)

Emmanuel answered all seven questions and added one copy change. The answers are applied in the sections named and recorded as decisions 16 to 23 in requirements.md.

**Q1. "Scheduled, not live." while a notice shows. Resolved: option (a), decision 16.** The schedule line, with "Scheduled, not live.", stays visible in every state. The before-the-table notice, the inferred-corner notice and the today-win notice sit directly under it, after the slider, in the phone order. This supersedes the "schedule line hidden while a notice shows" part of race-screen R6.7, which now carries a superseded pointer; R6.7 is in the story-layer intro's superseded list. Requirement 12.2 lists the notices in the phone order, and Requirement 7.13 holds in every notice state. Applied in sections 3.2 and 7 and the testing plan.

**Q2. The source mapping for `ride_same_rule`. Resolved: option (a), decision 17.** `summary.sources` gains the one entry `"ride_same_rule": ["method"]`. Requirement 2.6 and the data-contract table allow exactly that addition. Applied in sections 1.3, 1.4, 1.5 and Data Models.

**Q3. The key-order test and the position of `wait_most`. Resolved, decision 18.** `wait_most` is the last key of a row, after `margin` when present. The task adds `"wait_most"` at the end of the expected list in `tests/unit/test_emit.py::test_key_order_is_fixed` and names that test in its commit message. This is an explicit Emmanuel approval of the only existing pipeline test expectation that changes, against product.md's "never edit a test to make a check pass" rule (Requirement 1.10 and 1.11). Applied in section 1.2, Data Models and the testing plan.

**Q4. Start times in the example label and the today-win notice. Resolved: plain text, decision 19.** Both times are plain text like the slider's start time, not Number_Buttons (Requirements 3.8 and 10.5). Applied in sections 6.3 and 7.

**Q5. Overlays and "no fixed or sticky element" on a phone. Resolved, decision 20.** Sheets, the scrim and banners (share, bad-link) are overlays outside the rule (Requirements 12.1 and 16.12). A banner must never cover the result box or the Next_Step_Actions (Requirements 12.11 and 16.19), checked by a phone test of a bad-link guided visit at 375 × 667 and 320 wide at the result moment. Applied in sections 8.2 and 9 and the testing plan.

**Q6. "Hide route" after "View route". Resolved, decision 21.** "Hide route" removes the map instance and returns to the strip with no further tile requests. The preview does not stay open (Requirement 12.9). Applied in section 8.3.

**Q7. The new races-count method line on the other counts. Resolved: all three counts, decision 22.** The "covered starts" method line replaces `METHOD_RACE_COUNTS` for `races`, `wins_1938` and `wins_today` (Requirement 13.2). Applied in section 10.

**Board row label. Resolved, decision 23.** The bus row of the departures board reads "Today's bus, from the boarding stop" (not "at the boarding stop"). It is a Story_Copy_Table row that wins over the race-screen row under Requirement 13.8. Tests that assert the old text and so change: `web/tests/dom/board.test.ts` (asserts `LANE_TITLE_TODAY` for the bus row label) and `web/tests/unit/copy-table.test.ts` (its copy-constant table for the board header and row labels). No test or race-screen spec text contains the string "at the boarding stop"; it exists only in the story-layer brief and requirements, now corrected in requirements.md. `docs/planning/story-layer-brief.md` still has the old wording at its copy table and was not edited (not in this step's scope).
