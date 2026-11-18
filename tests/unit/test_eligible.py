"""Tests for pipeline.eligible (active_services here; the rest comes in 12.4)."""

import datetime
import zipfile
from pathlib import Path

import pytest

from pipeline.eligible import active_services, find_eligible_trips
from pipeline.gtfs_reader import GTFSReader
from pipeline.stops import Stop

FIXTURE_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "fake-gtfs"


@pytest.fixture
def reader(tmp_path):
    path = tmp_path / "fake_gtfs.zip"
    with zipfile.ZipFile(path, "w") as zf:
        for f in FIXTURE_DIR.glob("*.txt"):
            zf.write(f, f.name)
    return GTFSReader(path, cache_dir=tmp_path / "cache")


def test_exception_type_2_removes_service(reader):
    # 2026-11-04 is a Wednesday; 1002 is removed by calendar_dates.txt.
    assert active_services(reader, datetime.date(2026, 11, 4)) == {"1001", "1003"}


def test_other_wednesday_keeps_all_calendar_services(reader):
    assert active_services(reader, datetime.date(2026, 11, 11)) == {"1001", "1002", "1003"}


def test_wrong_weekday_and_out_of_range_are_empty(reader):
    assert active_services(reader, datetime.date(2026, 11, 5)) == set()  # Thursday
    assert active_services(reader, datetime.date(2027, 1, 6)) == set()  # after end_date


def _stop(stop_id, lon, lat):
    return Stop(stop_id=stop_id, name=stop_id, lonlat=(lon, lat), walk_m=10.0, walk_min=0.18)


A1 = _stop("S_A1", -76.6198, 39.3002)
B1 = _stop("S_B1", -76.6098, 39.3002)


def test_trip_reaching_dest_before_origin_is_skipped(reader):
    # T4 (service 1003, active 2026-11-04) visits B1 (seq 1) then A1 (seq 2).
    # Going A -> B it reaches the destination before the origin: not eligible.
    date = datetime.date(2026, 11, 4)
    trips = find_eligible_trips(reader, "a", "b", [A1], [B1], {"1001", "1003"}, date)
    ids = [t.trip_id for t in trips]
    assert "T4" not in ids
    assert ids == ["T1", "T2", "T5"]
    assert all(t.alight_stop.stop_id == "S_B1" and t.arr > t.dep for t in trips)


def test_reverse_direction_only_uses_trip_that_runs_that_way(reader):
    date = datetime.date(2026, 11, 4)
    trips = find_eligible_trips(reader, "b", "a", [B1], [A1], {"1003"}, date)
    assert [t.trip_id for t in trips] == ["T4"]
    assert trips[0].dep == 540.0 and trips[0].arr == 550.0


DATE = datetime.date(2026, 11, 4)


def test_removed_service_contributes_no_trips(reader):
    # T3 runs on service 1002, removed on 2026-11-04 by exception_type 2.
    active = active_services(reader, DATE)
    trips = find_eligible_trips(reader, "a", "b", [A1], [B1], active, DATE)
    assert "T3" not in [t.trip_id for t in trips]
    assert find_eligible_trips(reader, "a", "b", [A1], [B1], {"1002"}, DATE) != []  # sanity: T3 exists
    assert [t.trip_id for t in find_eligible_trips(reader, "a", "b", [A1], [B1], set(), DATE)] == []


def test_pair_with_no_trips_returns_empty_list(reader):
    # No stop at the isolated fake stop has any trip: NO_ONE_SEAT_RIDE upstream.
    x = _stop("S_X1", -76.6400, 39.3200)
    assert find_eligible_trips(reader, "a", "x", [A1], [x], {"1001", "1003"}, DATE) == []
    assert find_eligible_trips(reader, "x", "a", [x], [A1], {"1001", "1003"}, DATE) == []


def test_empty_stop_lists_return_empty_list(reader):
    sids = {"1001", "1003"}
    assert find_eligible_trips(reader, "a", "b", [], [B1], sids, DATE) == []
    assert find_eligible_trips(reader, "a", "b", [A1], [], sids, DATE) == []
    assert find_eligible_trips(reader, "a", "b", [], [], sids, DATE) == []


def test_one_record_per_trip_sorted_by_dep(reader):
    trips = find_eligible_trips(reader, "a", "b", [A1], [B1], {"1001", "1003"}, DATE)
    ids = [t.trip_id for t in trips]
    assert len(ids) == len(set(ids))
    deps = [t.dep for t in trips]
    assert deps == sorted(deps)
    assert deps == [540.0, 570.0, 1445.0]


def test_time_strings_are_hhmmss_and_match_minutes(reader):
    trips = find_eligible_trips(reader, "a", "b", [A1], [B1], {"1001"}, DATE)
    t1 = trips[0]
    assert (t1.dep_str, t1.arr_str) == ("09:00:00", "09:10:00")
    assert (t1.dep, t1.arr, t1.ride_min) == (540.0, 550.0, 10.0)
    assert (t1.route, t1.headsign) == ("FAKE1", "Fake Corner B")
    assert (t1.access_min, t1.egress_min) == (A1.walk_min, B1.walk_min)


