"""Hypothesis tests for the P4 properties of the race engine.

All data is made up: a fake clock with 7 and 8 minute gaps (the real
pattern) and fake one-seat trips. No raw/ feed is read.
"""

from types import SimpleNamespace

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from pipeline.clock import Clock1938
from pipeline.eligible import EligibleTrip
from pipeline.race import (
    NO_MORE_TRIPS_TODAY,
    NO_ONE_SEAT_RIDE,
    PHOTO_FINISH_MIN,
    SLIDER_FIRST_MIN,
    SLIDER_LAST_MIN,
    compute_result,
    next_today,
    race_at_time,
    run_all_races,
)
from tests.property.conftest import window_time

EPS = 1e-9
RIDE_1938 = 10.0

# --- strategies ---------------------------------------------------------


@st.composite
def clocks(draw, corner="a", direction="eastbound"):
    """Made-up 1938 clock: gaps of 7 or 8 minutes, covered well past 13:52."""
    first = float(draw(st.integers(min_value=540, max_value=600)))
    gaps = draw(st.lists(st.sampled_from([7, 8]), min_size=45, max_size=45))
    passes = [first]
    for g in gaps:
        passes.append(passes[-1] + g)
    return Clock1938(corner, direction, 0, passes, first)


def _trip(i, dep, ride, access, egress):
    return EligibleTrip(
        trip_id=f"fake-{i}",
        route="FAKE",
        headsign="FAKE",
        board_stop=None,
        alight_stop=None,
        dep=dep,
        arr=dep + ride,
        dep_str="",
        arr_str="",
        ride_min=ride,
        access_min=access,
        egress_min=egress,
    )


def _r3(x):
    return round(x, 3)


trip_fields = st.tuples(
    st.floats(min_value=480.0, max_value=900.0, allow_nan=False).map(_r3),  # dep
    st.floats(min_value=1.0, max_value=60.0, allow_nan=False).map(_r3),  # ride
    st.floats(min_value=0.0, max_value=7.223, allow_nan=False).map(_r3),  # access
    st.floats(min_value=0.0, max_value=7.223, allow_nan=False).map(_r3),  # egress
)


@st.composite
def trip_lists(draw, min_size=0, max_size=12):
    rows = draw(st.lists(trip_fields, min_size=min_size, max_size=max_size))
    return [_trip(i, *r) for i, r in enumerate(rows)]


@st.composite
def raceable_trips(draw):
    """Empty list, or a list that always has one catchable bus left on the slider range."""
    trips = draw(trip_lists())
    if not trips:
        return trips
    late = _trip(99, 1000.0, draw(st.floats(min_value=1.0, max_value=60.0).map(_r3)), 0.0, 0.0)
    return trips + [late]


start_times = st.floats(min_value=480.0, max_value=900.0, allow_nan=False).map(_r3)


def _is_result(x):
    return isinstance(x, dict)


# --- next_today properties ---------------------------------------------


@given(trip_lists(min_size=1), start_times)
def test_chosen_bus_is_catchable_and_best(trips, start):
    r = next_today(trips, start)
    catchable = [x for x in trips if x.dep >= start + x.access_min]
    if not catchable:
        assert r == NO_MORE_TRIPS_TODAY
        return
    assert _is_result(r)
    chosen = r["trip"]
    assert chosen.dep >= start + chosen.access_min
    best_arrival = chosen.arr + chosen.egress_min
    for x in catchable:
        assert x.arr + x.egress_min >= best_arrival


@given(trip_lists(min_size=1), start_times)
def test_total_and_wait_bounds(trips, start):
    r = next_today(trips, start)
    if not _is_result(r):
        return
    assert r["wait"] >= -EPS
    assert r["total"] >= r["access"] + r["ride"] + r["egress"] - EPS
    assert r["total"] == pytest.approx(r["access"] + r["wait"] + r["ride"] + r["egress"], abs=1e-6)


def test_empty_trips_is_no_one_seat_ride():
    assert next_today([], 600.0) == NO_ONE_SEAT_RIDE


@given(trip_lists(min_size=1), start_times, st.floats(min_value=0.0, max_value=240.0).map(_r3))
def test_starting_later_never_arrives_earlier(trips, start, delay):
    early = next_today(trips, start)
    late = next_today(trips, start + delay)
    if not _is_result(late):
        return
    # Anything catchable later was catchable earlier.
    assert _is_result(early)
    assert (start + delay) + late["total"] >= start + early["total"] - EPS


@given(trip_lists(min_size=1), trip_fields, start_times)
def test_adding_a_trip_never_raises_total(trips, extra, start):
    before = next_today(trips, start)
    after = next_today(trips + [_trip(500, *extra)], start)
    if _is_result(before):
        assert _is_result(after)
        assert after["total"] <= before["total"] + EPS


