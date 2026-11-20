# Ghost Line: screen brief (Brief 2, the race screen)

**What this file is.** A planning brief written on November 15, 2026, with Claude Code, before the Kiro build started. The first part is the feature brief to give to Kiro's spec flow. The rest is the reference it points to: every screen state and its wording (section 2) and the visual direction (section 3). The pictures in `ui-mockups/` show the intended look. They are images only; there is no markup or styling to copy, and the site is built in Kiro.

Marks: **[C]** = computed during planning from the pinned feed (an expected value, not text to copy); **[F]** = from the facts files; **[A]** = a design judgment.

---

## Brief 2: feature brief for the `race-screen` spec

```text
Feature: race screen (the website)

Build the one-screen site in web/ that plays a race from the JSON files written
by the race engine. Follow the steering files, especially ui.md. The layout,
every state, the exact wording, the desktop layout and the motion spec are in
docs/planning/screen-brief.md, sections 2, 3 and 3A (3A wins where they differ). The pictures in docs/planning/ui-mockups/ show the intended
look on a phone and on a laptop; match them closely. The site must work at
both sizes: phone layout below 900 px wide, desktop layout from 900 px up. The data file formats are in
docs/planning/race-brief.md, section 4. The browser never does race
arithmetic: it looks up the row for the chosen pair and minute, rounds for
display, and animates.

What the visitor can do
1. See a race start by itself on first load, for Preston & Caroline to
   Aliceanna & Bond, without waiting for the map.
2. Move a time slider from 9:00 to 13:52 in one-minute steps, by dragging or
   with minus and plus buttons. Default: the time now in America/New_York if it
   is inside the range, otherwise 10:00, and the screen says which.
3. Pick any two different corners from a list of five, or by tapping the map,
   and swap direction with one tap.
4. Tap any number to open the Sources sheet at that number's row: what it is,
   where it comes from with a link, how it was worked out, the data date.
5. Copy a share link that holds only the two corners. Opening it selects that
   pair; a bad link falls back to the default pair and says so.
6. Open About and credits.

States the screen must handle, each with fixed wording
loading; ready; racing; 1938 wins; today wins; photo finish; before the midday
table; no one-seat ride; inferred corner; share link opened; bad share link;
data error; map unavailable.

Rules that must always hold (please turn these into correctness properties)
- encode then decode returns the same pair, for all 20 pairs; decode never
  throws on any text.
- The default time is inside 9:00 to 13:52 for every possible clock time.
- Every number rendered on the card has a matching row in the Sources sheet.
- Display rounding (section 2.10): the shown parts of a trip always add up to
  its shown total, every shown part is within one minute of its stored value,
  and the shown margin equals the difference of the two shown totals.
- Every count on screen (for example "5,582 of 5,666 races") is read from
  summary.json. With a test summary.json holding different numbers, the screen
  shows those numbers; no count is written into the code or the copy strings.
- The words live, real-time, realtime, "arriving now" and "right now" never
  appear in any rendered text, except in the fixed phrase "Scheduled, not live."
- If a data file fails its shape check, no number is rendered at all.

Accessibility
Works by keyboard alone and with a screen reader; the result is announced once
when the race ends; with reduced motion there is no animation; text contrast is
at least 4.5:1. Add an automated accessibility check to the tests.

Not in this spec
"Why is it slower?", the census sentence, the HOLC layer, anything 3D.

Done when
The deployed GitHub Pages URL starts the first race within 5 seconds on a
throttled phone profile, every state above can be reached in a test, and the
site still plays a race with the map blocked.
```

---

## 2. UX: every screen and state at 375 px

The app is one screen: a map area on top, a race card below, and three bottom sheets (sources, corners, about). The race starts by itself on first load, so a visitor sees the trolley move with zero taps.

All example numbers in this section are **[C]** for the lead pair. In the app every number comes from the data files, never from this document.

### 2.1 Layout (375 × 667 px, portrait)

| Zone | Height | Contents |
| --- | --- | --- |
| Top bar | 40 px | "Ghost Line" · "No. 21, 1938" · an info button (opens About and credits) |
| Map | 122 px | The 1938 route, five corner dots, the chosen pair highlighted. Tapping a corner opens the corner picker. |
| Race card | the rest | Pair row · time slider · two lanes · result box · honest line · two buttons pinned at the bottom: Sources, Share this race |

Nothing scrolls sideways. Every tap target is at least 44 × 44 px.

### 2.2 Tap counts

| Goal | Taps |
| --- | --- |
| See a race | 0 (auto-starts on load) |
| Change the start time | 1 drag, or taps on the − and + minute buttons |
| Swap direction | 1 (the swap button in the pair row) |
| Pick a different pair | 3 (open picker, origin, destination) |
| See the source of any number | 1 (tap the number) |
| Copy a share link | 1 |

### 2.3 The lanes

Each lane is one horizontal bar split into labeled phases, with the vehicle icon travelling along it.

- **1938 lane:** wait → ride. No walk; the rider boarded at the corner.
- **Today lane:** walk to stop → wait → ride → walk from stop.

