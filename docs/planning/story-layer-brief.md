# Draft 4: Phase 1 brief, the story layer (Astra's five-day cut)

Status: draft, Nov 20, for your check before anything goes to Kiro. Nothing in the repo has been changed or committed.
Source: astra-review.md, sections 3, 4, 5 and 6, as approved by Emmanuel on Nov 20.
Checked against the repo at commit 893ca6f.
Marks: **⚠ UNSURE** means a fact I could not confirm or a decision that is yours.

Facts this brief relies on, all re-checked in the data on Nov 20:
- The 20 race files hold 5,860 slider rows. 194 of them are before the 1938 midday timetable reaches the start corner, which leaves 5,666 covered starts. 5,666 is the `races` figure in summary.json.
- At the lead pair, the 1938 total changes with the start minute: 15 at 10:00, 14 at 10:01, 9 at 10:06, and 9 to 16 over the covered minutes. Today's total runs from about 15 to 52.
- At 10:00 the lead race has a 1938 wait of 6 and a ride of 9. Today has walk 2.258, wait 30.458, ride 8.283 and walk 4.156, shown as 2, 31, 8 and 4. The stored total is 45.156.
- "Same ride" means today's median ride is within the larger of 1.5 minutes or 15% of the 1938 ride (`SAME_FLOOR_MIN` and `SAME_FRACTION` in `pipeline/summary.py`).
- `summary.today_wins` has 25 entries (pair plus start minute) across 7 pairs. The lead pair has none.

---

## 0. Order of work

1. You apply the steering and spec edits in section 1 (exact text below) and commit them yourself.
2. You paste the feature brief in section 2 into Kiro as a new spec called **story-layer**, with the copy table in section 3 and the acceptance checks in section 4.
3. Kiro writes requirements, design and tasks from the brief. You review them, then Kiro builds in the day order of section 5.

Drafts 01 and 05 (the map race, Phase 3) build on top of these edits. 05 says which of 01's edits had to change because of them.

---

## 1. Steering and spec edits to apply first

Each edit gives the exact current text (BEFORE) and its replacement (AFTER).

### 1.1 `.kiro/steering/product.md`, "What the visitor does" (lines 19 to 24)

BEFORE
```
1. Opens the page. The line is preselected and a race starts by itself for the
   lead pair: Preston & Caroline to Aliceanna & Bond.
2. Moves a time slider, 9:00 to 13:52, in one-minute steps. Default: the current
   America/New_York time of day if it is inside that range, otherwise 10:00.
3. May pick any two of the five timing points, swap direction, tap any number to
   see its source, copy a share link, or open About and credits.
```

AFTER
```
1. Opens the page. The line is preselected and a race starts by itself for the
   lead pair, Preston & Caroline to Aliceanna & Bond, at the labelled example
   start, 10:00 AM. Short captions say what each passenger is doing, and after
   the finish the card shows where the time went.
2. Moves a time slider, 9:00 AM to 1:52 PM, in one-minute steps, with a chart of
   the scheduled journey minutes for every start beside it. A shared link opens
   its pair at the current America/New_York time of day if it is inside that
   range, otherwise 10:00.
3. Is offered three next steps: try another time, try other corners, or show a
   race today wins. May also swap direction, tap any number to see its source,
   share a link, or open About and credits.
```

### 1.2 `.kiro/steering/ui.md`

**(a) Which brief section wins (lines 8 to 10)**

BEFORE
```
The full direction is docs/planning/screen-brief.md, sections 2, 3 and 3A
(3A wins where they differ). The pictures in docs/planning/ui-mockups/ show the
intended look on a phone and on a laptop; match them closely.
```
AFTER
```
The full direction is docs/planning/screen-brief.md, sections 2, 3, 3A and 3B
(3B wins over 3A, and 3A over 2 and 3, where they differ). The pictures in
docs/planning/ui-mockups/ show the intended look on a phone and on a laptop;
match them closely, except where section 3B changes the layout.
```

