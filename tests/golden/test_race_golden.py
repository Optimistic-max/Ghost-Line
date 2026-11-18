"""
Golden tests for the race at a time (race-brief.md section 5.5, cases 1-8).

These read the pinned feed zip, so they are marked requires_feed. They skip
with a visible message when raw/mta_local_bus.zip is absent (hosted build).

The pipeline does not round. Values are compared after rounding to 3 decimals,
which is what emit stores.
"""

import datetime
import itertools
import warnings
from pathlib import Path

import pytest

from pipeline.clock import build_clock
from pipeline.eligible import active_services, find_eligible_trips
from pipeline.facts import load_facts
from pipeline.feed_check import PINNED_FEED_SHA256, check_feed
from pipeline.gtfs_reader import GTFSReader
from pipeline.race import SLIDER_FIRST_MIN, run_all_races
from pipeline.stops import find_stops_near_corners

ROOT = Path(__file__).resolve().parents[2]
FEED_PATH = ROOT / "raw" / "mta_local_bus.zip"
FACTS_PATH = ROOT / "data" / "lines" / "no21-1938.yaml"
SERVICE_DATE = datetime.date(2026, 11, 4)

if not FEED_PATH.is_file():
    message = f"golden race tests need {FEED_PATH}, which is missing: SKIPPED"
    warnings.warn(message)
    pytest.skip(message, allow_module_level=True)
if not FACTS_PATH.is_file():
    pytest.skip(f"golden race tests need {FACTS_PATH}, which is missing", allow_module_level=True)

pytestmark = pytest.mark.requires_feed

LEAD = ("preston-caroline", "aliceanna-bond")
REVERSE = ("aliceanna-bond", "preston-caroline")
WEST = ("westwood-carey", "preston-caroline")


@pytest.fixture(scope="module")
def races(tmp_path_factory):
    assert check_feed(FEED_PATH) == PINNED_FEED_SHA256
    facts = load_facts(FACTS_PATH)
    gtfs = GTFSReader(FEED_PATH, cache_dir=tmp_path_factory.mktemp("cache"))
    services = active_services(gtfs, SERVICE_DATE)
    slugs = [p.slug for p in facts.timing_points]
    stops = find_stops_near_corners(gtfs, facts.timing_points, radius_m=400.0)
    pairs = list(itertools.permutations(slugs, 2))
    eligible = {
        (o, d): find_eligible_trips(gtfs, o, d, stops[o], stops[d], services, SERVICE_DATE)
        for o, d in pairs
    }
    return run_all_races(pairs, build_clock(facts), eligible, facts)


def _row(races, pair, hh, mm):
    return races[pair][hh * 60 + mm - SLIDER_FIRST_MIN]


def _r3(x):
    return round(x, 3)


def _check(row, *, car, total_1938, today_total, result, margin):
    assert row.y1938.dep == car
    assert _r3(row.y1938.total) == total_1938
    assert _r3(row.today.total) == today_total
    assert row.result == result
    assert _r3(row.margin) == margin


def test_case_1_lead_pair_10_00(races):
    row = _row(races, LEAD, 10, 0)
    _check(row, car="10:06", total_1938=15, today_total=45.156, result="1938", margin=30.156)
    # B3: today's wait, computed from the unrounded walks
    assert _r3(row.today.wait) == 30.458
    assert row.today.trip.dep == pytest.approx(632.717, abs=0.001)


def test_case_2_lead_pair_10_21(races):
    row = _row(races, LEAD, 10, 21)
    _check(row, car="10:21", total_1938=9, today_total=24.156, result="1938", margin=15.156)
    assert row.today.trip.dep == pytest.approx(632.717, abs=0.001)


def test_case_3_lead_pair_10_30_photo_finish(races):
    row = _row(races, LEAD, 10, 30)
    _check(row, car="10:36", total_1938=15, today_total=15.156, result="photo_finish", margin=0.156)


def test_case_4_lead_pair_10_31(races):
    row = _row(races, LEAD, 10, 31)
    _check(row, car="10:36", total_1938=14, today_total=50.156, result="1938", margin=36.156)
    assert row.today.trip.dep == pytest.approx(11 * 60 + 8.717, abs=0.001)


def test_case_5_lead_pair_13_52(races):
    row = _row(races, LEAD, 13, 52)
    _check(row, car="13:58", total_1938=15, today_total=29.156, result="1938", margin=14.156)


def test_case_6_lead_pair_9_00_before_table(races):
    row = _row(races, LEAD, 9, 0)
    assert row.before_table is True
    assert row.start == pytest.approx(9 * 60 + 21)
    _check(row, car="09:21", total_1938=9, today_total=48.156, result="1938", margin=39.156)


def test_case_7_reverse_pair_13_52(races):
    row = _row(races, REVERSE, 13, 52)
    _check(row, car="13:56", total_1938=13, today_total=49.812, result="1938", margin=36.812)
    # race-brief.md 5.5 case 7 "bus 14:30:00" is the chosen trip's scheduled DEPARTURE
    # from the boarding stop (9486). Its arrival at the alighting stop (4053) is 14:39:18.
    assert row.today.trip.dep_str == "14:30:00"


def test_case_8_westwood_carey_11_23_today_wins(races):
    row = _row(races, WEST, 11, 23)
    assert row.y1938.dep == "11:30"
    assert _r3(row.y1938.total) == 28
    assert "lime" in row.today.trip.route.lower()
    assert row.today.trip.dep == pytest.approx(11 * 60 + 25, abs=0.001)
    assert _r3(row.today.access) == 1.930
    assert _r3(row.today.wait) == 0.070
    assert _r3(row.today.ride) == 19.717
    assert _r3(row.today.egress) == 2.258
    assert _r3(row.today.total) == 23.975
    assert row.result == "today"
    assert _r3(row.margin) == 4.025