Bar length is proportional to minutes, on one shared scale, so the longer trip is visibly longer. The ride segments are nearly the same length and the wait segment is not; that picture is the argument of the app.

The race plays at 1 second per 4 scheduled minutes, capped so no race lasts more than 12 seconds [A]. A "Skip to result" button is always visible.

### 2.4 States and copy

| State | When | What the card says |
| --- | --- | --- |
| **Loading** | Before the race file arrives | Pair names are already in the HTML. Under them: "Loading the 1938 timetable…" After 3 s without data, show the data-error state. |
| **Ready** | Data loaded, race about to start | Under the slider: "Weekday schedule as of Nov 4, 2026. Scheduled, not live." If the time came from the clock, add "Start time is the time now." |
| **Racing** | Animation running | 1938 lane: "Waiting 6 min · next car 10:06 (scheduled)" then "Riding 9 min (scheduled)". Today lane: "Walking to the stop 2 min (estimate)" then "Waiting 31 min · next bus 10:32 (scheduled)" then "Riding 8 min (scheduled)" then "Walking from the stop 4 min (estimate)". |
| **Finished, 1938 faster** | Difference of 1 minute or more | "**1938 wins by 30 minutes.** Trolley 15 min. Today's bus 45 min, walking included." |
| **Finished, today faster** | Today ahead by 1 minute or more | "**Today wins by 4 minutes.** Today's bus 24 min, walking included. Trolley 28 min." Same size, weight and position as a 1938 win. (Real case: Westwood & Carey → Preston & Caroline at 11:23.) |
| **Photo finish** | Difference under 1 minute | "**Photo finish.** Both about 15 minutes." (Real case: lead pair at 10:30, 15.0 against 15.2.) Walks are estimates, so a gap under a minute is not a real win for either side. |
| **Before the midday table** | Slider time is earlier than the first listed 1938 car at this corner | "The 1938 midday timetable reaches this corner at 9:21. Both sides race from 9:21." The slider thumb does not move; the lanes show 9:21 as the start. |
| **No one-seat ride** | No single bus links the two corners that day | "**No one-seat ride today.** No single scheduled bus links these corners on this weekday schedule. Routes that stop nearby: {list}." The 1938 lane still shows its time. No winner is declared. |
| **Inferred corner** | The pair includes Brevard & Preston | A chip "Inferred corner" by the name, and one line: "Brevard Street is gone. This corner's position is our best reading of the 1938 diagram, so times to and from it are less certain." The route there is dashed. |
| **Share link opened** | URL carries a valid pair | A banner for 5 s: "Shared race: Preston & Caroline → Aliceanna & Bond." The start time follows the normal default; the link carries no time. |
| **Bad share link** | URL pair unknown, or origin = destination | "That link's corners weren't recognized. Showing Preston & Caroline → Aliceanna & Bond." |
| **Data error** | A data file failed to load or failed its shape check | "The timetable data didn't load. Check your connection and try again." plus a "Try again" button. **No number appears anywhere on the screen**: no times, no totals, no counts, no "No. 21, 1938" in the top bar, and the trolley is drawn without its route number. Corner names stay. |
| **Map unavailable** | Tiles or WebGL unavailable | The map area shows the bundled route drawing. The race is unaffected. Small text: "Map unavailable. Showing the route diagram." |

The "no one-seat ride" state cannot be reached with the pinned feed at 400 m [C]. Build it and test it with the fake fixture line.

### 2.5 The honest line

It sits under the result on every race. Its numbers are read from `summary.json`:

> **Same ride, longer wait.** Trolley first in {wins_1938} of {races} races. [When today wins]

When today wins the race on screen, the line must not open with a sentence that seems to contradict the result. Use this instead:

> **Today wins this race.** Across this line: same ride, longer wait. Trolley first in {wins_1938} of {races} races. [When today wins]

A photo finish and "no one-seat ride" use the first form. Never write "citywide" or anything that suggests the whole city: the count covers this line's 20 corner pairs only, and "across this line" is the only scope wording allowed.

"When today wins" opens a list. It starts with one sentence: "On {ride_same} of 20 corner pairs today's scheduled ride is about as long as in 1938; on {ride_faster} it is faster." Then every pair and start time where today is ahead, each one tap from its race.

Expected values are in section 5.6.

### 2.6 Wording for the bus frequency

Never write a fixed number of minutes. Fill this from the race file for the pair and direction on screen:

> Scheduled one-seat buses on this stretch leave {gap_min} to {gap_max} minutes apart between 9:00 AM and 2:00 PM ({route}, weekday schedule as of Nov 4, 2026). In 1938 a trolley was scheduled every 7 or 8 minutes.

Expected [C]: lead pair eastbound 34 to 39 (CityLink Lime to Harbor East); westbound 27 to 43. If gap_min equals gap_max, write "{gap} minutes apart".

### 2.7 The source sheet ("source one tap away")

Every number on the card is a button with a dotted underline. Tapping it opens the Sources sheet scrolled to that number's row. Each row has four parts:

