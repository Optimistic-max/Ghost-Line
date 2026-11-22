---
inclusion: manual
---

# Skeptic check

Use the `skeptic` agent to check documents against the project's evidence.

1. If files are named after the command (for example `/skeptic-check tests/fixtures/skeptic/planted.md`), invoke the `skeptic` agent on exactly those files.
2. If no file is named, invoke the `skeptic` agent on `docs/video_script.md` and `docs/devpost.md`.
3. Show the agent's report to the user unchanged: every line, and the last line (PASS or FAIL). Do not summarise, reword, fix or add to it.

Do not edit any file because of the report. The person who wrote a claim does not check it, and the person who checks it does not change it.
