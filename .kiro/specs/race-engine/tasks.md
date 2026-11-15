# Race Engine: Tasks

## Setup and Infrastructure

### TASK-001: Project scaffolding
**Status**: staged  
**Description**: Create pipeline package structure, pyproject.toml with dependencies, and __init__.py files.  
**Depends on**: none  
**Files**: 
- pipeline/__init__.py
- pipeline/__main__.py
- pyproject.toml
- tests/unit/__init__.py
- tests/property/__init__.py
- tests/golden/__init__.py
- tests/fixtures/

**Acceptance**:
- `python -m pipeline` runs without import errors
- All required dependencies install: pandas, pyproj, PyYAML, jsonschema, pytest, hypothesis, requests

---

### TASK-002: CLI dispatcher
**Status**: staged  
**Description**: Implement cli.py with command dispatcher for all six commands: fetch_osm, validate, build, check, verify, check_sources.  
**Depends on**: TASK-001  
**Files**: 
- pipeline/cli.py

**Acceptance**:
- `python -m pipeline --help` shows all six commands
- Each command can be invoked (will fail with "not implemented" for now)
- Clear usage messages

---

### TASK-003: Error handling classes
**Status**: staged  
**Description**: Define custom exception types: PipelineError, FeedError, FactsError, RouteError, ValidationError.  
**Depends on**: TASK-001  
**Files**: 
- pipeline/__init__.py (or pipeline/errors.py)

**Acceptance**:
- All exception types defined and importable
- Each has clear docstring

---

### TASK-004: JSON schemas
**Status**: staged  
**Description**: Write JSON Schema files for index.json, summary.json, race files, and route.geojson based on formats in race-brief.md section 4.  
**Depends on**: TASK-001  
**Files**: 
- pipeline/schemas/index.schema.json
- pipeline/schemas/summary.schema.json
- pipeline/schemas/race.schema.json
- pipeline/schemas/route.schema.json

**Acceptance**:
- Each schema is valid JSON Schema (draft 2020-12 or compatible)
- Schemas match output formats from design.md

---

### TASK-005: Test fixtures
**Status**: staged  
**Description**: Create minimal fake fixtures for edge case testing.  
**Depends on**: TASK-001  
**Files**: 
- tests/fixtures/fake-line.yaml
- tests/fixtures/fake-gtfs/calendar.txt
- tests/fixtures/fake-gtfs/calendar_dates.txt
- tests/fixtures/fake-gtfs/routes.txt
- tests/fixtures/fake-gtfs/trips.txt
- tests/fixtures/fake-gtfs/stops.txt
- tests/fixtures/fake-gtfs/stop_times.txt

**Acceptance**:
- fake-line.yaml: minimal valid facts file (2 corners, 1 leg each direction)
- fake-gtfs: tiny feed with edge cases (service exception, trip reaching dest before origin, no trips)
- All fixtures named "fake" to avoid confusion
- Used by unit tests for edge cases (e.g., no_one_seat_ride state)

---

### TASK-006: Property tests infrastructure
**Status**: staged  
**Description**: Set up Hypothesis test infrastructure for property testing.  
**Depends on**: TASK-001  
**Files**: 
- tests/property/conftest.py (if needed for shared strategies)

**Acceptance**:
- Hypothesis installed and importable
- Property test infrastructure ready for use in module tasks
- Shared test strategies defined if needed

---

### TASK-007: GTFS reader utilities
**Status**: staged  
**Description**: Helper class to read GTFS zip, cache stop_times, handle standard GTFS parsing.  
**Depends on**: TASK-001  
**Files**: 
- pipeline/gtfs_reader.py
- tests/unit/test_gtfs_reader.py

**Acceptance**:
- `GTFSReader(path)` opens zip, reads txt files as DataFrames
- Caches service-date rows from stop_times.txt under raw/cache/
- Cache key: service_date + feed SHA-256
- Handles missing files gracefully
- Unit tests with minimal GTFS fixture

---

## Module Implementation (Pipeline Steps)

### TASK-008: feed_check module
**Status**: staged  
**Description**: Implement feed SHA-256 validation. Check raw/mta_local_bus.zip exists and matches pinned hash.  
**Depends on**: TASK-003  
**Files**: 
- pipeline/feed_check.py
- tests/unit/test_feed_check.py

**Acceptance**:
- `check_feed(Path("raw/mta_local_bus.zip"))` returns SHA-256 hash
- Raises FeedError with clear message if file missing
- Raises FeedError if hash doesn't match pinned value `8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694`
- Unit tests pass

---

### TASK-009: facts module
**Status**: staged  
**Description**: Load and validate data/lines/no21-1938.yaml. Check schema: 5 timing points, 4 minute values, departure patterns, legs.  
**Depends on**: TASK-003, TASK-005  
**Files**: 
- pipeline/facts.py
- tests/unit/test_facts.py

