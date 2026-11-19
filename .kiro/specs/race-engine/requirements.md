# Race Engine: Requirements

## Feature Description

Build a Python package, pipeline, that turns the 1938 facts file and the pinned MTA feed into the JSON files the site loads. Follow the steering files. The algorithms, file formats and expected values are in docs/planning/race-brief.md, sections 4 and 5; treat its pseudocode as the intended behaviour and its tables as test cases. If something there is unclear or looks wrong, ask me before designing around it.

## Functional Requirements

### 1. Feed Validation
- **FR-1.1**: Read raw/mta_local_bus.zip
- **FR-1.2**: Compute SHA-256 hash of the feed file
- **FR-1.3**: Compare computed hash against pinned value: `8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694`
- **FR-1.4**: Stop with a clear error message if:
  - File is missing
  - Hash does not match the pinned value
- **FR-1.5**: Cache service-date rows from stop_times.txt under raw/cache/ keyed by the first 12 characters of the feed SHA-256 and the service date (B23)

### 2. Facts Loading and Validation (B4)
- **FR-2.1**: Load data/lines/no21-1938.yaml
- **FR-2.2**: Validate the facts file schema:
  - At least two timing points are present
  - First timing point has minutes_from_prev = 0; subsequent values are positive whole minutes
  - Both directions' minutes_past_hour, first and last departure fields are present
  - Departure lists for both directions are present
  - Each leg includes street, method and length_m
  - Each leg uses either osm_ways with clip points or points_lonlat with a note
  - All required leg information is present
- **FR-2.3**: Refuse to run if any required field is missing
- **FR-2.4**: Parse coordinates as [lon, lat] format
- **FR-2.5**: One slug function: lowercase, replace " & " with "-", then replace spaces with "-". The five real corner slugs are westwood-carey, dolphin-myrtle, brevard-preston, preston-caroline, aliceanna-bond.

### 3. 1938 Clock Generation (B4)
For each of the 5 corners and each direction (eastbound, westbound):
- **FR-3.1**: Read departure patterns, first/last and timing minutes from the facts file (not hard-coded constants)
- **FR-3.2**: Compute terminal departures using the pattern and first/last from facts
- **FR-3.3**: Calculate offset from terminal for each corner based on cumulative timing minutes
- **FR-3.4**: Generate list of scheduled passing times for each corner
- **FR-3.5**: Determine "covered from" time (first scheduled passing time at each corner)
- **FR-3.6**: For any slider time T, compute:
  - start = max(T, covered_from)
  - Next departure at or after start
  - Wait time = departure - start
  - before_table flag = T < covered_from

### 4. Stop Discovery and Walk Times
For each corner:
- **FR-4.1**: Find all GTFS stops within 400 meters (geodesic distance using WGS84 ellipsoid)
- **FR-4.2**: Calculate walk distance in meters for each stop
- **FR-4.3**: Calculate walk time in minutes using formula: metres × 1.3 ÷ 1.2 ÷ 60
  - 1.3 = street detour factor
  - 1.2 m/s = walking speed
  - All walk times labeled as "estimate"
- **FR-4.4**: Keep full precision in stops module; round only in emit (walk metres to 2 decimals, walk minutes to 3 decimals) (B3)

### 5. Eligible Trip Discovery
For each of the 20 directed corner pairs, find one-seat trips on service date 2026-11-04:
- **FR-5.1**: Determine active services for the date:
  - From calendar.txt: services whose date range covers 2026-11-04 and weekday flag = 1
  - Apply calendar_dates.txt: add exception_type 1, remove exception_type 2
  - Expected active service_id: exactly 2251
- **FR-5.2**: For each trip running on an active service:
  - Find all (origin_stop, destination_stop) pairs where:
    - origin_stop is within 400m of origin corner
    - destination_stop is within 400m of destination corner
    - Both stops are on the same trip
    - destination stop_sequence > origin stop_sequence
  - If multiple pairs exist for one trip, select the pair with:
    - Shortest origin walk distance (primary criterion)
    - Shortest destination walk distance (tie-breaker)
- **FR-5.3**: Parse GTFS times as HH:MM:SS strings (handle hours ≥ 24, e.g., "25:10:00" = 1510 minutes after midnight); store internally as full-precision minutes after midnight (B8)
- **FR-5.4**: Store one record per trip containing:
  - trip_id, route name, headsign
  - Boarding stop: stop_id, name, walk_m, walk_min
  - Alighting stop: stop_id, name, walk_m, walk_min
  - Departure time (dep) and arrival time (arr) stored as HH:MM:SS strings in output (B8)
  - ride_min stored as numeric minutes after midnight with full precision internally
