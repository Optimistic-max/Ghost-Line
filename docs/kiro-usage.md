# How Kiro was used on Ghost Line

A dated log of the moments where Kiro shaped the build, checked against `git log` and the files in `.kiro/`. Anything not recorded in either is marked "†".

## Summary

| Kiro feature | What it did on this project | Proof path |
|---|---|---|
| Specs | Four specs (race-engine, race-screen, story-layer, skeptic), each with requirements, design and tasks, drove the pipeline, the site, the story layer and the fact-checker. | `.kiro/specs/` |
| Steering | Five files (four always on, plus the manual skeptic-check command) hold the honesty rules, stack and layout every task ran under. | `.kiro/steering/` |
| Hooks | Three editor hooks: validate after agent edits, rebuild and test when the agent stops, and a copy-and-source guard on saved web/ and docs/ files. All three are enabled. | `.kiro/hooks/`, 6912b89, ed7a1e0, 5e50b61, 48189c3 |
| Custom agent | The read-only Skeptic checks a document's claims against the feed tools and reports PASS or FAIL. | `.kiro/agents/skeptic.md`, 0a883a7 |
| MCP | `ghostline-gtfs` is an independent GTFS reader (`trips_serving`, `feed_info`) that checks the pipeline without importing it. | `.kiro/settings/mcp.json`, `pipeline/mcp_server.py` |
| Property tests | Hypothesis and fast-check properties run on every algorithm. One caught a real bug: the MCP server's answer depended on row order when a trip repeated a stop_sequence. | 0cfcfe9, `tests/property/` |

† From the chat session; git holds the result, not the exchange.

## Log

