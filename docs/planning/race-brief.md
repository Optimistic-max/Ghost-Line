# Ghost Line: race brief (Brief 1, the race engine)

**What this file is.** A planning brief written on November 15, 2026, with Claude Code, before the Kiro build started. The first part is the feature brief to give to Kiro's spec flow. The rest is the reference it points to: the system design (section 4) and the algorithms with expected test values (section 5). It holds pseudocode and expected values, not program code. The pipeline is built in Kiro.

**How claims are marked.**

- **[F]** = from the hand-entered facts files or the earlier planning record.
- **[C]** = computed during planning from the pinned MTA feed (feed_version 20260821, service date 2026-11-04) by a throwaway script that is not in this repository. Treat these as expected values to reproduce, not as text to copy.
- **[A]** = a design assumption or judgment.
- **TO COMPUTE** = a value nobody has yet; the text says how to get it.

**If the build disagrees with an expected value here: stop and tell Emmanuel. Do not change the expected value, a facts file or a test to make a check pass.**

Section numbers match the master plan (4 and 5 here; 2 and 3 are in `screen-brief.md`).

---

## Brief 1: feature brief for the `race-engine` spec

```text
Feature: race engine (the build-time pipeline)

Build a Python package, pipeline, that turns the 1938 facts file and the pinned
MTA feed into the JSON files the site loads. Follow the steering files. The
algorithms, file formats and expected values are in
docs/planning/race-brief.md, sections 4 and 5; treat its pseudocode as the
intended behaviour and its tables as test cases. If something there is unclear
or looks wrong, ask me before designing around it.

What it must do
1. Feed check: read raw/mta_local_bus.zip, compare its SHA-256 with the pinned
   value, and stop with a clear error on a mismatch or a missing file.
2. Facts: load data/lines/no21-1938.yaml, validate its shape, and refuse to run
   if a timing point, a minute value or a departure list is missing.
3. 1938 clock: for each of the five corners and each direction, the list of
   scheduled passing times and the "covered from" time.
4. Stops and walks: for each corner, the stops within 400 m by geodesic
   distance and the walk minutes to each.
5. Eligible trips: for each of the 20 directed corner pairs, the one-seat trips
   on 2026-11-04, one record per trip, boarding before alighting.
6. Race: for each pair and each whole minute from 9:00 to 13:52, both sides'
   times from the same start, and one of four results: 1938, today,
   photo_finish (under 1.0 minute apart), no_one_seat_ride.
7. Summary: per-pair counts and ride verdicts, the totals behind the line
   "Same ride, longer wait.", and the list of every race today wins.
8. Route: join the OSM ways listed in the facts file into the 1938 route, leg by
   leg, failing on any undeclared break or length mismatch.
9. Output: write web/public/data/ (index.json, summary.json, one race file per
   pair, route.geojson), validate each file against a JSON schema, and fail if
   any number lacks a source entry.
10. Commands: validate, build, check, verify, check_sources, as described in the
    tech steering file.

Rules that must always hold (please turn these into correctness properties)
- No 1938 wait is ever longer than 8 minutes.
- Both sides of a race start from the same time, and that time is never earlier
  than the slider time.
- The chosen bus is one the rider can reach after the walk, and no other
  reachable bus gets to the destination corner sooner.
- Starting later never gets you there earlier.
- A result always agrees with the two totals and the 1.0-minute band.
- For every pair, the three result counts add up to the number of races.
- The average-wait formula returns half the gap for equal gaps, is never below
  half the mean gap, and ignores the order of the gaps.
- A route leg is never shorter than the straight line between its two ends.
- Building twice gives identical files.

Expected values
Use the test tables in docs/planning/race-brief.md sections 5.1 to 5.9 as
golden and example tests. They were computed during planning. If the pipeline
disagrees with one, stop and tell me; do not change the expected value.

Not in this spec
The website, the MCP server, the census sentence, the HOLC layer, transfers,
any real-time data.

Done when
`python -m pipeline check` passes on my machine with the feed present, the
hosted test run passes with the feed absent, and the lead pair's race at 10:00
reads 15 minutes against 45.156.
```

---

## 4. System design

Ghost Line is a folder of static files. A Python pipeline does all the arithmetic once, on the developer's laptop, and writes small JSON files; the phone only looks numbers up. There is no server to wake, so there is no cold start.