- **FR-5.5**: Sort trips by departure time
- **FR-5.6**: Record access_min (walk to boarding stop) and egress_min (walk from alighting stop)

### 6. Race Computation
For each directed corner pair and each whole minute from 9:00 to 13:52 (293 slider minutes, 09:00–13:52 inclusive) (B12):
- **FR-6.1**: Compute 1938 side:
  - Use next_1938 algorithm from FR-3.6
  - total = wait + ride (no walk for 1938)
  - ride = sum of timing minutes between corners
- **FR-6.2**: Compute today side (both sides use the same start time):
  - Filter catchable trips: dep >= start + access_min
  - If trips list is empty: result = NO_ONE_SEAT_RIDE (B9)
  - If trips exist but none catchable: result = NO_MORE_TRIPS_TODAY (internal sentinel; raises PipelineError naming pair and time if encountered on real data) (B9)
  - Select best trip: earliest (arr + egress_min); tie-break by earlier dep
  - Compute: access, wait = dep - start - access, ride = arr - dep, egress
  - total = arr + egress_min - start
- **FR-6.3**: Determine result:
  - margin = today_total - y1938_total (positive = 1938 faster)
  - If |margin| < 1.0 minute: result = "photo_finish"
  - Else if margin > 0: result = "1938"
  - Else: result = "today"
- **FR-6.4**: Keep full precision internally; round only in emit to 3 decimal places (B3)
- **FR-6.5**: Handle "before the midday table" state correctly (start ≥ T for racing)
- **FR-6.6**: Pre-coverage slider rows (t < covered_from) repeat the covered_from race result. Count only t >= covered_from in P5 and in summaries. (B12)

### 7. Summary Generation
- **FR-7.1**: Per-pair statistics:
  - Count races, wins_1938, wins_today, photo_finishes for races from covered_from to 13:52 (count only t >= covered_from) (B12)
  - Calculate median of today ride times
  - Calculate delta = median_today_ride - y1938_ride
  - Determine ride verdict:
    - "same" if |delta| <= max(1.5, 0.15 × y1938_ride)
    - "faster today" if delta < 0
    - "slower today" if delta > 0
  - Find gap_min and gap_max: smallest and largest gaps between adjacent sorted departures leaving boarding stop in [09:00, 14:00); type as numbers, round at emit to 3 decimals (B14)
- **FR-7.2**: Overall totals (sum across all 20 pairs):
  - races, wins_1938, wins_today, photo_finishes
  - ride_same, ride_faster_today, ride_slower_today (count of pairs by ride verdict)
  - pairs_without_one_seat_ride (should be 0 at 400m)
- **FR-7.3**: List every race where today wins:
  - origin, dest, t (time), margin
- **FR-7.4**: Arrival-weighted wait calculation (for About sheet):
  - Formula: sum(g² for g in gaps) / (2 × sum(gaps))
  - Handle empty gap list with clear warning
  - For 1938: gaps are [7, 8, 7, 8] from the pattern

### 8. Route Reconstruction (B1, B2)
- **FR-8.1**: Load OSM way geometries from data/osm/ways.json:
  - This file is the committed 2026-11-01 snapshot; the route module reads it directly
  - Format: way_id → array of [lon, lat] coordinates with download date in metadata
  - Never fetch from network during build (preserves reproducibility)
  - Missing way IDs raise a named RouteError
  - Credit: © OpenStreetMap contributors, ODbL
- **FR-8.2**: Westbound legs form one joined line; loop + eastbound legs form the other joined line (B2)
- **FR-8.3**: For each leg in each direction:
  - If method = "inferred": use points_lonlat from facts file
  - If method = "osm" or "osm+gap":
    - Join OSM ways in the listed order, orienting each way to continue from the preceding way (B1)
    - After joining, locate the vertices nearest to clip_from and clip_to
    - If those two vertices are in reversed order along the joined line, reverse the entire joined line (B1)
    - Clip the line between the clip_from vertex and the clip_to vertex
    - If clip_from and clip_to map to the same vertex, raise RouteError (B1)
    - Handle "gap" markers: allow breaks if marked, record distance of bridged gaps
    - Error on undeclared breaks > 1m
  - Validate leg length: |actual - expected| <= max(1m, 0.5% of expected)
  - Each GeoJSON leg requires direction, street, method, note and length_m; loop legs use direction = "eastbound" (B2)
