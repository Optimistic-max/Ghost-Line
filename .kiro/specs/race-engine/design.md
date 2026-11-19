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
├── cli.py               # Command dispatcher (validate, build, check, verify, check_sources)
├── feed_check.py        # Step 1: SHA-256 validation
├── facts.py             # Step 2: Load and validate facts file
├── clock.py             # Step 3: Generate 1938 clock
├── stops.py             # Step 4: Find stops within radius, compute walks
├── eligible.py          # Step 5: Find one-seat trips per pair
├── race.py              # Step 6: Run all races
├── summary.py           # Step 7: Per-pair verdicts and totals
├── route.py             # Step 8: Rebuild route from OSM ways snapshot
├── emit.py              # Step 9: Write and validate JSON files; all rounding here
├── check_sources.py     # Source checking utility
└── schemas/             # JSON Schema files for validation
    ├── index.schema.json
    ├── summary.schema.json
    ├── race.schema.json
    └── route.schema.json
```

**Removed modules (B7, B10)**: display_rounding.py belongs in the race-screen spec. fetch_osm.py is not part of the pipeline build; the data/osm/ways.json snapshot is committed.

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
                                                         emit   ← rounding only here (B3)
                                                           │
                                                           v
                                              web/public/data/*.json
```

## Precision Rule (B3)

facts, clock, stops, eligible, race and summary all keep full floating-point precision. emit is the only place where numbers are rounded before writing:
- Durations and walk minutes → 3 decimals
- Walk metres → 2 decimals
- gap_min / gap_max → 3 decimals

No dataclass carries a precision comment. No intermediate module rounds its output.

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
    passes: list[float]            # Minutes after midnight (40 times), full precision
    covered_from: float            # First pass time, full precision
```

### Stop
```python
@dataclass
class Stop:
    stop_id: str
    name: str
    lonlat: tuple[float, float]
    walk_m: float                  # Full precision internally; rounded to 2 decimals at emit
    walk_min: float                # Full precision internally; rounded to 3 decimals at emit
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
    dep: float                     # Minutes after midnight, full precision internally
    arr: float                     # Minutes after midnight, full precision internally
    dep_str: str                   # HH:MM:SS for output (B8)
    arr_str: str                   # HH:MM:SS for output (B8)
    ride_min: float                # arr - dep, full precision
    access_min: float              # board_stop.walk_min, full precision
    egress_min: float              # alight_stop.walk_min, full precision
```

### RaceRow (B7, B8)
```python
@dataclass
class RaceRow:
    t: str                         # Slider time "HH:MM"
    start: float                   # Actual start time (minutes after midnight, full precision)
    before_table: bool = False
    y1938: Race1938
    today: RaceToday | None        # None (null in JSON) when result is no_one_seat_ride, as in the brief
    result: str                    # "1938", "today", "photo_finish", "no_one_seat_ride"
    margin: float | None           # Absolute difference in minutes, full precision

@dataclass
class Race1938:
    dep: str                       # "HH:MM"
    wait: float                    # Full precision; rounded to 3 decimals at emit
    ride: float                    # Full precision
    total: float                   # Full precision; rounded to 3 decimals at emit

@dataclass
class RaceToday:
    trip: int                      # Index into trips array
    access: float                  # Full precision; rounded to 3 decimals at emit
    wait: float                    # Full precision; rounded to 3 decimals at emit
    ride: float                    # Full precision; rounded to 3 decimals at emit
    egress: float                  # Full precision; rounded to 3 decimals at emit
    total: float                   # Full precision; rounded to 3 decimals at emit
```

No *_exact fields. No display-only fields. Stored output fields are t, start, before_table, y1938, today, result, margin. (B7)

### RouteLeg (B2)
```python
@dataclass
class RouteLeg:
    street: str
    direction: str                 # "eastbound" or "westbound" (loop legs use "eastbound")
    method: str                    # "osm", "osm+gap", "inferred"
    coordinates: list[tuple[float, float]]  # [lon, lat] points
    length_m: float
    note: str                      # Required; describes the leg (B2)
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

### 2. facts.py (B4)

