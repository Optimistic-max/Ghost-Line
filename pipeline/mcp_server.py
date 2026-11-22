"""Independent MCP server for the pinned MTA feed (skeptic spec).

The Skeptic agent uses this server to recount bus trips without trusting the
pipeline. For that reason this module reads the feed with its own small reader
(standard library only) and imports no other module of this package. It keeps its
own copy of the pinned SHA-256; a test keeps that copy equal to the pipeline's.

Layers:
  1. Reader: load_feed() reads the zip once and returns a Feed.
  2. Queries: feed_info_answer() and trips_serving_answer(), pure functions of a Feed.
  3. Serving: build_server() and main(). Only this layer needs the MCP SDK, which is
     imported inside build_server(), so layers 1 and 2 work without the SDK.

The server writes nothing to disk, makes no network call, and writes only protocol
messages to standard output. Logs go to standard error.

Start it with:  python -m pipeline.mcp_server
"""

import csv
import datetime
import hashlib
import io
import logging
import os
import re
import sys
import threading
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

PINNED_SHA256 = "8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694"
SERVICE_DATE = "2026-11-04"
ENV_ZIP = "GHOSTLINE_GTFS_ZIP"
LOAD_WAIT_SECONDS = 30  # longest a tool call waits for the background load
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ZIP = REPO_ROOT / "raw" / "mta_local_bus.zip"

_CHUNK = 1 << 20
_WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
_LIMIT_RE = re.compile(r"^(\d{1,2}):(\d{2})$")

log = logging.getLogger("ghostline-gtfs")


# --- errors -----------------------------------------------------------------


class FeedUnavailable(ValueError):
    """The feed is missing, has the wrong hash, or could not be read."""


class ToolInputError(ValueError):
    """A tool argument is not acceptable."""


class FeedStillLoading(ValueError):
    """The background load did not finish within the wait limit."""


class _FeedFormatError(Exception):
    """A table of the feed is unreadable. The message names the member and column."""


# --- data -------------------------------------------------------------------


@dataclass(frozen=True)
class Call:
    """One row of stop_times for a trip of an active service."""

    seq: int
    stop_id: str
    arr: int  # seconds after midnight, may pass 86400
    dep: int
    arr_text: str  # the feed's own HH:MM:SS
    dep_text: str  # the feed's own HH:MM:SS (the arrival text when the departure is blank)


@dataclass(frozen=True)
class Trip:
    trip_id: str
    route_short_name: str
    headsign: str
    calls: tuple[Call, ...]  # sorted by seq


@dataclass
class Feed:
    error: str | None = None  # None means the feed is usable
    sha256: str | None = None
    feed_version: str | None = None
    active_service_ids: tuple[str, ...] = ()
    trips: dict[str, Trip] = field(default_factory=dict)
    by_stop: dict[str, frozenset[str]] = field(default_factory=dict)
    stop_ids: frozenset[str] = frozenset()
    dropped_calls: int = 0  # calls with both times blank, left out of their trip


# --- reader -----------------------------------------------------------------


def resolve_zip_path(environ: dict[str, str] | None = None) -> Path:
    """The feed path: GHOSTLINE_GTFS_ZIP if set, else raw/mta_local_bus.zip.

    A relative value is resolved against the repository root (the parent of
    pipeline/), never against the current directory.
    """
    environ = os.environ if environ is None else environ
    value = environ.get(ENV_ZIP)
    if not value:
        return DEFAULT_ZIP
    path = Path(value)
    return path if path.is_absolute() else REPO_ROOT / path


def _sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        while True:
            chunk = handle.read(_CHUNK)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _text_reader(zf: zipfile.ZipFile, member: str):
    return io.TextIOWrapper(zf.open(member), encoding="utf-8-sig", newline="")


def _require(member: str, header: list[str] | None, columns: tuple[str, ...]) -> None:
    present = header or []
    for column in columns:
        if column not in present:
            raise _FeedFormatError(f"{member}: missing column '{column}'")


