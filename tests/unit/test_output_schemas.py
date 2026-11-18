"""Schema contract tests for index, race, summary and route (B2, B12, B16).

These prove file shape only. Route joining, counting and cross-file ID
resolution belong to later tasks.
"""

import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

SCHEMAS = Path(__file__).resolve().parents[2] / "pipeline" / "schemas"
NAMES = ["index", "race", "summary", "route"]
IDS = ["guide1938_diagram", "guide1938_timetable", "guide1938_route", "mta_gtfs", "osm", "method"]
SHA = "8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694"


def validator(name):
    return Draft202012Validator(json.loads((SCHEMAS / f"{name}.schema.json").read_text(encoding="utf-8")))


def errors(name, doc):
    return list(validator(name).iter_errors(doc))


@pytest.mark.parametrize("name", NAMES)
def test_schema_is_valid(name):
    Draft202012Validator.check_schema(json.loads((SCHEMAS / f"{name}.schema.json").read_text(encoding="utf-8")))


# ---------- builders ----------

def entry(year=1938):
    return {"what": "w", "year": year, "where": "p. 1", "url": "https://example.com/x"}


def index_doc():
    return {
        "schema": "ghostline.index.v1", "line": "no21-1938", "mode": "trackless_trolley",
        "effective": "1938-03-06",
        "corners": [{"slug": "westwood-carey", "name": "Westwood & Carey",
                     "lonlat": [-76.64, 39.30], "inferred": False, "note": None}],
        "pairs": [{"origin": "westwood-carey", "dest": "dolphin-myrtle"}],
        "service_date": "2026-11-04", "feed_version": "20260821", "feed_sha256": SHA,
        "sources": {
            "guide1938_diagram": entry(), "guide1938_timetable": entry(),
            "guide1938_route": entry(), "mta_gtfs": entry(2026), "osm": entry(2026),
            "method": {"what": "m", "year": None, "where": "docs", "url": None},
        },
    }


def race_row(i, covered="09:21"):
    h, m = divmod(540 + i, 60)
    t = f"{h:02d}:{m:02d}"
    before = t < covered
    return {
        "t": t, "start": covered if before else t, "before_table": before,
        "y1938": {"dep": "09:21", "wait": 0.0, "total": 9.0},
        "today": {"trip": 0, "wait": 5.5, "total": 20.25},
        "result": "1938", "margin": 11.25,
    }


def race_doc(rows=293):
    return {
        "schema": "ghostline.race.v1", "line": "no21-1938", "origin": "preston-caroline",
        "dest": "aliceanna-bond", "direction": "eastbound", "inferred": False,
        "service_date": "2026-11-04", "feed_version": "20260821", "feed_sha256": SHA,
        "radius_m": 400,
        "y1938": {"ride_min": 9, "covered_from": "09:21", "passes": ["09:21", "09:28"],
                  "sources": {"ride_min": "https://example.com/201", "passes": "https://example.com/202"}},
        "today": {"gap_min": 34.0, "gap_max": 39.0, "trips": [{
            "i": 0, "trip_id": "4110804", "route": "CityLink Lime", "headsign": "HARBOR EAST",
            "board": {"stop_id": "8564", "name": "B", "walk_m": 125.07, "walk_min": 2.258},
            "alight": {"stop_id": "9486", "name": "A", "walk_m": 230.15, "walk_min": 4.156},
            "dep": "10:32:43", "arr": "10:41:00", "ride_min": 8.283}]},
        "races": [race_row(i) for i in range(rows)],
        "sources": {
            "y1938": ["guide1938_diagram", "guide1938_timetable"],
            "today": ["mta_gtfs", "method"],
            "races": ["guide1938_diagram", "guide1938_timetable", "mta_gtfs", "method"],
            "radius_m": ["method"],
        },
    }


def summary_doc():
    ids = ["guide1938_diagram", "guide1938_timetable", "mta_gtfs", "method"]
    keys = ["races", "wins_1938", "wins_today", "photo_finishes", "ride_same",
            "ride_faster_today", "ride_slower_today", "pairs_without_one_seat_ride", "today_wins", "pairs"]
    return {
        "schema": "ghostline.summary.v1", "definition": "d", "races": 1, "wins_1938": 1,
        "wins_today": 0, "photo_finishes": 0, "ride_same": 17, "ride_faster_today": 3,
        "ride_slower_today": 0, "pairs_without_one_seat_ride": 0,
        "today_wins": [{"origin": "a", "dest": "b", "t": "10:00", "margin": 1.5}],
        "pairs": [{"origin": "a", "dest": "b", "races": 1, "wins_1938": 1, "wins_today": 0,
                   "photo_finishes": 0, "ride_1938": 8, "ride_today_median": 6.0, "delta": -2.0,
                   "ride_verdict": "faster today"}],
        "sources": {k: list(ids) for k in keys},
    }


def leg(direction="eastbound"):
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": [[-76.6, 39.3], [-76.59, 39.31]]},
        "properties": {"direction": direction, "street": "Carey St", "method": "osm",
                       "note": None, "length_m": 249.2},
    }


def route_doc(*directions):
    return {"type": "FeatureCollection",
            "features": [leg(d) for d in (directions or ("eastbound",))],
            "sources": {"features": ["guide1938_route", "osm", "method"]}}


# ---------- valid documents ----------

