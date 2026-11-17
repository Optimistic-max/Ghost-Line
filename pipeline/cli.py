"""Command dispatcher for the pipeline package (stub — commands not yet implemented)."""

import argparse
import sys


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="pipeline",
        description="Ghost Line race engine — builds JSON data from 1938 facts and MTA feed.",
    )
    subparsers = parser.add_subparsers(dest="command", metavar="COMMAND")

    subparsers.add_parser("fetch_osm", help="One-time fetch of OSM way geometries via Overpass API.")
    subparsers.add_parser("validate", help="Fast checks (facts schema, clock, JSON schemas) — no feed, no network.")
    subparsers.add_parser("build", help="Full pipeline build into web/public/data/.")
    subparsers.add_parser("check", help="Run build then run pytest.")
    subparsers.add_parser("verify", help="Rebuild and compare output against committed files.")
    subparsers.add_parser("check_sources", help="Check for banned words and unsourced numbers.")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(0)

    # All commands are stubs until their tasks are implemented.
    print(f"Command '{args.command}' is not yet implemented.")
    sys.exit(1)