def _dict_rows(zf: zipfile.ZipFile, member: str, columns: tuple[str, ...]):
    """Rows of a table as dicts. Raises _FeedFormatError if a required column is missing."""
    with _text_reader(zf, member) as handle:
        reader = csv.DictReader(handle)
        _require(member, reader.fieldnames and list(reader.fieldnames), columns)
        yield from reader


def _need(zf: zipfile.ZipFile, member: str) -> None:
    if member not in zf.namelist():
        raise _FeedFormatError(f"{member}: missing from the feed zip")


def _parse_time(member: str, text: str) -> int | None:
    """'H:MM:SS' or 'HH:MM:SS' (hours may pass 24) to seconds. Blank gives None."""
    text = text.strip()
    if not text:
        return None
    parts = text.split(":")
    try:
        if len(parts) != 3:
            raise ValueError(text)
        hours, minutes, seconds = (int(p) for p in parts)
        if minutes > 59 or seconds > 59 or min(hours, minutes, seconds) < 0:
            raise ValueError(text)
    except ValueError:
        raise _FeedFormatError(f"{member}: bad time '{text}'") from None
    return hours * 3600 + minutes * 60 + seconds

def _active_services(zf: zipfile.ZipFile, date_text: str) -> tuple[str, ...]:
    day = datetime.date.fromisoformat(date_text)
    ymd = day.strftime("%Y%m%d")
    weekday = _WEEKDAYS[day.weekday()]
    names = set(zf.namelist())
    active: set[str] = set()
    if "calendar.txt" in names:
        for row in _dict_rows(zf, "calendar.txt", ("service_id", weekday, "start_date", "end_date")):
            if row[weekday].strip() == "1" and row["start_date"].strip() <= ymd <= row["end_date"].strip():
                active.add(row["service_id"])
    if "calendar_dates.txt" in names:
        for row in _dict_rows(zf, "calendar_dates.txt", ("service_id", "date", "exception_type")):
            if row["date"].strip() != ymd:
                continue
            kind = row["exception_type"].strip()
            if kind == "1":
                active.add(row["service_id"])
            elif kind == "2":
                active.discard(row["service_id"])
    return tuple(sorted(active))


def _read_feed(zf: zipfile.ZipFile, sha256: str) -> Feed:
    names = set(zf.namelist())

    feed_version = None
    if "feed_info.txt" in names:
        for row in _dict_rows(zf, "feed_info.txt", ()):
            value = (row.get("feed_version") or "").strip()
            feed_version = value or None
            break

    active = _active_services(zf, SERVICE_DATE)
    active_set = set(active)

    _need(zf, "routes.txt")
    route_names = {
        row["route_id"]: row.get("route_short_name") or ""
        for row in _dict_rows(zf, "routes.txt", ("route_id",))
    }

    _need(zf, "trips.txt")
    trip_info: dict[str, tuple[str, str]] = {}
    for row in _dict_rows(zf, "trips.txt", ("trip_id", "route_id", "service_id")):
        if row["service_id"] in active_set:
            trip_info[row["trip_id"]] = (route_names.get(row["route_id"], ""), row.get("trip_headsign") or "")

    _need(zf, "stops.txt")
    stop_ids = frozenset(row["stop_id"] for row in _dict_rows(zf, "stops.txt", ("stop_id",)))

    _need(zf, "stop_times.txt")
    calls: dict[str, list[Call]] = {}
    dropped = 0
    with _text_reader(zf, "stop_times.txt") as handle:
        reader = csv.reader(handle)
        header = next(reader, None)
        _require("stop_times.txt", header, ("trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"))
        i_trip, i_arr, i_dep = header.index("trip_id"), header.index("arrival_time"), header.index("departure_time")
        i_stop, i_seq = header.index("stop_id"), header.index("stop_sequence")
        for row in reader:
            if not row:
                continue
            trip_id = row[i_trip]
            if trip_id not in trip_info:
                continue
            try:
                seq = int(row[i_seq])
            except ValueError:
                raise _FeedFormatError(f"stop_times.txt: bad stop_sequence '{row[i_seq]}'") from None
            arr_text, dep_text = row[i_arr].strip(), row[i_dep].strip()
            arr = _parse_time("stop_times.txt", arr_text)
            dep = _parse_time("stop_times.txt", dep_text)
            if arr is None and dep is None:
                dropped += 1
                continue
            if arr is None:
                arr, arr_text = dep, dep_text
            if dep is None:
                dep, dep_text = arr, arr_text
            calls.setdefault(trip_id, []).append(Call(seq, row[i_stop], arr, dep, arr_text, dep_text))

    trips: dict[str, Trip] = {}
    stop_trips: dict[str, set[str]] = {}
    for trip_id, rows in calls.items():
        rows.sort(key=lambda call: call.seq)
        route_name, headsign = trip_info[trip_id]
        trips[trip_id] = Trip(trip_id, route_name, headsign, tuple(rows))
        for call in rows:
            stop_trips.setdefault(call.stop_id, set()).add(trip_id)

    return Feed(
        error=None,
        sha256=sha256,
        feed_version=feed_version,
        active_service_ids=active,
        trips=trips,
        by_stop={stop: frozenset(ids) for stop, ids in stop_trips.items()},
        stop_ids=stop_ids,
        dropped_calls=dropped,
    )