```python
def load_facts(facts_path: Path) -> FactsFile:
    """
    Load and validate facts file schema.
    
    Returns: Parsed facts with validated structure
    Raises: FactsError if schema invalid or required fields missing
    """
    
def slugify(name: str) -> str:
    """
    One slug function: lowercase, replace ' & ' with '-', then spaces with '-'.
    
    Test cases: all five real corner names produce their expected slugs.
    """

@dataclass
class FactsFile:
    line: str
    mode: str
    effective: str
    timing_points: list[TimingPoint]
    midday_departures: dict[str, DeparturePattern]  # Read from facts, not hard-coded
    legs: dict[str, list[LegSpec]]
    source: str
    pages: dict[str, str]
```

**Validation rules (B4)**:
- At least two timing points present
- First point has minutes_from_prev = 0; all subsequent values are positive whole minutes
- Both directions have minutes_past_hour, first and last
- Each leg has street, method and length_m
- Each leg has either osm_ways with clip points or points_lonlat with a note

### 3. clock.py (B4)

```python
def build_clock(facts: FactsFile) -> dict[str, dict[str, Clock1938]]:
    """
    Generate 1938 clock for each corner and direction.
    Reads pattern, first, last and timing minutes from facts (not hard-coded).
    
    Returns: {direction: {corner_slug: Clock1938}}
    """

def terminal_departures(pattern: list[int], first: float, last: float) -> list[float]:
    """Generate terminal departure times from facts-sourced pattern/first/last."""
    
def compute_offset(direction: str, corner_index: int, minutes: list[int]) -> int:
    """Compute minutes from terminal to corner using cumulative timing minutes."""
    
def next_1938(clock: Clock1938, t: float) -> dict:
    """
    Find next 1938 departure at or after time t.
    
    Returns: {start, dep, wait, before_table}
    All values full precision; rounded only at emit.
    """
```

**Terminal check**: `build_clock` raises `FactsError` if a direction's `from` corner is not that direction's terminal (first timing point eastbound, last westbound).

**Key algorithms**:
- Terminal departures: every hh:mm satisfying first <= hh:mm <= last and mm in pattern
- Offsets: cumulative sum of timing minutes in direction of travel (read from facts)
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
    All walk values kept at full precision.
    """

def geodesic_distance(lonlat1: tuple, lonlat2: tuple) -> float:
    """WGS84 geodesic distance in metres using pyproj."""
    
def compute_walk_time(distance_m: float) -> float:
    """Walk minutes = metres × 1.3 ÷ 1.2 ÷ 60. Full precision; emit rounds to 3 decimals."""
```

**Implementation**:
- Use pyproj.Geod(ellps="WGS84").inv() for distances
- Keep full precision internally; emit rounds walk_m to 2 decimals and walk_min to 3 decimals
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
    All walk/ride/access/egress values kept at full precision.
    """

def parse_gtfs_time(time_str: str) -> float:
    """Parse GTFS HH:MM:SS time to minutes after midnight (handles hours >= 24)."""
```

**Edge cases**:
- Trip reaches dest before origin: skip
- Multiple valid stop pairs on one trip: use shortest walks
- Service exception type 2 on date: exclude those trips
- Empty eligible list → NO_ONE_SEAT_RIDE result (B9)
- Trips exist but none catchable → NO_MORE_TRIPS_TODAY (internal sentinel; raises PipelineError naming pair and time if encountered on real data) (B9)

### 6. race.py (B9)

```python
NO_ONE_SEAT_RIDE = "no_one_seat_ride"
NO_MORE_TRIPS_TODAY = "no_more_trips_today"   # Internal sentinel only

