"""Unit tests for the check_sources command (task 24, B5). Made-up repository roots only."""

import argparse
import json
import shutil
from unittest.mock import patch

import pytest

from pipeline import cli
from tests.unit.test_emit import run_emit


@pytest.fixture
def root(tmp_path):
    return tmp_path


def write(root, rel, text):
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return p


def install_generated(root, tmp_path_factory):
    out = tmp_path_factory.mktemp("gen") / "out"
    run_emit(out)
    shutil.copytree(out, root / cli.DATA_REL)
    return root / cli.DATA_REL


def test_clean_repository_has_no_violations(root):
    write(root, "README.md", "Scheduled, not live. Weekday schedule.\n")
    write(root, "docs/devpost.md", "A trolley once ran here.\n")
    write(root, "web/index.html", '<div aria-live="polite"></div>\n')
    write(root, "web/src/main.ts", "export const x = 1;\n")
    assert cli.run_check_sources(root) == []


def test_prose_violations_carry_file_and_line(root):
    write(root, "README.md", "ok\nright now\n")
    write(root, "docs/devpost.md", "live\n")
    write(root, "web/index.html", "<p>\nreal-time\n</p>\n")
    write(root, "web/src/app/view.ts", "const s = 'arriving now';\n")
    expected = [
        "prose: README.md:2: banned term 'right now'",
        "prose: docs/devpost.md:1: banned term 'live'",
        "prose: web/index.html:2: banned term 'real-time'",
        "prose: web/src/app/view.ts:1: banned term 'arriving now'",
    ]
    assert sorted(cli.run_check_sources(root)) == sorted(expected)


def test_excluded_folders_are_not_scanned(root):
    write(root, "docs/planning/brief.md", "live\n")
    write(root, "web/node_modules/p/readme.md", "live\n")
    write(root, "web/dist/index.html", "live\n")
    write(root, "web/public/data/notes.txt", "live\n")
    assert cli.run_check_sources(root) == []


def test_generated_json_without_problems_is_clean(root, tmp_path_factory):
    install_generated(root, tmp_path_factory)
    assert cli.run_check_sources(root) == []


def test_json_violations_are_reported_separately_from_prose(root, tmp_path_factory):
    data = install_generated(root, tmp_path_factory)
    summary = data / "summary.json"
    doc = json.loads(summary.read_text(encoding="utf-8"))
    doc["sources"]["races"] = ["mta_gtfs", "made_up_id"]
    summary.write_text(json.dumps(doc), encoding="utf-8")
    write(root, "README.md", "live\n")
    problems = cli.run_check_sources(root)
    assert problems[0] == "prose: README.md:1: banned term 'live'"
    assert any(p.startswith("json: ") and "made_up_id" in p for p in problems[1:])


def test_json_files_are_not_scanned_as_prose(root, tmp_path_factory):
    data = install_generated(root, tmp_path_factory)
    index = data / "index.json"
    doc = json.loads(index.read_text(encoding="utf-8"))
    doc["line"] = "live right now"
    index.write_text(json.dumps(doc), encoding="utf-8")
    assert cli.run_check_sources(root) == []


def test_no_generated_files_is_not_an_error(root):
    assert cli.run_check_sources(root) == []


def test_cmd_exits_zero_and_says_ok_when_clean(root, monkeypatch, capsys):
    monkeypatch.setattr(cli, "ROOT", root)
    cli.cmd_check_sources(argparse.Namespace())  # returns normally
    assert "check_sources: OK" in capsys.readouterr().out


def test_cmd_exits_one_and_lists_each_violation_with_path_and_line(root, monkeypatch, capsys):
    write(root, "docs/devpost.md", "fine\nBus arriving now.\nlive and real-time\n")
    monkeypatch.setattr(cli, "ROOT", root)
    with pytest.raises(SystemExit) as exc:
        cli.cmd_check_sources(argparse.Namespace())
    assert exc.value.code == 1
    out = capsys.readouterr().out
    assert "FAILED with 3 violation(s)" in out
    assert "docs/devpost.md:2: banned term 'arriving now'" in out
    assert "docs/devpost.md:3: banned term 'live'" in out
    assert "docs/devpost.md:3: banned term 'real-time'" in out


def test_check_sources_is_wired_into_the_command_line(root, monkeypatch, capsys):
    monkeypatch.setattr(cli, "ROOT", root)
    with patch("sys.argv", ["pipeline", "check_sources"]):
        cli.main()
    assert "check_sources: OK" in capsys.readouterr().out
    write(root, "README.md", "live\n")
    with patch("sys.argv", ["pipeline", "check_sources"]):
        with pytest.raises(SystemExit) as exc:
            cli.main()
    assert exc.value.code == 1
