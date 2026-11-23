# Ghost Line: the win plan

Nov 22, 2026. This is the one plan; it replaces every earlier plan. It merges:
- the Elephant Goldfish attack (six reviewers, `attack\goldfish-report.md`);
- the research on past Kiro winners (`attack\past-winners.md`, summarised in section 9);
- my own review;
- Codex's camera work.

---

## 1. The honest verdict
- **As of today, the entry would lose,** and not because of the app. The three things judges see first (the video, the Devpost page, the README) don't exist yet.
- **The Kiro work is already better than most entries will have:** four specs, five steering files, three hooks, an MCP server reading the real feed, and a read-only Skeptic agent that catches planted errors. Every headline number checks out against the data.
- **To win, the story has to land in the first 20 seconds and stay in people's heads.** This plan does that with one image (section 2), a tight video (section 5), and putting the Kiro proof where judges can see it.
- **Not a sure win.** Nobody can promise that. It's a real contender for the Resurrection prize if sections 3 to 5 land.

## 2. The one idea people won't forget
> **Two people leave the same corner at 10:00. While today's rider waits for the bus, four 1938 trolleys go by.**

It's all scheduled data (lead pair, weekday as of Nov 4, 2026):
- the 1938 cars were scheduled past Preston & Caroline at **10:06, 10:13, 10:21 and 10:28**;
- today's one-seat bus is scheduled to leave stop 8564 at **10:32:43**.

So the image is literal: ghosts of the old line keep passing the waiting rider, and then the bus comes. It's the Kiroween theme (ghosts) and the Resurrection theme (a dead line brought back), and it's the finding (the difference is the wait), all in one picture.

It goes into the **real app** as faint ghost trolleys gliding down the route while a counter ticks 1, 2, 3, 4. It costs half a day of Kiro, with no 3D and no new data. It also goes into the video, both from the app and in the cinematic shot.

## 3. What we build, and what we drop
| Build (app) | Why |
| --- | --- |
| Ghost cars during the wait (brief 08) | The unforgettable moment, honest and cheap. |
| Root README with a real screenshot (09, P1) | Judges open GitHub and currently see a bare file list. |
| Kiro evidence: summary table, screenshots, fixed contradictions (09, P2 and P8) | Implementation is your strongest score; make it visible in 60 seconds. |
| Trust wording: walk method, photo-finish line, honest limits, "citywide" banned (09, P3) | One wrong claim makes a judge discount everything else. |
| Link previews, phone headline, the "i" overlap fix (09, P4) | The first view on a judge's laptop and phone. |
| Devpost text and video script, Skeptic-checked to PASS (09, P7) | Your best Kiro clip is the Skeptic checking your *real* docs. |

| Drop or park | Why |
| --- | --- |
| The 3D map race in the app (draft 07 parked; draft 05) | It needs a new data schema and 3D, and it fights the freeze. It ran at 30 fps on your laptop, so it would likely fall back to flat on camera. The ghost cars deliver the moment without the risk. |
| The moving camera in the app | Same reasons. Codex's footage goes in the video instead, labelled. |
| Census, HOLC, sound in the app, more lines | No time, and they wouldn't move the score. |

**Blender:** optional. Codex builds it on its own credits. If the film comes out beautiful, it's the 15-second resurrection beat in the video. If not, use Codex's camera footage instead. **Don't spend your own hours on it.**

## 4. The calendar (do one row a day)
| Day | You do | Kiro does | Codex does |
| --- | --- | --- | --- |
| **Sun Nov 22, tonight** | Steps 1 to 3 in section 6 (10 min) | starts P1 | starts the Blender film (new chat) |
| **Mon Nov 23** | Check the site works on your phone, logged out, and that the repo is public. Open Kiro's Hooks panel. | P1 README, P2 evidence | Blender film |
| **Tue Nov 24** | Look at the pictures Kiro shows you and say yes or no. | P3 trust wording, P4 first impression, P5 deploy, P6 ghost cars | map-only camera footage (step 5) |
| **Wed Nov 25** | P8 screenshots (20 min) | P6 ghost cars finish, P7 docs and the Skeptic until PASS | |
| **Thu Nov 26** | Buffer for anything left over | buffer | |
| **Fri Nov 27, FREEZE** | Say "freeze" to Kiro (step 6) | all checks, tag, deploy | |
| **Sat Nov 28** | Record the Kiro clips (section 5) | | |
| **Sun Nov 29** | Record the app shots and the voice-over | | |
| **Mon Nov 30** | Edit the video to 2:50 at most, with captions | | |
| **Tue Dec 1** | Check every number against the app; upload to YouTube | | |
| **Wed Dec 2** | Paste `docs/devpost.md` into Devpost, add the links. **SUBMIT.** | | |
| **Thu Dec 3** | Open every link logged out, on a phone | | |

Dec 4 is for emergencies only. Never submit on the last day.

