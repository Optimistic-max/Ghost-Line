"""Hypothesis tests for the P1 properties of the 1938 clock."""

from pathlib import Path

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from pipeline.clock import build_clock, next_1938, ride_minutes
from pipeline.facts import load_facts

FACTS_PATH = Path(__file__).resolve().parents[2] / "data" / "lines" / "no21-1938.yaml"
if not FACTS_PATH.is_file():
    pytest.skip(f"{FACTS_PATH} is missing", allow_module_level=True)

FACTS = load_facts(FACTS_PATH)
CLOCKS = build_clock(FACTS)
SLUGS = [p.slug for p in FACTS.timing_points]
DIRS = ["eastbound", "westbound"]
ALL_CLOCKS = [CLOCKS[d][s] for d in DIRS for s in SLUGS]


def test_forty_passes_strictly_increasing_gaps_7_or_8():
    assert len(ALL_CLOCKS) == 10
    for c in ALL_CLOCKS:
        assert len(c.passes) == 40
        gaps = [b - a for a, b in zip(c.passes, c.passes[1:])]
        assert all(g > 0 for g in gaps)
        assert all(g in (7, 8) for g in gaps)
        assert c.covered_from == c.passes[0]


@given(st.sampled_from(SLUGS))
def test_offsets_sum_to_line_length(slug):
    total = CLOCKS["eastbound"][slug].offset_min + CLOCKS["westbound"][slug].offset_min
    assert total == 30


@given(st.sampled_from(ALL_CLOCKS), st.data())
@settings(max_examples=200)
def test_wait_between_zero_and_eight_inside_coverage(clock, data):
    t = data.draw(st.floats(min_value=clock.covered_from, max_value=clock.passes[-1], allow_nan=False))
    r = next_1938(clock, t)
    assert 0 <= r["wait"] <= 8
    assert r["before_table"] is False


@given(st.sampled_from(ALL_CLOCKS), st.data())
@settings(max_examples=200)
def test_next_1938_result_is_in_passes(clock, data):
    t = data.draw(st.floats(min_value=0, max_value=clock.passes[-1], allow_nan=False))
    r = next_1938(clock, t)
    assert r["dep"] in clock.passes
    assert r["start"] == max(t, clock.covered_from)
    assert r["wait"] == r["dep"] - r["start"]
    assert r["before_table"] == (t < clock.covered_from)


@given(st.sampled_from(SLUGS), st.sampled_from(SLUGS))
def test_ride_symmetry(a, b):
    assert ride_minutes(a, b, FACTS) == ride_minutes(b, a, FACTS)
    assert ride_minutes(a, a, FACTS) == 0


@given(st.permutations(range(5)).map(lambda p: sorted(p[:3])))
def test_rides_add_up(idx):
    a, b, c = (SLUGS[i] for i in idx)
    assert ride_minutes(a, c, FACTS) == ride_minutes(a, b, FACTS) + ride_minutes(b, c, FACTS)
