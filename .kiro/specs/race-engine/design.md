# Race Engine: Design

## Architecture Overview

The race engine is a Python 3.12 package organized as a linear pipeline of independent modules. Each module performs one transformation step, takes its input from the previous step, and passes its output to the next. This design supports:

- **Testability**: Each module can be tested in isolation with fixtures
- **Reproducibility**: Same inputs always produce identical outputs
- **Debuggability**: Each step's output can be inspected separately
- **Incremental development**: Modules can be built and verified one at a time

## Module Structure

```
pipeline/
├── __init__.py
├── __main__.py          # Entry point for python -m pipeline
├── cli.py               # Command dispatcher (validate, build, check, verify, check_sources, fetch_osm)
├── feed_check.py        # Step 1: SHA-256 validation
├── facts.py             # Step 2: Load and validate facts file
├── clock.py             # Step 3: Generate 1938 clock
├── stops.py             # Step 4: Find stops within radius, compute walks
├── eligible.py          # Step 5: Find one-seat trips per pair
├── race.py              # Step 6: Run all races
├── summary.py           # Step 7: Per-pair verdicts and totals
├── route.py             # Step 8: Rebuild route from OSM ways
├── emit.py              # Step 9: Write and validate JSON files
├── check_sources.py     # Source checking utility
├── fetch_osm.py         # One-time OSM data fetcher via Overpass
├── display_rounding.py  # Pure function for largest-remainder rounding
└── schemas/             # JSON Schema files for validation
    ├── index.schema.json
    ├── summary.schema.json
    ├── race.schema.json
    └── route.schema.json
```

## Data Flow

```
raw/mta_local_bus.zip ─────┐
                           │
data/lines/no21-1938.yaml ─┼──> feed_check   ──> facts      ──> clock
                           │        │               │              │
data/osm/ways.json ────────┘        │               │              │
                                    │               │              │
                                    v               v              v
                               [validated]     [timing pts]   [passes, offsets]
                                                    │              │
                                                    v              v
                                                 stops  ────────> eligible
                                                    │              │
                                                    │              v
                                                    │         [trips per pair]
                                                    │              │
                                                    v              v
                                                 route <───────  race
                                                    │              │
                                                    v              v
                                                [GeoJSON]     [race rows]
                                                    │              │
                                                    └──────┬───────┘
                                                           v
                                                       summary
                                                           │
                                                           v
                                                    [totals, verdicts]
                                                           │
                                                           v
                                                         emit
                                                           │
                                                           v
                                              web/public/data/*.json
```

## Core Data Structures

### TimingPoint
```python
@dataclass
class TimingPoint:
    name: str
    slug: str              # e.g., "preston-caroline"
    lonlat: tuple[float, float]  # [lon, lat]
    minutes_from_prev: int       # 0 for first point
    inferred: bool = False
    note: str | None = None
    source: str
```

### Clock1938
```python
@dataclass
class Clock1938:
    corner: str                    # Corner slug
    direction: str                 # "eastbound" or "westbound"
    offset_min: int                # Minutes from terminal
    passes: list[float]            # Minutes after midnight (40 times)
    covered_from: float            # First pass time
```

### Stop
```python
@dataclass
class Stop:
    stop_id: str
    name: str
    lonlat: tuple[float, float]
    walk_m: float                  # Distance in metres (2 decimals)
    walk_min: float                # Walk time in minutes (3 decimals)
```

### EligibleTrip
```python
@dataclass
class EligibleTrip:
    trip_id: str
    route: str                     # Route short name
    headsign: str
    board_stop: Stop               # Includes walk from origin corner
    alight_stop: Stop              # Includes walk to dest corner
    dep: float                     # Minutes after midnight (3 decimals)
    arr: float                     # Minutes after midnight (3 decimals)
    ride_min: float                # arr - dep
    access_min: float              # board_stop.walk_min
    egress_min: float              # alight_stop.walk_min
```