- **FR-8.4**: Check joins within the two joined lines (westbound; loop + eastbound):
  - Consecutive legs connect within 1m (B2)
  - Each timing point lies within 30m of the joined line it belongs to (B2)
- **FR-8.5**: Fail loudly on:
  - Undeclared break in a street
  - Length mismatch beyond tolerance
  - Equal clip_from/clip_to vertices (RouteError) (B1)
  - Timing points too far from route

### 9. Output Generation and Validation
- **FR-9.0** (task 35): index.json source catalog entries carry a `label`; index.json carries the boolean `street_order_checked` (1938 facts file only); race files carry `y1938.gap_min`, `y1938.gap_max`, `today.window_from`, `today.window_to`, `today.route_names`, and each trip carries `route_display`; `today.trips` holds every eligible trip from 09:00 through the third after the last trip a race row uses (design.md, Decisions 6 to 9).
- **FR-9.1**: Write files to web/public/data/:
  - index.json: Line metadata, 5 corners, 20 pairs, service date, feed version and hash, source catalog
  - summary.json: Honest-line counts, per-pair ride verdicts, today-wins list
  - race/{origin}__{dest}.json: One file per pair (20 files)
  - route.geojson: 1938 route geometry by leg
- **FR-9.2**: File formats match examples in race-brief.md section 4.5
- **FR-9.3**: Corner slugs (fixed): westwood-carey, dolphin-myrtle, brevard-preston, preston-caroline, aliceanna-bond
- **FR-9.4**: Direction implied by slug order in filename
- **FR-9.5**: Validate each generated file against its JSON schema
- **FR-9.6**: Source check: every numeric field has a corresponding source ID; emit raises ValidationError listing unresolved IDs or uncovered numeric fields (B16)
- **FR-9.7**: Store slider and 1938 clock times as HH:MM strings; store GTFS departure/arrival as HH:MM:SS strings (including hours above 23); store durations and walk minutes as numeric full-precision values internally, rounded to 3 decimals at emit; store walk distances in metres rounded to 2 decimals at emit (B8)
- **FR-9.8**: Stored race rows use fields: t, start, before_table, y1938, today, result, margin. Numeric durations are stored as numbers. No display-only or *_exact fields. Null/absence conventions follow the brief. (B7)
- **FR-9.9**: Each race file includes:
  - 1938 clock: ride_min, covered_from (HH:MM), passes array (HH:MM strings)
  - Today: gap_min, gap_max (numeric, 3 decimals at emit), trips array with all eligible trips; dep/arr as HH:MM:SS
  - Races array: 293 rows, one per minute from 09:00 to 13:52 (B12)
- **FR-9.10**: Output files use UTF-8 without BOM, LF line endings, compact JSON separators, and a fixed key order. The verify command checks files byte-for-byte. (B6)
- **FR-9.11**: index.sources is the source-ID catalog; other files' top-level sources objects map blocks/fields to ID arrays. The six catalog IDs are: guide1938_diagram, guide1938_timetable, guide1938_route, mta_gtfs, osm, method. Each catalog entry requires what, year, where and url (null allowed for year/url for a documented method). All six entries are required in index.sources. (B16)
- **FR-9.12**: Emit checks that every numeric field in every output file is covered by the sources mapping, and that all source IDs resolve to entries in index.sources. (B16)

### 10. Commands (B10, B13)
The five pipeline commands are: validate, build, check, verify, check_sources.

- **FR-10.1**: `python -m pipeline validate`
  - Fast checks: facts schema, 1938 clock, every existing generated JSON/GeoJSON file against its schema (without reading the feed), copy rules (B21)
  - Must not read the feed or touch the network
  - Must complete in under 10 seconds
- **FR-10.2**: `python -m pipeline build`
  - Full build into web/public/data/
  - Must complete in under 60 seconds
  - Execute all pipeline steps in order
- **FR-10.3**: `python -m pipeline check`
  - Run build, then run pytest
  - Used by hooks
- **FR-10.4**: `python -m pipeline verify`
  - Rebuild from raw/ and fail if committed data files differ (byte-for-byte)
  - Ensures reproducibility
  - Bypasses the stop_times cache when rebuilding (B23)
