"""Tests for the MCP SDK line in the check commands, and for the conftest guard
that makes a skipped needs_mcp_sdk test fail where the SDK is installed (R9.6).

pytest is never really started by the check tests: the runner is replaced. The
guard tests start a small separate pytest in a temporary folder, with a copy of
tests/conftest.py whose SDK test is overridden, so they do not depend on whether
the SDK is installed on the machine running them.
"""

import importlib.util
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from pipeline import cli

REPO = Path(__file__).resolve().parents[2]
CONFTEST = REPO / "tests" / "conftest.py"

INSTALLED_LINE = "check: MCP SDK installed: the protocol test will run"
ABSENT_LINE = (
    "check: WARNING: MCP SDK not installed: the protocol test will be SKIPPED "
    "(pip install -e .[skeptic])"
)


class Runner:
    def __init__(self, code=0):
        self.code = code
        self.calls = []

    def __call__(self, cmd, cwd=None, **kw):
        self.calls.append((cmd, cwd))
        return SimpleNamespace(returncode=self.code)


def patch_find_spec(monkeypatch, present: bool):
    real = importlib.util.find_spec

    def fake(name, *args, **kwargs):
        if name == "mcp":
            return object() if present else None
        return real(name, *args, **kwargs)

    monkeypatch.setattr(cli.importlib.util, "find_spec", fake)


@pytest.fixture
def validate_clean(monkeypatch):
    monkeypatch.setattr(cli, "run_validate", lambda root: [])


@pytest.fixture
def build_ok(monkeypatch):
    monkeypatch.setattr(cli, "run_build", lambda root, say=print: {})


def test_line_when_the_sdk_is_installed(monkeypatch):
    patch_find_spec(monkeypatch, True)
    assert cli.mcp_sdk_line() == INSTALLED_LINE


def test_line_when_the_sdk_is_absent(monkeypatch):
    patch_find_spec(monkeypatch, False)
    assert cli.mcp_sdk_line() == ABSENT_LINE


@pytest.mark.parametrize("present, line", [(True, INSTALLED_LINE), (False, ABSENT_LINE)])
def test_full_check_says_the_line_before_and_after_pytest(monkeypatch, build_ok, tmp_path, present, line):
    patch_find_spec(monkeypatch, present)
    lines = []
    assert cli.run_check(tmp_path, say=lines.append, runner=Runner(0)) == 0
    start = lines.index("check: build OK, running pytest")
    end = lines.index("check: pytest exited with 0")
    assert lines[start + 1] == line
    assert lines[end + 1] == line
    assert lines.count(line) == 2


@pytest.mark.parametrize("present, line", [(True, INSTALLED_LINE), (False, ABSENT_LINE)])
def test_quick_check_says_the_line_before_and_after_pytest(monkeypatch, validate_clean, tmp_path, present, line):
    patch_find_spec(monkeypatch, present)
    lines = []
    assert cli.run_check_quick(tmp_path, say=lines.append, runner=Runner(0)) == 0
    assert lines.count(line) == 2
    assert lines[-1] == line
    assert lines[-2] == "check --quick: pytest exited with 0"


@pytest.mark.parametrize("code", [0, 1, 5])
def test_exit_code_does_not_depend_on_the_sdk(monkeypatch, build_ok, validate_clean, tmp_path, code):
    patch_find_spec(monkeypatch, False)
    assert cli.run_check(tmp_path, say=lambda s: None, runner=Runner(code)) == code
    assert cli.run_check_quick(tmp_path, say=lambda s: None, runner=Runner(code)) == code


def test_timing_check_prints_no_sdk_line(monkeypatch, tmp_path):
    patch_find_spec(monkeypatch, False)
    lines = []
    cli.run_check_timing(tmp_path, say=lines.append, runner=Runner(0))
    assert not any("MCP SDK" in ln for ln in lines)


def test_pytest_arguments_are_unchanged(monkeypatch, build_ok, validate_clean, tmp_path):
    patch_find_spec(monkeypatch, True)
    full, quick = Runner(0), Runner(0)
    cli.run_check(tmp_path, say=lambda s: None, runner=full)
    cli.run_check_quick(tmp_path, say=lambda s: None, runner=quick)
    assert full.calls[0][0] == [sys.executable, "-m", "pytest", "-q"]
    assert quick.calls[0][0] == [sys.executable, "-m", "pytest", "-q", "-m", "not requires_feed and not timing"]


# The guard, run in a separate pytest over a temporary folder.

INI = """[pytest]
markers =
    needs_mcp_sdk: test of the MCP server
    requires_feed: reads the pinned feed
"""

SKIPPING_TEST = """import pytest

@pytest.mark.needs_mcp_sdk
def test_protocol_like():
    pytest.skip("made-up skip inside the test")
"""

PASSING_TEST = """import pytest

@pytest.mark.needs_mcp_sdk
def test_protocol_like():
    assert True
"""


def run_guard(tmp_path, test_source, sdk_installed: bool):
    (tmp_path / "pytest.ini").write_text(INI, encoding="utf-8")
    override = f"\n_sdk_installed = lambda: {sdk_installed}\n"
    (tmp_path / "conftest.py").write_text(CONFTEST.read_text(encoding="utf-8") + override, encoding="utf-8")
    (tmp_path / "test_protocol_like.py").write_text(test_source, encoding="utf-8")
    return subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "-rs", "-p", "no:cacheprovider", "-c", "pytest.ini"],
        cwd=str(tmp_path),
        capture_output=True,
        text=True,
        timeout=120,
    )


def test_a_skipped_sdk_test_fails_the_session_where_the_sdk_is_installed(tmp_path):
    result = run_guard(tmp_path, SKIPPING_TEST, sdk_installed=True)
    out = result.stdout + result.stderr
    assert result.returncode == 1, out
    assert "must run" in out
    assert "test_protocol_like" in out


def test_a_passing_sdk_test_passes_where_the_sdk_is_installed(tmp_path):
    result = run_guard(tmp_path, PASSING_TEST, sdk_installed=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_the_sdk_test_is_skipped_with_a_warning_when_the_sdk_is_absent(tmp_path):
    result = run_guard(tmp_path, PASSING_TEST, sdk_installed=False)
    out = result.stdout + result.stderr
    assert result.returncode == 0, out
    assert "the MCP SDK is not installed: protocol test SKIPPED" in out
    assert "needs_mcp_sdk test(s) skipped" in out