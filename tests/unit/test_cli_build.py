"""Unit tests for the build command's orchestration (task 21). No feed is read here:
every step's work is replaced by a recording stub, so these tests check order,
data flow, progress output and fail-fast behaviour only."""

import argparse
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

import pipeline.clock as clock_mod
import pipeline.eligible as eligible_mod
import pipeline.emit as emit_mod
import pipeline.facts as facts_mod
import pipeline.feed_check as feed_mod
import pipeline.gtfs_reader as reader_mod
import pipeline.race as race_mod
import pipeline.route as route_mod
import pipeline.stops as stops_mod
import pipeline.summary as summary_mod
from pipeline import cli

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "fake-line.yaml"


@pytest.fixture
def calls(monkeypatch):
    """Replace every step's work with a stub that records its name and inputs."""
    log = []
    facts = facts_mod.load_facts(FIXTURE)
    gtfs = object()
    stops = {p.slug: [f"stop-{p.slug}"] for p in facts.timing_points}

    def rec(name, result):
        def fn(*a, **k):
            log.append((name, a, k))
            return result

        return fn

    monkeypatch.setattr(feed_mod, "check_feed", rec("check_feed", "sha-from-feed-check"))
    monkeypatch.setattr(reader_mod, "GTFSReader", rec("GTFSReader", gtfs))
    monkeypatch.setattr(facts_mod, "load_facts", rec("load_facts", facts))
    monkeypatch.setattr(cli, "verify_clock", lambda f, c: [])
    monkeypatch.setattr(stops_mod, "find_stops_near_corners", rec("find_stops", stops))
    monkeypatch.setattr(eligible_mod, "active_services", rec("active_services", {"svc"}))
    monkeypatch.setattr(eligible_mod, "find_eligible_trips", rec("find_eligible_trips", []))
    monkeypatch.setattr(race_mod, "run_all_races", rec("run_all_races", {("a", "b"): [1, 2]}))
    monkeypatch.setattr(summary_mod, "compute_summary", rec("compute_summary", SimpleNamespace(races=2)))
    monkeypatch.setattr(route_mod, "load_ways", rec("load_ways", {}))
    monkeypatch.setattr(route_mod, "build_route", rec("build_route", {"westbound": [1], "eastbound": [2]}))
    monkeypatch.setattr(emit_mod, "emit_all", rec("emit_all", [{"path": "x"}]))
    return SimpleNamespace(log=log, facts=facts, gtfs=gtfs, names=lambda: [c[0] for c in log])


def test_steps_run_in_the_specified_order(calls, tmp_path):
    lines = []
    cli.run_build(tmp_path, say=lines.append)
    order = [n for n in calls.names() if n not in ("GTFSReader",)]
    # one call per step, in pipeline order (stops, eligible: first call of each)
    firsts = [n for i, n in enumerate(order) if n not in order[:i]]
    assert firsts == [
        "check_feed", "load_facts", "find_stops", "active_services", "find_eligible_trips",
        "run_all_races", "compute_summary", "load_ways", "build_route", "emit_all",
    ]
    assert cli.BUILD_STEPS == ("feed_check", "facts", "clock", "stops", "eligible", "race", "summary", "route", "emit")


def test_progress_line_for_each_completed_step(calls, tmp_path):
    lines = []
    cli.run_build(tmp_path, say=lines.append)
    assert len(lines) == 9
    for i, (line, name) in enumerate(zip(lines, cli.BUILD_STEPS), start=1):
        assert line.startswith(f"build: [{i}/9] {name}: ")


def test_each_step_feeds_the_next(calls, tmp_path):
    cli.run_build(tmp_path, say=lambda s: None)
    by_name = {}
    for name, a, k in calls.log:
        by_name.setdefault(name, (a, k))
    assert by_name["find_stops"][0][0] is calls.gtfs and by_name["find_stops"][0][1] == calls.facts.timing_points
    races_args = by_name["run_all_races"][0]
    assert races_args[3] is calls.facts and len(races_args[0]) == 2  # the fake file has 2 corners: 2 directed pairs
    emit_args = by_name["emit_all"][0]
    assert emit_args[0] is calls.facts and emit_args[6] == "sha-from-feed-check"
    assert emit_args[7:10] == (cli.FEED_VERSION, cli.SERVICE_DATE, tmp_path / cli.DATA_REL)


