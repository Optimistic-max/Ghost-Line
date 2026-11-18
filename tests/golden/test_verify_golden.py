"""
Golden test for verify on the real repository (task 23, and 28.5).

Reads the pinned feed zip, so it is marked requires_feed and skips with a
visible message when raw/mta_local_bus.zip is absent. (The verify command
itself never skips: with no feed it fails.) The rebuild uses a temporary
cache and output folder, so nothing under raw/ or web/ is written.
"""

import warnings
from pathlib import Path

import pytest

from pipeline import cli

ROOT = Path(__file__).resolve().parents[2]
FEED_PATH = ROOT / "raw" / "mta_local_bus.zip"

if not FEED_PATH.is_file():
    message = f"golden verify test needs {FEED_PATH}, which is missing: SKIPPED"
    warnings.warn(message)
    pytest.skip(message, allow_module_level=True)

pytestmark = pytest.mark.requires_feed


def test_committed_data_matches_a_fresh_build_without_the_cache():
    assert cli.run_verify(ROOT, say=lambda s: None) == []
