"""
Unit tests for pipeline/emit.py using made-up data (fake corners, fake trips).
Nothing here reads the feed zip, and nothing is written to web/.
"""

import gzip
import json
import os
from copy import deepcopy
from pathlib import Path

import pytest

from pipeline import emit
from pipeline.clock import build_clock
from pipeline.eligible import EligibleTrip
from pipeline.emit import (
    GZIP_LIMITS,
    check_budgets,
    check_source_coverage,
    emit_all,
    report_sizes,
    select_trips,
    validate_against_schema,
)
from pipeline.errors import ValidationError
from pipeline.facts import load_facts
from pipeline.race import run_all_races
from pipeline.route import build_route
from pipeline.stops import Stop
from pipeline.summary import compute_summary

FIXTURE_FACTS = Path(__file__).resolve().parents[1] / "fixtures" / "fake-line.yaml"
SHA = "0" * 63 + "1"
A, B = "fake-corner-a", "fake-corner-b"


def make_trip(dep, trip_id=None, stop="s1"):
    s = Stop(stop, "FAKE STOP", (-76.62, 39.3), 100.0, 100.0 * 1.3 / 1.2 / 60)
    t = Stop("s2", "FAKE STOP 2", (-76.61, 39.3), 50.0, 50.0 * 1.3 / 1.2 / 60)
    h, m = divmod(int(dep), 60)
    ah, am = divmod(int(dep) + 5, 60)
    return EligibleTrip(
        trip_id=trip_id or f"fake-{int(dep)}",
        route="Fake Route",
        headsign="FAKE HEADSIGN",
        board_stop=s,
        alight_stop=t,
        dep=float(dep),
        arr=float(dep) + 5.0,
        dep_str=f"{h:02d}:{m:02d}:00",
        arr_str=f"{ah:02d}:{am:02d}:00",
        ride_min=5.0,
        access_min=s.walk_min,
        egress_min=t.walk_min,
    )


def world(a_to_b_trips=None, b_to_a_trips=()):
    facts = load_facts(FIXTURE_FACTS)
    facts.pages["route_diagram"] = "https://example.com/fake-diagram"
    # The fake timetable ends at 13:30; extend it so every slider minute has a car.
    facts.midday_departures["eastbound"].last_min = 14 * 60 + 30.0
    facts.midday_departures["westbound"].last_min = 14 * 60 + 35.0
    if a_to_b_trips is None:
        a_to_b_trips = [make_trip(600 + 30 * k) for k in range(10)]
    pairs = [(A, B), (B, A)]
    eligible = {(A, B): list(a_to_b_trips), (B, A): list(b_to_a_trips)}
    clocks = build_clock(facts)
    races = run_all_races(pairs, clocks, eligible, facts)
    summary = compute_summary(races, eligible, facts)
    route = build_route(facts, {})
    return facts, races, eligible, summary, route, clocks


def run_emit(tmp_path, **kw):
    facts, races, eligible, summary, route, clocks = world(**kw)
    rows = emit_all(facts, races, eligible, summary, route, clocks, SHA, "fake1", "2026-11-04", tmp_path)
    return rows, (facts, races, eligible, summary, route, clocks)


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


# --- structure ---------------------------------------------------------------


def test_emit_all_writes_every_file_and_validates(tmp_path):
    run_emit(tmp_path)
    names = sorted(p.relative_to(tmp_path).as_posix() for p in tmp_path.rglob("*") if p.is_file())
    assert names == [
        "index.json",
        f"race/{A}__{B}.json",
        f"race/{B}__{A}.json",
        "route.geojson",
        "summary.json",
    ]


def test_files_are_utf8_without_bom_lf_and_compact(tmp_path):
    run_emit(tmp_path)
    for p in tmp_path.rglob("*"):
        if not p.is_file():
            continue
        data = p.read_bytes()
        assert not data.startswith(b"\xef\xbb\xbf"), p.name
        assert b"\r" not in data, p.name
        assert data.endswith(b"}\n") and data.count(b"\n") == 1, p.name
        text = data.decode("utf-8")
        assert '": ' not in text and '", ' not in text, p.name  # compact separators


def test_key_order_is_fixed(tmp_path):
    run_emit(tmp_path)
    race = load(tmp_path / "race" / f"{A}__{B}.json")
    assert list(race) == [
        "schema", "line", "origin", "dest", "direction", "inferred", "service_date", "feed_version",
        "feed_sha256", "radius_m", "y1938", "today", "races", "sources",
    ]
    assert list(race["races"][0]) == ["t", "start", "before_table", "y1938", "today", "result", "margin", "wait_most"]
    assert list(load(tmp_path / "index.json"))[:3] == ["schema", "line", "mode"]


