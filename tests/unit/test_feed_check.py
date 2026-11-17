"""Unit tests for pipeline.feed_check. Uses tmp_path files, never the real feed."""

import hashlib

import pytest

from pipeline.errors import FeedError
from pipeline.feed_check import PINNED_FEED_SHA256, check_feed, compute_sha256


def test_pinned_hash_value():
    assert PINNED_FEED_SHA256 == (
        "8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694"
    )


def test_compute_sha256_matches_hashlib(tmp_path):
    data = b"fake feed bytes" * 200_000  # larger than one chunk
    f = tmp_path / "fake.zip"
    f.write_bytes(data)
    assert compute_sha256(f) == hashlib.sha256(data).hexdigest()


def test_missing_file_raises_actionable_error(tmp_path):
    with pytest.raises(FeedError) as exc:
        check_feed(tmp_path / "mta_local_bus.zip")
    msg = str(exc.value)
    assert "raw/mta_local_bus.zip not found" in msg
    assert "Place the pinned GTFS feed at this path." in msg


def test_hash_mismatch_reports_expected_and_actual(tmp_path):
    f = tmp_path / "fake.zip"
    f.write_bytes(b"not the pinned feed")
    actual = hashlib.sha256(b"not the pinned feed").hexdigest()
    with pytest.raises(FeedError) as exc:
        check_feed(f)
    msg = str(exc.value)
    assert "SHA-256 mismatch." in msg
    assert f"Expected: {PINNED_FEED_SHA256}" in msg
    assert f"Actual: {actual}" in msg


def test_valid_file_returns_hash(tmp_path):
    f = tmp_path / "fake.zip"
    f.write_bytes(b"made-up feed")
    expected = hashlib.sha256(b"made-up feed").hexdigest()
    assert check_feed(f, expected_sha256=expected) == expected
