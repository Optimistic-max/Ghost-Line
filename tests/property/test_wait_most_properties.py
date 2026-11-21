"""Property tests 1 and 2 of the story-layer spec: the wait-most flag and Python display rounding.

The oracle is written here with exact rational arithmetic (fractions.Fraction) and does
not call display_round_parts. Parts are generated as whole thousandths of a minute, the
way emit.py stores them, and the stored total is the sum of the parts plus a small
emission-rounding offset, so the rounding is reachable the way it is in the real data.
Where the oracle says the parts cannot add up, the tests expect ValidationError.
Made-up numbers only; nothing reads the feed.
"""

from __future__ import annotations

from fractions import Fraction
from math import floor

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from pipeline.emit import _wait_most, display_round_parts
from pipeline.errors import ValidationError

HALF = Fraction(1, 2)


# ---------------------------------------------------------------- oracle (independent)


def _oracle_round(parts_milli: list[int], total_milli: int):
    """R7 rule on exact values. Returns (shown_total, shown_parts) or None when the parts cannot add up.

    Inputs are whole thousandths, so round6 leaves them unchanged. The shown total is
    floor(total + 1/2). Each part floors. The missing minutes go one each to the largest
    fractional remainders (only remainders above zero), ties to the earlier phase.
    """
    parts = [Fraction(m, 1000) for m in parts_milli]
    total = Fraction(total_milli, 1000)
    shown_total = floor(total + HALF)
    shown = [floor(p) for p in parts]
    missing = shown_total - sum(shown)
    remainders = [(p - floor(p), i) for i, p in enumerate(parts) if p - floor(p) > 0]
    remainders.sort(key=lambda r: (-r[0], r[1]))
    if missing < 0 or missing > len(remainders):
        return None
    for _, i in remainders[:missing]:
        shown[i] += 1
    return shown_total, shown


# ---------------------------------------------------------------- strategies


def _milli_parts(size: int):
    # Up to 70 minutes per part, in whole thousandths. Zeros are common on purpose.
    return st.lists(st.integers(min_value=0, max_value=70_000), min_size=size, max_size=size)


@st.composite
def _stored(draw, size: int):
    """(parts as emitted floats, total as emitted float, parts in milli, total in milli).

    The total is the sum of the parts plus an offset of up to two thousandths either way,
    which is the most that independent three-decimal rounding of each value can add.
    """
    milli = draw(_milli_parts(size))
    offset = draw(st.integers(min_value=-2, max_value=2))
    total_milli = max(0, sum(milli) + offset)
    return [m / 1000 for m in milli], total_milli / 1000, milli, total_milli


# ---------------------------------------------------------------- Property 1

# Feature: story-layer, Property 1: The wait-most flag is the shown-wait predicate
@settings(max_examples=300, deadline=None)
@given(
    result=st.sampled_from(["1938", "today", "photo_finish", "no_one_seat_ride"]),
    a=_stored(2),
    b=_stored(4),
)
def test_wait_most_is_the_shown_wait_predicate(result, a, b):
    parts38, total38, m38, t38 = a
    parts_today, total_today, mtd, ttd = b

    if result in ("photo_finish", "no_one_seat_ride"):
        # False for every photo finish and no-ride row, whatever the numbers are,
        # and with no numbers at all.
        assert _wait_most(result, parts38, total38, parts_today, total_today) is False
        assert _wait_most(result, None, None, None, None) is False
        return

    r38 = _oracle_round(m38, t38)
    rtd = _oracle_round(mtd, ttd)
    if r38 is None or rtd is None:
        with pytest.raises(ValidationError):
            _wait_most(result, parts38, total38, parts_today, total_today)
        return

    shown_total_38, shown_38 = r38
    shown_total_today, shown_today = rtd
    wait_1938 = shown_38[0]
    wait_today = shown_today[1]
    margin = abs(shown_total_38 - shown_total_today)
    if result == "1938":
        loser_minus_winner = wait_today - wait_1938
    else:
        loser_minus_winner = wait_1938 - wait_today
    expected = Fraction(loser_minus_winner) > Fraction(margin, 2)

    assert _wait_most(result, parts38, total38, parts_today, total_today) is expected


# ---------------------------------------------------------------- Property 2

# Feature: story-layer, Property 2: Python display rounding keeps the R7 invariants
@settings(max_examples=300, deadline=None)
@given(size=st.integers(min_value=2, max_value=5), data=st.data())
def test_display_rounding_keeps_the_r7_invariants(size, data):
    parts, total, milli, total_milli = data.draw(_stored(size))

    expected = _oracle_round(milli, total_milli)
    if expected is None:
        with pytest.raises(ValidationError):
            display_round_parts(parts, total)
        return

    shown_total, shown = display_round_parts(parts, total)

    # Shown total is floor(round6(total) + 0.5), computed exactly.
    assert shown_total == floor(Fraction(total_milli, 1000) + HALF)
    # Parts sum to the shown total.
    assert sum(shown) == shown_total
    assert len(shown) == len(parts)
    for stored_milli, s in zip(milli, shown):
        stored = Fraction(stored_milli, 1000)
        # Each shown part is within one minute of its stored part.
        assert abs(s - stored) < 1
        # A whole-number part is unchanged.
        if stored.denominator == 1:
            assert s == stored
    # Same answer on every call.
    assert display_round_parts(parts, total) == (shown_total, shown)
    assert display_round_parts(list(parts), total) == (shown_total, shown)
    # And the same answer as the independent oracle (remainder ties to the earlier phase).
    assert (shown_total, shown) == expected


def test_unreachable_parts_raise_validation_error():
    # Zero parts cannot make up a shown total of 1.
    with pytest.raises(ValidationError):
        display_round_parts([0.0, 0.0], 0.6)
    with pytest.raises(ValidationError):
        _wait_most("1938", [0.0, 0.0], 0.6, [0, 1, 1, 0], 2)