1. The value and what it is: "9 min · scheduled 1938 ride, Preston & Caroline to Aliceanna & Bond".
2. Where it comes from: "1938 route diagram, page 6", with a link that opens the Digital Maryland page in a new tab.
3. How it was worked out, in one line: "Sum of the diagram's segment minutes between the two corners."
4. The date of the data: "Effective March 6, 1938" or "MTA feed version 20260821, service date Wed Nov 4, 2026".

Walk times carry the word "estimate" and the formula: straight-line metres × 1.3 ÷ 1.2 m/s.

The sheet's last row is always "Sources and credits", which opens the credits list (2.9).

### 2.8 Accessibility

- **Reduced motion:** no animation. Both lanes are drawn finished, as static bars, and the result shows at once.
- **Screen reader:** the result region is `aria-live="polite"` and speaks once, when the race ends: "Race result. Preston and Caroline to Aliceanna and Bond, starting 10:00 AM. 1938 trackless trolley: 15 minutes. Today's bus: 45 minutes, including 6 minutes of walking. 1938 was faster by 30 minutes. All times are scheduled." Nothing is announced during the animation.
- **Slider:** a native range input, one-minute steps, with `aria-valuetext` such as "10:00 AM, scheduled weekday time", plus − and + buttons.
- **Number buttons:** each has a label such as "9 minutes, scheduled 1938 ride. Show source."
- **No map needed:** the corner picker is a plain list of five buttons, so the whole app works by keyboard and without WebGL.
- **Not by colour alone:** each phase segment has a text label; the inferred stretch is dashed and also named in text.
- **Contrast:** 4.5:1 or better for all text; a visible focus ring on every control.

### 2.9 Sources and credits sheet

A plain list, one line each, each with its link:

- 1938 and 1933 timetables: Baltimore Transit Co. guides, Enoch Pratt Free Library via Digital Maryland (linked, not reproduced).
- Today's schedule: MDOT MTA GTFS feed, version 20260821, service date Nov 4, 2026. "Not endorsed by MDOT MTA."
- Streets and route geometry: © OpenStreetMap contributors, ODbL.
- Base map (if the interactive map is built): OpenFreeMap tiles, MapLibre GL JS.
- Vehicle drawings: original illustrations.
- How it was made: "Facts files and expected test values were prepared during planning with Claude Code and Codex; the pipeline and app were built in Kiro." Add "and checked by hand against the scans" only once every `*_checked` flag in the facts files is true.
- Code licence, and a link to the repository.

### 2.10 Display rounding: the parts must add up

Stored values keep three decimals. Rounding each part separately can make the screen contradict itself: for the lead pair at 10:00 the parts 2.258, 30.458, 8.283 and 4.156 round to 2, 30, 8 and 4, which is 44, beside a total of 45. The rule:

1. **Total:** each side's shown total is its stored total rounded to the nearest whole minute (halves round up).
2. **Parts (largest-remainder method):** round every part down. Count how many minutes are missing from the shown total. Give one minute each to the parts with the largest fractions, largest first; on a tie, the earlier phase gets it.
3. **Margin:** the shown margin is the difference between the two shown totals. Which result applies (1938, today, photo finish) is still decided from the stored values and the 1.0-minute band, never from shown numbers.
4. **Walking total** in the spoken summary is the sum of the shown walk parts.
5. **Status lines** during the race count down from the shown part ("Waiting 31 min").
6. **Photo finish copy:** if the two shown totals are equal, "Both about N minutes"; if they differ by one, "About N and M minutes".
7. **Sources sheet:** when a shown part is not the plain rounding of its stored value, its row adds: "Exact value 30.5 min. Parts are rounded so they add up to the 45 min total."

This is one small pure function in the site (it is display rounding, not race arithmetic).

| Stored parts (walk, wait, ride, walk) | Stored total | Shown parts | Shown total |
| --- | --- | --- | --- |
| 2.258, 30.458, 8.283, 4.156 | 45.155 | 2, 31, 8, 4 | 45 |
| 1.930, 0.070, 19.717, 2.258 | 23.975 | 2, 0, 20, 2 | 24 |
| 2.258, 0.458, 8.283, 4.156 | 15.155 | 2, 1, 8, 4 | 15 |
| 2.258, 33.459, 8.283, 4.156 | 48.156 | 2, 34, 8, 4 | 48 |
| 4.204, 20.796, 16.000, 4.156 | 45.156 | 4, 21, 16, 4 | 45 |
| 6, 9 (1938: wait, ride) | 15 | 6, 9 | 15 |

Tests to add: the six rows above as examples, and these properties for any list of non-negative parts: the shown parts sum to the shown total; every shown part is a whole number within one minute of its stored value; whole-number inputs come back unchanged; the same input always gives the same output.

### 2.11 Counts are read, never typed

Every count on screen comes from `summary.json` at run time: the races, the wins on each side, the photo finishes, the ride verdicts, and the "When today wins" list. The numbers in this brief and in the mockups (5,582 of 5,666 and the rest) are planning values that show the format. They must not appear in the code, in copy strings or in tests of the real data path. The test for this swaps in a `summary.json` with different numbers and checks the screen shows those.

### 2.12 Labels that must always show, and four more states