### 4.1 How the race starts in 3 to 5 seconds

The race card must not wait for a map. Three rules [A]:

1. The first screen needs only the HTML, one CSS file, one small script, one font file and the lead pair's data. Budget: under 100 KB compressed in total.
2. The lead pair's race file is embedded in `index.html` at build time, so the first race needs no second request.
3. Any interactive map loads afterwards (a lazy `import()` once the race is on screen). If it never arrives, the bundled route drawing stays.

TO COMPUTE: the real time to race start. Method: add `performance.mark("race-start")` when the first lane begins moving, run Lighthouse in mobile mode with its default slow-4G throttling against the deployed URL, five runs, and record the median. Pass if the mark is under 5,000 ms. Repeat once on a real phone on mobile data.

### 4.2 Build-time pipeline

One command, `python -m pipeline build`, runs these steps in order. Each step is a small module with its own tests.

1. **Check the raw feed.** Read `raw/mta_local_bus.zip`, compute its SHA-256, and stop with an error unless it equals the pinned hash.
2. **Load the facts.** Parse and validate `data/lines/no21-1938.yaml` (timing points, minutes, departures, legs).
3. **Build the 1938 clock.** For each corner and direction, the list of scheduled passing times (5.1).
4. **Find stops.** For each corner, every stop within 400 m by geodesic distance, with its walk minutes (5.3).
5. **Find eligible trips.** For each of the 20 directed pairs, the one-seat trips on the service date (5.4).
6. **Run every race.** For each pair and each whole minute from 9:00 to 13:52, compute both sides and the result (5.5).
7. **Summarise.** Per-pair verdicts and the honest-line counts (5.6), plus the window-average check values (5.7).
8. **Rebuild the route.** Join the OSM ways named in the facts file into one line per direction (5.8).
9. **Write and check.** Emit the JSON files, validate each against its schema, and run the source check: every number field has a source entry.
10. **Build the site.** `npm run build` in `web/` copies the JSON into the bundle. A GitHub Action deploys the built folder to GitHub Pages.

Because the feed zip is not committed, the hosted build cannot recompute the data. So the **generated JSON is committed** and the GitHub Action only builds the web bundle. `python -m pipeline verify` reruns steps 1 to 9 locally and fails if the committed JSON differs from a fresh build.

### 4.3 Folder layout

```text
.kiro/
  steering/     product.md  tech.md  structure.md  ui.md
  specs/        race-engine/  race-screen/  skeptic-tools/   (written by Kiro's spec flow)
  hooks/        check-after-edit.json  rebuild-on-stop.json  copy-guard.json
  agents/       skeptic.md
  settings/     mcp.json
data/
  lines/        no21-1938.yaml  no21-1933.yaml  (hand-entered facts)
  osm/          ways.json                       (OSM way geometry snapshot, ODbL, dated)
raw/            mta_local_bus.zip               (git-ignored, never committed)
pipeline/       cli.py facts.py clock.py stops.py eligible.py race.py
                summary.py route.py emit.py check_sources.py mcp_server.py
tests/
  unit/  property/  golden/
  fixtures/     fake-line.yaml  fake-gtfs/      (named fake, never shipped)
web/
  index.html  src/  public/data/                (generated JSON lands here)
docs/           planning/ (race-brief.md  screen-brief.md  skeptic-brief.md  ui-mockups/)
                video_script.md  devpost.md  kiro-usage.md
.github/workflows/pages.yml
README.md  LICENSE
```

One known trap [A]: on GitHub Pages a project site lives at `/<repo-name>/`, so Vite's `base` option must be set to that path or every asset returns 404.

### 4.4 Data files the phone loads

| File | What it holds | Budget (uncompressed) |
| --- | --- | --- |
| `data/index.json` | Line name, the five corners (slug, name, position, inferred flag, note), the 20 pairs, service date, feed version and hash, source list | 6 KB |
| `data/summary.json` | Honest-line counts, per-pair ride verdicts, the list of races today wins | 6 KB |
| `data/race/<origin>__<dest>.json` | One pair: its 1938 clock, its eligible trips, and one row per slider minute | 45 KB each, 20 files |
| `data/route.geojson` | The 1938 route by leg, each leg tagged `osm`, `osm+gap` or `inferred` | 40 KB |

