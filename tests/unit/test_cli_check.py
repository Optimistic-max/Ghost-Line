"""Unit tests for the check command (task 22). pytest is never really started
here: the runner is replaced, so the suite does not call itself."""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from pipeline import cli

REPO = Path(__file__).resolve().parents[2]


class Runner:
    def __init__(self, code=0):
        self.code = code
        self.calls = []

    def __call__(self, cmd, cwd=None, **kw):
        self.calls.append((cmd, cwd))
        return SimpleNamespace(returncode=self.code)


@pytest.fixture
def build_ok(monkeypatch):
    order = []
    monkeypatch.setattr(cli, "run_build", lambda root, say=print: order.append("build") or {})
    return order


def test_check_builds_first_then_runs_pytest_in_the_repo_root(build_ok, tmp_path):
    runner = Runner(0)
    order = build_ok

    def ordered(cmd, cwd=None, **kw):
        order.append("pytest")
        return runner(cmd, cwd=cwd)

    assert cli.run_check(tmp_path, say=lambda s: None, runner=ordered) == 0
    assert order == ["build", "pytest"]
    (cmd, cwd), = runner.calls
    assert cmd[:3] == [sys.executable, "-m", "pytest"] and cwd == str(tmp_path)


@pytest.mark.parametrize("pytest_code", [0, 1, 2, 5])
def test_pytest_exit_code_is_the_check_exit_code(build_ok, tmp_path, pytest_code):
    assert cli.run_check(tmp_path, say=lambda s: None, runner=Runner(pytest_code)) == pytest_code


def test_a_failed_build_returns_1_and_pytest_does_not_run(tmp_path, monkeypatch):
    def failing(root, say=print):
        raise cli.BuildError("race", RuntimeError("made-up"))

    monkeypatch.setattr(cli, "run_build", failing)
    runner = Runner(0)
    lines = []
    assert cli.run_check(tmp_path, say=lines.append, runner=runner) == 1
    assert runner.calls == []
    assert any("build FAILED: step 'race' failed: made-up" in ln for ln in lines)


def test_cmd_check_exits_with_pytest_code_and_is_silent_on_success(monkeypatch):
    monkeypatch.setattr(cli, "run_check", lambda root: 0)
    cli.cmd_check(argparse.Namespace())  # returns normally: exit 0
    monkeypatch.setattr(cli, "run_check", lambda root: 3)
    with pytest.raises(SystemExit) as exc:
        cli.cmd_check(argparse.Namespace())
    assert exc.value.code == 3


def test_check_is_wired_into_the_command_line(monkeypatch):
    monkeypatch.setattr(cli, "run_check", lambda root: 4)
    with patch("sys.argv", ["pipeline", "check"]):
        with pytest.raises(SystemExit) as exc:
            cli.main()
    assert exc.value.code == 4


def test_missing_feed_makes_check_fail_before_pytest(tmp_path):
    runner = Runner(0)
    lines = []
    assert cli.run_check(tmp_path, say=lines.append, runner=runner) == 1
    assert runner.calls == [] and any("raw/mta_local_bus.zip not found" in ln for ln in lines)


# --- golden tests: always run with the feed, skip with a warning without it (22.2) ---

GOLDEN_FEED_MODULES = [
    p for p in sorted((REPO / "tests" / "golden").glob("test_*.py"))
    if "pytestmark = pytest.mark.requires_feed" in p.read_text(encoding="utf-8")
]


def _pytest(args, cwd, env_extra=None):
    env = dict(os.environ, PYTHONPATH=str(REPO), **(env_extra or {}))
    return subprocess.run(
        [sys.executable, "-m", "pytest", *args, "-p", "no:cacheprovider"],
        cwd=cwd, env=env, capture_output=True, text=True, timeout=300,
    )


def test_there_are_feed_golden_modules():
    assert len(GOLDEN_FEED_MODULES) >= 6


@pytest.mark.skipif(not (REPO / "raw" / "mta_local_bus.zip").is_file(), reason="needs the feed (developer machine)")
def test_with_the_feed_present_no_golden_module_is_skipped():
    result = _pytest(["tests/golden", "--collect-only", "-q"], REPO)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "skipped" not in result.stdout.lower()
    collected = [ln for ln in result.stdout.splitlines() if "::" in ln]
    for module in GOLDEN_FEED_MODULES:
        assert any(ln.startswith(f"tests/golden/{module.name}::") for ln in collected), module.name


def test_without_the_feed_every_feed_golden_module_skips_with_a_visible_warning(tmp_path):
    """Copy the feed golden tests into a made-up repository that has no raw/ folder."""
    golden = tmp_path / "tests" / "golden"
    golden.mkdir(parents=True)
    for module in GOLDEN_FEED_MODULES:
        shutil.copy(module, golden / module.name)
    result = _pytest(["tests/golden", "-rs", "-q", "-W", "default"], tmp_path)
    out = result.stdout + result.stderr
    assert result.returncode in (0, 5), out  # nothing failed or errored (5 = nothing ran)
    assert " failed" not in out and " error" not in out.lower().replace("errors=0", "")
    assert out.count("SKIPPED") >= len(GOLDEN_FEED_MODULES)  # one visible skip message per module
    assert "which is missing" in out
