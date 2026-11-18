# Race Engine: Tasks

> Hooks (editor only, never in the deployed app), all created with `"enabled": false` in .kiro/hooks/: enable `validate-after-agent-edit` after task 20 (validate), `rebuild-and-test-when-agent-stops` after task 22 (check), `copy-and-source-guard` after task 24 (check_sources).

## Setup and Infrastructure

- [x] 1. Project scaffolding
  - [x] 1.1 Create pipeline/ package with `__init__.py` and `__main__.py`
  - [x] 1.2 Create pyproject.toml with dependencies: pandas, pyproj, PyYAML, jsonschema, pytest, hypothesis, requests (requests is removed by correction task 30)
  - [x] 1.3 Create tests/unit/, tests/property/, tests/golden/ and tests/fixtures/ directories with `__init__.py` files
  - [x] 1.4 Verify `python -m pipeline` runs without import errors
  - [x] 1.5 Verify all required dependencies install

- [x] 2. CLI dispatcher
  - [x] 2.1 Implement cli.py with argparse dispatcher for all six commands: fetch_osm, validate, build, check, verify, check_sources (fetch_osm is removed by correction task 30)
  - [x] 2.2 Wire `pipeline/__main__.py` to call cli.main()
  - [x] 2.3 Each command stub returns "not implemented" until its task is complete
  - [x] 2.4 Verify `python -m pipeline --help` shows all six commands with clear usage messages (superseded by task 30: five commands)
  - Depends on: task 1

- [x] 3. Error handling classes
  - [x] 3.1 Define PipelineError as base exception class
  - [x] 3.2 Define FeedError, FactsError, RouteError, ValidationError as subclasses
  - [x] 3.3 Each class has a clear docstring describing when it is raised
  - [x] 3.4 All exception types importable from pipeline package
  - Depends on: task 1

- [x] 4. JSON schemas
  - [x] 4.1 Write pipeline/schemas/index.schema.json matching the index.json format in race-brief.md section 4
  - [x] 4.2 Write pipeline/schemas/summary.schema.json matching the summary.json shape in race-brief.md section 4.6
  - [x] 4.3 Write pipeline/schemas/race.schema.json matching the race file format in race-brief.md section 4.5
  - [x] 4.4 Write pipeline/schemas/route.schema.json for route.geojson (one Feature per leg, tagged with street, method, note)
  - [x] 4.5 Verify each schema is valid JSON Schema (draft 2020-12 or compatible)
  - Depends on: task 1

- [x] 5. Test fixtures
  - [x] 5.1 Write tests/fixtures/fake-line.yaml: minimal valid facts file with 2 corners, 1 leg per direction
  - [x] 5.2 Write tests/fixtures/fake-gtfs/stops.txt, routes.txt, trips.txt, stop_times.txt, calendar.txt, calendar_dates.txt: tiny feed covering edge cases
  - [x] 5.3 Include in fake-gtfs: a service removed by calendar_dates.txt exception_type 2, a trip reaching dest before origin (invalid), a pair with no trips
  - [x] 5.4 All fixture files named "fake" to distinguish from real data
  - Depends on: task 1

- [x] 6. Property tests infrastructure
  - [x] 6.1 Verify Hypothesis is installed and importable
  - [x] 6.2 Create tests/property/conftest.py with shared Hypothesis strategies (e.g., valid time-of-day floats, positive distances)
  - [x] 6.3 Confirm property test files in module tasks can import and use the strategies
  - Depends on: task 1

- [x] 7. GTFS reader utilities (B22, B23)
  - [x] 7.1 Implement GTFSReader class that opens a GTFS zip and reads named txt files as pandas DataFrames
  - [x] 7.2 Cache service-date rows from stop_times.txt under raw/cache/ keyed by the first 12 characters of feed SHA-256 + "_" + service_date (B23)
  - [x] 7.3 Handle missing GTFS files gracefully with clear error messages
  - [x] 7.4 Implement parse_gtfs_time("25:10:00") → 1510.0 (minutes after midnight; handles hours ≥ 24); GTFS times stored as HH:MM:SS strings in output (B8)
  - [x] 7.5 When reading stop_times, skip any row where arrival_time and departure_time are both blank; log a message for each skipped row (B22)
  - [x] 7.6 Write tests/unit/test_gtfs_reader.py using the fake-gtfs fixture; include assertion that the blank-time row is skipped and original timed rows remain intact
  - Depends on: task 1

