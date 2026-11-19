"""Command dispatcher for the pipeline package.

validate is implemented. The other commands are still stubs that exit non-zero
until their tasks are done.
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FACTS_REL = "data/lines/no21-1938.yaml"
DATA_REL = "web/public/data"


def verify_clock(facts, clocks) -> list[str]:
    """Check a built 1938 clock against the facts file. Returns problems, empty if fine.

    For each direction and corner: the offset is the minutes from that
    direction's terminal, the passes strictly increase, the first pass is the
    terminal's first car plus the offset, and the last pass is the terminal's
    last car plus the offset. All corners of a direction have the same number
    of passes.
    """
    from pipeline.clock import compute_offset

    problems: list[str] = []
    minutes = [p.minutes_from_prev for p in facts.timing_points[1:]]
    slugs = [p.slug for p in facts.timing_points]
    for direction in ("eastbound", "westbound"):
        pattern = facts.midday_departures[direction]
        by_corner = clocks.get(direction, {})
        counts = set()
        for i, slug in enumerate(slugs):
            clock = by_corner.get(slug)
            if clock is None:
                problems.append(f"clock: no {direction} clock for {slug}")
                continue
            offset = compute_offset(direction, i, minutes)
            counts.add(len(clock.passes))
            if clock.offset_min != offset:
                problems.append(f"clock: {direction} {slug} offset {clock.offset_min}, expected {offset}")
            if not clock.passes:
                problems.append(f"clock: {direction} {slug} has no passes")
                continue
            if any(b <= a for a, b in zip(clock.passes, clock.passes[1:])):
                problems.append(f"clock: {direction} {slug} passes do not strictly increase")
            if clock.passes[0] != pattern.first_min + offset or clock.covered_from != clock.passes[0]:
                problems.append(f"clock: {direction} {slug} first pass is not first car + {offset} min")
            if clock.passes[-1] != pattern.last_min + offset:
                problems.append(f"clock: {direction} {slug} last pass is not last car + {offset} min")
        if len(counts) > 1:
            problems.append(f"clock: {direction} corners have different numbers of passes: {sorted(counts)}")
    return problems


def validate_generated(data_dir: Path) -> list[str]:
    """Validate every generated JSON/GeoJSON file that exists in data_dir against its schema.

    Does not read the feed. Missing files are not an error here (a build may
    not have run yet).
    """
    from pipeline.emit import SCHEMA_DIR, validate_against_schema
    from pipeline.errors import ValidationError

    data_dir = Path(data_dir)
    targets = [(data_dir / "index.json", "index"), (data_dir / "summary.json", "summary"),
               (data_dir / "route.geojson", "route")]
    race_dir = data_dir / "race"
    if race_dir.is_dir():
        targets += [(p, "race") for p in sorted(race_dir.glob("*.json"))]
    problems: list[str] = []
    for path, schema in targets:
        if not path.is_file():
            continue
        try:
            validate_against_schema(path, SCHEMA_DIR / f"{schema}.schema.json")
        except ValidationError as exc:
            problems.append(f"schema: {exc}")
        except ValueError as exc:  # json.JSONDecodeError
            problems.append(f"schema: {path.name} is not valid JSON: {exc}")
    return problems


def run_validate(root: Path) -> list[str]:
    """All validate checks for the repository at root. Returns problems, empty if clean.

    Never reads the feed and never touches the network.
    """
    from pipeline.check_sources import check_prose, default_prose_paths
    from pipeline.clock import build_clock
    from pipeline.errors import PipelineError
    from pipeline.facts import load_facts

    root = Path(root)
    problems: list[str] = []
    try:
        facts = load_facts(root / FACTS_REL)
        clocks = build_clock(facts)
    except PipelineError as exc:
        problems.append(f"facts: {exc}")
    else:
        problems += verify_clock(facts, clocks)
    problems += validate_generated(root / DATA_REL)
    problems += [f"prose: {v}" for v in check_prose(default_prose_paths(root), root)]
    return problems


def cmd_validate(args: argparse.Namespace) -> None:
    """Fast checks: facts schema, 1938 clock, JSON schemas, copy rules.

    Does not read the feed or touch the network. Completes in under 10 seconds.
    Exits 1 and prints every problem if any check fails.
    """
    problems = run_validate(ROOT)
    if problems:
        print(f"validate: FAILED with {len(problems)} problem(s):")
        for p in problems:
            print(f"  {p}")
        sys.exit(1)
    print("validate: OK (facts, 1938 clock, generated JSON schemas, prose banned terms)")


class BuildError(Exception):
    """A build step failed. The message names the step."""

    def __init__(self, step: str, cause: Exception):
        self.step = step
        self.cause = cause
        super().__init__(f"step '{step}' failed: {cause}")


BUILD_STEPS = ("feed_check", "facts", "clock", "stops", "eligible", "race", "summary", "route", "emit")
FEED_REL = "raw/mta_local_bus.zip"
FEED_VERSION = "20260821"
SERVICE_DATE = "2026-11-04"
OSM_REL = "data/osm/ways.json"


def run_build(root: Path, output_dir: Path | None = None, cache_dir: Path | None = None, say=print) -> dict:
    """Run every pipeline step in order and write the generated files.

    Steps: feed_check, facts, clock, stops, eligible, race, summary, route,
    emit. Each step's output feeds the next. The first failure stops the build
    and raises BuildError naming the step. A progress line is printed through
    say() after each step.

    output_dir defaults to <root>/web/public/data. cache_dir defaults to
    <root>/raw/cache (the service-date stop_times cache). Returns the main
    objects (facts, races, summary, size rows) for callers that need them.
    Never downloads anything.
    """
    import datetime
    import itertools

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

    root = Path(root)
    output_dir = Path(output_dir) if output_dir is not None else root / DATA_REL
    cache_dir = Path(cache_dir) if cache_dir is not None else root / "raw" / "cache"
    date = datetime.date.fromisoformat(SERVICE_DATE)
    state: dict = {}
    total = len(BUILD_STEPS)

    def run(number: int, name: str, fn, describe) -> None:
        try:
            fn()
        except Exception as exc:  # fail fast, name the step
            raise BuildError(name, exc) from exc
        say(f"build: [{number}/{total}] {name}: {describe()}")

    def do_feed():
        state["sha"] = feed_mod.check_feed(root / FEED_REL)
        state["gtfs"] = reader_mod.GTFSReader(root / FEED_REL, cache_dir=cache_dir)

    def do_facts():
        state["facts"] = facts_mod.load_facts(root / FACTS_REL)

    def do_clock():
        state["clocks"] = clock_mod.build_clock(state["facts"])
        problems = verify_clock(state["facts"], state["clocks"])
        if problems:
            raise ValueError("; ".join(problems))

    def do_stops():
        state["stops"] = stops_mod.find_stops_near_corners(
            state["gtfs"], state["facts"].timing_points, radius_m=stops_mod.DEFAULT_STOP_RADIUS_M
        )
        state["slugs"] = [p.slug for p in state["facts"].timing_points]
        state["pairs"] = list(itertools.permutations(state["slugs"], 2))

    def do_eligible():
        services = eligible_mod.active_services(state["gtfs"], date)
        state["services"] = services
        stops = state["stops"]
        state["eligible"] = {
            (o, d): eligible_mod.find_eligible_trips(state["gtfs"], o, d, stops[o], stops[d], services, date)
            for o, d in state["pairs"]
        }

    def do_race():
        state["races"] = race_mod.run_all_races(state["pairs"], state["clocks"], state["eligible"], state["facts"])

    def do_summary():
        state["summary"] = summary_mod.compute_summary(state["races"], state["eligible"], state["facts"])

    def do_route():
        ways = route_mod.load_ways(root / OSM_REL, state["facts"])
        state["route"] = route_mod.build_route(state["facts"], ways)

    def do_emit():
        state["sizes"] = emit_mod.emit_all(
            state["facts"], state["races"], state["eligible"], state["summary"], state["route"],
            state["clocks"], state["sha"], FEED_VERSION, SERVICE_DATE, output_dir,
        )

    run(1, "feed_check", do_feed, lambda: f"feed {FEED_REL} matches the pinned SHA-256")
    run(2, "facts", do_facts, lambda: f"{len(state['facts'].timing_points)} corners")
    run(3, "clock", do_clock, lambda: "1938 clock built and verified")
    run(4, "stops", do_stops, lambda: f"{sum(len(v) for v in state['stops'].values())} stops near corners")
    run(5, "eligible", do_eligible,
        lambda: f"{sum(len(v) for v in state['eligible'].values())} one-seat trips over {len(state['pairs'])} pairs")
    run(6, "race", do_race, lambda: f"{sum(len(v) for v in state['races'].values())} races")
    run(7, "summary", do_summary, lambda: f"{state['summary'].races} counted races")
    run(8, "route", do_route, lambda: f"{sum(len(v) for v in state['route'].values())} route legs")
    run(9, "emit", do_emit, lambda: f"{len(state['sizes'])} files written to {output_dir}")
    return state


def cmd_build(args: argparse.Namespace) -> None:
    """Full pipeline build into web/public/data/. Completes in under 60 seconds.

    Runs feed_check, facts, clock, stops, eligible, race, summary, route and
    emit in order. Stops at the first failing step and says which one.
    """
    try:
        run_build(ROOT)
    except BuildError as exc:
        print(f"build: FAILED: {exc}")
        sys.exit(1)
    print("build: OK")


def run_check(root: Path, say=print, runner=None) -> int:
    """Build, then run pytest. Returns the exit code: 1 if the build fails,
    otherwise pytest's own exit code.

    Golden tests run whenever raw/mta_local_bus.zip is present (the developer
    machine, and always after a successful build) and skip with a visible
    warning when it is absent (hosted CI). pytest runs in a fresh process in
    the repository root.
    """
    import subprocess

    runner = runner or subprocess.run
    try:
        run_build(root, say=say)
    except BuildError as exc:
        say(f"check: build FAILED: {exc}")
        return 1
    say("check: build OK, running pytest")
    result = runner([sys.executable, "-m", "pytest", "-q"], cwd=str(root))
    code = int(result.returncode)
    say(f"check: pytest exited with {code}")
    return code


QUICK_PYTEST_ARGS = ["-q", "-m", "not requires_feed and not timing"]


def run_check_quick(root: Path, say=print, runner=None) -> int:
    """The quick check for the editor hook: validate, then pytest without the
    tests that read the feed (requires_feed) or assert a wall-clock limit (timing).

    Returns 1 if validate finds problems (pytest does not run), otherwise
    pytest's exit code. It does not run the build and does not read the feed.
    """
    import subprocess

    runner = runner or subprocess.run
    problems = run_validate(root)
    if problems:
        say(f"check --quick: validate FAILED with {len(problems)} problem(s):")
        for p in problems:
            say(f"  {p}")
        return 1
    say("check --quick: validate OK, running pytest without requires_feed and timing tests")
    result = runner([sys.executable, "-m", "pytest", *QUICK_PYTEST_ARGS], cwd=str(root))
    code = int(result.returncode)
    say(f"check --quick: pytest exited with {code}")
    return code


TIMING_PYTEST_ARGS = ["-q", "-m", "timing"]


def run_check_timing(root: Path, say=print, runner=None) -> int:
    """Run only the timing tests (the 10 s validate limit and the 60 s build limit).

    These are left out of every other run because they fail on a busy machine.
    Run this on a quiet machine, with nothing else running, before submission.
    The limits themselves are unchanged. Returns pytest's exit code.
    """
    import subprocess

    runner = runner or subprocess.run
    say("check --timing: running only the timing tests; close other programs first")
    result = runner([sys.executable, "-m", "pytest", *TIMING_PYTEST_ARGS], cwd=str(root))
    code = int(result.returncode)
    say(f"check --timing: pytest exited with {code}")
    return code


def cmd_check(args: argparse.Namespace) -> None:
    """Run the full build, then run pytest. Used before commits.

    The exit code is 1 if the build fails, otherwise pytest's exit code.
    The normal run leaves out the timing tests.
    With --quick: run validate, then pytest without the requires_feed and
    timing tests, and skip the build. That is the form the editor hook uses.
    With --timing: run only the timing tests, on a quiet machine, before submission.
    """
    if getattr(args, "timing", False):
        code = run_check_timing(ROOT)
    elif getattr(args, "quick", False):
        code = run_check_quick(ROOT)
    else:
        code = run_check(ROOT)
    if code != 0:
        sys.exit(code)


def run_verify(root: Path, say=print) -> list[str]:
    """Rebuild from the pinned feed into a temporary folder and compare it with
    the files in <root>/web/public/data, byte for byte (B23).

    The rebuild uses a new empty stop_times cache in a temporary folder, so it
    bypasses raw/cache and writes nothing under raw/ or web/. Returns one line
    per differing, missing or unexpected file; empty means the committed files
    match. A missing or wrong feed raises BuildError (verify never skips).
    """
    import tempfile

    root = Path(root)
    committed = root / DATA_REL
    with tempfile.TemporaryDirectory(prefix="ghostline-verify-") as tmp:
        tmp = Path(tmp)
        run_build(root, output_dir=tmp / "out", cache_dir=tmp / "cache", say=say)
        fresh = {p.relative_to(tmp / "out").as_posix(): p for p in (tmp / "out").rglob("*") if p.is_file()}
        existing = (
            {p.relative_to(committed).as_posix(): p for p in committed.rglob("*") if p.is_file()}
            if committed.is_dir()
            else {}
        )
        problems: list[str] = []
        for name in sorted(fresh):
            if name not in existing:
                problems.append(f"{name}: missing from {DATA_REL}")
            elif fresh[name].read_bytes() != existing[name].read_bytes():
                problems.append(f"{name}: differs from a fresh build")
        for name in sorted(set(existing) - set(fresh)):
            problems.append(f"{name}: in {DATA_REL} but a fresh build does not write it")
    return problems


def cmd_verify(args: argparse.Namespace) -> None:
    """Rebuild from raw/ and fail if committed data files differ.

    Rebuilds into a temporary folder with a fresh cache and compares every
    file byte for byte with web/public/data. Fails (never skips) if
    raw/mta_local_bus.zip is missing or is not the pinned feed.
    """
    try:
        problems = run_verify(ROOT)
    except BuildError as exc:
        print(f"verify: FAILED: {exc}")
        sys.exit(1)
    if problems:
        print(f"verify: FAILED, {len(problems)} file(s) differ from a fresh build:")
        for p in problems:
            print(f"  {p}")
        sys.exit(1)
    print("verify: OK (web/public/data matches a fresh build)")


def run_check_sources(root: Path) -> list[str]:
    """Both source checks for the repository at root. Returns violation lines, empty if clean.

    Prose violations read "prose: <file>:<line>: banned term '<term>'". JSON
    violations read "json: <label>: <problem>", where the label names the
    generated file (JSON has no line numbers). The two checks are separate
    operations and are reported separately.
    """
    from pipeline.check_sources import (
        check_json_sources,
        check_prose,
        default_json_paths,
        default_prose_paths,
    )

    root = Path(root)
    prose = [f"prose: {v}" for v in check_prose(default_prose_paths(root), root)]
    json_problems = [f"json: {v}" for v in check_json_sources(default_json_paths(root))]
    return prose + json_problems


def cmd_check_sources(args: argparse.Namespace) -> None:
    """Check prose for banned terms and generated JSON for source mappings.

    Prose scan paths: web/index.html, web/src/**, docs/*.md and README.md.
    Excluded: docs/planning, node_modules, dist and web/public/data.
    The prose check looks for banned terms only (live, real-time, realtime,
    arriving now, right now), case-insensitive, whole words or phrases. The
    exact phrase "Scheduled, not live." is allowed.
    The JSON check is separate: it validates the generated JSON source
    mappings (every source ID resolves, every numeric field is covered).
    """
    problems = run_check_sources(ROOT)
    if problems:
        print(f"check_sources: FAILED with {len(problems)} violation(s):")
        for p in problems:
            print(f"  {p}")
        sys.exit(1)
    print("check_sources: OK (prose has no banned terms; generated JSON source mappings are complete)")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="pipeline",
        description="Ghost Line race engine — builds JSON data from 1938 facts and MTA feed.",
    )
    subparsers = parser.add_subparsers(dest="command", metavar="COMMAND")

    p_validate = subparsers.add_parser(
        "validate",
        help="Fast checks (facts schema, clock, JSON schemas) — no feed, no network.",
        description=(
            "Run fast validation checks: facts YAML schema, 1938 clock consistency, "
            "JSON output schemas, and copy rules. Does not read the live feed or "
            "touch the network. Completes in under 10 seconds."
        ),
    )
    p_validate.set_defaults(func=cmd_validate)

    p_build = subparsers.add_parser(
        "build",
        help="Full pipeline build into web/public/data/.",
        description=(
            "Run the full pipeline: ingest the MTA feed, compute race state, and "
            "write all JSON outputs to web/public/data/. Completes in under 60 seconds."
        ),
    )
    p_build.set_defaults(func=cmd_build)

    p_check = subparsers.add_parser(
        "check",
        help="Run build then run pytest.",
        description=(
            "Run the full build and then execute the pytest suite. "
            "Intended for use by pre-commit and CI hooks."
        ),
    )
    mode = p_check.add_mutually_exclusive_group()
    mode.add_argument(
        "--quick",
        action="store_true",
        help="Validate, then pytest without requires_feed and timing tests. No build.",
    )
    mode.add_argument(
        "--timing",
        action="store_true",
        help="Run only the timing tests (10 s validate, 60 s build). Use a quiet machine.",
    )
    p_check.set_defaults(func=cmd_check)

    p_verify = subparsers.add_parser(
        "verify",
        help="Rebuild from raw/ and compare output against committed files.",
        description=(
            "Rebuild all data files from raw/ and diff them against the versions "
            "committed to the repository. Fails if any file differs, ensuring committed "
            "data stays in sync with the pipeline."
        ),
    )
    p_verify.set_defaults(func=cmd_verify)

    p_check_sources = subparsers.add_parser(
        "check_sources",
        help="Prose: banned terms. Generated JSON: source mappings.",
        description=(
            "Two separate checks. Prose check: scan web/index.html, web/src/**, "
            "docs/*.md and README.md for banned terms (live, real-time, realtime, "
            "arriving now, right now; case-insensitive, whole words or phrases; "
            "the exact phrase \"Scheduled, not live.\" is allowed). Excluded from "
            "the prose scan: docs/planning, node_modules, dist and web/public/data. "
            "JSON check: validate the generated JSON source mappings (every source "
            "ID resolves and every numeric field is covered). "
            "Fails with a list of violations on any match."
        ),
    )
    p_check_sources.set_defaults(func=cmd_check_sources)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(0)

    args.func(args)
