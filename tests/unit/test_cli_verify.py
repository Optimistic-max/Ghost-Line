"""Unit tests for the verify command (task 23, B23). The build is replaced by a
stub that writes made-up files, so no feed is read."""

import argparse
from pathlib import Path
from unittest.mock import patch

import pytest

from pipeline import cli

FRESH = {"index.json": b'{"a":1}\n', "summary.json": b'{"b":2}\n', "race/x__y.json": b'{"c":3}\n'}


@pytest.fixture
def stub_build(monkeypatch):
    seen = {}

    def fake_build(root, output_dir=None, cache_dir=None, say=print):
        seen["root"], seen["output_dir"], seen["cache_dir"] = Path(root), Path(output_dir), Path(cache_dir)
        for name, data in FRESH.items():
            p = Path(output_dir) / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
        return {}

    monkeypatch.setattr(cli, "run_build", fake_build)
    return seen


def commit_files(root, files):
    for name, data in files.items():
        p = root / cli.DATA_REL / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)


def test_matching_files_verify_clean(stub_build, tmp_path):
    commit_files(tmp_path, FRESH)
    assert cli.run_verify(tmp_path, say=lambda s: None) == []


def test_a_differing_file_is_listed_by_name(stub_build, tmp_path):
    commit_files(tmp_path, {**FRESH, "summary.json": b'{"b":3}\n'})
    assert cli.run_verify(tmp_path, say=lambda s: None) == ["summary.json: differs from a fresh build"]


def test_a_one_byte_difference_such_as_a_line_ending_is_caught(stub_build, tmp_path):
    commit_files(tmp_path, {**FRESH, "index.json": b'{"a":1}\r\n'})
    assert cli.run_verify(tmp_path, say=lambda s: None) == ["index.json: differs from a fresh build"]


def test_a_missing_committed_file_is_listed(stub_build, tmp_path):
    files = dict(FRESH)
    del files["race/x__y.json"]
    commit_files(tmp_path, files)
    assert cli.run_verify(tmp_path, say=lambda s: None) == [f"race/x__y.json: missing from {cli.DATA_REL}"]


def test_an_unexpected_committed_file_is_listed(stub_build, tmp_path):
    commit_files(tmp_path, {**FRESH, "race/old__pair.json": b"{}\n"})
    problems = cli.run_verify(tmp_path, say=lambda s: None)
    assert problems == [f"race/old__pair.json: in {cli.DATA_REL} but a fresh build does not write it"]


def test_no_committed_folder_lists_every_file_as_missing(stub_build, tmp_path):
    problems = cli.run_verify(tmp_path, say=lambda s: None)
    assert len(problems) == 3 and all("missing from" in p for p in problems)


def test_every_problem_is_listed_not_just_the_first(stub_build, tmp_path):
    commit_files(tmp_path, {"index.json": b"x", "summary.json": b"y", "extra.json": b"z"})
    assert len(cli.run_verify(tmp_path, say=lambda s: None)) == 4  # 2 differ, 1 missing, 1 extra


def test_rebuild_bypasses_the_cache_and_writes_outside_the_repo(stub_build, tmp_path):
    commit_files(tmp_path, FRESH)
    cli.run_verify(tmp_path, say=lambda s: None)
    for key in ("output_dir", "cache_dir"):
        path = stub_build[key]
        assert tmp_path not in path.parents, f"{key} is inside the repository root"
    assert stub_build["cache_dir"] != tmp_path / "raw" / "cache"
    assert not (tmp_path / "raw").exists()


def test_the_committed_files_are_not_touched(stub_build, tmp_path):
    commit_files(tmp_path, {**FRESH, "summary.json": b"old"})
    cli.run_verify(tmp_path, say=lambda s: None)
    assert (tmp_path / cli.DATA_REL / "summary.json").read_bytes() == b"old"


def test_a_missing_feed_fails_with_a_clear_error_and_does_not_skip(tmp_path):
    commit_files(tmp_path, FRESH)
    with pytest.raises(cli.BuildError) as exc:
        cli.run_verify(tmp_path, say=lambda s: None)
    assert exc.value.step == "feed_check" and "raw/mta_local_bus.zip not found" in str(exc.value)


def test_cmd_verify_exits_one_with_the_message_when_the_feed_is_missing(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "ROOT", tmp_path)
    with pytest.raises(SystemExit) as exc:
        cli.cmd_verify(argparse.Namespace())
    assert exc.value.code == 1
    assert "verify: FAILED: step 'feed_check' failed: raw/mta_local_bus.zip not found" in capsys.readouterr().out


def test_cmd_verify_lists_differing_files_and_exits_one(stub_build, tmp_path, monkeypatch, capsys):
    commit_files(tmp_path, {**FRESH, "summary.json": b"changed"})
    monkeypatch.setattr(cli, "ROOT", tmp_path)
    with pytest.raises(SystemExit) as exc:
        cli.cmd_verify(argparse.Namespace())
    assert exc.value.code == 1
    out = capsys.readouterr().out
    assert "1 file(s) differ" in out and "summary.json: differs from a fresh build" in out


def test_cmd_verify_exits_zero_when_everything_matches(stub_build, tmp_path, monkeypatch, capsys):
    commit_files(tmp_path, FRESH)
    monkeypatch.setattr(cli, "ROOT", tmp_path)
    cli.cmd_verify(argparse.Namespace())
    assert "verify: OK" in capsys.readouterr().out


def test_verify_is_wired_into_the_command_line(stub_build, tmp_path, monkeypatch, capsys):
    commit_files(tmp_path, FRESH)
    monkeypatch.setattr(cli, "ROOT", tmp_path)
    with patch("sys.argv", ["pipeline", "verify"]):
        cli.main()
    assert "verify: OK" in capsys.readouterr().out