def load_feed(zip_path, expected_sha256: str = PINNED_SHA256) -> Feed:
    """Read the feed zip once. Fails closed: any problem returns a Feed with error set.

    The second argument lets tests use a made-up feed with a made-up hash. The
    tools always use the pinned default.
    """
    path = Path(zip_path)
    if not path.is_file():
        return Feed(error=f"feed zip not found at {path}")
    try:
        found = _sha256_of(path)
    except OSError as exc:
        return Feed(error=f"feed zip could not be read: {exc}")
    if found != expected_sha256:
        return Feed(
            error=f"feed SHA-256 {found} does not match the pinned {expected_sha256}",
            sha256=found,
        )
    try:
        with zipfile.ZipFile(path) as zf:
            feed = _read_feed(zf, found)
    except _FeedFormatError as exc:
        return Feed(error=f"feed unreadable: {exc}", sha256=found)
    except (zipfile.BadZipFile, OSError, csv.Error, UnicodeDecodeError, KeyError) as exc:
        return Feed(error=f"feed unreadable: {type(exc).__name__}: {exc}", sha256=found)
    if feed.dropped_calls:
        log.warning("%d stop_times call(s) with both times blank were left out", feed.dropped_calls)
    return feed

# --- queries ----------------------------------------------------------------


def _usable(feed: Feed) -> None:
    if feed.error:
        raise FeedUnavailable(feed.error)


def feed_info_answer(feed: Feed) -> dict[str, Any]:
    _usable(feed)
    return {
        "feed_version": feed.feed_version,
        "sha256": feed.sha256,
        "service_date": SERVICE_DATE,
        "active_service_ids": list(feed.active_service_ids),
    }


def _limit_seconds(name: str, value: str | None) -> int | None:
    if value is None:
        return None
    match = _LIMIT_RE.match(value) if isinstance(value, str) else None
    if not match or int(match.group(2)) > 59:
        raise ToolInputError(f"'{name}' must be a time like HH:MM (hours may pass 24), got {value!r}")
    return int(match.group(1)) * 3600 + int(match.group(2)) * 60


def trips_serving_answer(
    feed: Feed,
    stop_a: str,
    stop_b: str,
    date: str,
    after: str | None = None,
    before: str | None = None,
) -> dict[str, Any]:
    _usable(feed)
    if date != SERVICE_DATE:
        raise ToolInputError(f"date {date!r} is not supported: the only supported date is {SERVICE_DATE!r}")
    for stop in (stop_a, stop_b):
        if stop not in feed.stop_ids:
            raise ToolInputError(f"unknown stop_id {stop!r}: it is not in stops.txt")
    low = _limit_seconds("after", after)
    high = _limit_seconds("before", before)

    found: list[tuple[int, str, dict[str, str]]] = []
    candidates = feed.by_stop.get(stop_a, frozenset()) & feed.by_stop.get(stop_b, frozenset())
    for trip_id in candidates:
        trip = feed.trips[trip_id]
        hit = None
        for index, call in enumerate(trip.calls):
            if call.stop_id != stop_a:
                continue
            for later in trip.calls[index + 1 :]:
                if later.stop_id == stop_b and later.seq > call.seq:
                    hit = (call, later)
                    break
            if hit:
                break
        if hit is None:
            continue
        board, alight = hit
        if low is not None and board.dep < low:
            continue
        if high is not None and board.dep > high:
            continue
        found.append(
            (
                board.dep,
                trip_id,
                {
                    "trip_id": trip_id,
                    "route_short_name": trip.route_short_name,
                    "headsign": trip.headsign,
                    "dep_a": board.dep_text,
                    "arr_b": alight.arr_text,
                },
            )
        )
    found.sort(key=lambda item: (item[0], item[1]))
    trips = [item[2] for item in found]
    return {"count": len(trips), "trips": trips}


