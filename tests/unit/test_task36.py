"""Task 36 unit tests: the display headsign and the photo-finish band in index.json.

Made-up data only. No feed is read and nothing is written to web/.
"""

import json

import pytest
from jsonschema import Draft202012Validator

from pipeline import emit
from pipeline.race import PHOTO_FINISH_MIN
from tests.unit.test_emit import A, B, load, make_trip, run_emit
from tests.unit.test_output_schemas import index_doc, race_doc

SCHEMAS = emit.SCHEMA_DIR


def validator(name):
    return Draft202012Validator(json.loads((SCHEMAS / f"{name}.schema.json").read_text(encoding="utf-8")))


# --- display headsign ---------------------------------------------------------


@pytest.mark.parametrize(
    "headsign, shown",
    [
        ("HARBOR EAST", "Harbor East"),
        ("NORTHWEST HOSPITAL", "Northwest Hospital"),
        ("STATE CENTER METRO", "State Center Metro"),
        ("BAYVIEW MEDICAL CENTER", "Bayview Medical Center"),
        ("Harbor East", "Harbor East"),  # already mixed case: unchanged
        ("MALL/METRO", "Mall/Metro"),  # each capital run is a word
        ("ROUTE 54 EXPRESS", "Route 54 Express"),  # digits are left alone
        ("A STREET", "A Street"),  # a one-letter word is left alone
        ("  HARBOR   EAST ", "Harbor East"),  # spaces are tidied
        ("UMBC", "Umbc"),  # the rule is mechanical: an abbreviation is not kept
    ],
)
def test_display_headsign_rule(headsign, shown):
    assert emit.display_headsign(headsign) == shown


@pytest.mark.parametrize("headsign", ["", "   ", None])
def test_display_headsign_rejects_an_empty_headsign(headsign):
    with pytest.raises(ValueError):
        emit.display_headsign(headsign)


def test_display_headsign_never_changes_the_letters_only_their_case():
    for text in ["HARBOR EAST", "TURNERS STATION", "MONDAWMIN METRO", "DUNDALK"]:
        assert emit.display_headsign(text).upper() == text


# --- schemas ------------------------------------------------------------------


def test_race_schema_requires_a_nonempty_headsign_display():
    v = validator("race")
    assert list(v.iter_errors(race_doc())) == []
    doc = race_doc()
    del doc["today"]["trips"][0]["headsign_display"]
    assert list(v.iter_errors(doc))
    doc = race_doc()
    doc["today"]["trips"][0]["headsign_display"] = ""
    assert list(v.iter_errors(doc))


def test_index_schema_requires_a_positive_photo_finish_band():
    v = validator("index")
    assert list(v.iter_errors(index_doc())) == []
    doc = index_doc()
    del doc["photo_finish_min"]
    assert list(v.iter_errors(doc))
    for bad in (0, -1, "1", None):
        doc = index_doc()
        doc["photo_finish_min"] = bad
        assert list(v.iter_errors(doc)), bad


# --- emitted files (made-up line, temporary folder) ------------------------


def test_emitted_index_carries_the_one_photo_finish_constant_covered_by_the_method(tmp_path):
    run_emit(tmp_path)
    index = load(tmp_path / "index.json")
    assert index["photo_finish_min"] == PHOTO_FINISH_MIN
    assert emit.INDEX_COVERAGE["photo_finish_min"] == ["method"]


def test_emitted_trips_carry_the_display_headsign_beside_the_gtfs_one(tmp_path):
    from dataclasses import replace

    trips = [replace(make_trip(600 + 30 * k), headsign=h) for k, h in enumerate(["HARBOR EAST", "MALL/METRO"])]
    run_emit(tmp_path, a_to_b_trips=trips + [make_trip(700 + 30 * k) for k in range(8)])
    by_id = {t["trip_id"]: t for t in load(tmp_path / "race" / f"{A}__{B}.json")["today"]["trips"]}
    assert (by_id["fake-600"]["headsign"], by_id["fake-600"]["headsign_display"]) == ("HARBOR EAST", "Harbor East")
    assert (by_id["fake-630"]["headsign"], by_id["fake-630"]["headsign_display"]) == ("MALL/METRO", "Mall/Metro")
