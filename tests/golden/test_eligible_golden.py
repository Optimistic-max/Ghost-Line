"""
Golden tests for eligible one-seat trips (race-brief.md section 5.4, cases 1-6).

These read the pinned feed zip, so they are marked requires_feed. They skip
with a visible message when raw/mta_local_bus.zip is absent (hosted build).

The feed spells the route "CityLink LIME"; the brief says "Lime". Route names
are compared case-insensitively.
"""

import datetime
import itertools
import warnings
from pathlib import Path

import pytest

from pipeline.eligible import active_services, find_eligible_trips
from pipeline.facts import load_facts
from pipeline.feed_check import PINNED_FEED_SHA256, check_feed
from pipeline.gtfs_reader import GTFSReader
from pipeline.stops import find_stops_near_corners

ROOT = Path(__file__).resolve().parents[2]
FEED_PATH = ROOT / "raw" / "mta_local_bus.zip"
FACTS_PATH = ROOT / "data" / "lines" / "no21-1938.yaml"
SERVICE_DATE = datetime.date(2026, 11, 4)

if not FEED_PATH.is_file():
    message = f"golden eligible tests need {FEED_PATH}, which is missing: SKIPPED"
    warnings.warn(message)
    pytest.skip(message, allow_module_level=True)
if not FACTS_PATH.is_file():
    pytest.skip(f"golden eligible tests need {FACTS_PATH}, which is missing", allow_module_level=True)

pytestmark = pytest.mark.requires_feed


@pytest.fixture(scope="module")
def world(tmp_path_factory):
    assert check_feed(FEED_PATH) == PINNED_FEED_SHA256
    facts = load_facts(FACTS_PATH)
    gtfs = GTFSReader(FEED_PATH, cache_dir=tmp_path_factory.mktemp("cache"))
    services = active_services(gtfs, SERVICE_DATE)
    slugs = [p.slug for p in facts.timing_points]
    return facts, gtfs, services, slugs


def _trips(world, origin, dest, radius_m=400.0):
    facts, gtfs, services, _ = world
    stops = find_stops_near_corners(gtfs, facts.timing_points, radius_m=radius_m)
    return find_eligible_trips(
        gtfs, origin, dest, stops[origin], stops[dest], services, SERVICE_DATE
    )


def _routes(trips):
    return {t.route.lower() for t in trips}


def test_case_1_active_services_on_service_date(world):
    _, _, services, _ = world
    assert services == {"2251"}


def test_case_2_preston_caroline_to_aliceanna_bond(world):
    trips = _trips(world, "preston-caroline", "aliceanna-bond")
    assert len(trips) == 36
    assert all("lime" in t.route.lower() for t in trips), _routes(trips)
    assert {t.headsign for t in trips} == {"HARBOR EAST"}
    assert {t.board_stop.stop_id for t in trips} == {"8564"}
    assert {t.alight_stop.stop_id for t in trips} == {"9486"}


def test_case_3_aliceanna_bond_to_preston_caroline(world):
    trips = _trips(world, "aliceanna-bond", "preston-caroline")
    assert len(trips) == 37
    assert all("lime" in t.route.lower() for t in trips), _routes(trips)
    assert {t.headsign for t in trips} == {"NORTHWEST HOSPITAL"}
    assert {t.board_stop.stop_id for t in trips} == {"9486"}
    assert {t.alight_stop.stop_id for t in trips} == {"4053"}


def test_case_4_westwood_carey_to_aliceanna_bond(world):
    trips = _trips(world, "westwood-carey", "aliceanna-bond")
    assert len(trips) == 124
    routes = _routes(trips)
    assert any("lime" in r for r in routes), routes
    assert any("navy" in r for r in routes), routes


def _empty_pairs(world, radius_m):
    facts, gtfs, services, slugs = world
    stops = find_stops_near_corners(gtfs, facts.timing_points, radius_m=radius_m)
    pairs = list(itertools.permutations(slugs, 2))
    assert len(pairs) == 20
    empty = [
        (o, d)
        for o, d in pairs
        if not find_eligible_trips(
            gtfs, o, d, stops[o], stops[d], services, SERVICE_DATE
        )
    ]
    return empty


def test_case_5_no_pair_is_empty_at_400_m(world):
    assert _empty_pairs(world, 400.0) == []


@pytest.mark.parametrize("radius_m, expected_empty", [(250.0, 4), (150.0, 16)])
def test_case_6_sensitivity_empty_pairs(world, radius_m, expected_empty):
    empty = _empty_pairs(world, radius_m)
    assert len(empty) == expected_empty, f"radius {radius_m}: {len(empty)} empty: {empty}"