def test_output_is_deterministic(tmp_path):
    run_emit(tmp_path / "one")
    run_emit(tmp_path / "two")
    for p in (tmp_path / "one").rglob("*"):
        if p.is_file():
            assert p.read_bytes() == (tmp_path / "two" / p.relative_to(tmp_path / "one")).read_bytes()


def test_race_file_has_293_rows_and_no_exact_fields(tmp_path):
    run_emit(tmp_path)
    race = load(tmp_path / "race" / f"{A}__{B}.json")
    assert len(race["races"]) == 293
    assert race["races"][0]["t"] == "09:00" and race["races"][-1]["t"] == "13:52"
    assert "_exact" not in (tmp_path / "race" / f"{A}__{B}.json").read_text(encoding="utf-8")


def test_times_are_hhmm_and_gtfs_times_are_hhmmss(tmp_path):
    run_emit(tmp_path)
    race = load(tmp_path / "race" / f"{A}__{B}.json")
    row = race["races"][0]
    assert len(row["t"]) == 5 and len(row["start"]) == 5 and len(row["y1938"]["dep"]) == 5
    trip = race["today"]["trips"][0]
    assert len(trip["dep"]) == 8 and len(trip["arr"]) == 8


def test_durations_are_rounded_to_three_decimals_only_at_emit(tmp_path):
    facts, races, eligible, summary, route, clocks = world()
    row = next(r for r in races[(A, B)] if r.today is not None)
    assert round(row.today.total, 3) != row.today.total  # full precision before emit
    emit_all(facts, races, eligible, summary, route, clocks, SHA, "fake1", "2026-11-04", tmp_path)
    doc = load(tmp_path / "race" / f"{A}__{B}.json")
    emitted = doc["races"][0]["today"]
    assert emitted["total"] == round(races[(A, B)][0].today.total, 3)


def test_index_has_catalog_with_the_two_decided_urls(tmp_path):
    run_emit(tmp_path)
    idx = load(tmp_path / "index.json")
    assert set(idx["sources"]) == set(emit.SOURCE_IDS)
    assert idx["sources"]["mta_gtfs"]["url"] == "https://feeds.mta.maryland.gov/gtfs/local-bus"
    assert idx["sources"]["osm"]["url"] == "https://www.openstreetmap.org/copyright"
    assert idx["sources"]["method"]["url"] is None
    assert [c["slug"] for c in idx["corners"]] == [A, B]
    assert idx["pairs"] == [{"origin": A, "dest": B}, {"origin": B, "dest": A}]


def test_summary_has_counts_and_per_pair_section(tmp_path):
    _, (_, _, _, summary, _, _) = run_emit(tmp_path)
    doc = load(tmp_path / "summary.json")
    assert doc["races"] == summary.races
    assert [(p["origin"], p["dest"]) for p in doc["pairs"]] == [(A, B), (B, A)]
    ab, ba = doc["pairs"]
    assert ab["ride_verdict"] in ("same", "faster today", "slower today")
    assert ab["ride_today_median"] is not None and ab["delta"] is not None
    assert (ba["ride_today_median"], ba["delta"], ba["ride_verdict"]) == (None, None, None)
    assert doc["pairs_without_one_seat_ride"] == 1


def test_route_geojson_legs_carry_required_properties(tmp_path):
    run_emit(tmp_path)
    doc = load(tmp_path / "route.geojson")
    assert doc["type"] == "FeatureCollection"
    for f in doc["features"]:
        assert set(f["properties"]) >= {"direction", "street", "method", "note", "length_m"}


# --- today.trips selection (task 35.4, replacing Decision 1) -------------------


def _rows_using(trips):
    from types import SimpleNamespace

    return [SimpleNamespace(today=SimpleNamespace(trip=t)) for t in trips] + [SimpleNamespace(today=None)]


def test_select_trips_keeps_every_trip_from_0900_through_three_after_the_last_used():
    trips = [make_trip(600 + 10 * k) for k in range(12)]
    chosen = select_trips(trips, _rows_using([trips[2], trips[4], trips[5]]))
    # trips[3] is never used by a row but leaves between two used ones: it stays.
    assert chosen == trips[0:9]


def test_select_trips_drops_trips_before_0900():
    early = [make_trip(500), make_trip(539)]  # 08:20 and 08:59
    trips = early + [make_trip(540 + 10 * k) for k in range(6)]  # from 09:00
    chosen = select_trips(trips, _rows_using([trips[3]]))
    assert chosen == trips[2:7]  # 09:00 onward, through three after the used trip
    assert all(t.dep >= 540 for t in chosen)


