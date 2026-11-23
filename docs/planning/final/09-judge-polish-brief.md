# Draft 9: what judges see first (Kiro batch, Nov 23 to 25)

Status: Nov 22, for Kiro. This is the work the Goldfish attack ranked as blockers. The full findings, with evidence and line numbers, are in `docs/planning/final/goldfish-report.md`; the finding numbers below refer to it. Do these as tasks in order. Commit each one separately, push at the end of each day, and confirm the GitHub Actions deploy is green.

**The decisions are already made** (Emmanuel approves them by pasting this brief):
- The photo-finish line changes (finding 7). That changes product.md rule 6 to match.
- The walk-method copy changes (finding 7).
- The phone headline is added (finding 8).
- "Why 1938" uses the default sentence below. ⚠ Emmanuel can replace it with his own reason.
- The Codex camera footage and the Blender film are video-only. The app doesn't change for them.

---

## P1. The root README (finding 3), Nov 23
Build `README.md` at the repo root, using `docs/planning/final/03b-README-draft.md` as the outline, with every fix finding 3 lists:
- Fill the numbers from `web/public/data/summary.json`: 5,666 races, 5,582 trolley firsts, 25 today wins, 59 photo finishes, 17 same-ride pairs. Never type a number that isn't in a data file.
- Put a real screenshot at the top: use the current `npm run screens` output, and after P6 the ghost-cars still.
- Label the URL "Site:". Never write "live demo".
- Add "How Kiro was used": a short table linking `.kiro/specs`, `.kiro/steering`, `.kiro/hooks`, `.kiro/agents/skeptic.md`, `.kiro/settings/mcp.json`, `pipeline/mcp_server.py` and `docs/kiro-usage.md`.
- Add how to run the Skeptic: `/skeptic-check <file>`.
- Say that `raw/` is git-ignored, and give the feed version 20260821 and its SHA-256.
- Add the honest-limits paragraph (finding 7, transfers row).
- Add "Why 1938" (default sentence): "Why 1938: this guide lists the No. 21's cars minute by minute, with running times between corners. We use only its midday cars and don't claim 1938 was typical."
- Use the scan line from finding 3, step 7.
- Add the MIT licence line.

Then run `python -m pipeline check_sources`.

## P2. Kiro evidence (finding 5), Nov 23
1. In `docs/kiro-usage.md`:
   - add a 6-row summary at the top (feature, what it did, proof path);
   - add rows for the race-screen and story-layer builds (Nov 18 to 21), from git log;
   - add a dated row for when the hooks were enabled, and fix the line that says they're disabled;
   - replace each "(unverified)" with "†" and one footnote: "† From the chat session; git holds the result, not the exchange."
2. Tick the parent tasks whose subtasks and checkpoints are all done: story-layer tasks 2, 9, 10, 11, 15 and 16, and race-screen 23 once 23.4 is recorded. Update the race-engine status line that still says "Not started".
3. Create `docs/kiro-evidence/` with a `README.md` listing the screenshots Emmanuel will add (P8).

## P3. Trust wording in the app (finding 7), Nov 24
- **Walk line:** "Estimate: straight-line {m} m from the corner to the stop, times 1.3 for street detours, at 1.2 m/s." Use the real constants from the pipeline, never typed numbers. Update the copy-table requirement and its tests.
- **Photo finish:** the takeaway under a photo finish becomes "Photo finish. Across this line: same ride, longer wait." Edit product.md rule 6 to allow it, update the copy table and tests, and show Emmanuel the rule's before and after.
- **About sheet:** add the honest-limits sentence from finding 7.
- `pipeline/check_sources.py`: add "citywide" to `BANNED_TERMS`, with a unit test.

## P4. First impression on judges' screens (finding 8), Nov 24
- **Link previews:** in `web/index.html`, add a meta description and og/twitter tags, with an absolute `og:image` at `web/public/og.png` (a real 1200 × 630 still of the finished lead race). No counts in the description and no banned words.
- **Phone:** show the existing "Same ride, longer wait." headline on the phone too, and shorten the phone intro so the result line has at least 16 px to spare at 375 × 667 and 390 × 844. Show Emmanuel the before and after pictures.
- Fix the desktop About "i" button overlap.
- Confirm the font preload doesn't 404 on Pages.
- Run `npm run screens` and the checkpoint spec at 375 × 667, 390 × 844 and 1280 × 800.

## P5. Freshness, Nov 24
Push, then confirm the deployed site at the Pages URL shows the story layer and today's commit. Report the commit hash the site serves.

## P6. Ghost cars, Nov 24 to 25
Build the `ghost-cars` spec from `docs/planning/final/08-ghost-cars-brief.md`, as its own spec (requirements, design, tasks). Go through all three phases without waiting, and stop only for a real question.

## P7. The two documents, Nov 25
1. Write `docs/devpost.md` from the repo, not from the old draft (finding 4):
   - use its opening lines and its section order;
   - fill in the two real catches (commits 0cfcfe9 and 0a883a7);
   - call 38-vs-36 a planted test;
   - leave out census, HOLC and "36 of 87";
   - use the right spec, steering and hook names and counts;
   - add one line about the ghost cars;
   - say: "The cinematic map shots in the video are illustrations driven by the same scheduled data; the app's map is flat."
   - Also follow WIN-PLAN.md section 9:
     - open with the dead technology and the living riders;
     - name both public datasets;
     - answer every Kiro prompt in the rules (specs vs vibe coding, hooks, steering, MCP, property-based testing, powers, Crew), saying plainly which ones weren't used;
     - quote one spec line that shaped the design;
     - give the three honest misses.
2. Write `docs/video_script.md` from `docs/planning/final/WIN-PLAN.md`, section "The video". Copy every on-screen string from the deployed site exactly as it appears.
3. Run `/skeptic-check` on `README.md`, `docs/devpost.md` and `docs/video_script.md` until each one gives PASS. Fix the text, never the data. Log any real catch in `kiro-usage.md`, and tick skeptic task 14.

## P8. For Emmanuel (not Kiro), Nov 25
Take screenshots into `docs/kiro-evidence/`:
- the Agent Hooks panel;
- the guard hook failing when you save a docs file containing "live";
- the MCP server view with `trips_serving`;
- the spec task view;
- `/skeptic-check` FAIL on the planted file and PASS on the real docs.

Commit the raw `npm run perf` and `python -m pipeline check --timing` output.

## Freeze, Nov 27
Run all the checks:
- `python -m pipeline check`, `verify` and `check_sources`;
- `npm test`, `npm run test:e2e`, `npm run check:size` and `npm run perf`.

Then push, confirm the deploy, and tag `freeze-2026-11-27`. After the tag, only a broken deploy may change code.

## Not in this batch
Not the map race (draft 07 is parked), schema v2, the tilt, buildings, the moving camera in the app, sound, census, HOLC or new lines.
