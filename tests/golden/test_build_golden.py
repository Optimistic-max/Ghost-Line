"""
Golden test for the full build on the pinned feed (tasks 21 and 5.6 totals).

Reads the pinned feed zip, so it is marked requires_feed and skips with a
visible message when raw/mta_local_bus.zip is absent. The build runs with a
temporary stop_times cache and a temporary output folder: nothing under raw/
or web/ is written, and the time includes building the cache from the zip.
"""

import json
import time
import warnings
from pathlib import Path

import pytest

from pipeline import cli

ROOT = Path(__file__).resolve().parents[2]
FEED_PATH = ROOT / "raw" / "mta_local_bus.zip"

if not FEED_PATH.is_file():
    message = f"golden build tests need {FEED_PATH}, which is missing: SKIPPED"
    warnings.warn(message)
    pytest.skip(message, allow_module_level=True)

pytestmark = pytest.mark.requires_feed


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    out = tmp_path_factory.mktemp("build-out")
    cache = tmp_path_factory.mktemp("build-cache")
    lines = []
    started = time.perf_counter()
    state = cli.run_build(ROOT, output_dir=out, cache_dir=cache, say=lines.append)
    return out, state, lines, time.perf_counter() - started


@pytest.mark.timing
def test_build_finishes_in_under_60_seconds_even_without_a_cache(built):
    _, _, _, elapsed = built
    print(f"full build without cache: {elapsed:.1f} s")
    assert elapsed < 60.0


def test_nine_progress_lines(built):
    _, _, lines, _ = built
    assert [ln.split(":")[1].split("]")[1].strip() for ln in lines] == list(cli.BUILD_STEPS)


def test_twenty_three_files_are_written(built):
    out, _, _, _ = built
    files = sorted(p.relative_to(out).as_posix() for p in out.rglob("*") if p.is_file())
    assert len(files) == 23
    assert {"index.json", "summary.json", "route.geojson"} <= set(files)
    assert sum(f.startswith("race/") for f in files) == 20


def test_summary_totals_match_the_brief(built):
    out, _, _, _ = built
    s = json.loads((out / "summary.json").read_text(encoding="utf-8"))
    assert (s["races"], s["wins_1938"], s["wins_today"], s["photo_finishes"]) == (5666, 5582, 25, 59)
    assert (s["ride_same"], s["ride_faster_today"], s["ride_slower_today"]) == (17, 3, 0)


def test_lead_pair_at_10_00(built):
    out, _, _, _ = built
    doc = json.loads((out / "race" / "preston-caroline__aliceanna-bond.json").read_text(encoding="utf-8"))
    row = next(r for r in doc["races"] if r["t"] == "10:00")
    assert row["y1938"]["total"] == 15
    assert row["today"]["total"] == 45.156
    assert row["result"] == "1938"


def test_the_build_leaves_the_feed_untouched(built):
    from pipeline.feed_check import PINNED_FEED_SHA256, compute_sha256

    assert compute_sha256(FEED_PATH) == PINNED_FEED_SHA256