def test_select_trips_keeps_a_trip_leaving_exactly_at_0900():
    trips = [make_trip(540), make_trip(550)]
    assert select_trips(trips, _rows_using([trips[1]])) == trips


def test_select_trips_stops_at_end_of_day_when_fewer_than_three_remain():
    trips = [make_trip(600 + 10 * k) for k in range(5)]
    assert select_trips(trips, _rows_using([trips[3]])) == trips


def test_select_trips_takes_exactly_three_after_the_last_used():
    trips = [make_trip(600 + 10 * k) for k in range(12)]
    assert select_trips(trips, _rows_using([trips[1]])) == trips[0:5]


def test_select_trips_empty_when_no_row_uses_a_trip():
    trips = [make_trip(600 + 10 * k) for k in range(5)]
    assert select_trips(trips, _rows_using([])) == []


def test_race_rows_point_at_the_index_in_the_emitted_list(tmp_path):
    run_emit(tmp_path)
    race = load(tmp_path / "race" / f"{A}__{B}.json")
    trips = race["today"]["trips"]
    assert [t["i"] for t in trips] == list(range(len(trips)))
    assert [t["dep"] for t in trips] == sorted(t["dep"] for t in trips)
    used = {r["today"]["trip"] for r in race["races"] if r["today"]}
    assert used <= set(range(len(trips)))
    assert len(trips) == min(max(used) + 1 + 3, 10)  # through three after the last used, 10 eligible trips


def test_emitted_list_has_no_departure_before_0900_and_no_hole(tmp_path):
    early = [make_trip(480), make_trip(520)]
    later = [make_trip(600 + 30 * k) for k in range(10)]
    run_emit(tmp_path, a_to_b_trips=early + later)
    trips = load(tmp_path / "race" / f"{A}__{B}.json")["today"]["trips"]
    assert [t["trip_id"] for t in trips] == [t.trip_id for t in later]


# --- task 35: labels, flag, 1938 spacing, window, route names ----------------


def test_every_catalog_entry_has_a_label(tmp_path):
    run_emit(tmp_path)
    sources = load(tmp_path / "index.json")["sources"]
    assert {k: v["label"] for k, v in sources.items()} == {
        "guide1938_diagram": "1938 route diagram, Digital Maryland",
        "guide1938_timetable": "1938 timetable, Digital Maryland",
        "guide1938_route": "1938 route description, Digital Maryland",
        "mta_gtfs": "MDOT MTA local bus schedule (GTFS feed)",
        "osm": "OpenStreetMap contributors",
        "method": "Ghost Line method",
    }


def test_street_order_checked_flag_comes_from_the_facts_file(tmp_path):
    facts, races, eligible, summary, route, clocks = world()
    assert facts.street_order_checked is False
    emit_all(facts, races, eligible, summary, route, clocks, SHA, "fake1", "2026-11-04", tmp_path / "a")
    assert load(tmp_path / "a" / "index.json")["street_order_checked"] is False
    facts.street_order_checked = True
    emit_all(facts, races, eligible, summary, route, clocks, SHA, "fake1", "2026-11-04", tmp_path / "b")
    assert load(tmp_path / "b" / "index.json")["street_order_checked"] is True


def test_1938_spacing_comes_from_the_clock_passes_in_the_window(tmp_path):
    facts, races, eligible, summary, route, clocks = world()
    run_emit(tmp_path)
    y = load(tmp_path / "race" / f"{A}__{B}.json")["y1938"]
    passes = [p for p in clocks["eastbound"][A].passes if 540.0 <= p < 840.0]
    gaps = [b - a for a, b in zip(passes, passes[1:])]
    assert (y["gap_min"], y["gap_max"]) == (min(gaps), max(gaps))
    assert list(y)[:5] == ["ride_min", "covered_from", "passes", "gap_min", "gap_max"]


def test_the_bus_window_is_written_from_the_summary_constants(tmp_path):
    run_emit(tmp_path)
    today = load(tmp_path / "race" / f"{A}__{B}.json")["today"]
    assert (today["window_from"], today["window_to"]) == ("09:00", "14:00")


def test_route_names_are_the_distinct_display_names_in_order(tmp_path):
    from dataclasses import replace

    trips = [make_trip(600), make_trip(630), make_trip(660), make_trip(690)]
    trips = [replace(t, route=r) for t, r in zip(trips, ["CityLink NAVY", "CityLink LIME", "CityLink NAVY", "54"])]
    run_emit(tmp_path, a_to_b_trips=trips + [make_trip(700 + 30 * k) for k in range(8)])
    race = load(tmp_path / "race" / f"{A}__{B}.json")["today"]
    assert race["route_names"][:3] == ["CityLink Navy", "CityLink Lime", "Route 54"]
    by_id = {t["trip_id"]: t for t in race["trips"]}
    assert by_id["fake-600"]["route"] == "CityLink NAVY"  # the GTFS name stays
    assert by_id["fake-600"]["route_display"] == "CityLink Navy"


