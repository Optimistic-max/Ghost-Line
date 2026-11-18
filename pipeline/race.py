"""
Race engine (race-brief.md section 5).

All values keep full precision. Nothing is rounded here.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from pipeline.clock import NO_1938_TRIP, Clock1938, next_1938, ride_minutes
from pipeline.errors import PipelineError
from pipeline.facts import FactsFile

if TYPE_CHECKING:  # annotation only; keeps pandas out of the import chain
    from pipeline.eligible import EligibleTrip

# The one photo-finish band, in minutes. Defined once, here.
PHOTO_FINISH_MIN = 1.0

NO_ONE_SEAT_RIDE = "no_one_seat_ride"
# Internal sentinel only. A caller that meets it on real data raises
# PipelineError naming the pair and the time (B9).
NO_MORE_TRIPS_TODAY = "no_more_trips_today"


def next_today(trips: list[EligibleTrip], start: float) -> dict | str:
    """Best one-seat trip the rider can still catch after walking to the stop.

    Returns NO_ONE_SEAT_RIDE if trips is empty, NO_MORE_TRIPS_TODAY if trips
    exist but none has dep >= start + access_min. Otherwise the trip with the
    smallest arr + egress_min (earlier dep on a tie), as a dict with keys
    trip, access, wait, ride, egress, total (minutes, full precision).
    """
    if not trips:
        return NO_ONE_SEAT_RIDE
    catchable = [x for x in trips if x.dep >= start + x.access_min]
    if not catchable:
        return NO_MORE_TRIPS_TODAY
    best = min(catchable, key=lambda x: (x.arr + x.egress_min, x.dep))
    return {
        "trip": best,
        "access": best.access_min,
        "wait": best.dep - start - best.access_min,
        "ride": best.arr - best.dep,
        "egress": best.egress_min,
        "total": best.arr + best.egress_min - start,
    }


@dataclass
class Race1938:
    dep: str  # "HH:MM"
    wait: float
    ride: float
    total: float


@dataclass
class RaceToday:
    trip: EligibleTrip  # emit maps this to an index into the trips array
    access: float
    wait: float
    ride: float
    egress: float
    total: float


@dataclass
class RaceRow:
    t: str  # slider time "HH:MM"
    start: float  # time both sides race from, minutes after midnight
    before_table: bool
    y1938: Race1938
    today: RaceToday | None  # None when result is no_one_seat_ride
    result: str  # "1938", "today", "photo_finish", "no_one_seat_ride"
    margin: float | None  # absolute difference in minutes; None for no_one_seat_ride


def compute_result(margin: float) -> str:
    """margin = today_total - y1938_total (positive = 1938 faster)."""
    if abs(margin) < PHOTO_FINISH_MIN:
        return "photo_finish"
    return "1938" if margin > 0 else "today"


def _hhmm(minutes: float) -> str:
    whole = int(minutes // 1)
    return f"{whole // 60:02d}:{whole % 60:02d}"


SLIDER_FIRST_MIN = 9 * 60  # 09:00
SLIDER_LAST_MIN = 13 * 60 + 52  # 13:52 inclusive


def run_all_races(
    pairs: list[tuple[str, str]],
    clocks: dict[str, dict[str, Clock1938]],
    eligible: dict[tuple[str, str], list[EligibleTrip]],
    facts: FactsFile,
) -> dict[tuple[str, str], list[RaceRow]]:
    """
    Races for every directed pair at every whole minute 09:00..13:52 (293 rows).

    The direction of travel is eastbound when the origin comes before the
    destination in facts.timing_points, else westbound. The origin corner's
    clock in that direction is used. Rows with t < covered_from start at
    covered_from, so they repeat that race's result and keep their own t and
    before_table = True. Full precision, no rounding.
    """
    slugs = [p.slug for p in facts.timing_points]
    out: dict[tuple[str, str], list[RaceRow]] = {}
    for origin, dest in pairs:
        if origin not in slugs or dest not in slugs or origin == dest:
            raise PipelineError(f"Bad pair {origin} -> {dest}; corners are {slugs}.")
        direction = "eastbound" if slugs.index(origin) < slugs.index(dest) else "westbound"
        clock = clocks[direction][origin]
        ride = ride_minutes(origin, dest, facts)
        trips = eligible[(origin, dest)]
        out[(origin, dest)] = [
            race_at_time(float(m), clock, trips, ride, origin=origin, dest=dest)
            for m in range(SLIDER_FIRST_MIN, SLIDER_LAST_MIN + 1)
        ]
    return out


def race_at_time(
    t: float,
    clock: Clock1938,
    eligible_trips: list[EligibleTrip],
    ride_1938_min: float,
    *,
    origin: str | None = None,
    dest: str | None = None,
) -> RaceRow:
    """
    One race at slider time t. Both sides start from max(t, covered_from).

    Raises PipelineError if either side has no trip left (cannot happen on
    real data). origin and dest are only used in error messages.
    """
    pair = f"{origin or clock.corner} -> {dest or '?'}"
    a = next_1938(clock, t)
    if a == NO_1938_TRIP:
        raise PipelineError(f"No 1938 car left for pair {pair} at t={_hhmm(t)} ({t} min).")
    start = a["start"]
    old = Race1938(
        dep=_hhmm(a["dep"]),
        wait=a["wait"],
        ride=ride_1938_min,
        total=a["wait"] + ride_1938_min,
    )
    new = next_today(eligible_trips, start)
    if new == NO_MORE_TRIPS_TODAY:
        raise PipelineError(f"No catchable bus left for pair {pair} at t={_hhmm(t)} ({t} min).")
    if new == NO_ONE_SEAT_RIDE:
        return RaceRow(_hhmm(t), start, a["before_table"], old, None, NO_ONE_SEAT_RIDE, None)
    today = RaceToday(**new)
    margin = today.total - old.total
    return RaceRow(_hhmm(t), start, a["before_table"], old, today, compute_result(margin), abs(margin))
