# Kiro evidence

Screenshots and raw output that show Kiro features working. Git holds the results of the Kiro sessions; these files show the editor side. Emmanuel adds them (task P8 of the polish brief).

## Screenshots to add

| File to add | What it shows |
|---|---|
| `hooks-panel.png` | The Agent Hooks panel listing the three hooks, all enabled. |
| `guard-hook-fail.png` | The copy-and-source-guard hook failing after saving a docs file that contains a banned word, naming the file and line. |
| `mcp-trips-serving.png` | The MCP Server view with `ghostline-gtfs` running and a `trips_serving` answer. |
| `spec-task-view.png` | The spec task view for one of the four specs. |
| `skeptic-fail-planted.png` | `/skeptic-check tests/fixtures/skeptic/planted.md` ending in FAIL. |
| `skeptic-pass-docs.png` | `/skeptic-check` on the real docs ending in PASS. |

## Raw output to add

| File to add | Command |
|---|---|
| `perf-output.txt` | `npm run perf` in `web/` |
| `check-timing-output.txt` | `python -m pipeline check --timing` |

The log of what each feature did is in [`docs/kiro-usage.md`](../kiro-usage.md).
