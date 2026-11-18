"""
Golden tests for the route rebuild (race-brief.md section 5.8, cases 1 to 6).

These read only the committed facts file and data/osm/ways.json, not the feed
zip, so they are not marked requires_feed (B20).
"""

from pathlib import Path

import pytest

from pipeline.facts import load_facts
from pipeline.route import build_leg, build_route, load_ways
from pipeline.stops import geodesic_distance

ROOT = Path(__file__).resolve().parents[2]
FACTS_PATH = ROOT / "data" / "lines" / "no21-1938.yaml"
WAYS_PATH = ROOT / "data" / "osm" / "ways.json"


@pytest.fixture(scope="module")
def facts():
    return load_facts(FACTS_PATH)


@pytest.fixture(scope="module")
def ways(facts):
    return load_ways(WAYS_PATH, facts)


@pytest.fixture(scope="module")
def route(facts, ways):
    return build_route(facts, ways)


def _leg(route, direction, street):
    return next(leg for leg in route[direction] if leg.street == street)


def test_case_1_aliceanna_street_eastbound(route):
    leg = _leg(route, "eastbound", "Aliceanna Street")
    assert leg.method == "osm"
    assert leg.length_m == pytest.approx(123.8, rel=0.005)


def test_case_2_brevard_street_inferred(route):
    leg = _leg(route, "westbound", "Brevard Street (historic)")
    assert len(leg.coordinates) == 3
    assert leg.length_m == pytest.approx(220.7, rel=0.005)
    assert leg.method == "inferred"
    assert leg.note


def test_case_3_lanvale_street_bridged_gap(facts, ways, route):
    leg = _leg(route, "westbound", "Lanvale Street")
    assert leg.method == "osm+gap"
    assert leg.length_m == pytest.approx(611.1, rel=0.005)
    spec = next(s for s in facts.legs["westbound"] if s.street == "Lanvale Street")
    assert spec.bridged_gaps_m == [26.2]
    # The built gap is the distance between the end of way 872766197 and the start of 98289609.
    first = ways["872766197"]
    second = ways["98289609"]
    built = min(geodesic_distance(a, b) for a in (first[0], first[-1]) for b in (second[0], second[-1]))
    assert built == pytest.approx(26.2, abs=1.0)


def test_case_4_westbound_all_14_legs(route):
    assert len(route["westbound"]) == 14
    assert sum(leg.length_m for leg in route["westbound"]) == pytest.approx(8401.0, rel=0.005)


def test_case_5_loop_plus_eastbound(route, facts):
    legs = route["eastbound"]
    n_loop = len(facts.legs["loop"])
    assert sum(leg.length_m for leg in legs[:n_loop]) == pytest.approx(249.2, rel=0.005)
    assert sum(leg.length_m for leg in legs[n_loop:]) == pytest.approx(8160.7, rel=0.005)
    assert sum(leg.length_m for leg in legs) == pytest.approx(8409.9, rel=0.005)


def test_case_6_gilmor_end_and_lanvale_start_are_the_same_point(route):
    gilmor = _leg(route, "westbound", "Gilmor Street")
    lanvale = _leg(route, "westbound", "Lanvale Street")
    point = (-76.642872, 39.297718)
    assert geodesic_distance(gilmor.coordinates[0], point) < 1.0
    assert geodesic_distance(lanvale.coordinates[-1], point) < 1.0
    assert geodesic_distance(gilmor.coordinates[0], lanvale.coordinates[-1]) < 1.0


def test_every_leg_carries_direction_street_method_note_and_length(route):
    for direction, legs in route.items():
        for leg in legs:
            assert leg.direction == direction
            assert leg.street and leg.method and leg.note
            assert leg.length_m > 0


def test_loop_legs_are_eastbound(route, facts):
    n_loop = len(facts.legs["loop"])
    assert [leg.direction for leg in route["eastbound"][:n_loop]] == ["eastbound"] * n_loop


def test_every_facts_leg_builds_within_length_tolerance(facts, ways):
    for direction, specs in facts.legs.items():
        for spec in specs:
            build_leg(spec, ways)  # raises RouteError on any mismatch
