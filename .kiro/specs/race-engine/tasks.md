# Race Engine: Tasks

## Setup and Infrastructure

- [x] 1. Project scaffolding
  - [x] 1.1 Create pipeline/ package with `__init__.py` and `__main__.py`
  - [x] 1.2 Create pyproject.toml with dependencies: pandas, pyproj, PyYAML, jsonschema, pytest, hypothesis, requests
  - [x] 1.3 Create tests/unit/, tests/property/, tests/golden/ and tests/fixtures/ directories with `__init__.py` files
  - [x] 1.4 Verify `python -m pipeline` runs without import errors
  - [x] 1.5 Verify all required dependencies install

- [ ] 2. CLI dispatcher
  - [~] 2.1 Implement cli.py with argparse dispatcher for all six commands: fetch_osm, validate, build, check, verify, check_sources
  - [~] 2.2 Wire `pipeline/__main__.py` to call cli.main()
  - [~] 2.3 Each command stub returns "not implemented" until its task is complete
  - [~] 2.4 Verify `python -m pipeline --help` shows all six commands with clear usage messages
  - [~] 2.5 Depends on: task 1

- [ ] 3. Error handling classes
  - [~] 3.1 Define PipelineError as base exception class
  - [~] 3.2 Define FeedError, FactsError, RouteError, ValidationError as subclasses
  - [~] 3.3 Each class has a clear docstring describing when it is raised
  - [~] 3.4 All exception types importable from pipeline package
  - [~] 3.5 Depends on: task 1

- [ ] 4. JSON schemas
  - [~] 4.1 Write pipeline/schemas/index.schema.json matching the index.json format in race-brief.md section 4
  - [~] 4.2 Write pipeline/schemas/summary.schema.json matching the summary.json shape in race-brief.md section 4.6
  - [~] 4.3 Write pipeline/schemas/race.schema.json matching the race file format in race-brief.md section 4.5
  - [~] 4.4 Write pipeline/schemas/route.schema.json for route.geojson (one Feature per leg, tagged with street, method, note)
  - [~] 4.5 Verify each schema is valid JSON Schema (draft 2020-12 or compatible)
  - [~] 4.6 Depends on: task 1

- [ ] 5. Test fixtures
  - [~] 5.1 Write tests/fixtures/fake-line.yaml: minimal valid facts file with 2 corners, 1 leg per direction
  - [~] 5.2 Write tests/fixtures/fake-gtfs/stops.txt, routes.txt, trips.txt, stop_times.txt, calendar.txt, calendar_dates.txt: tiny feed covering edge cases
  - [~] 5.3 Include in fake-gtfs: a service removed by calendar_dates.txt exception_type 2, a trip reaching dest before origin (invalid), a pair with no trips
  - [~] 5.4 All fixture files named "fake" to distinguish from real data
  - [~] 5.5 Depends on: task 1

- [ ] 6. Property tests infrastructure
  - [~] 6.1 Verify Hypothesis is installed and importable
  - [~] 6.2 Create tests/property/conftest.py with shared Hypothesis strategies (e.g., valid time-of-day floats, positive distances)
  - [~] 6.3 Confirm property test files in module tasks can import and use the strategies
  - [~] 6.4 Depends on: task 1

- [ ] 7. GTFS reader utilities
  - [~] 7.1 Implement GTFSReader class that opens a GTFS zip and reads named txt files as pandas DataFrames
  - [~] 7.2 Cache service-date rows from stop_times.txt under raw/cache/ keyed by service_date + feed SHA-256
  - [~] 7.3 Handle missing GTFS files gracefully with clear error messages
  - [~] 7.4 Implement parse_gtfs_time("25:10:00") → 1510.0 (minutes after midnight; handles hours ≥ 24)
  - [~] 7.5 Write tests/unit/test_gtfs_reader.py using the fake-gtfs fixture
  - [~] 7.6 Depends on: task 1

## Module Implementation (Pipeline Steps)