Only `index.json`, `summary.json` and one race file are needed for a race. Corner slugs are fixed: `westwood-carey`, `dolphin-myrtle`, `brevard-preston`, `preston-caroline`, `aliceanna-bond`. Direction is implied by the order of the two slugs.

### 4.5 Example race file (lead pair, real values [C])

```json
{
  "schema": "ghostline.race.v1",
  "line": "no21-1938",
  "origin": "preston-caroline",
  "dest": "aliceanna-bond",
  "direction": "eastbound",
  "inferred": false,
  "service_date": "2026-11-04",
  "feed_version": "20260821",
  "feed_sha256": "8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694",
  "radius_m": 400,
  "y1938": {
    "ride_min": 9,
    "covered_from": "09:21",
    "passes": ["09:21", "09:28", "09:36", "...", "14:13"],
    "sources": {
      "ride_min": "https://collections.digitalmaryland.org/digital/collection/btjk/id/201",
      "passes": "https://collections.digitalmaryland.org/digital/collection/btjk/id/202"
    }
  },
  "today": {
    "gap_min": 34,
    "gap_max": 39,
    "trips": [
      {
        "i": 5,
        "trip_id": "4110804",
        "route": "CityLink Lime",
        "headsign": "HARBOR EAST",
        "board": {"stop_id": "8564", "name": "BIDDLE ST & CAROLINE AVE eb", "walk_m": 125.07, "walk_min": 2.258},
        "alight": {"stop_id": "9486", "name": "CAROLINE ST & EASTERN AVE fs sb", "walk_m": 230.15, "walk_min": 4.156},
        "dep": "10:32:43",
        "arr": "10:41:00",
        "ride_min": 8.283
      }
    ]
  },
  "races": [
    {
      "t": "10:00",
      "start": "10:00",
      "y1938": {"dep": "10:06", "wait": 6, "total": 15},
      "today": {"trip": 5, "wait": 30.458, "total": 45.156},
      "result": "1938",
      "margin": 30.156
    }
  ]
}
```

Field notes: `t` is the slider time; `start` is the time both sides actually race from (it differs from `t` only in the "before the midday table" state). `result` is one of `1938`, `today`, `photo_finish`, `no_one_seat_ride`. Minutes are stored to three decimals; the screen rounds for display by the rule in screen-brief.md section 2.10 (the stored values are never changed). `gap_min` and `gap_max` come from consecutive eligible departures leaving the boarding stop from 9:00 up to but not including 14:00.

### 4.6 Example summary file (shape only)

```json
{
  "schema": "ghostline.summary.v1",
  "definition": "Race at each whole minute 09:00-13:52 from the first covered minute; 400 m; photo finish under 1.0 min",
  "races": "TO COMPUTE",
  "wins_1938": "TO COMPUTE",
  "wins_today": "TO COMPUTE",
  "photo_finishes": "TO COMPUTE",
  "ride_same": "TO COMPUTE",
  "ride_faster_today": "TO COMPUTE",
  "ride_slower_today": "TO COMPUTE",
  "pairs_without_one_seat_ride": "TO COMPUTE",
  "today_wins": [{"origin": "...", "dest": "...", "t": "HH:MM", "margin": 0}]
}
```

The expected values for these fields are in section 5.6. They stay "TO COMPUTE" here because the file must be written by the pipeline, not typed in.

### 4.7 What can fail at run time, and what happens

| Failure | Effect | Handling |
| --- | --- | --- |
| Map tiles are down, or there is no WebGL | No interactive map | Bundled route drawing; the race is unaffected |
| A race file fails to load or fails its shape check | No numbers | Data-error state with Retry; nothing is guessed |
| The phone clock is in another time zone | Wrong default time | The default is always taken in America/New_York |
| The MTA publishes a new feed | Nothing | The app is pinned to the Nov 4 snapshot and says so on screen |

---

## 5. Algorithms

Each algorithm has pseudocode, test cases with expected outputs, and property tests.

**Conventions.** Times are minutes after midnight, kept as decimals (10:32:43 is 632.717). Nothing is rounded until it is shown. On screen, durations round to the nearest whole minute and clock times drop their seconds (10:32:43 shows as 10:32). "Eastbound" means toward Aliceanna & Bond.

