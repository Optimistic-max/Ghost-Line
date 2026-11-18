"""
Golden test for the emitted lead-pair race file (race-brief.md section 4.5).

Reads the pinned feed zip, so it is marked requires_feed and skips with a
visible message when raw/mta_local_bus.zip is absent (hosted build).

The trip index "i" is not a golden value (design.md, Decisions 1): the test
checks that the race row points at the right trip, not which number it is.
"""

import datetime
import json
import warnings
from pathlib import Path

import pytest

from pipeline.clock import build_clock
from pipeline.eligible import active_services, find_eligible_trips
from pipeline.emit import GZIP_LIMITS, report_sizes, validate_against_schema, write_race_files, SCHEMA_DIR
from pipeline.facts import load_facts
from pipeline.feed_check import PINNED_FEED_SHA256, check_feed
from pipeline.gtfs_reader import GTFSReader
from pipeline.race import run_all_races
from pipeline.stops import find_stops_near_corners

ROOT = Path(__file__).resolve().parents[2]
FEED_PATH = ROOT / "raw" / "mta_local_bus.zip"
FACTS_PATH = ROOT / "data" / "lines" / "no21-1938.yaml"
SERVICE_DATE = datetime.date(2026, 11, 4)

if not FEED_PATH.is_file():
    message = f"golden emit tests need {FEED_PATH}, which is missing: SKIPPED"
    warnings.warn(message)
    pytest.skip(message, allow_module_level=True)

pytestmark = pytest.mark.requires_feed

ORIGIN, DEST = "preston-caroline", "aliceanna-bond"


@pytest.fixture(scope="module")
def lead(tmp_path_factory):
    assert check_feed(FEED_PATH) == PINNED_FEED_SHA256
    facts = load_facts(FACTS_PATH)
    gtfs = GTFSReader(FEED_PATH, cache_dir=tmp_path_factory.mktemp("cache"))
    services = active_services(gtfs, SERVICE_DATE)
    stops = find_stops_near_corners(gtfs, facts.timing_points, radius_m=400.0)
    trips = find_eligible_trips(gtfs, ORIGIN, DEST, stops[ORIGIN], stops[DEST], services, SERVICE_DATE)
    clocks = build_clock(facts)
    races = run_all_races([(ORIGIN, DEST)], clocks, {(ORIGIN, DEST): trips}, facts)
    out = tmp_path_factory.mktemp("emit")
    (path,) = write_race_files(
        facts, clocks, {(ORIGIN, DEST): trips}, races, PINNED_FEED_SHA256, "20260821", "2026-11-04", out
    )
    return path, json.loads(path.read_text(encoding="utf-8"))


def test_file_name_and_schema(lead):
    path, _ = lead
    assert path.name == f"{ORIGIN}__{DEST}.json"
    validate_against_schema(path, SCHEMA_DIR / "race.schema.json")


def test_header_fields(lead):
    _, doc = lead
    assert doc["schema"] == "ghostline.race.v1"
    assert doc["line"] == "no21-1938"
    assert (doc["origin"], doc["dest"], doc["direction"]) == (ORIGIN, DEST, "eastbound")
    assert doc["inferred"] is False
    assert doc["service_date"] == "2026-11-04"
    assert doc["feed_version"] == "20260821"
    assert doc["feed_sha256"] == PINNED_FEED_SHA256
    assert doc["radius_m"] == 400


def test_1938_block(lead):
    _, doc = lead
    y = doc["y1938"]
    assert y["ride_min"] == 9
    assert y["covered_from"] == "09:21"
    assert y["passes"][:3] == ["09:21", "09:28", "09:36"]
    assert y["passes"][-1] == "14:13"
    assert y["sources"] == {
        "ride_min": "https://collections.digitalmaryland.org/digital/collection/btjk/id/201",
        "passes": "https://collections.digitalmaryland.org/digital/collection/btjk/id/202",
    }


def test_gaps(lead):
    _, doc = lead
    assert doc["today"]["gap_min"] == 34
    assert doc["today"]["gap_max"] == 39


def test_the_10_32_trip_matches_the_brief_example(lead):
    _, doc = lead
    trip = next(t for t in doc["today"]["trips"] if t["trip_id"] == "4110804")
    assert trip["route"].lower() == "citylink lime"
    assert trip["headsign"] == "HARBOR EAST"
    assert trip["board"]["stop_id"] == "8564"
    assert trip["board"]["name"] == "BIDDLE ST & CAROLINE AVE eb"
    assert trip["board"]["walk_m"] == pytest.approx(125.07, abs=0.01)
    assert trip["board"]["walk_min"] == 2.258
    assert trip["alight"]["stop_id"] == "9486"
    assert trip["alight"]["name"] == "CAROLINE ST & EASTERN AVE fs sb"
    assert trip["alight"]["walk_m"] == pytest.approx(230.15, abs=0.01)
    assert trip["alight"]["walk_min"] == 4.156
    assert (trip["dep"], trip["arr"], trip["ride_min"]) == ("10:32:43", "10:41:00", 8.283)


def test_10_00_race_row(lead):
    _, doc = lead
    row = next(r for r in doc["races"] if r["t"] == "10:00")
    assert row["start"] == "10:00"
    assert row["before_table"] is False
    assert row["y1938"] == {"dep": "10:06", "wait": 6, "total": 15}
    assert row["today"]["wait"] == 30.458
    assert row["today"]["total"] == 45.156
    assert row["result"] == "1938"
    assert row["margin"] == 30.156
    # i is not golden, but the row must point at the 10:32:43 trip.
    assert doc["today"]["trips"][row["today"]["trip"]]["trip_id"] == "4110804"


def test_before_table_rows_start_at_covered_from(lead):
    _, doc = lead
    first = doc["races"][0]
    assert first["t"] == "09:00" and first["start"] == "09:21" and first["before_table"] is True
    assert len(doc["races"]) == 293


def test_trips_list_follows_decision_1(lead):
    _, doc = lead
    trips = doc["today"]["trips"]
    used = sorted({r["today"]["trip"] for r in doc["races"] if r["today"]})
    assert [t["i"] for t in trips] == list(range(len(trips)))
    assert len(trips) == len(used) + 3  # the last used trip is not the last of the day
    assert [t["dep"] for t in trips] == sorted(t["dep"] for t in trips)


def test_size_is_reported_and_within_the_gzip_limit(lead):
    path, _ = lead
    (row,) = report_sizes([path])
    print(f"{path.name}: {row['raw']} bytes raw, {row['gzip']} bytes gzip")
    assert row["gzip"] <= GZIP_LIMITS["race"]