- [ ] 8. feed_check module
  - [~] 8.1 Implement check_feed(feed_path) that computes SHA-256 of raw/mta_local_bus.zip and returns the hash
  - [~] 8.2 Raise FeedError with clear message if file is missing
  - [~] 8.3 Raise FeedError with expected vs actual hash if hash does not match `8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694`
  - [~] 8.4 Write tests/unit/test_feed_check.py covering missing file, hash mismatch, and valid file cases
  - [~] 8.5 Depends on: task 3

- [ ] 9. facts module
  - [~] 9.1 Implement load_facts(facts_path) that parses data/lines/no21-1938.yaml into a FactsFile dataclass
  - [~] 9.2 Validate: 5 timing points present, 4 inter-point minute values, both departure patterns, all leg fields
  - [~] 9.3 Raise FactsError with field name if any required field is missing
  - [~] 9.4 Parse coordinates as [lon, lat]
  - [~] 9.5 Write tests/unit/test_facts.py using fake-line.yaml and invalid variants
  - [~] 9.6 Depends on: tasks 3, 5

- [ ] 10. clock module
  - [~] 10.1 Implement terminal_departures(direction) returning 40 departure times as minutes after midnight
  - [~] 10.2 Implement compute_offset(direction, corner_index, minutes) using cumulative sum in direction of travel
  - [~] 10.3 Implement build_clock(facts) returning {direction: {corner_slug: Clock1938}} for all 10 corner-direction pairs
  - [~] 10.4 Implement next_1938(clock, t) returning {start, dep, wait, before_table} where start = max(t, covered_from)
  - [~] 10.5 Implement ride_minutes(origin_slug, dest_slug, facts) as sum of timing minutes between corners
  - [~] 10.6 Write tests/unit/test_clock.py covering all 8 test cases from race-brief.md section 5.1
  - [~] 10.7 Write tests/golden/test_clock_golden.py: golden cases skip with visible warning when raw/ absent; always run on dev machine
  - [~] 10.8 Write tests/property/test_clock_properties.py covering all P1 properties (40 passes, gaps 7-8, offsets sum to 30, wait ≤ 8, next_1938 in passes, ride symmetry)
  - [~] 10.9 Depends on: task 9

- [ ] 11. stops module
  - [~] 11.1 Implement geodesic_distance(lonlat1, lonlat2) using pyproj.Geod(ellps="WGS84")
  - [~] 11.2 Implement compute_walk_time(distance_m) = metres × 1.3 ÷ 1.2 ÷ 60; store to 3 decimals; label "estimate"
  - [~] 11.3 Implement find_stops_near_corners(gtfs, corners, radius_m=400.0) returning {corner_slug: [Stop, ...]}
  - [~] 11.4 Write tests/unit/test_stops.py covering walk formula cases 1-4 from race-brief.md section 5.3
  - [~] 11.5 Write tests/golden/test_stops_golden.py: cases 5-7 from section 5.3 (stop distances to actual corners); skip with visible warning when raw/ absent
  - [~] 11.6 Write tests/property/test_walk_properties.py covering P2 properties (never negative, symmetric, doubling, max 7.223 min at 400m)
  - [~] 11.7 Depends on: tasks 7, 9

- [ ] 12. eligible module
  - [~] 12.1 Implement active_services(gtfs, date) applying calendar.txt then calendar_dates.txt exceptions
  - [~] 12.2 Implement find_eligible_trips(gtfs, origin_slug, dest_slug, origin_stops, dest_stops, service_ids) per race-brief.md section 5.4: for each trip pick the stop pair with shortest origin walk (tie: shortest dest walk), emit one record per trip, sort by dep
  - [~] 12.3 Correctly skip trips where dest.stop_sequence ≤ origin.stop_sequence
  - [~] 12.4 Write tests/unit/test_eligible.py using fake-gtfs: covers service removed by exception_type 2, trip reaching dest before origin, pair with no trips
  - [~] 12.5 Write tests/golden/test_eligible_golden.py: test cases 1-6 from race-brief.md section 5.4; skip with visible warning when raw/ absent
  - [~] 12.6 Write tests/property/test_eligible_properties.py covering P3 properties (one record per trip, alight > board sequence, dep ≤ arr, both walks ≤ radius, smaller radius never adds trips, two directions never share a trip)
  - [~] 12.7 Depends on: task 11