- **FR-10.5**: `python -m pipeline check_sources`
  - Scan prose in web/index.html, web/src/**, docs/*.md and README.md
  - Exclude docs/planning, node_modules, dist and web/public/data
  - Prose check: fail on banned terms (live, real-time, realtime, arriving now, right now) matched case-insensitively as whole words/phrases; allow the exact phrase "Scheduled, not live."
  - JSON check: validate generated JSON source mappings (every ID resolves; every numeric field covered) (B5, B16)
- **FR-10.6**: Each command provides clear error messages on failure

## Correctness Properties (Property Tests Required)

### P1: 1938 Clock Properties
- Every corner and direction has exactly 40 passes
- Passes are strictly increasing
- Every gap between consecutive passes is exactly 7 or 8 minutes
- For every corner: eastbound_offset + westbound_offset = 30 minutes
- For any start between covered_from and last pass: 0 ≤ wait ≤ 8 minutes
- next_1938 never returns a time not in passes array
- ride_1938(a,b) = ride_1938(b,a) for symmetric pairs
- Rides add up along the line

### P2: Walk Time Properties
- Walk time never negative
- Walk distance is symmetric between corner and stop
- Doubling metres doubles minutes
- Any stop accepted at 400m has walk time ≤ 7.223 minutes
- Formula: walk_min = walk_m × 1.3 ÷ 1.2 ÷ 60

### P3: Eligible Trip Properties
- One record per trip (no duplicates)
- Alighting stop_sequence > boarding stop_sequence for every trip
- dep ≤ arr for every trip
- Both walks ≤ radius (400m)
- Smaller radius never adds trips
- Two directions of a pair never share a trip record

### P4: Race Properties
- Both sides always start from the same time
- start ≥ slider_time for every race
- start = slider_time whenever slider_time ≥ covered_from
- Result always agrees with stored totals and 1.0-minute band (never from displayed values)
- 1938 total is always between ride and ride + 8 minutes
- No 1938 wait ever longer than 8 minutes
- Chosen today bus is catchable (dep >= start + access_min)
- No other catchable bus reaches destination corner earlier
- Starting later never gets you there earlier (arrival time non-decreasing in start)
- Adding a trip to eligible list never makes any total larger
- total >= access + ride + egress (B17)
- wait >= 0 (B17)
- For the same chosen trip, +1 start means -1 total (B17)

### P5: Summary Properties
- For every pair: wins_1938 + wins_today + photo_finishes = number_of_races (races counted only for t >= covered_from) (B12)
- Summary totals equal sum of per-pair counts
- Every entry in today_wins list points to a race with result = "today"
- No result label is outside the four allowed: "1938", "today", "photo_finish", "no_one_seat_ride"

### P6: Arrival-Weighted Wait Properties
- Equal gaps g give result g ÷ 2
- Result never below half the mean gap
- Result never above half the largest gap
- Reordering gaps changes nothing
- Multiplying every gap by k multiplies result by k
- Merging two neighbouring gaps never lowers result

### P7: Route Properties
- Flipping stored direction of any OSM way gives same line
- A leg is never shorter than straight line between its two clip points
- Total route length equals sum of leg lengths
- A shared street has same length in both directions
- Route reads only no21-1938.yaml and data/osm/ways.json (B11)

### P9: Build Reproducibility
- Building twice gives byte-identical files
- Every number in output can be recomputed from inputs

### P10: Data Flow Properties
- Every number in a race row can be recomputed from trips table and 1938 clock in same file, using absolute tolerance 0.002 (recomputation works from stored 3-decimal numbers) (B17)
- No number shown without corresponding source entry

## Golden Test Values

All golden test values are from race-brief.md sections 5.1-5.8.

**CRITICAL RULE**: If the pipeline's computed result differs from any expected value in race-brief.md, the test must fail and you must stop and report the difference to Emmanuel. Never change code just to hit an expected value. Never edit an expected value, a facts file, or a test to make a check pass.

### Key Golden Values to Verify:
- Lead pair (Preston & Caroline → Aliceanna & Bond) at 10:00: 1938 total 15 min, today wait 30.458, today total 45.156 (from unrounded walks) (B3)
- Exactly one service is active on 2026-11-04, and its service_id is 2251
- Preston & Caroline → Aliceanna & Bond: 36 eligible trips, all CityLink Lime HARBOR EAST, board 8564, alight 9486
- All 20 pairs at 400m: none is empty
- Total across all 20 pairs: 5,666 races, 5,582 wins_1938, 25 wins_today, 59 photo_finishes
- Ride verdicts: 17 same, 3 faster today, 0 slower today
- Lead-pair gap_min 34.0, gap_max 39.0 (B14)
- 1938 westbound all 14 legs joined: 8,401.0 m ± 0.5%
- 1938 loop + eastbound (Westwood & Carey to Aliceanna & Bond): 249.2 + 8,160.7 = 8,409.9 m ± 0.5%

See race-brief.md sections 5.1 through 5.8 for complete test tables. (Table 5.9, display rounding, moves to race-screen spec.) (B15)

## Technical Constraints

### Stack
- Python 3.12
- Required packages: pandas, pyproj, PyYAML, jsonschema, pytest, Hypothesis
- Development on Windows

### Data Constraints
- Times: minutes after midnight as decimals internally; HH:MM for slider/1938 clock output; HH:MM:SS for GTFS times (B8)
- Keep full precision in facts, clock, stops, eligible, race and summary modules (B3)
- Round only in emit: durations and walk minutes to 3 decimals, walk metres to 2 decimals (B3)
- Distances: WGS84 geodesic using pyproj.Geod(ellps="WGS84")
- Coordinates: [lon, lat] format
- Photo-finish band: 1.0 minute (single constant)

### Performance Constraints
- validate command: < 10 seconds, must not read feed
- build command: < 60 seconds for full pipeline

### File Constraints
- raw/ is git-ignored (never commit the feed)
- web/public/data/ is generated (committed for GitHub Pages)
- Generated JSON must be committed for hosted builds (feed not available in CI)
- Generated files: UTF-8 without BOM, LF, compact separators, fixed key order (B6)
- .gitattributes rules for LF enforcement are a separate pending task (B6)

### File Size Budgets (B19)
- Emit reports raw and gzip size for each output file
- Every file is limited by gzip size (what the phone downloads); raw sizes are reported, not limited
- Gzip limits: each race file 20 KB; index.json, summary.json and route.geojson 10 KB each (Emmanuel's decision; all per-file raw limits are removed)
- Build fails if any file exceeds its gzip limit

## Test Requirements

### Test Organization
- tests/unit/: Unit tests for individual functions
- tests/property/: Hypothesis property tests (all P1-P7, P9-P10 above)
- tests/golden/: Tests against expected values from race-brief.md
- tests/fixtures/: Fake line and fake GTFS for edge cases

### Golden Test Behavior
- Skip with clear message when raw/ is missing (for hosted builds)
- Must pass locally before any commit touching pipeline/ or data/

### requires_feed Marker (B20)
- Applies only to tests that actually read the pinned zip, including full-build integration tests
- Clock module tests (5.1), formula tests (5.7) and route tests (5.8) run without requires_feed

### Edge Cases to Test
- Service removed by calendar_dates.txt exception_type 2
- Trip reaching destination before origin (invalid, skip)
- Empty trips list (NO_ONE_SEAT_RIDE) (B9)
- Trips present but none catchable (NO_MORE_TRIPS_TODAY unit test) (B9)
- Before the midday table state
- Gaps in OSM ways (declared vs undeclared)
- Inferred route sections
- Empty gap list in arrival-weighted wait
- Blank arrival/departure in stop_times fixture row: ignored with a logged message (B22)

## Not In Scope
- Web site implementation
- MCP server
- Census sentence
- HOLC layer
- Transfers between routes
- Real-time or live data
- Automatic feed downloads
- fetch_osm command (B10)
- display_rounding module (B7); display rounding belongs in race-screen spec
- 1933 line processing (only 1938 for this spec)

## Pending Decisions / Open Items
- .gitattributes LF enforcement rules (Prompt 3 task) (B6)
- Supply the committed 2026-11-01 data/osm/ways.json snapshot (B10)
- Window-average method (brief corrections remain open)

## Success Criteria

The spec is complete when:
1. `python -m pipeline check` passes on developer machine with feed present
2. Hosted test run passes with feed absent (golden tests skip gracefully)
3. Lead pair's race at 10:00 reads 15 minutes vs 45.156 minutes
4. All golden test values match expected values from race-brief.md sections 5.1–5.8
5. All property tests pass
6. Build is reproducible (identical files on repeat builds)
7. Every output number has a source entry
