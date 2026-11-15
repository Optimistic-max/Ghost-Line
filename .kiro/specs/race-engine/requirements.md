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
- **FR-1.5**: Cache service-date rows from stop_times.txt under raw/cache/ for fast rebuilds

### 2. Facts Loading and Validation
- **FR-2.1**: Load data/lines/no21-1938.yaml
- **FR-2.2**: Validate the facts file schema:
  - All timing points are present (5 corners)
  - All minute values between timing points are present (4 values: 8, 5, 8, 9)
  - Departure lists for both directions are present
  - All required leg information is present
- **FR-2.3**: Refuse to run if any required field is missing
- **FR-2.4**: Parse coordinates as [lon, lat] format

### 3. 1938 Clock Generation
For each of the 5 corners and each direction (eastbound, westbound):
- **FR-3.1**: Compute terminal departures based on:
  - Pattern: eastbound [0,7,15,22,30,37,45,52], westbound [4,11,19,26,34,41,49,56]
  - First departure: eastbound 09:00, westbound 09:04
  - Last departure: eastbound 13:52, westbound 13:56
- **FR-3.2**: Calculate offset from terminal for each corner:
  - Based on cumulative timing minutes in direction of travel
  - Eastbound: 0, 8, 13, 21, 30 minutes for the 5 corners
  - Westbound: 30, 22, 17, 9, 0 minutes for the 5 corners
- **FR-3.3**: Generate list of scheduled passing times for each corner
- **FR-3.4**: Determine "covered from" time (first scheduled passing time at each corner)
- **FR-3.5**: For any slider time T, compute:
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
- **FR-4.4**: Store walk distance to 2 decimal places (metres) and walk time to 3 decimal places (minutes)

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
- **FR-5.3**: Parse GTFS times (handle hours ≥ 24, e.g., "25:10:00" = 1510 minutes after midnight)
- **FR-5.4**: Store one record per trip containing:
  - trip_id, route name, headsign
  - Boarding stop: stop_id, name, walk_m, walk_min
  - Alighting stop: stop_id, name, walk_m, walk_min
  - Departure time (dep), arrival time (arr), ride time in minutes
- **FR-5.5**: Sort trips by departure time
- **FR-5.6**: Record access_min (walk to boarding stop) and egress_min (walk from alighting stop)

### 6. Race Computation
For each directed corner pair and each whole minute from 9:00 to 13:52:
- **FR-6.1**: Compute 1938 side:
  - Use next_1938 algorithm from FR-3.5
  - total = wait + ride (no walk for 1938)
  - ride = sum of timing minutes between corners
- **FR-6.2**: Compute today side (both sides use the same start time):
  - Filter catchable trips: dep >= start + access_min
  - If no trips at all: result = no_one_seat_ride
  - If no catchable trips: result = no_one_seat_ride (or note for future trips)
  - Select best trip: earliest (arr + egress_min); tie-break by earlier dep
  - Compute: access, wait = dep - start - access, ride = arr - dep, egress
  - total = arr + egress_min - start
- **FR-6.3**: Determine result:
  - margin = today_total - y1938_total (positive = 1938 faster)
  - If |margin| < 1.0 minute: result = "photo_finish"
  - Else if margin > 0: result = "1938"
  - Else: result = "today"
- **FR-6.4**: Store all values to 3 decimal places
- **FR-6.5**: Handle "before the midday table" state correctly (start ≥ T for racing)

### 7. Summary Generation
- **FR-7.1**: Per-pair statistics:
  - Count races, wins_1938, wins_today, photo_finishes for races from covered_from to 13:52
  - Calculate median of today ride times
  - Calculate delta = median_today_ride - y1938_ride
  - Determine ride verdict:
    - "same" if |delta| <= max(1.5, 0.15 × y1938_ride)
    - "faster today" if delta < 0
    - "slower today" if delta > 0
  - Find gap_min and gap_max: smallest and largest gaps between consecutive eligible departures leaving boarding stop in [09:00, 14:00)
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