def test_overnight_trip_keeps_hours_past_24(reader):
    trips = find_eligible_trips(reader, "a", "b", [A1], [B1], {"1001"}, DATE)
    t5 = trips[-1]
    assert t5.trip_id == "T5"
    assert (t5.dep_str, t5.arr_str) == ("24:05:00", "24:15:00")
    assert (t5.dep, t5.arr, t5.ride_min) == (1445.0, 1455.0, 10.0)


def test_blank_time_row_is_skipped_for_b_to_a(reader):
    # T1's blank-time row at S_A1 (seq 3) must not make T1 a B -> A trip.
    assert find_eligible_trips(reader, "b", "a", [B1], [A1], {"1001"}, DATE) == []


def test_blank_time_row_skipped_cold_and_warm_cache(reader, tmp_path):
    cache = Path(reader.cache_path(DATE.isoformat()))
    assert not cache.exists()
    cold = find_eligible_trips(reader, "b", "a", [B1], [A1], {"1001"}, DATE)
    assert cache.is_file()
    assert "S_A1,3" not in cache.read_text()
    # A new reader on the same cache dir takes the warm path.
    warm_reader = GTFSReader(reader.zip_path, cache_dir=reader.cache_dir)
    warm = find_eligible_trips(warm_reader, "b", "a", [B1], [A1], {"1001"}, DATE)
    assert cold == warm == []


def test_stale_cache_with_blank_row_is_still_filtered(reader):
    # A cache written before the blank-row rule held the blank row.
    cache = reader.cache_path(DATE.isoformat())
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(
        "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n"
        "T1,09:00:00,09:00:00,S_A1,1\n"
        "T1,09:10:00,09:10:00,S_B1,2\n"
        "T1,,,S_A1,3\n",
        encoding="utf-8",
    )
    assert find_eligible_trips(reader, "b", "a", [B1], [A1], {"1001"}, DATE) == []


def test_cache_from_other_services_does_not_hide_trips(reader):
    # First call caches only T4 (service 1003); the 1001 call must still see T1, T2, T5.
    first = find_eligible_trips(reader, "b", "a", [B1], [A1], {"1003"}, DATE)
    assert [t.trip_id for t in first] == ["T4"]
    second = find_eligible_trips(reader, "a", "b", [A1], [B1], {"1001"}, DATE)
    assert [t.trip_id for t in second] == ["T1", "T2", "T5"]


def test_best_stop_pair_is_chosen_when_trip_has_several(tmp_path):
    feed = tmp_path / "fake_multi.zip"
    files = {
        "stops.txt": "stop_id,stop_name,stop_lat,stop_lon\nP1,p1,39.3,-76.6\n",
        "routes.txt": "route_id,route_short_name,route_long_name\nR,FAKE9,Fake 9\n",
        "trips.txt": "route_id,service_id,trip_id,trip_headsign\nR,S,X,Fake Head\n",
        "stop_times.txt": (
            "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n"
            "X,08:00:00,08:00:00,P1,1\n"
            "X,08:05:00,08:05:00,P2,2\n"
            "X,08:10:00,08:10:00,Q1,3\n"
            "X,08:20:00,08:20:00,Q2,4\n"
        ),
    }
    with zipfile.ZipFile(feed, "w") as zf:
        for name, text in files.items():
            zf.writestr(name, text)
    rd = GTFSReader(feed, cache_dir=tmp_path / "cache")

    def stop(sid, walk):
        return Stop(stop_id=sid, name=sid, lonlat=(-76.6, 39.3), walk_m=walk * 10, walk_min=walk)

    # Shortest origin walk wins (P2), then shortest dest walk (Q2).
    trips = find_eligible_trips(
        rd, "o", "d", [stop("P1", 5.0), stop("P2", 2.0)], [stop("Q1", 4.0), stop("Q2", 1.0)], {"S"}, DATE
    )
    assert len(trips) == 1
    t = trips[0]
    assert (t.board_stop.stop_id, t.alight_stop.stop_id) == ("P2", "Q2")
    assert (t.dep_str, t.arr_str) == ("08:05:00", "08:20:00")
    assert (t.access_min, t.egress_min) == (2.0, 1.0)

    # Equal walks: the earlier board and alight sequence win.
    trips = find_eligible_trips(
        rd, "o", "d", [stop("P1", 3.0), stop("P2", 3.0)], [stop("Q1", 3.0), stop("Q2", 3.0)], {"S"}, DATE
    )
    assert (trips[0].board_stop.stop_id, trips[0].alight_stop.stop_id) == ("P1", "Q1")