### RaceRow
```python
@dataclass
class RaceRow:
    t: str                         # Slider time "HH:MM"
    start: float                   # Actual start time (minutes after midnight)
    before_table: bool = False
    y1938: Race1938
    today: RaceToday | None        # None if no_one_seat_ride
    result: str                    # "1938", "today", "photo_finish", "no_one_seat_ride"
    margin: float | None           # Absolute difference in minutes

@dataclass
class Race1938:
    dep: str                       # "HH:MM"
    wait: int                      # Rounded for display (whole minutes)
    ride: int
    total: int
    wait_exact: float              # Stored value (3 decimals)
    total_exact: float

@dataclass
class RaceToday:
    trip: int                      # Index into trips array
    access: int                    # Rounded for display
    wait: int
    ride: int
    egress: int
    total: int
    access_exact: float            # Stored values
    wait_exact: float
    ride_exact: float
    egress_exact: float
    total_exact: float
```

### RouteLeg
```python
@dataclass
class RouteLeg:
    street: str
    direction: str                 # "eastbound", "westbound", "loop"
    method: str                    # "osm", "osm+gap", "inferred"
    coordinates: list[tuple[float, float]]  # [lon, lat] points
    length_m: float
    note: str | None = None
```

## Module Designs

### 1. feed_check.py

```python
def check_feed(feed_path: Path) -> str:
    """
    Validate feed file exists and matches pinned SHA-256.
    
    Returns: feed SHA-256 hash
    Raises: FeedError if missing or hash mismatch
    """
    
def compute_sha256(file_path: Path) -> str:
    """Compute SHA-256 hash of file."""
```

**Error handling**: Clear error message stating expected vs actual hash, or that file is missing.

### 2. facts.py

```python
def load_facts(facts_path: Path) -> FactsFile:
    """
    Load and validate facts file schema.
    
    Returns: Parsed facts with validated structure
    Raises: FactsError if schema invalid or required fields missing
    """
    
@dataclass
class FactsFile:
    line: str
    mode: str
    effective: str
    timing_points: list[TimingPoint]
    midday_departures: dict[str, DeparturePattern]
    legs: dict[str, list[LegSpec]]
    source: str
    pages: dict[str, str]
```

**Validation rules**:
- 5 timing points present
- 4 minute values between points
- Both departure patterns present (eastbound, westbound)
- All leg information complete

### 3. clock.py

```python
PATTERNS = {
    "eastbound": [0, 7, 15, 22, 30, 37, 45, 52],
    "westbound": [4, 11, 19, 26, 34, 41, 49, 56]
}

FIRST = {"eastbound": 540, "westbound": 544}  # 09:00, 09:04 in minutes
LAST = {"eastbound": 832, "westbound": 836}   # 13:52, 13:56

def build_clock(facts: FactsFile) -> dict[str, dict[str, Clock1938]]:
    """
    Generate 1938 clock for each corner and direction.
    
    Returns: {direction: {corner_slug: Clock1938}}
    """

def terminal_departures(direction: str) -> list[float]:
    """Generate 40 terminal departure times."""
    
def compute_offset(direction: str, corner_index: int, minutes: list[int]) -> int:
    """Compute minutes from terminal to corner."""
    
def next_1938(clock: Clock1938, t: float) -> dict:
    """
    Find next 1938 departure at or after time t.
    
    Returns: {start, dep, wait, before_table}
    """
```

**Key algorithms**:
- Terminal departures: every hh:mm where hh in 9..13 and mm in PATTERNS[dir]
- Offsets: cumulative sum of timing minutes in travel direction
- Passes: terminal_time + offset for each terminal departure
- Next departure: smallest pass >= max(t, covered_from)

### 4. stops.py

```python
def find_stops_near_corners(
    gtfs: GTFSReader,
    corners: list[TimingPoint],
    radius_m: float = 400.0
) -> dict[str, list[Stop]]:
    """
    Find GTFS stops within radius of each corner.
    
    Returns: {corner_slug: [Stop, ...]}
    """

def geodesic_distance(lonlat1: tuple, lonlat2: tuple) -> float:
    """WGS84 geodesic distance in metres using pyproj."""
    
def compute_walk_time(distance_m: float) -> float:
    """Walk minutes = metres × 1.3 ÷ 1.2 ÷ 60"""
```

