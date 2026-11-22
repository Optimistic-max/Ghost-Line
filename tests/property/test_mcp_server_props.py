"""Property tests for the MCP server's queries (R9.4), on small generated feeds."""

import csv
import hashlib
import io
import tempfile
import zipfile
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st

from pipeline import mcp_server as srv

STOPS = ["A", "B", "C"]
DATE = srv.SERVICE_DATE


def hms(seconds: int) -> str:
    return f"{seconds // 3600:02d}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


def to_seconds(text: str) -> int:
    h, m, s = (int(p) for p in text.split(":"))
    return h * 3600 + m * 60 + s


@st.composite
def trip_specs(draw):
    """{trip_id: [(seq, stop_id, seconds), ...]}: times never go backwards, hours may pass 24."""
    count = draw(st.integers(0, 6))
    specs = {}
    for n in range(count):
        length = draw(st.integers(1, 6))
        start = draw(st.integers(0, 28 * 3600))
        t = start
        calls = []
        for seq in range(1, length + 1):
            calls.append((seq * 3 + draw(st.integers(0, 2)), draw(st.sampled_from(STOPS)), t))  # unique, with gaps
            t += draw(st.integers(0, 3600))
        calls.sort(key=lambda c: c[0])
        specs[f"T{draw(st.integers(0, 999))}_{n}"] = calls
    return specs


def feed_from(specs) -> srv.Feed:
    trips, by_stop = {}, {}
    for trip_id, calls in specs.items():
        rows = tuple(srv.Call(seq, stop, t, t, hms(t), hms(t)) for seq, stop, t in sorted(calls))
        trips[trip_id] = srv.Trip(trip_id, "R", "H", rows)
        for _, stop, _ in calls:
            by_stop.setdefault(stop, set()).add(trip_id)
    return srv.Feed(
        sha256="x",
        active_service_ids=("1",),
        trips=trips,
        by_stop={k: frozenset(v) for k, v in by_stop.items()},
        stop_ids=frozenset(STOPS),
    )


def ask(feed, a, b, after=None, before=None):
    return srv.trips_serving_answer(feed, a, b, DATE, after=after, before=before)


def brute_force_ids(specs, a, b):
    """A trip serves a to b if some call at a has a later call (higher seq) at b."""
    ids = set()
    for trip_id, calls in specs.items():
        if any(s1 == a and s2 == b and q2 > q1 for q1, s1, _ in calls for q2, s2, _ in calls):
            ids.add(trip_id)
    return ids


stops = st.sampled_from(STOPS)
minutes = st.integers(0, 29 * 60)


def limit(m: int) -> str:
    return f"{m // 60}:{m % 60:02d}"


@settings(max_examples=150, deadline=None)
@given(trip_specs(), stops, stops)
def test_results_are_sorted_by_departure_then_trip_id_and_counted(specs, a, b):
    answer = ask(feed_from(specs), a, b)
    keys = [(to_seconds(t["dep_a"]), t["trip_id"]) for t in answer["trips"]]
    assert keys == sorted(keys)
    assert answer["count"] == len(answer["trips"])


@settings(max_examples=150, deadline=None)
@given(trip_specs(), stops, stops)
def test_the_set_of_trips_matches_the_plain_definition(specs, a, b):
    ids = [t["trip_id"] for t in ask(feed_from(specs), a, b)["trips"]]
    assert set(ids) == brute_force_ids(specs, a, b)