**Acceptance**:
- `load_facts(Path("data/lines/no21-1938.yaml"))` returns FactsFile dataclass
- Validates all required fields present
- Raises FactsError on missing timing point, minute, or departure
- Unit tests with valid and invalid fixtures pass

---

### TASK-010: clock module
**Status**: staged  
**Description**: Generate 1938 clock for each corner and direction. Implement terminal_departures, compute_offset, next_1938.  
**Depends on**: TASK-009  
**Files**: 
- pipeline/clock.py
- tests/unit/test_clock.py
- tests/property/test_clock_properties.py
- tests/golden/test_clock_golden.py

**Acceptance**:
- `build_clock(facts)` returns clock dict for all corners/directions
- Each corner has exactly 40 passes
- Unit tests pass
- Golden test case 3: Preston & Caroline eastbound at 10:00 → dep 10:06, wait 6
- Golden test case 7: Preston & Caroline to Aliceanna & Bond ride = 9 minutes
- Property tests P1 all pass (gaps 7-8, offsets sum to 30, wait ≤ 8, etc.)

---

### TASK-011: stops module
**Status**: staged  
**Description**: Find GTFS stops within 400m radius of each corner. Compute geodesic distances and walk times.  
**Depends on**: TASK-009, TASK-007  
**Files**: 
- pipeline/stops.py
- tests/unit/test_stops.py
- tests/property/test_walk_properties.py
- tests/golden/test_stops_golden.py

**Acceptance**:
- `find_stops_near_corners(gtfs, corners, 400.0)` returns stops dict
- Uses pyproj.Geod(ellps="WGS84") for distances
- Walk formula: metres × 1.3 ÷ 1.2 ÷ 60
- Unit tests pass
- Golden test 5: Preston & Caroline to stop 8564 = 125.07 ± 0.1 m
- Golden test 1: 125.07 m → 2.258 min
- Property tests P2 all pass (never negative, symmetric, doubling, max 7.223 min at 400m)

---

### TASK-012: eligible module
**Status**: staged  
**Description**: Find one-seat trips per directed pair. Implement active_services, find_eligible_trips, parse_gtfs_time.  
**Depends on**: TASK-011  
**Files**: 
- pipeline/eligible.py
- tests/unit/test_eligible.py
- tests/property/test_eligible_properties.py
- tests/golden/test_eligible_golden.py

**Acceptance**:
- `active_services(gtfs, date(2026,11,4))` returns exactly service_id 2251
- `find_eligible_trips(...)` for lead pair returns 36 trips, all CityLink Lime HARBOR EAST
- Handles GTFS times ≥ 24 hours correctly
- For each trip: picks stop pair with shortest origin walk (tie: shortest dest walk)
- Unit tests pass
- Golden test 2: 36 trips board 8564 alight 9486
- Property tests P3 all pass (one per trip, alight > board, both walks ≤ 400m, etc.)

---

### TASK-013: race module
**Status**: staged  
**Description**: Run all races for all pairs at all slider times. Implement race_at_time, next_today, compute_result, ride_minutes.  
**Depends on**: TASK-010, TASK-012  
**Files**: 
- pipeline/race.py
- tests/unit/test_race.py
- tests/property/test_race_properties.py
- tests/golden/test_race_golden.py

**Acceptance**:
- `run_all_races(pairs, clocks, eligible, facts)` returns race rows for all 20 pairs
- `next_today` returns two distinct results:
  - NO_ONE_SEAT_RIDE when trips list is empty (pair has zero eligible trips)
  - NO_MORE_TRIPS_TODAY when trips exist but none catchable after start
  - Unit test for each case required
- Unit tests pass
- Golden test: lead pair at 10:00 → 1938 total 15, today 45.156, result "1938", margin 30.156
- Golden test table row 8: Westwood & Carey → Preston & Caroline at 11:23 → today wins by 4.025
- Both sides always start from same time (max of slider time and covered_from)
- Photo finish when |margin| < 1.0
- Property tests P4 all pass (same start, start ≥ t, catchable, earliest arrival, monotonic, etc.)

---

### TASK-014: summary module
**Status**: staged  
**Description**: Compute per-pair verdicts and overall totals. Implement ride_verdict, find_gaps, arrival_weighted_wait.  
**Depends on**: TASK-013  
**Files**: 
- pipeline/summary.py
- tests/unit/test_summary.py
- tests/property/test_summary_properties.py
- tests/golden/test_summary_golden.py

**Acceptance**:
- `compute_summary(races, eligible, facts)` returns Summary with all counts
- Unit tests pass
- Golden: 5,666 total races, 5,582 wins_1938, 25 wins_today, 59 photo_finishes
- Golden: 17 pairs "same" ride, 3 "faster today", 0 "slower today"
- Golden: lead pair gaps 34-39 minutes
- Arrival-weighted wait for [7,8,7,8] = 3.767 minutes
- Property tests P5 all pass (counts add up, today_wins list accurate, etc.)
- Property tests P6 all pass (equal gaps → g/2, never below mean/2, order-independent, etc.)

