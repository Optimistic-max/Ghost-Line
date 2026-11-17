"""
Golden tests for the 1938 clock (race-brief.md section 5.1).

These do not read the feed zip, so they carry no requires_feed marker and run
on every machine that has the facts file (B20). They skip only if the facts
file is absent.
"""

from pathlib import Path

import pytest

from pipeline.clock import build_clock, next_1938, ride_minutes
from pipeline.facts import load_facts

ROOT = Path(__file__).resolve().parents[2]
FACTS_PATH = ROOT / "data" / "lines" / "no21-1938.yaml"

if not FACTS_PATH.is_file():
    pytest.skip(f"golden clock tests need {FACTS_PATH}, which is missing", allow_module_level=True)

FACTS = load_facts(FACTS_PATH)
CLOCKS = build_clock(FACTS)


def hm(h: int, m: int) -> float:
    return float(h * 60 + m)


def test_facts_values_match_the_brief():
    assert [p.minutes_from_prev for p in FACTS.timing_points] == [0, 8, 5, 8, 9]
    assert FACTS.midday_departures["eastbound"].minutes_past_hour == [0, 7, 15, 22, 30, 37, 45, 52]
    assert FACTS.midday_departures["westbound"].minutes_past_hour == [4, 11, 19, 26, 34, 41, 49, 56]


def test_offsets_match_the_brief():
    slugs = [p.slug for p in FACTS.timing_points]
    assert [CLOCKS["eastbound"][s].offset_min for s in slugs] == [0, 8, 13, 21, 30]
    assert [CLOCKS["westbound"][s].offset_min for s in slugs] == [30, 22, 17, 9, 0]


@pytest.mark.parametrize(
    "direction, corner, t, dep, wait",
    [
        ("eastbound", "westwood-carey", hm(13, 52), hm(13, 52), 0),
        ("westbound", "aliceanna-bond", hm(13, 52), hm(13, 56), 4),
        ("eastbound", "preston-caroline", hm(10, 0), hm(10, 6), 6),
        ("eastbound", "westwood-carey", hm(10, 1), hm(10, 7), 6),
    ],
)
def test_next_departure_cases(direction, corner, t, dep, wait):
    r = next_1938(CLOCKS[direction][corner], t)
    assert r["dep"] == dep and r["wait"] == wait and r["before_table"] is False


@pytest.mark.parametrize(
    "direction, corner, start",
    [
        ("eastbound", "preston-caroline", hm(9, 21)),
        ("westbound", "dolphin-myrtle", hm(9, 26)),
    ],
)
def test_before_table_cases(direction, corner, start):
    r = next_1938(CLOCKS[direction][corner], hm(9, 0))
    assert r["before_table"] is True and r["start"] == start


def test_ride_cases():
    assert ride_minutes("preston-caroline", "aliceanna-bond", FACTS) == 9
    assert ride_minutes("westwood-carey", "aliceanna-bond", FACTS) == 30
    assert ride_minutes("aliceanna-bond", "westwood-carey", FACTS) == 30
