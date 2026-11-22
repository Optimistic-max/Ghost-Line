# Requirements Document

Skeptic: Requirements

## Introduction

Build a read-only reviewer agent, the Skeptic, and a small MCP server that gives it an independent view of the pinned MTA feed. The Skeptic checks every number and claim in the video script and the Devpost text against the project's evidence. It recounts bus trips straight from the feed through the MCP server, which has its own reader. The person who wrote a claim is not the one who checks it.

The source is docs/planning/skeptic-brief-v2.md (Nov 22). It replaces docs/planning/skeptic-brief.md (Nov 15), which stays in the repo as history. This spec cites only v2. Follow the steering files (product.md, tech.md, structure.md, ui.md).

Status: requirements for review. Nothing is designed or built yet.

## Decisions already made (Emmanuel, Nov 22)

- Spec directory: .kiro/specs/skeptic/.
- Agent tools: `["read", "@ghostline-gtfs"]`. Fall back to `"@mcp"` only if Kiro does not expose the server's tools to the agent.
- The server reads stop_times at startup and keeps it in memory. It writes no cache to disk, so the first tool call is never slow.
- "Done" is scoped to the two fixtures, clean.md and planted.md. Running /skeptic-check on docs/video_script.md and docs/devpost.md is a later step for Emmanuel, listed at the end of tasks.md.
- Checks that only the Kiro IDE can run are acceptance criteria for Emmanuel to confirm (R10). They are not marked done by the agent.
- The MCP SDK dependency is pinned `mcp>=1.27,<2` in an optional dependency group "skeptic". Installing it is an approved network step, but Emmanuel is asked once more immediately before it runs.
- tech.md now says Python ">=3.12 (developed and tested on 3.14)". Done.

## Glossary

- **Server**: pipeline/mcp_server.py, started as `python -m pipeline.mcp_server`.
- **Skeptic**: the agent defined in .kiro/agents/skeptic.md.
- **Pinned feed**: raw/mta_local_bus.zip, SHA-256 8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694, feed_version 20260821, service date 2026-11-04, active service_id 2251 (tech.md).
- **Evidence**: the files and tool answers the Skeptic may cite (R7.2).
- **Golden values**: the expected results in R9.2 and R9.3. They are test targets only.

## Principles (these outrank the detailed requirements)

- **P-A. Independence.** The server checks the pipeline, so it shares no code with it (structure.md). The only thing the two share is the pinned hash, and a test keeps the two copies equal.
- **P-B. Fail closed.** If the feed is missing, has the wrong hash, or the request is malformed, the answer is an error. It is never an empty or partial result.
- **P-C. Read only.** The Skeptic cannot write a file or run a command. The server writes nothing to disk.
- **P-D. Golden values are targets, not code.** The expected values appear only in golden tests and in this spec. They never appear in pipeline/mcp_server.py, the agent's instructions, or the steering file. If a computed value differs from a golden value, stop and tell Emmanuel. Never edit a golden value, a facts file or a test to make a check pass (product.md).
- **P-E. No network at run time.** The server makes no network call. No AI model runs in the deployed app: the Skeptic and the server run only in the editor (product.md rule 11).
- **P-F. Do not change the product.** This spec changes no pipeline output and nothing under web/.

## Requirements

### R1. MCP server: transport, start and configuration

**User story:** As Emmanuel, I want a local MCP server for the pinned feed, so that Kiro can recount bus trips without trusting the pipeline.

- **R1.1** The server uses the official Python MCP SDK over stdio transport. Before writing it, its current documentation is checked (tech.md).
- **R1.2** The server starts with `python -m pipeline.mcp_server`.
- **R1.3** The feed path is the environment variable GHOSTLINE_GTFS_ZIP when set. When unset, it is raw/mta_local_bus.zip resolved from the repository root (the parent of pipeline/), never from the current directory.
- **R1.4** Standard output carries only protocol messages. Logs go to standard error.
- **R1.5** The server writes no file, cache or log to disk.
- **R1.6** The server makes no network call.
- **R1.7** The SDK is added to pyproject.toml as the optional dependency group "skeptic", pinned `mcp>=1.27,<2`. It is not added to the base or dev dependencies, so the hosted build and a plain `pip install` do not need it.
- **R1.8** Installing the SDK needs Emmanuel's approval immediately before it runs, even though the pin is already approved.