**Walks say "estimate" every time.** In the phase legend a walk reads "Walk 2 min · estimate". The status line reads "Walking to the stop 2 min (estimate)". The result box says "walking included (estimated)", for example "Trolley 15 min. Today's bus 45 min, walking included (estimated)."; on a phone this line may wrap to two lines. The spoken summary says "including 6 minutes of walking, estimated".

**The slider shows its range.** Small muted text under the two ends of the track: "9:00" on the left and "13:52" on the right (about 9.5 px, never as large as the start time).

Four states drawn in the second round (mockups 19 to 26):

| State | Must contain |
| --- | --- |
| **Corner picker** | Title "Choose two corners". One line saying which step you are on ("Choose where the ride starts", then "Start is set. Now choose where the ride ends."). Five full-width buttons, west to east. The chosen start is outlined and tagged "Start". Brevard & Preston carries the "inferred" chip. A note: "Corners are listed west to east along the 1938 line. Brevard & Preston's position is inferred." A Cancel button. Choosing the same corner twice is not possible: the start is disabled in the second step. |
| **Bad share link** | A banner: "That link's corners weren't recognized. Showing Preston & Caroline → Aliceanna & Bond." The normal race for the default pair runs underneath; the error never replaces it. |
| **No one-seat ride** | The 1938 lane with its time. In place of the bus lane: "No single scheduled bus links these corners on this weekday schedule. Routes that stop nearby: {list}." Result box: "No one-seat ride today" in `--ink`, then "Trolley {n} min. No winner is called." No bus total, no bus vehicle, no margin. This state cannot happen with the pinned feed, so it is only ever shown from the test fixture, under a visible tag: "Test fixture: a made-up line and made-up numbers. Not Baltimore data." The fixture has no map. |
| **Map unavailable** | The map area shows the bundled route drawing: the route, its street names and the corner dots on a plain background, with "Map unavailable. Showing the route diagram." The race card is unchanged. |

---

## 3. Visual direction (as drawn in `ui-mockups/`)

The look is a night timetable: a dark, quiet screen where the 1938 trolley is the only thing that glows. Everything here is design judgment **[A]**.

### 3.1 Principle

One glowing thing per screen. The trolley glows and hangs from two overhead wires that run the full width of the card. Today's bus is flat and plain and sits on a single thin road line. No cobwebs, pumpkins or dripping type.

### 3.2 Colour tokens

**Superseded. The values below are the retired palette A. Use section 3A.4.**

| Token | Value | Used for |
| --- | --- | --- |
| `--night` | `#0E1320` | Page background |
| `--panel` | `#171E30` | Race card and sheets |
| `--line` | `#2A3350` | Hairlines, control outlines |
| `--ink` | `#F2EEE3` | Main text, the primary button |
| `--muted` | `#A9B0C3` | Labels and secondary text |
| `--ghost` | `#8FF5D2` | Everything 1938: trolley, wires, its lane, the route |
| `--today` | `#F4B860` | Everything today: bus and its lane |
| `--alert` | `#FF8A80` | Error text only |
| sign background | `#0A0E18` | The result box only |

`--ghost` is never used for today's data and `--today` is never used for 1938 data. No MTA colours or logos.

### 3.3 Type

- Barlow Condensed (from the @fontsource/barlow-condensed package, Latin subset, weight 600) for the wordmark, corner names, lane titles, times, totals and the result line.
- The system font for everything else.
- Sizes at 375 px: wordmark 24; corner names 21 (17 when the "inferred" chip is shown); slider time 24; lane title 17; lane total 22; result line 29; body 12 to 13.
- Tabular figures for all numbers. Sentence case everywhere; no all-caps labels.

### 3.4 Layout at 375 × 667 px

**Superseded sizes. Use the phone sizes at the top of section 3A.**

| Zone | Height | Notes |
| --- | --- | --- |
| Top bar | 40 px | Wordmark, "No. 21, 1938", round info button |
| Map | 122 px | Route drawing; the card's rounded top overlaps its lower edge |
| Race card | from 158 px down | Pair row, slider row, schedule line, two lanes, result box, honest line |
| Buttons | 44 px, pinned 8 px above the bottom | "Sources" (outline) and "Share this race" (filled, `--ink`) |

The map is shorter than a typical map panel on purpose: with a result showing, everything fits on one screen without scrolling.

### 3.5 The two vehicles

**Superseded sizes and drawing. Use section 3A.2.**

| | 1938 trackless trolley | Today's bus |
| --- | --- | --- |
| Drawing | Original SVG, side view, facing right. Rounded 1930s body, a row of six lit windows and a curved cab window, two tyres, route number 21, **two trolley poles trailing back up to two wires, no rails**. | Original SVG, plain modern bus, facing right. No livery, no logo. |
| Size | 112 px wide after the finish; **168 px wide while the race is running**, so it is the largest thing on screen | 64 px wide always |
| Finish | Outline in `--ghost`, body fill about 16% opacity, windows brighter, soft outer glow | Solid `--today`, dark windows, no glow |
| Track | Two hairline wires in `--ghost` across the full card width, fading at both edges | One hairline in `--line` |
| On the map | A small glowing copy sits on the route at the trolley's current position | Not drawn on the map |

