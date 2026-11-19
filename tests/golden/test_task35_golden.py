"""
Golden tests for the task 35 data additions, on the pinned feed.

Reads the pinned feed zip, so it is marked requires_feed and skips with a
visible message when raw/mta_local_bus.zip is absent. The build runs into
temporary folders (cache and output): nothing under raw/ or web/ is written.
Expected values that come from the facts files are read from them.
"""

import itertools
import json
import warnings
from pathlib import Path

import pytest
import yaml

from pipeline import cli
from pipeline.emit import GZIP_LIMITS, report_sizes
from pipeline.facts import load_facts

ROOT = Path(__file__).resolve().parents[2]
FEED_PATH = ROOT / "raw" / "mta_local_bus.zip"
FACTS_PATH = ROOT / "data" / "lines" / "no21-1938.yaml"

if not FEED_PATH.is_file():
    message = f"golden task 35 tests need {FEED_PATH}, which is missing: SKIPPED"
    warnings.warn(message)
    pytest.skip(message, allow_module_level=True)

pytestmark = pytest.mark.requires_feed

LEAD = "preston-caroline__aliceanna-bond.json"


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    out = tmp_path_factory.mktemp("t35-out")
    cache = tmp_path_factory.mktemp("t35-cache")
    cli.run_build(ROOT, output_dir=out, cache_dir=cache, say=lambda s: None)
    return out


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def race_files(out):
    return sorted((out / "race").glob("*.json"))


# --- 35.1 labels -------------------------------------------------------------


def test_the_six_catalog_labels(built):
    sources = load(built / "index.json")["sources"]
    assert {k: v["label"] for k, v in sources.items()} == {
        "guide1938_diagram": "1938 route diagram, Digital Maryland",
        "guide1938_timetable": "1938 timetable, Digital Maryland",
        "guide1938_route": "1938 route description, Digital Maryland",
        "mta_gtfs": "MDOT MTA local bus schedule (GTFS feed)",
        "osm": "OpenStreetMap contributors",
        "method": "Ghost Line method",
    }
    assert "x 1.3 / 1.2 / 60" in sources["method"]["what"]  # the walk formula text still lives here


# --- 35.2 1938 spacing and the bus window ------------------------------------


def test_every_pair_has_the_1938_spacing_from_its_clock_and_the_window(built):
    facts = load_facts(FACTS_PATH)
    pattern = facts.midday_departures["eastbound"].minutes_past_hour
    # The brief: the 1938 cars run every 7 or 8 minutes. Check against the facts, not a typed value.
    ring = pattern + [pattern[0] + 60]
    expected = (min(b - a for a, b in zip(ring, ring[1:])), max(b - a for a, b in zip(ring, ring[1:])))
    assert expected == (7, 8)
    files = race_files(built)
    assert len(files) == 20
    for f in files:
        doc = load(f)
        assert (doc["y1938"]["gap_min"], doc["y1938"]["gap_max"]) == expected, f.name
        assert (doc["today"]["window_from"], doc["today"]["window_to"]) == ("09:00", "14:00"), f.name


def test_lead_pair_bus_gaps_are_unchanged(built):
    today = load(built / "race" / LEAD)["today"]
    assert (today["gap_min"], today["gap_max"]) == (34, 39)


# --- 35.3 route names --------------------------------------------------------


def test_lead_pair_routes_read_citylink_lime(built):
    today = load(built / "race" / LEAD)["today"]
    assert today["route_names"] == ["CityLink Lime"]
    assert {t["route_display"] for t in today["trips"]} == {"CityLink Lime"}
    assert {t["route"] for t in today["trips"]} == {"CityLink LIME"}  # the GTFS name is kept


def test_westwood_to_aliceanna_lists_both_citylink_routes(built):
    names = load(built / "race" / "westwood-carey__aliceanna-bond.json")["today"]["route_names"]
    assert set(names) == {"CityLink Lime", "CityLink Navy"}


def test_numeric_route_reads_route_54(built):
    names = load(built / "race" / "preston-caroline__brevard-preston.json")["today"]["route_names"]
    assert "Route 54" in names