def test_the_feed_and_cache_paths_come_from_the_root(calls, tmp_path):
    cli.run_build(tmp_path, say=lambda s: None)
    reader_call = next(c for c in calls.log if c[0] == "GTFSReader")
    assert reader_call[1][0] == tmp_path / "raw" / "mta_local_bus.zip"
    assert reader_call[2]["cache_dir"] == tmp_path / "raw" / "cache"


def test_an_explicit_cache_dir_and_output_dir_are_used(calls, tmp_path):
    cli.run_build(tmp_path, output_dir=tmp_path / "out", cache_dir=tmp_path / "c", say=lambda s: None)
    reader_call = next(c for c in calls.log if c[0] == "GTFSReader")
    assert reader_call[2]["cache_dir"] == tmp_path / "c"
    assert next(c for c in calls.log if c[0] == "emit_all")[1][9] == tmp_path / "out"


FAIL_POINTS = [
    ("feed_check", feed_mod, "check_feed", "emit_all"),
    ("facts", facts_mod, "load_facts", "find_stops"),
    ("stops", stops_mod, "find_stops_near_corners", "find_eligible_trips"),
    ("eligible", eligible_mod, "find_eligible_trips", "run_all_races"),
    ("race", race_mod, "run_all_races", "compute_summary"),
    ("summary", summary_mod, "compute_summary", "build_route"),
    ("route", route_mod, "build_route", "emit_all"),
    ("emit", emit_mod, "emit_all", None),
]


@pytest.mark.parametrize("step,module,attr,must_not_run", FAIL_POINTS, ids=[f[0] for f in FAIL_POINTS])
def test_build_stops_at_the_first_failing_step_and_names_it(calls, tmp_path, monkeypatch, step, module, attr, must_not_run):
    def boom(*a, **k):
        raise RuntimeError("made-up failure")

    monkeypatch.setattr(module, attr, boom)
    lines = []
    with pytest.raises(cli.BuildError) as exc:
        cli.run_build(tmp_path, say=lines.append)
    assert exc.value.step == step
    assert f"step '{step}' failed: made-up failure" in str(exc.value)
    index = cli.BUILD_STEPS.index(step)
    assert len(lines) == index  # progress was printed only for the steps before it
    if must_not_run:
        assert must_not_run not in calls.names()


def test_clock_verification_failure_stops_the_build_at_the_clock_step(calls, tmp_path, monkeypatch):
    monkeypatch.setattr(cli, "verify_clock", lambda f, c: ["clock: made-up problem"])
    with pytest.raises(cli.BuildError) as exc:
        cli.run_build(tmp_path, say=lambda s: None)
    assert exc.value.step == "clock" and "made-up problem" in str(exc.value)
    assert "find_stops" not in calls.names()


def test_missing_feed_fails_at_feed_check_with_the_path_and_never_downloads(tmp_path):
    with pytest.raises(cli.BuildError) as exc:
        cli.run_build(tmp_path, say=lambda s: None)
    assert exc.value.step == "feed_check"
    assert "raw/mta_local_bus.zip not found" in str(exc.value)


def test_wrong_feed_hash_fails_at_feed_check(tmp_path):
    feed = tmp_path / "raw" / "mta_local_bus.zip"
    feed.parent.mkdir()
    feed.write_bytes(b"not the pinned feed")
    with pytest.raises(cli.BuildError) as exc:
        cli.run_build(tmp_path, say=lambda s: None)
    assert exc.value.step == "feed_check" and "SHA-256 mismatch" in str(exc.value)


def test_cmd_build_exits_one_and_names_the_step_on_failure(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "ROOT", tmp_path)
    with pytest.raises(SystemExit) as exc:
        cli.cmd_build(argparse.Namespace())
    assert exc.value.code == 1
    assert "build: FAILED: step 'feed_check' failed" in capsys.readouterr().out


def test_cmd_build_reports_ok(calls, tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "ROOT", tmp_path)
    cli.cmd_build(argparse.Namespace())
    assert capsys.readouterr().out.rstrip().endswith("build: OK")


def test_build_is_wired_into_the_command_line(calls, tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(cli, "ROOT", tmp_path)
    with patch("sys.argv", ["pipeline", "build"]):
        cli.main()
    assert "build: OK" in capsys.readouterr().out