### R2. Independence and feed integrity

**User story:** As a reviewer, I want the server to be independent of the code it checks, and to refuse a wrong feed.

- **R2.1** The server reads the feed with its own minimal reader built on the standard library (zipfile and csv). It imports no pipeline module: not eligible, race, stops, gtfs_reader, emit, feed_check, or any other.
- **R2.2** The server keeps its own copy of the pinned SHA-256. A test asserts that this value equals `pipeline.feed_check.PINNED_FEED_SHA256`.
- **R2.3** At startup the server computes the zip's SHA-256. If the zip is missing or the hash differs from the pinned value, the server still starts, and every tool returns an error that says which of the two it is. It never returns an empty result in that case. The server never downloads a feed (tech.md).
- **R2.4** The server reads the tables it needs, including stop_times.txt (about 68 MB), once at startup and keeps them in memory. It writes no cache. Tool calls after startup read only memory and are fast.
- **R2.5** An AST scan test of pipeline/mcp_server.py finds no import of any pipeline module.

### R3. Tool: feed_info

**User story:** As the Skeptic, I want to confirm which feed I am looking at.

- **R3.1** `feed_info()` returns feed_version, sha256, service_date "2026-11-04", and active_service_ids.
- **R3.2** Active service ids are computed from calendar.txt and calendar_dates.txt for 2026-11-04. They are not typed into the server.
- **R3.3** When the feed check of R2.3 fails, `feed_info()` returns that error.

### R4. Tool: trips_serving

**User story:** As the Skeptic, I want to count the scheduled one-seat trips between two stops, so that I can check a claim such as "36 scheduled one-seat buses".

- **R4.1** `trips_serving(stop_a, stop_b, date, after=None, before=None)` returns `{count, trips}`. Each trip is `{trip_id, route_short_name, headsign, dep_a, arr_b}`.
- **R4.2** `stop_a` and `stop_b` are GTFS stop_id strings. `date` must be "2026-11-04".
- **R4.3** A trip counts once. It is counted at its first call at stop_a that has a later call (higher stop_sequence) at stop_b. A trip that calls at stop_a twice is still one trip.
- **R4.4** Only trips whose service is active on the date count.
- **R4.5** `dep_a` is the departure at stop_a and `arr_b` the arrival at stop_b, as the feed's own HH:MM:SS. Hours may pass 24 (for example 25:15:53).
- **R4.6** `after` and `before` are optional "HH:MM" limits on dep_a. Both are inclusive. They are compared as GTFS times, so hours past 24 compare correctly.
- **R4.7** Results are sorted by dep_a, then trip_id. `count` equals the length of `trips`.
- **R4.8** Route and headsign are the feed's own spelling (for example "CityLink LIME" and "HARBOR EAST"). Display-name matching is the Skeptic's job (R7.5), not the server's.

### R5. Errors

- **R5.1** Any date other than "2026-11-04" is an error that names the date and the one supported date.
- **R5.2** An unknown stop_id is an error that names the stop.
- **R5.3** A malformed `after` or `before` is an error that names the value.
- **R5.4** An error is returned as an error. It is never an empty trip list or a count of zero.

### R6. Kiro wiring

**User story:** As Emmanuel, I want Kiro to start the server and the agent to use it.

- **R6.1** .kiro/settings/mcp.json registers the server as "ghostline-gtfs": command `python`, args `["-m", "pipeline.mcp_server"]`, env GHOSTLINE_GTFS_ZIP "raw/mta_local_bus.zip", disabled false. If the file already exists, only this entry is added.
- **R6.2** .kiro/agents/skeptic.md is a markdown file with YAML front matter: name `skeptic`; a description saying it is a read-only fact checker that is given file paths and reports each claim as OK, MISMATCH or UNSOURCED with evidence; tools `["read", "@ghostline-gtfs"]`.
- **R6.3** The agent has no write tool and no shell tool. A test reads the front matter and fails if `write` or `shell` appears, or if any tool other than `read` and the server's tools appears.
- **R6.4** If Kiro does not expose the server's tools to the agent, the tools entry is changed to `"@mcp"` and nothing else is widened. This is confirmed in R10.1.
- **R6.5** .kiro/steering/skeptic-check.md has front matter `inclusion: manual`. It asks the main agent to invoke the skeptic agent on docs/video_script.md and docs/devpost.md, or on the files named after the command, and to show the report unchanged. It is used as /skeptic-check in chat.
- **R6.6** The files in .kiro/ are committed with the change and .kiro/ never appears in .gitignore (structure.md).

