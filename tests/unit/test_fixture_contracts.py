"""Contract tests for the fake GTFS fixture (file shape only; reader behaviour is a later task)."""

import csv
from pathlib import Path

FAKE = Path(__file__).resolve().parents[1] / "fixtures" / "fake-gtfs"


def read(name):
    with open(FAKE / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_blank_time_row_exists_and_is_well_formed():
    rows = read("stop_times.txt")
    blanks = [r for r in rows if r["arrival_time"] == "" and r["departure_time"] == ""]
    assert len(blanks) == 1
    blank = blanks[0]
    trip_ids = {r["trip_id"] for r in read("trips.txt")}
    stop_ids = {r["stop_id"] for r in read("stops.txt")}
    assert blank["trip_id"] in trip_ids
    assert blank["stop_id"] in stop_ids


def test_stop_sequences_unique_per_trip():
    rows = read("stop_times.txt")
    keys = [(r["trip_id"], r["stop_sequence"]) for r in rows]
    assert len(keys) == len(set(keys))


def test_original_timed_rows_intact():
    rows = read("stop_times.txt")
    timed = [
        (r["trip_id"], r["arrival_time"], r["departure_time"], r["stop_id"], r["stop_sequence"])
        for r in rows
        if r["arrival_time"] != ""
    ]
    assert timed == [
        ("T1", "09:00:00", "09:00:00", "S_A1", "1"),
        ("T1", "09:10:00", "09:10:00", "S_B1", "2"),
        ("T2", "09:30:00", "09:30:00", "S_A1", "1"),
        ("T2", "09:45:00", "09:45:00", "S_B1", "2"),
        ("T3", "10:00:00", "10:00:00", "S_A1", "1"),
        ("T3", "10:10:00", "10:10:00", "S_B1", "2"),
        ("T4", "09:00:00", "09:00:00", "S_B1", "1"),
        ("T4", "09:10:00", "09:10:00", "S_A1", "2"),
        ("T5", "24:05:00", "24:05:00", "S_A1", "1"),
        ("T5", "24:15:00", "24:15:00", "S_B1", "2"),
    ]


def test_overnight_example_still_exists():
    rows = read("stop_times.txt")
    assert any(r["arrival_time"].startswith("24:") for r in rows)
