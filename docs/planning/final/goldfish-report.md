# Ghost Line: Goldfish attack review

Nov 22, 2026. Six reviewers ran in parallel: zoom-out, design, comprehension, implementation-readiness, codebase-details and style. All six completed (status table at the end). Their findings are deduplicated here, and where they disagreed this report picks one answer. Everything was read only; this is the only file written.

Paths: `REPO` = `C:\Users\Emmanuel\Projects\Ghost line`, `PLAN` = `C:\Users\Emmanuel\Documents\Ghost Line Chat 2`.

---

## Verdict

1. **As it stands, the entry loses by default.** The three things judges see first do not exist yet: the video, the Devpost text and a root README.
2. **The plan can win the category, but not a sure win (UNSURE).** The finding is sharp and checkable. Every headline number was verified against the data. The Kiro story (4 specs, 5 steering files, 3 hooks, an MCP server, a read-only agent, property tests that caught real bugs) is better than most entries will have. The current plan spends its last coding days on Phase 3, a 3D map race judges would not reward.
3. **Cut Phase 3 and Blender today.** Spend Nov 23-25 on what judges see: README, Devpost, Kiro evidence, phone polish and trust wording. Spend Nov 28 to Dec 2 on one tight video.

---

## Top 10 findings, ranked by score impact

### 1. Blocker. The video does not exist, and the storyboard is stale and slow

**What's wrong**
- The result arrives at 0:14-0:24. The first 14 seconds are setup.
- "Brings back", the Resurrection line, first appears at 0:24.
- The voice-over has false or unsourced lines:
  - "Two rides leave ... at the same moment" (they leave at 10:06 and 10:32).
  - "comes about every thirty-six" (an invented number).
  - "fifty-five hundred of fifty-six hundred" (wrong rounding).
- The Kiro clips do not match the build:
  - Clip C says the save hook runs `pipeline check`; it runs `validate`.
  - Clip E plants "40 trips" in a file that doesn't exist.
  - Clip D wants a property-test failure that has already passed.
- The story layer, the chart and "Show a race today wins" are missing from the storyboard.

**Evidence:** `PLAN\fable-final\04-video-storyboard.md:20-25`, `:29`, `:54-69`. `docs/video_script.md` does not exist.

**Fix:** write `REPO\docs\video_script.md` by walking the deployed site and copying the strings as they appear. Use this 2:50 structure:

| Time | Shot | Voice-over / on screen |
|---|---|---|
| 0:00-0:10 | Real app, desktop 1280x800, the lead race finishing. Use a share link plus "Skip to result" if the 2 s orientation drags. | "Ten o'clock on a weekday in Baltimore. The 1938 trolley: fifteen minutes. Today's scheduled bus: forty-five, walk included. Same two corners." |
| 0:10-0:22 | "Same ride, longer wait." headline; drag the slider across the chart. | "The ride takes about as long. The difference is the wait. In the 1938 timetable a car was scheduled every seven or eight minutes. For these corners today, the one-seat buses are scheduled thirty-four to thirty-nine minutes apart." |
| 0:22-0:35 | Resurrection beat. Codex camera footage, map only, with the lower third "Design study. Not in the app." (see finding 9) | "The trackless trolley, an electric bus on two overhead wires, is gone from Baltimore. Ghost Line brings back its 1938 timetable and races it against today's schedule." |
| 0:35-0:50 | Drag to 10:30: photo finish. | "Ten o'clock is a bad minute for the bus. At half past it's a photo finish. Across every covered start on this line, the trolley still gets there first in 5,582 of 5,666." |
| 0:50-1:00 | Tap a number; the Sources sheet opens. "Show a race today wins". | "Every number is one tap from its source. Today wins 25 races, and the page lists every one." |
| 1:00-2:15 | Kiro, about 75 s (finding 6 lists the clips). | |
| 2:15-2:35 | Limits | "One line, one weekday, scheduled times only, no transfers." |
| 2:35-2:50 | The trolley drawing under its wires, then the URL. | |

**Who:** Emmanuel writes and records; Kiro checks every string against the app. **Effort:** script 2.5 h, recording and edit 8 h. **Deadline:** script Nov 25, video Nov 28 to Dec 1.

### 2. Blocker. Phase 3 (map race) and Blender take time from everything above. Cut both today