**(b) Phone and desktop zones (lines 14 to 18)**

BEFORE
```
- Phone: top bar 40 px, map 150 px, race card from 181 px down, two buttons
  pinned at the bottom (Sources; Share this race). Sheets slide up.
- Desktop: map on the left, a fixed 440 px race column on the right with the
  same content in the same order. The buttons sit directly under the content,
  then a footer line. Sheets slide in over the race column.
```
AFTER
```
- Phone: top bar 40 px, then a compact route preview that "View route"
  expands, then the race card in normal page flow: the page scrolls, nothing is
  pinned and nothing scrolls inside the card (story-layer spec). Sheets slide up.
- Desktop: map on the left, a fixed 440 px race column on the right with the
  same content in the same order. The three next-step actions sit under the
  takeaway; Sources and Share this race follow as secondary buttons, then a
  footer line. Sheets slide in over the race column.
```

**(c) Vehicles (lines 28 to 33)**

BEFORE
```
- Only the 1938 trolley glows. It is the detailed illustration described in
  screen-brief.md 3A.2, hanging from two hairline wires that cross the whole
  card. Phone: 150 px wide while racing, 104 px after the finish. Desktop:
  200 px. The map uses the separate simplified marker. Today's bus is flat and
  plain, 84 px on a phone and 104 px on desktop, on one hairline. Vehicle size
  is style; only the bars are drawn to scale.
```
AFTER
```
- Only the 1938 trolley glows. It is the detailed illustration described in
  screen-brief.md 3A.2, hanging from two hairline wires, and it sits in its
  lane's title row as the lane's identity, outside the time scale. Today's bus
  is flat and plain, in its own lane's title row. Neither illustration travels
  along the lane and neither changes size at the finish. A small marker moves
  instead: the simplified trolley on the 1938 bar and a small flat bus on
  today's bar, centred on the filled end of the ride (story-layer spec). The
  map uses the simplified trolley marker. Vehicle size is style; only the bars
  are drawn to scale.
```

**(d) Departures board (lines 42 and 43)**

BEFORE
```
- Before and during a race, a departures board sits under the lanes
  (screen-brief.md 3A.5).
```
AFTER
```
- The departures board (screen-brief.md 3A.5) is a "Scheduled departures"
  section that opens on request, below the next-step actions. Its rows say
  where each departure is: the 1938 car at this corner, the bus at the
  boarding stop.
```

**(e) Slider labels (lines 49 and 50)**

BEFORE
```
- Every walk time carries the word "estimate" ("Walk 2 min · estimate"). The
  slider shows "9:00" and "13:52" in small muted text under its two ends.
```
AFTER
```
- Every walk time carries the word "estimate" ("Walk 2 min · estimate"). The
  slider is labelled "Choose a scheduled start time" and shows its two ends in
  12-hour form ("9:00 AM", "1:52 PM") in small muted text, read from the race
  file. A start-time chart sits directly above the slider and shares its range
  (story-layer spec).
```

**(f) Copy strings (line 60)**

BEFORE
```
- Use only the copy strings in the race-screen spec. Do not write new wording.
```
AFTER
```
- Use only the copy strings in the race-screen and story-layer specs; where
  both have a row for the same place, the story-layer row wins. Do not write
  new wording.
```

### 1.3 `docs/planning/screen-brief.md`

**(a) Phone sizes (line 345): add one sentence at the end of the paragraph**

