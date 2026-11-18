"""Unit tests for pipeline.race: race-brief.md section 5.2 cases 5-6 and the race helpers.

All data here is made up by hand. No raw/ feed is read.
"""

from dataclasses import replace
from types import SimpleNamespace

import pytest

from pipeline.clock import Clock1938
from pipeline.eligible import EligibleTrip
from pipeline.errors import PipelineError
from pipeline.race import (
    NO_MORE_TRIPS_TODAY,
    NO_ONE_SEAT_RIDE,
    compute_result,
    next_today,
    race_at_time,
    run_all_races,
)


def make_trip(dep, arr, access=0.0, egress=0.0, trip_id="fake"):
    return EligibleTrip(
        trip_id=trip_id,
        route="FAKE",
        headsign="FAKE",
        board_stop=None,
        alight_stop=None,
        dep=float(dep),
        arr=float(arr),
        dep_str="",
        arr_str="",
        ride_min=float(arr - dep),
        access_min=float(access),
        egress_min=float(egress),
    )


def hm(h, m):
    return float(h * 60 + m)


# A made-up clock: a car every 10 minutes from 09:15 to 14:00.
FAKE_CLOCK = Clock1938(
    corner="a",
    direction="eastbound",
    offset_min=0,
    passes=[float(m) for m in range(555, 841, 10)],
    covered_from=555.0,
)
FAKE_RIDE = 10.0


# --- next_today ---------------------------------------------------------


def test_case_5_chooses_trip_that_arrives_first_not_first_to_leave():
    a = make_trip(hm(10, 0), hm(10, 30), trip_id="A")
    b = make_trip(hm(10, 10), hm(10, 20), trip_id="B")
    r = next_today([a, b], hm(9, 55))
    assert r["trip"] is b
    assert r["total"] == 25
    assert r["wait"] == 15
    assert r["ride"] == 10
    assert r["access"] == 0 and r["egress"] == 0


def test_case_6_no_trips_is_no_one_seat_ride():
    assert next_today([], hm(10, 0)) == NO_ONE_SEAT_RIDE
    assert NO_ONE_SEAT_RIDE == "no_one_seat_ride"


def test_trips_exist_but_none_catchable():
    trips = [make_trip(hm(10, 0), hm(10, 20), access=2.0)]
    # Start 09:59 plus a 2 minute walk is 10:01, after the 10:00 departure.
    assert next_today(trips, hm(9, 59)) == NO_MORE_TRIPS_TODAY
    # Start 09:58 plus 2 is exactly 10:00: just caught.
    assert next_today(trips, hm(9, 58))["wait"] == 0


def test_tie_on_arrival_takes_earlier_departure():
    early = make_trip(hm(10, 0), hm(10, 20), trip_id="early")
    late = make_trip(hm(10, 5), hm(10, 20), trip_id="late")
    assert next_today([late, early], hm(9, 0))["trip"] is early


# --- compute_result -----------------------------------------------------


@pytest.mark.parametrize(
    "margin, expected",
    [
        (0.999, "photo_finish"),
        (1.0, "1938"),
        (-1.0, "today"),
        (0, "photo_finish"),
        (-0.999, "photo_finish"),
    ],
)
def test_compute_result_boundaries(margin, expected):
    assert compute_result(margin) == expected


# --- race_at_time -------------------------------------------------------


def test_race_1938_wins_and_fields():
    trips = [make_trip(620, 640)]
    row = race_at_time(600.0, FAKE_CLOCK, trips, FAKE_RIDE, origin="a", dest="b")
    assert row.t == "10:00"
    assert row.start == 600.0
    assert row.before_table is False
    assert row.y1938.dep == "10:05"
    assert row.y1938.wait == 5.0
    assert row.y1938.total == 15.0
    assert row.today.total == 40.0
    assert row.result == "1938"
    assert row.margin == 25.0


def test_race_today_wins_and_margin_is_absolute():
    trips = [make_trip(600, 605)]
    row = race_at_time(600.0, FAKE_CLOCK, trips, FAKE_RIDE, origin="a", dest="b")
    assert row.today.total == 5.0
    assert row.y1938.total == 15.0
    assert row.margin == 10.0
    assert row.result == "today"
    assert row.margin > 0
    assert row.margin == abs(row.today.total - row.y1938.total)