## Module Implementation (Pipeline Steps)

- [~] 8. feed_check module
  - [x] 8.1 Implement check_feed(feed_path) that computes SHA-256 of raw/mta_local_bus.zip and returns the hash
  - [x] 8.2 Raise FeedError with clear message if file is missing
  - [x] 8.3 Raise FeedError with expected vs actual hash if hash does not match `8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694`
  - [x] 8.4 Write tests/unit/test_feed_check.py covering missing file, hash mismatch, and valid file cases
  - Depends on: task 3

- [~] 9. facts module (B4, B5 slug)
  - [x] 9.1 Implement load_facts(facts_path) that parses data/lines/no21-1938.yaml into a FactsFile dataclass; reads departure patterns, first/last and timing minutes from facts (not hard-coded constants)
  - [x] 9.2 Validate: at least two timing points; first minutes_from_prev = 0, later values positive whole minutes; both directions have minutes_past_hour/first/last; each leg has street, method, length_m; each leg has osm_ways with clip points or points_lonlat with note
  - [x] 9.3 Raise FactsError with field name if any required field is missing
  - [x] 9.4 Parse coordinates as [lon, lat]
  - [x] 9.5 Implement one slug function: lowercase, replace " & " with "-", then spaces with "-"; test all five real corner names produce correct slugs
  - [x] 9.6 Write tests/unit/test_facts.py using fake-line.yaml and invalid variants
  - Depends on: tasks 3, 5

- [x] 10. clock module (B3, B4, B20)
  - [x] 10.1 Implement terminal_departures(pattern, first, last) using values read from facts (not hard-coded constants)
  - [x] 10.2 Implement compute_offset(direction, corner_index, minutes) using cumulative sum from facts timing minutes
  - [x] 10.3 Implement build_clock(facts) returning {direction: {corner_slug: Clock1938}} for all 10 corner-direction pairs
  - [x] 10.4 Implement next_1938(clock, t) returning {start, dep, wait, before_table} with full precision; no rounding
  - [x] 10.5 Implement ride_minutes(origin_slug, dest_slug, facts) as sum of timing minutes between corners
  - [x] 10.6 Write tests/unit/test_clock.py covering all 8 test cases from race-brief.md section 5.1
  - [x] 10.7 Write tests/golden/test_clock_golden.py: golden cases run without requires_feed (clock tests do not read the zip); skip only if facts or committed data files are absent; always run on dev machine (B20)
  - [x] 10.8 Write tests/property/test_clock_properties.py covering all P1 properties (40 passes, gaps 7-8, offsets sum to 30, wait ≤ 8, next_1938 in passes, ride symmetry)
  - Depends on: task 9

- [x] 11. stops module (B3)
  - [x] 11.1 Implement geodesic_distance(lonlat1, lonlat2) using pyproj.Geod(ellps="WGS84")
  - [x] 11.2 Implement compute_walk_time(distance_m) = metres × 1.3 ÷ 1.2 ÷ 60; full precision; label "estimate"; rounding done only at emit
  - [x] 11.3 Implement find_stops_near_corners(gtfs, corners, radius_m=400.0) returning {corner_slug: [Stop, ...]}; full precision internally
  - [x] 11.4 Write tests/unit/test_stops.py covering walk formula cases 1-4 from race-brief.md section 5.3
  - [x] 11.5 Write tests/golden/test_stops_golden.py: cases 5-7 from section 5.3 (stop distances to actual corners); mark requires_feed; skip with visible warning when raw/ absent
  - [x] 11.6 Write tests/property/test_walk_properties.py covering P2 properties (never negative, symmetric, doubling, max 7.223 min at 400m)
  - Depends on: tasks 7, 9
  - Brief corrections: race-brief.md 5.3 case 2: 230.15 -> 4.155; 4.156 is the real-stop value.