**What's wrong**
- Phase 3 is estimated at 3.5-4 Kiro-days against about 3 working days left. Nov 26 is Thanksgiving.
- It is banned by your own steering: `REPO\.kiro\steering\product.md:72` ("Do not build or propose ... a tilted or 3D map").
- The 05 brief and Codex's camera notes contradict each other:
  - camera: still vs moving;
  - clock: 4 min/s vs two-speed 1.5/8;
  - race length cap: 12 s vs 20 s;
  - about 20 unapproved all-caps strings.
- The schema bump breaks a golden test (`REPO\tests\golden\test_emit_golden.py:67`). A bad path check would show the data-error screen on the live site (`REPO\web\src\data\shape.ts:312,335`).
- The tilted view measured 30.7 fps on your HD 620 laptop. The lite switch trips under 30, so it would likely go flat while you record.
- Bus paths do not exist in `web\public\data` (0 hits for `paths`/`shape_id`).
- Every reviewer except one said cut. The 1938 trolley already moves on the real flat map in step with its ride.

**Evidence:** `PLAN\upgrade-draft\05-phase3-3d-brief.md:14,146-148,231,263,309-315` and `PLAN\design-v3\camera\camera-notes.md:58,73-100`.

**Fix:** do not start Phase 3 or schema v2, and do not edit the steering for them. Drop Blender: it costs 4+ h, it does not match the app's look, and modern buildings read as a fake 1938. Use the existing Codex footage instead (finding 9).

**Who:** Emmanuel decides. **Effort:** 0 h. **Deadline:** Nov 23 morning.

### 3. Blocker. There is no README.md at the repo root