- [ ] 13. race module
  - [~] 13.1 Implement next_today(trips, start) exactly per race-brief.md section 5.2: NO_ONE_SEAT_RIDE if trips is empty; NO_MORE_TRIPS_TODAY if trips exist but none catchable (dep ≥ start + access_min); best = smallest (arr + egress_min), tie-break by earlier dep
  - [~] 13.2 Implement race_at_time(t, clock, eligible_trips, ride_1938_min) using same start for both sides
  - [~] 13.3 Implement compute_result(margin): photo_finish if |margin| < 1.0, else "1938" or "today"
  - [~] 13.4 Implement run_all_races(pairs, clocks, eligible, facts) for all 20 pairs × every whole minute 09:00-13:52
  - [~] 13.5 Write tests/unit/test_race.py: unit test for NO_ONE_SEAT_RIDE (empty trips list); unit test for NO_MORE_TRIPS_TODAY (trips exist, none catchable); test cases 5-6 from section 5.2 (made-up trips, by hand)
  - [~] 13.6 Write tests/golden/test_race_golden.py: test cases 1-8 from race-brief.md section 5.5; skip with visible warning when raw/ absent
  - [~] 13.7 Write tests/property/test_race_properties.py covering P4 properties (same start, start ≥ t, catchable, earliest arrival, monotonic, etc.)
  - [~] 13.8 Depends on: tasks 10, 12

- [ ] 14. summary module
  - [~] 14.1 Implement ride_verdict(delta, ride_1938): "same" if |delta| ≤ max(1.5, 0.15 × ride_1938), else "faster today" or "slower today"
  - [~] 14.2 Implement find_gaps(trips, window_start, window_end) returning (gap_min, gap_max) over consecutive departures from boarding stop in [09:00, 14:00)
  - [~] 14.3 Implement arrival_weighted_wait(gaps) = sum(g² for g in gaps) / (2 × sum(gaps)); return None with visible warning if gaps empty or sum zero
  - [~] 14.4 Implement compute_summary(races, eligible, facts) computing per-pair counts, ride verdicts, gaps, and overall totals
  - [~] 14.5 Write tests/unit/test_summary.py: test cases 1-5 from race-brief.md section 5.7 (arrival-weighted wait)
  - [~] 14.6 Write tests/golden/test_summary_golden.py: per-pair table and totals from section 5.6; skip with visible warning when raw/ absent
  - [~] 14.7 Write tests/property/test_summary_properties.py covering P5 and P6 properties
  - [~] 14.8 Depends on: task 13

- [ ] 15. fetch_osm module
  - [~] 15.1 Implement extraction of all OSM way IDs from facts file legs
  - [~] 15.2 Implement query_overpass(way_ids) querying Overpass API and returning {way_id: [[lon, lat], ...]}
  - [~] 15.3 Implement write_ways_json(ways, download_date, output_path) writing data/osm/ways.json with schema, download_date, source, license (ODbL)
  - [~] 15.4 Fail gracefully on network error with a clear message; never run automatically during build
  - [~] 15.5 Write tests/unit/test_fetch_osm.py mocking the Overpass call; test way ID extraction and output format
  - [~] 15.6 Depends on: task 9