def run_all_races(
    pairs: list[tuple[str, str]],
    clocks: dict[str, dict[str, Clock1938]],
    eligible: dict[tuple[str, str], list[EligibleTrip]],
    facts: FactsFile
) -> dict[tuple[str, str], list[RaceRow]]:
    """
    Run races for all pairs at all slider times 09:00 to 13:52 (293 minutes).
    Pre-coverage rows (t < covered_from) repeat the covered_from race result.
    Returns: {(origin, dest): [RaceRow, ...]}
    All values full precision.
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
    
    1. If trips list is empty: return NO_ONE_SEAT_RIDE
    2. Filter catchable trips: dep >= start + access_min
    3. If no catchable trips: return NO_MORE_TRIPS_TODAY
    4. Best trip = the one with smallest (arr + egress_min)
       On tie: earlier departure
    
    Unit tests must cover:
    - Empty trips list → NO_ONE_SEAT_RIDE
    - Trips exist but none catchable → NO_MORE_TRIPS_TODAY
    If NO_MORE_TRIPS_TODAY appears on real data, raise PipelineError naming the pair and time.
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

### 7. summary.py

```python
def compute_summary(
    races: dict[tuple[str, str], list[RaceRow]],
    eligible: dict[tuple[str, str], list[EligibleTrip]],
    facts: FactsFile
) -> Summary:
    """
    Compute per-pair verdicts and overall totals.
    Count only rows where t >= covered_from (B12).
    All values full precision; gap_min/gap_max typed as numbers, rounded at emit.
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
    ride_today_median: float | None   # None when there is no one-seat ride today
    delta: float | None               # ride_today_median - ride_1938; None when median is None
    ride_verdict: str | None          # "same", "faster today", "slower today"; None when delta is None
    gap_min: float | None             # None with fewer than two departures; full precision, rounded to 3 decimals at emit (B14)
    gap_max: float | None             # None with fewer than two departures; full precision, rounded to 3 decimals at emit (B14)

@dataclass
class TodayWin:
    """One counted race minute where today wins (result == "today")."""
    origin: str
    dest: str
    t: str                         # slider time "HH:MM"
    margin: float                  # minutes, absolute, full precision; rounded at emit

def ride_verdict(delta: float, ride_1938: float) -> str:
    """
    |delta| <= max(1.5, 0.15 × ride_1938): "same"
    delta < 0: "faster today"
    delta > 0: "slower today"
    """

def find_gaps(trips: list[EligibleTrip], window_start: float, window_end: float) -> tuple[float, float]:
    """
    Find min and max gaps between adjacent sorted departures in time window.
    Window: [09:00, 14:00) from boarding stop. (B14)
    Raises ValueError when fewer than two departures fall in the window;
    compute_summary catches it and stores None for gap_min and gap_max.
    Returns floats at full precision; emit rounds to 3 decimals.
    """

def arrival_weighted_wait(gaps: list[float]) -> float | None:
    """
    sum(g² for g in gaps) / (2 × sum(gaps))
    
    Returns None with warning if gaps empty or sum is zero.
    """
```

### 8. route.py (B1, B2, B10, B11)

```python
def load_ways(ways_path: Path) -> dict[str, list[tuple[float, float]]]:
    """
    Read the committed data/osm/ways.json snapshot. Never fetches network.
    Raises named RouteError if any way ID listed in facts is missing.
    """

def build_route(
    facts: FactsFile,
    ways: dict[str, list[tuple[float, float]]]
) -> dict[str, list[RouteLeg]]:
    """
    Rebuild 1938 route from OSM ways.
    Reads only no21-1938.yaml and data/osm/ways.json (B11).
    Westbound legs form one joined line.
    Loop + eastbound legs form the other joined line. (B2)
    Returns: {direction: [RouteLeg, ...]}
    """

def build_leg(leg_spec: LegSpec, ways: dict) -> RouteLeg:
    """
    Build one route leg.
    
    Inferred: use points_lonlat from facts.
    OSM legs (B1):
      1. Join ways in listed order, orienting each to continue the preceding way.
      2. Locate vertex nearest clip_from and vertex nearest clip_to on the joined line.
      3. If those two vertices appear in reversed order along the line, reverse the entire line.
      4. If clip_from and clip_to map to the same vertex, raise RouteError.
      5. Clip between the clip_from and clip_to vertices.
    Loop legs use direction = "eastbound".
    Each leg output requires direction, street, method, note and length_m. (B2)
    """

def orient_way(way: list[tuple], reference: list[tuple]) -> list[tuple]:
    """Flip way if needed so it continues from the end of the reference segment."""

def clip_line(line: list[tuple], start_point: tuple, end_point: tuple) -> list[tuple]:
    """
    Extract segment between two points along line.
    Raises RouteError if start and end map to the same vertex (B1).
    """

def validate_leg_length(actual: float, expected: float) -> None:
    """Check |actual - expected| <= max(1m, 0.5% of expected)."""

def validate_route_joins(legs: list[RouteLeg]) -> None:
    """Verify consecutive legs on the same joined line connect within 1m. (B2)"""