| Date | What happened | Kiro feature | Why it mattered | Where to see it |
|---|---|---|---|---|
| 2026-11-15 | Product, structure, tech and UI steering files were committed with the facts files and planning briefs, before any spec existed; the briefs were written with Claude Code, not Kiro. | Steering | Every later spec and task ran under the same honesty, data and stack rules. | 44523d1, .kiro/steering/ |
| 2026-11-15 | The race-engine spec was built from docs/planning/race-brief.md as requirements, then design, then tasks, with the steering files already in place. | Specs (requirements-first flow) | The brief's algorithms and expected values became tracked requirements and tasks. | f163589, .kiro/specs/race-engine/ |
| 2026-11-15 | Requirements review: the rule that a golden-value mismatch stops and reports, never edits the value, is in requirements.md, as is 8,409.9 m from race-brief.md 5.8; the review exchange and the tracing itself are not in git †. | Specs (requirements review) | The stop-and-report rule is what later caught the walk-formula mismatch. | f163589, .kiro/specs/race-engine/requirements.md |
| 2026-11-15 | Design review: next_today in design.md returns NO_ONE_SEAT_RIDE for no trips and NO_MORE_TRIPS_TODAY for no catchable trips, as in brief 5.2; the check against 5.2 and 5.4 during review is not in git †. | Specs (design review) | An empty trip list and a missed last trip can no longer be confused. | f163589, .kiro/specs/race-engine/design.md |
| 2026-11-15 | Task review: in the committed tasks.md each module task names its own golden test file and every task depends only on earlier tasks; that Kiro moved the golden tests from the end is not in git †. | Specs (task review) | Each module is checked against real values as it is built, and tasks can run in order. | f163589, .kiro/specs/race-engine/tasks.md |
| 2026-11-17 | CLI stubs were made to exit non-zero, with tests asserting it for all five commands. | Spec task execution | A hook can never mistake an unbuilt command for a pass. | 597e957, tests/unit/test_cli_stubs.py |
| 2026-11-17 | Kiro applied the 24 corrections B1-B24 from the Block B review to the spec, then the finished-file fixes and the .gitattributes rule; its revert of an over-edit of completed tasks is not in git †. | Specs (spec update), spec task execution | The spec and the finished files describe the same changes before more code was written. | b3b7baf, a28122d, dd09e6b, 69f74db, docs/planning/blockB-fixes.md |
| 2026-11-17 | Correction tasks were marked done in separate commits and then renumbered; that the task tracker could not see them and Kiro refused to skip a dependency is not in git †. | Task tracker, spec tasks | Dependencies stayed intact instead of being skipped to keep moving. | eb12dab, 33575c8, 7d5aa5b, .kiro/specs/race-engine/tasks.md |
| 2026-11-17 | Three editor hooks were added, all with enabled set to false until their commands exist (enabled on Nov 17 and Nov 18: see the dated rows below); the correction of Kiro's createHook output to the documented schema is not in git †. | Agent hooks | Hooks cannot fire against stub commands and report false passes. | 6912b89, .kiro/hooks/ |
| 2026-11-17 | The pinned MTA feed's SHA-256 was checked by feed_check. | Spec task execution | Every computed number comes from one known feed file. | e8a5c15, pipeline/feed_check.py |
| 2026-11-17 | The facts loader and 1938 clock were built and every clock golden value matched. | Spec task execution, golden tests | The 1938 side of the race matches the timetable values in the brief. | 321dc90, tests/golden/test_clock_golden.py |
| 2026-11-17 | Walk-formula unit test case 2 missed by 0.000514 min against a 0.0005 tolerance; Kiro stopped instead of changing the value. The brief paired a rounded input (230.15 m) with the result from stop 9486's real distance (230.153500791945 m). Emmanuel chose to correct the test input's expected value to 4.155 and the golden test now confirms the real stop gives 4.156. | Spec task execution, golden tests | The stop-and-report rule worked on a real mismatch, and no golden value was edited to pass. | b418bba, tests/unit/test_stops.py, tests/golden/test_stops_golden.py |
| 2026-11-17 | When the task-status tool was unavailable, the task orchestrator would not dispatch or write the code itself and reported the blocker; work resumed after the task was re-run. | Spec task orchestration | Kiro did not bypass its own task workflow to finish faster. | Chat session only, not in git (then b418bba) |
| 2026-11-17 | The validate-after-agent-edit and rebuild-and-test-when-agent-stops hooks were enabled once `validate` and `check` existed. | Agent hooks | Two of the three hooks now run in the editor; they are no longer disabled. | ed7a1e0, 5e50b61, .kiro/hooks/ |
| 2026-11-18 | The copy-and-source-guard hook was enabled, and the Stop hook was pointed at `check --quick`. All three hooks are now enabled. | Agent hooks | Saving a web/ or docs/ file runs `check_sources`; a banned word or unsourced number fails the save. | 48189c3, d9c9dcb, .kiro/hooks/ |
| 2026-11-18 | Race-screen spec: requirements, design and tasks written one after another, with the design decisions folded back into the requirements. | Specs (requirements-first flow) | The screen's copy, layout and states became tracked requirements before any site code existed. | 57afcf5, 5ddc710, 450e95b, 74ab081, .kiro/specs/race-screen/ |
| 2026-11-19 | Race-screen tasks from 1 onward built the site, one task per commit: scaffold, data types, lookups, formatting, vehicles, card, timeline, picker, states and route drawing. | Spec task execution | The site was built to the spec's tasks, each with tests. | ecf075a, ffd4951, 85c4616, b95c1d7, .kiro/specs/race-screen/tasks.md |
| 2026-11-20 | Race-screen tasks 20 to 23 added the Playwright tests, the size budget, the deploy workflow and the first-race measurement. The task 23 run: 816 site tests, 41 browser tests passed, 67.5 KB of the 100 KB budget. | Spec task execution | The first screen stays under budget and the deploy is a workflow in git. | c8498b4, 8345421, c282663, 2801898, e7827a5 |
| 2026-11-20 | Story-layer spec: pipeline tasks 1.1 to 1.10 added `wait_most` and `ride_same_rule` to the data, then site tasks 3 to 5 added constants, state and the guided first visit. | Specs, spec task execution | The story the visitor sees is data from the pipeline, not text typed into the page. | 2208b69, 4aaea44, 11f7fc3, 87ebb2e, cdfcd61, .kiro/specs/story-layer/ |
| 2026-11-21 | Story-layer tasks 7 to 21 built captions, markers, the takeaway, the start-time chart, notices, next steps, the departures section, the phone page flow, the route strip, and the rule, browser and layout tests. | Spec task execution | Each part has tests that read the real summary.json, so no count is typed into the code. | 40f971b, 6143aad, 76dadae, ccd8e7f, 4cea529, 158f338, ce19bd3, .kiro/specs/story-layer/tasks.md |
| 2026-11-22 | Story-layer tasks 23 to 25 (Nov 21 to 22): final checkpoint, the result-visibility fix and 14 friction fixes from the first human test, ending with `npm run typecheck` in the deploy workflow. | Spec task execution | A type error now stops the deploy. | e8bdfd9, 0dcf67d, 9bb07d4, 76c1314 |
| 2026-11-22 | Skeptic spec: the Hypothesis generator could give one trip two calls with the same stop_sequence, and the shuffle property found that the MCP server's answer then depended on row order. The server now rejects a repeated stop_sequence as a feed format error, with a unit test, and the generator makes unique sequence numbers. That the shuffle property was the failing one is reported in the chat session, not in git †. | Spec task execution, property tests | The independent checker gives one answer for a feed or an error, never an answer that depends on row order. | 0cfcfe9, pipeline/mcp_server.py, tests/property/test_mcp_server_props.py, tests/unit/test_mcp_server.py |
| 2026-11-22 | Skeptic spec: the token test, which fails if a golden value from tests/golden/golden_tokens.py appears in the Skeptic agent or its steering file, caught a golden value in the draft of .kiro/agents/skeptic.md, and it was removed before the commit. The catch is reported in the chat session; git holds only the passing test and the clean agent file †. | Custom agent, spec task execution | The Skeptic has to get every number from the feed tools, so it cannot pass a document by matching a number it was told. | 0a883a7, tests/unit/test_skeptic_agent.py, .kiro/agents/skeptic.md |