**What's wrong:** judges who open GitHub see a bare file list. The repo has only `REPO\pipeline\README.md`, `REPO\web\README.md` and `LICENSE`. The draft has stale bits:
- a mockup image (`PLAN\fable-final\03b-README-draft.md:13`);
- "13:52" (`:19`);
- census and HOLC rows (`:54-55`);
- "every minute 9:00-13:52" (`:29`; coverage actually starts at each pair's first covered minute, 09:21 on the lead pair);
- "checked by hand against the scans" (`:114`), although `REPO\data\lines\no21-1938.yaml:10` has `street_order_checked: false`.

**Fix:** have Kiro build `REPO\README.md` from the draft:
1. Fill numbers from `summary.json`: 5,666 / 5,582 / 25 / 59, and 17 same + 3 faster today.
2. Put a real screenshot at the top (`web\test-results\screens\story-3-finished-takeaway-desktop.png` is good).
3. Add the site URL labelled "Site:", not "Live demo". The copy guard scans README and bans "live".
4. Add a "How Kiro was used" block that links `.kiro/` and `docs/kiro-usage.md`.
5. Add how to run the Skeptic.
6. Say that `raw/` is git-ignored and name feed_version 20260821, so a judge knows why they can't rebuild the data.
7. Replace the scan line with "The 1938 running minutes and midday departures were checked by hand against the scans."
8. MIT licence line.

Then run `python -m pipeline check_sources`.

**Who:** Kiro drafts, Emmanuel approves. **Effort:** 1.5-2 h. **Deadline:** Nov 23.

### 4. Blocker. The Devpost draft misdescribes the repo and breaks your honesty rules

**What's wrong** (all in `PLAN\fable-final\03a-devpost-writeup.md`)
- Line 13, the tagline "a trolley ran ... every seven and a half minutes": 7.5 is not a pipeline number, and "ran" presents a timetable as observed service.
- Line 22 says three specs and four steering files. The repo has 4 specs and 5 steering files.
- Line 43 names `skeptic-tools`; the spec is `skeptic`.
- Line 46 has the wrong hook names. The real ones are `validate-after-agent-edit`, `rebuild-and-test-when-agent-stops` (runs `check --quick`, "No rebuild") and `copy-and-source-guard`.
- Line 32, "36 of 87 ... turn-back": 87 is in no output file and the app doesn't show it.
- Lines 33, 63 and 80 describe the census and HOLC, which were never built. Line 33 also says "citywide".
- Line 47, "It caught: [one sentence]", is still empty.
- Line 54, "that is the whole interface", ignores the story layer.
- "citywide" is not in `BANNED_TERMS` (`REPO\pipeline\check_sources.py:21`), so the guard would not catch it.

A judge who checks one claim and finds it wrong discounts all the others.

**Fix:**
- Write `REPO\docs\devpost.md` from the repo, not from the draft.
- Opening lines: "At 10:00 on a weekday, Baltimore's 1938 No. 21 trackless trolley, an electric bus that ran on two overhead wires, got you from Preston & Caroline to Aliceanna & Bond in 15 minutes. Today's scheduled bus takes 45, walking included. The ride is about as long. The wait is not."
- Order the page: finding, then How Kiro was used, then Trust and limits, then Design.
- Fill line 47 with the two real catches:
  - the shuffle property found that the MCP server's answer depended on row order (commit 0cfcfe9);
  - the token test caught a golden value in the draft of the Skeptic agent (0a883a7).
- Call the 38-vs-36 run a planted test.
- Add "citywide" to `BANNED_TERMS`.
- Run `/skeptic-check docs/devpost.md` until PASS.

**Who:** Kiro drafts, Emmanuel approves; Codex or Kiro adds the banned word. **Effort:** 2.5 h. **Deadline:** Nov 25.

### 5. Major. The Kiro evidence is invisible, contradictory or unverifiable, and Implementation is your strongest score

**What's wrong**
- **Hook format (UNSURE, potentially severe).** The hooks use `"trigger":"PostFileSave"/"Stop"` with `matcher`/`action` (`REPO\.kiro\hooks\copy-and-source-guard.json:8-13`). The Kiro IDE format one reviewer knows is `*.kiro.hook` with `when`/`then`. `docs\kiro-usage.md:15` says Kiro's own createHook output was "corrected" to this format. If Kiro does not load these files, the "hooks" claim collapses on camera.
- **Contradiction.** `docs\kiro-usage.md:15` says all hooks have `enabled` false. All three files now say `"enabled": true`.
- **Gaps and weak proof.**
  - "(unverified)" appears about 12 times.
  - There are no rows for the race-screen and story-layer builds (Nov 18-21).
  - There is no summary a judge can read in 60 seconds.
  - The timing section is QA bookkeeping.
- **Unticked boxes.** Several parent tasks are unchecked although every subtask is done:
  - `REPO\.kiro\specs\story-layer\tasks.md:53,108,115,124,152,159`;
  - `race-screen\tasks.md:188,192`;
  - `race-engine\tasks.md:200` still says "Not started".

**Fix:**
1. Open Kiro's Agent Hooks panel. If the three hooks are not listed, or do not fire when you save a `docs/*.md` file containing the word "live", recreate them with Kiro's own hook UI and commit the result. (10 min check.)
2. Put screenshots in `REPO\docs\kiro-evidence\`: the Hooks panel, the MCP Server view running `ghostline-gtfs`, the spec task view, the `/skeptic-check` FAIL and PASS output, and the guard hook failing on "live".
3. Commit the raw `npm run perf` and `pipeline check --timing` output.
4. Give `kiro-usage.md` a 6-row summary at the top: feature, what it did, proof path.
5. Replace each "(unverified)" with a dagger and a one-line note: "From the chat session; git holds the result, not the exchange."
6. Add the Nov 18-21 rows and a dated row for when the hooks were enabled. Move the timing section to `web\README.md`.
7. Tick only the parent tasks whose checkpoints are confirmed.

**Who:** Emmanuel (panel check, screenshots); Kiro (table, rows, ticks). **Effort:** 3 h. **Deadline:** Nov 25.

### 6. Major. Skeptic task 14 is not done, and it is your best Kiro clip

**What's wrong:** the Skeptic has only been run on the planted fixture. Its default targets, `docs/video_script.md` and `docs/devpost.md`, do not exist, so running `/skeptic-check` with no file gives "file not found".

**Evidence:** `REPO\.kiro\specs\skeptic\tasks.md:182`, `REPO\.kiro\steering\skeptic-check.md:10`, `REPO\docs\kiro-usage.md:31-33`.

**Fix:**
1. Once findings 3 and 4 exist, run `/skeptic-check` on README.md, docs/devpost.md and docs/video_script.md. Record the screen.
2. Log any real catch in kiro-usage.md. The drafts still say "7.5 minutes" and "36", so a real catch is likely.
3. Use that real catch in the video instead of, or after, the planted 38-vs-36.

Kiro clips for 1:00-2:15:
1. The `.kiro/specs` tree (4 specs), then story-layer requirements at its "supersedes race-screen" pointers.
2. The product.md honesty rules.
3. Type "live" into a docs file and save: `copy-and-source-guard` fails and names the file and line.
4. The MCP Server view: `trips_serving` answers 36.
5. `/skeptic-check` on the planted file shows FAIL, then on the real docs shows PASS.
6. The shuffle property counterexample, captioned "Replay of a real bug, commit 0cfcfe9".

**Who:** Emmanuel, in Kiro. **Effort:** 1 h to run and log, plus recording inside finding 1. **Deadline:** run Nov 25, record Nov 28.

### 7. Major. Trust holes a Baltimore local or skeptical judge will find in a minute

All headline numbers check out (codebase-details and comprehension verified them against `REPO\web\public\data\summary.json` and the lead race file). The attack surface is framing:

| Hole | Evidence | Fix |
|---|---|---|
| "34 to 39 min" holds only for the lead pair in one direction. Other pairs run 27-43, 33-43 and 34-41, and three pairs have a second route with gaps as short as 0.4 min. | lead race file; `summary.py:108-109` (gaps not exported) | Always say "for these corners, this direction". Never write "today's bus comes every 35 minutes". |
| 10:00 looks cherry-picked. The bus wait is 30.458 of a 34-39 gap, near worst case, and 10:30 is a photo finish. | lead race file | Say so in the video and Devpost (finding 1 script, 0:35). It becomes a strength. |
| Transfers and short-turn Lime trips are excluded, so a local will say "ride the short-turn and walk". | `product.md:74` | Honest-limits line in README, Devpost and About: "Today's side counts only trips with no transfer, from a stop within 400 m of each corner. A rider who changes buses, or rides part way and walks, may do better; Ghost Line does not model that." |
| Why No. 21, why 1938? 1938 was the line's first trackless-trolley year (`no21-1933.yaml:10` shows a streetcar), so it is open to a "new-service peak" attack. | no draft answers it | One sentence: "Why 1938: this guide lists No. 21 cars minute by minute with running times between corners; we use only its midday cars and do not claim 1938 was typical." UNSURE whether that was your real reason: confirm before using it. Link the public id/202 page. |
| Walk method looks padded. The UI shows 125 m but a 2.258 min walk; the 1.3 detour factor and 1.2 m/s are hidden. | `REPO\web\src\copy\copy.ts:426-428` | Change to "Estimate: straight-line {m} m from the corner to the stop, times 1.3 for street detours, at 1.2 m/s." Update the copy-table requirement and its test. |
| A photo finish still prints "Same ride, longer wait." even when today's wait is shorter (0.458 vs 6 at 10:30). | `copy.ts:149`, `product.md:47` (rule 6) | Use "Photo finish. Across this line: same ride, longer wait." This changes rule 6, so you must approve it; you will show this exact race in the video. |

**Who:** Emmanuel approves the wording; Kiro changes the two copy strings and their tests. **Effort:** 2.5 h. **Deadline:** in-app changes Nov 24; doc wording goes into findings 3 and 4.

### 8. Major. Judges' laptops and phones: the link preview, the phone view and deploy freshness

**What's wrong**
- `REPO\web\index.html:4-7` has no meta description and no og or twitter tags. A link pasted into Devpost, Slack or Discord shows a bare "Ghost Line".
- The phone has no headline: "Same ride, longer wait." is desktop-only (`ui.md:57`).
- The phone intro got longer after the screenshots (`copy.ts:497-498`). The result line had only 8.8 px to spare, and the first arrival already overflows by 35 px (`REPO\docs\story-layer-report.md:22-35`).
- The desktop About "i" button overlaps text by 15-30 px when scrolled (`story-layer-report.md:36-41`).
- No real iPhone check is recorded.
- The deployed build may predate the story layer (`story-layer-report.md:115`). The deploy fails on any type error (`.github\workflows\pages.yml:42`).

**Fix:**
1. Kiro adds og and twitter tags with an absolute `og:image` (a real screenshot saved as `web/public/og.png`). No counts and no "live" in the description.
2. Shorten the phone intro, or swap it for the existing `SAME_RIDE` headline (you approve).
3. Fix the "i" button.
4. Re-run `npm run screens` and the checkpoint spec at 375x667 and 390x844.
5. You check the Actions run is green, open the site logged out on one iPhone and one Android, watch the 10:00 race, tap a number and share. Check the font preload at `index.html:12` does not 404 (UNSURE; Vite likely rewrites it).
6. Confirm the repo is public in a private window.

**Who:** Kiro (fixes); Emmanuel (devices, Actions, repo visibility). **Effort:** 3 h Kiro, 0.5 h you. **Deadline:** Nov 24, re-checked Nov 27.

### 9. Major. Use the Codex camera footage for one labelled video beat; it's free wow

**What's wrong:** Presentation is scored first, and the app's motion lives in a 440 px column. The camera prototype (`PLAN\design-v3\camera\lead-laptop.mp4`, `lead-laptop-trolley.png`, `near-laptop-together.png`) is the most striking thing in the project. Shown carelessly, it misleads:
- the scoreboard is all caps;
- the clock shows seconds ("10:09:53 AM SCHEDULED RACE"), which suggests more precision than a 1938 timetable has;
- the two-speed clock spends about 6 s on the ride, which is the same, and about 2 s on the wait after arrival, which is the finding (`camera-notes.md:14,22-23`).

The reviewers split. Implementation-readiness said keep it out, because the storyboard rule is "only what the app shows". Design and zoom-out said use it, labelled. **Decision: use it, at most 12 s, map only, labelled.**

**Fix:**
1. Codex re-captures map-only frames (scoreboard and clock hidden).
2. Hold 3+ s on the "trolley arrived, today's passenger still waiting" moment.
3. Add the lower third "Design study. Not in the app. Movement is illustrative."
4. Add one Devpost line: "The map shot in the video is a design study driven by the same scheduled data; the app's map is flat."
5. Use `near-laptop-together` behind "the ride takes about as long".

**Who:** Codex (capture), Emmanuel (edit). **Effort:** 2 h. **Deadline:** video phase, Nov 28-29.

### 10. Major. Potential Value is your weakest score: one line, one weekday, Baltimore

**What's wrong:** nothing in the entry shows anyone besides you cares, or that the method travels.

**Evidence:**
- Outreach was drafted for Nov 20 (`PLAN\fable-final\05-outreach.md`). Whether it was sent is UNSURE.
- A reuse kit is out of scope (`product.md:73`).
- The blog and social drafts still have empty brackets (`PLAN\fable-final\06-blog-and-social.md:29-39`).

**Fix:**
1. Send 3 short emails today (Baltimore transit advocacy group, a local transit reporter, a planning professor) with the link and one question. Quote one reply in Devpost only with permission.
2. Add one Devpost sentence, as an idea, not a feature: "The pipeline needs only a scanned timetable and a GTFS feed; any city with an old timetable could run the same race."
3. Fill the blog brackets with the walk-formula stop, the shuffle bug and the token test, for any blog or social side prize. Check the rules for it (UNSURE).

**Who:** Emmanuel. **Effort:** 1.5 h. **Deadline:** emails Nov 23, blog Dec 1.

---

## Day-by-day plan (Phase 3 and Blender cut)

Nov 22 is a Sunday; Nov 26 is Thanksgiving. One block per day. If a day slips, drop its last item, not the next day's first.

| Day | Do this, in this order | Done when |
|---|---|---|
| **Mon Nov 23** | 1. Decide: cut Phase 3 and Blender (0 h). 2. Check GitHub Actions is green, the site works logged out on your phone, the repo is public, Devpost registration and Kiro credits are done (credits deadline Dec 1 noon PT per `07-request-ledger.md:130`, UNSURE). 3. Open Kiro's Hooks panel and test the guard with "live" (finding 5, step 1). 4. Send the 3 outreach emails. 5. Kiro builds the root README (finding 3). | README pushed; hooks confirmed or recreated. |
| **Tue Nov 24** | Kiro in-app batch: og tags, phone intro/headline, About "i" fix, walk-method copy, photo-finish line (if you approve), the transfers line in About, "citywide" in BANNED_TERMS. Run `npm run screens` and look at every picture. Push; confirm the deploy. | All suites green; the deployed site shows the story layer. |
| **Wed Nov 25** | 1. Write `docs/devpost.md` and `docs/video_script.md` against the live site. 2. Kiro rewrites `kiro-usage.md` (summary table, Nov 18-21 rows, hooks row, daggers) and ticks confirmed tasks. 3. Take the evidence screenshots into `docs/kiro-evidence/`. 4. `/skeptic-check` README, devpost and video_script until PASS; log real catches; tick skeptic task 14. | Three docs PASS the Skeptic. |
| **Thu Nov 26** | Thanksgiving. Rest. Buffer only for Wednesday's leftovers. | |
| **Fri Nov 27, FREEZE** | Full checks: `pipeline check`, `verify`, `check_sources`, `npm test`, `test:e2e`, `check:size`, `perf` on the deployed site. Push, confirm the deploy, tag `freeze-2026-11-27`. No code after this. | Tag pushed; site checked on 2 phones. |
| **Sat Nov 28** | Record the Kiro clips (finding 6 list). Codex re-captures the map-only camera footage (finding 9). | All raw clips on disk. |
| **Sun Nov 29** | Record the app shots from the deployed site: desktop 1280x800, phone 390x844. Record the voice-over. | |
| **Mon Nov 30** | Edit to 2:50 at most, with burned-in captions. Every number on screen must match the app. | Rough cut. |
| **Tue Dec 1** | Number check against the app, then fix the cut. Upload to YouTube (check whether Devpost requires public or unlisted; UNSURE). Fill the blog brackets if entering the side prize. | Video URL works logged out. |
| **Wed Dec 2** | Paste `docs/devpost.md` into Devpost; add the video, repo and site URL. **Submit today.** | Submitted. |
| **Thu Dec 3** | Open every link logged out, on a phone. Fix only broken links. Dec 4 is for emergencies only. | |

---

## Do not do

1. Do not start Phase 3, schema v2, bus paths, the tilted map, buildings or the moving camera in the app.
2. Do not render the Blender shot.
3. Do not edit the steering to allow 3D. The pitch is "steering holds the rules that never bend".
4. Do not build the census line, HOLC, sound, weekly-hours arithmetic, more lines, or a "1938 timetable as GTFS export". The export is a good idea, but you have no time for it.
5. Do not write "live", "real-time", "citywide", "every 7.5 minutes", "came every", "ran every", or any "Baltimore buses come every N minutes" in any doc, voice-over or caption.
6. Do not show any number in the video that is not on screen in the app or in `summary.json`. That rules out "87 trips", "about 36" and "fifty-five hundred".
7. Do not show the Codex footage without the "Design study. Not in the app." label, or with its scoreboard and seconds clock visible.
8. Do not present the planted 38-vs-36 fixture as a real catch, or the property-test replay as live.
9. Do not edit a golden value, facts file or test to make anything pass. Stop and decide.
10. Do not touch code after the Nov 27 tag except for a broken deploy.
11. Do not submit on Dec 4.

---

## UNSURE items, collected

- Whether Kiro loads the current hook JSON format (finding 5). Check the panel first.
- Whether the deployed site is current with commit d0c9d46, and whether the repo is public.
- The Kiro credits deadline and Devpost's video visibility rule.
- Your real reason for choosing No. 21 and 1938. Confirm it before using the suggested sentence.
- Whether the Charm City Circulator serves these corners (it is not in the MTA feed).
- Rights to show the id/202 scan in the video.
- Whether the font preload path 404s on Pages.
- Whether this entry wins. It is a strong contender if findings 1-6 land; it is not a lock.

## Reviewer status

| Reviewer | Status |
|---|---|
| `egm-zoom-out` | completed |
| `egm-design` | completed |
| `egm-comprehension` | completed |
| `egm-implementation-readiness` | completed |
| `egm-codebase-details` | completed |
| `egm-style` | completed |
| `egm-structural` | not used (its document-structure lens overlapped with style for these drafts) |

Severity breakdown of the top 10: 4 Blockers (1-4), 6 Major (5-10). Smaller nits (unticked tasks, internal reports in `docs/`, the stale `03c-kiro-usage-table.md` and `00-START-HERE.md:84`) are folded into findings 3 to 5.
