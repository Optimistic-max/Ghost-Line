"""Property tests P5 (summary counts) and P6 (arrival-weighted wait).

P5 runs compute_summary on made-up race rows. P6 runs arrival_weighted_wait on
generated gap lists. Neither reads the feed.
"""

from __future__ import annotations

import math
from types import SimpleNamespace

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from pipeline.summary import arrival_weighted_wait, compute_summary

REL = 1e-9

# ---------------------------------------------------------------- P5

SLUGS = ["a", "b", "c"]
PAIRS = [("a", "b"), ("a", "c"), ("b", "c"), ("b", "a")]
THREE = ["1938", "today", "photo_finish"]
ALLOWED = {"1938", "today", "photo_finish", "no_one_seat_ride"}


def _facts():
    return SimpleNamespace(
        timing_points=[
            SimpleNamespace(slug=s, minutes_from_prev=m)
            for s, m in zip(SLUGS, (0, 7, 9))
        ]
    )


def _positive_minutes():
    return st.floats(min_value=0.0, max_value=120.0, allow_nan=False, allow_infinity=False)


@st.composite
def _rows(draw, results):
    """Made-up rows for one pair. Unique t per row; some rows before_table."""
    n = draw(st.integers(min_value=0, max_value=30))
    rows = []
    for i in range(n):
        result = draw(st.sampled_from(results))
        before = draw(st.booleans())
        ride = None if result == "no_one_seat_ride" else draw(_positive_minutes())
        margin = None if result == "no_one_seat_ride" else draw(_positive_minutes())
        rows.append(
            SimpleNamespace(
                t=f"{9 + i // 60:02d}:{i % 60:02d}",
                before_table=before,
                result=result,
                today=None if ride is None else SimpleNamespace(ride=ride),
                margin=margin,
            )
        )
    return rows


@st.composite
def _races(draw, results):
    pairs = draw(st.lists(st.sampled_from(PAIRS), min_size=1, max_size=4, unique=True))
    return {p: draw(_rows(results)) for p in pairs}


def _summary(races):
    return compute_summary(races, {p: [] for p in races}, _facts())


@settings(max_examples=100, deadline=None)
@given(races=_races(THREE))
def test_p5_pair_counts_add_up_to_races(races):
    """**Validates: Requirements P5 (wins_1938 + wins_today + photo_finishes = races)**"""
    s = _summary(races)
    for p in s.pairs:
        counted = [r for r in races[(p.origin, p.dest)] if not r.before_table]
        assert p.races == len(counted)
        assert p.wins_1938 + p.wins_today + p.photo_finishes == p.races


@settings(max_examples=100, deadline=None)
@given(races=_races(list(ALLOWED)))
def test_p5_totals_equal_sums_of_pair_counts(races):
    """**Validates: Requirements P5 (summary totals equal per-pair sums)**"""
    s = _summary(races)
    assert s.races == sum(p.races for p in s.pairs)
    assert s.wins_1938 == sum(p.wins_1938 for p in s.pairs)
    assert s.wins_today == sum(p.wins_today for p in s.pairs)
    assert s.photo_finishes == sum(p.photo_finishes for p in s.pairs)
    assert len(s.today_wins) == s.wins_today


@settings(max_examples=100, deadline=None)
@given(races=_races(list(ALLOWED)))
def test_p5_today_wins_point_to_counted_today_rows(races):
    """**Validates: Requirements P5 (every today_wins entry is a counted "today" row)**"""
    s = _summary(races)
    for w in s.today_wins:
        matches = [
            r for r in races[(w.origin, w.dest)]
            if r.t == w.t and not r.before_table and r.result == "today"
        ]
        assert len(matches) == 1
        assert matches[0].margin == w.margin


@settings(max_examples=100, deadline=None)
@given(races=_races(list(ALLOWED)))
def test_p5_result_labels_stay_in_the_four_allowed(races):
    """**Validates: Requirements P5 (no label outside the four allowed)**"""
    for rows in races.values():
        assert {r.result for r in rows} <= ALLOWED
    s = _summary(races)
    # Every counted row lands in exactly one of four buckets.
    no_ride = sum(
        1 for rows in races.values() for r in rows
        if not r.before_table and r.result == "no_one_seat_ride"
    )
    assert s.races == s.wins_1938 + s.wins_today + s.photo_finishes + no_ride


# ---------------------------------------------------------------- P6

gaps_st = st.lists(
    st.floats(min_value=0.1, max_value=300.0, allow_nan=False, allow_infinity=False),
    min_size=1,
    max_size=25,
)


def _close(a, b):
    return a == pytest.approx(b, rel=1e-7, abs=1e-9)


@settings(max_examples=100, deadline=None)
@given(
    g=st.floats(min_value=0.1, max_value=300.0, allow_nan=False, allow_infinity=False),
    n=st.integers(min_value=1, max_value=30),
)
def test_p6_equal_gaps_give_half_the_gap(g, n):
    """**Validates: Requirements P6 (equal gaps g give g / 2)**"""
    assert _close(arrival_weighted_wait([g] * n), g / 2)


@settings(max_examples=100, deadline=None)
@given(gaps=gaps_st)
def test_p6_bounded_by_half_mean_and_half_max(gaps):
    """**Validates: Requirements P6 (never below half the mean gap, never above half the largest)**"""
    w = arrival_weighted_wait(gaps)
    half_mean = sum(gaps) / len(gaps) / 2
    half_max = max(gaps) / 2
    assert w >= half_mean * (1 - 1e-9)
    assert w <= half_max * (1 + 1e-9)


@settings(max_examples=100, deadline=None)
@given(gaps=gaps_st, data=st.data())
def test_p6_reordering_changes_nothing(gaps, data):
    """**Validates: Requirements P6 (reordering gaps changes nothing)**"""
    shuffled = data.draw(st.permutations(gaps))
    assert _close(arrival_weighted_wait(shuffled), arrival_weighted_wait(gaps))


@settings(max_examples=100, deadline=None)
@given(
    gaps=gaps_st,
    k=st.floats(min_value=0.01, max_value=100.0, allow_nan=False, allow_infinity=False),
)
def test_p6_scaling_gaps_scales_result(gaps, k):
    """**Validates: Requirements P6 (multiplying every gap by k multiplies the result by k)**"""
    scaled = arrival_weighted_wait([g * k for g in gaps])
    assert _close(scaled, k * arrival_weighted_wait(gaps))


@settings(max_examples=100, deadline=None)
@given(
    gaps=st.lists(
        st.floats(min_value=0.1, max_value=300.0, allow_nan=False, allow_infinity=False),
        min_size=2,
        max_size=25,
    ),
    data=st.data(),
)
def test_p6_merging_neighbours_never_lowers_result(gaps, data):
    """**Validates: Requirements P6 (merging two neighbouring gaps never lowers the result)**"""
    i = data.draw(st.integers(min_value=0, max_value=len(gaps) - 2))
    merged = gaps[:i] + [gaps[i] + gaps[i + 1]] + gaps[i + 2:]
    before = arrival_weighted_wait(gaps)
    after = arrival_weighted_wait(merged)
    assert after >= before or math.isclose(after, before, rel=1e-9, abs=1e-12)