### R7. The Skeptic's instructions

**User story:** As a reader of the video script or Devpost text, I want each claim checked against evidence by something that did not write it.

- **R7.1** The Skeptic checks every number, date, time, count, source name and factual sentence in the files it is given.
- **R7.2** Evidence, in this order: web/public/data/index.json, summary.json, race/*.json and route.geojson; data/lines/no21-1938.yaml; web/src/copy/copy.ts (what the screen says); docs/kiro-usage.md (claims about how Kiro was used); for bus trips and times, the ghostline-gtfs tools.
- **R7.3** The output is one line per claim: `OK | MISMATCH | UNSOURCED - <the claim, quoted> - <evidence: file and field, or tool call and its answer>`.
- **R7.4** MISMATCH means the evidence says something else, and the line quotes the evidence's value. UNSOURCED means no evidence file holds the claim. A number computed elsewhere, such as a census share that is not in web/public/data, is UNSOURCED.
- **R7.5** Matching rules: a whole-minute figure matches a stored value that rounds to it; "about" allows one minute; names match case-insensitively (CityLink LIME equals CityLink Lime; HARBOR EAST equals Harbor East).
- **R7.6** The honesty rules of product.md count as evidence. A banned word for service times (live, real-time, realtime, arriving now, right now), or the word "citywide", is a MISMATCH against product.md. The fixed phrase "Scheduled, not live." is the one exception.
- **R7.7** The last line is "PASS" when every line is OK, and otherwise "FAIL: <n> MISMATCH, <m> UNSOURCED".
- **R7.8** The Skeptic never edits a file, never proposes a replacement number as fact, and never guesses.
- **R7.9** The Skeptic knows the current wording and fields: the honest line "races (every start time the 1938 timetable covers, at all 20 pairs of corners)", the ride rule `summary.ride_same_rule`, and the race-row field `wait_most`. Each is read from the evidence files at check time. None of their values is typed into the instructions.
- **R7.10** The instructions contain no golden value (P-D).

### R8. The planted-error fixtures

**User story:** As Emmanuel, I want proof that the Skeptic catches a wrong number and an unsupported sentence, and passes a clean one.

- **R8.1** tests/fixtures/skeptic/clean.md is a short script excerpt whose every claim is in the evidence. It includes the sentence "36 scheduled one-seat buses from Biddle St & Caroline Ave to Caroline St & Eastern Ave on the Wed Nov 4, 2026 weekday schedule" and the sentence "1938 wins by 30 minutes at 10:00 AM (Preston & Caroline to Aliceanna & Bond)".
- **R8.2** tests/fixtures/skeptic/planted.md is the same file with exactly two changes: 36 becomes 38, and one new sentence with no source is added: "Ridership on the No. 21 doubled in 1938."
- **R8.3** Both files live in tests/fixtures/skeptic/ and nowhere in docs/. They are never shipped, and `check_sources` and the editor hooks never scan them.
- **R8.4** A pytest test checks that the two files differ in exactly those two places.
- **R8.5** The fixture sentences carry no wording banned by product.md.

### R9. Tests

Every algorithm has example tests, golden tests and property tests (tech.md). Golden tests skip with a clear message when raw/ is missing, so the hosted build passes. They must pass locally before any commit touching pipeline/ or data/.

- **R9.1** Unit tests use the fake feed in tests/fixtures/fake-gtfs, zipped into a temporary file, with a test-only pinned hash. They cover:
  - a missing zip, a wrong hash, a wrong date, an unknown stop and a malformed time: each gives an error and never an empty list;
  - inclusive `after` and `before` limits;
  - a departure after 24:00;
  - a trip that calls at stop_a twice;
  - the stop_sequence order (a trip that reaches stop_b before stop_a is not counted);
  - ordering by dep_a, then trip_id;
  - an inactive service is not counted.
- **R9.2** Golden test, feed_info: feed_version 20260821, the pinned SHA-256, and active services ["2251"].
- **R9.3** Golden test, trips_serving on the pinned feed:
  - stops "8564" to "9486" on "2026-11-04" give 36 trips, every one with route_short_name "CityLink LIME" and headsign "HARBOR EAST";
  - with after "10:00" and before "13:00", the same pair gives 5 trips, with dep_a 10:32:43, 11:08:43, 11:44:43, 12:20:43 and 12:56:43;
  - the lead race file's today.trips entries inside 10:00 to 13:00 have the same five departures. This is the independence check between the server and the pipeline.
- **R9.4** Property tests (Hypothesis, on generated small feeds): every returned trip has dep_a before arr_b by sequence order; results are sorted; `count` equals the number of trips; widening the `after`/`before` window never removes a trip.
- **R9.5** Independence test (R2.5), hash test (R2.2) and agent-permissions test (R6.3).
- **R9.6** Protocol test: start the server as a subprocess, send initialize and tools/list over stdio, and check that standard output holds only protocol messages and that both tools are listed. This test skips with a clear message when the "skeptic" dependency group is not installed.
- **R9.7** The existing checks keep passing: `python -m pipeline check`, `verify` and `check_sources`.

### R10. Acceptance in Kiro (confirmed by Emmanuel, not by the agent)

These need the IDE. The agent writes the steps and leaves them unchecked. Emmanuel confirms each.

- **R10.1** The server shows as running in the MCP Server view, and both tools answer in Kiro's chat. The agent can see the tools with `@ghostline-gtfs`; if it cannot, R6.4 applies. (brief 6.1)
- **R10.2** The server finds the feed when Kiro starts it, whatever Kiro's working directory is. (brief 6.2)
- **R10.3** /skeptic-check appears as a slash command in this Kiro version. (brief 6.5)
- **R10.4** `/skeptic-check tests/fixtures/skeptic/planted.md` reports MISMATCH on the 38, with the evidence that trips_serving gives 36, and UNSOURCED on the ridership sentence. Its last line is "FAIL: 1 MISMATCH, 1 UNSOURCED".
- **R10.5** `/skeptic-check tests/fixtures/skeptic/clean.md` ends with "PASS".
- **R10.6** Both runs are recorded in docs/kiro-usage.md: date, command, and the report's last line. The record contains no banned wording for service times.
- **R10.7** The startup read of stop_times does not make Kiro's connection to the server time out. If it does, stop and tell Emmanuel.

## Expected report on the fixtures

| File | Expected result |
| --- | --- |
| clean.md | Every line OK, last line PASS |
| planted.md | MISMATCH on the 38 (evidence: trips_serving gives 36); UNSOURCED on the ridership sentence; last line "FAIL: 1 MISMATCH, 1 UNSOURCED" |

## Known behaviour to expect

- Until the census pipeline exists, the Devpost and video drafts' "43%" census figure is reported UNSOURCED. That is correct.
- GTFS times pass 24:00. On Nov 4 the last 8564-to-9486 trip leaves at 25:15:53.
- No departure falls exactly on 10:00 or 13:00, so an inclusive and an exclusive window give the same five trips. The requirement stays inclusive.

## Out of scope

- Any change to the pipeline's outputs or the site.
- Writing the video script or the Devpost text.
- A Kiro power.
- Any network call by the server.
- Running /skeptic-check on docs/video_script.md and docs/devpost.md. These files do not exist yet. It is a later step for Emmanuel, listed at the end of tasks.md.
- Reading a real-time or vehicle-position feed (tech.md).

## Dependencies and open points

- The SDK install (R1.8) is the only new dependency and the only network step. It is confirmed with Emmanuel immediately before it runs.
- The MCP SDK's stable line is 1.x and v2 is in alpha, hence the `<2` bound. Its classifiers stop at Python 3.13, though its maintainers report it works on 3.14. Python 3.14 is in range of pyproject's `>=3.12`. The install step checks that the SDK imports on this machine.
- docs/kiro-usage.md exists and is edited only for R10.6.