### 5.1 The 1938 clock and the next departure

```text
PATTERN  = { eastbound: [0,7,15,22,30,37,45,52], westbound: [4,11,19,26,34,41,49,56] }
FIRST    = { eastbound: 09:00, westbound: 09:04 }
LAST     = { eastbound: 13:52, westbound: 13:56 }
MINUTES  = [8, 5, 8, 9]            # between corners, in eastbound order
CORNERS  = [Westwood&Carey, Dolphin&Myrtle, Brevard&Preston, Preston&Caroline, Aliceanna&Bond]

terminal_departures(dir):
    return every time hh:mm with hh in 9..13 and mm in PATTERN[dir]
           where FIRST[dir] <= hh:mm <= LAST[dir]            # 40 times each way

offset(dir, corner):
    i = index of corner in CORNERS
    eastbound: sum(MINUTES[0 .. i-1])      # 0, 8, 13, 21, 30
    westbound: sum(MINUTES[i .. 3])        # 30, 22, 17, 9, 0

passes(dir, corner):  [t + offset(dir, corner) for t in terminal_departures(dir)]
covered_from(dir, corner):  passes(dir, corner)[0]

next_1938(dir, origin, T):
    start = max(T, covered_from(dir, origin))
    dep   = smallest p in passes(dir, origin) with p >= start
    if none: return NO_1938_TRIP          # cannot happen for T <= 13:52; keep as a guard
    return { start, dep, wait: dep - start, before_table: T < covered_from(dir, origin) }

ride_1938(origin, dest):  sum of MINUTES between the two corners
```

Why `start` exists: the facts file lists midday cars only. Before `covered_from`, earlier cars certainly ran but are not in the file, so any wait computed there would be invented. The app says so and races from `covered_from` (state "Before the midday table", screen-brief.md section 2.4). If earlier departures are later added to the facts file, `covered_from` moves earlier and the state appears less often; the rule itself does not change.

| # | Input | Expected | Source |
| --- | --- | --- | --- |
| 1 | eastbound, Westwood & Carey, T = 13:52 | dep 13:52, wait 0 | [F] |
| 2 | westbound, Aliceanna & Bond, T = 13:52 | dep 13:56, wait 4 | [F] |
| 3 | eastbound, Preston & Caroline, T = 10:00 | dep 10:06 (the 9:45 car + 21), wait 6 | [F] |
| 4 | eastbound, Westwood & Carey, T = 10:01 | dep 10:07, wait 6 | [F] |
| 5 | eastbound, Preston & Caroline, T = 9:00 | before_table true, start 9:21, dep 9:21, wait 0 | [F] |
| 6 | westbound, Dolphin & Myrtle, T = 9:00 | before_table true, start 9:26 (9:04 + 22) | [F] |
| 7 | ride, Preston & Caroline to Aliceanna & Bond | 9 | [F] |
| 8 | ride, Westwood & Carey to Aliceanna & Bond, either way | 30 | [F] |

Property tests:

- Every corner and direction has exactly 40 passes, strictly increasing, with every gap equal to 7 or 8.
- For every corner, eastbound offset + westbound offset = 30.
- For any start between `covered_from` and the last pass, 0 ≤ wait ≤ 8.
- `next_1938` never returns a time that is not in `passes`.
- `ride_1938(a, b) = ride_1938(b, a)`, and rides add up along the line.

### 5.2 Today's next trip

```text
next_today(trips, start):
    # trips: eligible one-seat trips for this pair (5.4), each with
    #        dep, arr (at the alighting stop), access_min, egress_min
    catchable = [x in trips where x.dep >= start + x.access_min]
    if trips is empty:      return NO_ONE_SEAT_RIDE
    if catchable is empty:  return NO_MORE_TRIPS_TODAY
    best = the x in catchable with the smallest (x.arr + x.egress_min);
           on a tie, the earlier x.dep
    return { trip: best,
             access: best.access_min,
             wait:   best.dep - start - best.access_min,
             ride:   best.arr - best.dep,
             egress: best.egress_min,
             total:  best.arr + best.egress_min - start }
```

The rider takes the trip that reaches the destination corner first, which is not always the next one to leave. Trips leaving after 13:52 count; the slider limits the start time, not the buses.