# --- waiting for the background load -----------------------------------------


def wait_for_feed(ready: threading.Event, holder: dict, timeout: float = LOAD_WAIT_SECONDS) -> Feed:
    """Wait for the background load, then return the finished Feed.

    Never answers from partial data and never reads the file itself. If the load
    has not finished within the limit, raises FeedStillLoading.
    """
    if not ready.wait(timeout):
        raise FeedStillLoading(
            f"feed still loading: waited {timeout:g} seconds for the feed to load, try again shortly"
        )
    feed = holder.get("feed")
    if feed is None:
        raise FeedStillLoading("feed still loading: the loader has not published the feed")
    return feed


def start_loader(
    zip_path,
    holder: dict,
    ready: threading.Event,
    loader: Callable[..., Feed] = load_feed,
) -> threading.Thread:
    """Load the feed in a background thread. The finished Feed is published into
    holder just before the event is set, so a waiting call never sees a partial one."""

    def run() -> None:
        try:
            feed = loader(zip_path)
        except Exception as exc:  # the server must keep answering, with an error
            feed = Feed(error=f"feed loader failed: {type(exc).__name__}: {exc}")
        holder["feed"] = feed
        ready.set()

    thread = threading.Thread(target=run, name="ghostline-feed-loader", daemon=True)
    thread.start()
    return thread


# --- serving ----------------------------------------------------------------


def build_server(ready: threading.Event, holder: dict, wait_timeout: float = LOAD_WAIT_SECONDS):
    """The FastMCP server with the two tools. The SDK is imported here and nowhere else."""
    from mcp.server.fastmcp import FastMCP

    server = FastMCP("ghostline-gtfs")

    @server.tool()
    def feed_info() -> dict[str, Any]:
        """Which feed is loaded: feed_version, sha256, service_date and active_service_ids.

        Returns an error (never an empty answer) if the feed is missing or its SHA-256
        is not the pinned value.
        """
        return feed_info_answer(wait_for_feed(ready, holder, wait_timeout))

    @server.tool()
    def trips_serving(
        stop_a: str, stop_b: str, date: str, after: str | None = None, before: str | None = None
    ) -> dict[str, Any]:
        """Scheduled one-seat trips from stop_a to stop_b on the pinned service date.

        stop_a and stop_b are GTFS stop_id strings. date must be "2026-11-04". A trip
        counts once, at its first call at stop_a that has a later call at stop_b. after
        and before are optional "HH:MM" limits on the departure at stop_a, both
        inclusive, compared as GTFS times (hours may pass 24). Times in the answer are
        the feed's own HH:MM:SS. Sorted by departure, then trip_id. Errors (wrong date,
        unknown stop, malformed time, feed missing or wrong hash) are returned as errors.
        """
        return trips_serving_answer(wait_for_feed(ready, holder, wait_timeout), stop_a, stop_b, date, after, before)

    return server


def main() -> None:
    logging.basicConfig(stream=sys.stderr, level=logging.INFO, format="ghostline-gtfs: %(message)s")
    path = resolve_zip_path()
    holder: dict = {}
    ready = threading.Event()
    start_loader(path, holder, ready)
    build_server(ready, holder).run(transport="stdio")


if __name__ == "__main__":
    main()
