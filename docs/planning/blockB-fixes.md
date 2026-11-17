# 8. Kiro prompts for Block B

✅ Emmanuel's decisions recorded for these prompts

- Repo steering wins. The 3D map, three.js, transfers and add-your-own-line kit are out. Census and redlining follow the race working end to end.
- Keep the first terminal cars at 09:00 eastbound and 09:04 westbound, with the before-table rule. Exclude the 08:55/08:56 cars.
- Both street_order_checked flags stay false until Emmanuel checks the scans himself.

Paste each block into Kiro in order. Prompt 1 covers every still-needed item and the spec counterparts of the six finished-file corrections, so the resulting spec describes the same changes as Prompt 2. Prompt 3 applies B6's Git attributes.

☑ These prompts were checked against the current files and the Block B assessment. Prompt 2 distinguishes tests of the finished schemas, CLI and fixture from tests assigned to future modules. The window-average method and proposed replacement file-size budget remain open.

## Prompt 1 — Spec fixes

```text
Update only .kiro/specs/race-engine/requirements.md, design.md and tasks.md.
Read docs/planning/blockB-fixes.md for the referenced Prompt 2/3 details.
Apply only the B-numbered spec corrections below, including the spec counterparts of Prompt 2.
Never edit expected values. If a correction conflicts with one, report it and continue independent fixes.
Preserve existing work and completed-task history. Add explicit correction tasks where needed.
Show me the diff for these three files and a B-number checklist when finished.
Follow repo steering. Keep 3D, three.js, transfers and the add-your-own-line kit out. Census/redlining wait until the race works end to end.
First terminal cars stay 09:00 eastbound and 09:04 westbound. Preserve the before-table rule.
Both street_order_checked flags stay false until I personally check the scans.
B1. Join each leg's ways in listed order, orienting each to continue the preceding way.
Then locate vertices nearest clip_from/clip_to, reverse the joined line if their order is reversed,
and clip. Equal clipping vertices raise RouteError. Retain other gap and length validation.
B2. Specify westbound legs as one line and loop + eastbound legs as the other.
Check joins within 1 m and timing points within 30 m on those two lines.
Each GeoJSON leg requires direction, street, method, note and length_m. Loop legs belong to eastbound.
B3. Keep full precision in facts, clock, stops, eligible, race and summary.
Round only in emit, durations/walk minutes to 3 decimals and walk metres to 2.
Remove early-rounding instructions and dataclass precision comments.
Specify the existing lead 10:00 check, wait 30.458 and total 45.156, from unrounded walks.
B4. Read departure patterns, first/last and timing minutes from facts. Remove hard-coded clock constants.
Validation requires at least two timing points, first minutes 0 and later positive whole minutes.
Require both directions' minutes_past_hour/first/last and each leg's street/method/length_m,
plus osm_ways with clip points or points_lonlat with a note.
One slug function lowercases, replaces " & " with "-", then spaces with "-". Test all five real slugs.
B5. Scan prose only in web/index.html, web/src/**, docs/*.md and README.md.
Exclude docs/planning, node_modules, dist and web/public/data. Prose checks banned terms only.
Match live, real-time, realtime, arriving now and right now case-insensitively as whole words/phrases.
Allow the exact phrase "Scheduled, not live." Test deliver/olive/lives as allowed. JSON uses B16.
B6. Specify UTF-8 without BOM, LF, compact separators, fixed key order and byte-for-byte verify. Record Prompt 3's .gitattributes rules as a separate pending task.
B7. Remove FR-9.10, P8, Python display_rounding, task 17 and its dependent references.
Display rounding belongs in race-screen. Stored rows use t/start/before_table/y1938/today/result/margin
with the brief's null/absence conventions and numeric durations, without display-only or *_exact fields.
B8. Files use HH:MM for slider/1938 clock times and HH:MM:SS for GTFS, including hours above 23.
Use numeric durations/walks and full-precision minute values internally. Align FR-9.7 and dataclasses.
B9. Empty eligible list means NO_ONE_SEAT_RIDE. None catchable means internal NO_MORE_TRIPS_TODAY.
Retain four output results. Specify its unit test and PipelineError naming pair/time if real data hits it.
B10. Remove fetch_osm, requests and task 15 from the spec. List the five steering commands.
Route reads the committed 2026-11-01 data/osm/ways.json snapshot. Missing way IDs raise named RouteError.
Remove task 16's fetch dependency. Record supplying the snapshot as pending.
B11. Replace the 1933-isolation property with route reading only no21-1938.yaml and data/osm/ways.json.
B12. Specify 293 slider rows, 09:00–13:52. Pre-coverage rows repeat the covered_from race.
Count only t >= covered_from in P5 and summaries. Keep the existing 5,666 golden total.
B13. Delete the unsupported --skip-feed example.
B14. Type gap_min/gap_max as numbers, round at emit to 3 decimals, using adjacent sorted departures
in [09:00, 14:00). Keep the existing lead-pair golden gaps 34.0 and 39.0.
B15. Cover every row of brief tables 5.1–5.8. Remove "all 28" and move 5.9 to race-screen.
B16. Specify index.sources as the source-ID catalog and other files' sources as block-to-ID mappings.
Use the six IDs and field-coverage contract in Prompt 2. Retain existing nested source URLs.
Specify emit checks for unresolved IDs and uncovered numeric fields, with explicit computed dependencies.
B17. Add total >= access + ride + egress and wait >= 0. For the same chosen trip, +1 start means -1 total.
P10 recomputation from stored 3-decimal numbers uses absolute tolerance 0.002.
B18. inferred is true exactly when either endpoint is brevard-preston. Test eight files and the lead pair.
B19. Specify raw/gzip size reporting and checks against current approved brief budgets. Record the proposed 20 KB gzip race limit as pending my decision. Report budget failures.
B20. requires_feed applies only to tests reading the pinned zip, including full-build integration.
Clock 5.1, formula 5.7 and route 5.8 tests run without that zip. Align tasks 10.7, 16.8 and 25.2.
B21. validate checks every existing generated JSON/GeoJSON file against its schema without reading the feed.
B22. Specify a blank arrival/departure fixture row, ignored with a logged message. Add the future reader test.
B23. Cache CSV under raw/cache with feed hash's first 12 characters and service date. verify bypasses cache.
B24. Convert dependency checkboxes to plain text. Check links after task removals and preserve task IDs.
Keep brief corrections and the window-average decision explicitly pending. Show the diff and stop.
```

