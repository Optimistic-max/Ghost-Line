# How Kiro was used on Ghost Line

A dated log of the moments where Kiro shaped the build, checked against `git log` and the files in `.kiro/`. Anything not recorded in either is marked "†".

## Summary

| Kiro feature | What it did on this project | Proof path |
|---|---|---|
| Specs | Five specs (race-engine, race-screen, story-layer, skeptic, ghost-cars), each with requirements, design and tasks, drove the pipeline, the site, the story layer, the fact-checker and the ghost cars. | `.kiro/specs/` |
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

## Story-layer checkpoint: pipeline phase (story-layer task 2)

Recorded on Nov 23, 2026 by Kiro, on the committed data at 193f684, with `raw/` present and its SHA-256 matching the pin. The task was ticked on Nov 22; this is the record that backs the tick.

| Check | Result |
|---|---|
| Lead pair, Preston & Caroline to Aliceanna & Bond, `10:00` row: `wait_most` | `true` (1938 wait 6, today's wait 30.458, result 1938, margin 30.156) |
| Comparison (task 1.8 rule): every committed race file against 2208b69^, the commit before the story-layer pipeline, with `wait_most` dropped from each row; `summary.json` with `ride_same_rule` and `sources.ride_same_rule` dropped; `index.json` and `route.geojson` byte for byte | 20 race files compared; no differences |
| `python -m pipeline validate` | OK |
| `python -m pipeline build` | OK; 23 files written; every file under its gzip limit; the data matched the committed files |
| `python -m pipeline verify` | OK: web/public/data matches a fresh build |
| `python -m pipeline check_sources` | OK |
| `python -m pipeline check` (build, then pytest) | Build OK. pytest: 891 passed, 1 failed, 3 timing tests deselected, in 19 min 28 s on a busy machine. The failure was `tests/golden/test_mcp_server_golden.py::test_the_real_server_over_stdio_answers_with_the_real_feed`: the server gave no answer to `initialize` within the test's 30 s. Run again on its own, that file passed: 8 passed in 71 s. |

## Polish brief P4: phone headline, test runs (Nov 23, 2026)

Run by Kiro while a film render loaded the laptop. A test that failed only by its time limit was run again on its own; both runs are listed. No time limit was raised.

| Check | First run | Run again on its own |
|---|---|---|
| Phone fit, 375 x 667, worst of 3 stable runs (fonts ready, route strip drawn, two still frames), with the ghost-cars counter line counted (12 px line plus 2 px margin) | 19.4, 19.4 and 19.4 px to spare against the 16 px target: pass | |
| Phone fit, 390 x 844, same method | 196.4, 196.4 and 196.4 px to spare: pass. An earlier run of the same test, before the method above, gave 188.6 px once | |
| `npx tsc --noEmit` | pass | |
| `npm test` (vitest) | 936 passed, 5 failed. One was real: the copy-table test had no template for the new phone headline row, fixed. One was real: a phone-only `max-width` media query broke the one-breakpoint rule, fixed by moving the desktop values into layout-desktop.css. Three were 5 s time limits in `maplabels.test.ts` and `routestrip.test.ts` | `routestrip.test.ts`: 5 passed. `maplabels.test.ts`: 2 time limits again, then 10 passed in 9.2 s on a third run; the same file at the last commit passed in 19.5 s |
| `npm run test:e2e` and the checkpoint spec | 131 passed, 3 skipped, 6 failed: five 30 s time limits in race.spec.ts (sideways scroll, story with no map on both projects, desktop pair names, page logs no errors) and `still: og-1200x630` with the map unavailable | The five race.spec tests: all passed. `still: og-1200x630`: map unavailable again, then passed |
| `npm run screens` | 50 passed, 1 failed: `16-desktop-todaywins` at its 30 s time limit | passed |

## Ghost cars (polish brief P6, ghost-cars spec), Nov 23, 2026

Built by Kiro from docs/planning/final/08-ghost-cars-brief.md, as the ghost-cars spec (requirements, design, tasks). Run while a film render loaded the laptop; a test that failed only by its time limit was run again on its own and both runs are listed. No time limit was raised.

**Golden (Req 7.1):** the lead pair at 10:00 gives n = 4, cars at 10:06, 10:13, 10:21 and 10:28, the bus at 10:32:43: matches the brief.

**Emmanuel's changes during the build:** the finished counter reads "{n} 1938 trolleys were scheduled here before today's bus." (the brief's sentence took two lines). It fits one line: 343.0 x 16.2 px in the phone card, 383.0 x 16.2 px in the desktop column.

**Found and fixed while making the pictures:**
- On a phone, "View route" drew the route drawing for the 100 px strip's height and then stretched it to 150 px, so the trolley markers stood off the route. The area's height is now set before the drawing is made. This also affected the race's own marker before this spec.
- On the 100 px strip the map line covered the destination dot and name (screens 02-racing), and two cars on the stretch stood about 17 px apart. The strip shows no ghost car and no map line; "View route", the map and desktop show them (design decision 5).

**Real-data sweep (Req 7.4):** n at 10:00 for each pair, and whether 10:00 is a Ghost_Row. 102 rows, all between 13:36 and 13:52, have a bus that leaves after the last listed 1938 pass, so they show no counter and no ghost cars (correct, Emmanuel, Nov 23). The list is in web/test-results/ghost-cars-sweep.md, written by web/tests/real/ghosts.test.ts.

| Pair | n at 10:00 | Ghost_Row |
| --- | --- | --- |
| westwood-carey to dolphin-myrtle | 2 | yes |
| westwood-carey to brevard-preston | 2 | yes |
| westwood-carey to preston-caroline | 2 | yes |
| westwood-carey to aliceanna-bond | 2 | yes |
| dolphin-myrtle to westwood-carey | 1 | no |
| dolphin-myrtle to brevard-preston | 3 | yes |
| dolphin-myrtle to preston-caroline | 3 | yes |
| dolphin-myrtle to aliceanna-bond | 3 | yes |
| brevard-preston to westwood-carey | 0 | no |
| brevard-preston to dolphin-myrtle | 0 | no |
| brevard-preston to preston-caroline | 3 | yes |
| brevard-preston to aliceanna-bond | 3 | yes |
| preston-caroline to westwood-carey | 5 | yes |
| preston-caroline to dolphin-myrtle | 5 | yes |
| preston-caroline to brevard-preston | 2 | yes |
| preston-caroline to aliceanna-bond | 4 | yes |
| aliceanna-bond to westwood-carey | 2 | yes |
| aliceanna-bond to dolphin-myrtle | 4 | yes |
| aliceanna-bond to brevard-preston | 4 | yes |
| aliceanna-bond to preston-caroline | 4 | yes |

| Check | First run | Run again on its own |
|---|---|---|
| Phone fit with the counter in place, worst of 3 stable runs | 375 x 667: 19.5, 19.5 and 19.5 px to spare; 390 x 844: 196.5 px each: pass | |
| Counter height while counting, start to bus departure | 16.2 px throughout on both layouts (one line): pass | |
| `npx tsc --noEmit` | pass | |
| `npm test` | 949 passed, 4 failed: two copy-table failures were real (the replaced brief sentence was not dropped from the ghost-cars table; fixed in tests/support/copytable.ts), two were 5 s time limits in maplabels.test.ts | maplabels.test.ts: 1 time limit with the copy-table file, 2 alone, then 10 passed in 11.7 s |
| `npm run check:size` | 76.7 KB of 100 KB: pass | |
| Browser suites, phone, laptop, checkpoint and screens | 180 passed, 3 skipped, 10 failed: nine 30 s time limits or slow-machine steps in race.spec.ts, and screens 02-racing (real: the map line over the strip, fixed above) | the nine race.spec tests: 13 passed (both projects); 02-racing, ghost-cars stills, phone fit: 6 passed |
| Browser suites again after the strip fix, phone, laptop, checkpoint | 132 passed, 3 skipped, 5 failed, all 30 s time limits | the five: 6 passed (both projects) |

## Skeptic on the real documents (polish brief P7, skeptic task 14), Nov 23, 2026

Run by Kiro through the `skeptic` agent on README.md, docs/devpost.md and docs/video_script.md. The text was fixed between runs; no data was changed.

| Run | README.md | docs/devpost.md | docs/video_script.md |
|---|---|---|---|
| 1 | FAIL: 0 MISMATCH, 5 UNSOURCED | FAIL: 0 MISMATCH, 8 UNSOURCED | FAIL: 0 MISMATCH, 4 UNSOURCED |
| 2 | FAIL: 0 MISMATCH, 1 UNSOURCED | FAIL: 0 MISMATCH, 6 UNSOURCED | FAIL: 0 MISMATCH, 5 UNSOURCED |

**Real catches from these runs:**
- This log said "Four specs" after the ghost-cars spec made five. Fixed in the summary table.
- The drafts named the Enoch Pratt Free Library as the scanner of the 1938 guide. No evidence file says so; the text now names Digital Maryland, which publishes the scan.
- "No server, no accounts, no tracking" was not in the evidence; the text now says only what product.md rule 11 says.

**Still UNSOURCED after run 2, for Emmanuel:** facts that only he holds, plus three sentences reworded since:
- the race film: its length (30.1 s), its Google tiles (26.1 s), its lower third, and that it is driven by the same scheduled data;
- Codex's part in the planning (this log names Claude Code only);
- that Kiro Powers and Kiro Crew were not used;
- the idea that any city with an old timetable could run the same race;
- reworded after run 2, not yet re-checked: "The 1938 trolley is gone" (tagline), "gone from Baltimore" (video), "corrected by hand" (hooks).

Skeptic task 14 stays open until each document gives PASS.

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