BEFORE
```
Phone sizes now: top bar 40 px, map 150 px, race card from 181 px down, buttons pinned 6 px above the bottom. If the card's content is taller than the screen (on a 667 px tall phone this happens in the two notice states, by about 14 px), the card scrolls inside itself and the two buttons stay pinned on a solid `--panel` strip, so text passes under them cleanly.
```
AFTER
```
Phone sizes now: top bar 40 px, map 150 px, race card from 181 px down, buttons pinned 6 px above the bottom. If the card's content is taller than the screen (on a 667 px tall phone this happens in the two notice states, by about 14 px), the card scrolls inside itself and the two buttons stay pinned on a solid `--panel` strip, so text passes under them cleanly. Superseded by section 3B (Nov 20): on a phone nothing is pinned and the card does not scroll inside itself.
```

**(b) Trolley sizes in 3A.2 (line 384): the first sentence**

BEFORE
```
Sizes: on a phone, 150 px wide while racing and 104 px after the finish; on desktop, 200 px at all times.
```
AFTER
```
Sizes (section 3B, Nov 20): the illustration sits in the lane's title row at one fixed size, 104 px wide on a phone and 150 px on desktop, and no longer shrinks at the finish.
```
⚠ UNSURE: 104 px and 150 px are my proposal. Check them against the title-row height in Kiro's first screenshot.

**(c) Motion table rows (lines 474, 475, 478, 479)**

BEFORE
```
| Waiting | The vehicle sits at the start of its bar. The wait segment fills left to right at clock speed. The status line counts down in whole minutes. | Linear. |
| Departing | The vehicle moves along its lane at clock speed; its front edge tracks the filled end of the bar. | Linear. No acceleration curve. |
```
AFTER
```
| Waiting | The lane's marker sits at the start of its ride segment. The wait segment fills left to right at clock speed. The status line counts down in whole minutes. | Linear. |
| Departing | The marker moves along its lane at clock speed, centred on the filled end of the ride segment. The illustration in the title row does not travel. | Linear. No acceleration curve. |
```
BEFORE
```
| Bus | Slides at clock speed. No bob, no glow, no sparks. | Linear. |
| Walking | The walk segment fills at clock speed; a small dot travels the dotted segment. The bus does not move during a walk. | Linear. |
```
AFTER
```
| Bus | Its marker slides at clock speed. No bob, no glow, no sparks. | Linear. |
| Walking | The walk segment fills at clock speed; a small dot travels the dotted segment. The bus marker does not move during a walk: it waits at the start of the ride segment and parks at its end. | Linear. |
```

**(d) Reduced motion (in the paragraph that starts "**Reduced motion**")**

BEFORE
```
On load and after every slider change, both lanes are drawn finished, the vehicles are parked at the end of their bars, and the result box is simply present.
```
AFTER
```
On load and after every slider change, both lanes are drawn finished, the markers are parked at the end of their ride segments, the result box and the takeaway are simply present, and no caption sequence plays.
```

**(e) New section 3B (add at the end of the file, after 3A.7)**

```
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
```

### 1.4 `.kiro/specs/race-screen/requirements.md`: pointers on the requirements this replaces

The race-screen spec is finished. Don't rewrite its requirements; **append** this sentence to the end of each one listed:

> Superseded in part by the story-layer spec (Nov 20); where they differ, story-layer wins.

Requirements to mark:
- **R1.2**: phone zones and the pinned strip.
- **R1.3**: desktop button order.
- **R3.2**: slider end labels, now in 12-hour form.
- **R3.4**: the default time for a visit with no valid link.
- **R5.5**: vehicles, now markers.
- **R5.11**: reduced-motion parking.
- **R8.1** and **R8.4**: the board, now an expandable section.
- **R12.3**: vehicle sizes.

Also add one line directly under the "## Copy strings" heading:

> Rows replaced by the story-layer spec's copy table are listed there; the story-layer row wins.

---

## 2. Feature brief to paste into Kiro (new spec: story-layer)