def test_race_photo_finish():
    # 1938: car at 10:05 -> wait 5 (t=600 is not a pass; 605 is), total 15.
    trips = [make_trip(600, 615.5)]
    row = race_at_time(600.0, FAKE_CLOCK, trips, FAKE_RIDE, origin="a", dest="b")
    assert row.result == "photo_finish"
    assert row.margin == pytest.approx(0.5)


def test_race_no_one_seat_ride_for_empty_trips():
    row = race_at_time(600.0, FAKE_CLOCK, [], FAKE_RIDE, origin="a", dest="b")
    assert row.result == NO_ONE_SEAT_RIDE
    assert row.today is None
    assert row.margin is None
    assert row.y1938.total == row.y1938.wait + FAKE_RIDE


def test_race_before_table_starts_at_covered_from():
    trips = [make_trip(700, 720)]
    row = race_at_time(540.0, FAKE_CLOCK, trips, FAKE_RIDE, origin="a", dest="b")
    assert row.t == "09:00"
    assert row.start == 555.0
    assert row.before_table is True
    assert row.y1938.wait == 0.0


def test_race_raises_for_no_more_trips_today_naming_pair_and_time():
    trips = [make_trip(500, 520)]  # left before the start
    with pytest.raises(PipelineError) as exc:
        race_at_time(600.0, FAKE_CLOCK, trips, FAKE_RIDE, origin="a", dest="b")
    msg = str(exc.value)
    assert "a -> b" in msg and "10:00" in msg


def test_race_raises_for_no_1938_trip_naming_pair_and_time():
    with pytest.raises(PipelineError) as exc:
        race_at_time(hm(14, 1), FAKE_CLOCK, [make_trip(900, 910)], FAKE_RIDE, origin="a", dest="b")
    msg = str(exc.value)
    assert "a -> b" in msg and "14:01" in msg


# --- run_all_races ------------------------------------------------------


def _fake_facts():
    points = [
        SimpleNamespace(slug="a", minutes_from_prev=0),
        SimpleNamespace(slug="b", minutes_from_prev=10),
    ]
    return SimpleNamespace(timing_points=points)


def test_run_all_races_293_rows_and_pre_coverage_repeats_covered_from():
    pair = ("a", "b")
    trips = [make_trip(hm(15, 0), hm(15, 20))]
    rows = run_all_races(
        [pair], {"eastbound": {"a": FAKE_CLOCK}}, {pair: trips}, _fake_facts()
    )[pair]
    assert len(rows) == 293
    assert rows[0].t == "09:00" and rows[-1].t == "13:52"
    covered = next(r for r in rows if r.t == "09:15")
    pre = [r for r in rows if r.t < "09:15"]
    assert len(pre) == 15
    for r in pre:
        assert r.before_table is True
        assert r.start == covered.start
        assert r.result == covered.result
        assert r.margin == covered.margin
        assert r.y1938 == covered.y1938
        assert r.today == covered.today
    assert covered.before_table is False


def test_run_all_races_stored_margin_is_never_negative():
    pair = ("a", "b")
    trips = [make_trip(hm(9, 0), hm(9, 1)), make_trip(hm(15, 0), hm(15, 20))]
    trips = [replace(t) for t in trips]
    rows = run_all_races(
        [pair], {"eastbound": {"a": FAKE_CLOCK}}, {pair: trips}, _fake_facts()
    )[pair]
    assert all(r.margin >= 0 for r in rows)
    # The early bus is only catchable before 09:00, so every row is 1938 wins.
    assert {r.result for r in rows} == {"1938"}


def test_run_all_races_today_win_has_positive_margin():
    pair = ("a", "b")
    # A bus every minute at 1 minute ride: always faster than the 1938 car.
    trips = [make_trip(m, m + 1) for m in range(540, 900)]
    rows = run_all_races(
        [pair], {"eastbound": {"a": FAKE_CLOCK}}, {pair: trips}, _fake_facts()
    )[pair]
    assert all(r.result == "today" and r.margin > 0 for r in rows)


def test_run_all_races_rejects_bad_pair():
    with pytest.raises(PipelineError):
        run_all_races([("a", "a")], {}, {}, _fake_facts())