Lead pair, eastbound [C]: board stop 8564 (access 2.258 min), alight stop 9486 (egress 4.156 min), ride 8.283 min, departures 9:17:43, 9:56:43, 10:32:43, 11:08:43, 11:44:43, 12:20:43, 12:56:43, 13:30:43, 14:08:43.

| # | Input | Expected | Source |
| --- | --- | --- | --- |
| 1 | lead pair, start 10:00 | trip 10:32:43, wait 30.458, total 45.156 | [C] |
| 2 | lead pair, start 10:30 | trip 10:32:43 (just caught), wait 0.458, total 15.156 | [C] |
| 3 | lead pair, start 10:31 | 10:32:43 is missed (the walk takes 2.258 min); trip 11:08:43, total 50.156 | [C] |
| 4 | lead pair, start 13:52 | trip 14:08:43, total 29.156 | [C] |
| 5 | made-up: trip A leaves 10:00 arrives 10:30; trip B leaves 10:10 arrives 10:20; no walks; start 9:55 | choose B, total 25 | by hand |
| 6 | made-up: no trips at all | NO_ONE_SEAT_RIDE | by hand |

Property tests:

- The chosen trip is catchable, and no other catchable trip reaches the destination corner earlier.
- total ≥ access + ride + egress, and wait ≥ 0.
- Starting later never gets you there earlier: arrival time is non-decreasing in `start`.
- While the same trip is chosen, each extra minute of `start` lowers the total by exactly 1.
- Adding a trip to the list never makes any total larger.

### 5.3 Walk time

```text
walk_m(corner, stop)   = WGS84 geodesic distance in metres
walk_min(metres)       = metres * 1.3 / 1.2 / 60      # 1.3 = street detour, 1.2 m/s; label "estimate"
1938 walk              = 0                            # boarded at the corner
```

| # | Input | Expected | Source |
| --- | --- | --- | --- |
| 1 | 125.07 m | 2.258 min | [F] |
| 2 | 230.15 m | 4.156 min | [F] |
| 3 | 0 m | 0 | by hand |
| 4 | 400 m (the radius) | 7.222 min, the largest possible single walk | arithmetic |
| 5 | Preston & Caroline to stop 8564 | 125.07 ± 0.1 m | [F] |
| 6 | Aliceanna & Bond to stop 9486 | 230.15 ± 0.1 m | [F] |
| 7 | Preston & Caroline to stop 4053 (westbound alighting) | 139.14 ± 0.1 m | [C] |

Property tests: never negative; distance is symmetric; doubling metres doubles minutes; any stop accepted at 400 m has a walk of at most 7.223 min.

### 5.4 Eligible one-seat trips

```text
active_services(date):
    from calendar.txt: services whose date range covers the date and whose weekday flag is 1
    then calendar_dates.txt: add exception_type 1, remove exception_type 2, for that date

eligible_trips(origin, dest, date, R = 400):
    O = stops within R metres of the origin corner;  D = same for dest
    for each trip running on an active service:
        pairs = all (o, d) with o in O, d in D, both on this trip, d.stop_sequence > o.stop_sequence
        if pairs is empty: skip the trip
        pick the pair with the shortest origin walk; among those, the shortest dest walk
        emit { trip_id, route, headsign, board: o, alight: d,
               dep: o.departure_time, arr: d.arrival_time }
    return sorted by dep                    # one record per trip

parse_time("25:10:00") = 1510               # GTFS hours can pass 24
```

| # | Input | Expected | Source |
| --- | --- | --- | --- |
| 1 | active services on 2026-11-04 | exactly `2251` | [C], matches [F] |
| 2 | Preston & Caroline to Aliceanna & Bond | 36 trips in the day, all CityLink Lime, headsign HARBOR EAST, board 8564, alight 9486 | [C], matches [F] |
| 3 | Aliceanna & Bond to Preston & Caroline | 37 trips, CityLink Lime, headsign NORTHWEST HOSPITAL, board 9486, alight 4053 | [C] |
| 4 | Westwood & Carey to Aliceanna & Bond | 124 trips, CityLink Lime and CityLink Navy | [C] |
| 5 | all 20 pairs at 400 m | none is empty | [C] |
| 6 | all 20 pairs at 250 m and at 150 m | 4 empty; 16 empty (sensitivity only, not shown in the app) | [C] |
| 7 | fixture: a trip that reaches the dest stop before the origin stop | skipped | by hand |
| 8 | fixture: a service removed by exception_type 2 on the date | its trips are skipped | by hand |

