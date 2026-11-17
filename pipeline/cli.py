"""Command dispatcher for the pipeline package (stub — commands not yet implemented)."""

import argparse
import sys


def cmd_validate(args: argparse.Namespace) -> None:
    """Fast checks: facts schema, 1938 clock, JSON schemas, copy rules.

    Does not read the feed or touch the network. Completes in under 10 seconds.
    """
    print("Command 'validate' is not yet implemented.")
    sys.exit(1)


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
