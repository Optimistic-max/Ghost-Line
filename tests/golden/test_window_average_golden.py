"""
Golden check of the lead pair's window averages against the plan
(race-brief.md 5.7 and its Corrections section; race-engine task 34.1).

The plan's figures for Preston & Caroline to Aliceanna & Bond, on the weekday
schedule of Wednesday 2026-11-04, start times 10:00 to 13:00, 400 m stop
radius, walking included: 1938 total 12.767 min, today 32.637 min (± 0.01).

They are the time-average of each side's race total over every start moment in
[10:00, 13:00). Between the moments where the chosen 1938 car or the best bus
changes, each total falls by one minute per minute, so the average is exact
when each such piece is sampled at its midpoint. The races come from the
pipeline's own race_at_time. The window averages are never shown in the app;
this test only ties the pipeline back to the plan.

Reads the pinned feed zip, so it is marked requires_feed and skips with a
visible message when raw/mta_local_bus.zip is absent (hosted build).
"""

import datetime
import warnings
from pathlib import Path

import pytest

from pipeline.clock import build_clock, ride_minutes
from pipeline.eligible import active_services, find_eligible_trips
from pipeline.facts import load_facts
from pipeline.feed_check import PINNED_FEED_SHA256, check_feed
from pipeline.gtfs_reader import GTFSReader
from pipeline.race import race_at_time
from pipeline.stops import find_stops_near_corners

ROOT = Path(__file__).resolve().parents[2]
FEED_PATH = ROOT / "raw" / "mta_local_bus.zip"
FACTS_PATH = ROOT / "data" / "lines" / "no21-1938.yaml"
SERVICE_DATE = datetime.date(2026, 11, 4)

if not FEED_PATH.is_file():
    message = f"golden window-average test needs {FEED_PATH}, which is missing: SKIPPED"
    warnings.warn(message)
    pytest.skip(message, allow_module_level=True)
if not FACTS_PATH.is_file():
    pytest.skip(f"golden window-average test needs {FACTS_PATH}, which is missing", allow_module_level=True)

pytestmark = pytest.mark.requires_feed

ORIGIN, DEST = "preston-caroline", "aliceanna-bond"
WINDOW = (600.0, 780.0)  # 10:00 to 13:00, minutes after midnight
RADIUS_M = 400.0

# The plan's values (race-brief.md 5.7) and their tolerances.
PLAN_1938, TOL_1938 = 12.767, 0.001
PLAN_TODAY, TOL_TODAY = 32.637, 0.01


def window_averages(clock, trips, ride, window):
    """Exact time-averages of the 1938 and today totals over start times in the window."""
    start, end = window
    cuts = {start, end}
    # The 1938 car changes just after each listed pass.
    cuts |= {p for p in clock.passes if start < p < end}
    # A bus stops being catchable once the walk would miss it.
    cuts |= {t.dep - t.access_min for t in trips if start < t.dep - t.access_min < end}
    points = sorted(cuts)
    sum_1938 = sum_today = 0.0
    for a, b in zip(points, points[1:]):
        row = race_at_time((a + b) / 2, clock, trips, ride, origin=ORIGIN, dest=DEST)
        assert row.today is not None, "the lead pair has a one-seat ride all day"
        sum_1938 += row.y1938.total * (b - a)
        sum_today += row.today.total * (b - a)
    return sum_1938 / (end - start), sum_today / (end - start)


@pytest.fixture(scope="module")
def averages(tmp_path_factory):
    assert check_feed(FEED_PATH) == PINNED_FEED_SHA256
    facts = load_facts(FACTS_PATH)
    gtfs = GTFSReader(FEED_PATH, cache_dir=tmp_path_factory.mktemp("cache"))
    services = active_services(gtfs, SERVICE_DATE)
    stops = find_stops_near_corners(gtfs, facts.timing_points, radius_m=RADIUS_M)
    trips = find_eligible_trips(gtfs, ORIGIN, DEST, stops[ORIGIN], stops[DEST], services, SERVICE_DATE)
    clock = build_clock(facts)["eastbound"][ORIGIN]
    return window_averages(clock, trips, ride_minutes(ORIGIN, DEST, facts), WINDOW)


def test_lead_pair_1938_window_average_matches_the_plan(averages):
    avg_1938, _ = averages
    print(f"1938 window average 10:00-13:00: {avg_1938:.6f} (plan {PLAN_1938} ± {TOL_1938})")
    assert avg_1938 == pytest.approx(PLAN_1938, abs=TOL_1938)


def test_lead_pair_today_window_average_matches_the_plan(averages):
    _, avg_today = averages
    print(f"today window average 10:00-13:00: {avg_today:.6f} (plan {PLAN_TODAY} ± {TOL_TODAY})")
    assert avg_today == pytest.approx(PLAN_TODAY, abs=TOL_TODAY)
