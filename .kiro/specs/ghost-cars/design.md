# Ghost cars: Design

Requirements: requirements.md in this folder. The browser only looks up, rounds and animates (tech.md): every comparison and sum below lives in a module the principle test allows (`data/lookup.ts`, `format/time.ts`, `play/timeline.ts`, `view/layout.ts`).

## 1. Data: the Cars of a row

`data/lookup.ts`:

```ts
/** The Cars of a row (Req 1): passes p with start <= p < the bus departure, in seconds; null when the row has no trip. */
export function carsOf(race: RaceFile, row: RaceRow): { passes: string[]; covered: boolean } | null
```

- Seconds come from a new `secondsOf(hhmmOrHhmmss)` in `format/time.ts` (hours may pass 24).
- `covered` is `secondsOf(dep) <= secondsOf(last pass)`.
- `null` for a row with `today === null` or a trip index outside the list.

`state/derive.ts` adds `ghosts: GhostPlan | null` to `RaceView`, from lookups only:

```ts
export type GhostPlan = { passes: string[]; n: number };   // passes[0] is the own car
```

`ghosts` is non-null only for a Ghost_Row: not `before_table`, result not `no_one_seat_ride`, `covered`, `n >= 2` (Req 2).

## 2. Time: when each car runs

`play/timeline.ts` adds to `Timeline`:

```ts
ghosts: { at: number[]; ride: number; busAt: number } | null
```

- `at[k]` = minutes from `view.start` to `passes[k]` (`minutesOf` difference), `ride` = `race.y1938.ride_min` passed in through the view (`view.ride1938`, the stored 1938 ride), `busAt` = the end of today's wait segment (walk to the stop plus the wait), which is the bus departure relative to the start.
- `buildTimeline(view)` fills it from `view.ghosts`.

Two pure functions:

```ts
/** Each Ghost car's share of its ride at `elapsed`, or null where it is not on the route (Req 3.1, 3.2): before at[k], or at or after at[k] + ride. */
export function ghostShares(timeline: Timeline, elapsed: number): (number | null)[]   // one entry per ghost (k >= 1)
/** The counter at `elapsed` (Req 4.2 to 4.4): before the own car, counting with k, or finished. */
export function counterAt(timeline: Timeline, elapsed: number): { kind: 'empty' } | { kind: 'counting'; k: number } | { kind: 'finished' }
```

`counterAt` gives `finished` once `elapsed >= busAt`; `counting` with `k = cars with at <= elapsed` from `at[0]`; `empty` before `at[0]`.

## 3. The map and the drawing

`view/layout.ts` already has `trackPoint(track, p)`. `view/mapview.ts` gains `ghosts(shares: (number | null)[])`, called from the clock's frame next to `ride()`:

- **Drawing** (strip, desktop before the map, map unavailable): a pool of `div.drawing-marker.ghost-car` elements after the own marker, one per Ghost car, each placed with `--mx`/`--my` like the own marker and `hidden` when its share is null or the map is ready.
- **Map**: `MapHandle.ghosts(points: ([number, number] | null)[])`, a pool of MapLibre `Marker`s whose element is `div.map-trolley.ghost-car`, created on demand and removed when null. The no-WebGL and failed handles get an empty `ghosts() {}`.
- At rest (`sync` with the race not running) every Ghost car is hidden and removed from the map (Req 3.6, 5.3).
- CSS (`map.css`): `.ghost-car { opacity: 0.45; filter: drop-shadow(0 0 2px var(--ghost)); }` against the own marker's 4 px glow. Position by transform only (the existing `.drawing-marker` rule). No new transition or keyframe.
- The map line: a third `p.map-ghost` in `.map-lines`, text `MAP_GHOSTS`, shown while the race runs on a Ghost_Row, on the map, the strip and the drawing alike (Req 6.1). It sits under the credit or the unavailable notice.

## 4. The counter on the card

- `view/lanes.ts`: the today lane of a Ghost_Row ends with `p.ghost-counter` (12 px text, `--fs-body-small`, line height 1.35, `min-height: 1.35em`, `margin-top: 2px`), on both the racing and the finished card, so its line is there from the first frame (Req 4.1).
- Its content: racing, empty until the first frame; finished, `sentence(registry, ghostFinished, nNum)`.
- `view/racer.ts`: each frame reads `counterAt(...)` and rewrites the line only when the kind or `k` changes, through the same focus-keeping helper the status line uses (Req 4.6). `finish()` writes the finished sentence (skip and the natural end both pass through it).
- Reduced motion and shared links draw the finished card, so the finished sentence is there at once (Req 5.1).

## 5. Sources

`state/specs.ts` adds `ghostCountNum(race, view, value, id)`: `what: WHAT.car1938`, `rowWhat: whatAt(WHAT.car1938, view.originName)`, `sourceIds: ['guide1938_timetable']`, `url: race.y1938.sources.passes`, `method: METHOD_GHOST_COUNT`, `date: 'effective'`, text the count. One id, `ghost-count`, for both `{k}` and `{n}`: only one is on screen at a time and the registry row follows the shown value.

## 6. Copy

`copy/copy.ts`: `ghostCounting(k)`, `ghostFinished(n)`, `METHOD_GHOST_COUNT`, `MAP_GHOSTS`, exactly the four rows of the ghost-cars copy table. `tests/support/copytable.ts` reads that table too, and `effectiveCopyTable` adds its rows (the four strings replace nothing). ui.md's copy rule names the ghost-cars spec.

## 7. Phone fit

The counter takes one 12 px line plus 2 px in the today lane, above the result box. The phone fit test (polish brief P4) already counts that room; after this spec it measures the counter itself. Before the spec it gave 19.4 px to spare at 375 x 667.

## 8. Decisions

1. Ghost cars show only while the race runs. At the finish (natural end, skip) and on a held or finished card all are gone: a car frozen half way along the route would read as a car standing there.
2. A row whose bus leaves after the last listed pass gets neither Counter nor Ghost cars (brief G2 names the Counter; the cars go with it so the map never shows cars the counter does not count).
3. One Sources row id for `{k}` and `{n}`.
4. No new "what a number is" phrase: the count's button is named with the existing 1938-car phrase.