```
Feature brief: story-layer (Ghost Line, Phase 1)

Goal
A first-time visitor understands in one race what Ghost Line shows: the 1938
trolley passenger arrives while today's passenger is still waiting to board.
They are then invited to test it at other start times and corners. Every number
stays sourced and scheduled. Read steering (product.md, ui.md, tech.md) and
screen-brief.md section 3B first. This spec supersedes parts of race-screen
R1.2, R1.3, R3.2, R3.4, R5.5, R5.11, R8.1, R8.4 and R12.3; those requirements
carry a pointer. Use only the copy table of this spec and the race-screen
spec; a row here wins.

S1 First visit and the example start
- A visit with no valid share link (no query, or a bad link) races the lead
  pair at the example start 10:00, with the example label (copy table) beside
  the start time. A bad link still shows its banner.
- A valid share link opens its pair with the race-screen R3.4 default time
  (America/New_York clock, else 10:00), with no example label.
- The example label, the orientation line and the chart prompt are the guided
  parts. They end at the first input (slider, minus or plus, picker, swap, any
  next-step action) and do not come back in that visit.

S2 Lane illustration and moving marker
- Each lane's illustration sits in the lane title row at one fixed size (screen-
  brief 3A.2 as edited) and never travels or shrinks. The trolley keeps its two
  wires, glow and, while its marker moves, its bob, sparks and turning hubs.
- A small marker rides on each bar's track: the simplified trolley (the map
  marker drawing) on the 1938 bar and a new small flat bus glyph on today's
  bar. The marker's centre sits at the start of the ride segment until the ride
  begins, then exactly on the filled end of the ride segment, and parks at the
  ride's end. The bus marker does not move during walks; the walk dots stay as
  they are.
- The track is padded by half the marker's width at each end so a marker
  never clips; bar lengths and the shared time scale do not change.
- Position along the lane never signals the winner. Arrival, totals and the
  result box carry the comparison.

S3 Phone reading order (below 900 px)
- Normal page flow: no fixed or sticky element, no scrolling inside the card,
  and no text smaller than today's minimums.
- Order: top bar; intro line; compact route preview with "View route" (expands
  to the existing 150 px map, "Hide route" collapses it); pair names on two
  lines (start, then "→ destination") with the swap button; example label and
  start time; start-time chart and slider; schedule line; both lanes; caption;
  result box; honest line; Where the time goes; the three next-step actions;
  Scheduled departures (closed); Sources and Share this race; About and
  credits.
- At 375 x 667, at the result moment of the lead example, the caption and the
  result line are visible without scrolling. If they do not fit, report it;
  do not shrink text to make them fit.

S4 Captions and the takeaway
- Under the lanes is one caption area, reserved at a two-line height so
  nothing jumps. At race start it shows the orientation line. From the first
  phase change it shows the 1938 clause followed by the today clause (copy
  table), chosen only from the lanes' current phases. "still" is added to a
  side's clause only while the other side has arrived. When both have arrived
  it shows "Both passengers have arrived." With no one-seat ride, only the
  1938 clause shows.
- Captions contain no digits. They are plain text, not a live region: the
  single result announcement (race-screen R13) is unchanged.
- After the result, under the honest line: "Where the time goes", built from
  the shown parts (race-screen R7; the same values as the lane legends, each a
  number button).
- The sentence "Waiting accounts for most of the difference in this race."
  shows only when the result is a win and the loser's shown wait minus the
  winner's shown wait is more than half the shown margin. This is display
  arithmetic on shown values, like the shown margin (race-screen R7.4). It is
  never shown for a photo finish or a race with no one-seat ride.
- Reduced motion: no caption sequence. The takeaway and "Where the time goes"
  are present at once.

S5 Start-time chart
- Inline SVG, no library, drawn from the selected pair's race file only (no
  other file is fetched for it). It sits directly above the native slider and
  shares its range, so each slider minute lines up with its column.
- Two step series of stored totals per slider minute: 1938 in --ghost and
  today in --today, each sample drawn as it is, with no smoothing and no
  average. One shared vertical scale from 0. No numeric axis labels.
- Minutes where row.before_table is true are hatched and labelled (copy
  table), not drawn as separate journeys.
- A cursor marks the slider's minute. The readout under the chart gives that
  minute's two shown totals as number buttons (copy table).
- A pair or direction change redraws it, so a stale chart is impossible. With
  no one-seat ride, only the 1938 series is drawn.
- The chart takes no pointer input; the slider stays the only control. The
  accessible name is in the copy table.

S6 Next-step actions
- "Try another time" moves focus to the slider and scrolls it into view.
- "Try other corners" opens the corner picker (race-screen R4.1).
- "Show a race today wins" selects the next entry of summary.today_wins in file
  order, wrapping at the end, sets its pair and start time, updates the
  address bar (race-screen R4.7), shows the today-win notice and plays that
  race.
- Sources and Share this race become secondary buttons after these three, on
  both layouts. Every tap target is at least 44 x 44 px.

S7 Scheduled departures
- The board (race-screen R8) moves into a "Scheduled departures" section,
  closed by default, below the next-step actions, on both layouts.
- Row labels say where each departure is (copy table). The content rules of
  R8.2, R8.3 and R8.5 are unchanged.

S8 Honest copy and scoped Sources lines
- The honest line counts "covered starts".
- The races count, the ride-same count and the frequency sentence get the
  scoped Sources lines in the copy table.

S9 One small pipeline change
- summary.json gains "ride_same_rule": {"floor_min": ..., "fraction": ...},
  written from SAME_FLOOR_MIN and SAME_FRACTION in pipeline/summary.py, so the
  ride-same method line can name the tolerance without typing a number.
- Update summary.schema.json and its tests. Nothing else in any data file may
  change; every golden test must pass unchanged. Run validate, build, check,
  verify and check_sources.

S10 Map (cut first if late)
- Desktop: the selected pair's stretch of the 1938 line at full brightness,
  the rest of the line dimmed (lines only; text keeps its 80% minimum).
- Phone: the compact route preview of S3.

Out of scope
The map race and both vehicles on the map, any tilt or raised buildings, bus
shapes, HOLC, any census number, weekly arithmetic, sounds, overhead wires on
the map, camera moves, a custom slider, more lines.

Done when
All acceptance checks of this spec pass, the existing race-screen and
race-engine suites pass (tests of superseded requirements updated and named in
the commit message, none deleted silently), npm run check:size stays under
100 KB, and npm run screens produces the updated pictures for Emmanuel's
review.
```

