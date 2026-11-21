"""
Unit tests for emit.display_round_parts and emit._wait_most (story-layer 1.1, 1.2).
Made-up numbers only; nothing reads the feed.
"""
import re
from pathlib import Path

import pytest

from pipeline import emit
from pipeline.emit import _wait_most, display_round_parts
from pipeline.errors import ValidationError


def test_rounding_matches_site_rule_on_lead_race_values():
    assert display_round_parts([6, 9], 15) == (15, [6, 9])
    assert display_round_parts([2.258, 30.458, 8.283, 4.156], 45.156) == (45, [2, 31, 8, 4])


def test_ties_go_to_the_earlier_phase():
    assert display_round_parts([0.5, 0.5], 1) == (1, [1, 0])


def test_1938_win_with_waits_31_and_6_and_margin_30_is_true():
    assert _wait_most("1938", [6, 9], 15, [2.258, 30.458, 8.283, 4.156], 45.156) is True


def test_today_win_true_when_1938_wait_is_most_of_the_margin():
    assert _wait_most("today", [20, 5], 25, [1, 2, 10, 1], 14) is True


def test_today_win_false_when_ride_and_walk_make_up_the_margin():
    assert _wait_most("today", [5, 20], 25, [1, 2, 10, 1], 14) is False


def test_photo_finish_is_false_without_rounding():
    assert _wait_most("photo_finish", None, None, None, None) is False


def test_no_one_seat_ride_is_false_without_rounding():
    assert _wait_most("no_one_seat_ride", None, None, None, None) is False


def test_exactly_half_the_margin_is_false():
    # shown margin 10, loser's wait minus winner's wait is 5
    assert _wait_most("1938", [2, 8], 10, [0, 7, 13, 0], 20) is False


def test_unreachable_rounding_raises_naming_pair_and_t():
    with pytest.raises(ValidationError, match="a -> b at t=10:00"):
        _wait_most("1938", [0.4, 0.4], 5, [0, 1, 1, 0], 2, where="a -> b at t=10:00")
    with pytest.raises(ValidationError):
        display_round_parts([0.4, 0.4], 5)


def test_display_round_parts_called_only_from_wait_most():
    source = (Path(emit.__file__)).read_text(encoding="utf-8")
    calls = []
    current = None
    for line in source.splitlines():
        m = re.match(r"def (\w+)\(", line)
        if m:
            current = m.group(1)
        if "display_round_parts(" in line and not line.startswith("def "):
            calls.append(current)
    assert calls == ["_wait_most", "_wait_most"]
    for path in Path(emit.__file__).parent.glob("*.py"):
        if path.name != "emit.py":
            assert "display_round_parts" not in path.read_text(encoding="utf-8")