Draw both from scratch. Do not trace a photograph or a scan.

### 3.6 Lanes

- Each lane: a title on the left, the total on the right (a number button with a dotted underline), the vehicle on its track, then one thin bar (9 px) split into phases.
- Phases are told apart by pattern, not only colour: wait = diagonal hatching, ride = solid, walk = dots.
- Both bars share one time scale, so the longer trip is visibly longer.
- While racing, phases not yet reached are dimmed and one status line sits under each bar ("Waiting 31 min · next bus 10:32 (scheduled)"). After the finish, the status line is replaced by the phase legend ("Wait 6 min  Ride 9 min"), each number a source button.
- While racing, a row under the lanes shows the scheduled clock ("10:08 scheduled") and "Skip to result".

### 3.7 The result box

The result sits in a dark box with a thin rule inside its top and bottom edges, like the destination sign on the front of the car. The result line takes the winner's colour: `--ghost` for 1938, `--today` for today, `--ink` for a photo finish. A win for today is the same size, weight and position as a win for 1938.

Under the box: the honest line, in the wording of section 2.5 (it opens with "Today wins this race." when today wins). The last three words, "When today wins", are a link. The longer sentence about ride verdicts moves to the "When today wins" list.

### 3.8 Notices, sheets and motion

- Notices (before the midday table; inferred corner) are a tinted strip with a `--ghost` left edge, directly under the slider. When a notice shows, the schedule line is hidden to make room; the same sentence is on the About sheet.
- The inferred corner has a dashed outline chip reading "inferred" beside its name, a dashed dot on the map, and the dashed stretch of route.
- The share banner is a light pill over the top bar for 5 seconds.
- Sheets slide up over a dark scrim. In the Sources sheet the tapped number's row is tinted with a `--ghost` left edge.
- Movement is linear. Only transform and opacity are animated. The trolley has a slow 2 px bob and an occasional spark at the pole tips.
- Reduced motion: no animation, bob or spark. Both lanes are drawn finished and the result shows at once (mockup 12).

### 3.9 The mockups

| File | State |
| --- | --- |
| `01-firstload.png` | First load: race about to start, large trolley |
| `02-racing.png` | Racing |
| `03-wins1938.png` | 1938 wins |
| `04-todaywins.png` | Today wins |
| `05-photofinish.png` | Photo finish |
| `06-beforetable.png` | Before the midday table |
| `07-inferred.png` | Inferred corner |
| `08-sharelink.png` | Share link opened |
| `09-dataerror.png` | Data error |
| `10-sources.png` | Sources sheet |
| `11-credits.png` | Sources and credits sheet |
| `12-reducedmotion.png` | Reduced motion |

Numbers in the pictures are planning values. The built site reads every number from the data files.

---

## 3A. Second pass (Nov 15): desktop, trolley, map, palettes, motion

This part was added after a second round of mockups. **Where it differs from sections 2.1 and 3.1 to 3.9 above, this part wins.** Palette B was chosen on Nov 15; every colour value in section 3.2 is replaced by 3A.4.

Phone sizes now: top bar 40 px, map 150 px, race card from 181 px down, buttons pinned 6 px above the bottom. If the card's content is taller than the screen (on a 667 px tall phone this happens in the two notice states, by about 14 px), the card scrolls inside itself and the two buttons stay pinned on a solid `--panel` strip, so text passes under them cleanly. Superseded by section 3B (Nov 20): on a phone nothing is pinned and the card does not scroll inside itself.

**The UI direction was frozen on Nov 15 after this change. No further design changes until the race-screen spec is built.**

### 3A.1 Desktop layout (1280 px wide and up)

The site is one web page that must work on a phone and on a laptop. Mockups 13 to 17 show the laptop layout at 1280 × 800.

| Zone | Position | Contents |
| --- | --- | --- |
| Top bar | over the map area, 56 px high | Wordmark (30 px), then "No. 21, 1938" |
| Headline | over the top left of the map, under the top bar | "Same ride, longer wait." at 54 px in the display face, `--ink`, then one muted 14 px line: "Baltimore's 1938 trackless trolley, raced against today's scheduled bus between the same two corners." The map is positioned so no route or label sits under it. The headline is about the whole line and does not change with the result. |
| Map | left, from 56 px down, everything except the race column | The Baltimore map (3A.3). It is large here, so it carries street names, neighbourhood names and all five corner names. |
| Race column | right, fixed 440 px wide, full height, `--panel` background with a hairline on its left edge, 28 px side padding | Info button top right. Then exactly the same content, in the same order, as the phone's race card: pair row, slider, schedule line, two lanes, result box, honest line, departures board, then the two buttons directly under the content (not pinned to the bottom, so there is no empty band above them), then a footer line: "About and credits" on the left, "Open source. Built in Kiro." on the right. |
| Sheets | slide in over the race column only (not from the bottom) | Sources, Corners, About and credits. The map dims behind a scrim. |

Rules:

