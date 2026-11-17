"""
Step 2: load and validate the hand-entered facts file.

Everything the later steps need (timing minutes, departure patterns, first and
last cars, leg specs) is read from the facts file. Nothing is hard-coded here.
Coordinates are [lon, lat]. Values keep full precision; nothing is rounded.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from pipeline.errors import FactsError

DIRECTIONS = ("eastbound", "westbound")
LEG_DIRECTIONS = ("westbound", "loop", "eastbound")
LEG_METHODS = ("osm", "osm+gap", "inferred")
GAP = "gap"

_HHMM = re.compile(r"^(\d{1,2}):(\d{2})$")


def slugify(name: str) -> str:
    """Lowercase, replace " & " with "-", then spaces with "-"."""
    return name.lower().replace(" & ", "-").replace(" ", "-")


@dataclass
class TimingPoint:
    name: str
    slug: str
    lonlat: tuple[float, float]  # [lon, lat]
    minutes_from_prev: int  # 0 for the first point
    source: str
    inferred: bool = False
    note: str | None = None


@dataclass
class DeparturePattern:
    from_name: str
    from_slug: str
    minutes_past_hour: list[int]
    first: str  # "HH:MM"
    last: str  # "HH:MM"
    first_min: float  # minutes after midnight
    last_min: float
    source: str | None = None


@dataclass
class LegSpec:
    street: str
    method: str
    length_m: float
    osm_ways: list[int | str] = field(default_factory=list)  # ints, or "gap"
    clip_from_lonlat: tuple[float, float] | None = None
    clip_to_lonlat: tuple[float, float] | None = None
    points_lonlat: list[tuple[float, float]] = field(default_factory=list)
    bridged_gaps_m: list[float] = field(default_factory=list)
    note: str | None = None


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


# --- helpers -----------------------------------------------------------------


def _missing(path: str) -> FactsError:
    return FactsError(f"Facts file: required field '{path}' is missing or empty.")


def _bad(path: str, why: str) -> FactsError:
    return FactsError(f"Facts file: field '{path}' is invalid: {why}.")


def _require(mapping: Any, key: str, path: str) -> Any:
    if not isinstance(mapping, dict) or key not in mapping or mapping[key] in (None, "", [], {}):
        raise _missing(f"{path}.{key}" if path else key)
    return mapping[key]


def _is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _parse_lonlat(value: Any, path: str) -> tuple[float, float]:
    """Parse a [lon, lat] pair."""
    if not isinstance(value, (list, tuple)) or len(value) != 2 or not all(_is_number(x) for x in value):
        raise _bad(path, "expected [lon, lat] with two numbers")
    lon, lat = float(value[0]), float(value[1])
    if not -180.0 <= lon <= 180.0 or not -90.0 <= lat <= 90.0:
        raise _bad(path, f"[lon, lat] out of range: [{lon}, {lat}] (is it [lat, lon]?)")
    return (lon, lat)


def _parse_hhmm(value: Any, path: str) -> float:
    if not isinstance(value, str):
        raise _bad(path, 'expected a quoted "HH:MM" string')
    m = _HHMM.match(value)
    if not m or int(m.group(2)) > 59:
        raise _bad(path, f'expected "HH:MM", got {value!r}')
    return float(int(m.group(1)) * 60 + int(m.group(2)))


# --- sections ----------------------------------------------------------------


def _parse_timing_points(raw: Any) -> list[TimingPoint]:
    if not isinstance(raw, list) or len(raw) < 2:
        raise FactsError("Facts file: 'timing_points' needs at least two timing points.")
    points: list[TimingPoint] = []
    for i, item in enumerate(raw):
        p = f"timing_points[{i}]"
        name = _require(item, "name", p)
        if not isinstance(name, str):
            raise _bad(f"{p}.name", "expected a string")
        if not isinstance(item, dict) or "minutes" not in item or item["minutes"] is None:
            raise _missing(f"{p}.minutes")
        minutes = item["minutes"]
        if isinstance(minutes, bool) or not isinstance(minutes, int):
            raise _bad(f"{p}.minutes", f"expected a whole number, got {minutes!r}")
        if i == 0 and minutes != 0:
            raise _bad(f"{p}.minutes", f"the first timing point must have 0, got {minutes}")
        if i > 0 and minutes <= 0:
            raise _bad(f"{p}.minutes", f"later timing points need a positive whole number, got {minutes}")
        lonlat = _parse_lonlat(_require(item, "lonlat", p), f"{p}.lonlat")
        source = _require(item, "source", p)
        slug = slugify(name)
        if "slug" in item and item["slug"] != slug:
            raise _bad(f"{p}.slug", f"{item['slug']!r} does not match slugify({name!r}) = {slug!r}")
        points.append(
            TimingPoint(
                name=name,
                slug=slug,
                lonlat=lonlat,
                minutes_from_prev=minutes,
                source=str(source),
                inferred=bool(item.get("inferred", False)),
                note=item.get("note"),
            )
        )
    slugs = [p.slug for p in points]
    if len(set(slugs)) != len(slugs):
        raise FactsError("Facts file: 'timing_points' has duplicate corner names.")
    return points


def _parse_departures(raw: Any) -> dict[str, DeparturePattern]:
    if not isinstance(raw, dict):
        raise _missing("midday_departures")
    out: dict[str, DeparturePattern] = {}
    for direction in DIRECTIONS:
        p = f"midday_departures.{direction}"
        d = _require(raw, direction, "midday_departures")
        mph = _require(d, "minutes_past_hour", p)
        if (
            not isinstance(mph, list)
            or not all(isinstance(m, int) and not isinstance(m, bool) and 0 <= m <= 59 for m in mph)
            or list(mph) != sorted(set(mph))
        ):
            raise _bad(f"{p}.minutes_past_hour", "expected an ascending list of whole minutes 0 to 59")
        first = _require(d, "first", p)
        last = _require(d, "last", p)
        first_min = _parse_hhmm(first, f"{p}.first")
        last_min = _parse_hhmm(last, f"{p}.last")
        if first_min > last_min:
            raise _bad(f"{p}.first", f"first {first} is after last {last}")
        from_name = _require(d, "from", p)
        out[direction] = DeparturePattern(
            from_name=str(from_name),
            from_slug=slugify(str(from_name)),
            minutes_past_hour=[int(m) for m in mph],
            first=first,
            last=last,
            first_min=first_min,
            last_min=last_min,
            source=d.get("source"),
        )
    return out


def _parse_leg(item: Any, path: str) -> LegSpec:
    street = _require(item, "street", path)
    method = _require(item, "method", path)
    if method not in LEG_METHODS:
        raise _bad(f"{path}.method", f"expected one of {LEG_METHODS}, got {method!r}")
    if not isinstance(item, dict) or "length_m" not in item or item["length_m"] is None:
        raise _missing(f"{path}.length_m")
    length_m = item["length_m"]
    if not _is_number(length_m) or length_m < 0:
        raise _bad(f"{path}.length_m", f"expected a non-negative number, got {length_m!r}")

    leg = LegSpec(
        street=str(street),
        method=method,
        length_m=float(length_m),
        note=item.get("note"),
    )
    gaps = item.get("bridged_gaps_m") or []
    if not isinstance(gaps, list) or not all(_is_number(g) for g in gaps):
        raise _bad(f"{path}.bridged_gaps_m", "expected a list of numbers")
    leg.bridged_gaps_m = [float(g) for g in gaps]

    if method == "inferred":
        pts = _require(item, "points_lonlat", path)
        if not isinstance(pts, list) or len(pts) < 2:
            raise _bad(f"{path}.points_lonlat", "expected at least two [lon, lat] points")
        leg.points_lonlat = [_parse_lonlat(pt, f"{path}.points_lonlat[{j}]") for j, pt in enumerate(pts)]
        if not leg.note:
            raise _missing(f"{path}.note")
    else:
        ways = _require(item, "osm_ways", path)
        if not isinstance(ways, list) or not ways:
            raise _bad(f"{path}.osm_ways", "expected a non-empty list of way ids")
        for w in ways:
            if w == GAP:
                continue
            if isinstance(w, bool) or not isinstance(w, int):
                raise _bad(f"{path}.osm_ways", f"expected integer way ids or 'gap', got {w!r}")
        if method == "osm+gap" and GAP not in ways:
            raise _bad(f"{path}.osm_ways", "method osm+gap needs a 'gap' entry")
        if method == "osm" and GAP in ways:
            raise _bad(f"{path}.osm_ways", "a 'gap' entry needs method osm+gap")
        leg.osm_ways = list(ways)
        leg.clip_from_lonlat = _parse_lonlat(_require(item, "clip_from_lonlat", path), f"{path}.clip_from_lonlat")
        leg.clip_to_lonlat = _parse_lonlat(_require(item, "clip_to_lonlat", path), f"{path}.clip_to_lonlat")
    return leg


def _parse_legs(raw: Any) -> dict[str, list[LegSpec]]:
    if not isinstance(raw, dict):
        raise _missing("legs")
    out: dict[str, list[LegSpec]] = {}
    for direction in LEG_DIRECTIONS:
        if direction == "loop" and direction not in raw:
            continue  # the loop is optional
        items = _require(raw, direction, "legs")
        if not isinstance(items, list):
            raise _bad(f"legs.{direction}", "expected a list")
        out[direction] = [_parse_leg(item, f"legs.{direction}[{i}]") for i, item in enumerate(items)]
    return out


# --- public ------------------------------------------------------------------


def load_facts(facts_path: Path) -> FactsFile:
    """
    Load and validate a facts file.

    Raises FactsError naming the field if the file is unreadable, malformed or
    missing a required field.
    """
    facts_path = Path(facts_path)
    if not facts_path.is_file():
        raise FactsError(f"Facts file not found: {facts_path}")
    try:
        with open(facts_path, encoding="utf-8") as fh:
            raw = yaml.safe_load(fh)
    except yaml.YAMLError as exc:
        raise FactsError(f"Facts file {facts_path} is not valid YAML: {exc}") from exc
    if not isinstance(raw, dict):
        raise FactsError(f"Facts file {facts_path} must hold a YAML mapping at the top level.")

    line = _require(raw, "line", "")
    mode = _require(raw, "mode", "")
    effective = str(_require(raw, "effective", ""))
    source = _require(raw, "source", "")
    pages = _require(raw, "pages", "")
    if not isinstance(pages, dict):
        raise _bad("pages", "expected a mapping")

    timing_points = _parse_timing_points(raw.get("timing_points"))
    departures = _parse_departures(raw.get("midday_departures"))
    legs = _parse_legs(raw.get("legs"))

    slugs = {p.slug for p in timing_points}
    for direction, pattern in departures.items():
        if pattern.from_slug not in slugs:
            raise _bad(f"midday_departures.{direction}.from", f"{pattern.from_name!r} is not a timing point")

    return FactsFile(
        line=str(line),
        mode=str(mode),
        effective=effective,
        timing_points=timing_points,
        midday_departures=departures,
        legs=legs,
        source=str(source),
        pages={str(k): str(v) for k, v in pages.items()},
    )
