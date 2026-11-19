"""Per-line summary: ride verdicts, gaps, waits and totals.

Values keep full precision here. Rounding to three decimals happens at emit.
"""

from __future__ import annotations

import statistics
import warnings
from dataclasses import dataclass, field

from pipeline.clock import ride_minutes

GAP_WINDOW_START = 540.0  # 09:00
GAP_WINDOW_END = 840.0  # 14:00, excluded

SAME_FLOOR_MIN = 1.5
SAME_FRACTION = 0.15


def ride_verdict(delta: float, ride_1938: float) -> str:
    """Compare today's median ride with the 1938 ride.

    delta = ride_today_median - ride_1938, in minutes.
    "same" if |delta| <= max(1.5, 0.15 * ride_1938); otherwise
    "faster today" (delta < 0) or "slower today" (delta > 0).
    """
    threshold = max(SAME_FLOOR_MIN, SAME_FRACTION * ride_1938)
    if abs(delta) <= threshold:
        return "same"
    return "faster today" if delta < 0 else "slower today"


def find_gaps(trips, window_start: float, window_end: float) -> tuple[float, float]:
    """Smallest and largest gap between adjacent departures in a window.

    Uses EligibleTrip.dep (minutes after midnight, boarding stop) for trips with
    window_start <= dep < window_end, sorted ascending. compute_summary calls
    this with 540.0 and 840.0 (09:00 to 14:00, end excluded). Returns
    (gap_min, gap_max) as floats at full precision; emit rounds to 3 decimals.

    Equal departures give a gap of 0.0. Fewer than two departures in the window
    leave no gap to measure, so this raises ValueError rather than invent one.
    The caller decides how to report that pair.
    """
    return gaps_in_window([t.dep for t in trips], window_start, window_end)


def gaps_in_window(times, window_start: float, window_end: float) -> tuple[float, float]:
    """Smallest and largest difference between adjacent times (minutes after
    midnight) that fall in [window_start, window_end).

    Used for the bus departures and for the 1938 passes at a corner. Fewer than
    two times in the window raises ValueError: no gap is invented.
    """
    deps = sorted(t for t in times if window_start <= t < window_end)
    if len(deps) < 2:
        raise ValueError(
            f"need at least two departures in [{window_start}, {window_end}) "
            f"to measure a gap; found {len(deps)}"
        )
    gaps = [float(b - a) for a, b in zip(deps, deps[1:])]
    return min(gaps), max(gaps)


def arrival_weighted_wait(gaps) -> float | None:
    """Expected wait for a rider arriving at a random time, in minutes.

    = sum(g * g for g in gaps) / (2 * sum(gaps)), at full precision.

    If gaps is empty or sums to zero the value is undefined. This returns None
    and calls warnings.warn (a UserWarning, shown on stderr by default and
    capturable with pytest.warns) so the problem is visible and no number is
    invented. The caller must not treat None as zero.
    """
    gaps = list(gaps)
    total = sum(gaps)
    if not gaps or total == 0:
        warnings.warn(
            "arrival_weighted_wait: gaps are empty or sum to zero; "
            "returning None",
            UserWarning,
            stacklevel=2,
        )
        return None
    return sum(g * g for g in gaps) / (2 * total)


@dataclass
class PairSummary:
    """One directed pair. Full precision; emit rounds.

    For a pair with no one-seat ride today, ride_today_median, delta and
    ride_verdict are None. gap_min and gap_max are None when fewer than two
    eligible departures fall in the window. Nothing is invented.
    """

    origin: str
    dest: str
    races: int
    wins_1938: int
    wins_today: int
    photo_finishes: int
    ride_1938: float
    ride_today_median: float | None
    delta: float | None
    ride_verdict: str | None
    gap_min: float | None
    gap_max: float | None


@dataclass
class TodayWin:
    origin: str
    dest: str
    t: str  # slider time "HH:MM"
    margin: float  # minutes, full precision


@dataclass
class Summary:
    pairs: list[PairSummary]
    races: int
    wins_1938: int
    wins_today: int
    photo_finishes: int
    ride_same: int
    ride_faster_today: int
    ride_slower_today: int
    pairs_without_one_seat_ride: int
    today_wins: list[TodayWin] = field(default_factory=list)


def compute_summary(races, eligible, facts) -> Summary:
    """Per-pair counts, ride verdicts, gaps and overall totals (race-brief 5.6).

    Only rows with t >= the pair's covered_from are counted (B12). RaceRow
    flags the others with before_table = True, so those rows are skipped.
    Full precision throughout.
    """
    pairs: list[PairSummary] = []
    today_wins: list[TodayWin] = []
    for (origin, dest), rows in races.items():
        counted = [r for r in rows if not r.before_table]
        wins_1938 = sum(r.result == "1938" for r in counted)
        wins_today = sum(r.result == "today" for r in counted)
        photo = sum(r.result == "photo_finish" for r in counted)
        ride_1938 = ride_minutes(origin, dest, facts)

        rides = [r.today.ride for r in counted if r.today is not None]
        if rides:
            median = float(statistics.median(rides))
            delta = median - ride_1938
            verdict = ride_verdict(delta, ride_1938)
        else:
            median = delta = verdict = None

        trips = eligible.get((origin, dest), [])
        try:
            gap_min, gap_max = find_gaps(trips, GAP_WINDOW_START, GAP_WINDOW_END)
        except ValueError:
            gap_min = gap_max = None

        for r in counted:
            if r.result == "today":
                today_wins.append(TodayWin(origin, dest, r.t, r.margin))

        pairs.append(
            PairSummary(
                origin, dest, len(counted), wins_1938, wins_today, photo,
                ride_1938, median, delta, verdict, gap_min, gap_max,
            )
        )

    verdicts = [p.ride_verdict for p in pairs]
    return Summary(
        pairs=pairs,
        races=sum(p.races for p in pairs),
        wins_1938=sum(p.wins_1938 for p in pairs),
        wins_today=sum(p.wins_today for p in pairs),
        photo_finishes=sum(p.photo_finishes for p in pairs),
        ride_same=verdicts.count("same"),
        ride_faster_today=verdicts.count("faster today"),
        ride_slower_today=verdicts.count("slower today"),
        pairs_without_one_seat_ride=sum(p.ride_verdict is None for p in pairs),
        today_wins=today_wins,
    )
