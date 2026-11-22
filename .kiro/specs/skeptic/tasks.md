# Implementation Plan: Skeptic

## Overview

Build the independent MCP server for the pinned feed, the read-only Skeptic agent, the planted-error fixtures, and the tests that prove them. Everything is Python and editor-side. Nothing under web/ and no pipeline output changes (P-F). The design names the language (Python), so no language question applies.

Order follows the approved plan: SDK docs, one approved install, test plumbing, the server in layers, property tests, independence tests, fixtures, Kiro wiring, protocol test, golden tests, final check. Tasks 12 to 14 are for Emmanuel in the Kiro IDE and are never done by the agent.

Rules for every task:

- Golden values (36 trips; the five departures 10:32:43, 11:08:43, 11:44:43, 12:20:43, 12:56:43; stops 8564 and 9486; feed_version 20260821; service 2251) appear only in tests/golden/test_mcp_server_golden.py. Never in pipeline/mcp_server.py, the agent file or the steering file (P-D, R7.10).
- If a computed value differs from a golden value, stop and tell Emmanuel. Never edit a golden value, a facts file or a test to make a check pass.
- pipeline/mcp_server.py imports no pipeline module and writes nothing to disk (R1.5, R2.1).
- Commits are small, imperative, stage named files only, include .kiro/ changes, and never include raw/.

## Tasks

- [x] 1. Read the MCP SDK documentation
  - [x] 1.1 Check the SDK's current docs and record the findings
    - Read the current official Python MCP SDK docs (1.x line, stdio transport, FastMCP tool registration, how an exception raised in a tool is reported, how to keep stdout clean).
    - Write the findings, with source links and the date, to .kiro/specs/skeptic/sdk-notes.md. Note any difference from the design's section 2.8 sketch.
    - If the docs contradict the design on a point that changes behaviour (for example tool errors), stop and tell Emmanuel.
    - Commit: "Record MCP SDK notes for the skeptic spec".
    - _Requirements: R1.1_

- [x] 2. Add and install the "skeptic" dependency group
  - [x] 2.1 Pin the group, ask Emmanuel, install, check the import
    - Add `skeptic = ["mcp>=1.27,<2"]` under optional-dependencies in pyproject.toml. Not in base or dev dependencies.
    - Use user_input to ask Emmanuel once, immediately before the install, for approval to run `pip install -e .[skeptic]` (a network step). Wait for the answer. Do not install without a yes.
    - After approval, run the install, then `python -c "import mcp"` on this machine (Python 3.14).
    - If the import fails, stop and tell Emmanuel. Do not continue with other tasks.
    - Commit: "Add skeptic optional dependency group".
    - _Requirements: R1.7, R1.8_

- [x] 3. Test plumbing: marker, conftest hooks, check-command line
  - [x] 3.1 Register the needs_mcp_sdk marker and the conftest hooks
    - Register `needs_mcp_sdk` in pyproject.toml next to requires_feed and timing.
    - In tests/conftest.py, add a collection hook that uses `importlib.util.find_spec("mcp") is None`. When absent: skip marked items with the reason "the MCP SDK is not installed: protocol test SKIPPED (pip install -e .[skeptic])" and call `warnings.warn` with the count and that reason, as the feed hook does. When present but broken: do not skip.
    - Add `pytest_runtest_logreport` to record node ids of needs_mcp_sdk tests whose outcome is skipped, and `pytest_sessionfinish` to print the list and set `session.exitstatus = 1` if the SDK is installed and the list is not empty. Deselected tests do not count.
    - _Requirements: R9.6 (addition), R9.7_

  - [x] 3.2 Add mcp_sdk_line() to pipeline/cli.py and use it in the check commands
    - `mcp_sdk_line()` returns "check: MCP SDK installed: the protocol test will run" or "check: WARNING: MCP SDK not installed: the protocol test will be SKIPPED (pip install -e .[skeptic])", chosen with `importlib.util.find_spec("mcp")`.
    - `run_check` and `run_check_quick` say the line before pytest starts and again after "pytest exited with N". The exit code does not change when the SDK is absent. Leave `QUICK_PYTEST_ARGS`, the pytest argument lists and the `runner` interface unchanged. `check --timing` prints no line.
    - _Requirements: R9.6 (addition), R9.7_

  - [x] 3.3 Write tests for the helper, the check output and the skip guard
    - Unit tests for `mcp_sdk_line()` with a patched `find_spec` (both lines), and for `run_check` and `run_check_quick` with an injected `say` and runner: line appears before and after pytest, exit code unchanged when absent.
    - A pytester-style or subprocess test for the guard: an SDK-installed run with a needs_mcp_sdk test that calls `pytest.skip` ends with exit status 1 and lists the test; the same test with the SDK absent (find_spec patched) skips with the warning and does not fail.
    - Run the existing cli tests to confirm they still pass.
    - Commit: "Add needs_mcp_sdk marker, skip guard and check SDK line".
    - _Requirements: R9.6 (addition), R9.7_