def test_valid_documents_for_all_four_schemas():
    assert errors("index", index_doc()) == []
    assert errors("race", race_doc()) == []
    assert errors("summary", summary_doc()) == []
    assert errors("route", route_doc("westbound", "eastbound")) == []


# ---------- B2 route legs ----------

@pytest.mark.parametrize("direction", ["eastbound", "westbound"])
def test_route_leg_each_direction_valid(direction):
    assert errors("route", route_doc(direction)) == []


@pytest.mark.parametrize("field", ["direction", "street", "method", "note", "length_m"])
def test_route_leg_missing_field_rejected(field):
    doc = route_doc()
    del doc["features"][0]["properties"][field]
    assert errors("route", doc)


@pytest.mark.parametrize("bad", ["loop", "north", "", None])
def test_route_leg_invalid_direction_rejected(bad):
    doc = route_doc()
    doc["features"][0]["properties"]["direction"] = bad
    assert errors("route", doc)


def test_route_leg_negative_length_rejected_zero_allowed():
    doc = route_doc()
    doc["features"][0]["properties"]["length_m"] = -0.1
    assert errors("route", doc)
    doc["features"][0]["properties"]["length_m"] = 0
    assert errors("route", doc) == []


# ---------- B12 race rows ----------

def test_race_has_293_rows_with_pre_coverage_rows():
    doc = race_doc()
    rows = doc["races"]
    assert len(rows) == 293
    assert rows[0]["t"] == "09:00" and rows[-1]["t"] == "13:52"
    pre = [r for r in rows if r["before_table"]]
    assert len(pre) == 21  # 09:00..09:20
    assert all(r["start"] == "09:21" for r in pre)
    assert errors("race", doc) == []


@pytest.mark.parametrize("n", [292, 294])
def test_race_rejects_wrong_row_count(n):
    assert errors("race", race_doc(rows=n))


# ---------- B16 sources ----------

def test_index_old_sources_array_rejected():
    doc = index_doc()
    doc["sources"] = [{"field": "x", "url": "https://example.com"}]
    assert errors("index", doc)


@pytest.mark.parametrize("missing", IDS)
def test_index_catalog_requires_all_six_entries(missing):
    doc = index_doc()
    del doc["sources"][missing]
    assert errors("index", doc)


def test_index_catalog_rejects_unknown_id():
    doc = index_doc()
    doc["sources"]["extra"] = entry()
    assert errors("index", doc)


@pytest.mark.parametrize("field", ["what", "year", "where", "url"])
def test_index_catalog_entry_incomplete_rejected(field):
    doc = index_doc()
    del doc["sources"]["osm"][field]
    assert errors("index", doc)
    doc = index_doc()
    del doc["sources"]["method"][field]
    assert errors("index", doc)


def test_index_null_year_url_allowed_only_for_method():
    doc = index_doc()
    assert doc["sources"]["method"]["year"] is None and doc["sources"]["method"]["url"] is None
    assert errors("index", doc) == []
    doc["sources"]["osm"]["url"] = None
    assert errors("index", doc)
    doc = index_doc()
    doc["sources"]["osm"]["year"] = None
    assert errors("index", doc)


@pytest.mark.parametrize("name,make,block", [
    ("race", race_doc, "y1938"),
    ("race", race_doc, "today"),
    ("race", race_doc, "races"),
    ("race", race_doc, "radius_m"),
    ("summary", summary_doc, "races"),
    ("summary", summary_doc, "today_wins"),
    ("route", route_doc, "features"),
])
def test_missing_required_source_mapping_rejected(name, make, block):
    doc = make()
    del doc["sources"][block]
    assert errors(name, doc)


@pytest.mark.parametrize("name,make", [("race", race_doc), ("summary", summary_doc), ("route", route_doc)])
def test_missing_sources_object_rejected(name, make):
    doc = make()
    del doc["sources"]
    assert errors(name, doc)


@pytest.mark.parametrize("name,make,block", [
    ("race", race_doc, "today"),
    ("summary", summary_doc, "wins_today"),
    ("route", route_doc, "features"),
])
def test_unknown_source_id_and_empty_list_rejected(name, make, block):
    doc = make()
    doc["sources"][block] = doc["sources"][block] + ["not_a_source"]
    assert errors(name, doc)
    doc = make()
    doc["sources"][block] = []
    assert errors(name, doc)


def test_race_mappings_must_contain_required_ids():
    doc = race_doc()
    doc["sources"]["y1938"] = ["guide1938_diagram"]
    assert errors("race", doc)
    doc = race_doc()
    doc["sources"]["today"] = ["mta_gtfs"]
    assert errors("race", doc)
    doc = race_doc()
    doc["sources"]["races"] = ["mta_gtfs", "method"]
    assert errors("race", doc)
    doc = race_doc()
    doc["sources"]["radius_m"] = ["osm"]
    assert errors("race", doc)


def test_summary_and_route_mappings_must_contain_required_ids():
    doc = summary_doc()
    doc["sources"]["races"] = ["method"]
    assert errors("summary", doc)
    doc = route_doc()
    doc["sources"]["features"] = ["osm", "method"]
    assert errors("route", doc)


def test_race_nested_y1938_source_urls_preserved():
    doc = race_doc()
    del doc["y1938"]["sources"]["passes"]
    assert errors("race", doc)


def test_schemas_do_not_mutate_between_calls():
    doc = copy.deepcopy(race_doc())
    assert errors("race", doc) == []
    assert errors("race", doc) == []
