"""
Property tests P2: walk time (race-brief.md section 5.3).

**Validates: Requirements 4.2**
"""

import pytest
from hypothesis import given

from pipeline.stops import compute_walk_time, geodesic_distance
from tests.property.conftest import positive_distance_m, walk_distance_m

from hypothesis import strategies as st

lon = st.floats(min_value=-76.7, max_value=-76.5, allow_nan=False)
lat = st.floats(min_value=39.2, max_value=39.4, allow_nan=False)
lonlat = st.tuples(lon, lat)


@given(st.floats(min_value=0.0, max_value=10000.0, allow_nan=False))
def test_walk_time_never_negative(metres):
    assert compute_walk_time(metres) >= 0.0


@given(lonlat, lonlat)
def test_distance_is_symmetric(a, b):
    assert geodesic_distance(a, b) == pytest.approx(geodesic_distance(b, a), abs=1e-6)


@given(positive_distance_m())
def test_doubling_metres_doubles_minutes(metres):
    assert compute_walk_time(2 * metres) == pytest.approx(2 * compute_walk_time(metres))


@given(walk_distance_m())
def test_walk_within_radius_is_at_most_7_223_minutes(metres):
    assert compute_walk_time(metres) <= 7.223
