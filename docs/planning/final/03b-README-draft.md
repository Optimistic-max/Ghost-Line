# README.md (draft)

**How to use this draft.** Copy everything below the line into `README.md` at the root of the repo once the build works. **TO COMPUTE** = a number the build must produce (planning value in brackets). **TO CONFIRM** = true only if you built it; delete the line otherwise. Commands are the ones named in `tech.md`; run each one yourself before publishing and fix any that differ. The draft avoids the wording `check_sources` bans.

---

# Ghost Line

**Same ride, longer wait.** Baltimore's 1938 No. 21 trackless trolley, raced against today's scheduled bus between the same two corners.

**Try it:** TO CONFIRM (public URL) · **Video:** TO CONFIRM · Kiroween 2026, Resurrection category

![The race screen](docs/planning/ui-mockups/03-wins1938.png)
<!-- Replace the picture above with a screenshot of the built app. -->

## What it does

1. Open the page. A race starts by itself: Preston & Caroline to Aliceanna & Bond.
2. Drag the time, from 9:00 to 13:52. Both vehicles leave from that same moment.
3. Pick any two of the line's five timing corners, or swap direction.
4. Tap any number to see where it comes from.

Each race ends in one of four results: **1938 wins**, **Today wins**, **Photo finish** (under a minute apart) or **No one-seat ride today**.

## What it found

| | |
|---|---|
| Scheduled races, 20 corner pairs, every minute 9:00–13:52 | **TO COMPUTE** (5,666) |
| 1938 wins | **TO COMPUTE** (5,582) |
| Today wins | **TO COMPUTE** (25) |
| Photo finishes | **TO COMPUTE** (59) |
| Pairs where the ride itself is about the same length | **TO COMPUTE** of 20 (17) |
| Pairs where today's ride is faster | **TO COMPUTE** of 20 (3) |

These counts cover this one line only. They are read from `web/public/data/summary.json`, which the pipeline writes.

## How a race works

- **Start.** Both sides start at the chosen minute. The 1938 guide lists midday cars only, so before the first listed car at a corner the page says so and races from that car's time.
- **1938.** The next listed car at or after the start. Wait + ride. No walk: riders boarded at the corner.
- **Today.** Among one-seat bus trips with a stop within 400 m of each corner, the trip that gets you to the destination corner first, counting the walk to the stop and from the stop. Walk time is an estimate: straight-line metres × 1.3 ÷ 1.2 m/s.
- **Result.** Totals less than 1.0 minute apart are a photo finish, because the walks are estimates.

Today's side is one frozen snapshot: the weekday schedule for Wednesday, November 4, 2026. Scheduled, not live.

## Sources

| What | Where | Notes |
|---|---|---|
| 1938 route, running minutes and timetable | [No. 21 guide, effective March 6, 1938](https://collections.digitalmaryland.org/digital/collection/btjk/id/203), Enoch Pratt Free Library via Digital Maryland | Entered by hand in `data/lines/no21-1938.yaml`, each value with its page link. Scans are linked, not copied. |
| Today's schedule | MDOT MTA local bus GTFS, feed version 20260821 | Pinned by SHA-256 `8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694`. Not endorsed by MDOT MTA. |
| Street shapes | OpenStreetMap, snapshot dated 2026-11-01 in `data/osm/ways.json` | © OpenStreetMap contributors, ODbL. |
| TO CONFIRM: households without a vehicle | ACS 2020–2024 5-year, table B08201 | Whole census tracts near the line, with margins of error. |
| TO CONFIRM: 1937 HOLC grades | Source: Mapping Inequality | CC BY-NC 2.5; overlap is not cause. |

## Run it yourself

You need Python 3.12 and Node.js.

```bash
pip install -e .[dev]
```

```bash
python -m pipeline validate
```

`validate` runs the fast checks and needs no schedule file.

To rebuild the data you need the pinned schedule file at `raw/mta_local_bus.zip`. It is not in this repository. Download it from https://feeds.mta.maryland.gov/gtfs/local-bus; if the MTA has since published a newer version, the build stops and tells you the fingerprint does not match.

```bash
python -m pipeline build
```

```bash
python -m pipeline verify
```

`verify` rebuilds everything and fails if the committed data files differ.

To run the site:

```bash
npm install --prefix web
```

```bash
npm run dev --prefix web
```

## How it is built

- `pipeline/` — Python. Does all the arithmetic once and writes JSON into `web/public/data/`.
- `web/` — TypeScript, no framework. Looks numbers up, rounds them for display and animates. No race arithmetic runs in the browser.
- `data/lines/` — the hand-entered 1938 facts.
- `tests/` — example tests, golden tests on the pinned schedule, and property-based tests.
- `.kiro/` — the specs, steering files, hooks, agent and MCP settings used to build it. See [docs/kiro-usage.md](docs/kiro-usage.md).

No server, no accounts, no tracking, and no AI model in the deployed app.

## What it does not claim

- It compares **scheduled** service on one weekday. It says nothing about delays.
- It counts **one-seat rides** only.
- One corner, Brevard & Preston, is **inferred**: the street no longer exists and its exact position is unresolved. It is drawn dashed and is never the default.
- It does not say why service changed, or who rode the line in 1938.

## How this was made

Built with [Kiro](https://kiro.dev) for Kiroween 2026 by Emmanuel Chukwuemeka, a student, working alone.

Facts files, the OpenStreetMap way snapshot, planning briefs, mockup pictures and expected test values were prepared during planning with Claude Code and Codex, and checked by hand against the scans. The pipeline and the app were built in Kiro.

## Licence

Code: TO CONFIRM (MIT is the simplest choice; add a `LICENSE` file so GitHub shows it). Route geometry derived from OpenStreetMap is under the ODbL. TO CONFIRM: the HOLC layer, if present, stays under CC BY-NC 2.5 and is not covered by the code licence.
