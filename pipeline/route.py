"""
Step 9: rebuild the 1938 route from the facts file and the OSM way snapshot.

Reads only data/lines/no21-1938.yaml (through FactsFile) and the committed
data/osm/ways.json. It never touches the network, the feed or the 1933 file.
Coordinates are [lon, lat]. Lengths are WGS84 geodesic metres at full
precision; rounding happens only in emit.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

from pyproj import Geod

from pipeline.errors import RouteError
from pipeline.facts import GAP, FactsFile, LegSpec, TimingPoint

JOIN_TOLERANCE_M = 1.0
LENGTH_TOLERANCE_M = 1.0
LENGTH_TOLERANCE_FRACTION = 0.005
TIMING_POINT_TOLERANCE_M = 30.0
GAP_MATCH_TOLERANCE_M = 1.0

_GEOD = Geod(ellps="WGS84")

LonLat = tuple[float, float]


@dataclass
class RouteLeg:
    street: str
    direction: str  # "eastbound" or "westbound"; loop legs use "eastbound"
    method: str  # "osm", "osm+gap", "inferred"
    coordinates: list[LonLat]  # [lon, lat]
    length_m: float  # computed geodesic length, full precision
    note: str


def _dist(a: LonLat, b: LonLat) -> float:
    _, _, d = _GEOD.inv(a[0], a[1], b[0], b[1])
    return float(d)


def line_length_m(line: list[LonLat]) -> float:
    """Sum of geodesic distances along a line, in metres."""
    return float(sum(_dist(a, b) for a, b in zip(line, line[1:])))


# --- loading -----------------------------------------------------------------


def listed_way_ids(facts: FactsFile) -> list[int]:
    """Every OSM way id the facts file lists, in first-seen order."""
    seen: dict[int, None] = {}
    for legs in facts.legs.values():
        for leg in legs:
            for w in leg.osm_ways:
                if w != GAP:
                    seen.setdefault(int(w), None)
    return list(seen)


def load_ways(ways_path: Path, facts: FactsFile | None = None) -> dict[str, list[LonLat]]:
    """Read the committed OSM snapshot. Never fetches anything.

    Returns {way id as a string: [(lon, lat), ...]}. When facts is given, raises
    RouteError naming the first way id the facts file lists that the snapshot lacks.
    """
    ways_path = Path(ways_path)
    if not ways_path.is_file():
        raise RouteError(f"OSM snapshot not found: {ways_path}")
    try:
        with open(ways_path, encoding="utf-8") as fh:
            raw = json.load(fh)
    except json.JSONDecodeError as exc:
        raise RouteError(f"OSM snapshot {ways_path} is not valid JSON: {exc}") from exc
    if not isinstance(raw, dict) or not isinstance(raw.get("ways"), dict):
        raise RouteError(f"OSM snapshot {ways_path} has no 'ways' object.")
    ways = {str(k): [(float(p[0]), float(p[1])) for p in v] for k, v in raw["ways"].items()}
    if facts is not None:
        for way_id in listed_way_ids(facts):
            if str(way_id) not in ways:
                raise RouteError(f"Way ID {way_id} listed in facts but not found in {ways_path.as_posix()}.")
    return ways


# --- geometry helpers --------------------------------------------------------


def orient_way(way: list[LonLat], reference: list[LonLat]) -> list[LonLat]:
    """Flip way if its last point is nearer the end of reference than its first."""
    end = reference[-1]
    if _dist(way[-1], end) < _dist(way[0], end):
        return list(reversed(way))
    return list(way)


def _nearest_index(line: list[LonLat], point: LonLat) -> int:
    best_i, best_d = 0, math.inf
    for i, p in enumerate(line):
        d = _dist(p, point)
        if d < best_d:
            best_i, best_d = i, d
    return best_i


def clip_line(line: list[LonLat], start_point: LonLat, end_point: LonLat) -> list[LonLat]:
    """Cut line between the vertex nearest start_point and the vertex nearest end_point.

    Raises RouteError if both map to the same vertex, or if the end vertex lies
    before the start vertex (build_leg reverses the line first, so that cannot
    happen there).
    """
    i = _nearest_index(line, start_point)
    j = _nearest_index(line, end_point)
    if i == j:
        raise RouteError(f"clip_from and clip_to map to the same vertex (index {i}).")
    if j < i:
        raise RouteError("clip_to comes before clip_from along the line.")
    return line[i : j + 1]


def validate_leg_length(actual: float, expected: float, street: str = "") -> None:
    """Check |actual - expected| <= max(1 m, 0.5% of expected)."""
    tolerance = max(LENGTH_TOLERANCE_M, LENGTH_TOLERANCE_FRACTION * expected)
    if abs(actual - expected) > tolerance:
        where = f" in {street}" if street else ""
        raise RouteError(
            f"Length mismatch{where}: built {actual:.1f} m, facts say {expected:.1f} m "
            f"(tolerance {tolerance:.1f} m). OSM way geometry may have changed. Check ways manually."
        )


# --- one leg -----------------------------------------------------------------


def _join_ways(leg: LegSpec, ways: dict[str, list[LonLat]]) -> tuple[list[LonLat], list[float]]:
    """Join a leg's ways in listed order. Returns the line and the bridged gap distances."""
    items = leg.osm_ways
    ids = [w for w in items if w != GAP]
    for w in ids:
        if str(w) not in ways:
            raise RouteError(f"Way ID {w} listed in facts for {leg.street} but not found in data/osm/ways.json.")

    line: list[LonLat] = []
    gaps: list[float] = []
    gap_marked = False
    for pos, item in enumerate(items):
        if item == GAP:
            gap_marked = True
            continue
        seg = list(ways[str(item)])
        if not seg:
            raise RouteError(f"Way ID {item} in {leg.street} has no points.")
        if not line:
            # Orient the first way so its far end is the end nearer the next way.
            next_ids = [w for w in items[pos + 1 :] if w != GAP]
            if next_ids:
                nxt = ways[str(next_ids[0])]
                ends = (nxt[0], nxt[-1])
                d_first = min(_dist(seg[0], e) for e in ends)
                d_last = min(_dist(seg[-1], e) for e in ends)
                if d_first < d_last:
                    seg.reverse()
            elif leg.clip_from_lonlat is not None and _dist(seg[-1], leg.clip_from_lonlat) < _dist(
                seg[0], leg.clip_from_lonlat
            ):
                seg.reverse()
            line = seg
            continue
        seg = orient_way(seg, line)
        d = _dist(line[-1], seg[0])
        if gap_marked:
            gaps.append(d)
            gap_marked = False
        elif d > JOIN_TOLERANCE_M:
            raise RouteError(
                f"Undeclared break in {leg.street}: gap of {d:.1f} m before way {item}. "
                f'Add "gap" to osm_ways and list it in bridged_gaps_m in the facts file.'
            )
        line = line + (seg[1:] if d == 0.0 else seg)

    if len(gaps) != len(leg.bridged_gaps_m):
        raise RouteError(
            f"Bridged gaps in {leg.street}: built {len(gaps)}, facts list {len(leg.bridged_gaps_m)} in bridged_gaps_m."
        )
    for built, declared in zip(gaps, leg.bridged_gaps_m):
        if abs(built - declared) > GAP_MATCH_TOLERANCE_M:
            raise RouteError(
                f"Bridged gap in {leg.street}: built {built:.1f} m, facts say {declared:.1f} m (tolerance 1 m)."
            )
    return line, gaps