- [x] 4. The server, layer by layer (pipeline/mcp_server.py)
  - [x] 4.1 Reader layer: constants, data classes, load_feed
    - Create pipeline/mcp_server.py with the standard-library reader only (zipfile, csv, hashlib, datetime, os, pathlib, threading, logging, sys, dataclasses). Import the SDK nowhere at module level.
    - Constants: `PINNED_SHA256`, `SERVICE_DATE`, `ENV_ZIP`, `LOAD_WAIT_SECONDS = 30`, `DEFAULT_ZIP` from `Path(__file__).resolve().parents[1] / "raw" / "mta_local_bus.zip"`. A relative GHOSTLINE_GTFS_ZIP resolves against the repository root. Define the SHA-256 once as a literal here, not imported from pipeline.
    - `Call`, `Trip`, `Feed` as in design 2.3.
    - `load_feed(zip_path, expected_sha256=PINNED_SHA256)` in the order of design 2.4: missing zip, hash in 1 MiB chunks, feed_info (None when absent), active services from calendar.txt and calendar_dates.txt (types 1 and 2, date-only services count), trips of active services, route_short_name, stop ids, stop_times streamed row by row, times parsed to seconds past 24:00, blank-time fallback, calls with both blank dropped and the dropped count logged to stderr, calls sorted by seq. Any unreadable member, missing column or bad stop_sequence returns `Feed(error=...)` naming member and column, never a partial feed.
    - No golden value in the file. Write no file, make no network call.
    - _Requirements: R1.3, R1.5, R1.6, R2.1, R2.2, R2.3, R2.4, R3.2_

  - [x] 4.2 Unit tests for the reader
    - Create tests/unit/test_mcp_server.py with a helper that writes a small zip into tmp_path from table dictionaries, starting from tests/fixtures/fake-gtfs (made-up feed, test-only hash).
    - Cover: missing zip, wrong hash (both give an error Feed and no tables read), active services computed from calendar plus exceptions (including an inactive service and a date-only service), times past 24:00 parsed and kept in the feed's own text, blank-time fallback and dropped-call count, malformed table names its member and column, relative env path resolves against the repository root, load writes nothing under tmp_path or the repository.
    - _Requirements: R1.3, R1.5, R2.3, R2.4, R3.2, R9.1_

  - [x] 4.3 Queries and error classes
    - Add `FeedUnavailable`, `ToolInputError` and `FeedStillLoading` (all `ValueError` subclasses).
    - `feed_info_answer(feed)` returns feed_version, sha256, service_date, active_service_ids; raises FeedUnavailable when `feed.error` is set.
    - `trips_serving_answer(feed, stop_a, stop_b, date, after=None, before=None)` in the order of design 2.6: feed error, date, unknown stop, malformed limits (`^\d{1,2}:\d{2}$`, minutes under 60), then the first stop_a call that has a later stop_b call, once per trip, inclusive limits on dep_a in seconds, sort by (seconds, trip_id), feed's own spelling and times. A known stop with no trips gives count 0 as a true answer. Errors are raised, never converted to an empty list.
    - _Requirements: R3.1, R3.3, R4.1, R4.2, R4.3, R4.4, R4.5, R4.6, R4.7, R4.8, R5.1, R5.2, R5.3, R5.4_

  - [x] 4.4 Unit tests for the queries
    - Extend tests/unit/test_mcp_server.py with feeds built in code: wrong date, unknown stop, malformed after and before (each an error naming the value, never an empty list), inclusive limits at the exact boundary, departure after 24:00 sorting after 09:00:00 and "9:00:00" before "10:00:00", a trip calling at stop_a twice counted once, a trip reaching stop_b before stop_a not counted, ordering by dep_a then trip_id, an inactive service not counted, feed_info with a load error, a known stop with no trips giving count 0.
    - _Requirements: R3, R4, R5, R9.1_

  - [x] 4.5 wait_for_feed and the load-wait tests
    - Add `wait_for_feed(ready, holder, timeout=LOAD_WAIT_SECONDS)`: waits on the event, raises `FeedStillLoading` with text starting "feed still loading" and stating the wait when the limit passes, answers only from a complete Feed that the loader published into `holder` just before setting the event. It never reads the file itself.
    - Tests in tests/unit/test_mcp_server.py with an injected loader and a short `timeout` argument (never edit LOAD_WAIT_SECONDS): (a) a call made during a slow load waits and then answers correctly; (b) a call whose limit passes first raises FeedStillLoading and returns neither an empty list nor partial data.
    - _Requirements: R2.3, R2.4, R5.4, R9.1_

  - [x] 4.6 Serving layer
    - Add `build_server(feed_ready, holder)` that imports `mcp.server.fastmcp.FastMCP` inside the function, registers `feed_info` and `trips_serving` with docstrings stating units and limits, and does not catch the error classes. Add `main()` that logs to stderr, starts the loader in a background thread, then runs stdio, and the `if __name__ == "__main__"` guard. Follow the findings in sdk-notes.md.
    - No `print`, no `sys.stdout`, no file writes, no network imports.
    - Start-up check: `python -c "import pipeline.mcp_server"` still works and imports no SDK at module level.
    - Commit: "Add independent MCP server for the pinned feed".
    - _Requirements: R1.1, R1.2, R1.4, R1.5, R1.6, R2.4_

