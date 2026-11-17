"""Tests for pipeline.gtfs_reader using the fake-gtfs fixture."""

import logging
import zipfile
from pathlib import Path

import pytest
from hypothesis import given, strategies as st

from pipeline.errors import FeedError
from pipeline.gtfs_reader import GTFSReader, parse_gtfs_time

FIXTURE_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "fake-gtfs"


@pytest.fixture
def fake_zip(tmp_path):
    path = tmp_path / "fake_gtfs.zip"
    with zipfile.ZipFile(path, "w") as zf:
        for f in FIXTURE_DIR.glob("*.txt"):
            zf.write(f, f.name)
    return path


@pytest.fixture
def reader(fake_zip, tmp_path):
    return GTFSReader(fake_zip, cache_dir=tmp_path / "cache")


def test_read_table_returns_strings(reader):
    stops = reader.read_table("stops.txt")
    assert "stop_id" in stops.columns
    assert len(stops) > 0


def test_missing_file_raises_feed_error(reader):
    with pytest.raises(FeedError, match="shapes.txt"):
        reader.read_table("shapes.txt")


def test_missing_zip_raises_feed_error(tmp_path):
    with pytest.raises(FeedError, match="not found"):
        GTFSReader(tmp_path / "nope.zip")


def test_bad_zip_raises_feed_error(tmp_path):
    bad = tmp_path / "bad.zip"
    bad.write_bytes(b"not a zip")
    with pytest.raises(FeedError, match="not a valid zip"):
        GTFSReader(bad)


def test_parse_gtfs_time_examples():
    assert parse_gtfs_time("25:10:00") == 1510.0
    assert parse_gtfs_time("09:30:30") == 570.5
    assert parse_gtfs_time("00:00:00") == 0.0


def test_parse_gtfs_time_invalid():
    with pytest.raises(ValueError):
        parse_gtfs_time("9:61:00")
    with pytest.raises(ValueError):
        parse_gtfs_time("")


@given(st.integers(0, 47), st.integers(0, 59), st.integers(0, 59))
def test_parse_gtfs_time_property(h, m, s):
    assert parse_gtfs_time(f"{h:02d}:{m:02d}:{s:02d}") == pytest.approx(h * 60 + m + s / 60)


def test_blank_time_row_skipped_and_logged(reader, caplog):
    raw = reader.read_table("stop_times.txt")
    with caplog.at_level(logging.WARNING, logger="pipeline.gtfs_reader"):
        df = reader.read_stop_times()
    assert len(raw) - len(df) == 1
    assert not ((df["trip_id"] == "T1") & (df["stop_sequence"] == "3")).any()
    assert sum("Skipping stop_times row" in r.message for r in caplog.records) == 1
    # timed rows intact, same order, times stay HH:MM:SS strings
    timed = raw[~((raw["trip_id"] == "T1") & (raw["stop_sequence"] == "3"))]
    assert df.reset_index(drop=True).equals(timed.reset_index(drop=True))
    assert "24:05:00" in set(df["departure_time"])


def test_service_date_cache_written_and_reused(reader, tmp_path):
    ids = ["T1", "T2"]
    df1 = reader.read_stop_times("2026-11-04", trip_ids=ids)
    path = tmp_path / "cache" / f"{reader.sha256[:12]}_2026-11-04.csv"
    assert path.is_file()
    assert set(df1["trip_id"]) == set(ids)
    # cache hit needs no trip_ids
    df2 = reader.read_stop_times("2026-11-04")
    assert df2.equals(df1)


def test_cache_miss_without_trip_ids_raises(reader):
    with pytest.raises(FeedError, match="trip_ids"):
        reader.read_stop_times("2026-11-04")


def test_use_cache_false_bypasses_cache(reader, tmp_path):
    reader.read_stop_times("2026-11-04", trip_ids=["T1"])
    df = reader.read_stop_times("2026-11-04", trip_ids=["T2"], use_cache=False)
    assert set(df["trip_id"]) == {"T2"}