## Prompt 2 — Finished-file fixes and tests

```text
Apply only B2, B5, B10, B12, B16 and B22 below to the listed finished files and focused tests.
Read the corrected race-engine spec and docs/planning/race-brief.md for context.
Allowed production files are pipeline/schemas/{route,race,index,summary}.schema.json,
pipeline/cli.py, pyproject.toml and tests/fixtures/fake-gtfs/stop_times.txt.
Allowed test files are tests/unit/test_cli_stubs.py and, if needed, tests/unit/test_output_schemas.py
and tests/unit/test_fixture_contracts.py. Reuse equivalent existing tests where available.
Never edit expected values. Report any disagreement and continue independent corrections.
First cars stay 09:00 eastbound / 09:04 westbound, with the before-table rule.
Both street_order_checked flags stay false until my scan check. Follow repo steering.
Show me the diff for every changed file, test commands/results and each B-number's completion status.
B2. In route.schema.json require direction and length_m alongside street, method and note.
direction accepts eastbound/westbound. length_m is a nonnegative number. Loop legs use eastbound.
Test a valid leg of each direction, then reject each missing field, invalid direction and negative length.
These schema tests prove the file contract. Route joining and timing-point tests remain in task 16.
B5. Update check_sources CLI help/docstrings to state the exact prose scan paths from Prompt 1,
the exclusions, banned-term checking and generated JSON source validation.
Test both top-level help and check_sources --help, including the distinction between prose and JSON.
Keep the checker implementation assigned to its existing future task.
B10. Remove requests from pyproject.toml and fetch_osm from CLI registration, handler and stub tests.
Keep validate, build, check, verify and check_sources.
Test the public CLI help lists all five commands and excludes fetch_osm.
Test fetch_osm exits with argparse's unknown-command error. Run the five remaining stub tests.
Check the project dependency list excludes requests. Snapshot copying remains a separate pending action.
B12. Correct race.schema.json's row description to every minute 09:00–13:52.
Set races minItems and maxItems to 293. Preserve existing clock strings and numeric-duration fields.
Test a complete synthetic 293-row document containing pre-coverage rows with repeated covered_from start.
Reject documents with 292 and 294 rows. Keep valid B16 source metadata in these synthetic documents.
The schema proves length and shape. Counting/filtering behavior remains for the later race/summary tests.
B16. In index.schema.json replace the sources array with a catalog object keyed by these six IDs,
guide1938_diagram, guide1938_timetable, guide1938_route, mta_gtfs, osm and method.
Each catalog entry requires what, year, where and url. Allow null year/url for a documented method.
Use existing source metadata. Preserve feed version/hash/date and snapshot date in the source description.
In race, summary and route schemas require a top-level sources object mapping blocks/fields to ID arrays.
Race mappings require y1938 -> diagram/timetable IDs, today -> mta_gtfs/method, and
races -> diagram/timetable/mta_gtfs/method, documenting derivation from y1938 and today.
Use radius_m -> method for the numeric top-level race parameter.
Summary numeric counts and today_wins map to the race inputs and method, with the derivation documented.
Route features map to guide1938_route/osm/method, with inferred geometry explained by existing notes.
The index catalog covers corners through guide1938_diagram/guide1938_route/osm and existing inference notes.
Specify coverage for any additional numeric field explicitly in the schema descriptions.
Preserve the brief's existing nested y1938 source URLs and all unrelated schema constraints.
Require nonempty ID arrays drawn from the six catalog IDs. Require all six entries in index.sources.
Test valid documents for all four schemas and reject missing required source mappings,
unknown IDs, empty ID lists, the old index sources array and incomplete catalog entries.
Run Draft202012Validator.check_schema on all four schemas.
Cross-file reference resolution and recursive numeric coverage remain for the future emitter/checker tests.
B22. Add one fake stop_times row with empty arrival_time and departure_time.
Use an existing fake trip/stop and a fresh stop_sequence without replacing any existing timed row.
Test via csv.DictReader that both time cells are empty, trip/stop references exist and sequences are unique.
Assert the original timed rows remain intact and the existing overnight example still exists.
The skip-and-log reader test stays pending until the reader exists, as recorded in Prompt 1.
Run the focused schema, CLI and fixture tests. Report failures without relaxing assertions.
Show me the complete diff, including new test files, and stop after these listed corrections.
```

## Prompt 3 — Git line endings

```text
B6. Add only these rules to the repository-root .gitattributes, creating the file if needed.
Preserve any existing unrelated attributes and avoid duplicate rules.
web/public/data/** text eol=lf
data/osm/*.json text eol=lf
Never edit expected values. Change only .gitattributes for this prompt.
First cars stay 09:00 eastbound / 09:04 westbound with the before-table rule.
Both street_order_checked flags stay false until I check the scans.
Verify the effective attributes using these read-only commands.
git check-attr text eol -- web/public/data/index.json
git check-attr text eol -- web/public/data/race/test.json
git check-attr text eol -- data/osm/ways.json
Each path must report text set and eol lf.
Show me the .gitattributes diff and command output, including the file contents if it is new.
Stop after this change.
```
