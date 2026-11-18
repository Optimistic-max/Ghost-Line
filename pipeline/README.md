# Ghost Line pipeline

This folder holds the race engine. It reads the hand-entered 1938 facts file, the
pinned MTA bus feed and a saved copy of OpenStreetMap street shapes. It writes
the small JSON files the site looks up. The site does no race arithmetic.

Every time here is a scheduled time. The pipeline never reads a vehicle-position
feed or any other feed of bus locations.

## Install

You need Python 3.12 or later.

From the repository root:

```
pip install -e .
```

To run the tests as well, install the development tools:

```
pip install -e ".[dev]"
```

## The five commands

Run all of them from the repository root with `python -m pipeline <command>`.
Each one exits 0 on success and 1 on failure, and says what failed.

**validate**

```
python -m pipeline validate
```

Fast checks. It loads the facts file, builds the 1938 clock and checks it, checks
every generated JSON file that exists against its schema, and scans the prose for
banned words. It does not read the feed and does not use the network, so it is
quick enough to run after every edit.

**build**

```
python -m pipeline build
```

The full build. It runs these steps in order and stops at the first one that
fails, naming it: feed check, facts, clock, stops, eligible trips, races,
summary, route, emit. It writes into `web/public/data/`. Nothing else writes
there: do not edit those files by hand.

**check**

```
python -m pipeline check
```

Runs the build, then runs pytest. The exit code is 1 if the build fails,
otherwise it is pytest's own exit code. Run it before every commit.

**verify**

```
python -m pipeline verify
```

Rebuilds from the feed into a temporary folder, with a fresh stop-times cache,
and compares every file byte for byte with `web/public/data/`. It lists each
file that differs, is missing or should not be there. If the feed file is
missing it fails. It never skips.

**check_sources**

```
python -m pipeline check_sources
```

Two separate checks. The prose check scans `web/index.html`, `web/src/`,
`docs/*.md` and `README.md` for the banned words, and reports each hit with its
file and line number. `docs/planning`, `node_modules`, `dist` and
`web/public/data` are left out. The JSON check reads the generated files and
confirms that every source ID resolves in the catalog in `index.json` and that
every block holding a number has a source mapping.

## What a build writes

All of it goes into `web/public/data/`, and the generated files are committed.

- `index.json`: the line, the corners, the directed pairs, the service date, the
  feed version and hash, and the source catalog.
- `summary.json`: the counts behind the honest line, a verdict for each pair, and
  the list of races that today wins.
- `route.geojson`: the 1938 route, one feature per leg.
- `race/<origin>__<dest>.json`: one file for each directed pair, with one row for
  every whole minute of the slider.

The numbers for this snapshot are in those files. For example, `index.json` lists
the corners and pairs, and `summary.json` holds the totals. This README does not
repeat them.

## The pinned feed

The build uses one frozen copy of the MDOT MTA local bus schedule. It is the
weekday schedule for the service date in `index.json`, and the feed version and
SHA-256 hash are in `index.json` too.

- The file must be at `raw/mta_local_bus.zip`.
- `raw/` is ignored by git. Never commit the zip or anything under `raw/`.
- The build never downloads a feed. The public address serves newer versions, so
  a fresh download would not match the pin. If the file is missing, or its
  SHA-256 differs from the pinned value, the build stops with a clear error.
- The build caches the service-date rows of the stop-times table under
  `raw/cache/` so later builds are fast. `verify` and the golden build tests use
  a temporary cache instead and write nothing under `raw/`.
- The feed comes from <https://feeds.mta.maryland.gov/gtfs/local-bus>. This is a
  link for credit only. This project is not endorsed by MDOT MTA.

## The street shapes

The route comes from `data/osm/ways.json`, a saved copy of OpenStreetMap ways.
The date of the copy is in the `osm` entry of the catalog in `index.json`. The
build only reads this file. It never fetches anything. If a way listed in the
facts file is missing from the copy, or a leg comes out at a different length
than the facts file says, the route step fails and names the street.

Route shapes derive from OpenStreetMap, which is under the ODbL licence. Credit:
OpenStreetMap contributors.

## Tests

Run them with `python -m pytest`. There are three kinds: example tests, golden
tests and property tests.

- Golden tests compare the pipeline with the values in the race brief. Those
  that read the feed zip carry the `requires_feed` marker. They always run when
  `raw/mta_local_bus.zip` is present. When it is absent, as on a hosted build,
  they are skipped with a visible message and a warning. The clock and route
  golden tests do not read the zip, so they always run.
- Tests marked `timing` check a wall-clock limit. They can fail on a busy
  machine. To leave them out, run `python -m pytest -m "not timing"`.
- If a computed value differs from a golden value, stop and look at why. Do not
  edit a golden value, the facts file or a test to make a check pass.

Fixtures in `tests/fixtures/` are a made-up line and a tiny made-up feed. They
are never written to `web/`.

## Where to read more

- The race brief, with the algorithms and the expected values:
  [docs/planning/race-brief.md](../docs/planning/race-brief.md)
- The design of this pipeline:
  [.kiro/specs/race-engine/design.md](../.kiro/specs/race-engine/design.md)
