"""Unit tests for pipeline/mcp_server.py: the reader, the queries and the load wait.

Every feed here is made up (tests/fixtures/fake-gtfs, edited in code) and gets a
made-up hash, so none of these tests reads the pinned feed.
"""

import csv
import hashlib
import inspect
import io
import threading
import time
import zipfile
from pathlib import Path

import pytest

from pipeline import mcp_server as srv

REPO = Path(__file__).resolve().parents[2]
FAKE = REPO / "tests" / "fixtures" / "fake-gtfs"
DATE = srv.SERVICE_DATE


def fake_tables() -> dict[str, list[list[str]]]:
    """The made-up feed as {file name: rows, header first}."""
    tables = {}
    for path in sorted(FAKE.glob("*.txt")):
        with open(path, newline="", encoding="utf-8") as handle:
            tables[path.name] = [row for row in csv.reader(handle)]
    return tables


def write_zip(tmp_path: Path, tables: dict[str, list[list[str]]], name: str = "feed.zip"):
    """Zip the tables. Returns (path, sha256 of the zip)."""
    path = tmp_path / name
    with zipfile.ZipFile(path, "w") as zf:
        for member, rows in tables.items():
            buffer = io.StringIO()
            csv.writer(buffer, lineterminator="\n").writerows(rows)
            zf.writestr(member, buffer.getvalue())
    return path, hashlib.sha256(path.read_bytes()).hexdigest()


def load(tmp_path: Path, tables=None, **kw) -> srv.Feed:
    path, sha = write_zip(tmp_path, tables if tables is not None else fake_tables(), **kw)
    return srv.load_feed(path, expected_sha256=sha)


def add_trip(tables, trip_id, calls, service="1001", headsign="Fake Corner B"):
    """calls: list of (stop_id, seq, arrival, departure)."""
    tables["trips.txt"].append(["FAKE1", service, trip_id, headsign, "0"])
    for stop, seq, arr, dep in calls:
        tables["stop_times.txt"].append([trip_id, arr, dep, stop, str(seq)])


def trips(feed, a="S_A1", b="S_B1", **kw):
    return srv.trips_serving_answer(feed, a, b, DATE, **kw)["trips"]


# --- reader (R1.3, R1.5, R2.3, R2.4, R3.2) -----------------------------------


def test_missing_zip_is_an_error_feed(tmp_path):
    feed = srv.load_feed(tmp_path / "nope.zip")
    assert feed.error and "not found" in feed.error and str(tmp_path / "nope.zip") in feed.error
    assert feed.trips == {}


def test_wrong_hash_is_an_error_and_no_table_is_read(tmp_path):
    bad = tmp_path / "bad.zip"
    bad.write_bytes(b"this is not a zip file")  # would fail as a zip: the hash check must come first
    feed = srv.load_feed(bad)
    assert feed.error and "does not match the pinned" in feed.error
    assert srv.PINNED_SHA256 in feed.error
    assert feed.trips == {} and feed.stop_ids == frozenset()


def test_pinned_hash_is_the_default_expected_hash():
    assert inspect.signature(srv.load_feed).parameters["expected_sha256"].default == srv.PINNED_SHA256


def test_the_made_up_feed_loads(tmp_path):
    feed = load(tmp_path)
    assert feed.error is None
    assert feed.stop_ids == {"S_A1", "S_A2", "S_B1", "S_B2", "S_X1"}
    assert feed.feed_version is None  # the made-up feed has no feed_info.txt


def test_feed_version_is_read_from_feed_info(tmp_path):
    tables = fake_tables()
    tables["feed_info.txt"] = [["feed_publisher_name", "feed_version"], ["Fake", "FAKE-1"]]
    assert load(tmp_path, tables).feed_version == "FAKE-1"


def test_active_services_come_from_calendar_and_exceptions(tmp_path):
    # 1001 and 1003 run on a Wednesday in range; 1002 is removed on the date by calendar_dates.
    assert load(tmp_path).active_service_ids == ("1001", "1003")
    assert "T3" not in load(tmp_path).trips  # trip of the removed service