def _default_note(leg: LegSpec) -> str:
    if leg.method == "osm+gap":
        return "Drawn from OpenStreetMap ways; a short break between ways is bridged by a straight line."
    return "Drawn from OpenStreetMap way geometry."


def build_leg(leg: LegSpec, ways: dict[str, list[LonLat]], direction: str = "eastbound") -> RouteLeg:
    """Build one route leg (race-brief 5.8, with the B1 clip rule)."""
    if leg.method == "inferred":
        line = list(leg.points_lonlat)
        note = leg.note or ""
    else:
        joined, _gaps = _join_ways(leg, ways)
        i = _nearest_index(joined, leg.clip_from_lonlat)
        j = _nearest_index(joined, leg.clip_to_lonlat)
        if i == j:
            raise RouteError(f"clip_from and clip_to map to the same vertex in {leg.street}.")
        if i > j:
            joined.reverse()
        line = clip_line(joined, leg.clip_from_lonlat, leg.clip_to_lonlat)
        note = leg.note or _default_note(leg)

    length = line_length_m(line)
    validate_leg_length(length, leg.length_m, leg.street)
    return RouteLeg(
        street=leg.street,
        direction=direction,
        method=leg.method,
        coordinates=line,
        length_m=length,
        note=note,
    )


# --- the two lines -----------------------------------------------------------


def validate_route_joins(legs: list[RouteLeg]) -> None:
    """Consecutive legs on one joined line must meet within 1 m."""
    for a, b in zip(legs, legs[1:]):
        d = _dist(a.coordinates[-1], b.coordinates[0])
        if d > JOIN_TOLERANCE_M:
            raise RouteError(f"Legs do not join: {a.street} ends {d:.1f} m from the start of {b.street}.")


def distance_to_line_m(point: LonLat, line: list[LonLat]) -> float:
    """Shortest distance in metres from point to a polyline (local flat approximation)."""

    def local_xy(p: LonLat) -> tuple[float, float]:
        az, _, d = _GEOD.inv(point[0], point[1], p[0], p[1])
        rad = math.radians(az)
        return d * math.sin(rad), d * math.cos(rad)

    pts = [local_xy(p) for p in line]
    if len(pts) == 1:
        return math.hypot(*pts[0])
    best = math.inf
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        dx, dy = bx - ax, by - ay
        seg2 = dx * dx + dy * dy
        t = 0.0 if seg2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / seg2))
        best = min(best, math.hypot(ax + t * dx, ay + t * dy))
    return best


def validate_timing_points(legs: list[RouteLeg], timing_points: list[TimingPoint]) -> None:
    """Every timing point must lie within 30 m of the joined line."""
    line = [p for leg in legs for p in leg.coordinates]
    for tp in timing_points:
        d = distance_to_line_m(tp.lonlat, line)
        if d > TIMING_POINT_TOLERANCE_M:
            raise RouteError(f"Timing point {tp.name} is {d:.1f} m from the route (limit 30 m).")


def build_route(facts: FactsFile, ways: dict[str, list[LonLat]]) -> dict[str, list[RouteLeg]]:
    """Rebuild the route as two joined lines.

    "westbound": the westbound legs. "eastbound": the loop legs then the
    eastbound legs. Loop legs carry direction "eastbound".
    """
    westbound = [build_leg(leg, ways, "westbound") for leg in facts.legs["westbound"]]
    eastbound = [build_leg(leg, ways, "eastbound") for leg in facts.legs.get("loop", [])]
    eastbound += [build_leg(leg, ways, "eastbound") for leg in facts.legs["eastbound"]]
    route = {"westbound": westbound, "eastbound": eastbound}
    for legs in route.values():
        validate_route_joins(legs)
        validate_timing_points(legs, facts.timing_points)
    return route