- [ ] 16. route module
  - [~] 16.1 Implement load_ways(ways_path) reading data/osm/ways.json snapshot (never fetches network)
  - [~] 16.2 Implement orient_way(way, reference) flipping a way if its last point is nearer the end of the reference than its first
  - [~] 16.3 Implement clip_line(line, start_point, end_point) extracting the segment between nearest points; error if clip_to comes before clip_from
  - [~] 16.4 Implement build_leg(leg_spec, ways): inferred legs use points_lonlat; OSM legs join ways in order, handle "gap" markers (declared breaks), validate bridged_gaps_m within 1 m, clip to endpoints
  - [~] 16.5 Raise RouteError with street name on undeclared break > 1 m; raise RouteError with actual vs expected on length mismatch beyond max(1 m, 0.5%)
  - [~] 16.6 Implement build_route(facts, ways) joining legs, verifying consecutive legs connect within 1 m, verifying each timing point within 30 m of route
  - [~] 16.7 Write tests/unit/test_route.py: test inferred leg, declared gap, undeclared break error, length mismatch error, clip order error
  - [~] 16.8 Write tests/golden/test_route_golden.py: test cases 1-6 from race-brief.md section 5.8; skip with visible warning when raw/ absent
  - [~] 16.9 Write tests/property/test_route_properties.py covering P7 properties (flipping way preserves line, leg ≥ straight line, etc.)
  - [~] 16.10 Depends on: task 15

- [ ] 17. display_rounding module
  - [~] 17.1 Implement round_for_display(parts) using largest-remainder method: round total to nearest whole (halves up); floor each part; give remaining minutes to parts with largest fractions, earlier phase wins ties
  - [~] 17.2 Verify the function is pure (same input always gives same output) and stateless
  - [~] 17.3 Write tests/unit/test_display_rounding.py covering all six rows of the table in screen-brief.md section 2.10
  - [~] 17.4 Write tests/property/test_rounding_properties.py covering P8 properties (parts sum to total, each within 1 min, whole numbers, whole-number inputs unchanged, pure)
  - [~] 17.5 Depends on: none

- [ ] 18. emit module
  - [~] 18.1 Implement write_index_json(facts, pairs, feed_sha256, feed_version, service_date, output_dir)
  - [~] 18.2 Implement write_summary_json(summary, output_dir)
  - [~] 18.3 Implement write_race_files(clocks, eligible, races, output_dir) applying display_rounding to each race row's stored values
  - [~] 18.4 Implement write_route_geojson(route_legs, output_dir)
  - [~] 18.5 Validate every output file against its JSON schema using jsonschema; raise ValidationError on failure
  - [~] 18.6 Check every numeric field has a source entry; raise ValidationError listing any unsourced fields
  - [~] 18.7 Write tests/unit/test_emit.py verifying file structure, schema validation, and source check with fake data
  - [~] 18.8 Write tests/golden/test_emit_golden.py: verify lead pair race file matches section 4.5 format and values; skip with visible warning when raw/ absent
  - [~] 18.9 Depends on: tasks 4, 10, 13, 14, 16, 17

- [ ] 19. check_sources module
  - [~] 19.1 Implement find_banned_words(text) detecting: "live", "real-time", "realtime", "arriving now", "right now"; allow the fixed phrase "Scheduled, not live."
  - [~] 19.2 Implement find_unsourced_numbers(json_obj) detecting numeric fields without a corresponding source entry
  - [~] 19.3 Implement check_sources_in_files(paths) returning a list of violations (empty if clean)
  - [~] 19.4 Write tests/unit/test_check_sources.py covering files with violations and clean files for each rule
  - [~] 19.5 Depends on: none

## Integration and Commands

- [ ] 20. validate command
  - [~] 20.1 Wire cmd_validate to: load and validate facts file; build clock and verify it; validate JSON schema files are well-formed; run check_sources on web/ and docs/
  - [~] 20.2 Confirm command does not read the feed or touch the network
  - [~] 20.3 Verify command completes in under 10 seconds
  - [~] 20.4 All failures produce clear error messages
  - [~] 20.5 Depends on: tasks 9, 10, 4, 19

