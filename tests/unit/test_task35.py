"""Task 35 unit tests: the street_order_checked flag, pass gaps, and the schema fields."""

import json
import shutil
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from pipeline.errors import FactsError
from pipeline.facts import load_facts
from pipeline.summary import find_gaps, gaps_in_window

REPO = Path(__file__).resolve().parents[2]
FIXTURE = REPO / "tests" / "fixtures" / "fake-line.yaml"
SCHEMAS = REPO / "pipeline" / "schemas"


# --- street_order_checked ----------------------------------------------------


def with_flag(tmp_path, line):
    text = FIXTURE.read_text(encoding="utf-8")
    text = text.replace("street_order_checked: false\n", line)
    p = tmp_path / "facts.yaml"
    p.write_text(text, encoding="utf-8")
    return p


def test_flag_false_and_true_are_read(tmp_path):
    assert load_facts(with_flag(tmp_path, "street_order_checked: false\n")).street_order_checked is False
    assert load_facts(with_flag(tmp_path, "street_order_checked: true\n")).street_order_checked is True


@pytest.mark.parametrize(
    "line",
    ["", "street_order_checked:\n", "street_order_checked: null\n", "street_order_checked: yes please\n",
     'street_order_checked: "false"\n', "street_order_checked: 0\n"],
)
def test_flag_missing_null_or_not_a_boolean_raises_naming_the_field(tmp_path, line):
    with pytest.raises(FactsError, match="street_order_checked"):
        load_facts(with_flag(tmp_path, line))


def test_the_real_1938_facts_file_has_the_flag_as_a_boolean():
    facts = load_facts(REPO / "data" / "lines" / "no21-1938.yaml")
    assert isinstance(facts.street_order_checked, bool)


def test_the_1933_file_is_not_read_by_the_pipeline():
    import pipeline.cli as cli
    import pipeline.emit as emit
    import pipeline.facts as facts

    for module in (cli, emit, facts):
        assert "1933" not in Path(module.__file__).read_text(encoding="utf-8"), module.__name__


# --- gaps_in_window ----------------------------------------------------------


def test_equal_gaps():
    assert gaps_in_window([0, 10, 20, 30], 0, 100) == (10.0, 10.0)


def test_two_different_gaps():
    assert gaps_in_window([540, 547, 555, 562, 570], 540, 840) == (7.0, 8.0)


def test_unsorted_input_is_sorted_first():
    assert gaps_in_window([570, 540, 555], 540, 840) == (15.0, 15.0)


def test_only_times_inside_the_window_count_and_the_end_is_excluded():
    assert gaps_in_window([500, 540, 550, 840, 900], 540, 840) == (10.0, 10.0)
    assert gaps_in_window([540, 560, 840], 540, 840) == (20.0, 20.0)  # 840 is outside


@pytest.mark.parametrize("times", [[], [600], [100, 200, 900]])
def test_fewer_than_two_times_in_the_window_raises(times):
    with pytest.raises(ValueError, match="at least two departures"):
        gaps_in_window(times, 540, 840)


def test_find_gaps_still_gives_the_bus_gaps():
    class T:
        def __init__(self, dep):
            self.dep = dep

    assert find_gaps([T(540), T(574), T(613)], 540, 840) == (34.0, 39.0)


# --- schema fields -----------------------------------------------------------


def validator(name):
    return Draft202012Validator(json.loads((SCHEMAS / f"{name}.schema.json").read_text(encoding="utf-8")))


def test_index_schema_requires_a_boolean_flag_and_labels():
    from tests.unit.test_output_schemas import index_doc

    v = validator("index")
    assert list(v.iter_errors(index_doc())) == []
    doc = index_doc()
    del doc["street_order_checked"]
    assert list(v.iter_errors(doc))
    for bad in ("false", None, 0, 1):
        doc = index_doc()
        doc["street_order_checked"] = bad
        assert list(v.iter_errors(doc)), bad
    doc = index_doc()
    doc["street_order_checked"] = True
    assert list(v.iter_errors(doc)) == []


@pytest.mark.parametrize("source", ["guide1938_diagram", "guide1938_timetable", "guide1938_route", "mta_gtfs", "osm", "method"])
def test_every_catalog_entry_requires_a_nonempty_label(source):
    from tests.unit.test_output_schemas import index_doc

    v = validator("index")
    doc = index_doc()
    del doc["sources"][source]["label"]
    assert list(v.iter_errors(doc))
    for bad in ("", None, 5):
        doc = index_doc()
        doc["sources"][source]["label"] = bad
        assert list(v.iter_errors(doc)), (source, bad)


def test_race_schema_accepts_the_new_fields_and_rejects_bad_ones():
    from tests.unit.test_output_schemas import race_doc

    v = validator("race")
    assert list(v.iter_errors(race_doc())) == []
    doc = race_doc()
    doc["today"]["window_from"] = "9:00"
    assert list(v.iter_errors(doc))
    doc = race_doc()
    doc["y1938"]["gap_min"] = -1
    assert list(v.iter_errors(doc))
    doc = race_doc()
    doc["today"]["route_names"] = [""]
    assert list(v.iter_errors(doc))
    doc = race_doc()
    doc["today"]["trips"][0]["route_display"] = ""
    assert list(v.iter_errors(doc))
