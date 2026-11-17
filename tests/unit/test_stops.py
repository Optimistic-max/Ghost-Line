"""Tests for pipeline.stops: walk formula (race-brief 5.3 cases 1-4), distance, stop search."""

import zipfile
from pathlib import Path

import pytest

from pipeline.facts import load_facts
from pipeline.gtfs_reader import GTFSReader
from pipeline.stops import (
    compute_walk_time,
    find_stops_near_corners,
    geodesic_distance,
)

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


# Brief section 5.3 cases 1-4. Expected values are the brief's, to 3 decimals.
@pytest.mark.parametrize(
    "metres, expected",
    [
        (125.07, 2.258),  # case 1
        # case 2: the brief's 4.156 belongs to stop 9486's unrounded (real)
        # distance, not to the rounded 230.15 m input (230.15 -> 4.155).
        (230.15, 4.155),
        (0.0, 0.0),  # case 3
        (400.0, 7.222),  # case 4
    ],
)
def test_walk_formula_brief_cases(metres, expected):
    assert compute_walk_time(metres) == pytest.approx(expected, abs=0.0005)


@pytest.fixture
def fake_reader(tmp_path):
    path = tmp_path / "fake_gtfs.zip"
    with zipfile.ZipFile(path, "w") as zf:
        for f in (FIXTURES / "fake-gtfs").glob("*.txt"):
            zf.write(f, f.name)
    return GTFSReader(path, cache_dir=tmp_path / "cache")


@pytest.fixture
def fake_corners():
    return load_facts(FIXTURES / "fake-line.yaml").timing_points


def test_geodesic_distance_zero_and_symmetric():
    a, b = (-76.62, 39.30), (-76.61, 39.30)
    assert geodesic_distance(a, a) == 0.0
    assert geodesic_distance(a, b) == pytest.approx(geodesic_distance(b, a))


def test_geodesic_distance_one_degree_latitude():
    # One degree of latitude near 39.3 N is about 111 km on WGS84.
    d = geodesic_distance((-76.62, 39.0), (-76.62, 40.0))
    assert 110_800 < d < 111_300


def test_find_stops_near_corners_fake_feed(fake_reader, fake_corners):
    result = find_stops_near_corners(fake_reader, fake_corners)
    assert set(result) == {"fake-corner-a", "fake-corner-b"}
    assert {s.stop_id for s in result["fake-corner-a"]} == {"S_A1", "S_A2"}
    assert {s.stop_id for s in result["fake-corner-b"]} == {"S_B1", "S_B2"}
    for stops in result.values():
        assert [s.walk_m for s in stops] == sorted(s.walk_m for s in stops)
        for s in stops:
            assert 0 < s.walk_m <= 400.0
            assert s.walk_min == pytest.approx(compute_walk_time(s.walk_m))


def test_find_stops_radius_excludes_far_stops(fake_reader, fake_corners):
    result = find_stops_near_corners(fake_reader, fake_corners, radius_m=1.0)
    assert result == {"fake-corner-a": [], "fake-corner-b": []}