## Skeptic acceptance in the Kiro IDE (skeptic tasks 12 and 13)

Run by Emmanuel in the Kiro IDE on Nov 22, 2026 and reported by him; the chat output is not in git †.

| Date | Command or check | Result (the report's last line, for the two fixture runs) |
|---|---|---|
| 2026-11-22 | ghostline-gtfs server in the MCP Server view; `feed_info` (R10.1) | Server running. feed_version 20260821, the pinned SHA-256, service_date 2026-11-04, active service 2251. |
| 2026-11-22 | `trips_serving` for stops 8564 and 9486 on 2026-11-04 (R10.1) | 36 trips, all CityLink LIME to HARBOR EAST. |
| 2026-11-22 | `/skeptic-check tests/fixtures/skeptic/planted.md` (R10.3, R10.4) | FAIL: 1 MISMATCH, 1 UNSOURCED (38 against the 36 from trips_serving; the ridership sentence unsourced) |
| 2026-11-22 | `/skeptic-check tests/fixtures/skeptic/clean.md` (R10.5) | PASS |
| | Server restarted with a different working directory, then `feed_info` (R10.2) | Not run. |
| | No connection timeout during the server's startup read of stop_times (R10.7) | Not reported separately; the tool calls above answered. |

## Final timing checks (race-screen task 23.4)

Run before submission, on Nov 20, 2026, each on its own, as the task requires (R17.7). Where git or `.kiro/` cannot show a result, it is marked "†".

| Check | Result | Run by | Where to see it |
|---|---|---|---|
| `python -m pipeline check --timing` (the pipeline's 10 s validate and 60 s build limits) | Passed: 3 passed, on a quiet machine. Reported by Emmanuel; the run's output is not in git †. | Emmanuel | The three `timing` tests: `tests/golden/test_build_golden.py`, `tests/test_integration.py`, `tests/unit/test_cli_validate.py` |
| `npm run perf` on the deployed site, https://optimistic-max.github.io/Ghost-Line/ (first race, `race-start` mark, five cold loads, slow 4G and a 4x slower processor, map tiles blocked) | Median 1,738 ms against the 5,000 ms limit; runs 1,667, 1,876, 1,884, 1,738 and 1,696 ms. Run by Kiro from Emmanuel's machine after the first deploy. | Kiro, at Emmanuel's request | `web/tests/e2e/perf.spec.ts`, `web/tests/e2e/perf-config.ts`, c282663 |
| `npm run perf` on the deployed site after the story layer (same settings as the row above) | Nov 21, 2026: median 1,379 ms against the 5,000 ms limit; runs 3,889, 1,309, 1,292, 1,379 and 1,577 ms. Reported by Emmanuel; the run's output is not in git †. | Emmanuel | `web/tests/e2e/perf.spec.ts` |
| First race on a real phone, on mobile data | Nov 20, 2026: Emmanuel's Android phone on mobile data, on the deployed site. The race played and the real map loaded. No time was recorded, so there is no race-start number for this row; the steps are in `web/README.md`. Reported by Emmanuel †. | Emmanuel | |

Note on the second row: Emmanuel's note described this measurement as a Lighthouse run. It was made with `npm run perf`, which drives the browser's own throttling through Playwright; Lighthouse was not approved for this project (requirements R16.2), so it is recorded here as the Playwright run.
