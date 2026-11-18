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


def cmd_build(args: argparse.Namespace) -> None:
    """Full pipeline build into web/public/data/. Completes in under 60 seconds."""
    print("Command 'build' is not yet implemented.")
    sys.exit(1)


def cmd_check(args: argparse.Namespace) -> None:
    """Run the full build, then run pytest. Used by pre-commit hooks."""
    print("Command 'check' is not yet implemented.")
    sys.exit(1)


def cmd_verify(args: argparse.Namespace) -> None:
    """Rebuild from raw/ and fail if committed data files differ."""
    print("Command 'verify' is not yet implemented.")
    sys.exit(1)


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
    print("Command 'check_sources' is not yet implemented.")
    sys.exit(1)


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
