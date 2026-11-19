# Race Screen: Design

This design implements `requirements.md` in this folder. It follows ui.md, tech.md, product.md, docs/planning/screen-brief.md (sections 2, 3 and 3A, with 3A winning) and the mockups in docs/planning/ui-mockups/. Requirement IDs (R1 to R17), principles (P-A to P-E) and correctness properties (P1 to P12) refer to that file.

Status: draft for review. Nothing is built. Section 18 lists the points where this design makes a choice the requirements left open.

## 1. What the site is allowed to do

The site reads, rounds, lays out, times, looks up and formats dates. It never computes a race.

| Allowed (and where it lives) | Not allowed anywhere |
| --- | --- |
| Read and shape-check the four data files (`data/`) | Choose a trip, a result or a winner |
| Display rounding of totals and parts, and whole-minute rounding of gaps (`format/rounding.ts`, `format/gaps.ts`) | Subtract clock times to get a wait, ride, total or margin |
| Layout: bar widths on one shared scale, positions, sizes (`view/layout.ts`) | Compute a median, gap, count or verdict |
| Playback timing: the race clock, its speed cap, phase boundaries (`play/timeline.ts`, `play/clock.ts`) | Decide which side is faster |
| Lookups: row by pair and minute, trip by index, next entries of a list, source row by id (`data/lookup.ts`) | Re-derive a stored number "to check it" |
| Date and time formatting: default time in America/New_York, 12-hour labels, "Nov 4, 2026" (`format/time.ts`) | Network calls other than the data files and map tiles |

This boundary is enforced three ways (section 15): a module whitelist test (only the five modules above may contain arithmetic on stored minutes), a property test that the shown result equals the stored `row.result` for every pair and minute in the real files (P9), and code review of `play/` against this table.

The playback arithmetic is the one place the site adds numbers to stored minutes: "scheduled clock = start + elapsed" for the "10:08 scheduled" readout, and phase boundaries as cumulative stored parts. These produce positions and a label. They never produce a result, a total or a margin, and they never feed rounding.

## 2. Stack and project layout

Fixed by tech.md: Vite, TypeScript, plain CSS, MapLibre GL JS, vitest, fast-check, no UI framework. Dev-only additions approved for tests: jsdom, axe-core, Playwright.

```
web/
  index.html                 static shell: top bar, map area, race card skeleton, pair names, sheet roots
  vite.config.ts             base "/Ghost-Line/", manualChunks: main, map
  package.json               scripts: dev, build, test (each one command)
  public/data/               generated; never edited by hand
  public/fonts/              BarlowCondensed-600.subset.woff2 (self-hosted, one file)
  src/
    main.ts                  boot: read URL, start loaders, mount UI, lazy-import the map
    config.ts                constants block (base paths, timings, sizes, breakpoints, the Source URLs block)
    data/
      types.ts               TypeScript types for the four files
      shape.ts               hand-written shape validators (no library)
      load.ts                fetch + validate + 3 s timeout, retry
      lookup.ts              row-by-minute, trip-by-index, next-after, source-row lookup
    state/
      store.ts               one small store: state object + subscribe
      model.ts               types: AppState, RaceView, Phase, Lane
      actions.ts             pure reducers for pair, time, sheet, race lifecycle
      derive.ts              AppState + data -> RaceView (lookups + rounding, no arithmetic on results)
    format/
      rounding.ts            display rounding (largest remainder)
      gaps.ts                whole-minute gap rounding and the gap part
      time.ts                default time, 12-hour labels, "Nov 4, 2026", clock strings
      list.ts                join route names with commas and "and"
      share.ts               encode/decode of ?from=&to=
    copy/
      copy.ts                every user-visible string, as templates; the only file with such literals
      announce.ts            the five announcement templates
    play/
      timeline.ts            phases -> start/end positions on the shared scale; speed cap
      clock.ts               rAF-driven race clock; pause/stop/skip; frame-rate watchdog
      motion.ts              reduced-motion query and the motion level (full / reduced / lite)
    view/
      app.ts                 mounts and wires everything
      topbar.ts, pairrow.ts, slider.ts, lanes.ts, resultbox.ts, honest.ts, board.ts,
      notices.ts, banner.ts, buttons.ts, footer.ts
      sheets/sheet.ts        generic sheet (focus trap, scrim, slide)
      sheets/sources.ts, sheets/corners.ts, sheets/about.ts, sheets/whentoday.ts
      numbers.ts             number buttons and the source registry
      layout.ts              bar widths and sizes (one shared scale)
      vehicles.ts            inline SVG: trolley, bus, map marker
      a11y.ts                live region, labels, focus return
    map/
      routedrawing.ts        route diagram from route.geojson (SVG): placeholder and fallback
      map.ts                 dynamic chunk: MapLibre + OpenFreeMap, route layers, corners, marker
      style.ts               palette-B style overrides
    styles/
      tokens.css, base.css, layout-phone.css, layout-desktop.css, card.css, lanes.css,
      sheets.css, map.css, motion.css
  tests/
    unit/, property/, dom/, e2e/, fixtures/ (made-up line, never under public/)
```

