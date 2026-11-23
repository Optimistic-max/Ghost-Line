# Ghost Line

*Baltimore's 1938 trolley timetable, raced against today's scheduled bus.*

At 10:00 on a weekday, Baltimore's 1938 No. 21 trackless trolley, an electric bus that ran on two overhead wires, was scheduled to get you from Preston & Caroline to Aliceanna & Bond in 15 minutes. Today's scheduled bus takes 45, walking included. The ride is about as long. The wait is not.

Ghost Line brings back Baltimore's 1938 No. 21 trackless trolley and races its timetable, minute by minute, against today's scheduled bus between the same two corners, walking included. Today's riders at these corners have the CityLink Lime, on the weekday schedule as of Nov 4, 2026.

**Category:** Resurrection · **Built with:** Kiro · **Site:** https://optimistic-max.github.io/Ghost-Line/ · **Code:** https://github.com/Optimistic-max/Ghost-Line

## What it found

- **Same ride, longer wait.** Across this line's 20 pairs of corners, the 1938 trolley gets there first in 5,582 of 5,666 scheduled races. Today wins 25, and 59 are photo finishes (under a minute apart).
- **The ride is not the problem.** On 17 of the 20 pairs today's scheduled ride is about as long as in 1938; on 3 it is faster.
- **The wait is.** In the lead race at 10:00 the trolley passenger waits 6 minutes and today's passenger waits 31. In the covered 1938 midday timetable a car was scheduled at Preston & Caroline every 7 or 8 minutes. For these corners and this direction, today's one-seat buses are scheduled 34 to 39 minutes apart.
- **Ghost cars.** While today's passenger waits for the 10:32 bus, the other scheduled 1938 cars run down the route as faint trolleys, and a counter adds them up: four were scheduled past this corner before today's bus leaves.
- **A win for today looks exactly like a win for 1938.** "Show a race today wins" walks through all 25.

Two public datasets, joined: the **MDOT MTA local bus GTFS feed** (version 20260821, pinned by its SHA-256) and the **No. 21 guide, effective March 6, 1938**, a scan published by Digital Maryland. Street shapes come from OpenStreetMap.

## How Kiro was used

| Kiro feature | What it did here | Where to see it |
| --- | --- | --- |
| Specs | Five specs, each requirements, then design, then tasks: `race-engine` (the Python pipeline), `race-screen` (the page), `story-layer` (captions, chart, next steps, phone flow), `skeptic` (the fact-checker and its MCP server) and `ghost-cars`. | `.kiro/specs/` |
| Steering | Five files: `product.md` (the honesty rules), `structure.md`, `tech.md`, `ui.md`, and the manual `skeptic-check.md` command. | `.kiro/steering/` |
| Hooks | `validate-after-agent-edit` runs `python -m pipeline validate` when a pipeline, data or test file is saved. `rebuild-and-test-when-agent-stops` runs `python -m pipeline check --quick` when the agent stops. `copy-and-source-guard` runs `python -m pipeline check_sources` when a web/ or docs/ file is saved, and fails on a banned word. | `.kiro/hooks/` |
| MCP | `ghostline-gtfs`, our own MCP server, reads the raw feed with its own small reader. It never imports the pipeline's race code, so it checks the pipeline instead of repeating it. Its tools are `feed_info` and `trips_serving`. | `.kiro/settings/mcp.json`, `pipeline/mcp_server.py` |
| Custom agent | The Skeptic, a read-only agent with only the read tool and the MCP tools. It reports each claim in a document as OK, MISMATCH or UNSOURCED, and ends with PASS or FAIL. | `.kiro/agents/skeptic.md` |
| Property-based tests | Hypothesis in Python and fast-check in TypeScript, on every algorithm, next to example tests and golden tests on the pinned feed. | `tests/property/`, `web/tests/` |

