# Requirements Document

## Introduction

The story layer is Phase 1 of the Astra review cut for the Ghost Line race screen. A first-time visitor should understand from one race what Ghost Line shows: the 1938 trolley passenger arrives while today's passenger is still waiting to board. The visitor is then invited to test that at other start times and other corners. Every number stays sourced and scheduled.

Source: docs/planning/story-layer-brief.md, sections 2 to 6, with Emmanuel's decisions of Nov 20 folded in (listed under "Decisions applied"). Steering (product.md, tech.md, structure.md, ui.md) and screen-brief.md section 3B apply. The honesty rules of product.md outrank every requirement here.

This spec supersedes parts of race-screen R1.2, R1.3, R2.5, R3.2, R3.4, R5.5, R5.8, R5.11, R6.7 (the part that hides the schedule line while a notice shows), R8.1, R8.4, R12.3 and R16.2; each of those requirements carries a pointer. Where this spec and the race-screen spec differ, this spec wins. Everything in the race-screen spec that this spec does not change still holds, including its principles P-A to P-E, its data contract and its correctness properties P1 to P13.

Status: requirements approved by Emmanuel, with his answers to the open points folded in (decisions 8 to 15) and his answers to the design's open questions (decisions 16 to 23). The design is approved. Nothing is built yet.

### Decisions applied (Emmanuel, Nov 20)