def test_route_names_are_empty_when_the_list_is_empty(tmp_path):
    run_emit(tmp_path)
    assert load(tmp_path / "race" / f"{B}__{A}.json")["today"]["route_names"] == []


@pytest.mark.parametrize(
    "name, shown",
    [
        ("CityLink LIME", "CityLink Lime"),
        ("CityLink NAVY", "CityLink Navy"),
        ("CityLink Lime", "CityLink Lime"),
        ("54", "Route 54"),
        ("Fake Route", "Fake Route"),
        ("A", "A"),  # a one-letter word is left alone
        ("  CityLink   GOLD ", "CityLink Gold"),
        ("MARC", "Marc"),
        ("54 EXPRESS", "54 Express"),
    ],
)
def test_display_route_name_rule(name, shown):
    assert emit.display_route_name(name) == shown


@pytest.mark.parametrize("name", ["", "   ", None])
def test_display_route_name_rejects_an_empty_name(name):
    with pytest.raises(ValueError):
        emit.display_route_name(name)


def test_schema_requires_the_task_35_fields(tmp_path):
    run_emit(tmp_path)
    path = tmp_path / "race" / f"{A}__{B}.json"
    doc = load(path)
    cases = [
        (lambda d: d["y1938"].pop("gap_min"), "gap_min"),
        (lambda d: d["y1938"].pop("gap_max"), "gap_max"),
        (lambda d: d["today"].pop("window_from"), "window_from"),
        (lambda d: d["today"].pop("window_to"), "window_to"),
        (lambda d: d["today"].pop("route_names"), "route_names"),
        (lambda d: d["today"]["trips"][0].pop("route_display"), "route_display"),
    ]
    for mutate, field in cases:
        bad = json.loads(json.dumps(doc))
        mutate(bad)
        target = tmp_path / "bad.json"
        target.write_text(json.dumps(bad), encoding="utf-8")
        with pytest.raises(ValidationError, match=field):
            validate_against_schema(target, emit.SCHEMA_DIR / "race.schema.json")


# --- gap nulls (Decision 4), both ways ---------------------------------------


def test_gaps_are_numbers_when_trips_exist(tmp_path):
    run_emit(tmp_path)
    today = load(tmp_path / "race" / f"{A}__{B}.json")["today"]
    assert today["trips"] and today["gap_min"] == 30 and today["gap_max"] == 30


def test_gaps_are_null_when_trips_are_empty(tmp_path):
    run_emit(tmp_path)
    today = load(tmp_path / "race" / f"{B}__{A}.json")["today"]
    assert today["trips"] == [] and today["gap_min"] is None and today["gap_max"] is None


def test_trips_present_but_fewer_than_two_departures_in_window_raises(tmp_path):
    with pytest.raises(ValidationError, match="gap_min and gap_max"):
        # One trip at 13:55 is the only departure in [09:00, 14:00); the one at 15:00 is outside it.
        run_emit(tmp_path, a_to_b_trips=[make_trip(835), make_trip(900)])


def test_schema_rejects_null_gaps_when_trips_exist(tmp_path):
    run_emit(tmp_path)
    path = tmp_path / "race" / f"{A}__{B}.json"
    doc = load(path)
    doc["today"]["gap_min"] = None
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(doc), encoding="utf-8")
    with pytest.raises(ValidationError):
        validate_against_schema(bad, emit.SCHEMA_DIR / "race.schema.json")


def test_schema_accepts_null_gaps_when_trips_empty(tmp_path):
    run_emit(tmp_path)
    validate_against_schema(tmp_path / "race" / f"{B}__{A}.json", emit.SCHEMA_DIR / "race.schema.json")


# --- schema validation -------------------------------------------------------


def test_validate_against_schema_raises_with_location(tmp_path):
    run_emit(tmp_path)
    doc = load(tmp_path / "summary.json")
    doc["races"] = "many"
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(doc), encoding="utf-8")
    with pytest.raises(ValidationError, match="races"):
        validate_against_schema(bad, emit.SCHEMA_DIR / "summary.schema.json")


def test_summary_schema_requires_pairs(tmp_path):
    run_emit(tmp_path)
    doc = load(tmp_path / "summary.json")
    del doc["pairs"]
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(doc), encoding="utf-8")
    with pytest.raises(ValidationError, match="pairs"):
        validate_against_schema(bad, emit.SCHEMA_DIR / "summary.schema.json")