Property tests: one record per trip; alighting always comes later on the trip than boarding; dep ≤ arr; both walks ≤ R; a smaller R never adds a trip; the two directions of a pair never share a trip record.

### 5.5 The race at a time

```text
race(dir, origin, dest, T):
    a = next_1938(dir, origin, T)
    old = { dep: a.dep, wait: a.wait, ride: ride_1938(origin, dest),
            total: a.wait + ride_1938(origin, dest) }
    new = next_today(eligible_trips(origin, dest), a.start)     # both sides use the same start
    if new is NO_ONE_SEAT_RIDE or NO_MORE_TRIPS_TODAY:
        return { t: T, start: a.start, y1938: old, today: null, result: that state }
    margin = new.total - old.total                # positive = 1938 arrives first
    result = "photo_finish" if |margin| < 1.0
             else "1938" if margin > 0 else "today"
    return { t: T, start: a.start, before_table: a.before_table,
             y1938: old, today: new, result, margin: |margin| }
```

The one-minute photo-finish band exists because the walks are estimates; calling a four-second lead a win would be false precision [A]. It is one constant, stated in the summary file and on the About sheet.

| # | Pair and T | 1938 | Today | Result | Source |
| --- | --- | --- | --- | --- | --- |
| 1 | lead pair, 10:00 | car 10:06, total 15 | bus 10:32:43, total 45.156 | 1938 by 30.156 | [C] |
| 2 | lead pair, 10:21 | car 10:21, total 9 | bus 10:32:43, total 24.156 | 1938 by 15.156 | [C] |
| 3 | lead pair, 10:30 | car 10:36, total 15 | bus 10:32:43, total 15.156 | photo finish (0.156) | [C] |
| 4 | lead pair, 10:31 | car 10:36, total 14 | bus 11:08:43, total 50.156 | 1938 by 36.156 | [C] |
| 5 | lead pair, 13:52 | car 13:58, total 15 | bus 14:08:43, total 29.156 | 1938 by 14.156 | [C] |
| 6 | lead pair, 9:00 | before table; start 9:21; car 9:21, total 9 | bus 9:56:43, total 48.156 | 1938 by 39.156 | [C] |
| 7 | Aliceanna & Bond to Preston & Caroline, 13:52 | car 13:56, total 13 | bus 14:30:00, total 49.812 | 1938 by 36.812 | [C] |
| 8 | Westwood & Carey to Preston & Caroline, 11:23 | car 11:30, total 28 | Lime 11:25:00: access 1.930, wait 0.070, ride 19.717, egress 2.258, total 23.975 | **today by 4.025** | [C] |

Case 6 guards a known trap: without the `start` rule it would read 30 against 29.156 and declare today the winner, on a 1938 wait that the facts file does not support.

Property tests:

- **P1.** `result` always agrees with the two totals and the 1.0 band.
- **P2.** The 1938 total is always between the ride and the ride + 8.
- **P3.** No race reports a 1938 wait longer than 8 minutes.
- **P4.** `start ≥ t`, and `start = t` whenever `t ≥ covered_from`.
- **P5.** Both sides of a race use the same `start`.
- **P6.** Running the build twice gives byte-identical files.
- **P7.** Every number in a race row can be recomputed from the trips table and the 1938 clock in the same file.

### 5.6 Per-pair verdicts and the honest-line counts

```text
for each directed pair:
    R = the races for start = covered_from .. 13:52, one per whole minute   # distinct starts only
    wins_1938, wins_today, photo = counts of R by result
    ride_today = median of today.ride over R
    delta      = ride_today - ride_1938
    ride_verdict = "same" if |delta| <= max(1.5, 0.15 * ride_1938)
                   else "faster today" if delta < 0 else "slower today"
    gap_min, gap_max = smallest and largest gap between consecutive eligible
                       departures leaving the boarding stop in [09:00, 14:00)
summary = sums of the counts over the 20 pairs, plus the list of every race today wins
```

