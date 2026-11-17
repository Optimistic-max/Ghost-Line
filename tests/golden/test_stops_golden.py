"""
Golden tests for stops near corners (race-brief.md section 5.3, cases 5-7).

These read the pinned feed zip, so they are marked requires_feed. They skip
with a visible message when raw/mta_local_bus.zip is absent (hosted build).
"""

import warnings
from pathlib import Path

import pytest

from pipeline.facts import load_facts
from pipeline.feed_check import PINNED_FEED_SHA256, check_feed
from pipeline.gtfs_reader import GTFSReader
from pipeline.stops import compute_walk_time, find_stops_near_corners

ROOT = Path(__file__).resolve().parents[2]
FEED_PATH = ROOT / "raw" / "mta_local_bus.zip"
FACTS_PATH = ROOT / "data" / "lines" / "no21-1938.yaml"

if not FEED_PATH.is_file():
    message = f"golden stops tests need {FEED_PATH}, which is missing: SKIPPED"
    warnings.warn(message)
    pytest.skip(message, allow_module_level=True)
if not FACTS_PATH.is_file():
    pytest.skip(f"golden stops tests need {FACTS_PATH}, which is missing", allow_module_level=True)

pytestmark = pytest.mark.requires_feed


@pytest.fixture(scope="module")
def stops_by_corner(tmp_path_factory):
    assert check_feed(FEED_PATH) == PINNED_FEED_SHA256
    facts = load_facts(FACTS_PATH)
    gtfs = GTFSReader(FEED_PATH, cache_dir=tmp_path_factory.mktemp("cache"))
    found = find_stops_near_corners(gtfs, facts.timing_points)
    return {slug: {s.stop_id: s for s in stops} for slug, stops in found.items()}


def test_case_5_preston_caroline_to_stop_8564(stops_by_corner):
    stop = stops_by_corner["preston-caroline"]["8564"]
    assert stop.walk_m == pytest.approx(125.07, abs=0.1)
    assert stop.walk_min == pytest.approx(compute_walk_time(stop.walk_m))


def test_case_6_aliceanna_bond_to_stop_9486(stops_by_corner):
    stop = stops_by_corner["aliceanna-bond"]["9486"]
    detail = f"walk_m={stop.walk_m!r} walk_min={stop.walk_min!r}"
    print(f"stop 9486 -> aliceanna-bond: {detail}")
    assert stop.walk_m == pytest.approx(230.15, abs=0.1), detail
    assert stop.walk_min == pytest.approx(compute_walk_time(stop.walk_m)), detail
    assert round(stop.walk_m, 2) == 230.15, detail
    assert round(stop.walk_min, 3) == 4.156, detail


def test_case_7_preston_caroline_to_stop_4053(stops_by_corner):
    stop = stops_by_corner["preston-caroline"]["4053"]
    assert stop.walk_m == pytest.approx(139.14, abs=0.1)
