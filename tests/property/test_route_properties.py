"""
Property tests for the route rebuild (P7, race-brief.md section 5.8).

Made-up ways only, plus the committed facts file for the one real-data checks
that need no feed. Nothing here reads the feed zip or the 1933 file (B11).
"""

import ast
import inspect
from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

import pipeline.route as route_module
from pipeline.facts import LegSpec, load_facts
from pipeline.route import build_leg, build_route, clip_line, line_length_m, load_ways, orient_way
from pipeline.stops import geodesic_distance

ROOT = Path(__file__).resolve().parents[2]
FACTS_PATH = ROOT / "data" / "lines" / "no21-1938.yaml"
WAYS_PATH = ROOT / "data" / "osm" / "ways.json"

LAT = 39.3
LON0 = -76.620


def _pt(i):
    return (LON0 + 0.001 * i, LAT)


@st.composite
def straight_ways(draw):
    """A made-up street cut into 1 to 4 ways with 2 to 5 vertices each, joined end to start."""
    n_ways = draw(st.integers(min_value=1, max_value=4))
    ways, i = [], 0
    for _ in range(n_ways):
        n = draw(st.integers(min_value=2, max_value=5))
        ways.append([_pt(i + k) for k in range(n)])
        i += n - 1
    return ways, i  # i = index of the last vertex


def _as_dict(ways, flips):
    return {str(k + 1): (list(reversed(w)) if f else list(w)) for k, (w, f) in enumerate(zip(ways, flips))}


def _leg(ways, last, ids=None):
    ids = ids or list(range(1, len(ways) + 1))
    line_len = line_length_m([_pt(i) for i in range(last + 1)])
    return LegSpec("Fake Street", "osm", line_len, osm_ways=ids, clip_from_lonlat=_pt(0), clip_to_lonlat=_pt(last))


@settings(max_examples=100, deadline=None)
@given(data=straight_ways(), flips=st.lists(st.booleans(), min_size=4, max_size=4))
def test_p7_flipping_stored_direction_of_any_way_gives_same_line(data, flips):
    ways, last = data
    plain = build_leg(_leg(ways, last), _as_dict(ways, [False] * len(ways)))
    flipped = build_leg(_leg(ways, last), _as_dict(ways, flips[: len(ways)]))
    assert flipped.coordinates == plain.coordinates
    assert flipped.length_m == pytest.approx(plain.length_m)


@settings(max_examples=100, deadline=None)
@given(data=straight_ways(), a=st.integers(min_value=0, max_value=20), b=st.integers(min_value=0, max_value=20))
def test_p7_leg_is_never_shorter_than_straight_line_between_clip_points(data, a, b):
    ways, last = data
    a, b = a % (last + 1), b % (last + 1)
    if a == b:
        return
    spec = LegSpec(
        "Fake Street", "osm", 0.0, osm_ways=list(range(1, len(ways) + 1)),
        clip_from_lonlat=_pt(a), clip_to_lonlat=_pt(b),
    )
    line = route_module._join_ways(spec, _as_dict(ways, [False] * len(ways)))[0]
    if route_module._nearest_index(line, _pt(a)) > route_module._nearest_index(line, _pt(b)):
        line.reverse()
    clipped = clip_line(line, _pt(a), _pt(b))
    assert line_length_m(clipped) >= geodesic_distance(_pt(a), _pt(b)) - 1e-6


@settings(max_examples=100, deadline=None)
@given(data=straight_ways())
def test_p7_clip_points_in_either_order_give_same_length(data):
    ways, last = data
    spec = _leg(ways, last)
    reverse_spec = LegSpec(
        spec.street, spec.method, spec.length_m, osm_ways=spec.osm_ways,
        clip_from_lonlat=spec.clip_to_lonlat, clip_to_lonlat=spec.clip_from_lonlat,
    )
    d = _as_dict(ways, [False] * len(ways))
    assert build_leg(reverse_spec, d).length_m == pytest.approx(build_leg(spec, d).length_m)


@settings(max_examples=100, deadline=None)
@given(data=straight_ways())
def test_p7_orient_way_is_idempotent_and_preserves_the_point_set(data):
    ways, _ = data
    ref = [_pt(-3), _pt(-2), _pt(-1)]
    way = ways[0]
    once = orient_way(list(reversed(way)), ref)
    assert sorted(once) == sorted(way)
    assert orient_way(once, ref) == once


def test_p7_route_length_equals_sum_of_legs():
    facts = load_facts(FACTS_PATH)
    route = build_route(facts, load_ways(WAYS_PATH, facts))
    for legs in route.values():
        line = [p for leg in legs for p in leg.coordinates]
        # Legs share their end points, so the joined line is the legs end to end.
        assert line_length_m(line) == pytest.approx(sum(leg.length_m for leg in legs), abs=1.0 * len(legs))


def test_p7_shared_street_has_same_length_in_both_directions():
    facts = load_facts(FACTS_PATH)
    route = build_route(facts, load_ways(WAYS_PATH, facts))
    west = {leg.street: leg.length_m for leg in route["westbound"]}
    east = {leg.street: leg.length_m for leg in route["eastbound"]}
    # A street is shared when both directions list the same ways. Caroline Street is not:
    # eastbound it runs on past Eastern Avenue to Aliceanna.
    west_ways = {s.street: sorted(map(str, s.osm_ways)) for s in facts.legs["westbound"]}
    east_ways = {s.street: sorted(map(str, s.osm_ways)) for s in facts.legs["eastbound"]}
    shared = [s for s in west if s in east and west_ways[s] == east_ways.get(s)]
    assert len(shared) >= 6
    for street in shared:
        assert east[street] == pytest.approx(west[street], abs=1.0), street


def test_p7_route_reads_only_the_1938_facts_and_ways_snapshot():
    """B11: build_route takes a FactsFile and a ways dict. The module names no other data file."""
    source = inspect.getsource(route_module)
    tree = ast.parse(source)
    docstrings = {id(n.value) for n in ast.walk(tree) if isinstance(n, ast.Expr)}
    strings = [
        n.value
        for n in ast.walk(tree)
        if isinstance(n, ast.Constant) and isinstance(n.value, str) and id(n) not in docstrings
    ]
    assert not any("1933" in s or "mta_local_bus" in s or "raw/" in s for s in strings)
    imported = {
        (n.module or "") if isinstance(n, ast.ImportFrom) else a.name
        for n in ast.walk(tree)
        if isinstance(n, (ast.Import, ast.ImportFrom))
        for a in (n.names if isinstance(n, ast.Import) else [None])
    }
    assert not any(m.startswith(("pipeline.eligible", "pipeline.race", "pipeline.gtfs_reader")) for m in imported)
    assert "requests" not in imported and "urllib" not in imported