---

## 3. Copy table (story-layer)

New rows, and rows that replace a race-screen row (marked **replaces**). Placeholders in braces come from the data. Minute words follow race-screen R15.5.

| Where | String |
| --- | --- |
| Example label (S1) | "Example start: {h:mm AM/PM} scheduled." |
| Phone intro line (S3) | "Race Baltimore's 1938 trolley against today's scheduled bus." |
| Orientation line (S4, race start) | "Same two corners. Walking included for today; walks are estimates." |
| Caption, 1938 clause (S4) | waiting: "The trolley passenger is {still }waiting for the car."; riding: "The trolley passenger is {still }riding."; arrived: "The trolley passenger has arrived." |
| Caption, today clause (S4) | walk to the stop: "Today's passenger is {still }walking to the stop (estimate)."; waiting: "Today's passenger is {still }waiting to board."; riding: "Today's passenger is {still }riding."; walk from the stop: "Today's passenger is {still }walking to the destination (estimate)."; arrived: "Today's passenger has arrived." |
| Caption, both done (S4) | "Both passengers have arrived." |
| {still } rule | "still " only while the other side has arrived; otherwise nothing |
| Takeaway heading (S4) | "Where the time goes" |
| Takeaway rows (S4) | "Waiting: trolley {a} min, today's bus {b} min."; "Walking (estimate): today's bus {w} min."; "Riding: trolley {c} min, today's bus {d} min." ({w} is the sum of the shown walk parts, as in race-screen R7.5; with no one-seat ride, only the trolley parts: "Waiting: trolley {a} min." "Riding: trolley {c} min.") |
| Most of the difference (S4) | "Waiting accounts for most of the difference in this race." |
| Next-step actions (S6) | "Try another time"; "Try other corners"; "Show a race today wins" |
| Today-win notice (S6) | "Showing a race today wins: {origin} → {dest}, starting {h:mm AM/PM} (scheduled)." |
| Slider label (S3) | visible label and input name "Choose a scheduled start time" (**replaces** the input name "Start time") |
| Slider ends (S3) | "{h:mm AM/PM}" for both ends, read from the race file (**replaces** the 24-hour end labels) |
| Chart heading (S5) | "How much does the start time matter?" |
| Chart subheading (S5) | "Scheduled journey minutes for each start time, for these corners and this direction." |
| Chart legend (S5) | "1938 trolley"; "Today's bus, walking included (estimated)" |
| Chart readout (S5) | "At {h:mm AM/PM}: trolley {n} min, today's bus {m} min." (with no one-seat ride: "At {h:mm AM/PM}: trolley {n} min.") |
| Chart hatch label (S5) | "Before the 1938 midday timetable reaches this corner" |
| Chart accessible name (S5) | "Chart of scheduled journey minutes for each start time, 1938 trolley and today's bus. Move the start time slider to read a minute." |
| Route preview (S3) | "View route"; "Hide route" |
| Departures section (S7) | section button "Scheduled departures"; header "Scheduled departures after {h:mm}" (**replaces** "Scheduled departures from this corner after {h:mm}"); row labels "1938 trolley, at this corner" and "Today's bus, at the boarding stop" (**replace** "1938 trolley" and "Today's bus") |
| Honest line (S8) | "Same ride, longer wait. Trolley first in {wins_1938} of {races} covered starts. When today wins" (**replaces**) |
| Honest line, today wins (S8) | "Today wins this race. Across this line: same ride, longer wait. Trolley first in {wins_1938} of {races} covered starts. When today wins" (**replaces**) |
| When today wins list, heading (S6) | "The {wins_today} races today wins" (then the existing sentence and list) |
| What a number is (S4, S6) | new: "walks to and from the stop, together (estimate)"; "covered starts where today's bus arrives first". **Replace** "races on this line" with "covered starts on this line", and "races where the 1938 trolley arrives first" with "covered starts where the 1938 trolley arrives first" |
| Sources, how it was worked out: races count (S8) | "Counted over every corner pair and every start minute that the 1938 midday timetable covers at the start corner. Earlier minutes, which race from the first listed car, are not counted." (**replaces** "Counted over every race on this line, one per corner pair and slider minute.") |
| Sources, how it was worked out: ride-same count (S8, S9) | "Counted over this line's corner pairs, comparing each 1938 ride with the median of today's scheduled rides. About as long means within {floor_min} minutes or {fraction as %} of the 1938 ride, whichever is larger." (**replaces** the current ride line; {floor_min} and {fraction} from summary.json ride_same_rule) |
| Frequency (S8) | "For these corners and this direction, scheduled one-seat buses leave {gap part} between {window_from} and {window_to} ({route_names}, weekday schedule as of {service_date}). In the covered 1938 midday timetable, a trolley was scheduled at this corner every {a} or {b} minutes." (**replaces**; the {gap part} and equal-value rules are unchanged) |
| Takeaway walk sum, Sources how it was worked out (S4) | "Sum of the two walks as shown, to and from the stop." |