- [ ] 21. build command
  - [~] 21.1 Wire cmd_build to run all 9 pipeline steps in order: feed_check → facts → clock → stops → eligible → race → summary → route → emit
  - [~] 21.2 Pass each step's output as input to the next
  - [~] 21.3 Fail fast on any step error, printing which step failed
  - [~] 21.4 Print progress messages for each completed step
  - [~] 21.5 Verify command completes in under 60 seconds with the pinned feed
  - [~] 21.6 Depends on: tasks 8, 9, 10, 11, 12, 13, 14, 16, 18

- [ ] 22. check command
  - [~] 22.1 Wire cmd_check to run build (task 21) then run pytest
  - [~] 22.2 Confirm golden tests always run on developer machine (feed present); confirm they skip with visible warning in CI when raw/ absent
  - [~] 22.3 Return pytest exit code as the command exit code
  - [~] 22.4 Depends on: task 21

- [ ] 23. verify command
  - [~] 23.1 Wire cmd_verify to rebuild into a temp directory and compare outputs against committed web/public/data/ files byte-for-byte
  - [~] 23.2 Fail with clear error listing differing files if any output differs
  - [~] 23.3 Fail with clear error (not skip) if raw/mta_local_bus.zip is missing
  - [~] 23.4 Depends on: task 21

- [ ] 24. check_sources command
  - [~] 24.1 Wire cmd_check_sources to run check_sources_in_files on all files in web/ and docs/
  - [~] 24.2 Report each violation with file path and line number
  - [~] 24.3 Exit 0 if clean, exit 1 if any violations found
  - [~] 24.4 Depends on: task 19

## Testing Infrastructure

- [ ] 25. Golden tests verification
  - [~] 25.1 Add tests/conftest.py with a pytest marker `requires_feed` and a skip condition: skip with visible warning when raw/mta_local_bus.zip is absent (CI); always run when feed is present (dev machine)
  - [~] 25.2 Confirm that all golden test files in module tasks 10-18 use the `requires_feed` marker
  - [~] 25.3 Confirm that verify command (task 23) fails, not skips, when feed is absent
  - [~] 25.4 Confirm all test tables from race-brief.md sections 5.1-5.9 have a corresponding assertion in a golden test file
  - [~] 25.5 Depends on: tasks 10, 11, 12, 13, 14, 16, 18

## Final Integration

- [ ] 26. End-to-end integration test
  - [~] 26.1 Write tests/test_integration.py that runs a full build and spot-checks outputs
  - [~] 26.2 Verify all 23 output files are created (index.json, summary.json, 20 race files, route.geojson)
  - [~] 26.3 Verify lead pair race file at t=10:00 reads 1938 total 15, today total 45.156, result "1938"
  - [~] 26.4 Verify summary.json totals: 5,666 races, 5,582 wins_1938, 25 wins_today, 59 photo_finishes
  - [~] 26.5 Run build twice and confirm all output files are byte-identical (property P9)
  - [~] 26.6 Confirm build completes in under 60 seconds
  - [~] 26.7 Depends on: tasks 21, 25

- [ ] 27. Documentation and README
  - [~] 27.1 Write pipeline/README.md with installation instructions (Python 3.12, pip install -e .)
  - [~] 27.2 Document all six commands with usage examples
  - [~] 27.3 Add notes on feed pinning (SHA-256, never commit raw/), OSM data (fetch_osm is one-time, commit ways.json), and golden test behaviour
  - [~] 27.4 Link to docs/planning/race-brief.md and .kiro/specs/race-engine/design.md
  - [~] 27.5 Depends on: task 2

- [ ] 28. Final validation
  - [~] 28.1 Run `python -m pipeline check` with feed present and confirm it passes
  - [~] 28.2 Confirm lead pair race at t=10:00 reads 15 minutes vs 45.156 minutes
  - [~] 28.3 Confirm all 28 golden test cases from race-brief.md match computed values
  - [~] 28.4 Confirm all property tests pass
  - [~] 28.5 Confirm `python -m pipeline verify` passes (committed files match a fresh build)
  - [~] 28.6 Confirm `python -m pipeline check_sources` exits 0
  - [~] 28.7 Depends on: tasks 22, 23, 24, 26
