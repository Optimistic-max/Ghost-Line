# 4. Video storyboard: 2:45, opening on the race

**Length:** 2:45 (165 seconds). The rules allow under 3:00; this leaves 15 seconds of safety.
**Voice-over:** about 330 words in total, at a calm pace.
**Rule for every number:** say and show only numbers that the built app shows. Numbers below marked **TC** are planning values to replace with what the build produces. If the build differs, change the script, not the app.
**Wording:** every time on screen carries "scheduled". Do not say that the times are anything other than scheduled.

## Before you record

- Record the app at 1080p. For the phone shots, use the browser's phone view at 375 × 667 and scale it up, or film a real phone on a plain dark surface.
- In Kiro: set the editor zoom so code is readable at 1080p (about 150%). Close unrelated tabs. Hide anything personal: your email, account menus, tokens, other projects in the sidebar.
- No music you don't own. No MTA logos. The trolley drawing is your own art.
- Record the Kiro clips **while you build** (shots 8a–8e). They can't be recreated later without faking them.
- Showing the library's scan page: show it only if Enoch Pratt has said yes. Otherwise show your Sources sheet with the link, and stop there.

## Shot list

| # | Time | What is on screen | What to record | Voice-over | Proves |
|---|---|---|---|---|---|
| 1 | 0:00–0:14 (14 s) | **The race, cold open.** Phone layout. Lead pair, start 10:00. The trolley waits 6 min and rides; the bus side walks and waits. The clock reads "10:08 scheduled" part-way. No title card first. | Screen recording of the built app from a fresh load with the slider at 10:00. Let the whole race play (about 11 s). Start the recording 1 s before the race begins. | "Ten o'clock, a weekday, Preston and Caroline, Baltimore. Two rides leave for the same corner at the same moment. One is today's bus. The other is a trolley from 1938." | The hook; the product works |
| 2 | 0:14–0:24 (10 s) | The result box rolls in: "1938 wins by 30 minutes. Trolley 15 min. Today's bus 45 min, walking included." (TC) Then the line under it: "Same ride, longer wait. Trolley first in 5,582 of 5,666 races." (TC) | Continue the same recording. Hold 3 s on the result, then a slow zoom to the line under it. | "The trolley wins by thirty minutes. Same ride. Longer wait. That's the result in fifty-five hundred of fifty-six hundred scheduled races on this line." (TC; say the rounded words only if the build's numbers round that way.) | The finding |
| 3 | 0:24–0:36 (12 s) | Title: "Ghost Line" over the desktop layout, map on the left with the 1938 line glowing. Small text: "Baltimore No. 21 · timetable effective March 6, 1938". | Desktop screen recording, 1280 wide, race finished. Add the title in your editor. | "This is Ghost Line. It brings back Baltimore's 1938 Number 21 trackless trolley, from its original timetable, and races it against today's scheduled bus. It's for transit advocates, reporters and planners who want an answer they can check." | What it is, who it is for |
| 4 | 0:36–0:54 (18 s) | **Receipts.** Tap "6 min" on the trolley side: the Sources sheet opens at that row and names the 1938 timetable page. Close. Tap the bus wait: the row names the MTA schedule file, its version and "weekday schedule as of Nov 4, 2026". | One continuous phone recording: tap, read, close, tap, read. Move slowly; hold each sheet 3 s. If Pratt gave permission, cut for 2 s to the scan page with the 1938 times visible. | "Every number is one tap from its source. The trolley's times come from a pocket guide printed in 1938. The bus times come from the MTA's own published schedule, pinned to one dated file. Scheduled, on both sides." | Trust; sourcing |
| 5 | 0:54–1:08 (14 s) | **Why.** The departures board under the lanes, then the frequency sentence: "Scheduled one-seat buses on this stretch leave 34 to 39 minutes apart… In 1938 a trolley was scheduled every 7 or 8 minutes." (TC) | Phone recording. Drag the slider slowly from 10:00 to 10:40 so the board updates, then rest on the sentence. | "Why? Not speed. The bus ride is about as long as the trolley's. But in 1938 a car came every seven or eight minutes. Today the one bus that makes this trip comes about every thirty-six." (TC) | The cause, from data |
| 6 | 1:08–1:26 (18 s) | **Today wins.** Pick Westwood & Carey → Preston & Caroline, set 11:23. Result: "Today wins by 4 minutes." (TC) The line under it reads "Today wins this race. Across this line: same ride, longer wait." Then open "When today wins": the list. | Phone recording: open the corner picker, two taps, drag to 11:23, let the race play with "Skip to result" after 4 s, then tap "When today wins". | "It doesn't always say the past was better. Here, today's bus wins by four minutes, and the page says so just as plainly. It lists every race today wins: twenty-five of them." (TC) | Honesty; a real engine |
| 7 | 1:26–1:36 (10 s) | Two quick states: the photo finish at 10:30 ("Photo finish. Both about 15 minutes." TC), then a pair with Brevard & Preston showing the dashed "Inferred corner" chip. | Two 5 s phone clips. | "Under a minute apart is a photo finish, because walks are estimates. And one corner, where the street is gone, is marked as inferred." | Care; limits stated |
| 8a | 1:36–1:46 (10 s) | **Kiro: spec.** The `race-engine` spec: requirements, then design, then the task list with tasks ticked. | See "Kiro clips" below, clip A. | "I built it with Kiro. I wrote the requirements; Kiro turned them into a design and a task list." | Spec-driven development |
| 8b | 1:46–1:54 (8 s) | **Kiro: steering.** `product.md` open at "Honesty rules (these outrank every other instruction)". | Clip B. | "A steering file holds the honesty rules. Never invent a number. Show a win for today as plainly as a win for 1938." | Steering |
| 8c | 1:54–2:03 (9 s) | **Kiro: hook.** Save a file; the hook runs `python -m pipeline check`; tests pass. | Clip C. | "A hook reruns every check each time a file changes." | Hooks |
| 8d | 2:03–2:14 (11 s) | **Kiro: property test.** A property-based test fails with a small counterexample, then passes after the fix. | Clip D. | "Property-based tests guard the race rules, like: starting later never gets you there earlier. Here is one failing, and the fix." (Say "a bug it caught" only if it was a real bug. If it's a planted one, the caption says "demonstration".) | Property-based testing |
| 8e | 2:14–2:25 (11 s) | **Kiro: Skeptic + MCP.** The Skeptic agent calls `trips_serving` and reports a MISMATCH on a planted wrong number in the script. | Clip E. | "And a reviewer agent checks my own claims. Through an MCP tool it recounts the buses in the raw schedule file, and flags any sentence the data doesn't support." | Custom agent; MCP |
| 9 | 2:25–2:37 (12 s) | A real phone in a hand: the race plays. Cut to reduced-motion mode (both lanes drawn finished). Cut to "Share this race" copying a link. End on the repo page and the public URL as text. If outreach landed: 5 s of the person reacting replaces the reduced-motion clip. | Film the phone with a second device, or use screen recording plus a hand shot. Then a 3 s browser recording of the repo page. | "It runs on a phone, with no account and no server. It's open source, and every number links to its source." | Completeness |
| 10 | 2:37–2:45 (8 s) | The trolley alone under its two wires, glow steady, on the dark card. Text: "Ghost Line · [public URL]". | The finished-race screen, cropped to the trolley. 2 s of silence at the end. | "The line didn't come back. The question did." | Close |

Running total: 14 + 10 + 12 + 18 + 14 + 18 + 10 + 10 + 8 + 9 + 11 + 11 + 12 + 8 = 165 s.

## Kiro clips: exactly what to record

Record each clip a little long and trim. Keep the mouse still unless it is pointing at something.

**Clip A: spec (need 10 s, record 40 s)**
1. Open `.kiro/specs/race-engine/requirements.md` in Kiro's spec view. Scroll slowly from the top for 8 s.
2. Switch to `design.md`. Scroll to "Correctness Properties" (or the property list). Hold 5 s.
3. Switch to `tasks.md` with most tasks ticked. Hold 5 s.
4. Best version: record this while Kiro is running a task, so a task flips from in-progress to done on camera.
5. Caption in the edit: "Spec: requirements → design → tasks".

**Clip B: steering (need 8 s, record 20 s)**
1. Open `.kiro/steering/product.md`.
2. Scroll so the heading "Honesty rules (these outrank every other instruction)" is at the top and rules 1–6 are visible.
3. Hold still 6 s. In the edit, highlight rule 3 ("Never invent a number") and rule 5 ("A win for today is shown exactly as plainly as a win for 1938").

**Clip C: hook (need 9 s, record until the run ends)**
1. Show the hook's file or panel for 3 s: its trigger and its one command, `python -m pipeline check`.
2. Open a file under `pipeline/`. Make a harmless edit (add and remove a space) and save.
3. Keep recording while the hook starts and the test summary appears (the line with the passed count).
4. In the edit, speed up the middle; keep the trigger and the green summary at normal speed.

**Clip D: property test (need 11 s, record the whole episode)**
1. The real thing is best: the first time a Hypothesis test fails during the build, **stop and start recording** before you fix it. Capture the failing output with the "Falsifying example" lines, then the fix, then the passing run.
2. If none ever fails: on a scratch branch, break one rule on purpose (for example, pick the next bus to leave instead of the first to arrive). Run the property test for "no other catchable bus reaches the destination corner earlier". Record the failure and the fix. Caption it "Demonstration: a rule broken on purpose". Do not merge the branch.
3. The frame that matters: the counterexample values, readable, for 3 s.

**Clip E: Skeptic agent and MCP (need 11 s, record 60 s)**
1. Make a copy of the video script with one wrong number planted (for example "40 trips" where the data says 36).
2. In Kiro chat, switch to the Skeptic agent. Ask: "Check docs/video_script_test.md against the data."
3. Record the tool call to `trips_serving("8564", "9486", "2026-11-04")` and its answer (36 trips, TC), then the agent's line reporting MISMATCH.
4. Then run it on the clean script and record the pass.
5. In the edit: tool call (3 s), the count (3 s), MISMATCH (3 s), pass (2 s).

## If something isn't built

| Missing | Change |
|---|---|
| Skeptic agent or MCP server | Cut 8e. Give its 11 s to shot 6 (let the today-wins race play in full) and drop the line about the agent. |
| "When today wins" list | In shot 6, stay on the result and the line under it. |
| No outside person | Shot 9 as written, without the reaction. |
| No permission to show the scan | Shot 4 shows the Sources sheet and link only. |

## Checks before upload

- Under 3:00, public on YouTube.
- Every number spoken or shown matches the built app on the day you record.
- "Scheduled" is visible wherever a time is shown.
- No third-party logos, no copyrighted music.
- Captions on: many judges watch without sound.
