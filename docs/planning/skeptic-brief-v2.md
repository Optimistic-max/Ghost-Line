# Draft 6: Skeptic brief (Phase 2), updated for the repo as it is on Nov 22

Status: draft, Nov 22. Nothing in the repo has been changed or committed.
It replaces `docs/planning/skeptic-brief.md` (Nov 15) for the spec. Keep the old file as history, or swap this in when you create the spec.
Checked against the repo at commit 387417e (story-layer task 25 done), Kiro 1.3.11 as installed on this machine, and the pinned feed.
Marks: **⚠ UNSURE** means a fact I could not confirm or a decision that is yours.

---

## 1. What I checked, and how

| Item | How it was checked (Nov 22) | Result |
| --- | --- | --- |
| Expected values | Recounted from `raw/mta_local_bus.zip` with a separate script: zipfile and csv only, no pipeline code | Every value holds (section 4) |
| Agent file format | The custom-agent instructions shipped inside Kiro 1.3.11 (`kiro.kiro-agent` extension) | Markdown with YAML front matter in `.kiro/agents/<id>.md`; tools by tag |
| MCP config | The same extension | `.kiro/settings/mcp.json` with an `mcpServers` object |
| Hook format | The three working hooks in `.kiro/hooks/` and Kiro's own examples | `"version": "v1"` JSON. Triggers include PostFileSave and Stop; actions are `command` or `agent`. "Manual" can't be created as a hook (see 2.6). |
| Pipeline commands | `python -m pipeline --help` | validate, build, check (also `check --quick`), verify, check_sources. No fetch_osm. |
| Data fields | web/public/data | Section 5 |
| Python MCP SDK | `import mcp` | **Not installed** (Python 3.14.7; pyproject needs 3.12 or later) |
| docs/video_script.md, docs/devpost.md | ls | **Neither exists yet.** Drafts are outside the repo, in `Documents\Ghost Line Chat 2\fable-final\` (03a-devpost-writeup.md, 04-video-storyboard.md). |

---

## 2. What changed from the Nov 15 version

1. **The agent file format is now verified.** Kiro 1.3.11 says agent files "MUST be markdown files with .md extension", either in `.kiro/agents/` (workspace) or `~/.kiro/agents/`. The front matter holds:
   - `name`, `description` and `tools` (tags only: `read`, `write`, `shell`, `web`, `spec`, `@mcp`, `@powers`, `@builtin`, or an `@<server>` pattern);
   - optionally `model`, `includeMcpJson` and `includePowers`.

   MCP tools are included only through an `@` pattern or `includeMcpJson: true`. The Nov 15 brief named the file but not its format.
2. **The MCP config format is now verified:** `.kiro/settings/mcp.json`, with `{"mcpServers": {"<name>": {"command", "args", "env", "disabled"}}}`. Servers reconnect when the config changes.
3. **The evidence location changed.** The old plan checked documents against `out/evidence/*.json`, which doesn't exist. The evidence is now:
   - `web/public/data/` (`index.json`, `summary.json`, `race/*.json`, `route.geojson`);
   - the facts file `data/lines/no21-1938.yaml`;
   - the screen's copy in `web/src/copy/copy.ts`;
   - for bus trips, the feed itself through the MCP tools.
4. **Names differ by source, so the brief now states how to compare them:**
   - The feed's route short name is `CityLink LIME`; the site shows `CityLink Lime` (`route_display`).
   - The feed's headsign is `HARBOR EAST`; the site shows `Harbor East` (`headsign_display`).

   The tool returns the feed's own spelling, and the agent compares names case-insensitively.
5. **GTFS times pass 24:00.** On Nov 4 the last 8564-to-9486 trip leaves at 25:15:53. The `after` and `before` limits compare as GTFS times, and the window is inclusive.
6. **Running the Skeptic on demand.** Kiro 1.3.11 refuses a "Manual" trigger in `createHook` and points to a steering file with `inclusion: manual`, which becomes a `/<name>` slash command in chat. The brief therefore uses `.kiro/steering/skeptic-check.md`, not a manual hook.
7. **The planted-error copies moved out of docs/.** The `copy-and-source-guard` hook runs `check_sources` on every save under `docs/`, so planted errors there would trip it. They live in `tests/fixtures/skeptic/`, which is never shipped and never scanned.
8. **The MCP SDK has to be installed.** That's a new dependency and one network step, which needs your go-ahead. tech.md already says "the official Python MCP SDK, stdio transport. Check its current docs before writing the server."
9. **The server's independence is now testable.** A test scans the server's imports, and a second test checks that its pinned hash equals `pipeline.feed_check.PINNED_FEED_SHA256`, so the two copies can't drift apart unnoticed.
10. **Current wording the agent must know:**
    - the honest line now reads "races (every start time the 1938 timetable covers, at all 20 pairs of corners)" (story-layer task 25.6);
    - the ride rule is `summary.ride_same_rule`;
    - race rows carry `wait_most`.
11. **The census figure.** The Devpost and video drafts in fable-final probably contain "43%". Until the census pipeline exists, the Skeptic must report it **UNSOURCED**. That's correct, and worth knowing before the first run.

---

## 3. Feature brief to paste into Kiro (new spec: skeptic-tools)

```
Feature brief: skeptic-tools (Ghost Line, Phase 2)

Goal
A read-only reviewer agent, the Skeptic, checks every number and claim in the
video script and the Devpost text against the project's evidence, and recounts
bus trips straight from the pinned MTA feed through a small MCP server with its
own reader. The person who wrote a claim is not the one who checks it. Read
steering first (product.md, tech.md, structure.md).

K1 MCP server: pipeline/mcp_server.py
- Official Python MCP SDK, stdio transport. Check the SDK's current docs before
  writing it. Add the SDK to pyproject.toml as an optional dependency group
  "skeptic"; installing it needs Emmanuel's approval (network).
- Started as: python -m pipeline.mcp_server
- Feed path: environment variable GHOSTLINE_GTFS_ZIP; if unset,
  raw/mta_local_bus.zip resolved from the repository root (the parent of
  pipeline/), never from the current directory.
- Its own minimal reader: zipfile and csv from the standard library. It must
  not import any pipeline module (no pipeline.eligible, race, stops,
  gtfs_reader, emit or feed_check), because its job is to check their output
  independently. It keeps its own copy of the pinned SHA-256.
- Reads tables lazily and keeps them in memory after the first call.
  stop_times.txt is about 68 MB, so the first call may be slow; later calls
  must be fast.

Tools
- feed_info() -> {feed_version, sha256, service_date: "2026-11-04",
  active_service_ids}. Active services come from calendar.txt and
  calendar_dates.txt for that date.
- trips_serving(stop_a, stop_b, date, after=None, before=None) ->
  {count, trips: [{trip_id, route_short_name, headsign, dep_a, arr_b}]}
  - stop_a and stop_b are GTFS stop_id strings; date must be "2026-11-04".
  - A trip counts once: its first call at stop_a that has a later call (higher
    stop_sequence) at stop_b.
  - dep_a is the departure at stop_a and arr_b the arrival at stop_b, as the
    feed's HH:MM:SS (hours may pass 24).
  - after and before are optional "HH:MM" limits on dep_a, both inclusive,
    compared as GTFS times.
  - Sorted by dep_a, then trip_id. Names are the feed's own spelling.

Rules
- If the zip is missing or its SHA-256 is not the pinned value, every tool
  returns an error. Never an empty result in that case.
- Any other date is an error. An unknown stop_id is an error that names the
  stop. A malformed time is an error.
- Nothing but protocol messages on standard output; logs go to standard error.
- Read-only: it writes no file, cache or log to disk.

K2 Kiro wiring
- .kiro/settings/mcp.json registers the server as "ghostline-gtfs":
  command python, args ["-m", "pipeline.mcp_server"], env GHOSTLINE_GTFS_ZIP
  "raw/mta_local_bus.zip", disabled false.
- .kiro/agents/skeptic.md, markdown with YAML front matter:
    name: skeptic
    description: Read-only fact checker for Ghost Line documents. Give it file
      paths; it reports every claim as OK, MISMATCH or UNSOURCED with evidence.
    tools: ["read", "@ghostline-gtfs"]
  No write and no shell tools. System prompt as in K3.
- .kiro/steering/skeptic-check.md with front matter "inclusion: manual". It
  asks the main agent to invoke the skeptic agent on docs/video_script.md and
  docs/devpost.md, or on the files named after the command, and to show the
  report unchanged. It is used as /skeptic-check in chat.

K3 The Skeptic's instructions (the body of skeptic.md)
- Check every number, date, time, count, name of a source and factual
  sentence in the files given.
- Evidence, in this order:
  - web/public/data/index.json, summary.json, race/*.json, route.geojson;
  - data/lines/no21-1938.yaml;
  - web/src/copy/copy.ts (what the screen says);
  - docs/kiro-usage.md (claims about how Kiro was used);
  - for bus trips and times, the ghostline-gtfs tools.
- One line per claim:
  "OK | MISMATCH | UNSOURCED - <the claim, quoted> - <evidence: file and field,
  or tool call and its answer>".
- MISMATCH: the evidence says something else. Quote the evidence's value.
- UNSOURCED: no evidence file holds it. A number computed elsewhere (for
  example a census share not in web/public/data) is UNSOURCED.
- The product.md honesty rules count as evidence: a banned word for service
  times (live, real-time, realtime, arriving now, right now; the fixed phrase
  "Scheduled, not live." is the one exception), or "citywide", is a MISMATCH
  against product.md.
- Rounding: a whole-minute figure matches a stored value that rounds to it;
  "about" allows one minute. Names match case-insensitively (CityLink LIME =
  CityLink Lime; HARBOR EAST = Harbor East).
- Last line: "PASS" when every line is OK, otherwise
  "FAIL: <n> MISMATCH, <m> UNSOURCED".
- Never edit a file, never propose a replacement number as fact, never guess.

K4 The planted-error test
- tests/fixtures/skeptic/clean.md: a short script excerpt whose every claim is
  in the evidence. It includes "36 scheduled one-seat buses from Biddle St &
  Caroline Ave to Caroline St & Eastern Ave on the Wed Nov 4, 2026 weekday
  schedule" and "1938 wins by 30 minutes at 10:00 AM (Preston & Caroline to
  Aliceanna & Bond)".
- tests/fixtures/skeptic/planted.md: the same file with exactly two changes:
  36 becomes 38, and one new sentence with no source, "Ridership on the No. 21
  doubled in 1938."
- Kept out of docs/ so check_sources and the editor hooks ignore them, and
  never shipped.
- A pytest test checks that the two files differ in exactly those two places.
- The agent run is the real test: /skeptic-check tests/fixtures/skeptic/planted.md
  must report MISMATCH on the 38 (evidence: trips_serving gives 36) and
  UNSOURCED on the ridership sentence. The clean file must give PASS. Record
  both runs (date, command, the report's last line) in docs/kiro-usage.md.

Tests (pytest)
- Unit, on the fake feed (tests/fixtures/fake-gtfs zipped into a temporary
  file, with a test-only pinned hash): missing zip, wrong hash, wrong date,
  unknown stop, malformed time each give an error and never an empty list;
  inclusive limits; a time past 24:00; a trip that calls at stop_a twice;
  ordering.
- Independence: an AST scan of pipeline/mcp_server.py finds no import of any
  pipeline module.
- Hash: the server's pinned value equals pipeline.feed_check.PINNED_FEED_SHA256.
- Protocol: start the server as a subprocess, send initialize and tools/list
  over stdio, and check that standard output holds only protocol messages.
- Golden (real feed; skip with a clear message when raw/ is missing):
  - feed_info gives feed_version 20260821, the pinned SHA-256 and active
    services ["2251"].
  - trips_serving("8564", "9486", "2026-11-04") gives 36 trips, all with
    route_short_name "CityLink LIME" and headsign "HARBOR EAST".
  - With after "10:00" and before "13:00" it gives 5, with dep_a 10:32:43,
    11:08:43, 11:44:43, 12:20:43, 12:56:43.
  - Cross-check: the lead race file's today.trips entries inside 10:00 to
    13:00 have the same five departures. This is the independence check.

Out of scope
Any change to the pipeline's outputs or the site; writing the video script or
the Devpost text; a power; any network call by the server.

Done when
- The server starts from .kiro/settings/mcp.json and both tools answer in
  Kiro's chat.
- The golden values match.
- /skeptic-check gives MISMATCH and UNSOURCED on planted.md and PASS on
  clean.md, recorded in docs/kiro-usage.md.
- python -m pipeline check, verify and check_sources pass.
```

---

## 4. Expected values, recounted from the real feed (Nov 22)

Independent script: zipfile and csv only, on `raw/mta_local_bus.zip`.

| Check | Result |
| --- | --- |
| SHA-256 | 8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694 (matches the pin) |
| feed_version | 20260821 |
| Active services on 2026-11-04 | 2251 only |
| 8564 → 9486 trips | **36** ✅ |
| Route | all `CityLink LIME` (long name "NW Hospital - Harbor East") ✅ |
| Headsign | all `HARBOR EAST` ✅ |
| 10:00 to 13:00 | **5** ✅: 10:32:43, 11:08:43, 11:44:43, 12:20:43, 12:56:43 ✅ |
| First and last of the day | 04:37:28 → 04:44:00; 25:15:53 → 25:23:00 (past 24:00) |
| Stop names | 8564 "BIDDLE ST & CAROLINE AVE eb"; 9486 "CAROLINE ST & EASTERN AVE fs sb" |

No departure falls exactly on 10:00 or 13:00, so an inclusive or exclusive window gives the same five. The brief says inclusive.

---

## 5. Current data fields the Skeptic will meet

- **Schemas:** `ghostline.index.v1`, `ghostline.summary.v1`, `ghostline.race.v1`. Phase 3 plans race v2.
- **summary.json:**
  - counts: `races` 5,666, `wins_1938` 5,582, `wins_today` 25, `photo_finishes` 59;
  - ride comparison: `ride_same`, `ride_faster_today`, `ride_slower_today`, `ride_same_rule` = {minutes: 1.5, fraction_pct: 15};
  - `pairs_without_one_seat_ride`, `today_wins` (25 entries), `pairs` (20), `sources`.
- **index.json catalog IDs:** guide1938_diagram, guide1938_timetable, guide1938_route, mta_gtfs, osm, method.
- **Race rows:** `t`, `start`, `before_table`, `y1938`, `today`, `result`, `margin`, `wait_most`.
- **Lead race, 10:00:**
  - 1938: departs 10:06, wait 6, total 15;
  - today: trip 2, wait 30.458, total 45.156;
  - result 1938, margin 30.156, wait_most true.

---

## 6. Unsure, to check before Kiro

1. ⚠ **The `@ghostline-gtfs` pattern.** Kiro's instructions say MCP tools are included "only if explicitly matched by tool patterns like @mcp or @git", which suggests `@<server name>` works. If the agent can't see the tools, use `"@mcp"`. Only one server is configured, so that grants nothing extra.
2. ⚠ **How Kiro starts workspace MCP servers** (the working directory). The server resolves its default feed path from its own location, so this shouldn't matter. Check it once in the MCP Server view.
3. ⚠ **Installing the SDK.** It needs network access and your approval. It's the only new dependency. Python 3.14 is in range of pyproject's `>=3.12`, but check that the SDK supports 3.14.
4. ⚠ **First-call speed.** Reading the 68 MB stop_times.txt may take tens of seconds. If Kiro's MCP call times out, the server can read it once at startup instead. It must still never write a cache to disk.
5. ⚠ **The manual steering file.** Check that `/skeptic-check` appears as a slash command in this Kiro version. Kiro's migration notes say manual steering files are invoked that way.
6. ⚠ **docs/video_script.md and docs/devpost.md** don't exist yet. The Skeptic is built and tested on the fixtures first; you add the two docs (from fable-final) later and run `/skeptic-check`. Once they're in docs/, the copy-and-source-guard hook also scans them.
7. ⚠ **Effort:** about 1 Kiro-day. It's smaller if the SDK installs cleanly.
