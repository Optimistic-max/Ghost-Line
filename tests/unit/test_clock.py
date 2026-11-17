"""Unit tests for pipeline.clock: the eight cases of race-brief.md section 5.1."""

from pathlib import Path

import pytest

from pipeline.clock import (
    NO_1938_TRIP,
    build_clock,
    compute_offset,
    next_1938,
    ride_minutes,
    terminal_departures,
)
from pipeline.facts import load_facts

FACTS_PATH = Path(__file__).resolve().parents[2] / "data" / "lines" / "no21-1938.yaml"
pytestmark = pytest.mark.skipif(not FACTS_PATH.is_file(), reason=f"{FACTS_PATH} is missing")


def hm(h: int, m: int) -> float:
    return float(h * 60 + m)


@pytest.fixture(scope="module")
def facts():
    return load_facts(FACTS_PATH)


@pytest.fixture(scope="module")
def clocks(facts):
    return build_clock(facts)


def test_terminal_departures_from_literal_pattern():
    deps = terminal_departures([0, 7, 15, 22, 30, 37, 45, 52], hm(9, 0), hm(13, 52))
    assert len(deps) == 40
    assert deps[0] == hm(9, 0) and deps[-1] == hm(13, 52)


def test_terminal_departures_respects_first_and_last():
    deps = terminal_departures([4, 11], hm(9, 11), hm(10, 4))
    assert deps == [hm(9, 11), hm(10, 4)]


def test_compute_offset_both_directions():
    minutes = [8, 5, 8, 9]
    assert [compute_offset("eastbound", i, minutes) for i in range(5)] == [0, 8, 13, 21, 30]
    assert [compute_offset("westbound", i, minutes) for i in range(5)] == [30, 22, 17, 9, 0]


def test_build_clock_has_all_ten_pairs(clocks):
    assert set(clocks) == {"eastbound", "westbound"}
    for per_corner in clocks.values():
        assert len(per_corner) == 5


# --- section 5.1 cases 1 to 8 -------------------------------------------------


def test_case1_eastbound_westwood_1352(clocks):
    r = next_1938(clocks["eastbound"]["westwood-carey"], hm(13, 52))
    assert r["dep"] == hm(13, 52) and r["wait"] == 0


def test_case2_westbound_aliceanna_1352(clocks):
    r = next_1938(clocks["westbound"]["aliceanna-bond"], hm(13, 52))
    assert r["dep"] == hm(13, 56) and r["wait"] == 4


def test_case3_eastbound_preston_1000(clocks):
    r = next_1938(clocks["eastbound"]["preston-caroline"], hm(10, 0))
    assert r["dep"] == hm(10, 6) and r["wait"] == 6 and r["before_table"] is False


def test_case4_eastbound_westwood_1001(clocks):
    r = next_1938(clocks["eastbound"]["westwood-carey"], hm(10, 1))
    assert r["dep"] == hm(10, 7) and r["wait"] == 6


def test_case5_eastbound_preston_0900_before_table(clocks):
    r = next_1938(clocks["eastbound"]["preston-caroline"], hm(9, 0))
    assert r["before_table"] is True
    assert r["start"] == hm(9, 21) and r["dep"] == hm(9, 21) and r["wait"] == 0


def test_case6_westbound_dolphin_0900_before_table(clocks):
    r = next_1938(clocks["westbound"]["dolphin-myrtle"], hm(9, 0))
    assert r["before_table"] is True
    assert r["start"] == hm(9, 26)


def test_case7_ride_preston_to_aliceanna(facts):
    assert ride_minutes("preston-caroline", "aliceanna-bond", facts) == 9


def test_case8_ride_full_line_either_way(facts):
    assert ride_minutes("westwood-carey", "aliceanna-bond", facts) == 30
    assert ride_minutes("aliceanna-bond", "westwood-carey", facts) == 30


def test_next_1938_after_last_pass_returns_guard(clocks):
    clock = clocks["eastbound"]["westwood-carey"]
    assert next_1938(clock, clock.passes[-1] + 1) == NO_1938_TRIP


def test_next_1938_keeps_fractional_times(clocks):
    r = next_1938(clocks["eastbound"]["westwood-carey"], 600.25)
    assert r["start"] == 600.25
    assert r["wait"] == r["dep"] - 600.25