Expected output, all **[C]**, to be confirmed by the pipeline before any of it appears on screen:

| Pair | Races | 1938 wins | Today wins | Photo | Ride 1938 → today (median) | Ride verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Westwood & Carey → Dolphin & Myrtle | 293 | 282 | 3 | 8 | 8 → 6.0 | faster today |
| Dolphin & Myrtle → Westwood & Carey | 267 | 264 | 0 | 3 | 8 → 6.0 | faster today |
| Westwood & Carey → Brevard & Preston | 293 | 286 | 1 | 6 | 13 → 12.0 | same |
| Brevard & Preston → Westwood & Carey | 272 | 261 | 4 | 7 | 13 → 10.983 | faster today |
| Westwood & Carey → Preston & Caroline | 293 | 272 | 11 | 10 | 21 → 19.717 | same |
| Preston & Caroline → Westwood & Carey | 280 | 274 | 1 | 5 | 21 → 20.267 | same |
| Westwood & Carey → Aliceanna & Bond | 293 | 282 | 3 | 8 | 30 → 27.917 | same |
| Aliceanna & Bond → Westwood & Carey | 289 | 282 | 2 | 5 | 30 → 28.150 | same |
| Dolphin & Myrtle → Brevard & Preston | 285 | 285 | 0 | 0 | 5 → 6.0 | same |
| Brevard & Preston → Dolphin & Myrtle | 272 | 271 | 0 | 1 | 5 → 4.983 | same |
| Dolphin & Myrtle → Preston & Caroline | 285 | 285 | 0 | 0 | 13 → 13.717 | same |
| Preston & Caroline → Dolphin & Myrtle | 280 | 280 | 0 | 0 | 13 → 14.267 | same |
| Dolphin & Myrtle → Aliceanna & Bond | 285 | 285 | 0 | 0 | 22 → 22.0 | same |
| Aliceanna & Bond → Dolphin & Myrtle | 289 | 289 | 0 | 0 | 22 → 23.0 | same |
| Brevard & Preston → Preston & Caroline | 280 | 278 | 0 | 2 | 8 → 7.717 | same |
| Preston & Caroline → Brevard & Preston | 280 | 279 | 0 | 1 | 8 → 9.283 | same |
| Brevard & Preston → Aliceanna & Bond | 280 | 280 | 0 | 0 | 17 → 16.0 | same |
| Aliceanna & Bond → Brevard & Preston | 289 | 289 | 0 | 0 | 17 → 18.017 | same |
| **Preston & Caroline → Aliceanna & Bond (lead)** | 272 | 270 | 0 | 2 | 9 → 8.283 | same |
| Aliceanna & Bond → Preston & Caroline | 289 | 288 | 0 | 1 | 9 → 8.733 | same |
| **All 20** | **5,666** | **5,582** | **25** | **59** | | **17 same, 3 faster, 0 slower** |

Every pair has a one-seat ride at 400 m. Eight of the 20 pairs include the inferred Brevard corner.

Property tests: the three counts add up to the number of races for every pair; the summary totals equal the sums of the rows; every entry in the today-wins list points at a race row whose result is `today`; no result label on screen is outside the four allowed.

### 5.7 Arrival-weighted wait (the window-average check)

```text
average_wait(gaps):
    if gaps is empty or sum(gaps) = 0: return NONE with a warning
    return sum(g * g for g in gaps) / (2 * sum(gaps))
```

This is the expected wait for someone who turns up at a random moment. It is not used by the race. Keep it for the About sheet's "average over the window" figures, and for a golden test that ties the pipeline back to the earlier planning numbers.

| # | Gaps | Expected | Source |
| --- | --- | --- | --- |
| 1 | 7, 8, 7, 8 (the 1938 pattern) | 113 ÷ 30 = 3.767 | [F] |
| 2 | 36, 36, 36, 36, 34 (lead pair, 10:00–13:00) | 6,340 ÷ 356 = 17.809 | [F] |
| 3 | 10 | 5 | by hand |
| 4 | 5, 15 | 250 ÷ 40 = 6.25 (more than half the mean gap) | by hand |
| 5 | empty list | NONE, with a warning; no division | by hand |