def validate_timing_points(legs: list[RouteLeg], timing_points: list[TimingPoint]) -> None:
    """Verify each timing point is within 30m of its joined line. (B2)"""
```

**Error handling**:
- Undeclared break > 1m: raise RouteError with street name
- Length mismatch beyond tolerance: raise RouteError with actual vs expected
- Equal clip_from/clip_to vertex: raise RouteError (B1)
- Missing way ID: raise named RouteError (B10)
- Timing point > 30m from route: raise RouteError

### 9. emit.py (B3, B6, B7, B8, B16, B19)

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
    """
    Write all JSON files and validate against schemas.
    All rounding happens here and only here (B3).
    Files written as UTF-8 without BOM, LF, compact separators, fixed key order (B6).
    Reports raw and gzip size for each file; fails on the budgets in Decision 2 (B19).
    """

def write_index_json(...)  -> Path
def write_summary_json(...) -> Path
def write_race_files(...) -> list[Path]
def write_route_geojson(...) -> Path

def validate_against_schema(json_path: Path, schema_path: Path) -> None:
    """Validate JSON file against schema using jsonschema."""

def check_source_coverage(output_dir: Path) -> None:
    """
    Verify every numeric field in every output file is covered by its sources mapping.
    Verify all source IDs resolve to entries in index.sources.
    Raise ValidationError listing unresolved IDs or uncovered numeric fields. (B16)
    """

def report_sizes(output_dir: Path) -> None:
    """
    Report raw and gzip size for each generated file.
    Fail build if any file exceeds its gzip limit (B19, Decision 2).
    Raw sizes are reported only; they are not limits.
    """
```

**Output rules**:
- Each file validated against its JSON schema
- Source coverage check: every numeric field has a source entry; all IDs resolve
- Rounding applied here only: durations/walk minutes to 3 decimals, walk metres to 2 decimals, gap_min/gap_max to 3 decimals
- Slider and 1938 clock times → HH:MM strings; GTFS dep/arr → HH:MM:SS strings (B8)
- Stored race row fields: t, start, before_table, y1938, today, result, margin; no *_exact fields (B7)
- 293 rows per race file, 09:00–13:52; pre-coverage rows repeat covered_from race (B12)

### 10. check_sources.py (B5)

```python
BANNED_TERMS = ["live", "real-time", "realtime", "arriving now", "right now"]
ALLOWED_PHRASE = "Scheduled, not live."
PROSE_PATHS = ["web/index.html", "web/src/**", "docs/*.md", "README.md"]
PROSE_EXCLUDES = ["docs/planning", "node_modules", "dist", "web/public/data"]

def check_prose(paths: list[Path]) -> list[str]:
    """
    Scan prose files for banned terms.
    Match case-insensitively as whole words/phrases.
    Allow the exact phrase "Scheduled, not live."
    Test that deliver, olive and lives are not flagged.
    Returns: List of violations (empty if clean)
    """

def check_json_sources(paths: list[Path]) -> list[str]:
    """
    Validate generated JSON source mappings.
    Every source ID must resolve; every numeric field must be covered.
    Returns: List of violations (empty if clean)
    """
```

**Separation**: Prose checks (banned terms) and JSON checks (source IDs) are distinct operations. The command runs both. (B5)

## CLI Design (B10)

```python
# cli.py
def main():
    parser = argparse.ArgumentParser(prog="pipeline")
    subparsers = parser.add_subparsers(dest="command")
    
    # Five commands only (fetch_osm removed) (B10):
    # validate: fast checks, no feed, checks all existing generated JSON against schemas (B21)
    # build: full pipeline
    # check: build + pytest
    # verify: rebuild and compare byte-for-byte; bypasses cache (B23)
    # check_sources: prose banned terms + JSON source validation

def cmd_validate(args): ...
def cmd_build(args): ...
def cmd_check(args): ...
def cmd_verify(args): ...
def cmd_check_sources(args): ...
```

**Removed**: fetch_osm command and handler. The OSM snapshot is supplied separately and committed. (B10, B13)

## Source Catalog Design (B16)

index.sources is the catalog object keyed by six IDs:
- guide1938_diagram
- guide1938_timetable
- guide1938_route
- mta_gtfs
- osm
- method