def test_every_route_display_follows_the_rule(built):
    for f in race_files(built):
        today = load(f)["today"]
        for t in today["trips"]:
            assert t["route_display"] == t["route"].replace("LIME", "Lime").replace("NAVY", "Navy") or t["route"].isdigit()
        assert today["route_names"] == list(dict.fromkeys(t["route_display"] for t in today["trips"]))


# --- 35.4 trips list ---------------------------------------------------------


def test_lead_pair_list_holds_every_trip_from_0900_through_three_after_the_last_used(built):
    doc = load(built / "race" / LEAD)
    trips = doc["today"]["trips"]
    deps = [t["dep"] for t in trips]
    assert deps[0] == "09:17:43"  # the first trip at or after 09:00
    assert "10:32:43" in deps
    assert deps == sorted(deps)
    assert [t["i"] for t in trips] == list(range(len(trips)))
    used = sorted({r["today"]["trip"] for r in doc["races"] if r["today"]})
    assert used and max(used) < len(trips)
    assert len(trips) == min(max(used) + 1 + 3, len(trips))
    assert len(trips) - 1 - max(used) == 3  # three after the last used (the lead pair has more than three left)
    assert all(d >= "09:00:00" for d in deps)
    # every trip between the first and the 10:32:43 one is there, none skipped
    between = [d for d in deps if "09:17:43" <= d <= "10:32:43"]
    assert between == ["09:17:43", "09:56:43", "10:32:43"]


def test_every_race_row_points_into_its_list(built):
    for f in race_files(built):
        doc = load(f)
        n = len(doc["today"]["trips"])
        for row in doc["races"]:
            if row["today"] is not None:
                assert 0 <= row["today"]["trip"] < n, f.name


def test_the_10_00_lead_row_is_unchanged_and_points_at_the_10_32_trip(built):
    doc = load(built / "race" / LEAD)
    row = next(r for r in doc["races"] if r["t"] == "10:00")
    assert row["y1938"] == {"dep": "10:06", "wait": 6, "total": 15}
    assert (row["today"]["wait"], row["today"]["total"]) == (30.458, 45.156)
    assert (row["result"], row["margin"]) == ("1938", 30.156)
    assert doc["today"]["trips"][row["today"]["trip"]]["dep"] == "10:32:43"


def test_every_race_file_is_under_the_gzip_limit_and_sizes_are_reported(built):
    rows = report_sizes(sorted(built.rglob("*.json")) + [built / "route.geojson"])
    for r in rows:
        print(f"{r['path'].name}: {r['raw']} raw, {r['gzip']} gzip")
        assert r["ok"], r["path"].name
    race = [r for r in rows if r["kind"] == "race"]
    assert len(race) == 20 and max(r["gzip"] for r in race) <= GZIP_LIMITS["race"]


# --- 35.5 flag ---------------------------------------------------------------


def test_the_flag_in_index_equals_what_the_1938_facts_file_says(built):
    raw = yaml.safe_load(FACTS_PATH.read_text(encoding="utf-8"))
    flag = load(built / "index.json")["street_order_checked"]
    assert flag is raw["street_order_checked"]
    assert flag is False  # still unchecked: Emmanuel sets it after checking the scans


def test_index_has_only_the_one_flag_no_1933_entry(built):
    idx = load(built / "index.json")
    assert isinstance(idx["street_order_checked"], bool)
    assert "1933" not in json.dumps(idx)


# --- task 36: display headsigns and the photo-finish band ----------------------


def test_every_trip_has_a_title_case_headsign_of_the_same_letters(built):
    from pipeline.emit import display_headsign

    seen = set()
    for f in race_files(built):
        for t in load(f)["today"]["trips"]:
            assert t["headsign_display"] == display_headsign(t["headsign"])
            assert t["headsign_display"].upper() == " ".join(t["headsign"].split()).upper()
            seen.add((t["headsign"], t["headsign_display"]))
    assert ("HARBOR EAST", "Harbor East") in seen  # the lead pair's eastbound trips


def test_index_photo_finish_band_is_the_race_constant(built):
    from pipeline.race import PHOTO_FINISH_MIN

    assert load(built / "index.json")["photo_finish_min"] == PHOTO_FINISH_MIN
