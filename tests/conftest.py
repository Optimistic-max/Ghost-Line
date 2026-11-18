"""
Shared pytest configuration (B20).

Tests marked ``requires_feed`` read the pinned feed zip. When
raw/mta_local_bus.zip is absent (the hosted build) they are skipped with a
visible message and one warning that says how many. When it is present (the
developer machine) they always run: nothing here skips them.

The ``requires_feed`` and ``timing`` markers are registered in pyproject.toml.
The golden modules also skip themselves at import with the same message, so a
missing feed never turns into an error.
"""

import warnings
from pathlib import Path

import pytest

FEED_PATH = Path(__file__).resolve().parents[1] / "raw" / "mta_local_bus.zip"


def pytest_collection_modifyitems(config, items):
    if FEED_PATH.is_file():
        return
    marked = [item for item in items if item.get_closest_marker("requires_feed") is not None]
    if not marked:
        return
    reason = f"{FEED_PATH} is missing: golden test SKIPPED"
    for item in marked:
        item.add_marker(pytest.mark.skip(reason=reason))
    warnings.warn(f"{len(marked)} requires_feed test(s) skipped: {reason}")