Golden check for the lead pair over 10:00–13:00 [F]: 1938 total 12.767; today 32.637 ± 0.01. These are averages over a window and must be labeled as such wherever shown. They are never the result of a race.

Property tests: equal gaps g give g ÷ 2; the result is never below half the mean gap and never above half the largest gap; reordering the gaps changes nothing; multiplying every gap by k multiplies the result by k; merging two neighbouring gaps into one never lowers the result.

### 5.8 Rebuilding the route from the facts file

```text
build_leg(leg, ways):                        # ways: OSM way id -> list of [lon, lat]
    if leg.method = "inferred":
        line = leg.points_lonlat              # must have a note
    else:
        line = []
        for each item in leg.osm_ways, in the order written:
            if item = "gap": mark that the next join may be a bridged break; continue
            seg = ways[item]
            if line is empty:
                orient seg so its far end is the end nearer the next way
                (if it is the only way: so its start is nearer leg.clip_from)
            else:
                flip seg if its last point is nearer the end of line than its first
                d = distance(end of line, start of seg)
                if d > 1 m and no "gap" was marked: ERROR "undeclared break in {street}"
                if a gap was marked: record d; it must match leg.bridged_gaps_m within 1 m
            append seg to line
        cut line between the points nearest leg.clip_from and leg.clip_to
        if clip_to comes before clip_from along the line: ERROR
    length = sum of geodesic distances along line
    if |length - leg.length_m| > max(1 m, 0.5% of leg.length_m): ERROR "length mismatch"
    return line, tagged with street, method, note

build_route(direction):
    legs = [build_leg(l) for l in facts.legs[direction]]
    for each consecutive pair: the end of one must be within 1 m of the start of the next
    for each timing point: it must lie within 30 m of the joined line
    return one GeoJSON feature per leg
```

The OSM way shapes come from one dated download by way id, saved as `data/osm/ways.json`. If a mapper has edited a way since the facts file was written, the length check fails loudly and that street is checked by hand.

| # | Input | Expected | Source |
| --- | --- | --- | --- |
| 1 | 1938 eastbound, Aliceanna Street: ways 424990629, 772594351, 772594350, 772594349 | 123.8 m ± 0.5%, method `osm` | [F] |
| 2 | 1938, Brevard Street (historic) | 3 points, 220.7 m, method `inferred`, note present | [F] |
| 3 | 1938, Lanvale Street | method `osm+gap`, one bridged break of 26.2 m ± 1, total 611.1 m | [F] |
| 4 | 1938 westbound, all 14 legs joined | 8,401.0 m ± 0.5% | sum of [F] leg lengths |
| 5 | 1938 loop + eastbound (Westwood & Carey to Aliceanna & Bond) | 249.2 + 8,160.7 = 8,409.9 m ± 0.5% | sum of [F] leg lengths |
| 6 | Gilmor Street's end and Lanvale Street's start | the same point, [-76.642872, 39.297718] | [F] |

The route built from the facts file is the production route. No older trace file is used.

Property tests: flipping the stored direction of any way gives the same line; a leg is never shorter than the straight line between its two clip points; the route length equals the sum of its legs; a shared street has the same length in both directions; editing a 1938-only leg never changes the 1933 route.

### 5.9 Default time and share link

```text
default_time(now):                      # now = current wall-clock time in America/New_York
    m = minutes after midnight, seconds dropped
    return m if 09:00 <= m <= 13:52 else 10:00

encode(origin, dest) = "?from=" + slug(origin) + "&to=" + slug(dest)
decode(query):
    if both slugs are known and different: return that pair
    else: return the lead pair, with the flag bad_link = true
```

| # | Input | Expected |
| --- | --- | --- |
| 1 | now = 08:59 | 10:00 |
| 2 | now = 09:00:30 | 09:00 |
| 3 | now = 13:52:59 | 13:52 |
| 4 | now = 13:53 | 10:00 |
| 5 | `?from=preston-caroline&to=aliceanna-bond` | that pair |
| 6 | `?from=preston-caroline&to=preston-caroline` | lead pair, bad_link true |
| 7 | `?from=nowhere&to=aliceanna-bond` | lead pair, bad_link true |
| 8 | no query | lead pair, bad_link false |

Property tests: `decode(encode(p)) = p` for all 20 pairs; decode never throws on any string; the URL never contains a time or a number.
