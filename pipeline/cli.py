"""Command dispatcher for the pipeline package (stub — commands not yet implemented)."""

import argparse
import sys


def cmd_fetch_osm(args: argparse.Namespace) -> None:
    """One-time fetch of OSM way geometries via Overpass API."""
    print("Command 'fetch_osm' is not yet implemented.")
    sys.exit(0)


def cmd_validate(args: argparse.Namespace) -> None:
    """Fast checks: facts schema, 1938 clock, JSON schemas, copy rules.

    Does not read the feed or touch the network. Completes in under 10 seconds.
    """
    print("Command 'validate' is not yet implemented.")
    sys.exit(0)


def cmd_build(args: argparse.Namespace) -> None:
    """Full pipeline build into web/public/data/. Completes in under 60 seconds."""
    print("Command 'build' is not yet implemented.")
    sys.exit(0)


def cmd_check(args: argparse.Namespace) -> None:
    """Run the full build, then run pytest. Used by pre-commit hooks."""
    print("Command 'check' is not yet implemented.")
    sys.exit(0)


def cmd_verify(args: argparse.Namespace) -> None:
    """Rebuild from raw/ and fail if committed data files differ."""
    print("Command 'verify' is not yet implemented.")
    sys.exit(0)


def cmd_check_sources(args: argparse.Namespace) -> None:
    """Fail on banned words and unsourced numbers found in web/ or docs/."""
    print("Command 'check_sources' is not yet implemented.")
    sys.exit(0)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="pipeline",
        description="Ghost Line race engine — builds JSON data from 1938 facts and MTA feed.",
    )
    subparsers = parser.add_subparsers(dest="command", metavar="COMMAND")

    p_fetch_osm = subparsers.add_parser(
        "fetch_osm",
        help="One-time fetch of OSM way geometries via Overpass API.",
        description="Fetch OSM way geometries for the route via the Overpass API and save them to raw/. Run once before the first build.",
    )
    p_fetch_osm.set_defaults(func=cmd_fetch_osm)

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
        help="Check for banned words and unsourced numbers in web/ or docs/.",
        description=(
            "Scan web/ and docs/ for banned words and numbers that lack a source "
            "citation. Fails with a list of violations on any match."
        ),
    )
    p_check_sources.set_defaults(func=cmd_check_sources)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(0)

    args.func(args)