Files stay small and single-purpose; `view/*` modules take already-derived view data and never read raw data files.

## 3. Data layer (R14, R2.3)

### 3.1 Types
`types.ts` mirrors the generated files (field names as the pipeline writes them, including the task 35 fields).

```ts
type Corner = { slug: string; name: string; lonlat: [number, number]; inferred: boolean; note: string | null };
type SourceEntry = { label: string; what: string; year: number | null; where: string; url: string | null };
type Index = { line: string; effective: string; corners: Corner[]; pairs: {origin: string; dest: string}[];
  service_date: string; feed_version: string; feed_sha256: string; street_order_checked: boolean;
  sources: Record<SourceId, SourceEntry> };
type RaceRow = { t: string; start: string; before_table: boolean;
  y1938: { dep: string; wait: number; total: number };
  today: { trip: number; wait: number; total: number } | null;
  result: 'photo_finish' | '1938' | 'today' | 'no_one_seat_ride'; margin?: number };
type Trip = { i: number; trip_id: string; route: string; route_display: string; headsign: string;
  board: StopRef; alight: StopRef; dep: string; arr: string; ride_min: number };
type RaceFile = { origin: string; dest: string; direction: 'eastbound'|'westbound'; inferred: boolean;
  y1938: { ride_min: number; covered_from: string; passes: string[]; gap_min: number; gap_max: number;
           sources: { ride_min: string; passes: string } };
  today: { gap_min: number|null; gap_max: number|null; window_from: string; window_to: string;
           route_names: string[]; trips: Trip[] };
  races: RaceRow[]; sources: Record<string, SourceId[]> };
type Summary = { races: number; wins_1938: number; wins_today: number; photo_finishes: number;
  ride_same: number; ride_faster_today: number; ride_slower_today: number;
  pairs_without_one_seat_ride: number; today_wins: {origin: string; dest: string; t: string; margin: number}[];
  pairs: PairVerdict[]; sources: Record<string, SourceId[]> };
type Route = GeoJSON.FeatureCollection<GeoJSON.LineString, { direction: string; street: string;
  method: 'osm'|'osm+gap'|'inferred'; note: string; length_m: number }>;
```

### 3.2 Shape check
`shape.ts` has one validator per file, written by hand (no schema library: it would cost first-screen budget). Each checks required fields, types, that `races` has the rows the race file promises (first and last `t`, strictly increasing minutes, one row per whole minute), that every `today.trip` index is inside `today.trips`, that every `sources` id exists in the catalog, and that numbers are finite. A failed check throws `ShapeError` naming the file and field (for logs and tests; never shown to the visitor).

Contract test (vitest): the validators' required-field lists are compared with the `required` arrays of `pipeline/schemas/*.schema.json`, read from disk in the test. A pipeline schema change that adds a required field fails the site tests until `shape.ts` follows. The test also validates all 23 real files and a set of mutated copies (a field removed, a type changed, a row dropped, a trip index out of range) that must each fail.

### 3.3 Loading
`load.ts` fetches `BASE_URL + 'data/...'`. `index.json`, `summary.json` and the default pair's race file start together at boot (the default pair, or the pair from the URL, so a shared link loads the right file first). `Promise.all`; any rejection, non-200, non-JSON or `ShapeError` produces the single `data-error` result. A 3 s timer starts at boot; if the three files are not all valid by then the state is `data-error` (R2.2), and a late arrival does not replace the error. Retry calls the same loader and, on success, rebuilds state without a page reload (R14.2). Other race files load on demand when the pair changes and are cached in memory by slug pair. A failed on-demand race file also yields `data-error` (the whole screen: no number anywhere).

`route.geojson` is not part of the 3 s gate: it feeds the map, and its failure triggers the "map unavailable" path, not the data error (R14.3). It loads after first render.

## 4. State model

One store holds a plain object; reducers are pure functions in `actions.ts`.

```ts
type AppState = {
  data: { status: 'loading' | 'ready' | 'error'; index?: Index; summary?: Summary; races: Map<string, RaceFile> };
  pair: { origin: string; dest: string };
  minute: number;               // slider value as minutes after midnight, an integer
  minuteFromClock: boolean;     // R3.4: adds "Start time is the time now."
  race: { phase: 'idle' | 'pausing' | 'running' | 'finished'; elapsed: number /* scheduled minutes */ };
  motion: 'full' | 'reduced' | 'lite';
  sheet: null | 'sources' | 'corners' | 'about' | 'whentoday';
  sourcesTarget?: string;       // number button id to scroll to
  picker: { step: 'start' | 'end'; start?: string } | null;
  banner: null | { kind: 'shared' | 'bad'; text: string };
  linkBad: boolean;
  mapStatus: 'pending' | 'ready' | 'unavailable';
};
```

