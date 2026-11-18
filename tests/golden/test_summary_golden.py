"""
Golden tests for the per-pair summary and totals (race-brief.md section 5.6).

These read the pinned feed zip, so they are marked requires_feed. They skip
with a visible message when raw/mta_local_bus.zip is absent (hosted build).

The pipeline does not round. Medians and gaps are compared after rounding to
3 decimals, which is what emit stores.
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
from pipeline.race import run_all_races
from pipeline.stops import find_stops_near_corners
from pipeline.summary import compute_summary

ROOT = Path(__file__).resolve().parents[2]
FEED_PATH = ROOT / "raw" / "mta_local_bus.zip"
FACTS_PATH = ROOT / "data" / "lines" / "no21-1938.yaml"
SERVICE_DATE = datetime.date(2026, 11, 4)

if not FEED_PATH.is_file():
    message = f"golden summary tests need {FEED_PATH}, which is missing: SKIPPED"
    warnings.warn(message)
    pytest.skip(message, allow_module_level=True)
if not FACTS_PATH.is_file():
    pytest.skip(f"golden summary tests need {FACTS_PATH}, which is missing", allow_module_level=True)

pytestmark = pytest.mark.requires_feed

W, D, B, P, A = (
    "westwood-carey",
    "dolphin-myrtle",
    "brevard-preston",
    "preston-caroline",
    "aliceanna-bond",
)

# (origin, dest): races, wins_1938, wins_today, photo, ride_1938, median today ride, verdict
PAIR_TABLE = {
    (W, D): (293, 282, 3, 8, 8, 6.0, "faster today"),
    (D, W): (267, 264, 0, 3, 8, 6.0, "faster today"),
    (W, B): (293, 286, 1, 6, 13, 12.0, "same"),
    (B, W): (272, 261, 4, 7, 13, 10.983, "faster today"),
    (W, P): (293, 272, 11, 10, 21, 19.717, "same"),
    (P, W): (280, 274, 1, 5, 21, 20.267, "same"),
    (W, A): (293, 282, 3, 8, 30, 27.917, "same"),
    (A, W): (289, 282, 2, 5, 30, 28.150, "same"),
    (D, B): (285, 285, 0, 0, 5, 6.0, "same"),
    (B, D): (272, 271, 0, 1, 5, 4.983, "same"),
    (D, P): (285, 285, 0, 0, 13, 13.717, "same"),
    (P, D): (280, 280, 0, 0, 13, 14.267, "same"),
    (D, A): (285, 285, 0, 0, 22, 22.0, "same"),
    (A, D): (289, 289, 0, 0, 22, 23.0, "same"),
    (B, P): (280, 278, 0, 2, 8, 7.717, "same"),
    (P, B): (280, 279, 0, 1, 8, 9.283, "same"),
    (B, A): (280, 280, 0, 0, 17, 16.0, "same"),
    (A, B): (289, 289, 0, 0, 17, 18.017, "same"),
    (P, A): (272, 270, 0, 2, 9, 8.283, "same"),
    (A, P): (289, 288, 0, 1, 9, 8.733, "same"),
}


@pytest.fixture(scope="module")
def summary(tmp_path_factory):
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
    races = run_all_races(pairs, build_clock(facts), eligible, facts)
    return compute_summary(races, eligible, facts)


def test_table_covers_all_twenty_pairs(summary):
    assert len(PAIR_TABLE) == 20
    assert {(p.origin, p.dest) for p in summary.pairs} == set(PAIR_TABLE)


@pytest.mark.parametrize("pair", list(PAIR_TABLE), ids=lambda p: f"{p[0]}->{p[1]}")
def test_pair_row(summary, pair):
    row = next(p for p in summary.pairs if (p.origin, p.dest) == pair)
    races, w38, wtoday, photo, ride38, median, verdict = PAIR_TABLE[pair]
    assert row.races == races
    assert row.wins_1938 == w38
    assert row.wins_today == wtoday
    assert row.photo_finishes == photo
    assert row.ride_1938 == ride38
    assert round(row.ride_today_median, 3) == median
    assert row.ride_verdict == verdict


def test_totals(summary):
    assert summary.races == 5666
    assert summary.wins_1938 == 5582
    assert summary.wins_today == 25
    assert summary.photo_finishes == 59


def test_ride_verdict_counts(summary):
    assert summary.ride_same == 17
    assert summary.ride_faster_today == 3
    assert summary.ride_slower_today == 0


def test_lead_pair_gaps(summary):
    row = next(p for p in summary.pairs if (p.origin, p.dest) == (P, A))
    assert round(row.gap_min, 3) == 34.0
    assert round(row.gap_max, 3) == 39.0


def test_today_wins_list_matches_count(summary):
    assert len(summary.today_wins) == 25