@given(trip_lists(min_size=1), start_times)
def test_plus_one_start_means_minus_one_total_for_same_trip(trips, start):
    a = next_today(trips, start)
    b = next_today(trips, start + 1.0)
    if _is_result(a) and _is_result(b) and a["trip"].trip_id == b["trip"].trip_id:
        assert b["total"] == pytest.approx(a["total"] - 1.0, abs=1e-6)


# --- race_at_time properties -------------------------------------------


@given(clocks(), raceable_trips(), window_time())
@settings(max_examples=200)
def test_start_rules_and_shared_start(clock, trips, t):
    row = race_at_time(t, clock, trips, RIDE_1938)
    assert row.start >= t
    assert row.start >= clock.covered_from
    if t >= clock.covered_from:
        assert row.start == t
        assert row.before_table is False
    else:
        assert row.start == clock.covered_from
        assert row.before_table is True
    # Both sides measure their waits from the one start.
    assert row.y1938.wait == pytest.approx(float(int(row.y1938.dep[:2]) * 60 + int(row.y1938.dep[3:])) - row.start)
    if row.today is not None:
        assert row.today.wait == pytest.approx(row.today.trip.dep - row.today.access - row.start, abs=1e-6)


@given(clocks(), raceable_trips(), window_time())
@settings(max_examples=200)
def test_result_agrees_with_totals_and_band(clock, trips, t):
    row = race_at_time(t, clock, trips, RIDE_1938)
    if not trips:
        assert row.result == NO_ONE_SEAT_RIDE
        assert row.today is None and row.margin is None
        return
    diff = row.today.total - row.y1938.total
    assert row.margin == pytest.approx(abs(diff), abs=1e-9)
    if abs(diff) < PHOTO_FINISH_MIN:
        assert row.result == "photo_finish"
    elif diff > 0:
        assert row.result == "1938"
    else:
        assert row.result == "today"
    assert row.result == compute_result(diff)


@given(clocks(), raceable_trips(), window_time())
@settings(max_examples=200)
def test_1938_total_and_wait_bounds(clock, trips, t):
    row = race_at_time(t, clock, trips, RIDE_1938)
    assert 0 <= row.y1938.wait <= 8
    assert RIDE_1938 <= row.y1938.total <= RIDE_1938 + 8
    assert row.y1938.total == pytest.approx(row.y1938.wait + RIDE_1938)


@given(clocks(), trip_lists(min_size=1), window_time())
@settings(max_examples=200)
def test_race_today_side_bounds(clock, trips, t):
    trips = trips + [_trip(99, 1000.0, 20.0, 0.0, 0.0)]
    row = race_at_time(t, clock, trips, RIDE_1938)
    td = row.today
    assert td.wait >= -EPS
    assert td.trip.dep >= row.start + td.access - EPS
    assert td.total >= td.access + td.ride + td.egress - EPS
    for x in trips:
        if x.dep >= row.start + x.access_min:
            assert x.arr + x.egress_min >= td.trip.arr + td.trip.egress_min - EPS


@given(clocks(), raceable_trips(), st.floats(min_value=540.0, max_value=831.0).map(_r3))
@settings(max_examples=150)
def test_race_plus_one_start_minus_one_total_same_trip(clock, trips, t):
    if not trips:
        return
    a = race_at_time(t, clock, trips, RIDE_1938)
    b = race_at_time(t + 1.0, clock, trips, RIDE_1938)
    if a.today.trip.trip_id == b.today.trip.trip_id and b.start == a.start + 1.0:
        assert b.today.total == pytest.approx(a.today.total - 1.0, abs=1e-6)


# --- run_all_races properties ------------------------------------------


@given(clocks("a", "eastbound"), clocks("c", "westbound"), raceable_trips(), raceable_trips())
@settings(max_examples=15, deadline=None)
def test_run_all_races_rows(ca, cc, trips_ac, trips_ca):
    facts = SimpleNamespace(
        timing_points=[
            SimpleNamespace(slug="a", minutes_from_prev=0),
            SimpleNamespace(slug="b", minutes_from_prev=4),
            SimpleNamespace(slug="c", minutes_from_prev=6),
        ]
    )
    clock_map = {
        "eastbound": {"a": ca},
        "westbound": {"c": cc},
    }
    eligible = {("a", "c"): trips_ac, ("c", "a"): trips_ca}
    out = run_all_races([("a", "c"), ("c", "a")], clock_map, eligible, facts)
    for pair, clock in ((("a", "c"), ca), (("c", "a"), cc)):
        rows = out[pair]
        assert len(rows) == SLIDER_LAST_MIN - SLIDER_FIRST_MIN + 1 == 293
        for i, row in enumerate(rows):
            t = float(SLIDER_FIRST_MIN + i)
            assert row.start >= t
            assert row.start == max(t, clock.covered_from)
            if t < clock.covered_from:
                # Pre-coverage rows repeat the covered_from race.
                first_covered = rows[int(clock.covered_from) - SLIDER_FIRST_MIN]
                assert row.before_table is True
                assert row.result == first_covered.result
                assert row.y1938 == first_covered.y1938
                assert row.today == first_covered.today
