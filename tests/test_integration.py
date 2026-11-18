"""
End-to-end integration test (task 26, B12, B18, B20).

Runs the full build on the pinned feed twice into temporary folders and spot
checks the outputs. Marked requires_feed: it is skipped with a visible
message when raw/mta_local_bus.zip is absent. Nothing under raw/ or web/ is
written: the stop_times cache and both outputs are temporary.
"""

import itertools
import json
import time
import warnings
from pathlib import Path

import pytest

from pipeline import cli

ROOT = Path(__file__).resolve().parents[1]
FEED_PATH = ROOT / "raw" / "mta_local_bus.zip"

if not FEED_PATH.is_file():
    message = f"integration tests need {FEED_PATH}, which is missing: SKIPPED"
    warnings.warn(message)
    pytest.skip(message, allow_module_level=True)

pytestmark = pytest.mark.requires_feed

SLUGS = ["westwood-carey", "dolphin-myrtle", "brevard-preston", "preston-caroline", "aliceanna-bond"]
PAIRS = list(itertools.permutations(SLUGS, 2))


@pytest.fixture(scope="module")
def two_builds(tmp_path_factory):
    cache = tmp_path_factory.mktemp("cache")
    out1, out2 = tmp_path_factory.mktemp("build1"), tmp_path_factory.mktemp("build2")
    started = time.perf_counter()
    cli.run_build(ROOT, output_dir=out1, cache_dir=cache, say=lambda s: None)
    first_seconds = time.perf_counter() - started
    cli.run_build(ROOT, output_dir=out2, cache_dir=cache, say=lambda s: None)
    return out1, out2, first_seconds


def files(folder):
    return {p.relative_to(folder).as_posix(): p for p in folder.rglob("*") if p.is_file()}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_all_23_output_files_are_created(two_builds):
    out, _, _ = two_builds
    expected = {"index.json", "summary.json", "route.geojson"} | {f"race/{o}__{d}.json" for o, d in PAIRS}
    assert len(expected) == 23
    assert set(files(out)) == expected


def test_lead_pair_at_10_00_reads_1938_15_vs_today_45_156(two_builds):
    out, _, _ = two_builds
    doc = load(out / "race" / "preston-caroline__aliceanna-bond.json")
    row = next(r for r in doc["races"] if r["t"] == "10:00")
    assert row["y1938"]["total"] == 15
    assert row["today"]["total"] == 45.156
    assert row["result"] == "1938"


def test_summary_totals(two_builds):
    out, _, _ = two_builds
    s = load(out / "summary.json")
    assert s["races"] == 5666
    assert s["wins_1938"] == 5582
    assert s["wins_today"] == 25
    assert s["photo_finishes"] == 59
    assert s["wins_1938"] + s["wins_today"] + s["photo_finishes"] == s["races"]


def test_every_race_file_has_293_rows_from_09_00_to_13_52(two_builds):
    out, _, _ = two_builds
    for o, d in PAIRS:
        rows = load(out / "race" / f"{o}__{d}.json")["races"]
        assert len(rows) == 293 and rows[0]["t"] == "09:00" and rows[-1]["t"] == "13:52", (o, d)


def test_inferred_is_true_exactly_for_the_eight_pairs_with_brevard(two_builds):
    out, _, _ = two_builds
    inferred = {
        (o, d) for o, d in PAIRS if load(out / "race" / f"{o}__{d}.json")["inferred"] is True
    }
    assert inferred == {(o, d) for o, d in PAIRS if "brevard-preston" in (o, d)}
    assert len(inferred) == 8
    assert ("preston-caroline", "aliceanna-bond") not in inferred


def test_index_marks_only_brevard_as_inferred(two_builds):
    out, _, _ = two_builds
    idx = load(out / "index.json")
    assert [c["slug"] for c in idx["corners"] if c["inferred"]] == ["brevard-preston"]


def test_two_builds_are_byte_identical(two_builds):
    out1, out2, _ = two_builds
    a, b = files(out1), files(out2)
    assert set(a) == set(b)
    differing = [name for name in a if a[name].read_bytes() != b[name].read_bytes()]
    assert differing == []


@pytest.mark.timing
def test_build_completes_in_under_60_seconds(two_builds):
    _, _, seconds = two_builds
    print(f"first build, no cache: {seconds:.1f} s")
    assert seconds < 60.0
