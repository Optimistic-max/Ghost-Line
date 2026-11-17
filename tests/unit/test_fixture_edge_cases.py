"""Checks that the fake fixtures cover the edge cases of task 5 (5.1 to 5.4)."""
import csv
from pathlib import Path

import yaml
from pyproj import Geod

FIX = Path(__file__).resolve().parents[1] / "fixtures"
FAKE = FIX / "fake-gtfs"
GEOD = Geod(ellps="WGS84")


def read(name):
    with open(FAKE / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def timed_stops(trip_id):
    rows = [r for r in read("stop_times.txt") if r["trip_id"] == trip_id and r["arrival_time"]]
    return {r["stop_id"]: int(r["stop_sequence"]) for r in rows}


def test_fake_line_has_two_corners_and_one_leg_per_direction():
    facts = yaml.safe_load((FIX / "fake-line.yaml").read_text(encoding="utf-8"))
    assert len(facts["timing_points"]) == 2
    assert facts["timing_points"][0]["minutes"] == 0
    assert len(facts["legs"]["eastbound"]) == 1
    assert len(facts["legs"]["westbound"]) == 1
    for d in ("eastbound", "westbound"):
        assert {"minutes_past_hour", "first", "last"} <= set(facts["midday_departures"][d])
        leg = facts["legs"][d][0]
        assert leg["street"] and leg["method"] == "inferred" and leg["length_m"] > 0
        assert all(len(p) == 2 and p[0] < 0 < p[1] for p in leg["points_lonlat"])


def test_fake_line_leg_length_matches_geodesic():
    facts = yaml.safe_load((FIX / "fake-line.yaml").read_text(encoding="utf-8"))
    for leg in (facts["legs"]["eastbound"][0], facts["legs"]["westbound"][0]):
        pts = leg["points_lonlat"]
        total = sum(
            GEOD.inv(a[0], a[1], b[0], b[1])[2] for a, b in zip(pts, pts[1:])
        )
        assert abs(total - leg["length_m"]) <= max(1.0, 0.005 * leg["length_m"])


def test_service_removed_by_exception_type_2():
    removed = [r for r in read("calendar_dates.txt") if r["exception_type"] == "2"]
    assert removed
    cal_ids = {r["service_id"] for r in read("calendar.txt")}
    trip_services = {r["service_id"] for r in read("trips.txt")}
    for r in removed:
        assert r["service_id"] in cal_ids
        assert r["service_id"] in trip_services
        assert r["date"] == "20261104"


def test_trip_reaches_destination_before_origin():
    # T4 visits corner B stop before corner A stop: invalid for A to B.
    seq = timed_stops("T4")
    assert seq["S_B1"] < seq["S_A1"]
    # A valid trip goes the other way.
    ok = timed_stops("T1")
    assert ok["S_A1"] < ok["S_B1"]


def test_pair_with_no_trips_exists():
    # S_X1 is served by no trip. A test corner placed at S_X1 gives a pair with no trips.
    stops = {r["stop_id"]: r for r in read("stops.txt")}
    assert "S_X1" in stops
    assert "S_X1" not in {r["stop_id"] for r in read("stop_times.txt")}
    facts = yaml.safe_load((FIX / "fake-line.yaml").read_text(encoding="utf-8"))
    x = stops["S_X1"]
    for tp in facts["timing_points"]:
        lon, lat = tp["lonlat"]
        d = GEOD.inv(lon, lat, float(x["stop_lon"]), float(x["stop_lat"]))[2]
        assert d > 400.0


def test_fixture_files_are_named_fake():
    assert (FIX / "fake-line.yaml").exists()
    assert FAKE.name == "fake-gtfs"
    assert "fake" in (FIX / "fake-line.yaml").read_text(encoding="utf-8").lower().split("\n")[3].lower()
    assert all("fake" in r["stop_name"].lower() for r in read("stops.txt"))
    assert all("fake" in r["route_long_name"].lower() for r in read("routes.txt"))
    assert all("fake" in r["trip_headsign"].lower() for r in read("trips.txt"))