- [x] 12. eligible module (B9)
  - [x] 12.1 Implement active_services(gtfs, date) applying calendar.txt then calendar_dates.txt exceptions
  - [x] 12.2 Implement find_eligible_trips(gtfs, origin_slug, dest_slug, origin_stops, dest_stops, service_ids, date) per race-brief.md section 5.4; full precision; dep/arr stored as HH:MM:SS strings in output (B8)
  - [x] 12.3 Correctly skip trips where dest.stop_sequence ≤ origin.stop_sequence
  - [x] 12.4 Write tests/unit/test_eligible.py using fake-gtfs: covers service removed by exception_type 2, trip reaching dest before origin, pair with no trips (NO_ONE_SEAT_RIDE) (B9)
  - [x] 12.5 Write tests/golden/test_eligible_golden.py: test cases 1-6 from race-brief.md section 5.4; mark requires_feed; skip with visible warning when raw/ absent
  - [x] 12.6 Write tests/property/test_eligible_properties.py covering P3 properties (one record per trip, alight > board sequence, dep ≤ arr, both walks ≤ radius, smaller radius never adds trips, two directions never share a trip)
  - Depends on: task 11

- [x] 13. race module (B3, B9, B12, B17)
  - [x] 13.1 Implement next_today(trips, start) exactly per race-brief.md section 5.2: NO_ONE_SEAT_RIDE if trips is empty; NO_MORE_TRIPS_TODAY if trips exist but none catchable; best = smallest (arr + egress_min), tie-break by earlier dep; if NO_MORE_TRIPS_TODAY encountered on real data raise PipelineError naming pair and time (B9)
  - [x] 13.2 Implement race_at_time(t, clock, eligible_trips, ride_1938_min) using same start for both sides; all values full precision
  - Detail for 13.2: race_at_time receives NO_1938_TRIP from next_1938 as a returned value (see clock.py). With real data this must not happen; raise PipelineError naming the pair and the time.
  - [x] 13.3 Implement compute_result(margin): photo_finish if |margin| < 1.0, else "1938" or "today"
  - [x] 13.4 Implement run_all_races(pairs, clocks, eligible, facts) for all 20 pairs × every whole minute 09:00–13:52 (293 rows); pre-coverage rows repeat the covered_from race result (B12)
  - [x] 13.5 Write tests/unit/test_race.py: unit test for NO_ONE_SEAT_RIDE (empty trips list); unit test for NO_MORE_TRIPS_TODAY (trips exist, none catchable); test cases 5-6 from section 5.2 (made-up trips, by hand) (B9)
  - [x] 13.6 Write tests/golden/test_race_golden.py: test cases 1-8 from race-brief.md section 5.5, including the lead 10:00 check (wait 30.458, total 45.156, computed from unrounded walks; rounding to 3 decimals happens at emit) (B3); mark requires_feed; skip with visible warning when raw/ absent
  - [x] 13.7 Write tests/property/test_race_properties.py covering P4 properties including total >= access + ride + egress, wait >= 0, +1 start → -1 total for same trip (B17)
  - Depends on: tasks 10, 12

- [x] 14. summary module (B3, B12, B14)
  - [x] 14.1 Implement ride_verdict(delta, ride_1938): "same" if |delta| ≤ max(1.5, 0.15 × ride_1938), else "faster today" or "slower today"
  - [x] 14.2 Implement find_gaps(trips, window_start, window_end) returning (gap_min, gap_max) as floats over adjacent sorted departures in [09:00, 14:00); emit rounds to 3 decimals; keep existing lead-pair golden gaps 34.0 and 39.0 (B14)
  - [x] 14.3 Implement arrival_weighted_wait(gaps) = sum(g² for g in gaps) / (2 × sum(gaps)); return None with visible warning if gaps empty or sum zero
  - [x] 14.4 Implement compute_summary(races, eligible, facts) computing per-pair counts, ride verdicts, gaps and overall totals; count only rows where t >= covered_from (B12)
  - [x] 14.5 Write tests/unit/test_summary.py: test cases 1-5 from race-brief.md section 5.7 (arrival-weighted wait)
  - [x] 14.6 Write tests/golden/test_summary_golden.py: per-pair table and totals from section 5.6; mark requires_feed; skip with visible warning when raw/ absent
  - [x] 14.7 Write tests/property/test_summary_properties.py covering P5 and P6 properties
  - Depends on: task 13

