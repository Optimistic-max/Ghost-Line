"""
Shared pytest configuration (B20).

Tests marked ``requires_feed`` read the pinned feed zip. When
raw/mta_local_bus.zip is absent (the hosted build) they are skipped with a
visible message and one warning that says how many. When it is present (the
developer machine) they always run: nothing here skips them.

Tests marked ``needs_mcp_sdk`` talk to the MCP server and need the optional
"skeptic" dependency group. They are skipped, with a visible warning, only when
the SDK is not installed (found with importlib.util.find_spec, so a broken
install is not hidden as a skip). Where the SDK is installed they must run:
any skip of such a test makes the pytest session exit with status 1.

The ``requires_feed``, ``needs_mcp_sdk`` and ``timing`` markers are registered in
pyproject.toml. The golden modules also skip themselves at import with the same
message, so a missing feed never turns into an error.
"""

import importlib.util
import warnings
from pathlib import Path

import pytest

FEED_PATH = Path(__file__).resolve().parents[1] / "raw" / "mta_local_bus.zip"

SDK_SKIP_REASON = "the MCP SDK is not installed: protocol test SKIPPED (pip install -e .[skeptic])"

# Node ids of needs_mcp_sdk tests that were skipped in this session.
_sdk_skipped: list[str] = []


def _sdk_installed() -> bool:
    return importlib.util.find_spec("mcp") is not None


def _skip_feed_tests(items) -> None:
    if FEED_PATH.is_file():
        return
    marked = [item for item in items if item.get_closest_marker("requires_feed") is not None]
    if not marked:
        return
    reason = f"{FEED_PATH} is missing: golden test SKIPPED"
    for item in marked:
        item.add_marker(pytest.mark.skip(reason=reason))
    warnings.warn(f"{len(marked)} requires_feed test(s) skipped: {reason}")


def _skip_sdk_tests(items) -> None:
    if _sdk_installed():
        return
    marked = [item for item in items if item.get_closest_marker("needs_mcp_sdk") is not None]
    if not marked:
        return
    for item in marked:
        item.add_marker(pytest.mark.skip(reason=SDK_SKIP_REASON))
    warnings.warn(f"{len(marked)} needs_mcp_sdk test(s) skipped: {SDK_SKIP_REASON}")


def pytest_collection_modifyitems(config, items):
    _skip_feed_tests(items)
    _skip_sdk_tests(items)


def pytest_runtest_logreport(report):
    if report.skipped and "needs_mcp_sdk" in report.keywords and report.nodeid not in _sdk_skipped:
        _sdk_skipped.append(report.nodeid)


def pytest_sessionfinish(session, exitstatus):
    if not _sdk_installed() or not _sdk_skipped:
        return
    reporter = session.config.pluginmanager.get_plugin("terminalreporter")
    lines = ["", "MCP SDK is installed but needs_mcp_sdk test(s) were SKIPPED (they must run):"]
    lines += [f"  {nodeid}" for nodeid in _sdk_skipped]
    for line in lines:
        if reporter is not None:
            reporter.write_line(line)
        else:
            print(line)
    session.exitstatus = 1