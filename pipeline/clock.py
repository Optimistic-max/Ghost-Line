"""
Step 3: the 1938 clock.

Pattern, first/last cars and timing minutes all come from the facts file.
Times are minutes after midnight as floats. Nothing here is rounded.
"""

from __future__ import annotations

from dataclasses import dataclass

from pipeline.errors import FactsError
from pipeline.facts import DIRECTIONS, FactsFile

NO_1938_TRIP = "no_1938_trip"  # guard only; cannot happen for t <= last pass


@dataclass
class Clock1938:
    corner: str  # corner slug
    direction: str  # "eastbound" or "westbound"
    offset_min: int  # minutes from the terminal
    passes: list[float]  # minutes after midnight, ascending
    covered_from: float  # first pass


def terminal_departures(pattern: list[int], first: float, last: float) -> list[float]:
    """Every hh:mm with mm in pattern and first <= hh:mm <= last, ascending."""
    out: list[float] = []
    for hour in range(int(first // 60), int(last // 60) + 1):
        for mm in pattern:
            t = float(hour * 60 + mm)
            if first <= t <= last:
                out.append(t)
    return out


def compute_offset(direction: str, corner_index: int, minutes: list[int]) -> int:
    """
    Minutes from the terminal to the corner.

    `minutes` holds the minutes between neighbouring corners in eastbound
    order (length = corners - 1). Eastbound sums minutes[0 .. i-1];
    westbound sums minutes[i ..].
    """
    if direction == "eastbound":
        return int(sum(minutes[:corner_index]))
    if direction == "westbound":
        return int(sum(minutes[corner_index:]))
    raise ValueError(f"direction must be 'eastbound' or 'westbound', got {direction!r}")


def _segment_minutes(facts: FactsFile) -> list[int]:
    return [p.minutes_from_prev for p in facts.timing_points[1:]]


def build_clock(facts: FactsFile) -> dict[str, dict[str, Clock1938]]:
    """Return {direction: {corner_slug: Clock1938}} for every corner and direction."""
    points = facts.timing_points
    minutes = _segment_minutes(facts)
    expected_terminal = {"eastbound": points[0].slug, "westbound": points[-1].slug}
    clocks: dict[str, dict[str, Clock1938]] = {}
    for direction in DIRECTIONS:
        pattern = facts.midday_departures[direction]
        if pattern.from_slug != expected_terminal[direction]:
            raise FactsError(
                f"Facts file: midday_departures.{direction}.from is {pattern.from_name!r}, "
                f"but the {direction} terminal is {expected_terminal[direction]!r}."
            )
        departures = terminal_departures(pattern.minutes_past_hour, pattern.first_min, pattern.last_min)
        per_corner: dict[str, Clock1938] = {}
        for i, point in enumerate(points):
            offset = compute_offset(direction, i, minutes)
            passes = [t + offset for t in departures]
            per_corner[point.slug] = Clock1938(
                corner=point.slug,
                direction=direction,
                offset_min=offset,
                passes=passes,
                covered_from=passes[0],
            )
        clocks[direction] = per_corner
    return clocks


def next_1938(clock: Clock1938, t: float) -> dict | str:
    """
    Next 1938 car at or after max(t, covered_from).

    Returns {start, dep, wait, before_table}, all full precision, or the
    NO_1938_TRIP guard value if no pass is left.
    """
    start = max(t, clock.covered_from)
    for p in clock.passes:
        if p >= start:
            return {
                "start": start,
                "dep": p,
                "wait": p - start,
                "before_table": t < clock.covered_from,
            }
    return NO_1938_TRIP


def ride_minutes(origin_slug: str, dest_slug: str, facts: FactsFile) -> float:
    """Sum of timing minutes between two corners; the same either way."""
    slugs = [p.slug for p in facts.timing_points]
    for s in (origin_slug, dest_slug):
        if s not in slugs:
            raise FactsError(f"Unknown corner slug {s!r}; expected one of {slugs}.")
    lo, hi = sorted((slugs.index(origin_slug), slugs.index(dest_slug)))
    return float(sum(p.minutes_from_prev for p in facts.timing_points[lo + 1 : hi + 1]))