- **Breakpoint:** below 900 px wide use the phone layout; at 900 px and above use this one. Between 900 and 1280 the map shrinks; the race column stays 440 px.
- **Above 1280 px** the map keeps growing; the race column stays 440 px. Nothing is stretched.
- **Short windows** (under 720 px tall): the race column scrolls inside itself.
- The trolley in the lane is 200 px wide at all times on desktop, and the bus is 104 px. The result line is 38 px. Corner names in the pair row are 25 px.
- On desktop the departures board stays visible after the race finishes, below the honest line. On the phone it shows only before and during the race, because there is no room after.
- Everything the phone can do, the desktop can do with a mouse and a keyboard. Clicking a corner on the map is the main way to pick a pair here; the Corners list still exists for keyboard users.

### 3A.2 The trolley illustration (replaces the vehicle rows in 3.5)

Mockup 18 (`18-trolley-sheet.png`) is the reference sheet. One original drawing, side view, facing right, at 240 × 104 proportions. Updated Nov 19 to match the approved drawing:

- A tall, rounded 1930s body: curved rear, a gently crowned roof line, a front that curves down to the bumper, and wheel arches over both wheels.
- The body is **lit from inside**: a warm `--ghost` fill with a soft glow under it, and its outline in `--ghost` over the fill. It is not a dark fill with a glowing outline.
- Five side windows, a curved cab window, and two double-leaf doors (centre and front) that reach nearly to the floor. The windows are **bright panes** of `--lit` glass.
- Three passengers in the windows. Each is a **gap in the bright pane**, so the dimmer car interior shows through as a dark silhouette.
- **Two separate trolley poles** rising from a base on the roof and trailing back to **two overhead wires**, each pole ending in a small shoe on its own wire. The poles run parallel and stay clearly apart at every size, never merging into one. Two thin retriever ropes hang from the pole tips to the rear of the car. The two wires cross the whole drawing.
- Rubber tyres with **concentric hub rings** (tyre, rim, hub ring, centre dot) and one faint mark on each hub so turning shows while moving. **No rails.**
- A belt rail (two lines) along the body, broken by the doors; a lower trim line; a small destination-sign bar over the cab window; a headlamp at the front; small bumpers.
- The route number on the rear panel under the belt rails, in the display face, built from index.json (never typed). It is shown only on trolleys 150 px wide or more: narrower, it renders as specks. So the phone's finished trolley (104 px) carries none; the racing trolley (150 px) and the desktop trolley (200 px) do. It is absent in the data-error state.
- Painted in `--ghost` and `--lit` only. The dark parts (the passengers, the inside of the wheels, the gap between the poles) are left unpainted, so the card shows through. Only the trolley glows.

Sizes (section 3B, Nov 20): the illustration sits in the lane's title row at one fixed size, 104 px wide on a phone and 150 px on desktop, and no longer shrinks at the finish. Today's bus is 84 px wide on a phone and 104 px on desktop (it was 64 px; raised so the size gap does not read as a claim about the vehicles). Vehicle size is style, not data: only the bars are drawn to scale. Below about 60 px the detailed drawing loses its detail, so the **map marker is a separate simplified drawing**: a solid `--ghost` body with a dark window strip, two wheels and the two poles, 28 px wide on a phone map and 58 px on desktop.

It is an original illustration in the general style of the period. It is not a drawing of one specific vehicle model, and it must not be traced from a photograph or a scan. Say "illustration" in the credits.

### 3A.3 The map (replaces 3.6)

The mockup map is now drawn from real geometry: the streets are the OpenStreetMap ways saved during planning, and the route is the saved 1938 trace built from the facts file. Nothing on it is hand-drawn.

- **Streets:** every residential and larger street as a hairline in `--street`; main roads slightly brighter (`--street2`, `#40344F`) and about twice as thick. No fills, no blocks.
- **Street names off the route** (desktop only): North Ave, Franklin St, Baltimore St, Pratt St, Fulton Ave, Howard St, Charles St, Broadway, in muted 11 px text. Each is placed on the street's own geometry.
- **The harbour** is not outlined. It shows as the area with no streets, with one italic "Harbor" label on desktop. No shoreline is drawn because no shoreline data was saved; if the build has real water geometry it may fill it in `--water`.
- **No neighbourhood names.** They were removed: none was verified.
- **The 1938 line** is the brightest thing on the map: a `--ghost` line with a blurred copy beneath it. Its streets are named along it in `--ghost` condensed type with a dark outline so they stay readable over the street lines: Gilmor St, Lanvale St, Dolphin St, Preston St, Caroline St.
- **Corners:** all five named on desktop; on a phone only the two chosen ones. The origin is a filled dot, the destination a ring. The inferred corner has a dashed outline and "(inferred)" after its name; the inferred stretch is dashed. Each name sits beside its own dot.
- **Phone map:** 150 px tall. Streets, the route with its street names and the two corner names. When the inferred corner is one of the chosen pair, the Dolphin St and Preston St labels are hidden to make room for its name.
- **Map marker:** the simplified trolley; it stops just short of the destination dot so it never covers a corner name.
- **Faint map text** is never below 80% opacity (5.09:1 on `--night`).
- **Credit line** on the map: "Streets © OpenStreetMap contributors. Dashed stretch of the route is inferred."