- [x] 5. Property tests for the queries
  - [x] 5.1 Write Hypothesis property tests on generated small feeds
    - Create tests/property/test_mcp_server_props.py. Properties: results sorted by (dep seconds, trip_id); `count` equals the length of `trips`; every returned trip has its a-call before its b-call by stop_sequence; widening `after`/`before` never removes a trip; a trip appears at most once; shuffling the rows of stop_times does not change the answer.
    - Commit: "Add property tests for the MCP server queries".
    - _Requirements: R4.3, R4.6, R4.7, R9.4_

- [x] 6. Independence tests
  - [x] 6.1 Write the AST, hash and hygiene tests for the server
    - Create tests/unit/test_mcp_independence.py. AST scan of pipeline/mcp_server.py: no import of any pipeline module (absolute, from-import and relative), no network module (socket, urllib, http, requests), no `print(`, no `sys.stdout`, no write-mode `open` ("w", "a", "x").
    - Assert `PINNED_SHA256 == pipeline.feed_check.PINNED_FEED_SHA256`.
    - Assert none of the golden tokens (stop ids 8564 and 9486, the five departures, 20260821, the count 36) appear in pipeline/mcp_server.py. To keep P-D (golden values only in the golden module), do not type the tokens here: create tests/golden/golden_tokens.py here (a plain module-level tuple, the only other place golden values are written, with no raw/ skip) and import it. Task 10.1 reuses it.
    - Commit: "Add independence tests for the MCP server".
    - _Requirements: R1.5, R1.6, R2.1, R2.2, R2.5, R7.10, R9.5_