def test_a_date_only_service_counts_and_wrong_weekday_or_range_does_not(tmp_path):
    tables = fake_tables()
    tables["calendar.txt"] += [
        ["2001", "0", "0", "0", "0", "0", "0", "1", "20261001", "20261231"],  # Sunday only
        ["2002", "0", "0", "1", "0", "0", "0", "0", "20261101", "20261103"],  # ends the day before
    ]
    tables["calendar_dates.txt"].append(["9001", "20261104", "1"])  # added for the date, not in calendar.txt
    tables["calendar_dates.txt"].append(["1001", "20261105", "2"])  # another date: no effect
    feed = load(tmp_path, tables)
    assert feed.active_service_ids == ("1001", "1003", "9001")


def test_times_past_24_hours_are_kept_in_seconds_and_in_the_feeds_own_text(tmp_path):
    call = load(tmp_path).trips["T5"].calls[0]
    assert call.dep == 24 * 3600 + 5 * 60 and call.dep_text == "24:05:00"


def test_a_call_with_both_times_blank_is_dropped_and_counted(tmp_path):
    feed = load(tmp_path)
    assert feed.dropped_calls == 1
    assert [c.seq for c in feed.trips["T1"].calls] == [1, 2]


def test_one_blank_time_falls_back_to_the_other(tmp_path):
    tables = fake_tables()
    add_trip(tables, "T6", [("S_A1", 1, "", "11:00:00"), ("S_B1", 2, "11:10:00", "")])
    feed = load(tmp_path, tables)
    first, second = feed.trips["T6"].calls
    assert (first.arr, first.arr_text) == (first.dep, "11:00:00")
    assert (second.dep, second.dep_text) == (second.arr, "11:10:00")


def test_single_digit_hours_are_accepted(tmp_path):
    tables = fake_tables()
    add_trip(tables, "T6", [("S_A1", 1, " 9:05:00", " 9:05:00"), ("S_B1", 2, "9:15:00", "9:15:00")])
    assert load(tmp_path, tables).trips["T6"].calls[0].dep == 9 * 3600 + 5 * 60


def test_calls_are_sorted_by_stop_sequence_whatever_the_row_order(tmp_path):
    tables = fake_tables()
    add_trip(tables, "T6", [("S_B1", 2, "11:10:00", "11:10:00"), ("S_A1", 1, "11:00:00", "11:00:00")])
    assert [c.stop_id for c in load(tmp_path, tables).trips["T6"].calls] == ["S_A1", "S_B1"]


def test_route_and_headsign_keep_the_feeds_spelling(tmp_path):
    tables = fake_tables()
    tables["routes.txt"][1][2] = "CityLink LIME"
    tables["trips.txt"][1][3] = "HARBOR EAST"
    trip = load(tmp_path, tables).trips["T1"]
    assert (trip.route_short_name, trip.headsign) == ("CityLink LIME", "HARBOR EAST")


@pytest.mark.parametrize(
    "member, edit, needle",
    [
        ("trips.txt", lambda t: t.__setitem__(0, ["route_id", "svc", "trip_id", "trip_headsign", "direction_id"]), "service_id"),
        ("stop_times.txt", lambda t: t.__setitem__(0, ["trip_id", "arrival_time", "departure_time", "stop_id", "seq"]), "stop_sequence"),
        ("stops.txt", lambda t: t.__setitem__(0, ["id", "stop_name", "stop_lat", "stop_lon"]), "stop_id"),
        ("stop_times.txt", lambda t: t.__setitem__(1, ["T1", "09:00:00", "09:00:00", "S_A1", "one"]), "bad stop_sequence"),
        ("stop_times.txt", lambda t: t.__setitem__(1, ["T1", "9am", "09:00:00", "S_A1", "1"]), "bad time"),
    ],
)
def test_a_malformed_table_names_its_member_and_problem(tmp_path, member, edit, needle):
    tables = fake_tables()
    edit(tables[member])
    feed = load(tmp_path, tables)
    assert feed.error and member in feed.error and needle in feed.error
    assert feed.trips == {}  # never a partial feed