# --- source coverage (B16) ---------------------------------------------------


def _docs(tmp_path):
    run_emit(tmp_path)
    docs = {"index": load(tmp_path / "index.json"), "summary": load(tmp_path / "summary.json"),
            "route": load(tmp_path / "route.geojson")}
    for p in (tmp_path / "race").iterdir():
        docs[f"race/{p.name}"] = load(p)
    return docs


def test_source_coverage_passes_on_emitted_files(tmp_path):
    check_source_coverage(_docs(tmp_path))


def test_source_coverage_lists_unresolved_ids(tmp_path):
    docs = _docs(tmp_path)
    docs["summary"]["sources"]["races"] = ["mta_gtfs", "nope_id"]
    with pytest.raises(ValidationError, match="nope_id"):
        check_source_coverage(docs)


def test_source_coverage_lists_uncovered_numeric_field(tmp_path):
    docs = _docs(tmp_path)
    del docs["summary"]["sources"]["wins_today"]
    with pytest.raises(ValidationError, match="wins_today"):
        check_source_coverage(docs)


def test_source_coverage_flags_missing_catalog_entry(tmp_path):
    docs = _docs(tmp_path)
    del docs["index"]["sources"]["osm"]
    with pytest.raises(ValidationError, match="osm"):
        check_source_coverage(docs)


def test_source_coverage_flags_new_uncovered_top_level_number(tmp_path):
    docs = _docs(tmp_path)
    docs["route"]["extra_count"] = 7
    with pytest.raises(ValidationError, match="extra_count"):
        check_source_coverage(docs)


# --- sizes (Decision 2) ------------------------------------------------------


def test_limits_are_gzip_only():
    assert GZIP_LIMITS == {"index": 10 * 1024, "summary": 10 * 1024, "route": 10 * 1024, "race": 20 * 1024}


def test_size_report_gives_raw_and_gzip_for_every_file(tmp_path):
    rows, _ = run_emit(tmp_path)
    assert len(rows) == 5
    for r in rows:
        data = r["path"].read_bytes()
        assert r["raw"] == len(data)
        assert r["gzip"] == len(gzip.compress(data, mtime=0))
        assert r["ok"]
    text = emit.format_size_report(rows)
    assert "index.json" in text and "gzip" in text


def test_large_raw_but_small_gzip_passes(tmp_path):
    big = tmp_path / "race" / "x__y.json"
    big.parent.mkdir()
    big.write_bytes(b'{"a":"' + b"a" * 300_000 + b'"}\n')  # 300 KB raw, tiny gzip
    rows = report_sizes([big])
    assert rows[0]["raw"] > 45 * 1024 and rows[0]["gzip"] < 20 * 1024
    check_budgets(rows)  # raw size is not a limit


def test_race_file_over_20kb_gzip_fails(tmp_path):
    big = tmp_path / "race" / "x__y.json"
    big.parent.mkdir()
    big.write_bytes(os.urandom(21 * 1024))  # random bytes do not compress
    rows = report_sizes([big])
    assert not rows[0]["ok"]
    with pytest.raises(ValidationError, match="x__y.json"):
        check_budgets(rows)


def test_race_file_just_under_20kb_gzip_passes(tmp_path):
    ok = tmp_path / "race" / "x__y.json"
    ok.parent.mkdir()
    ok.write_bytes(os.urandom(19 * 1024))
    check_budgets(report_sizes([ok]))


@pytest.mark.parametrize("name", ["index.json", "summary.json", "route.geojson"])
def test_small_files_fail_over_10kb_gzip_and_pass_between_10_and_20(tmp_path, name):
    p = tmp_path / name
    p.write_bytes(os.urandom(11 * 1024))
    with pytest.raises(ValidationError, match=name):
        check_budgets(report_sizes([p]))
    p.write_bytes(os.urandom(9 * 1024))
    check_budgets(report_sizes([p]))


def test_emit_all_fails_when_a_file_is_over_the_gzip_limit(tmp_path, monkeypatch):
    monkeypatch.setitem(emit.GZIP_LIMITS, "summary", 10)
    with pytest.raises(ValidationError, match="summary.json"):
        run_emit(tmp_path)


def test_input_objects_are_not_mutated(tmp_path):
    facts, races, eligible, summary, route, clocks = world()
    before = deepcopy((races, eligible))
    emit_all(facts, races, eligible, summary, route, clocks, SHA, "fake1", "2026-11-04", tmp_path)
    assert (races, eligible) == before