- [x] 16. route module (B1, B2, B10, B11, B20)
  - [x] 16.1 Implement load_ways(ways_path) reading the committed data/osm/ways.json snapshot; raise named RouteError if any way ID listed in facts is missing (B10)
  - [x] 16.2 Implement orient_way(way, reference) flipping a way if its last point is nearer the end of the reference than its first
  - [x] 16.3 Implement clip_line(line, start_point, end_point): locate vertex nearest start and vertex nearest end; raise RouteError if they are the same vertex; clip between them (B1)
  - [x] 16.4 Implement build_leg(leg_spec, ways): inferred legs use points_lonlat; OSM legs join ways in listed order, orient each to continue preceding way, then clip per 16.3 (reversing joined line first if clip vertices are in reversed order) (B1); loop legs use direction = "eastbound" (B2); each output leg has direction, street, method, note and length_m (B2)
  - [x] 16.5 Raise RouteError with street name on undeclared break > 1 m; raise RouteError with actual vs expected on length mismatch beyond max(1 m, 0.5%)
  - [x] 16.6 Implement build_route(facts, ways) reading only no21-1938.yaml and data/osm/ways.json (B11); westbound legs joined into one line, loop + eastbound legs joined into the other; verify joins within 1 m; verify timing points within 30 m of their line (B2)
  - [x] 16.7 Write tests/unit/test_route.py: test inferred leg, declared gap, undeclared break error, length mismatch error, equal-clip-vertex error (B1), missing way ID error (B10)
  - [x] 16.8 Write tests/golden/test_route_golden.py: test cases 1-6 from race-brief.md section 5.8; run without requires_feed (route tests use the committed ways snapshot, not the feed zip) (B20)
  - [x] 16.9 Write tests/property/test_route_properties.py covering P7 properties (flipping way preserves line, leg ≥ straight line, lengths add up, shared street same length both directions, reads only 1938 yaml + ways.json) (B11)
  - Depends on: task 9

- [x] 18. emit module (B3, B6, B7, B8, B16, B19)
  - [x] 18.1 Implement write_index_json(facts, pairs, feed_sha256, feed_version, service_date, output_dir): sources as catalog object with six required IDs
  - [x] 18.2 Implement write_summary_json(summary, output_dir): top-level sources mapping counts/today_wins to ID arrays
  - [x] 18.3 Implement write_race_files(clocks, eligible, races, output_dir): 293 rows per file (B12); slider/1938 times as HH:MM strings; GTFS dep/arr as HH:MM:SS strings; durations rounded to 3 decimals here only (B3, B8); no *_exact fields (B7); top-level sources mapping
  - [x] 18.4 Implement write_route_geojson(route_legs, output_dir): each leg has direction, street, method, note, length_m; top-level sources mapping
  - [x] 18.5 All files written as UTF-8 without BOM, LF line endings, compact separators, fixed key order (B6)
  - [x] 18.6 Validate every output file against its JSON schema using jsonschema; raise ValidationError on failure
  - [x] 18.7 Check source coverage: every numeric field covered; all IDs resolve to index.sources catalog; raise ValidationError listing unresolved IDs or uncovered fields (B16)
  - [x] 18.8 Report raw and gzip size for each output file; fail build only if a file exceeds its gzip limit: race files 20 KB, index/summary/route 10 KB; raw sizes are reported, not limits (B19)
  - [x] 18.9 Write tests/unit/test_emit.py verifying file structure, schema validation, source check and size reporting with fake data
  - [x] 18.10 Write tests/golden/test_emit_golden.py: verify lead pair race file matches section 4.5 format and values; mark requires_feed; skip with visible warning when raw/ absent
  - Depends on: tasks 4, 10, 13, 14, 16

