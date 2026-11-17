"""Unit tests for pipeline.facts (task 9)."""

from __future__ import annotations

import copy
from pathlib import Path

import pytest
import yaml

from pipeline.errors import FactsError, PipelineError
from pipeline.facts import FactsFile, load_facts, slugify

ROOT = Path(__file__).resolve().parents[2]
FAKE = ROOT / "tests" / "fixtures" / "fake-line.yaml"
REAL = ROOT / "data" / "lines" / "no21-1938.yaml"


def _raw() -> dict:
    return yaml.safe_load(FAKE.read_text(encoding="utf-8"))


def _write(tmp_path: Path, data: dict) -> Path:
    p = tmp_path / "facts.yaml"
    p.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
    return p


def _mutate(tmp_path: Path, fn) -> Path:
    data = copy.deepcopy(_raw())
    fn(data)
    return _write(tmp_path, data)


# --- valid loads ---------------------------------------------------------------


def test_fake_line_loads():
    facts = load_facts(FAKE)
    assert isinstance(facts, FactsFile)
    assert facts.line == "fake-no21"
    assert facts.effective == "1938-01-01"
    assert [p.slug for p in facts.timing_points] == ["fake-corner-a", "fake-corner-b"]
    assert [p.minutes_from_prev for p in facts.timing_points] == [0, 5]


def test_departures_come_from_the_file():
    facts = load_facts(FAKE)
    e = facts.midday_departures["eastbound"]
    w = facts.midday_departures["westbound"]
    assert e.minutes_past_hour == [0, 30]
    assert (e.first, e.last) == ("09:00", "13:30")
    assert (e.first_min, e.last_min) == (540.0, 810.0)
    assert w.minutes_past_hour == [5, 35]
    assert w.from_slug == "fake-corner-b"
    assert w.first_min == 545.0


def test_coordinates_are_lon_lat():
    facts = load_facts(FAKE)
    assert facts.timing_points[0].lonlat == (-76.62, 39.3)
    leg = facts.legs["eastbound"][0]
    assert leg.method == "inferred"
    assert leg.points_lonlat[0] == (-76.62, 39.3)
    assert leg.length_m == 862.6
    assert leg.note


def test_real_file_loads():
    facts = load_facts(REAL)
    assert [p.slug for p in facts.timing_points] == [
        "westwood-carey",
        "dolphin-myrtle",
        "brevard-preston",
        "preston-caroline",
        "aliceanna-bond",
    ]
    assert [p.minutes_from_prev for p in facts.timing_points] == [0, 8, 5, 8, 9]
    assert [p.inferred for p in facts.timing_points] == [False, False, True, False, False]
    assert facts.timing_points[0].lonlat == (-76.643563, 39.309495)
    assert facts.midday_departures["eastbound"].minutes_past_hour == [0, 7, 15, 22, 30, 37, 45, 52]
    assert facts.midday_departures["westbound"].last == "13:56"
    assert set(facts.legs) == {"westbound", "loop", "eastbound"}
    assert "gap" in next(l for l in facts.legs["westbound"] if l.street == "Lanvale Street").osm_ways


# --- slugify -------------------------------------------------------------------


@pytest.mark.parametrize(
    "name, slug",
    [
        ("Westwood & Carey", "westwood-carey"),
        ("Dolphin & Myrtle", "dolphin-myrtle"),
        ("Brevard & Preston", "brevard-preston"),
        ("Preston & Caroline", "preston-caroline"),
        ("Aliceanna & Bond", "aliceanna-bond"),
    ],
)
def test_slugify_real_names(name, slug):
    assert slugify(name) == slug


# --- invalid variants ----------------------------------------------------------


def test_missing_file(tmp_path):
    with pytest.raises(FactsError, match="not found"):
        load_facts(tmp_path / "nope.yaml")


def test_facts_error_is_pipeline_error(tmp_path):
    with pytest.raises(PipelineError):
        load_facts(tmp_path / "nope.yaml")


@pytest.mark.parametrize("key", ["line", "mode", "effective", "source", "pages", "timing_points", "midday_departures", "legs"])
def test_missing_top_level_field_is_named(tmp_path, key):
    p = _mutate(tmp_path, lambda d: d.pop(key))
    with pytest.raises(FactsError, match=key):
        load_facts(p)


def test_one_timing_point_rejected(tmp_path):
    p = _mutate(tmp_path, lambda d: d["timing_points"].pop())
    with pytest.raises(FactsError, match="at least two"):
        load_facts(p)


def test_first_minutes_must_be_zero(tmp_path):
    def f(d):
        d["timing_points"][0]["minutes"] = 3

    with pytest.raises(FactsError, match=r"timing_points\[0\]\.minutes"):
        load_facts(_mutate(tmp_path, f))


@pytest.mark.parametrize("bad", [0, -2, 2.5, "5"])
def test_later_minutes_must_be_positive_whole(tmp_path, bad):
    def f(d):
        d["timing_points"][1]["minutes"] = bad

    with pytest.raises(FactsError, match=r"timing_points\[1\]\.minutes"):
        load_facts(_mutate(tmp_path, f))


