"""Unit tests for pipeline.summary."""

from types import SimpleNamespace

import pytest

from pipeline.summary import arrival_weighted_wait, find_gaps, ride_verdict


def test_arrival_weighted_wait_single_gap():
    # One 30-minute gap: 30*30 / (2*30) = 15.
    assert arrival_weighted_wait([30.0]) == 15.0


def test_arrival_weighted_wait_empty_warns_and_returns_none():
    with pytest.warns(UserWarning, match="empty or sum to zero"):
        assert arrival_weighted_wait([]) is None


def test_arrival_weighted_wait_zero_sum_warns_and_returns_none():
    with pytest.warns(UserWarning, match="empty or sum to zero"):
        assert arrival_weighted_wait([0.0, 0.0]) is None


@pytest.mark.parametrize(
    "gaps, expected",
    [
        ([7, 8, 7, 8], 113 / 30),  # case 1: 1938 pattern, 3.767
        ([36, 36, 36, 36, 34], 6340 / 356),  # case 2: lead pair, 17.809
        ([10], 5.0),  # case 3
        ([5, 15], 6.25),  # case 4: 250 / 40
    ],
)
def test_arrival_weighted_wait_brief_5_7_cases(gaps, expected):
    assert arrival_weighted_wait(gaps) == pytest.approx(expected, abs=1e-9)


def test_arrival_weighted_wait_brief_5_7_rounded_values():
    assert round(arrival_weighted_wait([7, 8, 7, 8]), 3) == 3.767
    assert round(arrival_weighted_wait([36, 36, 36, 36, 34]), 3) == 17.809


def test_arrival_weighted_wait_brief_5_7_case_4_exceeds_half_mean_gap():
    assert arrival_weighted_wait([5, 15]) > (5 + 15) / 2 / 2


def test_arrival_weighted_wait_brief_5_7_case_5_empty_warns_none():
    with pytest.warns(UserWarning):
        assert arrival_weighted_wait([]) is None


@pytest.mark.parametrize(
    "delta, ride, expected",
    [
        (0.0, 10.0, "same"),
        (1.5, 10.0, "same"),  # floor boundary, inclusive
        (-1.5, 10.0, "same"),
        (1.5001, 10.0, "slower today"),
        (-1.5001, 10.0, "faster today"),
        (3.0, 20.0, "same"),  # 0.15 * 20 = 3.0, inclusive
        (-3.0, 20.0, "same"),
        (3.001, 20.0, "slower today"),
        (-3.001, 20.0, "faster today"),
    ],
)
def test_ride_verdict_boundaries(delta, ride, expected):
    assert ride_verdict(delta, ride) == expected


def _trips(*deps):
    # find_gaps reads only .dep, so a bare stand-in is enough here.
    return [SimpleNamespace(dep=d) for d in deps]


def test_find_gaps_basic_and_unsorted():
    assert find_gaps(_trips(600.0, 570.0, 609.0), 540.0, 840.0) == (9.0, 30.0)


def test_find_gaps_window_start_inclusive_end_exclusive():
    # 540 is in, 840 is out, 839.5 is in; 500 and 900 are outside.
    trips = _trips(500.0, 540.0, 600.0, 839.5, 840.0, 900.0)
    assert find_gaps(trips, 540.0, 840.0) == (60.0, 239.5)


def test_find_gaps_returns_floats_unrounded():
    gmin, gmax = find_gaps(_trips(540, 540.1234, 600), 540.0, 840.0)
    assert isinstance(gmin, float) and isinstance(gmax, float)
    assert gmin == pytest.approx(0.1234) and gmax == pytest.approx(59.8766)


def test_find_gaps_gap_range_34_to_39():
    # Made-up departures shaped like the lead pair's 34 and 39 minute gaps.
    deps = [540.0, 574.0, 613.0, 647.0, 686.0]
    assert find_gaps(_trips(*deps), 540.0, 840.0) == (34.0, 39.0)


@pytest.mark.parametrize("deps", [[], [600.0], [600.0, 900.0], [100.0, 600.0]])
def test_find_gaps_fewer_than_two_in_window_raises(deps):
    with pytest.raises(ValueError, match="at least two"):
        find_gaps(_trips(*deps), 540.0, 840.0)


# ---- compute_summary (made-up data) ----

from pipeline.summary import compute_summary  # noqa: E402


def _facts(*minutes):
    slugs = ["a", "b", "c"]
    return SimpleNamespace(
        timing_points=[
            SimpleNamespace(slug=s, minutes_from_prev=m) for s, m in zip(slugs, minutes)
        ]
    )


def _row(t, result, ride=None, margin=None, before=False):
    today = None if ride is None else SimpleNamespace(ride=ride)
    return SimpleNamespace(
        t=t, before_table=before, result=result, today=today, margin=margin
    )


def test_compute_summary_counts_totals_and_today_wins():
    facts = _facts(0, 10, 5)
    races = {
        ("a", "b"): [
            _row("09:00", "today", ride=9.0, margin=2.0, before=True),  # not counted
            _row("09:01", "1938", ride=9.0, margin=3.0),
            _row("09:02", "today", ride=11.0, margin=1.5),
            _row("09:03", "photo_finish", ride=13.0, margin=0.5),
        ],
        ("b", "c"): [_row("09:01", "no_one_seat_ride"), _row("09:02", "no_one_seat_ride")],
    }
    eligible = {
        ("a", "b"): [SimpleNamespace(dep=540.0), SimpleNamespace(dep=574.0),
                     SimpleNamespace(dep=613.0)],
        ("b", "c"): [],
    }
    s = compute_summary(races, eligible, facts)
    ab, bc = s.pairs
    assert (ab.races, ab.wins_1938, ab.wins_today, ab.photo_finishes) == (3, 1, 1, 1)
    assert ab.ride_1938 == 10.0
    assert ab.ride_today_median == 11.0 and ab.delta == 1.0 and ab.ride_verdict == "same"
    assert (ab.gap_min, ab.gap_max) == (34.0, 39.0)
    assert bc.races == 2 and bc.ride_today_median is None and bc.ride_verdict is None
    assert bc.gap_min is None and bc.gap_max is None
    assert (s.races, s.wins_1938, s.wins_today, s.photo_finishes) == (5, 1, 1, 1)
    assert (s.ride_same, s.ride_faster_today, s.ride_slower_today) == (1, 0, 0)
    assert s.pairs_without_one_seat_ride == 1
    assert [(w.origin, w.dest, w.t, w.margin) for w in s.today_wins] == [("a", "b", "09:02", 1.5)]


def test_compute_summary_faster_and_slower_verdicts():
    facts = _facts(0, 20, 20)
    races = {
        ("a", "b"): [_row("09:00", "1938", ride=10.0, margin=5.0)],
        ("b", "c"): [_row("09:00", "1938", ride=30.0, margin=5.0)],
    }
    eligible = {("a", "b"): [], ("b", "c"): []}
    s = compute_summary(races, eligible, facts)
    assert [p.ride_verdict for p in s.pairs] == ["faster today", "slower today"]
    assert (s.ride_faster_today, s.ride_slower_today, s.ride_same) == (1, 1, 0)
