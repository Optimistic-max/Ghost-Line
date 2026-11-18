"""Unit tests for the validate command (task 20, B21)."""

import argparse
import shutil
import socket
import time
from pathlib import Path

import pytest

from pipeline import cli
from pipeline.clock import build_clock
from pipeline.facts import load_facts
from tests.unit.test_emit import run_emit

REPO = Path(__file__).resolve().parents[2]
FIXTURE = REPO / "tests" / "fixtures" / "fake-line.yaml"


@pytest.fixture
def root(tmp_path):
    """A made-up repository root: the fake facts file under the real facts file name."""
    target = tmp_path / cli.FACTS_REL
    target.parent.mkdir(parents=True)
    shutil.copy(FIXTURE, target)
    return tmp_path


def test_clean_repo_has_no_problems(root):
    assert cli.run_validate(root) == []


def test_missing_facts_file_is_reported_with_its_path(root):
    (root / cli.FACTS_REL).unlink()
    problems = cli.run_validate(root)
    assert len(problems) == 1 and problems[0].startswith("facts: ") and "no21-1938.yaml" in problems[0]


def test_facts_file_missing_a_field_names_the_field(root):
    p = root / cli.FACTS_REL
    p.write_text(p.read_text(encoding="utf-8").replace("mode: trackless_trolley\n", ""), encoding="utf-8")
    problems = cli.run_validate(root)
    assert any("mode" in x and x.startswith("facts: ") for x in problems)


# --- clock verification ------------------------------------------------------


def fake():
    facts = load_facts(FIXTURE)
    return facts, build_clock(facts)


def test_verify_clock_accepts_a_built_clock():
    assert cli.verify_clock(*fake()) == []


def test_verify_clock_rejects_wrong_offset():
    facts, clocks = fake()
    clocks["eastbound"]["fake-corner-b"].offset_min = 99
    assert any("offset 99" in p for p in cli.verify_clock(facts, clocks))


def test_verify_clock_rejects_passes_that_do_not_increase():
    facts, clocks = fake()
    c = clocks["westbound"]["fake-corner-b"]
    c.passes[1], c.passes[2] = c.passes[2], c.passes[1]
    assert any("strictly increase" in p for p in cli.verify_clock(facts, clocks))


def test_verify_clock_rejects_a_shifted_first_pass():
    facts, clocks = fake()
    c = clocks["eastbound"]["fake-corner-a"]
    c.passes = [p + 1 for p in c.passes]
    problems = cli.verify_clock(facts, clocks)
    assert any("first pass" in p for p in problems) and any("last pass" in p for p in problems)


def test_verify_clock_rejects_a_missing_corner_and_uneven_counts():
    facts, clocks = fake()
    del clocks["eastbound"]["fake-corner-b"]
    clocks["westbound"]["fake-corner-a"].passes.pop()
    problems = cli.verify_clock(facts, clocks)
    assert any("no eastbound clock for fake-corner-b" in p for p in problems)
    assert any("different numbers of passes" in p for p in problems)


# --- generated files ---------------------------------------------------------


def copy_generated(root, tmp_path_factory_dir):
    run_emit(tmp_path_factory_dir)
    dest = root / cli.DATA_REL
    shutil.copytree(tmp_path_factory_dir, dest)
    return dest


def test_valid_generated_files_pass(root, tmp_path_factory):
    copy_generated(root, tmp_path_factory.mktemp("gen") / "out")
    assert cli.run_validate(root) == []


def test_an_invalid_generated_file_is_reported_by_name(root, tmp_path_factory):
    dest = copy_generated(root, tmp_path_factory.mktemp("gen") / "out")
    summary = dest / "summary.json"
    summary.write_text(summary.read_text(encoding="utf-8").replace('"races":', '"racez":', 1), encoding="utf-8")
    problems = cli.run_validate(root)
    assert any(p.startswith("schema: summary.json") for p in problems)


def test_a_race_file_that_is_not_json_is_reported(root, tmp_path_factory):
    dest = copy_generated(root, tmp_path_factory.mktemp("gen") / "out")
    bad = next((dest / "race").glob("*.json"))
    bad.write_text("{oops", encoding="utf-8")
    assert any(bad.name in p and "not valid JSON" in p for p in cli.run_validate(root))


def test_missing_generated_files_are_not_an_error(root):
    assert not (root / cli.DATA_REL).exists()
    assert cli.run_validate(root) == []


# --- prose -------------------------------------------------------------------


def test_banned_word_in_prose_is_reported_with_file_and_line(root):
    doc = root / "docs" / "devpost.md"
    doc.parent.mkdir()
    doc.write_text("fine\nThe trolley is arriving now.\n", encoding="utf-8")
    assert cli.run_validate(root) == ["prose: docs/devpost.md:2: banned term 'arriving now'"]


def test_planning_docs_are_not_scanned(root):
    doc = root / "docs" / "planning" / "brief.md"
    doc.parent.mkdir(parents=True)
    doc.write_text("live\n", encoding="utf-8")
    assert cli.run_validate(root) == []


# --- command -----------------------------------------------------------------


def test_cmd_validate_exits_zero_and_says_ok_when_clean(root, monkeypatch, capsys):
    monkeypatch.setattr(cli, "ROOT", root)
    cli.cmd_validate(argparse.Namespace())  # returns normally
    assert "validate: OK" in capsys.readouterr().out


def test_cmd_validate_exits_one_and_lists_every_problem(root, monkeypatch, capsys):
    (root / "README.md").write_text("live\nright now\n", encoding="utf-8")
    monkeypatch.setattr(cli, "ROOT", root)
    with pytest.raises(SystemExit) as exc:
        cli.cmd_validate(argparse.Namespace())
    assert exc.value.code == 1
    out = capsys.readouterr().out
    assert "FAILED with 2 problem(s)" in out
    assert "README.md:1" in out and "README.md:2" in out


def test_validate_is_wired_into_the_command_line(root, monkeypatch, capsys):
    from unittest.mock import patch

    monkeypatch.setattr(cli, "ROOT", root)
    with patch("sys.argv", ["pipeline", "validate"]):
        cli.main()
    assert "validate: OK" in capsys.readouterr().out


# --- no feed, no network, under 10 seconds (20.2, 20.3) ----------------------


def test_validate_on_this_repository_reads_no_feed_uses_no_network_and_is_fast(monkeypatch):
    def no_network(*a, **k):
        raise AssertionError("validate must not touch the network")

    def no_feed(*a, **k):
        raise AssertionError("validate must not read the feed")

    monkeypatch.setattr(socket, "socket", no_network)
    monkeypatch.setattr(socket, "create_connection", no_network)
    import pipeline.feed_check as feed_check
    import pipeline.gtfs_reader as gtfs_reader

    monkeypatch.setattr(gtfs_reader.GTFSReader, "__init__", no_feed)
    monkeypatch.setattr(feed_check, "check_feed", no_feed)
    started = time.perf_counter()
    problems = cli.run_validate(REPO)
    elapsed = time.perf_counter() - started
    assert problems == []
    assert elapsed < 10.0, f"validate took {elapsed:.1f} s"