- [x] 7. Fixtures for the Skeptic
  - [x] 7.1 Write clean.md and planted.md
    - Before writing, read web/public/data/index.json, summary.json and race/*.json for the lead pair. Verify the two required sentences against the data at this time: "36 scheduled one-seat buses from Biddle St & Caroline Ave to Caroline St & Eastern Ave on the Wed Nov 4, 2026 weekday schedule" and "1938 wins by 30 minutes at 10:00 AM (Preston & Caroline to Aliceanna & Bond)".
    - If a number in either sentence does not match the data, stop and tell Emmanuel. Do not change a value to fit.
    - Create tests/fixtures/skeptic/clean.md with those two sentences and a few more claims, each taken from the data files as read in this task, not from memory. Create tests/fixtures/skeptic/planted.md identical except 36 becomes 38 and the added sentence "Ridership on the No. 21 doubled in 1938."
    - No wording banned for service times in either file. Neither file goes under docs/.
    - _Requirements: R8.1, R8.2, R8.3, R8.5_

  - [x] 7.2 Test the fixtures
    - Create tests/unit/test_skeptic_fixtures.py: both required sentences are in clean.md; clean and planted differ in exactly the two places (one changed line, 36 to 38, and one added sentence); neither file contains a term found by `pipeline.check_sources.find_banned_terms`; neither path is under docs/.
    - Commit: "Add planted-error fixtures for the Skeptic".
    - _Requirements: R8.1, R8.2, R8.3, R8.4, R8.5_

- [x] 8. Kiro wiring
  - [x] 8.1 Register the server in .kiro/settings/mcp.json
    - If the file exists, read it and add only the "ghostline-gtfs" entry (command `python`, args `["-m", "pipeline.mcp_server"]`, env GHOSTLINE_GTFS_ZIP "raw/mta_local_bus.zip", disabled false). Keep every other entry as it is. If it does not exist, create it with that one entry.
    - _Requirements: R6.1_

  - [x] 8.2 Write the agent and the steering file
    - Create .kiro/agents/skeptic.md with front matter name `skeptic`, a description saying it is a read-only fact checker given file paths that reports each claim as OK, MISMATCH or UNSOURCED with evidence, and `tools: ["read", "@ghostline-gtfs"]`. No write tool, no shell tool.
    - Body follows design 3.2: role, evidence order with exact paths (index.json, summary.json, race/*.json, route.geojson, data/lines/no21-1938.yaml, web/src/copy/copy.ts, docs/kiro-usage.md, then the ghostline-gtfs tools), output line format and last line (PASS or "FAIL: <n> MISMATCH, <m> UNSOURCED"), MISMATCH and UNSOURCED definitions, matching rules, honesty rules as evidence including the banned words and "citywide" and the one exception "Scheduled, not live.", how to check a bus-trip claim (stop ids from evidence, feed_info once, then trips_serving, quote the answer; no stop ids in evidence means UNSOURCED), wording and field checks read from the evidence at check time (the honest line, `summary.ride_same_rule`, `wait_most`) with none of their values typed in, and the ban on editing, proposing replacement numbers and guessing. A missing input file is reported as an error line, not a pass.
    - Create .kiro/steering/skeptic-check.md with front matter `inclusion: manual`. It asks the main agent to invoke the skeptic agent on the files named after the command, or on docs/video_script.md and docs/devpost.md when none are named, and to show the report unchanged.
    - No golden value in either file.
    - _Requirements: R6.2, R6.3, R6.5, R7.1, R7.2, R7.3, R7.4, R7.5, R7.6, R7.7, R7.8, R7.9, R7.10_

  - [x] 8.3 Test the wiring and the agent's permissions
    - Create tests/unit/test_skeptic_agent.py. Parse front matter with PyYAML. Assert: name is `skeptic`; tools are exactly "read" plus entries starting with "@" that name ghostline-gtfs (or "@mcp" only as the documented fallback); neither `write` nor `shell` appears and no other tool appears; skeptic-check.md has `inclusion: manual`; mcp.json holds the entry exactly as specified; `.gitignore` has no `.kiro` line.
    - Assert none of the golden tokens appear in skeptic.md or skeptic-check.md (R7.10).
    - Commit: "Add Skeptic agent, steering command and Kiro MCP entry" (stage .kiro/ files and the test).
    - _Requirements: R6.1, R6.2, R6.3, R6.4, R6.5, R6.6, R7.10, R9.5_

- [x] 9. Protocol test
  - [x] 9.1 Write the stdio protocol test (needs_mcp_sdk, must run where the SDK is installed)
    - Create tests/unit/test_mcp_protocol.py marked `needs_mcp_sdk`, with no `skip`, `skipif` or `xfail` inside it. Start `python -m pipeline.mcp_server` as a subprocess with GHOSTLINE_GTFS_ZIP pointing at a path that does not exist. Send initialize and tools/list over stdio. Assert every line of standard output parses as a protocol message and that both tools are listed. Call `feed_info` and assert the reply is flagged as an error (fail closed on the wire). Use timeouts so a hang fails the test and the subprocess is always terminated.
    - Run it and confirm it runs, not skips. If an exception in a tool does not become an error result, change only the wrapper to return the SDK's error result, keep R5.4's contract, and note it in sdk-notes.md.
    - Commit: "Add MCP protocol test".
    - _Requirements: R1.4, R5.4, R9.6_

- [x] 10. Golden tests on the pinned feed
  - [x] 10.1 Write the golden tests for feed_info and trips_serving
    - Create tests/golden/test_mcp_server_golden.py marked `requires_feed`, skipping itself at import with a clear message when raw/ is missing (as the other golden modules do). Load the real zip with the module's own `load_feed`.
    - feed_info: feed_version 20260821, the pinned SHA-256, active services ["2251"].
    - trips_serving "8564" to "9486" on "2026-11-04": 36 trips, all route_short_name "CityLink LIME" and headsign "HARBOR EAST". With after "10:00" and before "13:00": 5 trips with dep_a 10:32:43, 11:08:43, 11:44:43, 12:20:43 and 12:56:43. The last trip of the day leaves at 25:15:53 (known behaviour).
    - Cross-check: the lead race file's today.trips departures inside 10:00 to 13:00 (read from web/public/data/race/ for the lead pair) equal the server's five.
    - Report to Emmanuel the count of dropped blank-time calls logged for the real feed if it is non-zero (design 2.4 step 8).
    - If any computed value differs from a golden value, stop and tell Emmanuel. Never edit a golden value or test to pass.
    - _Requirements: R9.2, R9.3_

  - [x] 10.2 Write the real-server end-to-end test over stdio
    - In the same golden module, start the real server as a subprocess with the real feed, send initialize, then call `feed_info` over stdio and check feed_version and the pinned hash. Wait for the background load with a bounded retry on "feed still loading". Always terminate the subprocess.
    - Commit (after the golden tests pass locally): "Add golden tests for the MCP server".
    - _Requirements: R9.3, R9.6_

- [x] 11. Final check
  - [x] 11.1 Run the full checks and confirm the protocol line
    - Run `python -m pipeline check`, `python -m pipeline verify` and `python -m pipeline check_sources`, each as its own command. All three must pass. Confirm `git status` shows no change under web/ or web/public/data/ (P-F) and no raw/ files staged.
    - Confirm the check output contains "check: MCP SDK installed: the protocol test will run" before and after pytest, and that the protocol test ran and was not skipped.
    - If anything fails, stop and tell Emmanuel with the output. Do not edit a golden value, facts file or test to pass.
    - Commit anything left over: "Finish skeptic spec checks".
    - _Requirements: R9.7_

- [ ] 12. EMMANUEL ONLY: confirm acceptance in the Kiro IDE (R10). The agent must not tick this task or any step in it.
  - Step 1 (R10.1): open the MCP Server view in Kiro. Confirm "ghostline-gtfs" shows as running. In chat, call `feed_info` and a `trips_serving` call with `@ghostline-gtfs`. If the agent cannot see the tools, change the agent's tools entry to `"@mcp"` and nothing else (R6.4), then repeat.
  - Step 2 (R10.2): restart the server from Kiro with a different working directory open, or reconnect the server, and call `feed_info`. It must find the feed.
  - Step 3 (R10.3): type `/skeptic-check` in chat. Confirm it appears as a slash command.
  - Step 4 (R10.4): run `/skeptic-check tests/fixtures/skeptic/planted.md`. Expect MISMATCH on the 38 with evidence that trips_serving gives 36, UNSOURCED on the ridership sentence, and last line "FAIL: 1 MISMATCH, 1 UNSOURCED".
  - Step 5 (R10.5): run `/skeptic-check tests/fixtures/skeptic/clean.md`. Expect every line OK and last line "PASS".
  - Step 6 (R10.7): while doing steps 1 to 5, watch for a connection timeout during the server's startup read of stop_times. If Kiro times out, stop and tell the agent; the fallback is the synchronous read before `run()` (design 2.5).
  - _Requirements: R10.1, R10.2, R10.3, R10.4, R10.5, R10.7_

- [ ] 13. EMMANUEL ONLY: record both runs in docs/kiro-usage.md (R10.6). The agent must not do this.
  - After task 12 passes, add to docs/kiro-usage.md, for each of the two runs: the date, the command, and the report's last line.
  - Check the added text for the words banned for service times (live, real-time, realtime, arriving now, right now). Run `python -m pipeline check_sources` to confirm.
  - Commit: "Record Skeptic fixture runs in kiro-usage".
  - _Requirements: R10.6_

- [ ] 14. EMMANUEL ONLY, after this spec: check the real documents. Not part of "done" for this spec.
  - When docs/video_script.md and docs/devpost.md exist, run `/skeptic-check docs/video_script.md docs/devpost.md` in Kiro chat.
  - Expect the census figure (43%) to be reported UNSOURCED until the census pipeline exists. That is correct.
  - Fix each MISMATCH and UNSOURCED line in the documents (not in the evidence files), then run the command again until the last line is "PASS".

## Notes

- Test sub-tasks are required, not optional: the steering requires example, golden and property tests for every algorithm, so none is marked with `*`.
- Tasks 12 to 14 have no sub-checkboxes and are left out of the dependency graph, so no agent run picks them up.
- The guard in task 3.1 means a skipped protocol test fails the run on this machine. Only an absent SDK skips it, with a visible warning.
- Golden values live only in tests/golden/test_mcp_server_golden.py. Tasks 6.1 and 8.3 read the golden token list from that module instead of retyping it. It lives in tests/golden/golden_tokens.py (created in 6.1), because the golden module skips itself at import when raw/ is missing.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "4.1"] },
    { "id": 4, "tasks": ["3.3", "4.2"] },
    { "id": 5, "tasks": ["4.3"] },
    { "id": 6, "tasks": ["4.4"] },
    { "id": 7, "tasks": ["4.5"] },
    { "id": 8, "tasks": ["4.6"] },
    { "id": 9, "tasks": ["5.1", "6.1", "7.1", "8.1", "9.1"] },
    { "id": 10, "tasks": ["7.2", "8.2"] },
    { "id": 11, "tasks": ["8.3"] },
    { "id": 12, "tasks": ["10.1"] },
    { "id": 13, "tasks": ["10.2"] },
    { "id": 14, "tasks": ["11.1"] }
  ]
}
```