**Implementation**:
- Use pyproj.Geod(ellps="WGS84").inv() for distances
- Round walk_m to 2 decimals, walk_min to 3 decimals
- Label all walks as "estimate"

### 5. eligible.py

```python
def active_services(gtfs: GTFSReader, date: datetime.date) -> set[str]:
    """
    Determine which service_ids are active on date.
    
    1. From calendar.txt: services covering date with correct weekday flag
    2. Apply calendar_dates.txt: add type 1, remove type 2
    """

def find_eligible_trips(
    gtfs: GTFSReader,
    origin_slug: str,
    dest_slug: str,
    origin_stops: list[Stop],
    dest_stops: list[Stop],
    service_ids: set[str],
    date: datetime.date
) -> list[EligibleTrip]:
    """
    Find one-seat trips linking two corners.
    
    From race-brief.md section 5.4:
    For each trip on an active service:
      - Find all (origin_stop, dest_stop) pairs on same trip where:
        - origin_stop in origin_stops (within 400m of origin corner)
        - dest_stop in dest_stops (within 400m of dest corner)
        - dest.stop_sequence > origin.stop_sequence
      - If no pairs: skip this trip
      - If multiple pairs: pick the pair with shortest origin walk;
        among those, shortest dest walk
      - Emit one record per trip
    
    Returns: List sorted by departure time
    """

def parse_gtfs_time(time_str: str) -> float:
    """Parse GTFS time to minutes after midnight (handles hours >= 24)."""
```

**Edge cases**:
- Trip reaches dest before origin: skip
- Multiple valid stop pairs on one trip: use shortest walks
- Service exception type 2 on date: exclude those trips

### 6. race.py

```python
def run_all_races(
    pairs: list[tuple[str, str]],
    clocks: dict[str, dict[str, Clock1938]],
    eligible: dict[tuple[str, str], list[EligibleTrip]],
    facts: FactsFile
) -> dict[tuple[str, str], list[RaceRow]]:
    """
    Run races for all pairs at all slider times 09:00 to 13:52.
    
    Returns: {(origin, dest): [RaceRow, ...]}
    """

def race_at_time(
    t: float,
    clock: Clock1938,
    eligible_trips: list[EligibleTrip],
    ride_1938: float
) -> RaceRow:
    """
    Run one race at slider time t.
    
    Both sides start from max(t, covered_from).
    """

def next_today(trips: list[EligibleTrip], start: float) -> dict | None:
    """
    Find best catchable trip after start time.
    
    From race-brief.md section 5.2:
    1. If trips list is empty: return NO_ONE_SEAT_RIDE
    2. Filter catchable trips: dep >= start + access_min
    3. If no catchable trips: return NO_MORE_TRIPS_TODAY
    4. Best trip = the one with smallest (arr + egress_min)
       - This is earliest arrival at the destination corner, walking included
       - "The rider takes the trip that reaches the destination corner first"
       - On tie: earlier departure
    
    Returns: Dict with trip details, or special result code
    
    Unit tests must cover:
    - Empty trips list → NO_ONE_SEAT_RIDE
    - Trips exist but none catchable → NO_MORE_TRIPS_TODAY
    """

def compute_result(margin: float) -> str:
    """
    Determine result from margin (positive = 1938 faster).
    
    |margin| < 1.0: "photo_finish"
    margin > 0: "1938"
    margin < 0: "today"
    """

def ride_minutes(origin_slug: str, dest_slug: str, facts: FactsFile) -> float:
    """Sum timing minutes between two corners."""
```

**Property checks in tests**:
- Both sides always use same start
- start >= t
- start = t when t >= covered_from
- Chosen trip is catchable
- No other catchable trip arrives earlier
- Result agrees with stored totals and 1.0-minute band