All of these new strings follow Astra's section 5:
- spacing is scoped to "these corners and this direction" and "the covered 1938 midday timetable";
- "most of the difference", not "all";
- "today's passenger is waiting to board", never a waiting bus;
- "covered starts", never 20 × 293.

None of them says live, now, citywide or "1938 was better".

---

## 4. Acceptance checks

1. **Marker geometry.** In the lead race at 10:00, on phone (375 × 667) and desktop (1280 × 800), and at ten clock moments: the trolley marker's centre is at the start of its ride segment during the wait, within 1 px of the filled end during the ride, and at the ride end after it. The same holds for the bus marker against its ride segment; it doesn't move during walks.
2. **Short trips move.** In that race, the trolley marker travels its ride segment's full width on both layouts, within 1 px. Bar widths equal minutes × the scale, unchanged from the race-screen build.
3. **No size jump.** The illustrations have the same box size before, during and after a race.
4. **First visit.**
   - No query: lead pair, 10:00, example label present.
   - Bad link: lead pair, 10:00, example label and the bad-link banner.
   - Valid link: that pair, the R3.4 default time (tested with a fixed clock), no example label.
   - P2 still holds for shared links.
5. **Guided parts end.** After each kind of input (slider, minus, plus, picker, swap, each next-step action), the example label, the orientation line and the chart prompt are gone and don't come back. Captions keep working on the next race.
6. **Captions follow the data.** With fake timers, the sequence of captions for these races equals the sequence worked out in the test from the file's stored phase boundaries (race-screen R17.5):
   - the lead race at 10:00 (1938 wins);
   - the first `summary.today_wins` entry (today wins);
   - lead at 10:30 (photo finish);
   - lead at 9:00 (before the table);
   - one Brevard pair (inferred);
   - the no-one-seat-ride fixture.
