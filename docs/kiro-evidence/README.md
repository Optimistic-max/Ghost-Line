# Kiro evidence

Screenshots and raw output that show Kiro features working. Git holds the results of the Kiro sessions; these files show the editor side. Emmanuel adds them (task P8 of the polish brief).

## Screenshots

| File | What it shows |
|---|---|
| `hooks-panel.png` | The Agent Hooks panel listing the three hooks, all enabled. |
| `guard-hook-fail.png` | The `rebuild-and-test-when-agent-stops` hook card after the agent stopped, failing on the banned word in docs/hook-test.md and naming the file and line. (The copy-and-source-guard hook did not fire on a manual save in the Nov 24 test; see docs/kiro-usage.md.) |
| `mcp-trips-serving.png` | The MCP Server view with `ghostline-gtfs` running and a `trips_serving` answer. |
| `spec-task-view.png` | The spec task view for one of the five specs. |
| `skeptic-fail-planted.png` | `/skeptic-check tests/fixtures/skeptic/planted.md` ending in FAIL. |

The `/skeptic-check` PASS on the real docs is shown in the video (docs/video_script.md, Kiro clip K5, 2:14-2:23), not as a screenshot.

## Raw output to add

| File to add | Command |
|---|---|
| `perf-output.txt` | `npm run perf` in `web/` |
| `check-timing-output.txt` | `python -m pipeline check --timing` |

The log of what each feature did is in [`docs/kiro-usage.md`](../kiro-usage.md).