### 8. Route Reconstruction
- **FR-8.1**: Load OSM way geometries from data/osm/ways.json:
  - This file is a committed snapshot created by fetch_osm command
  - Format: way_id → array of [lon, lat] coordinates with download date in metadata
  - Never fetch from network during build (preserves reproducibility)
  - Credit: © OpenStreetMap contributors, ODbL
- **FR-8.2**: For each leg in each direction:
  - If method = "inferred": use points_lonlat from facts file
  - If method = "osm" or "osm+gap":
    - Join OSM ways in the specified order
    - Handle "gap" markers: allow breaks if marked, record distance of bridged gaps
    - Orient first way toward next way or toward clip_from
    - Flip subsequent ways if needed to maintain continuity
    - Error on undeclared breaks > 1m
    - Clip line between clip_from_lonlat and clip_to_lonlat points
  - Validate leg length: |actual - expected| <= max(1m, 0.5% of expected)
  - Tag each leg with: street, method (osm/osm+gap/inferred), note
- **FR-8.3**: Join legs end-to-end:
  - Verify each pair of consecutive legs connects within 1m
  - Verify each timing point lies within 30m of the joined route
- **FR-8.4**: Output as GeoJSON:
  - One Feature per leg
  - Properties include street name, method, note
- **FR-8.5**: Fail loudly on:
  - Undeclared break in a street
  - Length mismatch beyond tolerance
  - clip_to comes before clip_from along the line
  - Timing points too far from route

### 9. Output Generation and Validation
- **FR-9.1**: Write files to web/public/data/:
  - index.json: Line metadata, 5 corners, 20 pairs, service date, feed version and hash, source list
  - summary.json: Honest-line counts, per-pair ride verdicts, today-wins list
  - race/{origin}__{dest}.json: One file per pair (20 files)
  - route.geojson: 1938 route geometry by leg
- **FR-9.2**: File formats match examples in race-brief.md section 4.5
- **FR-9.3**: Corner slugs (fixed): westwood-carey, dolphin-myrtle, brevard-preston, preston-caroline, aliceanna-bond
- **FR-9.4**: Direction implied by slug order in filename
- **FR-9.5**: Validate each generated file against its JSON schema
- **FR-9.6**: Source check: every number field has a corresponding source entry
- **FR-9.7**: Store times as minutes after midnight (decimals to 3 places)
- **FR-9.8**: Store distances in meters (to 2 decimal places for walks)
- **FR-9.9**: Each race file includes:
  - 1938 clock: ride_min, covered_from, passes array
  - Today: gap_min, gap_max, trips array with all eligible trips
  - Races array: one row per minute from 9:00 to 13:52
- **FR-9.10**: Display rounding values computed per largest-remainder method:
  - Round total to nearest whole minute (halves up)
  - Round each part down
  - Allocate remaining minutes to parts with largest fractions
  - On tie, earlier phase gets the minute
  - Shown parts must sum to shown total
  - Every shown part within 1 minute of stored value
  - Shown margin = difference of two shown totals

### 10. Commands
- **FR-10.1**: `python -m pipeline fetch_osm`
  - One-time command to fetch OSM way geometries via Overpass API
  - Queries for all way IDs listed in facts file
  - Writes data/osm/ways.json with download date in metadata
  - This snapshot is committed to the repository
  - Never run automatically; only when updating OSM data
- **FR-10.2**: `python -m pipeline validate`
  - Fast checks: facts schema, 1938 clock, JSON schemas, copy rules
  - Must not read the feed or touch the network
  - Must complete in under 10 seconds
- **FR-10.3**: `python -m pipeline build`
  - Full build into web/public/data/
  - Must complete in under 60 seconds
  - Execute all 9 pipeline steps in order
- **FR-10.4**: `python -m pipeline check`
  - Run build, then run pytest
  - Used by hooks
- **FR-10.5**: `python -m pipeline verify`
  - Rebuild from raw/ and fail if committed data files differ
  - Ensures reproducibility