---

### TASK-015: fetch_osm module
**Status**: staged  
**Description**: One-time command to fetch OSM way geometries via Overpass API. Writes data/osm/ways.json with download date.  
**Depends on**: TASK-009  
**Files**: 
- pipeline/fetch_osm.py
- tests/unit/test_fetch_osm.py

**Acceptance**:
- `python -m pipeline fetch_osm` extracts way IDs from facts file
- Queries Overpass API for those ways
- Writes data/osm/ways.json with: schema, download_date, source, license (ODbL), ways dict
- Format: {"way_id": [[lon, lat], ...]}
- Fails gracefully on network error with clear message

---

### TASK-016: route module
**Status**: staged  
**Description**: Rebuild 1938 route from OSM ways. Implement build_route, build_leg, orient_way, clip_line, validate_leg_length, validate_route.  
**Depends on**: TASK-015  
**Files**: 
- pipeline/route.py
- tests/unit/test_route.py
- tests/property/test_route_properties.py
- tests/golden/test_route_golden.py

**Acceptance**:
- `build_route(facts, ways)` returns route legs for each direction
- Handles inferred legs (use points_lonlat)
- Handles OSM legs (join ways, flip if needed, clip to endpoints)
- Handles gaps (declared with "gap" marker and bridged_gaps_m)
- Unit tests pass
- Golden: Aliceanna Street eastbound 123.8 m ± 0.5%
- Golden: Lanvale Street one bridged gap 26.2 m ± 1 m
- Golden: westbound 14 legs = 8,401.0 m ± 0.5%
- Golden: loop + eastbound = 8,409.9 m ± 0.5%
- Fails loudly on undeclared break, length mismatch, timing point > 30m from route
- Property tests P7 all pass (flipping way preserves line, leg ≥ straight line, etc.)

---

### TASK-017: display_rounding module
**Status**: staged  
**Description**: Implement largest-remainder rounding for display. Pure function that makes parts sum to total.  
**Depends on**: none  
**Files**: 
- pipeline/display_rounding.py
- tests/unit/test_display_rounding.py
- tests/property/test_rounding_properties.py

**Acceptance**:
- `round_for_display([2.258, 30.458, 8.283, 4.156])` returns `[2, 31, 8, 4]` (sums to 45)
- Unit tests pass
- Golden test table from screen-brief.md section 2.10 all pass
- Property tests P8 all pass (parts sum to total, each within 1 min, whole numbers, pure function)

---

### TASK-018: emit module
**Status**: staged  
**Description**: Write all JSON output files to web/public/data/. Validate against schemas. Check all numbers sourced.  
**Depends on**: TASK-004, TASK-010, TASK-013, TASK-014, TASK-016, TASK-017  
**Files**: 
- pipeline/emit.py
- tests/unit/test_emit.py
- tests/golden/test_emit_golden.py

**Acceptance**:
- `emit_all(...)` writes 5 files: index.json, summary.json, 20 race files, route.geojson
- Each file validates against its schema
- Source check passes: every number has source entry
- Display rounding applied to race rows (shown values add up to shown totals)
- Times stored to 3 decimals, walks to 2 decimals
- Unit tests pass
- Golden: Race file matches format from race-brief.md section 4.5
- Golden: lead pair race file structure matches expected

---

### TASK-019: check_sources module
**Status**: staged  
**Description**: Check for banned words and unsourced numbers in web/ and docs/.  
**Depends on**: none  
**Files**: 
- pipeline/check_sources.py
- tests/unit/test_check_sources.py

**Acceptance**:
- Finds banned words: "live", "real-time", "realtime", "arriving now", "right now"
- Allows exception: "Scheduled, not live."
- Finds numeric fields in JSON without source entries
- Returns list of violations (empty if all pass)
- Unit tests cover both violations and clean files

---

## Integration and Commands

### TASK-020: validate command
**Status**: staged  
**Description**: Implement fast validation: facts schema, 1938 clock, JSON schemas, copy rules. No feed, no network.  
**Depends on**: TASK-009, TASK-010, TASK-004, TASK-019  
**Files**: 
- pipeline/cli.py (cmd_validate)

**Acceptance**:
- `python -m pipeline validate` runs in under 10 seconds
- Checks facts file schema
- Checks 1938 clock generates correctly
- Validates JSON schemas are valid
- Runs check_sources
- Does not read feed or touch network
- Clear error messages on any failure

---