## 5. The video (2:50)
The rule: **every number on screen is in the app or in `summary.json`**. The cinematic shots are labelled.

| Time | Picture | Voice-over (your voice, or a Baltimore rider's) |
| --- | --- | --- |
| 0:00-0:10 | The real app on desktop: the lead race finishing, "1938 wins by 30". | "If you ride the bus on Caroline Street in Baltimore, this is your morning. Ten o'clock, same two corners. The 1938 trolley: fifteen minutes. Today's scheduled bus: forty-five, walking included." (Who it's for and what hurts, inside 10 seconds, as every winner did.) |
| 0:10-0:25 | **The ghost moment, in the app:** replay with the faint trolleys gliding by and the counter ticking to 4. | "Both riders leave the corner at ten. Today's rider walks to the stop and waits. In 1938, four trolleys were scheduled past this corner before today's bus leaves." |
| 0:25-0:40 | **Cinematic:** the Blender film or Codex's camera chase down Caroline Street, with the lower third "Illustration. Today's streets and buildings. Scheduled times." | "The No. 21 trackless trolley, an electric bus on two overhead wires, is gone from Baltimore. Ghost Line brings back its 1938 timetable and races it against today's schedule." |
| 0:40-0:55 | The app: "Same ride, longer wait."; drag the slider across the chart. | "The ride takes about as long, in 17 of 20 pairs of corners. The difference is the wait. In the 1938 timetable a car was scheduled every seven or eight minutes. For these corners today, the one-seat buses are scheduled thirty-four to thirty-nine minutes apart." |
| 0:55-1:10 | Drag to 10:30: a photo finish. Then "Show a race today wins". | "Ten o'clock is a bad minute for the bus. At half past, it's a photo finish. Across every covered start, the trolley gets there first in 5,582 of 5,666. When today wins, it looks exactly the same." |
| 1:10-1:20 | Tap a number; the Sources sheet opens. | "Every number is one tap from its source. Scheduled, not live." |
| 1:20-2:30 | **Kiro, about 70 s,** screen recordings with captions. | Short lines: "Kiro built it from four specs. The honesty rules live in steering." The hook catches the word "live" on save. "We built an MCP server that reads the real transit feed": `trips_serving` answers 36. "And a Skeptic agent that checks our own words against it": FAIL on the planted file, then PASS on the real docs. "Property tests caught a real bug" (the replay of commit 0cfcfe9). |
| 2:30-2:42 | Text on the trolley drawing. | "One line, one weekday, scheduled times only, no transfers." |
| 2:42-2:50 | The glowing trolley under its wires, then the URL. | "Ghost Line." |

**Never say:** "live", "real-time", "citywide", "every 7.5 minutes", "came every", "ran every", "buses come every N minutes". **Never show:** a number that isn't in the app, the Codex footage without its label, or the planted 38-vs-36 presented as a real catch.

**Sound makes or breaks it:** a low electric hum under the trolley, a soft bell at each ghost, a ticking clock under the wait, quiet music. Use free music and sound, for example the YouTube Audio Library.

## 6. Exactly what to paste, in order

**Step 1. Copy the briefs into the repo, so Kiro can read them.** Run this in PowerShell:
```powershell
$s="$HOME\Documents\Ghost Line Chat 2"; $d="$HOME\Projects\Ghost line\docs\planning\final"; New-Item -ItemType Directory -Force $d | Out-Null; Copy-Item "$s\WIN-PLAN.md","$s\attack\goldfish-report.md","$s\attack\past-winners.md","$s\upgrade-draft\08-ghost-cars-brief.md","$s\upgrade-draft\09-judge-polish-brief.md","$s\fable-final\03a-devpost-writeup.md","$s\fable-final\03b-README-draft.md","$s\fable-final\04-video-storyboard.md" $d
```

**Step 2. Paste into Kiro:**
```
Read docs/planning/final/09-judge-polish-brief.md and do it in order, P1 to P7, starting with P1 now. It references docs/planning/final/goldfish-report.md for evidence and docs/planning/final/08-ghost-cars-brief.md for P6. Commit docs/planning/final/ first as one commit. Follow steering; never edit a golden value, the facts file or a test to make something pass — stop and tell me. Commit each task separately, push at the end of each day, and tell me the deployed commit hash. Show me pictures whenever the brief says "show Emmanuel".
```

**Step 3. Paste into a NEW Codex chat** (started in `Documents\Ghost Line Chat 2`): the whole of `codex-blender-prompt.md` below its line.

**Step 4. When Kiro shows you pictures:** say yes if they look right, or tell it what's wrong in one sentence.

**Step 5. Nov 24, paste into Codex** (any chat, started in `design-v3`):
```
In camera/, capture map-only versions of lead-laptop.mp4 and near-laptop.mp4: hide the scoreboard card, the clock chip, the caption and all buttons, and keep only the map, the markers, the trails and the small attribution. Add the lower third "Illustration. Today's streets and buildings. Scheduled times." Hold for 3 extra seconds on the moment the trolley has arrived and today's passenger is still waiting. Save them as camera/video-lead-maponly.mp4 and camera/video-near-maponly.mp4 at 1920 x 1080, 30 fps. Change nothing else.
```

**Step 6. Nov 27, paste into Kiro:** `Do the Freeze section of docs/planning/final/09-judge-polish-brief.md.`

## 7. Decisions I made for you (say no to any, otherwise they stand)
1. The 3D map race and the moving camera stay out of the app; the ghost cars go in.
2. The photo-finish line becomes "Photo finish. Across this line: same ride, longer wait." (This changes product rule 6.)
3. The walk line shows its method (×1.3 detours, 1.2 m/s).
4. "Why 1938": "This guide lists the No. 21's cars minute by minute, with running times between corners." **⚠ If you had a different real reason, tell me.**
5. The cinematic shots are in the video only, always labelled.
6. Submit on Dec 2, not Dec 3 or 4.

## 9. What past Kiro winners teach us (research, `attack\past-winners.md`)

**The 2026 scoring:** five criteria worth 20% each: Potential Impact, Technological Implementation, Design, Innovation/Idea and Presentation. Best Resurrection pays $5,000. No judge comments were ever published, so the patterns below are read from the winners themselves.

1. **Resurrection winners revive something for people living today.** Faxi, the 2025 Resurrection winner, brought fax back for offline seniors in Japan. Pure nostalgia revivals (ELIZA, MS Paint, COBOL) won only blog prizes.
   - **So:** always say both halves. The dead technology is the No. 21 trackless trolley and its 7-or-8-minute timetable. The living people are today's riders on Caroline Street. The Devpost opening and the video's first line say both.
2. **Who it's for and what hurts, inside 10 seconds.** Faxi did it by 0:09. No winner opened with a tour of Kiro.
   - **So:** the first line of the video names the rider (section 5).
3. **Open on a finished-looking screen.** Design is its own 20%.
   - **So:** the video opens on the real app, not on code or a title card.
4. **Video:** winners ran 1:56 to 3:00, and judges "are not required to watch beyond three minutes".
   - **So:** 2:30 to 2:55. Ours is 2:50; never go over.
5. **Public datasets earn Innovation points.** The 2026 criterion names them.
   - **So:** name both datasets on screen and in the README: the MTA's public GTFS feed (version 20260821) and the 1938 timetable scan.
6. **Kiro write-ups that win are concrete and countable,** and answer every prompt in the rules.
   - **Ours:** 4 specs, 5 steering files, 3 hooks, 1 custom MCP server, 1 read-only custom agent, and property-based tests that caught real bugs.
   - Answer each prompt: specs vs vibe coding, hooks, steering, MCP, property-based testing, powers, Crew. If we didn't use powers or Crew, say so in one honest line.
7. **Quote one spec line that shaped the design, and say honestly where Kiro went wrong.**
   - **Spec line:** the stop-and-report rule ("never edit a golden value").
   - **Honest misses:** the walk-formula mismatch Kiro stopped on, the createHook output that needed correcting, and the golden value that slipped into the Skeptic draft and was caught by a test.
8. **Keep the site up until judging ends, Jan 29, 2027.** Judges may score from the video and text alone, so both must show the whole race working.

**Stage One is pass/fail. Miss one and you're out.**

| Rule | Status |
| --- | --- |
| Public GitHub repo | ✔ github.com/Optimistic-max/Ghost-Line. Check it opens in a private window. |
| Licence visible in the repo's About box | ✔ MIT LICENSE is committed. Check GitHub shows "MIT license" on the repo page. |
| `.kiro` at the root, not gitignored | ✔ checked: 26 files tracked, not in .gitignore |
| Project started on or after Oct 30 | ✔ first commit Nov 15, 2026 |
| Working URL | ✔ GitHub Pages. Keep it up until Jan 29, 2027. |
| **Public** YouTube video under 3 minutes | ⬜ Dec 1. Public, not unlisted or private. |
| Kiro write-up | ⬜ docs/devpost.md (09, P7) |
| Kiro credits request | ⬜ **due Dec 1**, if you need credits |

**Extra prizes to stack:**
- **Best Student Project: Resurrection ($1,500 plus a year of Kiro Pro Max):** Emmanuel is a student, so **enter it.** When you submit on Devpost, tick the student category, and check whether the form asks for proof (a student email or ID). ⚠ That proof rule is unverified, so read the submission form.
- **The blog prize:** 100 winners in 2026. Turn `fable-final\06-blog-and-social.md` into a post on Dec 1, filling its blanks with the three real Kiro catches.
- **Best Demo:** judged automatically from the video.

## 8. One thing only you can do (optional, high value)
Send three short emails today, to a Baltimore transit advocacy group, a local transit reporter and a planning professor, with the link and one question. A single real reply, quoted with permission, lifts your weakest score (Potential Value). Drafts are in `fable-final\05-outreach.md`.