Each catalog entry requires: what, year, where, url (year and url may be null for a documented method).

Other output files carry a top-level sources object mapping field blocks to arrays of catalog IDs:
- race.json: y1938 → [guide1938_diagram, guide1938_timetable]; today → [mta_gtfs, method]; races → [guide1938_diagram, guide1938_timetable, mta_gtfs, method]; radius_m → [method]
- summary.json: numeric counts and today_wins → race inputs and method
- route.geojson: features → [guide1938_route, osm, method]
- index.json: corners → [guide1938_diagram, guide1938_route, osm]

ID arrays must be non-empty and drawn only from the six catalog IDs. All six catalog entries are required. (B16)

## Testing Strategy

### Unit Tests (tests/unit/)
- Each module's functions tested independently
- Use fixtures for GTFS data, facts files
- Mock external dependencies (file I/O, network)

### Property Tests (tests/property/)
- Hypothesis-based tests for all P1-P7, P9-P10 properties
- Generate random inputs within constraints
- Verify invariants hold

### Golden Tests (tests/golden/)
- Test against expected values from race-brief.md sections 5.1–5.8 (B15)
- Section 5.9 (display rounding) moves to race-screen spec (B15)
- **On developer machine**: `python -m pipeline check` always runs golden tests; they must pass
- **In CI (GitHub Actions)**: Skip gracefully when raw/ missing, with visible warning message
- **verify command**: Must fail with clear error (not skip) if raw/mta_local_bus.zip is missing
- Any skip must print a visible warning to stdout
- Must pass before any commit touching pipeline/ or data/

### requires_feed Marker (B20)
- Applies only to tests that actually read the pinned zip, including full-build integration
- Clock 5.1, formula 5.7 and route 5.8 tests run without requires_feed

### Fixture Data (tests/fixtures/)
- fake-line.yaml: minimal valid facts file
- fake-gtfs/: tiny GTFS feed for edge cases; includes one row with blank arrival_time and departure_time, which must be ignored with a logged message (B22)
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

If NO_MORE_TRIPS_TODAY is encountered on real data, raise PipelineError naming the pair and the time. (B9)

### Error Messages
All error messages must be:
- **Clear**: State what went wrong
- **Actionable**: Suggest what to do
- **Specific**: Include relevant values (expected vs actual)

Examples:
```
FeedError: raw/mta_local_bus.zip not found. 
  Place the pinned GTFS feed at this path.

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

RouteError: clip_from and clip_to map to the same vertex in Preston Street.

RouteError: Way ID 123456789 listed in facts but not found in data/osm/ways.json.
```

## Performance Considerations

### Caching Strategy (B23)
- Cache service-date rows from stop_times.txt under raw/cache/
- Key: first 12 characters of feed SHA-256 + "_" + service_date
- Avoids parsing entire stop_times.txt on every build
- Invalidate cache when feed changes
- verify command bypasses cache to ensure fresh rebuild

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
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4",
    "hypothesis>=6.92",
]
```

requests removed (B10). display_rounding removed from pipeline (B7).

## File Formats

### data/osm/ways.json (committed snapshot, never fetched during build)
```json
{
  "schema": "ghostline.osm_ways.v1",
  "download_date": "2026-11-01",
  "source": "OpenStreetMap via Overpass API",
  "license": "ODbL",
  "ways": {
    "98040496": [[-76.5952, 39.283463], [-76.595201, 39.283565], ...],
    "424990629": [[...], [...], ...]
  }
}
```

### web/public/data/index.json (B16)
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
    }
  ],
  "pairs": [
    {"origin": "westwood-carey", "dest": "dolphin-myrtle"}
  ],
  "service_date": "2026-11-04",
  "feed_version": "20260821",
  "feed_sha256": "8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694",
  "sources": {
    "guide1938_diagram": {"what": "...", "year": 1938, "where": "...", "url": "..."},
    "guide1938_timetable": {"what": "...", "year": 1938, "where": "...", "url": "..."},
    "guide1938_route": {"what": "...", "year": 1938, "where": "...", "url": "..."},
    "mta_gtfs": {"what": "...", "year": 2026, "where": "...", "url": "..."},
    "osm": {"what": "...", "year": null, "where": "...", "url": "..."},
    "method": {"what": "...", "year": null, "where": "...", "url": null}
  }
}
```