7. **Captions never contradict the lanes.** Property test over sampled rows of all 20 files and sampled times: the caption clauses name the phases the lanes show at that moment, and "still" appears only after the other side's arrival.
8. **No digits in captions.** In any state, the caption area contains no digit.
9. **"Most of the difference" predicate.**
   - It shows for the lead race at 10:00 (shown waits 31 and 6, shown margin 30).
   - It's hidden for a photo finish and for no one-seat ride.
   - A made-up race row where walking and riding make up most of the margin hides it.
10. **A summary fixture with different counts.** Use a made-up summary.json with every count different from the real one:
    - change `races`, `wins_1938`, `wins_today`, `ride_same`, `ride_faster_today`, `pairs`, `ride_same_rule` and `today_wins`;
    - check that every count, the today-wins heading, the "Show a race today wins" order, its notice and the Sources method lines show the fixture's values;
    - check that no digit string from the real summary.json appears in any file under `web/src/` (extends race-screen 19.3 and P5).
11. **A race fixture with different totals.** For a made-up race file:
    - the chart's columns equal its stored totals (one per slider minute);
    - the before-table minutes are hatched;
    - the readout, "Where the time goes" and the captions show the fixture's values and phases.
12. **The chart has no stale state.** After every pair change, swap and today-win shortcut, the chart's series equal the new file's rows. No extra race file is fetched to draw it.
13. **Today-win shortcut.** 25 presses visit the 25 `summary.today_wins` entries in file order, then wrap. Each sets that pair and time, makes the address bar equal encode(pair), shows the notice and plays a race whose result is "Today wins".
14. **Sources coverage.** Every new number (takeaway rows, chart readout, the today-wins heading count, the ride-rule numbers) is a number button with a Sources row. The P3 DOM crawl is extended to the new parts.
15. **Wording.** The banned-word scan covers every new string in every state. "citywide" never appears. The honest line says "covered starts". The frequency line opens with "For these corners and this direction".
16. **Phone flow.**
    - At 375 × 667 there's no fixed or sticky element and no element that scrolls inside the card.
    - The DOM order matches S3.
    - The caption and the result line are on screen at the lead example's result moment, or the test reports by how much they miss.
    - Nothing scrolls sideways at 320, 375 and 899 px.
