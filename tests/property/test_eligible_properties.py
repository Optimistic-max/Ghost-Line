"""
Property tests for pipeline.eligible (P3), on small made-up ("fake") feeds.

Each example builds a tiny GTFS zip in a temp directory: two made-up corners
about 1.7 km apart, a few made-up stops near each (some beyond 400 m), and a
few made-up trips that visit those stops in a random order, with repeats
allowed. No pinned feed is read and nothing is written to web/.

Corners are far enough apart that no stop can be within 400 m of both, so a
stop belongs to at most one corner. A trip that visits stops of both corners
in both orders (for example A, B, A) can then be eligible for A -> B and for
B -> A. The generator allows repeated stops, so such trips occur. The
"two directions" property is only meaningful for those trips, and the
dedicated example test pins one down.
"""

import csv
import datetime
import io
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path

from hypothesis import HealthCheck, example, given, settings
from hypothesis import strategies as st

from pipeline.eligible import find_eligible_trips
from pipeline.gtfs_reader import GTFSReader
from pipeline.stops import DEFAULT_STOP_RADIUS_M, find_stops_near_corners

DATE = datetime.date(2026, 11, 4)
SERVICES = {"FAKE_SVC"}
CORNER_A = (-76.6200, 39.3000)
CORNER_B = (-76.6000, 39.3000)

SETTINGS = settings(
    max_examples=40,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow],
)


@dataclass(frozen=True)
class FakeCorner:
    slug: str
    lonlat: tuple[float, float]


CORNERS = [FakeCorner("fake-a", CORNER_A), FakeCorner("fake-b", CORNER_B)]


# --- strategies -----------------------------------------------------------


@st.composite
def fake_feeds(draw):
    """Return (stops, trips): stops {id: (lon, lat)}, trips {id: rows}.

    A row is (stop_sequence, stop_id, arrival_seconds, departure_seconds).
    Times strictly increase by at least 30 s between rows, so every
    (stop_id, time) pair in a trip is unique.
    """
    stops = {}
    for corner_name, (lon0, lat0) in (("A", CORNER_A), ("B", CORNER_B)):
        n = draw(st.integers(min_value=1, max_value=3))
        for i in range(n):
            dlon = draw(st.integers(-250, 250)) / 100000
            dlat = draw(st.integers(-400, 400)) / 100000
            stops[f"S{corner_name}{i}"] = (round(lon0 + dlon, 6), round(lat0 + dlat, 6))
    stop_ids = sorted(stops)

    trips = {}
    for t in range(draw(st.integers(min_value=1, max_value=5))):
        visits = draw(st.lists(st.sampled_from(stop_ids), min_size=2, max_size=6))
        clock = draw(st.integers(min_value=0, max_value=26 * 3600))
        rows = []
        for seq, sid in enumerate(visits, start=1):
            arrival = clock
            departure = arrival + draw(st.integers(min_value=0, max_value=60))
            rows.append((seq * 10, sid, arrival, departure))
            clock = departure + draw(st.integers(min_value=30, max_value=900))
        trips[f"T{t}"] = rows
    return stops, trips


def _hms(seconds: int) -> str:
    return f"{seconds // 3600:02d}:{seconds % 3600 // 60:02d}:{seconds % 60:02d}"


# --- helpers --------------------------------------------------------------


def _csv(header, rows) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(header)
    w.writerows(rows)
    return buf.getvalue()


def _write_zip(path: Path, stops, trips) -> None:
    files = {
        "stops.txt": _csv(
            ["stop_id", "stop_name", "stop_lat", "stop_lon"],
            [[sid, f"fake {sid}", lat, lon] for sid, (lon, lat) in stops.items()],
        ),
        "routes.txt": _csv(
            ["route_id", "route_short_name", "route_long_name", "route_type"],
            [["FAKE_R", "FAKE", "Fake Line", 3]],
        ),
        "trips.txt": _csv(
            ["route_id", "service_id", "trip_id", "trip_headsign"],
            [["FAKE_R", "FAKE_SVC", tid, "Fake"] for tid in trips],
        ),
        "stop_times.txt": _csv(
            ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"],
            [
                [tid, _hms(a), _hms(d), sid, seq]
                for tid, rows in trips.items()
                for seq, sid, a, d in rows
            ],
        ),
        "calendar.txt": _csv(
            [
                "service_id", "monday", "tuesday", "wednesday", "thursday",
                "friday", "saturday", "sunday", "start_date", "end_date",
            ],
            [["FAKE_SVC", 1, 1, 1, 1, 1, 1, 1, "20260101", "20261231"]],
        ),
    }
    with zipfile.ZipFile(path, "w") as zf:
        for name, text in files.items():
            zf.writestr(name, text)


