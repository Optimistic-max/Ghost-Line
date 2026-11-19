"""
Step 10: write the JSON files the site loads, and check them.

All rounding to three decimals happens here and only here (B3). Files are
UTF-8 without a BOM, LF line endings, compact separators and a fixed key order
(B6). Every file is checked against its JSON schema, every source ID must
resolve in the index catalog and every numeric block must be covered by a
source mapping (B16). Raw and gzip sizes are reported; only gzip sizes are limited
(design.md, Decisions 2, B19).
"""

from __future__ import annotations

import functools
import gzip
import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

from jsonschema import Draft202012Validator

from pipeline.clock import Clock1938, ride_minutes
from pipeline.errors import ValidationError
from pipeline.facts import FactsFile
from pipeline.race import PHOTO_FINISH_MIN, SLIDER_FIRST_MIN, SLIDER_LAST_MIN, RaceRow
from pipeline.route import RouteLeg
from pipeline.stops import DEFAULT_STOP_RADIUS_M, Stop
from pipeline.summary import GAP_WINDOW_END, GAP_WINDOW_START, Summary, find_gaps, gaps_in_window

if TYPE_CHECKING:  # annotation only; keeps pandas out of validate
    from pipeline.eligible import EligibleTrip

SCHEMA_DIR = Path(__file__).resolve().parent / "schemas"
DECIMALS = 3

SOURCE_IDS = (
    "guide1938_diagram",
    "guide1938_timetable",
    "guide1938_route",
    "mta_gtfs",
    "osm",
    "method",
)

# Source URLs. One block, copied from the "Source URLs" list in
# .kiro/steering/tech.md. Change them there first. Link only, never fetched.
MTA_GTFS_URL = "https://feeds.mta.maryland.gov/gtfs/local-bus"
OSM_URL = "https://www.openstreetmap.org/copyright"

OSM_SNAPSHOT_DATE = "2026-11-01"

# Size limits (B19, design.md Decisions 2). Every file is limited by gzip size,
# which is what the phone downloads. Raw sizes are reported, not limited.
KB = 1024
GZIP_LIMITS = {
    "index": 10 * KB,
    "summary": 10 * KB,
    "route": 10 * KB,
    "race": 20 * KB,
}
EXTRA_TRIPS_AFTER_LAST = 3  # for the departures board (design.md, Decisions 1)

RACE_DERIVED_IDS = ["guide1938_diagram", "guide1938_timetable", "mta_gtfs", "method"]
SUMMARY_COUNT_KEYS = (
    "races",
    "wins_1938",
    "wins_today",
    "photo_finishes",
    "ride_same",
    "ride_faster_today",
    "ride_slower_today",
    "pairs_without_one_seat_ride",
    "today_wins",
    "pairs",
)
# Blocks of index.json and the catalog IDs that cover them (design: Source Catalog).
INDEX_COVERAGE = {
    "effective": ["guide1938_timetable"],
    "corners": ["guide1938_diagram", "guide1938_route", "osm"],
    "pairs": ["method"],
    "service_date": ["mta_gtfs"],
    "feed_version": ["mta_gtfs"],
    "feed_sha256": ["mta_gtfs"],
}


# --- small helpers -----------------------------------------------------------


def _r(value: float) -> int | float:
    """Round to three decimals. A whole number is stored as an integer to save bytes."""
    rounded = round(float(value), DECIMALS)
    return int(rounded) if rounded == int(rounded) else rounded


