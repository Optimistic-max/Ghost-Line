"""
Golden test for the story-layer wait_most flag on the pinned feed (story-layer
task 1.7, Req 1.6, 1.7).

Reads the pinned feed zip, so it skips with a visible message when
raw/mta_local_bus.zip is absent. The race files come from a fresh build into a
temporary folder with a temporary cache: nothing under raw/ or web/ is written.
"""

import json
import warnings
from pathlib import Path

import pytest

from pipeline import cli
from pipeline.feed_check import PINNED_FEED_SHA256, compute_sha256

ROOT = Path(__file__).resolve().parents[2]
FEED_PATH = ROOT / "raw" / "mta_local_bus.zip"

if not FEED_PATH.is_file():
    message = f"golden story-layer tests need {FEED_PATH}, which is missing: SKIPPED"
    warnings.warn(message)
    pytest.skip(message, allow_module_level=True)

pytestmark = pytest.mark.requires_feed


@pytest.fixture(scope="module")
def race_docs(tmp_path_factory):
    assert compute_sha256(FEED_PATH) == PINNED_FEED_SHA256, "raw/mta_local_bus.zip differs from the pin"
    out = tmp_path_factory.mktemp("story-out")
    cache = tmp_path_factory.mktemp("story-cache")
    cli.run_build(ROOT, output_dir=out, cache_dir=cache, say=lambda _line: None)
    files = sorted((out / "race").glob("*.json"))
    return {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in files}


def test_twenty_race_files(race_docs):
    assert len(race_docs) == 20


def test_every_row_has_a_boolean_wait_most(race_docs):
    for name, doc in race_docs.items():
        for row in doc["races"]:
            assert isinstance(row.get("wait_most"), bool), (name, row["t"])


def test_wait_most_is_false_for_photo_finish_and_no_ride_rows(race_docs):
    seen = 0
    for name, doc in race_docs.items():
        for row in doc["races"]:
            if row["result"] in ("photo_finish", "no_one_seat_ride"):
                seen += 1
                assert row["wait_most"] is False, (name, row["t"], row["result"])
    assert seen > 0


def test_lead_pair_at_10_00_has_wait_most_true(race_docs):
    doc = race_docs["preston-caroline__aliceanna-bond"]
    row = next(r for r in doc["races"] if r["t"] == "10:00")
    assert row["wait_most"] is True