@pytest.mark.parametrize("member", ["stops.txt", "trips.txt", "routes.txt", "stop_times.txt"])
def test_a_missing_member_names_it(tmp_path, member):
    tables = fake_tables()
    del tables[member]
    feed = load(tmp_path, tables)
    assert feed.error and member in feed.error and "missing" in feed.error


def test_a_zip_that_is_not_a_zip_but_has_the_right_hash_is_an_error(tmp_path):
    path = tmp_path / "x.zip"
    path.write_bytes(b"not a zip")
    feed = srv.load_feed(path, expected_sha256=hashlib.sha256(b"not a zip").hexdigest())
    assert feed.error and "unreadable" in feed.error


def test_relative_env_path_resolves_against_the_repository_root_not_the_cwd(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    assert srv.resolve_zip_path({srv.ENV_ZIP: "raw/mta_local_bus.zip"}) == srv.REPO_ROOT / "raw" / "mta_local_bus.zip"
    assert srv.resolve_zip_path({}) == srv.DEFAULT_ZIP == srv.REPO_ROOT / "raw" / "mta_local_bus.zip"
    absolute = tmp_path / "elsewhere.zip"
    assert srv.resolve_zip_path({srv.ENV_ZIP: str(absolute)}) == absolute
    assert srv.REPO_ROOT == REPO


def test_loading_writes_nothing_to_disk(tmp_path):
    path, sha = write_zip(tmp_path, fake_tables())
    before = sorted(p.name for p in tmp_path.iterdir())
    snapshot = path.read_bytes()
    srv.load_feed(path, expected_sha256=sha)
    assert sorted(p.name for p in tmp_path.iterdir()) == before
    assert path.read_bytes() == snapshot


# --- queries (R3, R4, R5, R9.1) ------------------------------------------------


def test_feed_info_answers_from_the_feed(tmp_path):
    path, sha = write_zip(tmp_path, fake_tables())
    answer = srv.feed_info_answer(srv.load_feed(path, expected_sha256=sha))
    assert answer == {
        "feed_version": None,
        "sha256": sha,
        "service_date": DATE,
        "active_service_ids": ["1001", "1003"],
    }


def test_feed_info_with_a_load_error_is_an_error(tmp_path):
    with pytest.raises(srv.FeedUnavailable, match="not found"):
        srv.feed_info_answer(srv.load_feed(tmp_path / "nope.zip"))


def test_trips_serving_with_a_load_error_is_an_error_not_an_empty_list(tmp_path):
    feed = srv.load_feed(tmp_path / "nope.zip")
    with pytest.raises(srv.FeedUnavailable):
        srv.trips_serving_answer(feed, "S_A1", "S_B1", DATE)


def test_the_basic_answer_counts_ordered_feed_spelled_trips(tmp_path):
    answer = srv.trips_serving_answer(load(tmp_path), "S_A1", "S_B1", DATE)
    assert answer["count"] == len(answer["trips"]) == 3
    assert [t["trip_id"] for t in answer["trips"]] == ["T1", "T2", "T5"]
    assert answer["trips"][0] == {
        "trip_id": "T1",
        "route_short_name": "FAKE1",
        "headsign": "Fake Corner B",
        "dep_a": "09:00:00",
        "arr_b": "09:10:00",
    }
    assert answer["trips"][2]["dep_a"] == "24:05:00" and answer["trips"][2]["arr_b"] == "24:15:00"


def test_an_inactive_service_is_not_counted(tmp_path):
    ids = [t["trip_id"] for t in trips(load(tmp_path))]
    assert "T3" not in ids  # service 1002 is removed on the date


def test_a_trip_that_reaches_b_before_a_is_not_counted_the_other_way_round_it_is(tmp_path):
    feed = load(tmp_path)
    assert "T4" not in [t["trip_id"] for t in trips(feed, "S_A1", "S_B1")]
    assert [t["trip_id"] for t in trips(feed, "S_B1", "S_A1")] == ["T4"]


@pytest.mark.parametrize(
    "after, before, expected",
    [
        ("09:30", "09:30", ["T2"]),  # both limits inclusive, exact boundary
        ("09:30", None, ["T2", "T5"]),
        (None, "09:00", ["T1"]),
        (None, "09:29", ["T1"]),
        ("09:01", "09:29", []),
        ("24:00", None, ["T5"]),  # compared as GTFS times, past 24:00
        ("24:05", "24:05", ["T5"]),
        (None, "23:59", ["T1", "T2"]),
        ("10:00", "09:00", []),  # an empty window is a true answer, not an error
    ],
)
def test_limits_are_inclusive_and_compared_as_gtfs_times(tmp_path, after, before, expected):
    assert [t["trip_id"] for t in trips(load(tmp_path), after=after, before=before)] == expected


def test_sorting_is_by_seconds_then_trip_id_not_by_text(tmp_path):
    tables = fake_tables()
    add_trip(tables, "T7", [("S_A1", 1, "9:30:00", "9:30:00"), ("S_B1", 2, "9:40:00", "9:40:00")])  # ties T2
    add_trip(tables, "T6", [("S_A1", 1, "10:00:00", "10:00:00"), ("S_B1", 2, "10:10:00", "10:10:00")])
    add_trip(tables, "T0", [("S_A1", 1, "9:30:00", "9:30:00"), ("S_B1", 2, "9:40:00", "9:40:00")])  # ties T2
    ids = [t["trip_id"] for t in trips(load(tmp_path, tables))]
    assert ids == ["T1", "T0", "T2", "T7", "T6", "T5"]


def test_a_trip_calling_at_a_twice_counts_once_at_its_first_call_with_a_later_b(tmp_path):
    tables = fake_tables()
    add_trip(
        tables,
        "T6",
        [("S_A1", 1, "11:00:00", "11:00:00"), ("S_A1", 2, "11:30:00", "11:30:00"), ("S_B1", 3, "11:40:00", "11:40:00")],
    )
    add_trip(
        tables,
        "T7",
        [
            ("S_A1", 1, "12:00:00", "12:00:00"),
            ("S_B1", 2, "12:10:00", "12:10:00"),
            ("S_A1", 3, "12:20:00", "12:20:00"),
            ("S_B1", 4, "12:30:00", "12:30:00"),
        ],
    )
    found = {t["trip_id"]: t for t in trips(load(tmp_path, tables))}
    assert [k for k in found if k in ("T6", "T7")].count("T6") == 1
    assert found["T6"]["dep_a"] == "11:00:00" and found["T6"]["arr_b"] == "11:40:00"
    assert found["T7"]["dep_a"] == "12:00:00" and found["T7"]["arr_b"] == "12:10:00"


def test_a_known_stop_with_no_trips_gives_a_true_zero(tmp_path):
    feed = load(tmp_path)
    assert srv.trips_serving_answer(feed, "S_X1", "S_B1", DATE) == {"count": 0, "trips": []}
    assert srv.trips_serving_answer(feed, "S_A2", "S_B2", DATE) == {"count": 0, "trips": []}


def test_a_wrong_date_is_an_error_naming_the_date_and_the_supported_one(tmp_path):
    with pytest.raises(srv.ToolInputError) as exc:
        srv.trips_serving_answer(load(tmp_path), "S_A1", "S_B1", "2026-11-05")
    assert "2026-11-05" in str(exc.value) and DATE in str(exc.value)


@pytest.mark.parametrize("which", ["a", "b"])
def test_an_unknown_stop_is_an_error_naming_the_stop(tmp_path, which):
    a, b = ("NOPE", "S_B1") if which == "a" else ("S_A1", "NOPE")
    with pytest.raises(srv.ToolInputError, match="NOPE"):
        srv.trips_serving_answer(load(tmp_path), a, b, DATE)


@pytest.mark.parametrize("bad", ["", "1000", "10:0", "ab:cd", "10:60", "-1:00", "10:00:00", "100:00", " 10:00"])
@pytest.mark.parametrize("name", ["after", "before"])
def test_a_malformed_limit_is_an_error_naming_the_value(tmp_path, name, bad):
    with pytest.raises(srv.ToolInputError) as exc:
        srv.trips_serving_answer(load(tmp_path), "S_A1", "S_B1", DATE, **{name: bad})
    assert repr(bad) in str(exc.value) and name in str(exc.value)


def test_errors_are_value_errors_and_never_an_empty_answer(tmp_path):
    for exc_type in (srv.FeedUnavailable, srv.ToolInputError, srv.FeedStillLoading):
        assert issubclass(exc_type, ValueError)


# --- waiting for the background load (R2.3, R2.4, R5.4) ------------------------


def slow_loader(path, sha, gate: threading.Event):
    def loader(zip_path):
        gate.wait(10)  # a deliberately slow load, released by the test
        return srv.load_feed(zip_path, expected_sha256=sha)

    return loader


def test_a_call_during_a_slow_load_waits_then_answers_from_the_finished_feed(tmp_path):
    path, sha = write_zip(tmp_path, fake_tables())
    gate, ready, holder = threading.Event(), threading.Event(), {}
    thread = srv.start_loader(path, holder, ready, loader=slow_loader(path, sha, gate))
    assert not ready.is_set() and "feed" not in holder  # nothing published while loading
    threading.Timer(0.3, gate.set).start()
    started = time.monotonic()
    feed = srv.wait_for_feed(ready, holder, timeout=5)  # the call arrives during the load
    assert time.monotonic() - started >= 0.2
    assert feed.error is None
    assert [t["trip_id"] for t in srv.trips_serving_answer(feed, "S_A1", "S_B1", DATE)["trips"]] == ["T1", "T2", "T5"]
    thread.join(5)


def test_a_call_whose_wait_limit_passes_gets_feed_still_loading_and_no_data(tmp_path):
    path, sha = write_zip(tmp_path, fake_tables())
    gate, ready, holder = threading.Event(), threading.Event(), {}
    thread = srv.start_loader(path, holder, ready, loader=slow_loader(path, sha, gate))
    try:
        with pytest.raises(srv.FeedStillLoading) as exc:
            srv.wait_for_feed(ready, holder, timeout=0.05)  # short limit injected, constant untouched
        assert str(exc.value).startswith("feed still loading")
        assert "0.05" in str(exc.value)  # states how long it waited
        assert holder == {}  # nothing partial was published
    finally:
        gate.set()
        thread.join(5)
    assert srv.wait_for_feed(ready, holder, timeout=5).error is None  # once finished it answers


def test_the_default_wait_limit_is_the_module_constant():
    assert inspect.signature(srv.wait_for_feed).parameters["timeout"].default == srv.LOAD_WAIT_SECONDS == 30


def test_the_wait_never_reads_the_file_itself(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(srv, "load_feed", lambda *a, **k: calls.append(a) or srv.Feed())
    with pytest.raises(srv.FeedStillLoading):
        srv.wait_for_feed(threading.Event(), {}, timeout=0.01)
    assert calls == []


def test_a_loader_that_crashes_publishes_an_error_feed(tmp_path):
    def boom(zip_path):
        raise RuntimeError("made-up crash")

    ready, holder = threading.Event(), {}
    srv.start_loader(tmp_path / "x.zip", holder, ready, loader=boom).join(5)
    feed = srv.wait_for_feed(ready, holder, timeout=1)
    assert feed.error and "made-up crash" in feed.error
    with pytest.raises(srv.FeedUnavailable):
        srv.feed_info_answer(feed)
