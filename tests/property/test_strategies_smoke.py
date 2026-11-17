"""
Smoke tests confirming that every strategy in conftest.py produces valid values.

Each test draws one value and asserts the basic constraint holds.  These tests
do not test domain logic — they just prove the strategies are well-formed and
importable.
"""

from hypothesis import given, settings

from tests.property.conftest import (
    corner_index,
    minute_parts,
    positive_distance_m,
    time_of_day,
    walk_distance_m,
    window_time,
)


@given(t=time_of_day())
@settings(max_examples=200)
def test_time_of_day_in_range(t):
    assert 0.0 <= t <= 1439.999


@given(t=window_time())
@settings(max_examples=200)
def test_window_time_in_range(t):
    assert 540.0 <= t <= 836.0


@given(d=positive_distance_m())
@settings(max_examples=200)
def test_positive_distance_positive(d):
    assert 0.0 < d <= 10000.0


@given(d=walk_distance_m())
@settings(max_examples=200)
def test_walk_distance_within_radius(d):
    assert 0.0 < d <= 400.0


@given(i=corner_index())
@settings(max_examples=50)
def test_corner_index_in_range(i):
    assert 0 <= i <= 4


@given(parts=minute_parts())
@settings(max_examples=200)
def test_minute_parts_non_negative_and_bounded(parts):
    assert 2 <= len(parts) <= 5
    for p in parts:
        assert 0.0 <= p <= 60.0