17. **Accessibility.**
    - axe passes on: first visit, racing, finished, today-win notice, the open departures section and the expanded route preview.
    - Keyboard alone reaches the three next-step actions, the readout's number buttons and the departures toggle.
    - One announcement per race; the captions aren't in a live region.
    - Under reduced motion, the takeaway is present at once and no caption sequence plays.
18. **The map stays optional.** The whole story plays in Playwright with the tile host blocked and WebGL absent (race-screen R17.6).
19. **Pipeline (S9).** Only summary.json gains `ride_same_rule`. `verify`, `check_sources` and every golden test pass unchanged.
20. **Budgets.** `npm run check:size` stays under 100 KB and no runtime dependency is added. `npm run perf` keeps the median under 5,000 ms; it's a timing test, run on a quiet machine.
21. **Pictures.** `npm run screens` adds first visit, racing with a caption, finished with the takeaway, the today-win notice, the chart, and the phone page at the result moment, for Emmanuel's review.

---

## 5. Day plan (Astra's) and what to cut if it slips

| Day | Build | Done when |
| --- | --- | --- |
| 1 | S2 markers, S3 phone order, S6 actions | Checks 1 to 3 and 16 pass. |
| 2 | S1 example start, S4 captions and takeaway, S8 copy | Checks 4 to 9 pass. |
| 3 | S5 chart | Checks 11 and 12 pass. |
| 4 | S6 today-win shortcut, S7 departures, S9 pipeline field, S10 map, source targets | Checks 10, 13, 14, 15 and 19 pass. |
| 5 | Verification only; no new features | Checks 17, 18, 20 and 21 pass. Then freeze. |

**If it slips, cut in this order:**
1. S10 map dimming.
2. The phone route preview, which keeps today's 150 px map in normal flow.
3. The "most of the difference" sentence. "Where the time goes" stays.

Never cut:
- the phone reading order;
- the next-step actions;
- truthful state handling;
- day 5.

---

## 6. Unsure, to check before Kiro

1. ⚠ **"Most of the difference" uses display arithmetic.** The site already subtracts the shown totals for the shown margin (R7.4), and this predicate is the same kind of thing. But tech.md says "No race arithmetic in TypeScript". If you read this as race arithmetic, move it to the pipeline as a per-row flag (`wait_most: true/false`). That costs a schema change and a rebuild.
2. ⚠ **S9 is the only pipeline change.** If you want Phase 1 to be site-only, drop S9 and use this ride-same Sources line without numbers: "…comparing each 1938 ride with the median of today's scheduled rides, using the tolerance in the method notes." I don't recommend it, because it hides the rule.
3. ⚠ **Illustration sizes in the title row** (104 px phone, 150 px desktop) and the new small bus glyph's size (a 28 px marker exists only for the trolley).
4. ⚠ **Whether a bad link counts as a first visit** for the example label. I said yes.
5. ⚠ **Chart placement on the phone.** I put it above the slider on both layouts, as you asked. Astra suggested putting it below the result on phones. Check the first phone screenshot.
6. ⚠ **No numeric axis on the chart.** That avoids unsourced tick numbers (Astra: every displayed number needs a source). The slider's end times act as the time axis; the readout gives exact values.
7. ⚠ **Departures closed by default** on both layouts. Desktop currently shows the board after the finish.
8. ⚠ **The "Where the time goes" rows repeat the legend values.** Astra says to reuse them, not recompute them. If it reads as duplicated, the legends could go once the takeaway exists.
9. ⚠ **Present-tense captions** ("is riding") narrate the animation, and the clock beside them says "scheduled". The banned-word list doesn't cover them. Read them once for any hint of live tracking.
10. ⚠ **The test pair for "today wins"** (check 6). Race-screen R17.4 names Westwood & Carey → Preston & Caroline at 11:23, but `summary.today_wins[0]` is Westwood & Carey → Dolphin & Myrtle at 11:23. I used "the first entry of the list, read from the file" to avoid the mismatch. Ask Kiro to confirm that R17.4's pair really is a today win.