class _Feed:
    """A made-up feed in a temp directory, with a reader over its zip."""

    def __init__(self, stops, trips):
        self._tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        root = Path(self._tmp.name)
        self.zip_path = root / "fake_feed.zip"
        _write_zip(self.zip_path, stops, trips)
        self.reader = GTFSReader(self.zip_path, cache_dir=root / "cache")

    def stop_times(self) -> dict[str, list[dict]]:
        """Re-read stop_times.txt from the zip, grouped by trip_id."""
        with zipfile.ZipFile(self.zip_path) as zf:
            text = zf.read("stop_times.txt").decode("utf-8")
        out: dict[str, list[dict]] = {}
        for row in csv.DictReader(io.StringIO(text)):
            out.setdefault(row["trip_id"], []).append(row)
        return out

    def eligible(self, a_slug, b_slug, radius=DEFAULT_STOP_RADIUS_M):
        near = find_stops_near_corners(self.reader, CORNERS, radius_m=radius)
        return find_eligible_trips(
            self.reader, a_slug, b_slug, near["fake-a"], near["fake-b"], SERVICES, DATE
        ) if (a_slug, b_slug) == ("fake-a", "fake-b") else find_eligible_trips(
            self.reader, a_slug, b_slug, near["fake-b"], near["fake-a"], SERVICES, DATE
        )

    def close(self):
        self._tmp.cleanup()


def _run(stops, trips, fn):
    feed = _Feed(stops, trips)
    try:
        return fn(feed)
    finally:
        feed.close()


# --- properties -----------------------------------------------------------


@SETTINGS
@given(fake_feeds())
def test_one_record_per_trip(feed_data):
    """P3: no trip_id appears twice in one result, and results are sorted."""
    stops, trips = feed_data

    def check(feed):
        for a, b in (("fake-a", "fake-b"), ("fake-b", "fake-a")):
            result = feed.eligible(a, b)
            ids = [t.trip_id for t in result]
            assert len(ids) == len(set(ids))
            assert set(ids) <= set(trips)
            assert [(t.dep, t.trip_id) for t in result] == sorted(
                (t.dep, t.trip_id) for t in result
            )

    _run(stops, trips, check)


@SETTINGS
@given(fake_feeds())
def test_alight_sequence_after_board_sequence(feed_data):
    """P3: re-reading stop_times, every record boards before it alights.

    EligibleTrip carries no stop_sequence, so each record is matched to rows
    of the re-read stop_times by (trip, stop, time). Times in a generated trip
    are unique per row, so the match is unambiguous.
    """
    stops, trips = feed_data

    def check(feed):
        rows_by_trip = feed.stop_times()
        for a, b in (("fake-a", "fake-b"), ("fake-b", "fake-a")):
            for rec in feed.eligible(a, b):
                rows = rows_by_trip[rec.trip_id]
                board = [
                    int(r["stop_sequence"]) for r in rows
                    if r["stop_id"] == rec.board_stop.stop_id
                    and r["departure_time"] == rec.dep_str
                ]
                alight = [
                    int(r["stop_sequence"]) for r in rows
                    if r["stop_id"] == rec.alight_stop.stop_id
                    and r["arrival_time"] == rec.arr_str
                ]
                assert len(board) == 1 and len(alight) == 1
                assert alight[0] > board[0]

    _run(stops, trips, check)


@SETTINGS
@given(fake_feeds())
def test_departure_not_after_arrival(feed_data):
    """P3: dep <= arr for every record, and ride_min = arr - dep."""
    stops, trips = feed_data

    def check(feed):
        for a, b in (("fake-a", "fake-b"), ("fake-b", "fake-a")):
            for rec in feed.eligible(a, b):
                assert rec.dep <= rec.arr
                assert rec.ride_min == rec.arr - rec.dep

    _run(stops, trips, check)