def _hhmm(minutes: float) -> str:
    whole = int(minutes // 1)
    return f"{whole // 60:02d}:{whole % 60:02d}"


def _hhmmss(text: str) -> str:
    h, m, s = text.split(":")
    return f"{int(h):02d}:{m}:{s}"


def _page_id(url: str) -> str:
    return url.rstrip("/").rsplit("/", 1)[-1]


def _dump(doc: Any) -> bytes:
    """Compact JSON, fixed key order (insertion order), UTF-8, LF, one final newline."""
    text = json.dumps(doc, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    return (text + "\n").encode("utf-8")


def _write(path: Path, doc: Any) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as fh:  # binary mode: no newline translation, no BOM
        fh.write(_dump(doc))
    return path


def _slugs(facts: FactsFile) -> list[str]:
    return [p.slug for p in facts.timing_points]


# --- index.json --------------------------------------------------------------


def build_source_catalog(facts: FactsFile, feed_sha256: str, feed_version: str, service_date: str) -> dict:
    """The six-entry source catalog (B16), built from the facts file and the feed pin."""
    pages = facts.pages
    return {
        "guide1938_diagram": {
            "label": "1938 route diagram, Digital Maryland",
            "what": "1938 route diagram with minutes between timing points, No. 21 trackless trolley",
            "year": 1938,
            "where": f"Digital Maryland, page id/{_page_id(pages['route_diagram'])}",
            "url": pages["route_diagram"],
        },
        "guide1938_timetable": {
            "label": "1938 timetable, Digital Maryland",
            "what": "1938 timetable for the No. 21 trackless trolley, effective " + facts.effective,
            "year": 1938,
            "where": f"Digital Maryland, page id/{_page_id(pages['timetable'])}",
            "url": pages["timetable"],
        },
        "guide1938_route": {
            "label": "1938 route description, Digital Maryland",
            "what": "1938 written route description for the No. 21 trackless trolley",
            "year": 1938,
            "where": f"Digital Maryland, page id/{_page_id(pages['route_text'])}",
            "url": pages["route_text"],
        },
        "mta_gtfs": {
            "label": "MDOT MTA local bus schedule (GTFS feed)",
            "what": "MDOT MTA local bus GTFS schedule feed, not endorsed by MDOT MTA",
            "year": int(service_date[:4]),
            "where": (
                f"feed_version {feed_version}, SHA-256 {feed_sha256}, "
                f"service date {service_date} (weekday schedule)"
            ),
            "url": MTA_GTFS_URL,
        },
        "osm": {
            "label": "OpenStreetMap contributors",
            "what": "OpenStreetMap contributors, ODbL: street geometry for the 1938 route",
            "year": int(OSM_SNAPSHOT_DATE[:4]),
            "where": f"data/osm/ways.json snapshot of {OSM_SNAPSHOT_DATE}",
            "url": OSM_URL,
        },
        "method": {
            "label": "Ghost Line method",
            "what": (
                f"Ghost Line race method: walk minutes = metres x 1.3 / 1.2 / 60, "
                f"{int(DEFAULT_STOP_RADIUS_M)} m stop radius, photo finish under {PHOTO_FINISH_MIN} minute"
            ),
            "year": None,
            "where": "docs/planning/race-brief.md, section 5",
            "url": None,
        },
    }


def _index_doc(
    facts: FactsFile,
    pairs: list[tuple[str, str]],
    feed_sha256: str,
    feed_version: str,
    service_date: str,
) -> dict:
    return {
        "schema": "ghostline.index.v1",
        "line": facts.line,
        "mode": facts.mode,
        "effective": facts.effective,
        "corners": [
            {
                "slug": p.slug,
                "name": p.name,
                "lonlat": [p.lonlat[0], p.lonlat[1]],
                "inferred": bool(p.inferred),
                "note": p.note,
            }
            for p in facts.timing_points
        ],
        "pairs": [{"origin": o, "dest": d} for o, d in pairs],
        "service_date": service_date,
        "feed_version": feed_version,
        "feed_sha256": feed_sha256,
        "street_order_checked": bool(facts.street_order_checked),
        "sources": build_source_catalog(facts, feed_sha256, feed_version, service_date),
    }


def write_index_json(
    facts: FactsFile,
    pairs: list[tuple[str, str]],
    feed_sha256: str,
    feed_version: str,
    service_date: str,
    output_dir: Path,
) -> Path:
    doc = _index_doc(facts, pairs, feed_sha256, feed_version, service_date)
    return _write(Path(output_dir) / "index.json", doc)


# --- summary.json ------------------------------------------------------------


def _summary_doc(summary: Summary) -> dict:
    doc: dict[str, Any] = {
        "schema": "ghostline.summary.v1",
        "definition": (
            f"Race at each whole minute {_hhmm(SLIDER_FIRST_MIN)}-{_hhmm(SLIDER_LAST_MIN)} "
            f"from the first covered minute; {int(DEFAULT_STOP_RADIUS_M)} m; "
            f"photo finish under {PHOTO_FINISH_MIN} min"
        ),
        "races": summary.races,
        "wins_1938": summary.wins_1938,
        "wins_today": summary.wins_today,
        "photo_finishes": summary.photo_finishes,
        "ride_same": summary.ride_same,
        "ride_faster_today": summary.ride_faster_today,
        "ride_slower_today": summary.ride_slower_today,
        "pairs_without_one_seat_ride": summary.pairs_without_one_seat_ride,
        "today_wins": [
            {"origin": w.origin, "dest": w.dest, "t": w.t, "margin": _r(w.margin)} for w in summary.today_wins
        ],
        "pairs": [
            {
                "origin": p.origin,
                "dest": p.dest,
                "races": p.races,
                "wins_1938": p.wins_1938,
                "wins_today": p.wins_today,
                "photo_finishes": p.photo_finishes,
                "ride_1938": _r(p.ride_1938),
                "ride_today_median": None if p.ride_today_median is None else _r(p.ride_today_median),
                "delta": None if p.delta is None else _r(p.delta),
                "ride_verdict": p.ride_verdict,
            }
            for p in summary.pairs
        ],
        "sources": {k: list(RACE_DERIVED_IDS) for k in SUMMARY_COUNT_KEYS},
    }
    return doc


def write_summary_json(summary: Summary, output_dir: Path) -> Path:
    return _write(Path(output_dir) / "summary.json", _summary_doc(summary))


# --- race files --------------------------------------------------------------


def _stop_ref(stop: Stop) -> dict:
    return {"stop_id": stop.stop_id, "name": stop.name, "walk_m": _r(stop.walk_m), "walk_min": _r(stop.walk_min)}


def _trip_key(trip: EligibleTrip) -> tuple:
    return (trip.trip_id, trip.dep, trip.board_stop.stop_id, trip.alight_stop.stop_id)


def display_route_name(name: str) -> str:
    """The route name as the card shows it (race-screen requirements, R8.5).

    A word made only of capital letters, two or more of them, keeps its first
    letter and lower-cases the rest ("LIME" becomes "Lime"). Other words are
    unchanged ("CityLink" stays). A name of digits only becomes "Route " plus
    the digits ("54" becomes "Route 54"). An empty name raises ValueError.
    """
    text = (name or "").strip()
    if not text:
        raise ValueError("a route name is needed for the display name")
    if text.isdigit():
        return f"Route {text}"
    words = [w.capitalize() if len(w) >= 2 and w.isalpha() and w.isupper() else w for w in text.split()]
    return " ".join(words)


def select_trips(all_trips: list[EligibleTrip], rows: list[RaceRow]) -> list[EligibleTrip]:
    """Trips for today.trips: every trip departing at or after 09:00, through
    the third trip after the last trip any race row uses (or to the end of the
    day if fewer remain). design.md, Decisions 1 as changed by task 35.

    all_trips must be sorted by departure. The result keeps that order, so
    the 0-based index in it is the "i" the race rows point at. No trip is used
    by any row: the list is empty.
    """
    used = {_trip_key(r.today.trip) for r in rows if r.today is not None}
    positions = [i for i, t in enumerate(all_trips) if _trip_key(t) in used]
    if not positions:
        return []
    end = min(positions[-1] + EXTRA_TRIPS_AFTER_LAST, len(all_trips) - 1)
    return [t for t in all_trips[: end + 1] if t.dep >= GAP_WINDOW_START]


def _race_row(row: RaceRow, trip_index: dict[tuple, int]) -> dict:
    out: dict[str, Any] = {
        "t": row.t,
        "start": _hhmm(row.start),
        "before_table": bool(row.before_table),
        "y1938": {"dep": row.y1938.dep, "wait": _r(row.y1938.wait), "total": _r(row.y1938.total)},
    }
    if row.today is None:
        out["today"] = None
    else:
        out["today"] = {
            "trip": trip_index[_trip_key(row.today.trip)],
            "wait": _r(row.today.wait),
            "total": _r(row.today.total),
        }
    out["result"] = row.result
    if row.margin is not None:
        out["margin"] = _r(row.margin)
    return out


def _race_doc(
    facts: FactsFile,
    origin: str,
    dest: str,
    clocks: dict[str, dict[str, Clock1938]],
    trips: list[EligibleTrip],
    rows: list[RaceRow],
    feed_sha256: str,
    feed_version: str,
    service_date: str,
    radius_m: float,
) -> dict:
    slugs = _slugs(facts)
    direction = "eastbound" if slugs.index(origin) < slugs.index(dest) else "westbound"
    clock = clocks[direction][origin]
    points = {p.slug: p for p in facts.timing_points}
    all_trips = sorted(trips, key=lambda t: (t.dep, t.trip_id))
    ordered = select_trips(all_trips, rows)
    trip_index = {_trip_key(t): i for i, t in enumerate(ordered)}
    try:
        pass_gap_min, pass_gap_max = gaps_in_window(clock.passes, GAP_WINDOW_START, GAP_WINDOW_END)
    except ValueError as exc:
        raise ValidationError(f"Race file {origin} -> {dest} needs the 1938 spacing: {exc}") from exc
    try:
        route_displays = [display_route_name(t.route) for t in ordered]
    except ValueError as exc:
        raise ValidationError(f"Race file {origin} -> {dest}: {exc}") from exc
    route_names = list(dict.fromkeys(route_displays))
    if not ordered:
        gap_min = gap_max = None  # allowed only when today.trips is empty
    else:
        try:
            gap_min, gap_max = find_gaps(all_trips, GAP_WINDOW_START, GAP_WINDOW_END)
        except ValueError as exc:
            raise ValidationError(f"Race file {origin} -> {dest} needs gap_min and gap_max: {exc}") from exc

    return {
        "schema": "ghostline.race.v1",
        "line": facts.line,
        "origin": origin,
        "dest": dest,
        "direction": direction,
        "inferred": bool(points[origin].inferred or points[dest].inferred),
        "service_date": service_date,
        "feed_version": feed_version,
        "feed_sha256": feed_sha256,
        "radius_m": _r(radius_m),
        "y1938": {
            "ride_min": _r(ride_minutes(origin, dest, facts)),
            "covered_from": _hhmm(clock.covered_from),
            "passes": [_hhmm(p) for p in clock.passes],
            "gap_min": _r(pass_gap_min),
            "gap_max": _r(pass_gap_max),
            "sources": {"ride_min": facts.pages["route_diagram"], "passes": facts.pages["timetable"]},
        },
        "today": {
            "gap_min": None if gap_min is None else _r(gap_min),
            "gap_max": None if gap_max is None else _r(gap_max),
            "window_from": _hhmm(GAP_WINDOW_START),
            "window_to": _hhmm(GAP_WINDOW_END),
            "route_names": route_names,
            "trips": [
                {
                    "i": i,
                    "trip_id": t.trip_id,
                    "route": t.route,
                    "route_display": display,
                    "headsign": t.headsign,
                    "board": _stop_ref(t.board_stop),
                    "alight": _stop_ref(t.alight_stop),
                    "dep": _hhmmss(t.dep_str),
                    "arr": _hhmmss(t.arr_str),
                    "ride_min": _r(t.ride_min),
                }
                for i, (t, display) in enumerate(zip(ordered, route_displays))
            ],
        },
        "races": [_race_row(r, trip_index) for r in rows],
        "sources": {
            "y1938": ["guide1938_diagram", "guide1938_timetable"],
            "today": ["mta_gtfs", "method"],
            "races": list(RACE_DERIVED_IDS),
            "radius_m": ["method"],
        },
    }


def write_race_files(
    facts: FactsFile,
    clocks: dict[str, dict[str, Clock1938]],
    eligible: dict[tuple[str, str], list[EligibleTrip]],
    races: dict[tuple[str, str], list[RaceRow]],
    feed_sha256: str,
    feed_version: str,
    service_date: str,
    output_dir: Path,
    radius_m: float = DEFAULT_STOP_RADIUS_M,
) -> list[Path]:
    paths = []
    for (origin, dest), rows in races.items():
        doc = _race_doc(
            facts, origin, dest, clocks, eligible[(origin, dest)], rows,
            feed_sha256, feed_version, service_date, radius_m,
        )
        paths.append(_write(Path(output_dir) / "race" / f"{origin}__{dest}.json", doc))
    return paths


# --- route.geojson -----------------------------------------------------------


def _route_doc(route: dict[str, list[RouteLeg]]) -> dict:
    features = []
    for direction in ("westbound", "eastbound"):
        for leg in route.get(direction, []):
            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": [[p[0], p[1]] for p in leg.coordinates]},
                    "properties": {
                        "direction": leg.direction,
                        "street": leg.street,
                        "method": leg.method,
                        "note": leg.note,
                        "length_m": _r(leg.length_m),
                    },
                }
            )
    return {
        "type": "FeatureCollection",
        "features": features,
        "sources": {"features": ["guide1938_route", "osm", "method"]},
    }


