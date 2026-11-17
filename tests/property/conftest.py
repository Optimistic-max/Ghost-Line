"""
Shared Hypothesis strategies for race-engine property tests.

All strategies are plain functions (not pytest fixtures) so they can be used
directly with @given in any test file. They are also importable by name:

    from tests.property.conftest import time_of_day, positive_distance_m, ...
"""

from hypothesis import strategies as st


def time_of_day():
    """
    Float in [0.0, 1439.999] — minutes after midnight, 3-decimal precision.

    Covers any moment in a 24-hour day.  Times are stored to 3 decimal places
    per FR-9.7 / data-constraints in requirements.md.
    """
    return st.floats(
        min_value=0.0,
        max_value=1439.999,
        allow_nan=False,
        allow_infinity=False,
    ).map(lambda t: round(t, 3))


def window_time():
    """
    Float in [540.0, 836.0] — the racing window (09:00–13:56).

    540 = 9 × 60 (first eastbound departure).
    836 = 13 × 60 + 56 (last westbound departure).
    """
    return st.floats(
        min_value=540.0,
        max_value=836.0,
        allow_nan=False,
        allow_infinity=False,
    ).map(lambda t: round(t, 3))


def positive_distance_m():
    """
    Float in (0.0, 10000.0] — a realistic distance in metres.

    Covers any inter-stop distance on the route.
    """
    return st.floats(
        min_value=0.005,
        max_value=10000.0,
        allow_nan=False,
        allow_infinity=False,
    ).map(lambda d: round(d, 2))


def walk_distance_m():
    """
    Float in (0.0, 400.0] — a walk distance within the stop-search radius.

    400 m is the hard radius used by find_stops_near_corners (FR-4.1).
    """
    return st.floats(
        min_value=0.005,
        max_value=400.0,
        allow_nan=False,
        allow_infinity=False,
    ).map(lambda d: round(d, 2))


def corner_index():
    """
    Integer in [0, 4] — index into the 5 timing points.

    The 1938 line has exactly 5 corners (FR-2.2).
    """
    return st.integers(min_value=0, max_value=4)


def minute_parts():
    """
    List of 2–5 non-negative floats — phase durations before display rounding.

    Used by display_rounding property tests (P8).  Each element represents one
    phase (e.g., access, wait, ride, egress).  Values are in [0.0, 60.0] so
    that the rounded total stays in a sensible range.
    """
    return st.lists(
        st.floats(
            min_value=0.0,
            max_value=60.0,
            allow_nan=False,
            allow_infinity=False,
        ).map(lambda x: round(x, 3)),
        min_size=2,
        max_size=5,
    )