1. The "most of the difference" sentence is driven by a per-row flag that the pipeline writes into the race files. The pipeline computes the flag from the display-rounded values (the same whole-minute values the screen shows). A Python/TypeScript agreement test checks that the flag matches what the displayed rounded numbers imply. The site never computes the predicate.
2. summary.json gains the same-ride tolerance as `ride_same_rule: {"minutes": 1.5, "fraction_pct": 15}`, written from `SAME_FLOOR_MIN` and `SAME_FRACTION` in pipeline/summary.py, with a schema update. (This replaces the brief's `floor_min` and `fraction` key names.)
3. The tolerance appears as plain text inside the Sources sheet's method line for the ride-same count, with the numbers read from summary.json and never typed into code.
4. The chart prompt is the heading "How much does your start time matter?". It replaces the chart heading while the guided parts are active; the normal heading returns after the first input.
5. On the guided first race, the orientation line shows in the caption area for 2 seconds before the race clock starts. Captions begin when the clock starts. "Skip to result" skips the pause too.
6. Reduced motion: the caption area shows the finished caption ("Both passengers have arrived.", or the 1938 clause when there is no one-seat ride). On the guided first visit it shows the orientation line instead.
7. Both bar markers start at 28 px wide on both layouts. The lane illustrations start at 104 px wide on a phone and 150 px on desktop. These are starting values: any layout problem they cause is reported to Emmanuel and is not resolved by guessing a new size.

### Decisions applied (Emmanuel, answers to the open points)

8. Time budget: the race-screen R16.2 5,000 ms limit measures until the Race_Card is on screen, which now includes the orientation line. The 2,000 ms Orientation_Pause comes after that mark and does not count against it (Requirement 4.7, Requirement 16.14). Race-screen R16.2 carries a superseded pointer.
9. Race-screen R2.5 (start pause) and R5.8 ("Skip to result") carry superseded pointers to this spec: Requirement 4 for the orientation pause, Requirements 4 and 7 for "Skip to result".
10. The task that adds `wait_most` rebuilds all 20 Race_Files, updates race.schema.json and commits the regenerated data; `python -m pipeline verify` must pass (Requirement 1.9). The Race_Files gain `wait_most` and keep every other value unchanged (Requirement 2.6).
11. The tolerance numbers are plain text in the Sources_Sheet method line, not Number_Buttons (Requirement 13.3, 13.6).
12. Route_Preview: phone only, a collapsed strip about 100 px tall showing the bundled route drawing; MapLibre loads only when "View route" is pressed. On desktop the map stays as it is (Requirement 12.3, 12.8, 12.9).
13. The today-win notice is removed at the next Visitor_Input that changes the pair or the time (Requirement 10.6, unchanged).
14. Phone fit: report the cut-off pixels and do not shrink text (Requirement 12.7, unchanged).
15. Captions describe the scheduled passenger's journey, never a vehicle's position. No caption says where a bus is. "Scheduled, not live." stays visible while captions play. A test checks that no caption contains "now", "currently", "at the stop" or a street or corner name (Requirement 7.11 to 7.13, Requirement 16.18). The caption clauses of the Story_Copy_Table were reviewed against this rule and none needed rewording.

### Decisions applied (Emmanuel, answers to the design's open questions)

16. Notices and the schedule line (design Q1, option a): the schedule line with "Scheduled, not live." stays visible in every state. The before-the-table notice, the inferred-corner notice and the today-win notice sit directly under the schedule line, after the slider, in the phone order. This supersedes the "schedule line hidden while a notice shows" part of race-screen R6.7, which carries a pointer (Requirement 7.13, Requirement 12.2).
17. Same-ride tolerance source entry (Q2, option a): `summary.sources` gains the one entry `"ride_same_rule": ["method"]`, so the build's source-coverage check keeps passing. It is the only change to an existing field's value (Requirement 2.6, data contract).
18. Key-order test (Q3): `wait_most` is the last key of a Race_Row, after `margin` when `margin` is present. Emmanuel approves one edit to an existing pipeline test, `tests/unit/test_emit.py::test_key_order_is_fixed`, which adds `"wait_most"` at the end of its expected key list. This is an explicit approval under product.md's rule "never edit a test to make a check pass". It is the only pipeline test whose existing expectation changes, and the commit message of the task SHALL name the test (Requirement 1.10).
19. Plain-text times (Q4): the example label's time and the today-win notice's time are plain text, like the slider's start time, and not Number_Buttons (Requirement 3.8, Requirement 10.5).
20. Overlays (Q5): sheets, the scrim and the banners (share and bad-link) are overlays outside the "no fixed or sticky element" rule. A banner SHALL never cover the result box or the Next_Step_Actions (Requirement 12.1, Requirement 12.11, Requirement 16.12, Requirement 16.19).
21. Hide route (Q6): "Hide route" removes the map instance and returns to the strip, so no further tiles are requested. The preview does not stay open (Requirement 12.9).
22. Count method line (Q7): the Story_Copy_Table "covered starts" method line replaces the race-screen races-count method line (`METHOD_RACE_COUNTS`) for all three counts: `races`, `wins_1938` and `wins_today` (Requirement 13.2).
23. Board row label: the departures board's bus row label reads "Today's bus, from the boarding stop" (Emmanuel's change of "at the boarding stop"). It is a Story_Copy_Table row that wins over the race-screen row under Requirement 13.8 (Requirement 11.3).
24. Chart position (checkpoint 18, Emmanuel): the Start_Time_Chart with its heading, key and readout moves to directly after the Next_Step_Actions on both layouts, so the result box is above the fold at 1280 × 800 and 375 × 667. The slider stays where it is. The chart keeps its inset of half the thumb's width (plus the two buttons and gaps), so its columns and cursor still line up with the slider's thumb (Requirement 9.1).

## Glossary

- **Site**: the static web app in web/ (Vite, TypeScript, MapLibre GL JS).
- **Pipeline**: the Python build in pipeline/, run by `python -m pipeline build`, which writes web/public/data/.
- **Race_Card**: the race content: pair row, start time, slider, lanes, caption area, result box, honest line, takeaway, next-step actions, chart, departures section and secondary buttons. On a phone it is in normal page flow; on desktop it is the 440 px race column.
- **Race_File**: web/public/data/race/<origin>__<dest>.json. Its `races` array holds one Race_Row per slider minute.
- **Race_Row**: one entry of a Race_File's `races` array, with the fields `t`, `start`, `before_table`, `y1938` {`dep`, `wait`, `total`}, `today` {`trip`, `wait`, `total`} or null, `result` (one of "1938", "today", "photo_finish", "no_one_seat_ride") and `margin`.
- **Summary_File**: web/public/data/summary.json, with `races`, `wins_1938`, `wins_today`, `photo_finishes`, `ride_same`, `ride_faster_today`, `ride_slower_today`, `pairs_without_one_seat_ride`, `today_wins[]` (`origin`, `dest`, `t`, `margin`), `pairs[]` and `sources`.
- **Lead_Pair**: Preston & Caroline → Aliceanna & Bond (slugs `preston-caroline`, `aliceanna-bond`).
- **Example_Start**: the start time 10:00, used for a visit with no valid share link.
- **Guided_Visit**: a page visit that opened with no valid share link (no query, or a bad link), from page load until the first Visitor_Input.
- **Guided_Parts**: the example label, the orientation line and the chart prompt heading. They show only during a Guided_Visit.
- **Visitor_Input**: any use of the slider thumb, the minus button, the plus button, the corner picker (choosing a pair), the swap button or any Next_Step_Action. "Skip to result", opening a sheet, opening the departures section and expanding the route preview are not Visitor_Inputs.
- **Guided_First_Race**: the first race of a Guided_Visit, before any Visitor_Input.
- **Orientation_Pause**: the 2,000 ms on the Guided_First_Race between data ready and the race clock starting, during which the caption area shows the orientation line.
- **Lane**: one side's row in the Race_Card: a title row and one 9 px bar on the shared time scale.
- **Lane_Illustration**: the detailed 1938 trolley drawing (screen-brief 3A.2) or the flat bus drawing, placed in its Lane's title row.
- **Bar_Marker**: the small moving glyph on a Lane's bar track: the simplified trolley (the map marker drawing) on the 1938 bar and a small flat bus glyph on today's bar.
- **Ride_Segment**: the solid ride part of a Lane's bar.
- **Phase**: the current part of a Lane at the race clock. 1938 Phases: waiting, riding, arrived. Today Phases: walking to the stop, waiting, riding, walking to the destination, arrived. Phase boundaries come from the stored durations of the Race_Row and its trip (race-screen R5.2, R17.5).
- **Caption_Area**: one text area under the Lanes, reserved at a two-line height, that says what each passenger is doing.
- **Shown_Value**: a value after the race-screen R7 display rounding: shown totals rounded to whole minutes with halves up, shown parts by largest remainder, shown margin as the difference of the two shown totals.
- **Takeaway**: the "Where the time goes" block under the honest line, built from Shown_Values.
- **Wait_Most_Flag**: the new boolean field `wait_most` on every Race_Row, written by the Pipeline.
- **Ride_Same_Rule**: the new object `ride_same_rule` in the Summary_File, with `minutes` and `fraction_pct`.
- **Start_Time_Chart**: the inline SVG chart of the selected pair's stored totals for every slider minute, placed after the Next_Step_Actions and sharing the slider's range.
- **Next_Step_Actions**: the three buttons "Try another time", "Try other corners" and "Show a race today wins".
- **Today_Win_Shortcut**: the "Show a race today wins" action.
- **Departures_Section**: the expandable "Scheduled departures" section that holds the race-screen R8 departures board.
- **Route_Preview**: the phone-only compact route view with the "View route" and "Hide route" toggle. Collapsed, it is a strip about 100 px tall of the bundled route drawing (race-screen R11.4) with the two chosen corners; expanded, it is the existing 150 px MapLibre map.
- **Sources_Sheet**: the race-screen R9 sheet that shows each number's source.
- **Number_Button**: a number rendered as a button with a dotted underline that opens the Sources_Sheet at its row (race-screen R9).
- **Covered_Start**: a Race_Row whose `before_table` is false. The Summary_File `races` count is the count of Covered_Starts.
- **Notices**: the race-screen R6.6 before-the-table notice, the race-screen R6.7 inferred-corner notice and the today-win notice (Requirement 10.5). They sit directly under the schedule line.
- **Overlay**: a sheet (Sources, Corners, About and credits), its scrim, or a banner (the share banner and the bad-link banner). Overlays are outside the "no fixed or sticky element" rule of Requirement 12.1.
- **Story_Copy_Table**: the copy table at the end of this document.

## Data contract changes

Only these three additions are made. No other field of any generated file changes value, and every golden test passes unchanged.

| New field | Where | Meaning |
| --- | --- | --- |
| `wait_most` | every Race_Row | true only when `result` is "1938" or "today" and the loser's shown wait minus the winner's shown wait is more than half the shown margin, all as Shown_Values; false otherwise |
| `ride_same_rule` | Summary_File | `{"minutes": 1.5, "fraction_pct": 15}`, from `SAME_FLOOR_MIN` and `SAME_FRACTION` in pipeline/summary.py |
| `sources.ride_same_rule` | Summary_File, inside the existing `sources` object | the one added entry `["method"]` (decision 17), so the source-coverage check passes for the new numeric field |

`wait_most` is the last key of a Race_Row, after `margin` when `margin` is present (decision 18).

Shown waits for the Wait_Most_Flag: the 1938 shown wait is the largest-remainder part of `y1938.wait` among the parts (wait, `y1938.ride_min`) for the shown 1938 total. Today's shown wait is the largest-remainder part of `today.wait` among the parts (board walk, wait, ride, alight walk) for the shown today total. This is the same rounding the Site uses for the lane legends (race-screen R7.3).

## Requirements

### Requirement 1: Pipeline writes the wait-most flag

**User Story:** As a transit advocate, I want the "Waiting accounts for most of the difference" sentence to come from the pipeline, so that the browser does no race arithmetic and the claim is checkable.

#### Acceptance Criteria

1. THE Pipeline SHALL write a boolean field `wait_most` on every Race_Row of every Race_File.
2. WHEN a Race_Row has `result` "1938" or "today", THE Pipeline SHALL set `wait_most` to true exactly when the loser's shown wait minus the winner's shown wait is greater than half of the shown margin, using Shown_Values computed by the race-screen R7 rounding rules.
3. WHEN a Race_Row has `result` "photo_finish" or "no_one_seat_ride", THE Pipeline SHALL set `wait_most` to false.
4. THE Pipeline SHALL implement the race-screen R7 display rounding (totals to whole minutes with halves up; parts by largest remainder with ties to the earlier phase) in one function used only for this flag and for no stored value.
5. THE Pipeline SHALL add `wait_most` as a required boolean property of the race row in pipeline/schemas/race.schema.json.
6. WHEN the lead race at 10:00 is built from the pinned feed, THE Pipeline SHALL write `wait_most` true for that Race_Row (brief check 9: shown waits 31 and 6, shown margin 30). IF the built value differs, THEN THE Pipeline test SHALL fail and the difference SHALL be reported to Emmanuel without changing any golden value, facts file or test.
7. THE Pipeline test suite SHALL include example tests, a golden test on the pinned feed that skips with a clear message when raw/ is missing, and Hypothesis property tests for the flag: for any non-negative stored parts, the flag equals the predicate of criterion 2 on Shown_Values, and the flag is false for every photo finish and every no-one-seat-ride row.
8. THE Site test suite SHALL include an agreement test that, for every Race_Row of all 20 Race_Files, applies the Site's R7 rounding function to the stored parts and checks that the criterion 2 predicate on the resulting Shown_Values equals the stored `wait_most`.
9. WHEN the task that adds `wait_most` is committed, THE commit SHALL include all 20 rebuilt Race_Files and the updated pipeline/schemas/race.schema.json, and `python -m pipeline verify` SHALL pass on that commit.
10. THE Pipeline SHALL write `wait_most` as the last key of every Race_Row, after `margin` when `margin` is present.
11. THE task that adds `wait_most` SHALL add `"wait_most"` at the end of the expected key list of `tests/unit/test_emit.py::test_key_order_is_fixed` and SHALL name that test in its commit message. This is the one edit to an existing pipeline test that Emmanuel has approved (decision 18); no other existing pipeline test expectation SHALL change, and no golden value, facts file or other test SHALL be edited to make a check pass.

### Requirement 2: Pipeline writes the same-ride tolerance

**User Story:** As a reporter, I want the Sources sheet to name the same-ride tolerance, so that I can check what "about as long" means without the site typing a number.

#### Acceptance Criteria

1. THE Pipeline SHALL write `ride_same_rule` into the Summary_File as an object with `minutes` equal to `SAME_FLOOR_MIN` and `fraction_pct` equal to `SAME_FRACTION` × 100, both read from the constants in pipeline/summary.py.
2. THE Pipeline SHALL write `fraction_pct` as the exact number 15 for the current constants, with no floating-point residue.
3. THE Pipeline SHALL add `ride_same_rule` as a required property of pipeline/schemas/summary.schema.json, with `minutes` and `fraction_pct` as required numbers and no other properties.
4. THE Pipeline test suite SHALL check that `ride_same_rule` equals the two constants, that `sources.ride_same_rule` equals `["method"]`, and that the summary schema tests accept the new field.
5. WHEN `python -m pipeline validate`, `build`, `check`, `verify` and `check_sources` are run after this change and the regenerated data is committed, THE Pipeline SHALL pass all five, with every golden test unchanged.
6. THE Pipeline SHALL change the generated files only by adding `wait_most` to every Race_Row (Requirement 1), adding `ride_same_rule` to the Summary_File, and adding the one entry `"ride_same_rule": ["method"]` to `summary.sources`, and SHALL leave every other field of index.json, summary.json, route.geojson and the Race_Files with the same value as before this change.

### Requirement 3: First visit and the example start

**User Story:** As a first-time visitor, I want the page to open on a labelled example race, so that I see the main finding without choosing anything.

#### Acceptance Criteria

1. WHEN the page opens with no query, THE Site SHALL race the Lead_Pair at the Example_Start and show the example label (Story_Copy_Table) beside the start time.
2. WHEN the page opens with a bad share link (race-screen R4.6), THE Site SHALL race the Lead_Pair at the Example_Start, show the example label and show the bad-link banner.
3. WHEN the page opens with a valid share link, THE Site SHALL open that link's pair at the race-screen R3.4 default time (the America/New_York time of day if inside the slider range, otherwise 10:00) and show no example label.
4. WHILE a Guided_Visit is active, THE Site SHALL show the Guided_Parts: the example label, the orientation line during the Orientation_Pause, and the chart prompt heading in place of the chart heading.
5. WHEN the first Visitor_Input of a visit occurs, THE Site SHALL remove the example label and the chart prompt heading, show the normal chart heading, and keep the Guided_Parts hidden for the rest of the visit.
6. WHILE no Guided_Visit is active, THE Site SHALL keep the race-screen R3.4 "Start time is the time now." line for a clock-derived start time.
7. THE Site SHALL keep race-screen property P2 for shared links: the default time is inside the slider range for every clock time.
8. THE Site SHALL show the time in the example label as plain text, like the slider's start time, and not as a Number_Button.

### Requirement 4: Orientation pause on the guided first race

**User Story:** As a first-time visitor, I want one short sentence before the race moves, so that I know what is being compared.

#### Acceptance Criteria

1. WHEN the data for the Guided_First_Race is ready, THE Site SHALL show the orientation line in the Caption_Area for 2,000 ms and then start the race clock. This 2,000 ms replaces the 300 ms start pause of race-screen R2.5 for the Guided_First_Race only.
2. WHEN the race clock starts, THE Site SHALL replace the orientation line with the captions of Requirement 7.
3. WHILE the Orientation_Pause is running, THE Site SHALL show "Skip to result".
4. WHEN "Skip to result" is used during the Orientation_Pause, THE Site SHALL end the pause and jump both Lanes to finished as in race-screen R5.8.
5. WHEN a Visitor_Input occurs during the Orientation_Pause, THE Site SHALL end the pause and handle the input as in the race-screen spec.
6. WHERE the device asks for reduced motion, THE Site SHALL run no Orientation_Pause.
7. THE Site SHALL set the race-screen R16.2 "race-start" performance mark when the Race_Card is first on screen with its data filled in (on the Guided_First_Race, with the orientation line shown in the Caption_Area), before the Orientation_Pause or the 300 ms start pause begins, so that neither pause counts against the 5,000 ms limit. This criterion replaces the R16.2 measurement point "when the first lane begins to move".

### Requirement 5: Lane illustrations in the title row

**User Story:** As a visitor, I want each side's vehicle drawn once as the lane's identity, so that the drawings do not suggest who is ahead.

#### Acceptance Criteria

1. THE Site SHALL place each Lane_Illustration in its Lane's title row, outside the shared time scale.
2. THE Site SHALL draw the 1938 Lane_Illustration 104 px wide on the phone layout and 150 px wide on the desktop layout, as starting values.
3. THE Site SHALL keep each Lane_Illustration at the same position and box size before, during and after a race.
4. THE Site SHALL keep the 1938 Lane_Illustration's two poles, two hairline wires and glow, and SHALL run its bob, pole sparks and turning hubs only while the 1938 Bar_Marker moves.
5. THE Site SHALL draw today's Lane_Illustration flat and plain, with no bob, glow or sparks.
6. THE Site SHALL draw the trolley route number on the 1938 Lane_Illustration only at 150 px wide or more, as in race-screen R12.3.
7. IF a Lane_Illustration size makes the title row overlap, clip or push other content out of its zone in any picture produced by `npm run screens`, THEN THE build report SHALL describe the problem to Emmanuel, and THE Site SHALL keep the starting size until Emmanuel chooses a new one.

### Requirement 6: Moving bar markers

**User Story:** As a visitor, I want a small marker to show each passenger's ride along the bar, so that I can follow both journeys on one time scale.

#### Acceptance Criteria

1. THE Site SHALL draw a Bar_Marker 28 px wide on each Lane's bar track on both layouts: the simplified trolley on the 1938 bar and a small flat bus glyph on today's bar.
2. WHILE a Lane is in a Phase before its ride, THE Site SHALL hold that Lane's Bar_Marker centre at the start of its Ride_Segment.
3. WHILE a Lane is in its riding Phase, THE Site SHALL place that Lane's Bar_Marker centre within 1 px of the filled end of its Ride_Segment.
4. WHILE a Lane is in a Phase after its ride, THE Site SHALL hold that Lane's Bar_Marker centre at the end of its Ride_Segment.
5. WHILE today's Lane is in a walking Phase, THE Site SHALL keep today's Bar_Marker still and keep the existing walk dots.
6. THE Site SHALL pad each bar track by half the Bar_Marker width at each end, so that no Bar_Marker clips, with bar widths equal to minutes times the shared scale, unchanged from the race-screen build.
7. THE Site SHALL animate the Bar_Markers with transform and opacity only.
8. THE Site SHALL carry the race comparison only in arrival emphasis, totals and the result box; Bar_Marker position along the Lane SHALL carry no winner styling.
9. WHERE the device asks for reduced motion, THE Site SHALL draw each Bar_Marker parked at the end of its Ride_Segment.
10. IF the 28 px Bar_Marker size causes a clip, an overlap or a marker wider than its Ride_Segment in any picture produced by `npm run screens`, THEN THE build report SHALL describe the problem to Emmanuel, and THE Site SHALL keep the 28 px size until Emmanuel chooses a new one.

### Requirement 7: Captions

**User Story:** As a first-time visitor, I want one plain line saying what each passenger is doing, so that I understand the animation without reading the bars.

#### Acceptance Criteria

1. THE Site SHALL place one Caption_Area under the Lanes with its height reserved at two lines in every state, so that the content below does not move when the caption changes.
2. WHILE the race clock runs, THE Site SHALL show in the Caption_Area the 1938 clause for the 1938 Lane's current Phase followed by the today clause for today's Lane's current Phase (Story_Copy_Table).
3. THE Site SHALL choose each caption clause only from the current Phases of the two Lanes.
4. WHILE exactly one side has arrived, THE Site SHALL add "still " to the clause of the side that has not arrived, and SHALL add "still " in no other case.
5. WHEN both sides have arrived, THE Site SHALL show "Both passengers have arrived."
6. WHILE the Race_Row has no one-seat ride, THE Site SHALL show only the 1938 clause, without "still ".
7. THE Site SHALL render the Caption_Area as plain text outside any live region, and SHALL keep the single result announcement of race-screen R13.2 unchanged.
8. THE Site SHALL render no digit in the Caption_Area in any state.
9. WHEN "Skip to result" is used, THE Site SHALL show the finished caption: "Both passengers have arrived.", or the arrived 1938 clause when there is no one-seat ride.
10. WHERE the device asks for reduced motion, THE Site SHALL show the finished caption in the Caption_Area with no caption sequence, except on the Guided_First_Race, where THE Site SHALL show the orientation line.
11. THE Site SHALL word every caption clause as the scheduled passenger's journey, naming only what the passenger is doing in the stored schedule, and SHALL state no vehicle's position.
12. THE Site SHALL render no caption containing the word "now", the word "currently", the phrase "at the stop", or any street name or corner name from index.json.
13. WHILE the Caption_Area shows a caption or the orientation line, THE Site SHALL keep the fixed phrase "Scheduled, not live." visible on screen in the Race_Card, in every state including while any Notice shows. THE Site SHALL keep the schedule line visible while a Notice shows and SHALL place each Notice directly under the schedule line (decision 16, superseding the schedule-line-hidden part of race-screen R6.7).

### Requirement 8: Where the time goes

**User Story:** As a reporter, I want the card to show after the finish where each passenger's minutes went, so that I can see that waiting causes most of the gap.

#### Acceptance Criteria

1. WHEN the result box appears, THE Site SHALL show the Takeaway under the honest line, with the heading and rows of the Story_Copy_Table.
2. THE Site SHALL fill the Takeaway rows with the same Shown_Values as the lane legends, each value a Number_Button with a Sources_Sheet row.
3. THE Site SHALL show the Takeaway walking value as the sum of the shown walk parts (race-screen R7.5), with the Sources line "Sum of the two walks as shown, to and from the stop."
4. WHILE the Race_Row has no one-seat ride, THE Site SHALL show only the trolley Takeaway rows.
5. WHEN the result box appears and the Race_Row's `wait_most` is true, THE Site SHALL show "Waiting accounts for most of the difference in this race." in the Takeaway.
6. WHEN the Race_Row's `wait_most` is false, THE Site SHALL omit the "most of the difference" sentence.
7. THE Site SHALL read the "most of the difference" decision only from `wait_most` and SHALL compute no wait comparison of its own.
8. WHERE the device asks for reduced motion, THE Site SHALL show the Takeaway at once with the result box.

### Requirement 9: Start-time chart

**User Story:** As a planner, I want a chart of the scheduled journey minutes for every start time, so that I can see whether one race is typical.

#### Acceptance Criteria

1. THE Site SHALL draw the Start_Time_Chart as inline SVG with no chart library, after the Next_Step_Actions (not next to the slider, so that the result is above the fold, decision 24), sharing the slider's range and inset by half the slider thumb's width on both sides, so that each slider minute lines up with its column and the chart cursor lines up with the slider thumb.
2. THE Site SHALL draw the Start_Time_Chart only from the selected pair's Race_File, fetching no other file for it.
3. THE Site SHALL draw two step series, one value per Race_Row: `y1938.total` in --ghost and `today.total` in --today, each sample as stored, with no smoothing and no average.
4. THE Site SHALL use one shared vertical scale starting at 0 for both series and SHALL draw no numeric axis labels.
5. WHERE a Race_Row has `before_table` true, THE Site SHALL hatch that minute's column and label the hatched range with the hatch label of the Story_Copy_Table.
6. THE Site SHALL draw a cursor at the slider's current minute.
7. THE Site SHALL show under the chart the readout of the Story_Copy_Table for the slider's minute, with that minute's two shown totals as Number_Buttons.
8. WHEN the pair, the direction or the Today_Win_Shortcut changes the Race_File, THE Site SHALL redraw the Start_Time_Chart from the new Race_File before the new race starts.
9. WHILE the selected pair has no one-seat ride, THE Site SHALL draw only the 1938 series and the 1938 readout form.
10. THE Site SHALL accept no pointer input on the Start_Time_Chart; the slider SHALL stay the only time control.
11. THE Site SHALL give the Start_Time_Chart the accessible name of the Story_Copy_Table.
12. THE Site SHALL label the slider "Choose a scheduled start time" (visible label and input name) and show its two ends as the first and last Race_Row `t` in 12-hour form.

### Requirement 10: Next-step actions

**User Story:** As a visitor who has seen one race, I want three clear next steps, so that I can test the finding myself.

#### Acceptance Criteria

1. THE Site SHALL show the Next_Step_Actions, in the order "Try another time", "Try other corners", "Show a race today wins", under the Takeaway on both layouts.
2. WHEN "Try another time" is pressed, THE Site SHALL move focus to the slider and scroll the slider into view.
3. WHEN "Try other corners" is pressed, THE Site SHALL open the corner picker (race-screen R4.1).
4. WHEN the Today_Win_Shortcut is pressed, THE Site SHALL select the next entry of `summary.today_wins` in file order, starting with the first entry on the first press of a visit and wrapping after the last entry.
5. WHEN the Today_Win_Shortcut selects an entry, THE Site SHALL set that entry's pair and start time `t`, update the address bar to encode(pair) (race-screen R4.7), show the today-win notice directly under the schedule line, with its start time as plain text like the slider's start time, and play that race.
6. WHEN a later Visitor_Input changes the pair or the start time, THE Site SHALL remove the today-win notice.
7. THE Site SHALL place "Sources" and "Share this race" after the Next_Step_Actions as secondary buttons on both layouts.
8. THE Site SHALL make every Next_Step_Action and secondary button a tap target of at least 44 × 44 px, reachable by keyboard.

### Requirement 11: Scheduled departures section

**User Story:** As a reporter, I want the departures board available on request, so that the first race stays uncluttered and the times stay checkable.

#### Acceptance Criteria

1. THE Site SHALL move the race-screen R8 departures board into the Departures_Section, closed by default, below the Next_Step_Actions on both layouts.
2. WHEN the Departures_Section button is pressed, THE Site SHALL open or close the Departures_Section and expose the state through `aria-expanded`.
3. THE Site SHALL use the Departures_Section header and row labels of the Story_Copy_Table: "1938 trolley, at this corner" and "Today's bus, from the boarding stop". THE lane title "Today's bus" SHALL stay unchanged.
4. THE Site SHALL keep the content rules of race-screen R8.2, R8.3 and R8.5 unchanged.
5. WHILE the Departures_Section is open, THE Site SHALL keep every time and gap in the board a Number_Button.

### Requirement 12: Phone reading order and page flow

**User Story:** As a phone visitor, I want the page to read top to bottom in story order, so that I never fight pinned bars or nested scrolling.

#### Acceptance Criteria

1. WHILE the viewport is below 900 px wide, THE Site SHALL lay out the page in normal flow, with no fixed or sticky element and no element that scrolls inside the Race_Card. Overlays (sheets, their scrim and banners) are outside this rule; WHILE no sheet is open and no banner shows, THE Site SHALL display no fixed or sticky element.
2. WHILE the viewport is below 900 px wide, THE Site SHALL order the content as: top bar; intro line; Route_Preview with "View route"; pair names on two lines (start, then "→ destination") with the swap button; example label and start time; slider; schedule line; Notices (before-the-table, inferred corner, today-win), directly under the schedule line; both Lanes; Caption_Area; result box; honest line; Takeaway; Next_Step_Actions; Start_Time_Chart with its heading and readout; Departures_Section (closed); "Sources" and "Share this race"; "About and credits".
3. WHILE the viewport is below 900 px wide and the Route_Preview is collapsed, THE Site SHALL show the Route_Preview as a strip 100 px tall (a starting value, reported to Emmanuel under the rule of Requirement 5.7 if it causes a layout problem) of the bundled route drawing with the two chosen corners, and SHALL load no MapLibre code and request no map tiles. A corner name on the strip SHALL be shown only where it sits next to its own dot: no more than `MAP_LAYOUT.phonePreview.nameReach` from the dot's centre, nearer to it than to any other corner's dot, and clear of the "View route" column, the trolley marker, the route's lines, the dots and the other name. A name that cannot sit there is hidden on the strip (its dot stays, and the pair row names both corners to assistive technology). The 150 px map and the desktop drawing are unchanged (Emmanuel, checkpoint 18, round 2).
4. WHILE the viewport is 900 px wide or more, THE Site SHALL order the race column content as in criterion 2 from the pair names down, without the intro line and the Route_Preview.
5. THE Site SHALL keep every text size at or above the race-screen minimums.
6. THE Site SHALL show no sideways scrolling at 320, 375 and 899 px wide.
7. WHEN the lead example reaches its result moment at 375 × 667, THE phone layout test SHALL check whether the Caption_Area and the result line are both inside the viewport without scrolling. IF either is outside it, THEN THE test SHALL report by how many pixels, and THE Site SHALL keep text sizes unchanged until Emmanuel decides.
8. WHEN "View route" is pressed, THE Site SHALL load MapLibre by a lazy import, expand the Route_Preview to the existing 150 px map and change the toggle to "Hide route".
9. WHEN "Hide route" is pressed, THE Site SHALL remove the map instance, collapse the Route_Preview to the 100 px strip of the bundled route drawing, change the toggle to "View route" and request no further map tiles. THE Route_Preview SHALL NOT stay expanded after "Hide route".
10. WHILE the viewport is 900 px wide or more, THE Site SHALL show no Route_Preview and SHALL keep the race-screen desktop map unchanged.
11. WHILE a banner (the share banner or the bad-link banner) shows, THE Site SHALL NOT let it cover the result box or the Next_Step_Actions, at the result moment, on a phone from 320 to 899 px wide.

### Requirement 13: Honest copy and scoped Sources lines

**User Story:** As a skeptical reader, I want every count and method line to say exactly what it covers, so that no claim is wider than the data.

#### Acceptance Criteria

1. THE Site SHALL use the Story_Copy_Table honest lines, which count "covered starts", in place of the race-screen honest lines.
2. THE Site SHALL use the scoped Sources lines of the Story_Copy_Table for the `races` count, the `ride_same` count and the frequency sentence. THE Site SHALL use the Story_Copy_Table "covered starts" method line, in place of the race-screen races-count method line (`METHOD_RACE_COUNTS`), for all three counts that line serves: `races`, `wins_1938` and `wins_today`.
3. THE Site SHALL fill the tolerance in the ride-same method line as plain text from `ride_same_rule.minutes` and `ride_same_rule.fraction_pct` of the Summary_File, rendering the two tolerance numbers as plain text and not as Number_Buttons, because that Sources_Sheet line is their source.
4. THE Site SHALL read every count on screen, including the "When today wins" list heading count `wins_today`, from the Summary_File.
5. THE Site SHALL render none of the words live, real-time, realtime, "arriving now", "right now", now or citywide in any new string, except the fixed phrase "Scheduled, not live." and the existing race-screen line "Start time is the time now."
6. THE Site SHALL give every new number on screen (Takeaway values, chart readout values, the "When today wins" heading count) a Number_Button with a Sources_Sheet row; the Ride_Same_Rule numbers inside the Sources_Sheet method line follow criterion 3 instead.
7. THE Site SHALL apply the race-screen R15.5 singular rule to every new string with a minute count.
8. THE Site SHALL use only strings from the Story_Copy_Table and the race-screen copy table; where both have a row for the same place, the Story_Copy_Table row SHALL win.

### Requirement 14: Map dimming on desktop (cut first if late)

**User Story:** As a desktop visitor, I want the map to highlight the stretch I am racing, so that I see where the two corners are on the line.

#### Acceptance Criteria

1. WHERE map dimming is built, WHILE the viewport is 900 px wide or more, THE Site SHALL draw the selected pair's stretch of the 1938 line at full brightness and the rest of the line dimmed.
2. WHERE map dimming is built, THE Site SHALL dim route lines only and SHALL keep map text at 80% opacity or more.
3. THE Site SHALL keep the race independent of the map: the whole story SHALL play with the tile host blocked and WebGL absent (race-screen R17.6).

### Requirement 15: Accessibility

**User Story:** As a keyboard or screen-reader user, I want the new parts to work like the rest of the screen, so that I get the same story.

#### Acceptance Criteria

1. THE Site SHALL pass axe-core on: the first visit, racing, finished, the today-win notice, the open Departures_Section and the expanded Route_Preview.
2. THE Site SHALL let keyboard alone reach the three Next_Step_Actions, the chart readout's Number_Buttons, the Departures_Section toggle and the Route_Preview toggle, each with a visible focus ring.
3. THE Site SHALL announce the result once per race through the race-screen R13.2 region, and SHALL keep the Caption_Area out of any live region.
4. WHERE the device asks for reduced motion, THE Site SHALL show the Takeaway at once and play no caption sequence.

### Requirement 16: Tests, budgets and pictures

**User Story:** As Emmanuel, I want the story layer checked against the data and the budgets, so that I can review it before the deadline with confidence.

#### Acceptance Criteria

1. THE Site test suite SHALL check marker geometry (Requirement 6) in the lead race at 10:00 on 375 × 667 and 1280 × 800 at ten clock moments, and SHALL check that the trolley Bar_Marker travels its Ride_Segment's full width within 1 px.
2. THE Site test suite SHALL check the first-visit cases: no query, bad link (with banner), and valid link with a fixed clock (no example label).
3. THE Site test suite SHALL check, after each kind of Visitor_Input, that the Guided_Parts are gone and stay gone, and that captions keep working on the next race.
4. THE Site test suite SHALL check with fake timers that the caption sequence equals the sequence worked out from the Race_File's stored phase boundaries for: the lead race at 10:00; the first `summary.today_wins` entry read from the file; the lead pair at 10:30; the lead pair at 9:00; one Brevard pair; and the no-one-seat-ride fixture.
5. THE Site test suite SHALL include a fast-check property over sampled Race_Rows of all 20 Race_Files and sampled clock moments: the caption clauses name the Phases the Lanes show, and "still" appears only while the other side has arrived.
6. THE Site test suite SHALL use a made-up Summary_File in which every count, `ride_same_rule` and `today_wins` differ from the real file, and SHALL check that the counts, the "When today wins" heading, the Today_Win_Shortcut order and notice, and the Sources method lines show the fixture's values.
7. THE Site test suite SHALL check that no digit string from the real Summary_File appears in any file under web/src/ (extending race-screen task 19.3 and P5).
8. THE Site test suite SHALL use a made-up Race_File to check that the chart columns equal its stored totals, that its before-table minutes are hatched, and that the readout, the Takeaway, the "most of the difference" sentence (one row with `wait_most` false where walking and riding make up most of the margin) and the captions follow the fixture.
9. THE Site test suite SHALL check after every pair change, swap and Today_Win_Shortcut that the chart series equal the new Race_File's rows and that no extra Race_File was fetched.
10. THE Site test suite SHALL check that 25 presses of the Today_Win_Shortcut visit the `summary.today_wins` entries in file order (the count read from the file), then wrap, each with the address bar equal to encode(pair), the notice shown and a race whose result is "today".
11. THE Site test suite SHALL extend the race-screen P3 DOM crawl and the banned-word scan to every new part and state.
12. THE Site test suite SHALL check that on 375 × 667, with no sheet open and no banner showing, no displayed element is fixed or sticky, no element scrolls inside the Race_Card, and the DOM order matches Requirement 12 (including the Notices directly under the schedule line).
13. THE Site SHALL keep `npm run check:size` under 100 KB compressed with the map excluded, and SHALL add no runtime dependency.
14. THE Site SHALL keep the `npm run perf` median under 5,000 ms, measured as in race-screen R16.2 on a quiet machine, with the "race-start" mark placed as in Requirement 4.7, so that the Orientation_Pause does not count against the limit.
15. THE Site SHALL make `npm run screens` add pictures of: the first visit, racing with a caption, finished with the Takeaway, the today-win notice, the chart, and the phone page at the lead example's result moment.
16. WHEN a test of a superseded race-screen requirement is changed, THE commit message SHALL name that test; no such test SHALL be deleted without being named.
17. THE race-screen and race-engine test suites SHALL pass after this feature.
18. THE Site test suite SHALL check, for every caption the caption sequence tests of criterion 4 and the property of criterion 5 produce and for the orientation line, that the text contains no whole word "now" or "currently" (case-insensitive), no phrase "at the stop", and no street name or corner name read from index.json, and that "Scheduled, not live." is visible in the Race_Card at the same moment.
19. THE Site test suite SHALL run a bad-link Guided_Visit at 375 × 667 and at 320 px wide, and at the result moment SHALL check that the bad-link banner's box does not intersect the result box or any Next_Step_Action box (Requirement 12.11), and SHALL report any overlap by pixels. THE test SHALL also check that "Scheduled, not live." is visible while each Notice shows (Requirement 7.13).
20. THE Site test suite SHALL update the tests that assert the departures board's bus row label (decision 23): `web/tests/dom/board.test.ts` (its assertion on `.board-row-today .board-label`, now against a new `BOARD_TODAY` constant instead of `LANE_TITLE_TODAY`) and `web/tests/unit/copy-table.test.ts` (its table of copy constants, to add `BOARD_TODAY` and the new `BOARD_1938` text). Each SHALL be named in the commit message (Requirement 16.16).

## Story copy table

New rows, and rows that replace a race-screen row (marked **replaces**). Placeholders in braces are read from the data at run time. Minute words follow race-screen R15.5.

| Where | String |
| --- | --- |
| Example label (Req 3) | "Example start: {h:mm AM/PM} scheduled." ({h:mm AM/PM} is plain text, not a Number_Button) |
| Phone intro line (Req 12) | "Race Baltimore's 1938 trolley against today's scheduled bus." |
| Orientation line (Req 4) | "Same two corners. Walking included for today; walks are estimates." |
| Caption, 1938 clause (Req 7) | waiting: "The trolley passenger is {still }waiting for the car."; riding: "The trolley passenger is {still }riding."; arrived: "The trolley passenger has arrived." |
| Caption, today clause (Req 7) | walking to the stop: "Today's passenger is {still }walking to the stop (estimate)."; waiting: "Today's passenger is {still }waiting to board."; riding: "Today's passenger is {still }riding."; walking to the destination: "Today's passenger is {still }walking to the destination (estimate)."; arrived: "Today's passenger has arrived." |
| Caption, both done (Req 7) | "Both passengers have arrived." |
| {still } rule | "still " only while the other side has arrived; otherwise nothing |
| Takeaway heading (Req 8) | "Where the time goes" |
| Takeaway rows (Req 8) | "Waiting: trolley {a} min, today's bus {b} min."; "Walking (estimate): today's bus {w} min."; "Riding: trolley {c} min, today's bus {d} min." ({w} is the sum of the shown walk parts. With no one-seat ride: "Waiting: trolley {a} min." and "Riding: trolley {c} min.") |
| Most of the difference (Req 8) | "Waiting accounts for most of the difference in this race." |
| Next-step actions (Req 10) | "Try another time"; "Try other corners"; "Show a race today wins" |
| Today-win notice (Req 10) | "Showing a race today wins: {origin} → {dest}, starting {h:mm AM/PM} (scheduled)." (the time is plain text, not a Number_Button; the notice sits directly under the schedule line) |
| Slider label (Req 9) | visible label and input name "Choose a scheduled start time" (**replaces** the input name "Start time") |
| Slider ends (Req 9) | "{h:mm AM/PM}" for both ends, read from the Race_File (**replaces** the 24-hour end labels) |
| Chart heading (Req 9) | "How much does the start time matter?" |
| Chart prompt heading, Guided_Parts only (Req 3, Req 9) | "How much does your start time matter?" (replaces the chart heading while the Guided_Parts show) |
| Chart subheading (Req 9) | "Scheduled journey minutes for each start time, for these corners and this direction." |
| Chart legend (Req 9) | "1938 trolley"; "Today's bus, walking included (estimated)" |
| Chart readout (Req 9) | "At {h:mm AM/PM}: trolley {n} min, today's bus {m} min." (with no one-seat ride: "At {h:mm AM/PM}: trolley {n} min.") |
| Chart hatch label (Req 9) | "Before the 1938 midday timetable reaches this corner" |
| Chart accessible name (Req 9) | "Chart of scheduled journey minutes for each start time, 1938 trolley and today's bus. Move the start time slider to read a minute." |
| Route preview (Req 12) | "View route"; "Hide route" |
| Departures section (Req 11) | section button "Scheduled departures"; header "Scheduled departures after {h:mm}" (**replaces** "Scheduled departures from this corner after {h:mm}"); row labels "1938 trolley, at this corner" and "Today's bus, from the boarding stop" (**replace** the race-screen row labels "1938 trolley" and "Today's bus"; these rows win over the race-screen rows under Requirement 13.8; Emmanuel's wording, decision 23; the lane title "Today's bus" is unchanged) |
| Honest line (Req 13) | "Same ride, longer wait. Trolley first in {wins_1938} of {races} covered starts. When today wins" (**replaces**) |
| Honest line, today wins (Req 13) | "Today wins this race. Across this line: same ride, longer wait. Trolley first in {wins_1938} of {races} covered starts. When today wins" (**replaces**) |
| When today wins list, heading (Req 13) | "The {wins_today} races today wins" (then the existing race-screen sentence and list) |
| What a number is (Req 8, Req 13) | new: "walks to and from the stop, together (estimate)"; "covered starts where today's bus arrives first". **Replace** "races on this line" with "covered starts on this line", and "races where the 1938 trolley arrives first" with "covered starts where the 1938 trolley arrives first" |
| Sources, how it was worked out: races count (Req 13) | "Counted over every corner pair and every start minute that the 1938 midday timetable covers at the start corner. Earlier minutes, which race from the first listed car, are not counted." (**replaces** "Counted over every race on this line, one per corner pair and slider minute." for all three counts that line serves: `races`, `wins_1938` and `wins_today`; decision 22) |
| Sources, how it was worked out: ride-same count (Req 2, Req 13) | "Counted over this line's corner pairs, comparing each 1938 ride with the median of today's scheduled rides. About as long means within {ride_same_rule.minutes} minutes or {ride_same_rule.fraction_pct}% of the 1938 ride, whichever is larger." (**replaces** the race-screen ride line) |
| Frequency (Req 13) | "For these corners and this direction, scheduled one-seat buses leave {gap part} between {window_from} and {window_to} ({route_names}, weekday schedule as of {service_date}). In the covered 1938 midday timetable, a trolley was scheduled at this corner every {a} or {b} minutes." (**replaces**; the {gap part} and equal-value rules of race-screen R8.5 are unchanged) |
| Sources, how it was worked out: Takeaway walk sum (Req 8) | "Sum of the two walks as shown, to and from the stop." |
| Picker, second step (task 25.2) | "Now tap where the ride ends." (**replaces** the race-screen picker line "Start is set. Now choose where the ride ends."; shown in the corner list and in the desktop map hint after the first corner tap on the map or the strip) |

## Open points (all resolved)

Each point raised for review is closed. The decision that resolved it is listed under "Decisions applied".

1. **Perf measurement and the 2 s orientation pause.** Resolved by decision 8: the mark is set when the Race_Card is on screen, before the pause (Requirement 4.7).
2. **Race-screen requirements touched without a pointer.** Resolved by decision 9: R2.5, R5.8 and R16.2 now carry pointers.
3. **Race file change versus the brief.** Resolved by decision 10 (Requirement 1.9, Requirement 2.6).
4. **Tolerance numbers are not Number_Buttons.** Confirmed by decision 11 (Requirement 13.3, 13.6).
5. **What the compact Route_Preview shows.** Resolved by decision 12 (Requirement 12.3, 12.8 to 12.10).
6. **How long the today-win notice stays.** Approved as written (decision 13, Requirement 10.6).
7. **The phone fit at the result moment.** Approved as written (decision 14, Requirement 12.7).
8. **R17.4's today-win pair.** Information only, no decision needed. Checked in the data: Westwood & Carey → Preston & Caroline at 11:23 has `result` "today", so race-screen R17.4 is correct. It is the 11th entry of `summary.today_wins`; the first entry is Westwood & Carey → Dolphin & Myrtle at 11:23. Requirement 16.4 reads the first entry from the file.
9. **Present-tense captions.** Resolved by decision 15 (Requirement 7.11 to 7.13, Requirement 16.18). The clauses were reviewed and kept as written.

## Delivery order and cut list

Day plan (brief section 5): day 1 Requirements 5, 6, 12 and 10.1 to 10.3; day 2 Requirements 3, 4, 7, 8 and 13; day 3 Requirement 9; day 4 Requirements 1, 2, 10.4 to 10.6, 11 and 14; day 5 verification only (Requirements 15 and 16.13 to 16.15), then freeze. Requirement 1 must land before Requirement 8.5 can be tested on real data.

If it slips, cut in this order: Requirement 14 (map dimming); the Route_Preview, keeping today's 150 px map in normal flow; the "most of the difference" sentence (the Takeaway stays). Never cut the phone reading order, the Next_Step_Actions, truthful state handling, or day 5.

## Out of scope

The map race and both vehicles on the map, any tilt or raised buildings, bus shapes on the map, HOLC, any census number, weekly arithmetic, sounds, overhead wires on the map, camera moves, a custom slider, more lines, and any pipeline change other than Requirements 1 and 2.