Only `race.elapsed` changes at frame rate, and it is stored outside the main store (in `clock.ts`) and applied straight to the DOM through CSS custom properties, so a frame never re-renders the card. The store holds `phase` and the final state.

State transitions for the race:

```
idle --(data ready, +300 ms)--> running --(both sides done)--> finished
running --(slider moved / minus / plus / pair change)--> idle (stopped at once)
idle --(300 ms after last input)--> running
running --(Skip to result)--> finished
reduced motion: any change --> finished immediately (no pausing, no running)
```

## 5. Derived view data (R5, R6, R7, R8)

`derive.ts` turns `(AppState, data)` into a `RaceView`. It does lookups and rounding only.

```ts
type Phase = { kind: 'walk' | 'wait' | 'ride'; stored: number; shown: number; side: '1938' | 'today' };
type Lane = { side: '1938'|'today'; phases: Phase[]; storedTotal: number; shownTotal: number;
              nextTime?: string /* 'hh:mm' */ };
type RaceView = {
  row: RaceRow; start: string; beforeTable: boolean; result: RaceRow['result'];
  lane1938: Lane; laneToday: Lane | null;       // null for no one-seat ride
  shownMargin: number | null;                   // difference of shown totals, for 1938 / today results
  board: Board; frequency: FrequencyText | null; honest: HonestLine; ...
};
```

- The row is found by `lookup.rowAt(race, minute)`: a `Map` keyed by the row's `t` string, built once per race file. The minute integer is formatted `hh:mm` and looked up; no scanning arithmetic.
- 1938 phases: `[wait, ride]` = `[row.y1938.wait, race.y1938.ride_min]`, total `row.y1938.total`.
- Today phases: `[walk, wait, ride, walk]` = `[trip.board.walk_min, row.today.wait, trip.ride_min, trip.alight.walk_min]`, total `row.today.total`, where `trip = race.today.trips[row.today.trip]`.
- Result and margin are `row.result` and `row.margin`. The result never depends on the shown numbers (R7.4).
- `shownMargin` is `shownTotalA - shownTotalB` in absolute value and is shown only for 1938 and today results. Property P4 says a stored win never shows a margin under one.

The stored parts sum to the stored total within rounding at three decimals (for example 2.258 + 30.458 + 8.283 + 4.156 = 45.155 against 45.156). The site never relies on the sum: totals always come from the stored `total`, and parts are rounded to add up to the shown total (section 6).

## 6. Display rounding (R7)

`rounding.ts` exports one pure function.

```ts
// parts: stored non-negative minutes, in phase order; total: stored total (nearest whole, halves up)
function roundParts(parts: number[], storedTotal: number): { shownTotal: number; shown: number[] }
```

Algorithm, exactly as screen-brief 2.10:
1. `shownTotal = floor(storedTotal + 0.5)`.
2. `shown[i] = floor(parts[i])`; `missing = shownTotal - sum(shown)`.
3. Give one minute each to the parts with the largest fractional remainder, largest first, ties to the earlier phase, until `missing` is used up.