def write_route_geojson(route: dict[str, list[RouteLeg]], output_dir: Path) -> Path:
    return _write(Path(output_dir) / "route.geojson", _route_doc(route))


# --- checks ------------------------------------------------------------------


@functools.lru_cache(maxsize=None)
def _validator(schema_path: Path) -> Draft202012Validator:
    """One validator per schema file; building it is the slow part of validating 23 files."""
    with open(schema_path, encoding="utf-8") as fh:
        return Draft202012Validator(json.load(fh))


def validate_against_schema(json_path: Path, schema_path: Path) -> None:
    """Validate one file against its schema. Raises ValidationError listing every problem."""
    with open(json_path, encoding="utf-8") as fh:
        doc = json.load(fh)
    errors = sorted(_validator(Path(schema_path)).iter_errors(doc), key=lambda e: list(e.absolute_path))
    if errors:
        lines = [f"  at {'/'.join(str(p) for p in e.absolute_path) or '(root)'}: {e.message[:200]}" for e in errors[:20]]
        more = f"\n  ... and {len(errors) - 20} more" if len(errors) > 20 else ""
        raise ValidationError(f"{Path(json_path).name} fails {Path(schema_path).name}:\n" + "\n".join(lines) + more)


def _has_number(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return True
    if isinstance(value, dict):
        return any(_has_number(v) for v in value.values())
    if isinstance(value, (list, tuple)):
        return any(_has_number(v) for v in value)
    return False


def check_source_coverage(docs: dict[str, dict]) -> None:
    """B16. docs maps a label to a loaded document; "index" must be present.

    Every ID used by a mapping must resolve in index.sources. Every top-level
    block that holds a number must be covered by a source mapping. Raises
    ValidationError listing all unresolved IDs and uncovered fields.
    """
    problems: list[str] = []
    index = docs.get("index")
    if index is None:
        raise ValidationError("check_source_coverage needs the index document.")
    catalog = set(index.get("sources", {}))
    missing_catalog = [i for i in SOURCE_IDS if i not in catalog]
    if missing_catalog:
        problems.append(f"index.sources lacks catalog entries: {missing_catalog}")

    # index.json: coverage is the fixed table above.
    for key, value in index.items():
        if key in ("schema", "sources") or not _has_number(value):
            continue
        if key not in INDEX_COVERAGE:
            problems.append(f"index: numeric field '{key}' is not covered by a source")
    for key, ids in INDEX_COVERAGE.items():
        for i in ids:
            if i not in catalog:
                problems.append(f"index: field '{key}' uses unresolved source ID '{i}'")

    for label, doc in docs.items():
        if label == "index":
            continue
        mapping = doc.get("sources")
        if not isinstance(mapping, dict):
            problems.append(f"{label}: no top-level sources mapping")
            continue
        for key, ids in mapping.items():
            for i in ids:
                if i not in catalog:
                    problems.append(f"{label}: sources.{key} uses unresolved source ID '{i}'")
        for key, value in doc.items():
            if key in ("schema", "sources") or not _has_number(value):
                continue
            if key not in mapping:
                problems.append(f"{label}: numeric field '{key}' is not covered by a source")
    if problems:
        raise ValidationError("Source check failed:\n  " + "\n  ".join(problems))


def report_sizes(paths: list[Path]) -> list[dict]:
    """Raw and gzip size of each file and whether the gzip size is within its limit."""
    rows = []
    for p in paths:
        data = Path(p).read_bytes()
        kind = _budget_kind(Path(p))
        limit = GZIP_LIMITS[kind]
        gz = len(gzip.compress(data, mtime=0))
        rows.append(
            {
                "path": Path(p),
                "kind": kind,
                "raw": len(data),
                "gzip": gz,
                "gzip_limit": limit,
                "ok": gz <= limit,
            }
        )
    return rows


def _budget_kind(path: Path) -> str:
    if path.name == "index.json":
        return "index"
    if path.name == "summary.json":
        return "summary"
    if path.suffix == ".geojson":
        return "route"
    return "race"


def check_budgets(rows: list[dict]) -> None:
    """Raise ValidationError naming every file over its gzip limit (B19)."""
    over = [r for r in rows if not r["ok"]]
    if over:
        lines = [
            f"{r['path'].name}: {r['gzip']} gzip bytes, limit {r['gzip_limit']} gzip bytes ({r['raw']} raw)"
            for r in over
        ]
        raise ValidationError("Over the gzip size limit:\n  " + "\n  ".join(lines))


def format_size_report(rows: list[dict]) -> str:
    lines = [f"{'file':<48}{'raw':>9}{'gzip':>9}  gzip limit"]
    for r in rows:
        flag = "" if r["ok"] else "  OVER GZIP LIMIT"
        lines.append(f"{r['path'].name:<48}{r['raw']:>9}{r['gzip']:>9}  {r['gzip_limit']}{flag}")
    return "\n".join(lines)


_SCHEMA_FOR = {"index": "index", "summary": "summary", "race": "race", "route": "route"}


# --- everything --------------------------------------------------------------


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
    output_dir: Path,
) -> list[dict]:
    """Write every file, validate it, check sources and sizes. Returns the size rows.

    Files are written first so a failure can be inspected. Any problem raises
    ValidationError.
    """
    output_dir = Path(output_dir)
    pairs = list(races)
    index_path = write_index_json(facts, pairs, feed_sha256, feed_version, service_date, output_dir)
    summary_path = write_summary_json(summary, output_dir)
    race_paths = write_race_files(facts, clocks, eligible, races, feed_sha256, feed_version, service_date, output_dir)
    route_path = write_route_geojson(route, output_dir)

    for path, name in [(index_path, "index"), (summary_path, "summary"), (route_path, "route")] + [
        (p, "race") for p in race_paths
    ]:
        validate_against_schema(path, SCHEMA_DIR / f"{name}.schema.json")

    docs: dict[str, dict] = {"index": _load(index_path), "summary": _load(summary_path), "route": _load(route_path)}
    for p in race_paths:
        docs[f"race/{p.name}"] = _load(p)
    check_source_coverage(docs)

    rows = report_sizes([index_path, summary_path, route_path, *race_paths])
    print(format_size_report(rows))
    check_budgets(rows)
    return rows


def _load(path: Path) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)