### 7. summary.py

```python
def compute_summary(
    races: dict[tuple[str, str], list[RaceRow]],
    eligible: dict[tuple[str, str], list[EligibleTrip]],
    facts: FactsFile
) -> Summary:
    """
    Compute per-pair verdicts and overall totals.
    """

@dataclass
class PairSummary:
    origin: str
    dest: str
    races: int
    wins_1938: int
    wins_today: int
    photo_finishes: int
    ride_1938: float
    ride_today_median: float
    ride_verdict: str              # "same", "faster today", "slower today"
    gap_min: int
    gap_max: int

def ride_verdict(delta: float, ride_1938: float) -> str:
    """
    |delta| <= max(1.5, 0.15 × ride_1938): "same"
    delta < 0: "faster today"
    delta > 0: "slower today"
    """

def find_gaps(trips: list[EligibleTrip], window_start: float, window_end: float) -> tuple[int, int]:
    """
    Find min and max gaps between consecutive departures in time window.
    
    Window: [09:00, 14:00) from boarding stop
    """

def arrival_weighted_wait(gaps: list[float]) -> float | None:
    """
    sum(g² for g in gaps) / (2 × sum(gaps))
    
    Returns None with warning if gaps empty or sum is zero.
    """
```

### 8. route.py

```python
def build_route(
    facts: FactsFile,
    ways: dict[str, list[tuple[float, float]]]
) -> dict[str, list[RouteLeg]]:
    """
    Rebuild 1938 route from OSM ways for each direction.
    
    Returns: {direction: [RouteLeg, ...]}
    """

def build_leg(leg_spec: LegSpec, ways: dict) -> RouteLeg:
    """
    Build one route leg.
    
    Inferred: use points_lonlat from facts
    OSM: join ways in order, handle gaps, clip to endpoints
    """

def orient_way(way: list[tuple], reference: list[tuple]) -> list[tuple]:
    """Flip way if needed so it continues from reference endpoint."""

def clip_line(line: list[tuple], start_point: tuple, end_point: tuple) -> list[tuple]:
    """Extract segment between two points along line."""

def validate_leg_length(actual: float, expected: float) -> None:
    """Check |actual - expected| <= max(1m, 0.5% of expected)."""

def validate_route(legs: list[RouteLeg], timing_points: list[TimingPoint]) -> None:
    """
    - Consecutive legs connect within 1m
    - Each timing point within 30m of route
    """
```

**Error handling**:
- Undeclared break > 1m: fail with street name
- Length mismatch beyond tolerance: fail with actual vs expected
- clip_to before clip_from: fail
- Timing point > 30m from route: fail

### 9. emit.py

```python
def emit_all(
    facts: FactsFile,
    races: dict[tuple[str, str], list[RaceRow]],
    eligible: dict[tuple[str, str], list[EligibleTrip]],
    summary: Summary,
    route: dict[str, list[RouteLeg]],
    clocks: dict[str, dict[str, Clock1938]],
    feed_sha256: str,
    feed_version: str,
    service_date: str,
    output_dir: Path
) -> None:
    """Write all JSON files and validate against schemas."""

def write_index_json(...)  -> Path
def write_summary_json(...) -> Path
def write_race_files(...) -> list[Path]
def write_route_geojson(...) -> Path

def validate_against_schema(json_path: Path, schema_path: Path) -> None:
    """Validate JSON file against schema using jsonschema."""

def check_all_numbers_sourced(json_path: Path) -> None:
    """Verify every numeric field has a source entry."""
```

**Output validation**:
- Each file validated against its JSON schema
- Source check: every number has source entry
- All times stored to 3 decimals
- All distances stored appropriately (walks to 2 decimals)

### 10. display_rounding.py