For the build: take streets from the base-map tiles or from OpenStreetMap data, and the route from `route.geojson`. The fallback when tiles or WebGL fail is the bundled route drawing (section 2.12, "Map unavailable").

### 3A.4 Palette: B, "Gaslight and brick" (chosen Nov 15)

A plum night. The trolley glows like a lamp-lit car; today's bus is the red-orange of Baltimore brick.

| Token | Value | Used for |
| --- | --- | --- |
| `--night` | `#17121F` | Page and map background |
| `--panel` | `#221A2D` | Race card, race column, sheets |
| `--line` | `#3B3049` | Hairlines, control outlines |
| `--ink` | `#ECE7F2` | Main text, the filled button |
| `--muted` | `#A99FB8` | Labels and secondary text |
| `--ghost` | `#FFE7A8` | Everything 1938: trolley, wires, its lane, the route, its chips |
| `--today` | `#F47C5A` | Everything today: bus, its lane, its chips |
| `--lit` | `#FFF8E0` | Trolley windows and headlamp |
| result box | `#100C16` | The result box only |
| `--water` | `#1E1A33` | Harbour |
| `--street` | `#2A2137` | Street grid |
| `--alert` | `#FF8A80` | Error text only |

`--ghost` is never used for today's data and `--today` is never used for 1938 data.

Measured contrast (WCAG 2 formula, computed during planning; the target for text is 4.5:1):

| Pair | Ratio |
| --- | --- |
| `--today` text on `--panel` ("Today's bus", totals) | 6.28 |
| `--today` text on `--night` | 6.89 |
| `--today` text on the result box | 7.25 |
| `--night` text on a `--today` chip ("10:32") | 6.89 |
| `--ghost` text on `--panel` | 13.76 |
| `--night` text on a `--ghost` chip ("10:06") | 15.09 |
| `--ink` on `--panel` | 13.78 |
| `--muted` on `--panel` | 6.65 |
| `--muted` on `--night` | 7.30 |
| `--night` on the `--ink` button | 15.12 |
| Map text: `--muted` at 80% opacity on `--night` | 5.09 |

The brick red was `#F0714F` in the first drawing; that already measured 5.73 on `--panel` and 6.28 as a chip. It was brightened one step to `#F47C5A` for more room on small text. Dimmed bar segments (28% opacity while racing) are decoration, not text; the status line beside them carries the information. The build must still run an automated contrast check.

Palette A (navy and mint) was drawn in the first round and is retired.

### 3A.5 The departures board (fills the empty band)

Before and during a race, the space under the lanes holds a small board (mockups 01, 02, 08, 13, 14):

> Scheduled departures from this corner after 10:00
> 1938 trolley  **10:06**  10:13  10:21  10:28  every 7 or 8 min
> Today's bus  **10:32**  11:08  11:44  34 to 39 min apart

- The next departure on each side is a filled chip in that side's colour; the rest are plain.
- Four 1938 times and three bus times. Every time is a source button.
- 1938 times come from the race file's `passes`; bus times from its `trips`; the gap text from `gap_min` and `gap_max` (section 2.6). The 1938 text "every 7 or 8 min" is fixed.
- It shows the whole argument before the race ends: one row is dense, the other is sparse.
- In the "before the midday table" state the board starts from the covered-from time.

### 3A.6 Motion spec

PNGs cannot show this, so it is written out. Durations are real milliseconds unless they say "scheduled".

**Race clock.** One clock drives everything, and both sides start from the same instant, including the clamped start in the "before the midday table" state. Movement uses the exact stored durations, never the rounded minutes shown on screen. The race never waits for the map.

Easing curves: ease-out `cubic-bezier(.16,1,.3,1)`; ease-in `cubic-bezier(.4,0,1,1)`; ease-in-out `cubic-bezier(.4,0,.2,1)`.

One clock drives everything. It is shown as the time and the word "scheduled" only ("10:08 scheduled"); the playback speed is not printed on screen. 1 real second = 4 scheduled minutes, so a 45-minute trip plays in 11.25 s. If the longer trip would take more than 12 s, speed up so that it takes exactly 12 s. Movement is linear in time: no easing inside a phase.