@settings(max_examples=150, deadline=None)
@given(trip_specs(), stops, stops)
def test_every_trip_boards_before_it_alights_by_stop_sequence_and_appears_once(specs, a, b):
    feed = feed_from(specs)
    answer = ask(feed, a, b)
    ids = [t["trip_id"] for t in answer["trips"]]
    assert len(ids) == len(set(ids))
    for item in answer["trips"]:
        calls = feed.trips[item["trip_id"]].calls
        boards = [i for i, c in enumerate(calls) if c.stop_id == a and c.dep_text == item["dep_a"]]
        assert boards, "dep_a must be the departure of a call at stop_a"
        first_board = min(i for i, c in enumerate(calls) if c.stop_id == a)
        # the reported board is the first call at a that has a later call at b
        assert first_board <= boards[0]
        later = [c for c in calls[boards[0] + 1 :] if c.stop_id == b and c.seq > calls[boards[0]].seq]
        assert later and later[0].arr_text == item["arr_b"]


@settings(max_examples=150, deadline=None)
@given(
    trip_specs(),
    stops,
    stops,
    st.tuples(minutes, minutes, minutes, minutes),
)
def test_widening_the_window_never_removes_a_trip(specs, a, b, m):
    lo1, hi1 = sorted(m[:2])
    lo2, hi2 = min(lo1, m[2]), max(hi1, m[3])  # window 2 contains window 1
    feed = feed_from(specs)
    narrow = {t["trip_id"] for t in ask(feed, a, b, limit(lo1), limit(hi1))["trips"]}
    wide = {t["trip_id"] for t in ask(feed, a, b, limit(lo2), limit(hi2))["trips"]}
    everything = {t["trip_id"] for t in ask(feed, a, b)["trips"]}
    assert narrow <= wide <= everything


@settings(max_examples=150, deadline=None)
@given(trip_specs(), stops, stops, minutes, minutes)
def test_limits_keep_exactly_the_trips_inside_the_inclusive_window(specs, a, b, m1, m2):
    lo, hi = sorted((m1, m2))
    feed = feed_from(specs)
    inside = ask(feed, a, b, limit(lo), limit(hi))["trips"]
    everything = ask(feed, a, b)["trips"]
    expected = [t for t in everything if lo * 60 <= to_seconds(t["dep_a"]) <= hi * 60]
    assert inside == expected


def zip_of(specs, shuffle_seed) -> tuple[Path, str, tempfile.TemporaryDirectory]:
    tmp = tempfile.TemporaryDirectory()
    rows = [[trip_id, hms(t), hms(t), stop, str(seq)] for trip_id, calls in specs.items() for seq, stop, t in calls]
    shuffle_seed.shuffle(rows)
    tables = {
        "calendar.txt": [
            ["service_id", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "start_date", "end_date"],
            ["1", "0", "0", "1", "0", "0", "0", "0", "20261001", "20261231"],
        ],
        "routes.txt": [["route_id", "route_short_name"], ["R", "R"]],
        "trips.txt": [["route_id", "service_id", "trip_id", "trip_headsign"]]
        + [["R", "1", trip_id, "H"] for trip_id in specs],
        "stops.txt": [["stop_id"]] + [[s] for s in STOPS],
        "stop_times.txt": [["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"]] + rows,
    }
    path = Path(tmp.name) / "feed.zip"
    with zipfile.ZipFile(path, "w") as zf:
        for member, table in tables.items():
            buffer = io.StringIO()
            csv.writer(buffer, lineterminator="\n").writerows(table)
            zf.writestr(member, buffer.getvalue())
    return path, hashlib.sha256(path.read_bytes()).hexdigest(), tmp


@settings(max_examples=25, deadline=None)
@given(trip_specs(), stops, stops, st.randoms(use_true_random=False), st.randoms(use_true_random=False))
def test_reordering_the_rows_of_stop_times_does_not_change_the_answer(specs, a, b, rng1, rng2):
    answers = []
    for rng in (rng1, rng2):
        path, sha, tmp = zip_of(specs, rng)
        with tmp:
            feed = srv.load_feed(path, expected_sha256=sha)
            assert feed.error is None
            answers.append(ask(feed, a, b))
    assert answers[0] == answers[1]
    assert {t["trip_id"] for t in answers[0]["trips"]} == brute_force_ids(specs, a, b)
