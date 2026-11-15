# Ghost Line: skeptic brief (Brief 3, schedule-checking tools)

**What this file is.** A planning brief written on November 15, 2026, with Claude Code, before the Kiro build started. It is the feature brief to give to Kiro's spec flow for the small MCP server that a read-only reviewer agent (the Skeptic) uses. It holds no program code. Run this spec after the race engine passes its checks.

Expected values marked **[C]** were computed during planning from the pinned MTA feed. If the build disagrees with one, stop and tell Emmanuel; do not change the expected value.

---

## Brief 3: feature brief for the `skeptic-tools` spec

```text
Feature: schedule-checking tools for a reviewer agent

Build a small MCP server, pipeline/mcp_server.py, run over stdio, that lets an
agent question the pinned MTA feed directly. It must read the feed with its own
minimal reader and must not import pipeline.eligible or pipeline.race, because
its job is to check their output independently.

Tools
- feed_info(): returns feed_version, the zip's SHA-256, and the service_ids
  active on 2026-11-04.
- trips_serving(stop_a, stop_b, date, after, before): stop_a and stop_b are GTFS
  stop_id strings; date must be "2026-11-04"; after and before are optional
  "HH:MM" limits on the departure from stop_a. Returns the count and the list of
  trips that call at stop_a and later at stop_b on that date: trip_id, route
  short name, headsign, departure time at stop_a, arrival time at stop_b.

Rules
- If the zip is missing or its SHA-256 is not the pinned value, every tool
  returns an error. It never returns an empty list in that case.
- Any other date is an error.
- An unknown stop_id is an error that names the stop.
- Nothing is ever printed to standard output except protocol messages.
- The tools are read-only.

Expected values (see also docs/planning/race-brief.md, section 5.4)
trips_serving("8564", "9486", "2026-11-04") returns 36 trips, all CityLink
Lime to HARBOR EAST. With after "10:00" and before "13:00" it returns 5,
departing 10:32:43, 11:08:43, 11:44:43, 12:20:43, 12:56:43.

Done when
The server starts from .kiro/settings/mcp.json, both tools answer in Kiro's
chat, and the two expected values above match.
```

---

## Where the rest lives

- The MCP config (`.kiro/settings/mcp.json`) and the Skeptic agent file (`.kiro/agents/skeptic.md`) are not in the repository yet. Their intended contents are in the master plan, sections 6.5 and 6.6. Create them in Kiro when this spec is built.
- The server is started as `python -m pipeline.mcp_server`, with the environment variable `GHOSTLINE_GTFS_ZIP` set to `raw/mta_local_bus.zip`.
- Test the Skeptic before trusting it: plant one wrong number and one unsourced sentence in a copy of a document. It must report MISMATCH and UNSOURCED, then pass the clean copy.