### TASK-021: build command
**Status**: staged  
**Description**: Implement full pipeline build. Execute all 9 steps in order and write JSON files.  
**Depends on**: TASK-008, TASK-009, TASK-010, TASK-011, TASK-012, TASK-013, TASK-014, TASK-016, TASK-018  
**Files**: 
- pipeline/cli.py (cmd_build)

**Acceptance**:
- `python -m pipeline build` runs all 9 steps in order
- Completes in under 60 seconds
- Writes all 23 JSON files to web/public/data/
- Each step's output passed to next step
- Fails fast on any step error
- Progress messages to stdout

---

### TASK-022: check command
**Status**: staged  
**Description**: Run build then pytest. Used by hooks.  
**Depends on**: TASK-021  
**Files**: 
- pipeline/cli.py (cmd_check)

**Acceptance**:
- `python -m pipeline check` runs build then pytest
- On developer machine: always runs golden tests
- Golden tests pass with feed present
- Unit and property tests always run
- Returns pytest exit code

---

### TASK-023: verify command
**Status**: staged  
**Description**: Rebuild from raw/ and fail if committed data differs. Ensures reproducibility.  
**Depends on**: TASK-021  
**Files**: 
- pipeline/cli.py (cmd_verify)

**Acceptance**:
- `python -m pipeline verify` rebuilds into temp directory
- Compares temp outputs to committed web/public/data/ files
- Fails with clear error showing which files differ
- Must fail (not skip) if raw/mta_local_bus.zip missing
- Tests property P9: build reproducibility

---

### TASK-024: check_sources command
**Status**: staged  
**Description**: Run source checking on web/ and docs/.  
**Depends on**: TASK-019  
**Files**: 
- pipeline/cli.py (cmd_check_sources)

**Acceptance**:
- `python -m pipeline check_sources` scans web/ and docs/
- Reports banned words with file and line number
- Reports unsourced numbers in JSON files
- Exit code 0 if clean, 1 if violations found
- Clear summary of findings

---

## Testing Infrastructure

### TASK-025: Golden tests verification
**Status**: staged  
**Description**: Verify all golden tests from race-brief.md are present and configure skip behavior for CI vs dev machine.  
**Depends on**: TASK-010, TASK-011, TASK-012, TASK-013, TASK-014, TASK-016, TASK-018  
**Files**: 
- tests/golden/ (configuration, pytest markers)
- tests/conftest.py

**Acceptance**:
- All test tables from race-brief.md sections 5.1-5.9 have corresponding golden tests (written in module tasks 010-018)
- Tests detect CI environment (via env var or pytest mark)
- In CI: skip gracefully with visible warning when raw/ missing
- On dev machine: always run, must pass
- `verify` command fails (not skips) if raw/ missing
- All expected values match computed values

---

## Final Integration

### TASK-026: End-to-end integration test
**Status**: staged  
**Description**: Full pipeline test with real no21-1938.yaml and pinned feed.  
**Depends on**: TASK-021, TASK-025  
**Files**: 
- tests/test_integration.py

**Acceptance**:
- Runs full build with real data
- Verifies all 23 output files created
- Spot-checks lead pair values: 15 vs 45.156 at 10:00
- Verifies 5,666 total races, 5,582 vs 25 vs 59
- Confirms build completes in under 60 seconds
- Tests build reproducibility (P9): run twice, compare outputs

---

### TASK-027: Documentation and README
**Status**: staged  
**Description**: Write pipeline README with setup instructions, command usage, and examples.  
**Depends on**: TASK-002  
**Files**: 
- pipeline/README.md

**Acceptance**:
- Installation instructions (Python 3.12, dependencies)
- Command reference for all six commands
- Example usage for common workflows
- Notes on feed pinning and OSM data
- Link to race-brief.md and design.md

---

### TASK-028: Final validation
**Status**: staged  
**Description**: Run all commands and verify success criteria from requirements.md.  
**Depends on**: TASK-022, TASK-023, TASK-024, TASK-026  
**Files**: none (validation only)

**Acceptance**:
- `python -m pipeline check` passes on developer machine with feed present
- Lead pair's race at 10:00 reads 15 minutes vs 45.156 minutes
- All golden test values match expected values from race-brief.md
- All property tests pass
- Build is reproducible (identical files on repeat builds)
- Every output number has a source entry
- verify command confirms no drift between committed and fresh builds

---

## Task Summary

**Total tasks**: 28  
**Categories**:
- Setup and infrastructure: 7 tasks (001-007)
- Module implementation: 12 tasks (008-019)
- Integration and commands: 5 tasks (020-024)
- Testing infrastructure: 1 task (025)
- Final integration: 3 tasks (026-028)

**Critical path**: 
001 → 002 → 003 → 009 → 010 → 012 → 013 → 014 → 016 → 018 → 021 → 022 → 026 → 028

**Estimated total**: 28 tasks covering requirements, design, implementation, testing, and validation.