- **FR-10.6**: `python -m pipeline check_sources`
  - Fail on banned words: live, real-time, realtime, "arriving now", "right now" (except in fixed phrase "Scheduled, not live.")
  - Fail on any unsourced number in web/ or docs/
- **FR-10.7**: Each command provides clear error messages on failure

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

### P5: Summary Properties
- For every pair: wins_1938 + wins_today + photo_finishes = number_of_races
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
- Editing a 1938-only leg never changes 1933 route

### P8: Display Rounding Properties
- Shown parts always sum to shown total
- Every shown part is within 1 minute of stored value
- Shown part is always a whole number
- Whole-number inputs returned unchanged
- Same input always gives same output (pure function)
- Shown margin = |shown_total_today - shown_total_1938|

### P9: Build Reproducibility
- Building twice gives byte-identical files (P6 from brief)
- Every number in output can be recomputed from inputs

### P10: Data Flow Properties
- Every number in a race row can be recomputed from trips table and 1938 clock in same file
- No number shown without corresponding source entry

## Golden Test Values

All golden test values are from race-brief.md sections 5.1-5.9.

**CRITICAL RULE**: If the pipeline's computed result differs from any expected value in race-brief.md, the test must fail and you must stop and report the difference to Emmanuel. Never change code just to hit an expected value. Never edit an expected value, a facts file, or a test to make a check pass.

### Key Golden Values to Verify:
- Lead pair (Preston & Caroline → Aliceanna & Bond) at 10:00: 1938 total 15 min, today total 45.156 min
- Exactly one service is active on 2026-11-04, and its service_id is 2251
- Preston & Caroline → Aliceanna & Bond: 36 eligible trips, all CityLink Lime HARBOR EAST, board 8564, alight 9486
- All 20 pairs at 400m: none is empty
- Total across all 20 pairs: 5,666 races, 5,582 wins_1938, 25 wins_today, 59 photo_finishes
- Ride verdicts: 17 same, 3 faster today, 0 slower today
- 1938 westbound all 14 legs joined: 8,401.0 m ± 0.5%
- 1938 loop + eastbound (Westwood & Carey to Aliceanna & Bond): 249.2 + 8,160.7 = 8,409.9 m ± 0.5%

See race-brief.md sections 5.1 through 5.9 for complete test tables.

## Technical Constraints

### Stack
- Python 3.12
- Required packages: pandas, pyproj, PyYAML, jsonschema, pytest, Hypothesis
- Development on Windows

### Data Constraints
- Times: minutes after midnight as decimals (10:32:43 = 632.717)
- Store to 3 decimal places
- Round only for display (per largest-remainder method)
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

## Test Requirements

### Test Organization
- tests/unit/: Unit tests for individual functions
- tests/property/: Hypothesis property tests (all P1-P10 above)
- tests/golden/: Tests against expected values from race-brief.md
- tests/fixtures/: Fake line and fake GTFS for edge cases

### Golden Test Behavior
- Skip with clear message when raw/ is missing (for hosted builds)
- Must pass locally before any commit touching pipeline/ or data/

### Edge Cases to Test
- Service removed by calendar_dates.txt exception_type 2
- Trip reaching destination before origin (invalid, skip)
- Empty trips list (no_one_seat_ride)
- Before the midday table state
- Gaps in OSM ways (declared vs undeclared)
- Inferred route sections
- Empty gap list in arrival-weighted wait
- Bad input to display rounding

## Not In Scope
- Web site implementation
- MCP server
- Census sentence
- HOLC layer
- Transfers between routes
- Real-time or live data
- Automatic feed downloads
- 1933 line processing (only 1938 for this spec)

## Success Criteria

The spec is complete when:
1. `python -m pipeline check` passes on developer machine with feed present
2. Hosted test run passes with feed absent (golden tests skip gracefully)
3. Lead pair's race at 10:00 reads 15 minutes vs 45.156 minutes
4. All golden test values match expected values from race-brief.md
5. All property tests pass
6. Build is reproducible (identical files on repeat builds)
7. Every output number has a source entry