```python
def round_for_display(parts: list[float]) -> list[int]:
    """
    Largest-remainder method for display rounding.
    
    1. Round total to nearest (halves up): shown_total
    2. Round each part down: floors
    3. shortage = shown_total - sum(floors)
    4. Give one minute to the 'shortage' parts with largest fractions
       (on tie, earlier part gets it)
    
    Returns: List of shown parts that sum to shown_total
    
    Properties:
    - sum(result) == round(sum(parts))
    - All result[i] are whole numbers
    - |result[i] - parts[i]| <= 1 for all i
    - Pure function (same input → same output)
    """
```

This is a pure, standalone function used by emit.py when writing race files.

### 11. fetch_osm.py

```python
def fetch_osm_ways(facts_path: Path, output_path: Path) -> None:
    """
    Fetch OSM way geometries via Overpass API.
    
    1. Extract all way IDs from facts file legs
    2. Query Overpass for those ways
    3. Write to output_path with download date in metadata
    
    This is a one-time command, never run during build.
    """

def query_overpass(way_ids: list[str]) -> dict[str, list[tuple[float, float]]]:
    """Query Overpass API for multiple ways."""

def write_ways_json(ways: dict, download_date: str, output_path: Path) -> None:
    """Write ways with metadata: {download_date, ways: {id: [[lon,lat],...]}}"""
```

### 12. check_sources.py

```python
BANNED_WORDS = ["live", "real-time", "realtime", "arriving now", "right now"]
ALLOWED_PHRASE = "Scheduled, not live."

def check_sources_in_files(paths: list[Path]) -> list[str]:
    """
    Check files for banned words and unsourced numbers.
    
    Returns: List of violations (empty if all pass)
    """

def find_banned_words(text: str) -> list[tuple[str, int]]:
    """Find banned words (respecting ALLOWED_PHRASE exception)."""

def find_unsourced_numbers(json_obj: dict) -> list[str]:
    """Find numeric fields without source entries."""
```

## CLI Design

```python
# cli.py
def main():
    parser = argparse.ArgumentParser(prog="pipeline")
    subparsers = parser.add_subparsers(dest="command")
    
    # fetch_osm: one-time OSM data fetch
    # validate: fast checks, no feed
    # build: full pipeline
    # check: build + pytest
    # verify: rebuild and compare
    # check_sources: banned words and unsourced numbers

def cmd_fetch_osm(args): ...
def cmd_validate(args): ...
def cmd_build(args): ...
def cmd_check(args): ...
def cmd_verify(args): ...
def cmd_check_sources(args): ...
```

## Testing Strategy

### Unit Tests (tests/unit/)
- Each module's functions tested independently
- Use fixtures for GTFS data, facts files
- Mock external dependencies (file I/O, network)

### Property Tests (tests/property/)
- Hypothesis-based tests for all P1-P10 properties
- Generate random inputs within constraints
- Verify invariants hold

### Golden Tests (tests/golden/)
- Test against expected values from race-brief.md
- **On developer machine**: `python -m pipeline check` always runs golden tests; they must pass
- **In CI (GitHub Actions)**: Skip gracefully when raw/ missing, with visible warning message
- **verify command**: Must fail with clear error (not skip) if raw/mta_local_bus.zip is missing
- Any skip must print a visible warning to stdout
- Must pass before any commit touching pipeline/ or data/

### Fixture Data (tests/fixtures/)
- fake-line.yaml: minimal valid facts file
- fake-gtfs/: tiny GTFS feed for edge cases
- All fixtures named "fake" to avoid confusion

## Error Handling Strategy

### Error Types
```python
class PipelineError(Exception):
    """Base exception for pipeline errors."""

class FeedError(PipelineError):
    """Feed missing or hash mismatch."""

class FactsError(PipelineError):
    """Facts file invalid or incomplete."""

class RouteError(PipelineError):
    """Route reconstruction failed."""

class ValidationError(PipelineError):
    """Output validation failed."""
```

### Error Messages
All error messages must be:
- **Clear**: State what went wrong
- **Actionable**: Suggest what to do
- **Specific**: Include relevant values (expected vs actual)

