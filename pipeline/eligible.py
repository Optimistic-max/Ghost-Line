"""
Eligible one-seat trips between two corners (race-brief.md section 5.4).

active_services: which service_ids run on a date.
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass

from pipeline.gtfs_reader import GTFSReader, parse_gtfs_time
from pipeline.stops import Stop

_WEEKDAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)


def active_services(gtfs: GTFSReader, date: datetime.date) -> set[str]:
    """Return the service_ids active on date.

    1. calendar.txt: start_date <= date <= end_date and the weekday flag is 1.
    2. calendar_dates.txt, rows for that date: exception_type 1 adds the
       service, exception_type 2 removes it.

    Either file may be absent from a feed; a missing file contributes nothing.
    """
    ymd = date.strftime("%Y%m%d")
    weekday = _WEEKDAYS[date.weekday()]
    active: set[str] = set()

    if gtfs.has_file("calendar.txt"):
        cal = gtfs.read_table("calendar.txt")
        for row in cal.to_dict("records"):
            if (
                row["start_date"].strip() <= ymd <= row["end_date"].strip()
                and row[weekday].strip() == "1"
            ):
                active.add(row["service_id"].strip())

    if gtfs.has_file("calendar_dates.txt"):
        exc = gtfs.read_table("calendar_dates.txt")
        for row in exc.to_dict("records"):
            if row["date"].strip() != ymd:
                continue
            kind = row["exception_type"].strip()
            sid = row["service_id"].strip()
            if kind == "1":
                active.add(sid)
            elif kind == "2":
                active.discard(sid)

    return active


@dataclass(frozen=True)
class EligibleTrip:
    """One one-seat trip between two corners. Full precision, no rounding.

    dep is the departure at board_stop and arr the arrival at alight_stop, in
    minutes after midnight (may pass 1440). dep_str and arr_str are the GTFS
    HH:MM:SS strings for output.
    """

    trip_id: str
    route: str
    headsign: str
    board_stop: Stop
    alight_stop: Stop
    dep: float
    arr: float
    dep_str: str
    arr_str: str
    ride_min: float
    access_min: float
    egress_min: float


def _first_nonblank(*values: str) -> str:
    for v in values:
        if v is not None and str(v).strip() != "":
            return str(v).strip()
    raise ValueError("no non-blank time value")


def _service_stop_times(gtfs: GTFSReader, service_ids: set[str], date: datetime.date):
    """Return (stop_times rows for active-service trips, trips table, routes table).

    stop_times goes through the service-date cache. Results are kept on the
    reader so the 20 pairs of a build do not re-read the files.
    """
    key = (date.isoformat(), frozenset(service_ids))
    memo = gtfs.__dict__.setdefault("_eligible_memo", {})
    if key in memo:
        return memo[key]

    trips = gtfs.read_table("trips.txt")
    routes = gtfs.read_table("routes.txt")
    trips = trips[trips["service_id"].str.strip().isin(service_ids)]
    st = gtfs.read_stop_times(date.isoformat(), trip_ids=set(trips["trip_id"]))
    st = st[st["trip_id"].isin(set(trips["trip_id"]))]
    memo[key] = (st, trips, routes)
    return memo[key]


def find_eligible_trips(
    gtfs: GTFSReader,
    origin_slug: str,
    dest_slug: str,
    origin_stops: list[Stop],
    dest_stops: list[Stop],
    service_ids: set[str],
    date: datetime.date,
) -> list[EligibleTrip]:
    """One-seat trips from the origin corner to the dest corner on date.

    For each trip on an active service, take every (board, alight) pair where
    board is in origin_stops, alight is in dest_stops and alight.stop_sequence
    is greater than board.stop_sequence. A trip with no such pair is skipped.
    Otherwise the pair with the shortest origin walk wins; ties go to the
    shortest dest walk, then the earlier board and alight sequence. One record
    per trip, sorted by (dep, trip_id). Nothing is rounded.

    origin_slug and dest_slug name the pair and are not used in the lookup.
    """
    if not origin_stops or not dest_stops:
        return []

    o_by_id = {s.stop_id: s for s in origin_stops}
    d_by_id = {s.stop_id: s for s in dest_stops}

    st, trips, routes = _service_stop_times(gtfs, service_ids, date)
    st = st[st["stop_id"].isin(set(o_by_id) | set(d_by_id))]
    if st.empty:
        return []

    trip_info = {
        r["trip_id"]: (r["route_id"], r.get("trip_headsign", ""))
        for r in trips.to_dict("records")
    }
    route_names: dict[str, str] = {}
    for r in routes.to_dict("records"):
        short = (r.get("route_short_name") or "").strip()
        route_names[r["route_id"]] = short or (r.get("route_long_name") or "").strip()

    # Group the relevant rows by trip.
    per_trip: dict[str, list[tuple[int, str, str, str]]] = {}
    for tid, sid, seq, arr, dep in zip(
        st["trip_id"], st["stop_id"], st["stop_sequence"],
        st["arrival_time"], st["departure_time"],
    ):
        per_trip.setdefault(tid, []).append((int(seq), sid, arr, dep))

    out: list[EligibleTrip] = []
    for tid, rows in per_trip.items():
        best = None
        best_key = None
        for o_seq, o_id, o_arr, o_dep in rows:
            o = o_by_id.get(o_id)
            if o is None:
                continue
            for d_seq, d_id, d_arr, d_dep in rows:
                d = d_by_id.get(d_id)
                if d is None or d_seq <= o_seq:
                    continue
                key = (o.walk_min, d.walk_min, o_seq, d_seq)
                if best_key is None or key < best_key:
                    best_key = key
                    best = (o, d, o_dep, o_arr, d_arr, d_dep)
        if best is None:
            continue
        o, d, o_dep, o_arr, d_arr, d_dep = best
        dep_str = _first_nonblank(o_dep, o_arr)
        arr_str = _first_nonblank(d_arr, d_dep)
        dep = parse_gtfs_time(dep_str)
        arr = parse_gtfs_time(arr_str)
        route_id, headsign = trip_info[tid]
        out.append(
            EligibleTrip(
                trip_id=tid,
                route=route_names.get(route_id, route_id),
                headsign=headsign,
                board_stop=o,
                alight_stop=d,
                dep=dep,
                arr=arr,
                dep_str=dep_str,
                arr_str=arr_str,
                ride_min=arr - dep,
                access_min=o.walk_min,
                egress_min=d.walk_min,
            )
        )
    out.sort(key=lambda x: (x.dep, x.trip_id))
    return out