@SETTINGS
@given(fake_feeds(), st.floats(min_value=50.0, max_value=400.0))
def test_both_walks_within_radius(feed_data, radius):
    """P3: board and alight walks never exceed the radius (400 m at most)."""
    stops, trips = feed_data

    def check(feed):
        for a, b in (("fake-a", "fake-b"), ("fake-b", "fake-a")):
            for rec in feed.eligible(a, b, radius=radius):
                assert rec.board_stop.walk_m <= radius <= DEFAULT_STOP_RADIUS_M
                assert rec.alight_stop.walk_m <= radius
                assert rec.access_min == rec.board_stop.walk_min
                assert rec.egress_min == rec.alight_stop.walk_min

    _run(stops, trips, check)


@SETTINGS
@given(
    fake_feeds(),
    st.floats(min_value=0.0, max_value=400.0),
    st.floats(min_value=0.0, max_value=400.0),
)
def test_smaller_radius_never_adds_trips(feed_data, r1, r2):
    """P3: the trip ids found at a smaller radius are a subset of the larger."""
    stops, trips = feed_data
    small, large = sorted((r1, r2))

    def check(feed):
        for a, b in (("fake-a", "fake-b"), ("fake-b", "fake-a")):
            ids_small = {t.trip_id for t in feed.eligible(a, b, radius=small)}
            ids_large = {t.trip_id for t in feed.eligible(a, b, radius=large)}
            assert ids_small <= ids_large

    _run(stops, trips, check)


def _two_direction_check(feed):
    forward = {t.trip_id: t for t in feed.eligible("fake-a", "fake-b")}
    backward = {t.trip_id: t for t in feed.eligible("fake-b", "fake-a")}
    shared = set(forward) & set(backward)
    rows_by_trip = feed.stop_times()
    for tid in shared:
        f, b = forward[tid], backward[tid]
        # The two records are different records: opposite boarding and
        # alighting corners, so no record is common to both directions.
        assert f != b
        assert f.board_stop.stop_id != b.board_stop.stop_id
        assert f.board_stop.stop_id[1] == "A" and f.alight_stop.stop_id[1] == "B"
        assert b.board_stop.stop_id[1] == "B" and b.alight_stop.stop_id[1] == "A"
        # Each one is a real ordering in stop_times: the trip visits both
        # corners in both orders.
        seqs = {
            (r["stop_id"][1]): [] for r in rows_by_trip[tid]
        }
        for r in rows_by_trip[tid]:
            seqs[r["stop_id"][1]].append(int(r["stop_sequence"]))
        assert min(seqs["A"]) < max(seqs["B"]) and min(seqs["B"]) < max(seqs["A"])
    return shared


@SETTINGS
@given(fake_feeds())
@example(
    feed_data=(
        {"SA0": (-76.6200, 39.3000), "SB0": (-76.6000, 39.3000)},
        {
            "T0": [
                (10, "SA0", 36000, 36000),
                (20, "SB0", 36600, 36600),
                (30, "SA0", 37200, 37200),
            ]
        },
    )
)
def test_two_directions_never_share_a_trip_record(feed_data):
    """P3: A -> B and B -> A never hold the same record.

    The two results can only have a trip_id in common when that trip visits
    both corners in both orders (A, B, A or B, A, B and the like). The feed
    generator allows repeated stops, and the @example pins such a trip, so
    the property is exercised and not vacuous. For a shared trip the records
    must differ, with boarding and alighting corners swapped, and stop_times
    must show both orders.
    """
    stops, trips = feed_data
    _run(stops, trips, _two_direction_check)


def test_shared_trip_example_is_nonvacuous():
    """The pinned A, B, A trip really is eligible in both directions."""
    stops = {"SA0": (-76.6200, 39.3000), "SB0": (-76.6000, 39.3000)}
    trips = {
        "T0": [
            (10, "SA0", 36000, 36000),
            (20, "SB0", 36600, 36600),
            (30, "SA0", 37200, 37200),
        ]
    }
    assert _run(stops, trips, _two_direction_check) == {"T0"}