- [x] 19. check_sources module (B5, B16)
  - [x] 19.1 Implement find_banned_terms(text): match live, real-time, realtime, arriving now, right now case-insensitively as whole words/phrases; allow the exact phrase "Scheduled, not live."; test deliver, olive and lives are not flagged (B5)
  - [x] 19.2 Implement check_prose(paths): scan web/index.html, web/src/**, docs/*.md and README.md; exclude docs/planning, node_modules, dist and web/public/data (B5)
  - [x] 19.3 Implement check_json_sources(paths): validate generated JSON source mappings (every ID resolves; every numeric field covered) (B16)
  - [x] 19.4 Write tests/unit/test_check_sources.py covering files with violations and clean files for each rule; test prose/JSON distinction; test deliver/olive/lives as allowed (B5)
  - Depends on: none

## Correction Tasks

Corrections to finished tasks 1, 2, 4 and 5 (tasks 29 to 34). Their completed items above stay as history. Prompt 2 in docs/planning/blockB-fixes.md holds the implementation details.

- [x] 29. Correct JSON schemas (B2, B12, B16; Prompt 2)
  - [~] 29.1 route.schema.json: each leg requires direction (eastbound or westbound), street, method, note and length_m (nonnegative number); loop legs use eastbound
  - [~] 29.2 race.schema.json: row description covers every minute 09:00 to 13:52; races minItems and maxItems both 293
  - [~] 29.3 index.schema.json: replace the sources array with a catalog object keyed by guide1938_diagram, guide1938_timetable, guide1938_route, mta_gtfs, osm and method; each entry requires what, year, where and url; year and url may be null only on the method entry, and every real source must have both; all six entries required
  - [~] 29.4 race, summary and route schemas: require a top-level sources object mapping blocks to nonempty ID arrays drawn from the six catalog IDs; keep the brief's nested y1938 source URLs
  - [~] 29.5 Run Draft202012Validator.check_schema on all four schemas
  - Depends on: task 4

- [x] 30. Correct the CLI to five commands (B10, B5, B13; Prompt 2)
  - [~] 30.1 Remove fetch_osm from CLI registration, handler and stub tests; keep validate, build, check, verify and check_sources
  - [~] 30.2 Test that top-level help lists all five commands and excludes fetch_osm; test that fetch_osm exits with argparse's unknown-command error
  - [~] 30.3 Update check_sources help and docstrings: prose scan paths, exclusions, banned-term check, and generated JSON source validation; test top-level help and check_sources --help
  - [~] 30.4 Remove requests from pyproject.toml; test the dependency list excludes it
  - Depends on: task 2

- [x] 31. Add the blank-time fixture row (B22; Prompt 2)
  - [~] 31.1 Add one fake stop_times row with empty arrival_time and departure_time, using an existing fake trip and stop and a fresh stop_sequence
  - [~] 31.2 Test with csv.DictReader that both cells are empty, the trip and stop references exist, and sequences are unique; assert the original timed rows and the overnight example remain
  - Depends on: task 5

- [x] 32. Apply .gitattributes LF rules (B6; Prompt 3)
  - [x] 32.1 Add `web/public/data/** text eol=lf` and `data/osm/*.json text eol=lf` to the repository-root .gitattributes, keeping unrelated attributes and avoiding duplicates
  - [x] 32.2 Verify with `git check-attr text eol` on web/public/data/index.json, web/public/data/race/test.json and data/osm/ways.json
  - Depends on: none

- [x] 33. Supply the OSM snapshot (B10)
  - [x] 33.1 Provide the committed data/osm/ways.json dated 2026-11-01. Task 16 reads it and does not fetch.
  - Depends on: none

- [ ] 34. Record the pending decisions
  - [~] 34.1 Window-average method and brief corrections: pending Emmanuel
  - [~] 34.2 Proposed 20 KB gzip limit for race files (B19): pending Emmanuel
  - Depends on: none

## Integration and Commands

- [x] 20. validate command (B21)
  - [x] 20.1 Wire cmd_validate to: load and validate facts file; build clock and verify it; validate every existing generated JSON/GeoJSON file against its schema without reading the feed (B21); run check_sources on prose paths
  - [x] 20.2 Confirm command does not read the feed or touch the network
  - [x] 20.3 Verify command completes in under 10 seconds
  - [x] 20.4 All failures produce clear error messages
  - Depends on: tasks 9, 10, 4, 19

- [x] 21. build command
  - [x] 21.1 Wire cmd_build to run all pipeline steps in order: feed_check → facts → clock → stops → eligible → race → summary → route → emit
  - [x] 21.2 Pass each step's output as input to the next
  - [x] 21.3 Fail fast on any step error, printing which step failed
  - [x] 21.4 Print progress messages for each completed step
  - [x] 21.5 Verify command completes in under 60 seconds with the pinned feed
  - Depends on: tasks 8, 9, 10, 11, 12, 13, 14, 16, 18

- [x] 22. check command
  - [x] 22.1 Wire cmd_check to run build (task 21) then run pytest
  - [x] 22.2 Confirm golden tests always run on developer machine (feed present); confirm they skip with visible warning in CI when raw/ absent
  - [x] 22.3 Return pytest exit code as the command exit code
  - Depends on: task 21

- [x] 23. verify command (B23)
  - [x] 23.1 Wire cmd_verify to rebuild into a temp directory (bypassing cache) and compare outputs against committed web/public/data/ files byte-for-byte (B23)
  - [x] 23.2 Fail with clear error listing differing files if any output differs
  - [x] 23.3 Fail with clear error (not skip) if raw/mta_local_bus.zip is missing
  - Depends on: task 21

- [x] 24. check_sources command (B5)
  - [x] 24.1 Wire cmd_check_sources to run check_prose on web/index.html, web/src/**, docs/*.md and README.md (excluding docs/planning, node_modules, dist, web/public/data) and check_json_sources on generated JSON files (B5)
  - [x] 24.2 Report each violation with file path and line number
  - [x] 24.3 Exit 0 if clean, exit 1 if any violations found
  - Depends on: task 19

## Testing Infrastructure

- [x] 25. Golden tests verification (B20)
  - [x] 25.1 Add tests/conftest.py with a pytest marker `requires_feed` and a skip condition: skip with visible warning when raw/mta_local_bus.zip is absent (CI); always run when feed is present (dev machine)
  - [x] 25.2 Confirm that requires_feed applies only to golden tests that actually read the pinned zip; clock (10.7), formula (14.5) and route (16.8) tests run without it (B20)
  - [x] 25.3 Confirm that verify command (task 23) fails, not skips, when feed is absent
  - [x] 25.4 Confirm all test tables from race-brief.md sections 5.1–5.8 have a corresponding assertion in a golden test file; section 5.9 (display rounding) moves to race-screen spec (B15)
  - Depends on: tasks 10, 11, 12, 13, 14, 16, 18

## Final Integration

- [x] 26. End-to-end integration test (B12, B18)
  - [x] 26.1 Write tests/test_integration.py that runs a full build and spot-checks outputs; mark requires_feed (B20)
  - [x] 26.2 Verify all 23 output files are created (index.json, summary.json, 20 race files, route.geojson)
  - [x] 26.3 Verify lead pair race file at t=10:00 reads 1938 total 15, today total 45.156, result "1938"
  - [x] 26.4 Verify summary.json totals: 5,666 races, 5,582 wins_1938, 25 wins_today, 59 photo_finishes
  - [x] 26.5 Run build twice and confirm all output files are byte-identical (property P9)
  - [x] 26.6 Confirm build completes in under 60 seconds
  - [x] 26.7 Verify inferred = true for all eight race files involving brevard-preston; false for the lead pair and all others (B18)
  - Depends on: tasks 21, 25

- [ ] 27. Documentation and README (B10)
  - [~] 27.1 Write pipeline/README.md with installation instructions (Python 3.12, pip install -e .)
  - [~] 27.2 Document the five commands with usage examples (fetch_osm excluded) (B10)
  - [~] 27.3 Add notes on feed pinning (SHA-256, never commit raw/), OSM data (committed snapshot, not fetched during build), and golden test behaviour
  - [~] 27.4 Link to docs/planning/race-brief.md and .kiro/specs/race-engine/design.md
  - Depends on: task 2

- [ ] 28. Final validation (B15)
  - [~] 28.1 Run `python -m pipeline check` with feed present and confirm it passes
  - [~] 28.2 Confirm lead pair race at t=10:00 reads 15 minutes vs 45.156 minutes
  - [~] 28.3 Confirm all golden test cases from race-brief.md sections 5.1–5.8 match computed values (5.9 moves to race-screen) (B15)
  - [~] 28.4 Confirm all property tests pass
  - [~] 28.5 Confirm `python -m pipeline verify` passes (committed files match a fresh build)
  - [~] 28.6 Confirm `python -m pipeline check_sources` exits 0
  - Depends on: tasks 22, 23, 24, 26