**One spec line that shaped the design.** From `.kiro/specs/race-engine/requirements.md`: "Never edit an expected value, a facts file, or a test to make a check pass." Every computed number either matches the brief or stops the build and is reported. That rule is why the walk-formula mismatch below was reported, not patched.

**Two real catches.**
- **Row order.** A shuffle property found that the MCP server's answer depended on the order of the feed's rows when a trip repeated a stop_sequence. The server now rejects that feed as a format error (commit 0cfcfe9).
- **A golden value in the agent.** A token test fails if a golden value appears in the Skeptic's own instructions. It caught one in the draft of the agent file, so the Skeptic has to get every number from the feed tools (commit 0a883a7).

The Skeptic's 38-against-36 run in the video is a **planted test**: a fixture file says 38 one-seat buses, `trips_serving` answers 36, and the Skeptic reports FAIL.

**Specs and vibe coding.** Every feature went through a spec. Fixes found by hand in between were written into the spec and built from there: the fourteen friction fixes from the first human test are story-layer task 25 (25.1 to 25.14), and the result-visibility and desktop About-button fixes are task 24.

**Not used.** Kiro Powers and Kiro Crew were not used.

**Three honest misses.**
1. A walk-formula unit test missed its expected value by 0.000514 minutes. Kiro stopped instead of changing the value. The brief had paired a rounded distance with the result for the real one; Emmanuel corrected the test input.
2. Kiro's first hook files did not match the documented hook schema and had to be corrected to it.
3. A golden value slipped into the Skeptic agent's draft. The token test caught it before the commit.

## Trust and limits

- **Scheduled, not live.** Today's side is one frozen snapshot: the weekday schedule as of Nov 4, 2026. The 1938 side is the guide's midday timetable; the page says so before the first listed car at a corner.
- **Every number is one tap from its source:** what it is, the year, the page or the feed, and a link.
- **Walk times are estimates:** straight-line metres from the corner to the stop, times 1.3 for street detours, at 1.2 m/s.
- **One-seat rides only.** Today's side counts only trips with no transfer, from a stop within 400 m of each corner. A rider who changes buses, or rides part way and walks, may do better; Ghost Line does not model that.
- **Why 1938:** this guide lists the No. 21's cars minute by minute, with running times between corners. We use only its midday cars and don't claim 1938 was typical.
- One corner, Brevard & Preston, is inferred. It is drawn dashed, tagged "inferred", and is never the default.
- No AI model runs in the deployed app. Kiro's hooks, agents and MCP tools run only in the editor.

## Design

- **The race starts by itself.** The first screen plays the lead race at the labelled example start, 10:00 AM, with short captions for what each passenger is doing, then shows where the time went.
- **The result reads like a destination sign,** in the winner's colour: "1938 wins", "Today wins", "Photo finish" or "No one-seat ride today".
- **Each era looks like itself.** The 1938 vehicle is a trackless trolley with two poles under two overhead wires, tyres and no rails. Today's is a plain bus. Only the trolley glows.
- **Phone first:** designed at 375 x 667, with a desktop layout from 900 px (ui.md). The slider, its minus and plus, "Skip to result", the next-step actions and the other controls are reachable by keyboard (race-screen R1.4, R3.1, R5.8; story-layer Requirement 15.2). The result is announced once, through an aria-live region (ui.md; story-layer Requirement 15.3). Under reduced motion each race is drawn finished, with no animation (ui.md).
- The cinematic map shots in the video are illustrations driven by the same scheduled data; the app's map is flat.

## Credits

- 1938 guide: Digital Maryland, linked, not copied.
- Schedule: MDOT MTA local bus GTFS, feed version 20260821. Not endorsed by MDOT MTA.
- Streets: © OpenStreetMap contributors, ODbL.
- Built with Kiro by Emmanuel Chukwuemeka, a student, working alone. Facts files, the OpenStreetMap way snapshot, planning briefs, mockup pictures and expected test values were prepared during planning with Claude Code and Codex. The pipeline and the app were built in Kiro.