Edge handling: if `missing` is negative (parts that sum to more than the stored total's rounding) the function does not invent a rule; it floors to zero extra and the property test (P4) is run over random inputs to prove it cannot happen for inputs where `|sum(parts) - storedTotal| < 0.5`, which the pipeline's three-decimal rounding guarantees. If an input violates that bound the function throws a `RoundingError`, which `derive.ts` turns into the data-error state (a number that cannot be shown consistently is not shown). Fractions are compared after rounding to six decimals to avoid floating-point ties.

The six example rows from 2.10 are example tests; the four properties of R7.8 are fast-check properties over generated parts. `roundParts` is also what the Sources sheet calls to decide whether a shown part needs the "Exact value … Parts are rounded" line (R7.7): it adds the line when `shown[i] !== Math.round(parts[i])` (halves up).

`gaps.ts`: `roundMinutes(x) = floor(x + 0.5)` and the gap part (R8.5):

```ts
function gapPart(min: number, max: number): string   // returns the {gap part} text
// a = roundMinutes(min), b = roundMinutes(max)
// a === 0  -> "up to {b} minutes apart"      (checked first)
// a === b  -> "{a} minutes apart"
// else     -> "{a} to {b} minutes apart"
```

A rounded maximum of 1 reads "up to 1 minutes apart" with this rule. The copy table has no singular form and the site does not write new wording, so the design keeps the template as written. (Real data has no such case: the smallest maximum is 18.) The 1938 part uses the same rounding: `every {a} or {b} minutes`, or `every {a} minutes` when equal.

## 7. Time and dates (R3, R15)

`time.ts`:

- `defaultMinute(now: Date): number`. Uses `Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit' })` to read hour and minute in New York, drops seconds, and returns that minute if it lies between the race file's first and last row (inclusive), otherwise 10:00 (600). Property P2 runs it over every minute of a day and over the clock-change days (including the repeated and missing hour). The 10:00 fallback and the range ends come from config and the race file; the function takes the range as arguments.
- `label12(hhmm: string): string` gives "10:00 AM" for the slider label and board chips use plain `hh:mm` as in the mockups (the mockups show 24-hour chips: "10:06"). Window labels use 12-hour ("9:00 AM", "2:00 PM").
- `serviceDateLabel(iso: string): string` gives "Nov 4, 2026" using `Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })` on the date parsed as UTC, so it can never shift a day.
- `clockLabel(startHHMM, elapsedMinutes): string` gives the "10:08" in "10:08 scheduled". It floors to whole minutes.

The slider's end labels are `rows[0].t` and `rows[rows.length-1].t`, shown as `h:mm` without leading zero for the first ("9:00") and as given for the last ("13:52") to match the mockups.

## 8. Lookups (R8)

`lookup.ts`:

- `rowAt(race, hhmm)`; `tripAt(race, i)`.
- `nextAfter<T>(list: T[], current: T, count: number): T[]`: the entries from `current` forward by position. Used for the board: 1938 passes from `row.y1938.dep` (found by string equality in `race.y1938.passes`) and trips from `row.today.trip`. No time comparison happens. Four 1938 times and three bus times, or fewer if the list ends.
- `sourceRow(id)`: the registry described in section 10.

The board's first chip is the next departure for that side (filled); the rest are plain (R8.1). In the before-the-table state the 1938 list starts at `row.y1938.dep`, which is `row.start`, as R8.3 requires.

## 9. Playback (R5)

### 9.1 Timeline
`timeline.ts` is pure.

```ts
type Segment = { side; kind; from: number; to: number /* scheduled minutes since start */ };
type Timeline = { segments: Segment[]; end1938: number; endToday: number | null; speed: number /* scheduled min per real s */ };
function buildTimeline(view: RaceView): Timeline
```

Segments are cumulative stored parts. `speed = max(4, longest / 12)` where `longest` is the larger stored total, so a trip longer than 48 scheduled minutes plays in exactly 12 s and shorter ones play at 4 scheduled minutes per real second (R5.2). The shown rounded numbers are never used here.

### 9.2 Clock
`clock.ts` owns one `requestAnimationFrame` loop. On each frame it computes `elapsed = (now - t0) * speed / 1000` scheduled minutes and writes it to the root element as `--elapsed` (a number) plus a data attribute for the phase, and it calls `lanes.update(elapsed)`.

To honor "animate only transform and opacity" the lane drawing is built so that nothing needs layout:

- Each bar segment is a fixed-position element whose final width is set once by `layout.ts` from stored minutes on the shared scale. The fill is an inner element scaled with `transform: scaleX(p)` from a left origin, where `p` is the share of that segment already done. The dimming of not-yet-reached segments is an `opacity` change.
- Each vehicle is positioned at `translateX(...)` computed from the filled length.
- The status line text is the only thing that changes content, and it changes at whole-minute steps, not per frame.

The clock exposes `start(timeline)`, `stop()`, `skip()`, and a promise-free callback `onFinish`. It pauses nothing on hidden tabs by itself; it uses the timestamp difference, so a tab that was hidden catches up and finishes at its real time. A frame-rate watchdog counts frames in the first second of a race; if it measures under 30 per second it switches `motion` to `lite` (R5.10): bob, sparks and glow breathing are turned off via a root class, the movement stays.

### 9.3 Phases and events
- The 1938 trolley waits at the start of its bar, then moves along the ride segment; the bus does not move during a walk and moves during its ride (R5.5). A walk fills its dotted segment at clock speed and a small dot travels it.
- Arrival events fire when `elapsed` crosses `end1938` or `endToday`: the arriving bar end gets the 200 ms emphasis then a 600 ms settle, identical for both sides (a CSS class toggling opacity only). The shown total for that side appears at that moment.
- The race ends when both sides are done (for no-ride, when the 1938 side is done). `onFinish` sets `phase: 'finished'`, which triggers the result box entrance (260 ms), the honest line fade (200 ms, delayed 150 ms), and the one announcement.
- Photo finish: the two arrival emphases are applied in the same frame, by the same code path, so nothing is winner-specific.
- Skip to result sets `elapsed` to the end, applies the final classes, and runs the normal entrance.
- Slider input while running: `clock.stop()` first, then state update, then a 300 ms debounce timer starts the next race (R3.5).
- The first race starts 300 ms after data is ready (R2.5). `performance.mark('race-start')` is called when the first segment begins to move (for R16.2).

### 9.4 Motion levels and reduced motion
`motion.ts` reads `matchMedia('(prefers-reduced-motion: reduce)')` and listens for changes. Levels:

- `full`: everything in screen-brief 3A.6.
- `lite`: movement only (watchdog fallback).
- `reduced`: no clock. Every state change produces the finished view at once: lanes drawn finished, vehicles parked at the bar ends, result box present, honest line present, "Skip to result" absent, board absent on a phone, sheets and banner without sliding (their transitions are removed by the same root class). The announcement still speaks once per race (R13.2).

Styles use `@media (prefers-reduced-motion: reduce)` as a safety net on top of the JS level, so a missed JS path cannot animate.

### 9.5 Trolley liveliness
Bob, sparks and glow breathing are CSS keyframe animations on separate elements, gated by a root class (`motion-full`) and by "moving" and "racing" classes:

- Bob: a `translateY(-2px)` keyframe on the trolley body, 1,600 ms, ease-in-out, only while moving.
- Sparks: two small circle elements at the pole shoes; each toggles `opacity` 0 to 1 for 120 ms. Random gaps of 1.5 to 4 s come from one JS timer per race (`setTimeout` with a random delay) that adds and removes a class, so the CSS stays transform/opacity only.
- Glow: two stacked copies of the trolley outline (1.5 px and 7 px blur applied as static `filter` on a layer that is never animated); the wide layer's `opacity` breathes 85% to 100% over 2,400 ms. The blur is fixed in the layer's own style, not animated, which keeps the animation on the compositor.
- Hubs: the hub ring is a `transform: rotate` keyframe on each wheel, running only while moving.
- After the finish the glow is held at 100% and nothing else runs.

## 10. Number buttons and the Sources sheet (R9)

Every number the card prints goes through `numbers.ts`:

```ts
function numberButton(spec: { id: string; text: string; label: string; source: SourceSpec }): HTMLButtonElement
```

`id` is stable per number on screen (`ride-1938`, `wait-today`, `total-today`, `board-1938-0`, `count-wins`, ...). Creating a button also registers its `SourceSpec` in a per-render registry, so the Sources sheet is built from the same registry: P3 (every number on the card has a row) holds by construction, and a test also checks it by crawling the rendered DOM: every `button.num` has a registry entry and a row in the sheet.

A `SourceSpec` has: the value text; what it is (copy template); the catalog entry id (`guide1938_diagram` and so on) and optionally a more specific URL from the race file (`y1938.sources.ride_min`, `.passes`); the "how it was worked out" template id; the date kind (`effective` or `feed`); and, for bus numbers, the trip (route, headsign). The row renders: value and meaning; label plus link (opening in a new tab with `rel="noopener"`); one-line method; date line. Walk rows add "estimate" and the catalog method entry's `what` verbatim; no other formula text exists in the site (R9.5). A rounded part that is not the plain rounding of its stored value adds the "Exact value" line (R7.7). The last row is always "Sources and credits".

The sheet opens scrolled to the tapped number's row (`scrollIntoView` with `block: 'nearest'` for reduced motion, a plain jump otherwise) and the row gets the `--ghost` left edge and tint.

The honest-line counts and the "When today wins" counts are number buttons too; their source is the summary file with the race-derived catalog entries (`summary.sources`).

## 11. Share link, picker, swap (R4)

`share.ts`:

```ts
const encode = (p: Pair): string => `?from=${p.origin}&to=${p.dest}`;
function decode(query: string, known: Set<string>): { pair: Pair; bad: boolean }
```

`decode` uses `URLSearchParams` inside a try/catch, accepts only two parameters whose values are known slugs and different, and returns the lead pair with `bad: true` on anything else (including an empty or non-string input); with no query at all `bad` is false. It never throws (P1). The lead pair constant is `{origin: 'preston-caroline', dest: 'aliceanna-bond'}` in `config.ts`, checked at boot against `index.corners`; if either slug is missing from the data the screen goes to `data-error`.

Pair changes call `history.replaceState(null, '', BASE + encode(pair))`, query only (R4.7, P12). "Share this race" copies `location.origin + location.pathname + encode(pair)` with `navigator.clipboard.writeText`, falling back to a hidden text area and `execCommand('copy')`, and shows the button's copied state as a text change only (no new wording: the label alternates between the two strings in the copy table; see section 18 for the open point on a "copied" confirmation).

The corner picker is the `corners` sheet with the two-step flow from screen-brief 2.12. State lives in `picker`. Choosing a start disables it in the second step; choosing an end calls `setPair`. Cancel closes without change. The map uses the same state machine (section 12.4).

Swap reverses the pair, loads the matching race file if needed, and keeps the minute.

## 12. Map (R11)

### 12.1 Two layers, one area
The map area always contains the route drawing first (`routedrawing.ts`), an SVG built from `route.geojson` and the corners from `index.json`: legs as paths, inferred legs dashed, street names along legs on `textPath`, corner dots and names. It is drawn as soon as `route.geojson` arrives (after first render). If MapLibre loads and renders its first frame, the SVG fades out (opacity) and the tiles map shows; if MapLibre fails, the SVG stays and the line "Map unavailable. Showing the route diagram." appears. Before `route.geojson` arrives the area is the plain `--night` background, so the race card never waits for it.

### 12.2 MapLibre chunk
`map/map.ts` is a dynamic import started after the race card is painted (`requestIdleCallback`, with a 1 s timeout fallback). It creates the map with:

- the OpenFreeMap vector style, its URL taken from the Source URLs list in tech.md (section 18, point 1);
- `style.ts` overrides that recolour the style to palette B: background `--night`, streets as hairlines in `--street` (main roads `--street2`, about twice as thick), no building or land fills, no labels except street names in `--muted` at 80% opacity or more, harbour left as empty background (the tiles' water layer is hidden, matching "no shoreline is drawn");
- `route.geojson` as a source with three layers: a wide blurred copy and a bright line in `--ghost` for legs, a dashed line layer filtered by `method == 'inferred'`, and a symbol layer with `symbol-placement: line` and `text-field: ['get','street']` (condensed type, dark halo);
- corner circles and labels from `index.json` (origin filled, destination ring, inferred dashed outline and "(inferred)" suffix; on a phone only the chosen two are labelled; the Dolphin St and Preston St labels are hidden by a filter when the inferred corner is chosen on a phone);
- the map marker: a DOM marker holding the simplified trolley SVG, moved with `marker.setLngLat(point)`, which MapLibre applies as a `transform`. Its position along the route comes from `play/clock` through a helper that maps ride-phase progress `p` to a point on the joined route polyline (distance along the line by the geometry's own segment lengths; geometry arithmetic, not race arithmetic). It stops a short distance before the destination dot.

The fit bounds and padding depend on the layout (phone: 150 px strip; desktop: area left of the 440 px race column with room for the headline top left), set from `config.ts` constants. The credit line text is a DOM element over the map; the MapLibre attribution control is configured to show the OpenFreeMap and OpenStreetMap attribution required by their terms.

### 12.3 Failure paths
`map.ts` import failure, WebGL absence (`maplibregl.supported` or context creation failure), the style or tiles failing to load within a timeout (8 s after the map is created, or the `error` event for the style), or the host being blocked all set `mapStatus: 'unavailable'`. None touches `data.status`. The race continues unchanged (R11.4, R14.3). An e2e test blocks the tile host and removes WebGL and plays a whole race.

### 12.4 Picking on the map
On both layouts a click or tap on a corner circle (or its drawing dot in the fallback) feeds the same picker state machine. Phone: it opens the Corners sheet at the right step. Desktop: it advances the picker without opening the sheet; a small hint strip over the map shows the existing step lines from the copy table ("Choose where the ride starts", then "Start is set. Now choose where the ride ends."), and a second click completes the pair. The Corners sheet stays available by keyboard and from the pair row. This is a design choice the requirements leave open (section 18, point 2).

## 13. Layout and CSS (R1, R12)

### 13.1 Structure
`index.html` contains the static shell: `header` (wordmark only), `main` with the map area, the race card, the sheet roots, the live region and the banner root. The pair names in the pair row are in the HTML for the default pair (R2.2); a test asserts they equal the lead pair's corner names in `index.json`.

Two layouts, one DOM. CSS grid with `@media (min-width: 900px)`:

- Phone (375 × 667 design): `grid-template-rows: 40px 150px 1fr`; the card has `margin-top` overlap with a rounded top; the card content scrolls inside `overflow-y: auto` with the two buttons in a pinned footer strip using a solid `--panel` background and a 6 px bottom offset.
- Desktop (1280 × 800 design): `grid-template-columns: 1fr 440px`; the map fills the left cell under the 56 px top bar; the headline block is absolutely positioned over the map's top left; the race column is `overflow-y: auto` for windows under 720 px tall; the buttons and footer line follow the content in normal flow.
- Sheets: a `.sheet` element positioned absolutely within the race column on desktop (slide from the right via `transform: translateX`) and fixed to the viewport bottom on phones (slide via `transform: translateY`); the scrim fades by `opacity`.

No horizontal scroll at any width: all widths use `min()`/percentages inside the card; long names wrap; a test measures `document.documentElement.scrollWidth <= innerWidth` at 320, 375, 899, 900, 1280 and 1920.

### 13.2 Tokens and type
`tokens.css` defines palette B exactly as in ui.md and the sizes from 3.3 and 3A.1 as custom properties. `@font-face` for Barlow Condensed 600 loads one WOFF2 with `font-display: swap` and a `<link rel="preload">` so the first paint does not wait for it; the system stack covers the swap. Tabular figures via `font-variant-numeric: tabular-nums`. Sentence case throughout (no `text-transform`).

Sizes: phone wordmark 24, corner names 21 (17 with the chip), slider time 24, lane title 17, lane total 22, result line 29, body 12 to 13; desktop wordmark 30, headline 54, corner names 25, result line 38. Tap targets are at least 44 × 44 px (padding, not font size).

### 13.3 Lanes
`layout.ts` computes one scale from the larger stored total: `px per minute = barWidth / longestTotal`; each segment's width is its stored minutes times that, with a minimum visible width of 2 px for any non-zero part. Bar height 9 px. Phase patterns: wait = hatched via a repeating-linear-gradient background, ride = solid, walk = dotted via a radial-gradient background; each segment is labelled in the legend by text (never by colour alone). Status lines and legends sit under each bar as in the mockups.

Vehicles per ui.md: trolley 150 px racing / 104 px finished (phone), 200 px always (desktop); bus 84 px phone, 104 px desktop; the trolley's two wires are two hairline elements across the full card width (fading at the edges by a gradient mask), the bus has one hairline. Size changes (150 to 104) happen at the finish as an instant swap behind the result box entrance, not an animated resize (no animated width).

### 13.4 Result box and notices
`#100C16` box with two inner hairlines; the result line takes the winner's token colour from a data attribute (`data-result="1938|today|photo_finish|no_one_seat_ride"`), where the colour mapping is the only thing that differs. Everything else (font, size, padding, position, entrance) is shared CSS. A test compares the computed layout of the box for a 1938 win and a today win (same rect, same font size and weight, same classes except the data attribute) (P8).

Notices (before the table, inferred) are a tinted strip with a `--ghost` left edge under the slider; while one shows, the schedule line is hidden (R6.7). The banner is a light pill over the top bar.

## 14. Vehicles (R12.3)
`vehicles.ts` returns inline SVG strings, drawn from scratch to the 3A.2 spec (240 × 104 proportions): rounded 1930s body with crowned roof and sloping front, five lit windows, a curved cab window, two double-leaf doors, belt rail and trim lines, a destination-sign bar, headlamp, bumpers, tyres with hub rings, three faint passenger silhouettes, two trolley poles with shoes rising to two wires and two retriever ropes, and the route number on the rear. No rails. Outline in `--ghost`, body fill about 15% opacity, windows `--lit`. The route number text is a `<text>` node filled from the route label (R2.2); the function takes `routeNumber: string | null` and omits the node when null (data-error state). The map marker is a separate simplified drawing (solid body, window strip, two wheels, two poles). The bus is a plain flat shape in `--today`. All three are original drawings and are never traced; the credits say "illustration".

## 15. Accessibility (R13)
- Landmarks: `header`, `main`, `section[aria-label]` for the race card, `footer`.
- The slider is a native `input[type=range]` with `min`, `max` from the race file, `step=1`, `aria-valuetext` "10:00 AM, scheduled weekday time". Minus and plus are buttons with labels; dragging updates the visible time and the board but does not start a race (R3.5).
- The result region is `<div role="status" aria-live="polite" aria-atomic="true">`. `a11y.ts` writes the announcement string once per race, at `finished`, after clearing the region and using a 50 ms delay so assistive tech picks it up. Nothing else writes to it; the animation updates elements with `aria-hidden="true"` or elements outside the live region. With reduced motion the same code runs at once.
- Every number button has `aria-label` such as "9 minutes, scheduled 1938 ride. Show source." built by the registry.
- Sheets use `role="dialog"` with `aria-modal`, a focus trap, Escape to close, and focus returns to the opening control on close (stored in the sheet's open call).
- The corner picker is a list of buttons (`aria-pressed` on the start in step two, `disabled` on it), usable with no map or WebGL.
- A visible focus ring (2 px `--ink` with an offset) on every control.
- Contrast: tokens are checked by a unit test that computes WCAG ratios for every foreground/background pair in a table (text on panel, night, result box, chips) and fails under 4.5. Dimmed bar segments are decoration; the text beside them carries the information.
- axe-core runs in jsdom on every reachable state (section 16) and in Playwright on the two layouts for the states where layout matters.

## 16. Wording and copy (R15)
`copy.ts` is the only module with user-visible literals, as template functions: `copy.ready(dateLabel, fromClock)`, `copy.racing.wait1938(n, hhmm)`, and so on, one per row of the requirements copy table. A test extracts the quoted strings from the copy table in `requirements.md` and fails if `copy.ts` holds a literal that is not a row's template, or if a table row has no template (this is how "use only the copy strings" is enforced). A second test renders every reachable state and scans its text for the banned words, allowing only "Scheduled, not live." (P6). The `aria-live` attribute name is not text. A third test swaps `summary.json` for one with different counts and asserts the screen shows those counts and that no digit string from the real summary appears in any `src/` file (P5).

## 17. Error handling
| Condition | Result |
| --- | --- |
| Any of index, summary, race file fails to fetch, parse or pass the shape check; or 3 s pass at boot | `data-error`: message and Retry; no number, no "No. 21, 1938", trolley without its number; corner names stay from the static HTML |
| On-demand race file fails after a pair change | the same `data-error` (nothing is guessed) |
| `route.geojson` fails | map area keeps the plain background; "Map unavailable" notice |
| MapLibre import, WebGL, tiles, style fail | route drawing stays; notice; race unaffected |
| Rounding invariant cannot hold (section 6) | `data-error` |
| Bad share link | default pair, bad-link banner, race runs |
| Clipboard unavailable | fallback copy; if that fails, the share button stays and the address bar already holds the link (R4.7) |

## 18. Choices this design makes that the requirements did not fix (for your review)
1. **OpenFreeMap style URL and attribution text.** The design needs the exact style URL and the attribution wording OpenFreeMap requires. They are not in the repository and I did not look them up. Per tech.md they must be added to the "Source URLs" list (with provenance) before the map is built; `map/style.ts` and the credits then read them from the one constants block.
2. **Picking on the map on desktop** (section 12.4): clicks drive the same two-step picker, with a small hint strip using the picker's existing step lines. If you would rather open the Corners panel on every map click, that is a one-line change.
3. **Route drawing doubles as the placeholder** (section 12.1): the SVG route is shown while tiles load and removed when the tiles map renders, so the map area is never blank. The "Map unavailable" line appears only on failure.
4. **Hand-written shape validators** with a contract test against the pipeline's schema files (section 3.2), instead of shipping a schema library within the 100 KB budget.
5. **Share confirmation.** The copy table has no "copied" string, and the design does not invent one. The button label stays "Share this race"; copying is silent except for the clipboard. If you want a visible confirmation, I need the wording.
6. **"up to 1 minutes apart"** (section 6): the table has no singular form. The data cannot produce it today (smallest maximum is 18).
7. **Result timing**: the result box and the announcement come when the slower side finishes; the first arrival only emphasises its bar end and shows its total (R5.6, R5.7).
8. **Frame-rate fallback** (`lite`) is decided in the first second of a race and stays for the session.

## 19. Testing strategy (R17)

| Layer | Tools | What it proves |
| --- | --- | --- |
| Unit | vitest | rounding examples (six rows of 2.10), time and date functions, `decode` rows 5 to 8 and default-time rows 1 to 4 of race-brief 5.9, gap parts, list joining, timeline build, source registry |
| Property | fast-check | P1 share link round trip and `decode` never throws on any string; P2 default time in range for every minute and clock-change day; P4 rounding (sum, within one, whole inputs unchanged, deterministic, shown margin is the difference, stored win never shows margin under one); P11 gap part; P12 URL after any pair change |
| Real data | vitest on web/public/data | P9: for all 20 pairs and 293 minutes, the view's result, margin sign and colour equal the stored row; every `today.trip` resolves; shape validators accept all 23 files and reject mutated copies; the contract test with the pipeline schemas |
| DOM | jsdom + axe-core | every state of R17.1 rendered from real data (today wins: Westwood & Carey to Preston & Caroline at 11:23; photo finish: lead pair at 10:30; before the table: lead pair at 9:00; inferred: a Brevard pair) and from the fixture line (no one-seat ride, with the fixture tag); P3 (every number button has a registry entry and a sheet row); P5, P6, P7 (no digit in the DOM in the data-error state), P8 (box geometry); the copy-table test; accessibility check per state |
| End to end | Playwright | the full first race on both layouts; the race with the tile host blocked and WebGL off ("map blocked"); reduced motion (no running animation, finished at once); keyboard-only run through slider, picker, swap, sources, about; no horizontal scroll at widths 320 to 1920; the throttled-phone measurement of R16.2 (slow 4G, CPU slowdown through the browser's debugging protocol, `race-start` mark, five runs, median) against the deployed or preview URL; screenshots of every mockup state saved for side-by-side review against `ui-mockups/` |
| Budget | node script | `npm run build` then a script (also one command) gzips the first-load assets, excluding the map chunk, and fails over 100 KB |

Fixtures: the made-up line lives in `web/tests/fixtures/` (named fake, never under `public/`), holds the same file shapes (including `today: null` rows, an empty trips list and null gaps), and is loaded by the DOM tests through the same loader with a base-path override.

npm scripts, one command each: `dev` (vite), `build` (vite build), `test` (vitest run). Playwright, the size check and the throttled-phone run have their own one-command scripts (`test:e2e`, `check:size`, `perf`). The deploy workflow builds `web/` and publishes `web/dist` to GitHub Pages with `base: '/Ghost-Line/'`.

## 20. Requirement coverage

| Requirements | Designed in |
| --- | --- |
| R1 layout | 13 |
| R2 first load | 3.3, 4, 9.3, 12.1, 13.1 |
| R3 slider and default time | 7, 9.3, 15 |
| R4 pair, swap, share | 11, 12.4 |
| R5 playback | 9, 13.3 |
| R6 results, honest line | 5, 13.4 |
| R7 rounding | 6 |
| R8 board and frequency | 6, 8 |
| R9 sources | 10 |
| R10 About and credits | 10, 16 (credits are copy rows plus the catalog labels and links) |
| R11 map | 12 |
| R12 visual | 13, 14 |
| R13 accessibility | 15 |
| R14 data errors | 3, 17 |
| R15 wording | 16 |
| R16 performance and hosting | 2, 3.3, 12.2, 19 |
| R17 tests | 19 |