Examples:
```
FeedError: raw/mta_local_bus.zip not found. 
  Place the pinned GTFS feed at this path, or run with --skip-feed for testing.

FeedError: SHA-256 mismatch.
  Expected: 8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694
  Actual:   <different hash>
  The feed file may have been updated. Verify you have the pinned version.

RouteError: Undeclared break in Lanvale Street.
  Gap of 27.3 m between ways 872766197 and 98289609.
  Add "gap" to osm_ways list and specify bridged_gaps_m in facts file.

RouteError: Length mismatch in Bond Street.
  Expected: 225.9 m ± 1.1 m (0.5%)
  Actual:   228.4 m
  OSM way geometry may have changed. Check ways manually.
```

## Performance Considerations

### Caching Strategy
- Cache service-date rows from stop_times.txt under raw/cache/
- Key: service_date + feed SHA-256
- Avoids parsing entire stop_times.txt on every build
- Invalidate cache when feed changes

### Optimization Opportunities
- Parallel race computation (20 pairs × 293 minutes = 5,860 races)
- Vectorized distance calculations (numpy/pandas)
- Lazy loading of GTFS files (only read needed tables)

### Performance Targets
- validate: < 10 seconds (no feed, no network)
- build: < 60 seconds (full pipeline with feed)
- check: < 90 seconds (build + pytest)

## Dependencies

```toml
[project]
name = "pipeline"
version = "0.1.0"
requires-python = ">=3.12"

dependencies = [
    "pandas>=2.0",
    "pyproj>=3.6",
    "PyYAML>=6.0",
    "jsonschema>=4.20",
    "requests>=2.31",  # For Overpass queries
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4",
    "hypothesis>=6.92",
]
```

## File Formats

### data/osm/ways.json
```json
{
  "schema": "ghostline.osm_ways.v1",
  "download_date": "2026-11-15",
  "source": "OpenStreetMap via Overpass API",
  "license": "ODbL",
  "ways": {
    "98040496": [[-76.5952, 39.283463], [-76.595201, 39.283565], ...],
    "424990629": [[...], [...], ...]
  }
}
```

### web/public/data/index.json
```json
{
  "schema": "ghostline.index.v1",
  "line": "no21-1938",
  "mode": "trackless_trolley",
  "effective": "1938-03-06",
  "corners": [
    {
      "slug": "westwood-carey",
      "name": "Westwood & Carey",
      "lonlat": [-76.643563, 39.309495],
      "inferred": false,
      "note": null
    },
    ...
  ],
  "pairs": [
    {"origin": "westwood-carey", "dest": "dolphin-myrtle"},
    ...
  ],
  "service_date": "2026-11-04",
  "feed_version": "20260821",
  "feed_sha256": "8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694",
  "sources": [...]
}
```

See race-brief.md section 4.5 for complete race file format.

## Build Reproducibility

To ensure byte-identical output on repeated builds:

1. **Deterministic ordering**: Sort all arrays by a stable key before output
2. **Fixed precision**: Always format numbers to 3 decimals (or specified precision)
3. **No timestamps**: Except download_date in ways.json (which doesn't change between builds)
4. **No randomness**: No random.choice, no hash() for ordering
5. **Pinned inputs**: Feed SHA-256 locked, OSM ways committed snapshot

Test: Run build twice, compare outputs with `diff` or file hash.

## Development Workflow

1. **Implement module**: Write module with its core functions
2. **Write unit tests**: Test functions in isolation
3. **Write property tests**: Define and test invariants
4. **Write golden tests**: Test against expected values from brief
5. **Integration test**: Run full pipeline, inspect outputs
6. **Verify reproducibility**: Build twice, compare outputs

## Success Criteria (from Requirements)

The design supports all success criteria:
- ✓ Modular structure enables isolated testing
- ✓ Golden tests will verify lead pair values
- ✓ Property tests will verify all P1-P10 invariants
- ✓ Source tracking built into data structures
- ✓ Reproducibility via deterministic pipeline
- ✓ Error handling with clear messages
- ✓ Performance targets achievable with caching
