"""Task 25.1 to 25.3: the requires_feed skip rule, which tests carry the marker, and verify."""

import ast
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from pipeline import cli

REPO = Path(__file__).resolve().parents[2]
GOLDEN = REPO / "tests" / "golden"

SAMPLE = '''
import pytest

@pytest.mark.requires_feed
def test_reads_the_feed():
    raise AssertionError("must not run without the feed")

@pytest.mark.requires_feed
def test_reads_the_feed_too():
    assert True

def test_needs_no_feed():
    assert True
'''


def _run(root):
    env = dict(os.environ, PYTHONPATH=str(REPO))
    return subprocess.run(
        [sys.executable, "-m", "pytest", "-rs", "-q", "-p", "no:cacheprovider", "-W", "default"],
        cwd=root, env=env, capture_output=True, text=True, timeout=120,
    )


@pytest.fixture
def sandbox(tmp_path):
    (tmp_path / "tests").mkdir()
    shutil.copy(REPO / "tests" / "conftest.py", tmp_path / "tests" / "conftest.py")
    (tmp_path / "tests" / "test_sample.py").write_text(SAMPLE, encoding="utf-8")
    (tmp_path / "pytest.ini").write_text("[pytest]\nmarkers =\n    requires_feed: x\n", encoding="utf-8")
    return tmp_path


def test_without_the_feed_marked_tests_skip_with_a_visible_warning(sandbox):
    result = _run(sandbox)
    out = result.stdout + result.stderr
    assert result.returncode == 0, out
    assert "2 skipped" in out and "1 passed" in out
    assert "mta_local_bus.zip is missing: golden test SKIPPED" in out
    assert "2 requires_feed test(s) skipped" in out  # the warning


def test_with_the_feed_present_marked_tests_run(sandbox):
    feed = sandbox / "raw" / "mta_local_bus.zip"
    feed.parent.mkdir()
    feed.write_bytes(b"x")
    result = _run(sandbox)
    out = result.stdout + result.stderr
    assert "skipped" not in out
    assert "1 failed, 2 passed" in out  # the sample's first test really runs (and fails on purpose)


# --- 25.2: the marker is on exactly the golden modules that read the zip ---


def _module_facts(path):
    tree = ast.parse(path.read_text(encoding="utf-8-sig"))
    names = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)} | {
        n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)
    }
    marked = any(
        isinstance(n, ast.Assign)
        and any(isinstance(t, ast.Name) and t.id == "pytestmark" for t in n.targets)
        and "requires_feed" in ast.dump(n.value)
        for n in ast.walk(tree)
    )
    reads_zip = bool(names & {"GTFSReader", "check_feed", "run_build", "run_verify"})
    return marked, reads_zip


GOLDEN_MODULES = sorted(GOLDEN.glob("test_*.py"))


@pytest.mark.parametrize("module", GOLDEN_MODULES, ids=lambda p: p.name)
def test_requires_feed_marker_matches_reading_the_zip(module):
    marked, reads_zip = _module_facts(module)
    assert marked == reads_zip, f"{module.name}: marked={marked}, reads the zip={reads_zip}"


@pytest.mark.parametrize("name", ["test_clock_golden.py", "test_route_golden.py"])
def test_clock_and_route_golden_tests_run_without_the_feed(name):
    marked, reads_zip = _module_facts(GOLDEN / name)
    assert not marked and not reads_zip


def test_no_test_outside_the_golden_folder_uses_the_marker():
    for path in (REPO / "tests").rglob("test_*.py"):
        if GOLDEN in path.parents or path.name == Path(__file__).name:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8-sig"))
        used = [n for n in ast.walk(tree) if isinstance(n, ast.Attribute) and n.attr == "requires_feed"]
        assert not used, f"{path.name} uses the requires_feed marker outside tests/golden"


# --- 25.3: verify fails, never skips, without the feed ---


def test_verify_fails_with_exit_1_and_never_skips_when_the_feed_is_absent(tmp_path, monkeypatch, capsys):
    import argparse

    monkeypatch.setattr(cli, "ROOT", tmp_path)
    with pytest.raises(SystemExit) as exc:
        cli.cmd_verify(argparse.Namespace())
    assert exc.value.code == 1
    out = capsys.readouterr().out
    assert "FAILED" in out and "raw/mta_local_bus.zip not found" in out and "skip" not in out.lower()
