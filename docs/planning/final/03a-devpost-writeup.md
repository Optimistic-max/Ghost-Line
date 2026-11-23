# Devpost write-up (draft)

**How to use this draft.** Copy it to `docs/devpost.md` when the build is done, then paste it into Devpost.

- **TO COMPUTE** marks every number the build must produce. Take each one from `summary.json` or a race file, never from this draft. The value in brackets is the planning value, so you can see at a glance if the build disagrees.
- **TO CONFIRM** marks a statement that is only true if you built that thing. Delete the sentence if you did not.
- The draft avoids the words your `check_sources` command bans (for example it says "public URL", not the usual phrase for a deployed site). Keep it that way.

---

## Ghost Line

*In 1938 a trolley ran down this street every seven and a half minutes. Race it against today's bus.*

**Category:** Resurrection · **Built with:** Kiro · **Try it:** TO CONFIRM (public URL) · **Code:** TO CONFIRM (GitHub URL) · **Video:** TO CONFIRM (YouTube URL)

## Summary for judges

- **What it is.** A free web page that brings back Baltimore's 1938 No. 21 trackless trolley and races it against today's scheduled MTA bus between the same two corners, with the walk to the bus stop counted.
- **What it found.** The ride takes about the same time as in 1938. The wait does not. Across this line's 20 corner pairs, 1938 wins **TO COMPUTE** of **TO COMPUTE** scheduled races (planning values: 5,582 of 5,666). Today wins **TO COMPUTE** (25), and the page shows those just as plainly.
- **Why you can trust it.** Every number on screen is one tap from its source: the 1938 timetable page, or the pinned MTA schedule file with its fingerprint. The 1938 side is scheduled times from the original guide; today's side is the weekday schedule as of Nov 4, 2026. Scheduled, not live.
- **How Kiro was used.** Three specs, four steering files, three hooks, a reviewer agent with its own MCP tools, and property-based tests that guard the race arithmetic. The table at the end says where to see each one.
- **Who it is for.** Transit advocates, reporters and planners who want a fair, checkable answer to one question: did this neighborhood once have better scheduled service, and by how much?

## Potential Impact

**The problem.** People who argue about bus service usually have a feeling that it used to be better, and no fair way to check. Checking takes an archive visit, a schedule-data toolkit and a mapping program.

**What Ghost Line does about it.** Pick two corners on the old line and a time of day. Both vehicles leave from the same moment. The page shows who gets there first, and why.

- At 10:00 on the lead pair (Preston & Caroline to Aliceanna & Bond), the 1938 trolley takes **TO COMPUTE** minutes and today's one-seat bus trip takes **TO COMPUTE** (planning values: 15 and 45, walking included).
- The reason is on screen too: only **TO COMPUTE** of **TO COMPUTE** CityLink Lime trips in that direction continue past their turn-back point (planning values: 36 of 87).
- TO CONFIRM (only if the census sentence was built): near this line, **TO COMPUTE**% of households have no vehicle, against **TO COMPUTE**% citywide (2020–2024 ACS 5-year estimates; planning values 43.2% ± 2.5 and 26.7% ± 0.7).

**Who would use it.** A reporter can link to one race and its sources. An advocate can show a council member a result that includes the races today wins. TO CONFIRM (only if outreach landed): [name, role] tried it and said "[quote]".

**Honest limits.** One line, one weekday, scheduled times only, one-seat rides only. It does not say why service changed or who rode in 1938.

## Technological Implementation

**How we used Kiro, in short.** I wrote the requirements; Kiro's spec flow turned them into designs and task lists; steering files held the rules that must never bend; hooks reran the checks after every edit; a reviewer agent checked my own claims against the schedule file.

- **Spec-driven development.** Three specs: `race-engine` (the build-time pipeline), `race-screen` (the page) and `skeptic-tools` (the MCP server). Each started from a written brief. TO CONFIRM: number of tasks completed through Kiro: **TO COMPUTE**.
- **Correctness properties.** The rules of a fair race became property-based tests (Hypothesis in Python, fast-check in TypeScript). Examples: both sides start from the same moment; starting later never gets you there earlier; a 1938 wait is never above 8 minutes; building twice gives identical files. TO CONFIRM: the bug a property test caught: [one sentence, with the counterexample].
- **Steering.** `product.md` holds eleven honesty rules that outrank every other instruction, such as "never invent a number" and "a win for today is shown exactly as plainly as a win for 1938". `ui.md` loads only for files under `web/`.
- **Hooks.** TO CONFIRM each: `check-after-edit` reruns `python -m pipeline check`; `rebuild-on-stop` rebuilds the data; `copy-guard` blocks banned wording.
- **Custom agent + MCP.** TO CONFIRM: the Skeptic is a read-only agent. Its MCP server reads the raw schedule file with its own small reader, on purpose separate from the pipeline, so it can check the pipeline's answers independently. It caught: [one sentence].
- **Spec versus vibe coding.** TO CONFIRM: [two sentences on one thing you tried both ways].

**Under the hood.** A Python pipeline does all the arithmetic once and writes small JSON files. The page only looks numbers up, rounds them and animates. There is no server and no AI model in the deployed app.

## Design

- **One screen, two taps.** The race starts by itself on first load. Pick two corners, drag the time; that is the whole interface.
- **The result reads like a destination sign.** One of four results, in the winner's colour: "1938 wins", "Today wins", "Photo finish" (under a minute apart) or "No one-seat ride today".
- **Each era looks like itself.** The 1938 vehicle is a trackless trolley: two poles, two overhead wires, tyres, no rails. Today's is a plain bus. Only the trolley glows.
- **Honesty is part of the layout.** Every time says "scheduled". Every walk says "estimate". The one corner whose position is uncertain is drawn dashed and tagged "inferred". Every number is a button that opens its source.
- **Built for phones first.** Designed at 375 px wide, with a desktop layout from 900 px. Works with reduced motion, a keyboard and a screen reader; the map is optional and the race never waits for it. TO CONFIRM: time from opening the page to the race starting on a throttled phone connection: **TO COMPUTE** seconds.

## Innovation / Idea

- **A resurrection you can argue with.** Most history maps show where a line ran. Ghost Line runs the old timetable again and lets it lose.
- **Four public sources, joined for the first time:** a 1938 pocket guide scanned by the Enoch Pratt Free Library, the MTA's published schedule file, OpenStreetMap streets, and (TO CONFIRM) Census estimates.
- **The engine reports against itself.** Today wins **TO COMPUTE** races (planning value 25) and the page lists every one.
- **Receipts as a feature.** Each race file carries the trips and the 1938 clock it was computed from, so every row can be recomputed from the same file.

## Presentation

The video (under three minutes) opens on a race, shows one result with its source, shows a race today wins, then shows Kiro at work. See the storyboard in the repository: `docs/video_script.md`.

## How we used Kiro

See the table in `docs/kiro-usage.md` (draft: `03c-kiro-usage-table.md`).

## Data, credits and disclosure

- 1938 guide and 1933 directory: Enoch Pratt Free Library / Digital Maryland (linked, not copied).
- Schedule: MDOT MTA local bus GTFS, feed version 20260821. Not endorsed by MDOT MTA.
- Streets: © OpenStreetMap contributors, ODbL.
- TO CONFIRM (only if the layer was built): 1937 HOLC grades. Source: Mapping Inequality.
- **Disclosure.** Facts files, the OpenStreetMap way snapshot, planning briefs, mockup pictures and expected test values were prepared during planning with Claude Code and Codex, and checked by hand against the scans. The pipeline and the app were built in Kiro. (Say "checked by hand" only once `street_order_checked` is true in the facts files.)