def test_missing_minutes_named(tmp_path):
    p = _mutate(tmp_path, lambda d: d["timing_points"][1].pop("minutes"))
    with pytest.raises(FactsError, match=r"timing_points\[1\]\.minutes"):
        load_facts(p)


def test_missing_lonlat_named(tmp_path):
    p = _mutate(tmp_path, lambda d: d["timing_points"][0].pop("lonlat"))
    with pytest.raises(FactsError, match=r"timing_points\[0\]\.lonlat"):
        load_facts(p)


def test_wrong_slug_rejected(tmp_path):
    def f(d):
        d["timing_points"][0]["slug"] = "wrong"

    with pytest.raises(FactsError, match="slug"):
        load_facts(_mutate(tmp_path, f))


@pytest.mark.parametrize("direction", ["eastbound", "westbound"])
@pytest.mark.parametrize("key", ["minutes_past_hour", "first", "last"])
def test_missing_departure_field_named(tmp_path, direction, key):
    p = _mutate(tmp_path, lambda d: d["midday_departures"][direction].pop(key))
    with pytest.raises(FactsError, match=f"midday_departures.{direction}.{key}"):
        load_facts(p)


def test_missing_direction_named(tmp_path):
    p = _mutate(tmp_path, lambda d: d["midday_departures"].pop("westbound"))
    with pytest.raises(FactsError, match="midday_departures.westbound"):
        load_facts(p)


def test_bad_first_time_format(tmp_path):
    def f(d):
        d["midday_departures"]["eastbound"]["first"] = "9am"

    with pytest.raises(FactsError, match="first"):
        load_facts(_mutate(tmp_path, f))


@pytest.mark.parametrize("key", ["street", "method", "length_m"])
def test_missing_leg_field_named(tmp_path, key):
    p = _mutate(tmp_path, lambda d: d["legs"]["eastbound"][0].pop(key))
    with pytest.raises(FactsError, match=rf"legs\.eastbound\[0\]\.{key}"):
        load_facts(p)


def test_inferred_leg_needs_points(tmp_path):
    p = _mutate(tmp_path, lambda d: d["legs"]["eastbound"][0].pop("points_lonlat"))
    with pytest.raises(FactsError, match="points_lonlat"):
        load_facts(p)


def test_inferred_leg_needs_note(tmp_path):
    p = _mutate(tmp_path, lambda d: d["legs"]["westbound"][0].pop("note"))
    with pytest.raises(FactsError, match=r"legs\.westbound\[0\]\.note"):
        load_facts(p)


def _osm_leg(**over):
    leg = {
        "street": "Fake Street",
        "method": "osm",
        "osm_ways": [1, 2],
        "clip_from_lonlat": [-76.62, 39.3],
        "clip_to_lonlat": [-76.61, 39.3],
        "length_m": 100.0,
    }
    leg.update(over)
    return leg


def test_valid_osm_leg_loads(tmp_path):
    p = _mutate(tmp_path, lambda d: d["legs"]["eastbound"].__setitem__(0, _osm_leg()))
    leg = load_facts(p).legs["eastbound"][0]
    assert leg.osm_ways == [1, 2]
    assert leg.clip_from_lonlat == (-76.62, 39.3)


@pytest.mark.parametrize("key", ["osm_ways", "clip_from_lonlat", "clip_to_lonlat"])
def test_osm_leg_missing_field_named(tmp_path, key):
    leg = _osm_leg()
    leg.pop(key)
    p = _mutate(tmp_path, lambda d: d["legs"]["eastbound"].__setitem__(0, leg))
    with pytest.raises(FactsError, match=key):
        load_facts(p)


def test_gap_requires_osm_plus_gap(tmp_path):
    p = _mutate(tmp_path, lambda d: d["legs"]["eastbound"].__setitem__(0, _osm_leg(osm_ways=[1, "gap", 2])))
    with pytest.raises(FactsError, match="gap"):
        load_facts(p)
    p2 = _mutate(tmp_path, lambda d: d["legs"]["eastbound"].__setitem__(0, _osm_leg(method="osm+gap", osm_ways=[1, "gap", 2])))
    assert load_facts(p2).legs["eastbound"][0].osm_ways == [1, "gap", 2]


def test_out_of_range_lonlat_rejected(tmp_path):
    def f(d):
        d["timing_points"][0]["lonlat"] = [-76.62, 139.3]  # lat beyond 90

    with pytest.raises(FactsError, match="lonlat"):
        load_facts(_mutate(tmp_path, f))


def test_departure_origin_must_be_a_timing_point(tmp_path):
    def f(d):
        d["midday_departures"]["eastbound"]["from"] = "Nowhere & Never"

    with pytest.raises(FactsError, match="from"):
        load_facts(_mutate(tmp_path, f))


def test_invalid_yaml(tmp_path):
    p = tmp_path / "bad.yaml"
    p.write_text("line: [unclosed", encoding="utf-8")
    with pytest.raises(FactsError, match="not valid YAML"):
        load_facts(p)