| Moment | What moves | Timing and easing |
| --- | --- | --- |
| First paint | Card content appears with no entrance animation. The trolley fades in from 0 to full glow. | 400 ms, ease-out. One time only. |
| Race start | The clock starts after a short pause once data is ready. | A fixed 300 ms pause, so the eye lands first. |
| Waiting | The lane's marker sits at the start of its ride segment. The wait segment fills left to right at clock speed. The status line counts down in whole minutes. | Linear. |
| Departing | The marker moves along its lane at clock speed, centred on the filled end of the ride segment. The illustration in the title row does not travel. | Linear. No acceleration curve. |
| Trolley alive | A 2 px vertical bob. A spark at each pole shoe: a 3 px bright dot that flashes for 120 ms at random gaps of 1.5 to 4 s. Wheel hubs turn while moving. | Bob: 1,600 ms per cycle, ease-in-out, only while moving. |
| Glow | Two layers: a tight 1.5 px blur and a wide 7 px blur of the drawing in `--ghost`. While moving, the wide layer breathes between 85% and 100% opacity. | 2,400 ms per cycle, ease-in-out. |
| Bus | Its marker slides at clock speed. No bob, no glow, no sparks. | Linear. |
| Walking | The walk segment fills at clock speed; a small dot travels the dotted segment. The bus marker does not move during a walk: it waits at the start of the ride segment and parks at its end. | Linear. |
| Map marker | The small trolley moves along the route in step with the lane, only during the ride phase. | Linear. |
| First arrival | The end of the arriving side's bar brightens and settles, and its total appears. **The treatment is identical whichever side arrives first**: no extra glow, size or sound for a trolley win. The other side keeps racing. | 200 ms emphasis, then a 600 ms ease-out settle. |
| The finish moment | Same place, size and weight whichever side won. The result box arrives like a roller sign turning: it scales from 96% to 100% and its text rolls up 8 px into place. Then the honest line fades in. | Box 260 ms, ease-out; honest line 200 ms, starting 150 ms later. |
| Slower side | Keeps running to its real finish at clock speed. Its vehicle drawing may dim to 70%; its text and numbers keep full contrast. | Linear. |
| Photo finish | Both bar ends get the same 200 ms emphasis at the same moment. The result box appears in `--ink`. Nothing winner-specific happens for either side. | Same timings. |
| Skip to result | Reachable by tap and keyboard for as long as anything is moving. Both lanes jump to finished; the result box appears with its normal entrance. | Immediate, then 260 ms. |
| Slider moved | The running race stops immediately on the first movement of the thumb or a press of minus or plus. While dragging, only the time label and the departures board update. The new race starts 300 ms after release (or 300 ms after the last minus or plus press). | No animation while dragging. |
| Sheets | Phone: slide up from the bottom. Desktop: slide in from the right edge of the race column. The scrim fades. On close, focus returns to the control that opened the sheet. | 220 ms, ease-out; closing 160 ms, ease-in. |
| Share banner | Slides down, stays, slides up. It names the pair only, never a time. | 200 ms in, 5,000 ms hold, 200 ms out. |
| Press feedback | Buttons and number buttons change opacity while pressed. Nothing moves or resizes. | 80 ms. |

Rules:

- Animate only `transform` and `opacity`. No animated shadows, filters or layout properties: the glow layers are separate elements whose opacity changes.
- Target 60 frames per second. If a device cannot hold 30, drop the bob, the sparks and the glow breathing, and keep the movement.
- Nothing loops when no race is running, except the finished trolley's glow, held steady at 100%.
- The screen reader hears one announcement, at the finish (section 2.8). Motion never carries information that text does not also carry.

**Reduced motion** (the visitor's device asks for it): no clock, no movement, no bob, no sparks, no breathing, no entrance animations. On load and after every slider change, both lanes are drawn finished, the markers are parked at the end of their ride segments, the result box and the takeaway are simply present, and no caption sequence plays. Sheets and the banner appear and disappear without sliding. "Skip to result" is not shown. On a phone the departures board is not shown, because the finished layout is used. Mockup 12.

### 3A.7 Mockup list (replaces 3.9)

All pictures use palette B and the real street map.

| File | State |
| --- | --- |
| `01` to `12` | Phone: first load, racing, 1938 wins, today wins, photo finish, before the midday table, inferred corner, share link opened, data error, sources sheet, credits sheet, reduced motion |
| `13` to `17` | Desktop: first load, racing, 1938 wins, today wins, sources panel |
| `18-trolley-sheet.png` | The trolley at four sizes, with the bus |
| `19-corners.png`, `23-desktop-corners.png` | Corner picker |
| `20-badshare.png`, `24-desktop-badshare.png` | Bad share link |
| `21-noseat-fixture.png`, `25-desktop-noseat-fixture.png` | No one-seat ride (test fixture) |
| `22-mapunavailable.png`, `26-desktop-mapunavailable.png` | Map unavailable |

## 3B. Story layer (Nov 20, from the Astra review)

3B wins over 3A where they differ. The story-layer spec holds the detail and
the copy.

The aim: in the first race a visitor sees the trolley passenger arrive while
today's passenger is still waiting to board, then is invited to test whether
that keeps happening at other start times.

- First visit: with no valid share link, the lead pair races at the labelled
  example start, 10:00 AM. A shared link keeps the clock-derived default.
- Each lane has its illustration in the title row and a small marker on the
  bar. The marker moves only during the ride, centred on its filled end. Bars
  are unchanged.
- One caption line says what each passenger is doing, chosen from the lane
  phases. Captions carry no numbers.
- After the result: the honest line, then "Where the time goes".
- Three next steps: Try another time, Try other corners, Show a race today
  wins. Sources and Share are secondary.
- A start-time chart of the selected pair's scheduled totals sits directly
  above the native slider. The slider stays the control.
- Phone: normal page flow, nothing pinned, a compact route preview, the pair
  on two lines.
- Departures: an expandable "Scheduled departures" section.
- Cut from the deadline: camera moves, sounds, new overlays, the map race.