See race-brief.md section 4.5 for complete race file format.

### inferred flag (B18)
inferred is true exactly when either endpoint of the pair is brevard-preston. All eight race files involving brevard-preston carry inferred = true; the lead pair and all other files carry inferred = false.

## Build Reproducibility

To ensure byte-identical output on repeated builds:

1. **Deterministic ordering**: Sort all arrays by a stable key before output
2. **Fixed precision**: Round numbers only in emit, to specified decimals
3. **Fixed output format**: UTF-8 without BOM, LF, compact separators, fixed key order (B6)
4. **No timestamps**: Except download_date in ways.json (which doesn't change between builds)
5. **No randomness**: No random.choice, no hash() for ordering
6. **Pinned inputs**: Feed SHA-256 locked, OSM ways committed snapshot

Test: Run build twice, compare outputs byte-for-byte.

## Development Workflow

1. **Implement module**: Write module with its core functions
2. **Write unit tests**: Test functions in isolation
3. **Write property tests**: Define and test invariants
4. **Write golden tests**: Test against expected values from brief
5. **Integration test**: Run full pipeline, inspect outputs
6. **Verify reproducibility**: Build twice, compare outputs

## Decisions (Emmanuel, 2026-11-17)

1. **today.trips.** *Superseded by Decision 6 (task 35).* Was: every trip referenced by any of the 293 race rows, plus the next 3 after the last one. `i` is not a golden value; the race-brief 4.5 example index does not apply.
2. **Size limits.** Every output file is limited by gzip size, which is what the phone downloads. Raw sizes are reported but are not limits. Gzip limits: race files 20 KB each; index.json, summary.json and route.geojson 10 KB each. All per-file raw limits (including the 45 KB race limit) are removed. No compaction of race files. A test reports raw and gzip sizes and fails only over a gzip limit.
3. **summary.json per-pair section.** summary.schema.json gains `pairs`: one entry per directed pair with origin, dest, races, wins_1938, wins_today, photo_finishes, ride_1938, ride_today_median, delta and ride_verdict (the last three null when there is no one-seat ride). It is emitted from PairSummary and covered by the race-derived source IDs.
4. **Gap nulls.** today.gap_min and today.gap_max may be null only when today.trips is empty. With trips present but fewer than two departures in the window, emit raises ValidationError.
5. **PairSummary.delta** is in the field list in section 7.
6. **today.trips (task 35).** Every eligible trip departing the boarding stop at or after 09:00, in departure order, through the third trip after the last trip any race row uses (or to the end of the day if fewer remain). `i` is the 0-based index in that list. The bus gaps are still computed from all eligible trips in [09:00, 14:00); `gap_min` and `gap_max` are null only when the list is empty.
7. **Source labels (task 35).** Every entry of the index.json source catalog has a `label`, for example "1938 route diagram, Digital Maryland". The walk formula text stays only in the method entry's `what`.
8. **1938 spacing, window and route names (task 35).** `y1938.gap_min` and `y1938.gap_max` (smallest and largest gap between consecutive 1938 passes at the origin corner in [09:00, 14:00)); `today.window_from` and `today.window_to` ("09:00", "14:00"); `route_display` on each trip and `today.route_names` (distinct display names, first-seen order). Display rule: all-capital words of two or more letters become capitalised ("LIME" to "Lime"); digit-only names become "Route 54".
9. **Checked-by-hand flag (task 35).** index.json has one boolean `street_order_checked`, the 1938 facts file's own flag. The 1933 file is not read by the pipeline.

## Pending Items
- Supply the committed 2026-11-01 data/osm/ways.json snapshot (B10)
- .gitattributes LF enforcement (Prompt 3) (B6)
- Window-average method: brief corrections remain open
- Future reader test for blank stop_times rows (B22)

## Success Criteria (from Requirements)

The design supports all success criteria:
- Modular structure enables isolated testing
- Golden tests will verify lead pair values (15 min vs 45.156, wait 30.458)
- Property tests will verify all P1-P7, P9-P10 invariants
- Source tracking built into data structures
- Reproducibility via deterministic pipeline and fixed output format
- Error handling with clear messages
- Performance targets achievable with caching
