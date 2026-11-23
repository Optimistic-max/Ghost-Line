# Ghost cars: Requirements

Source: docs/planning/final/08-ghost-cars-brief.md (Nov 22), pasted by Emmanuel as approval of its copy table and decisions; polish brief P6. Emmanuel's notes of Nov 23: the counter is 12 px text; the phone fit target stays 16 px to spare at 375 x 667, and a stable worst case of at least 8 px with nothing cut off or overlapping is accepted and recorded.

No schema change, no bus paths, no tilt, no new library, no new URL. The feature uses only data the race files already have (`y1938.passes`, `y1938.ride_min`, the row's trip) and the trolley marker the site already moves along the 1938 route (race-screen R5.9). The race-screen and story-layer requirements still hold; where they differ, this spec wins for the ghost cars and the counter only.

## Glossary

- **Car**: a 1938 trolley of the timetable that passes the origin corner at a time `p` in `race.y1938.passes` with `row.start ≤ p < bus departure`, compared in seconds (passes are HH:MM, the departure is the trip's HH:MM:SS).
- **Own car**: the first Car, the race's own trolley, which the race already draws.
- **Ghost car**: every other Car.
- **n**: the number of Cars, the own car included.
- **Bus departure**: `dep` of the row's trip (`today.trip` in the race file's trip list).
- **Covered**: the bus departure is at or before the last listed pass at the origin, so the passes cover the whole wait.
- **Ghost_Row**: a row that is not `before_table`, whose result is not `no_one_seat_ride`, that is Covered, and that has `n ≥ 2`.
- **Counter**: the one line on the card that counts the Cars.

## Requirement 1: Which cars (G1)

1. THE Site SHALL take the Cars of a row as every `p` in `race.y1938.passes` with `row.start ≤ p < bus departure`, comparing whole seconds.
2. THE Site SHALL treat the first Car as the own car and every later Car as a Ghost car.
3. THE Site SHALL compute the Cars, their times relative to the start and their positions only in the modules the principle test allows arithmetic in.

## Requirement 2: When to show them (G2)

1. THE Site SHALL show Ghost cars, the Counter and the map line of Requirement 6 only for a Ghost_Row.
2. WHEN a row is not a Ghost_Row, THE Site SHALL draw the race exactly as before this spec.
3. WHEN the bus departure falls after the last listed pass, THE Site SHALL show no Counter and no Ghost car for that row; the task report lists every such row.

## Requirement 3: How they move (G3)

1. WHILE a race runs, THE Site SHALL show each Ghost car from its pass time `p` and move it along the same 1938 stretch, origin to destination, over `y1938.ride_min`, linear in time by length, with the same track helper and the same clock as the own car.
2. THE Site SHALL remove a Ghost car when it reaches the destination; it does not stand at the stop.
3. THE Site SHALL leave the own car unchanged.
4. THE Site SHALL draw Ghost cars wherever the own car's marker is drawn: on the map, and on the bundled route drawing while the map is not ready or is unavailable. The one exception is the phone's collapsed 100 px strip, which shows no Ghost car and no map line: its stretch is too short to tell the cars apart, and the map line would cover its drawing (design decision 5; found by the 02-racing picture check, Nov 23). "View route" shows them.
5. THE Site SHALL draw a Ghost car as the simplified trolley marker in --ghost at 45% opacity with a softer glow, moved by transform only. Only 1938 glows; today's side is unchanged.
6. WHEN the race is not running (before it starts, finished, held), THE Site SHALL show no Ghost car.

## Requirement 4: The counter (G4)

1. THE Site SHALL place the Counter in the today lane, on one line of 12 px text, and reserve that one line's height for the whole race and the finished card, so the card never reflows when its text changes.
2. WHILE the race runs, from the own car's pass until the bus departure, THE Site SHALL show "1938 trolleys scheduled past this corner: {k}", where `k` is the number of Cars whose pass time has been reached; `k` changes at each pass time with no animation beyond the number changing.
3. WHILE the race runs before the own car's pass, THE Site SHALL leave the Counter's reserved line empty.
4. WHEN the bus departure has passed, and on every finished card (reduced motion, skip, replay end, a shared link), THE Site SHALL show "{n} 1938 trolleys were scheduled here before today's bus." on one line, in the 343 px phone card and the desktop race column (Emmanuel, Nov 23: the brief's longer sentence took two lines and cost the phone fit 16 px).
5. THE Site SHALL make `{k}` and `{n}` Number_Buttons that open the Sources sheet at the 1938 timetable row: the 1938 timetable link of the race file, the effective date, and the method line "Counted from the 1938 timetable's scheduled departures at the origin corner, from the start time until today's bus is scheduled to leave."
6. THE Counter SHALL keep keyboard focus on its number button when the number changes.

## Requirement 5: Motion levels (G5)

1. WHILE motion is reduced, THE Site SHALL draw no Ghost car and SHALL show the Counter's finished sentence at once.
2. WHILE motion is lite, THE Site SHALL move the Ghost cars as at full motion.
3. WHEN "Skip to result" is pressed, THE Site SHALL remove every Ghost car and show the Counter's finished sentence.

## Requirement 6: Honesty (G6)

1. WHILE Ghost cars show, THE Site SHALL add the map line "Fainter cars: other scheduled 1938 departures." to the map area's lines, on the map and on the drawing (not on the phone strip, Req 3.4).
2. THE Site SHALL show no other new text and no number on the map.
3. THE banned-word scans SHALL cover the new strings.

## Requirement 7: Checks

1. Golden: the lead pair at 10:00 gives `n = 4`, with Cars at 10:06, 10:13, 10:21 and 10:28, read from web/public/data/race/. A different value is a STOP and report to Emmanuel; the value is never edited.
2. Property (fast-check): over rows of the made-up fixture line and the 20 real race files, and random elapsed times, `n` equals the count of passes in `[start, bus departure)`; no Ghost car shows before its pass time or at or after `pass + ride_min`; Ghost cars never show for `before_table`, `no_one_seat_ride`, rows that are not Covered, or `n < 2`.
3. DOM: the Counter changes at the right clock moments; its finished sentence matches the copy table; its Number_Button opens the right Sources row; the card height does not change while it counts; reduced motion gives the finished sentence at once.
4. Real data sweep: for all 20 pairs, the task report gives each pair's `n` at 10:00 and lists the rows Requirement 2.3 hides.
5. Pictures: `npm run screens` adds desktop and phone stills of the lead race with two Ghost cars on the route and the Counter at 2 or 3.
6. All existing suites pass. `check:size` stays under 100 KB and `npm run perf` keeps its median under 5,000 ms. The phone fit test (polish brief P4) keeps 16 px to spare at 375 x 667, or at least 8 px with nothing cut off or overlapping, recorded in the task report.

## Ghost cars copy table

| Where | String |
| --- | --- |
| Counter while counting (Req 4.2) | "1938 trolleys scheduled past this corner: {k}" |
| Counter finished (Req 4.4) | "{n} 1938 trolleys were scheduled here before today's bus." (Emmanuel, Nov 23, NEW COPY; **replaces** the brief's "{n} trolleys were scheduled past this corner in 1938 before today's bus leaves.", which does not fit one line) |
| Sources method line (Req 4.5) | "Counted from the 1938 timetable's scheduled departures at the origin corner, from the start time until today's bus is scheduled to leave." |
| Map line (Req 6.1) | "Fainter cars: other scheduled 1938 departures." |

The Counter's Number_Buttons are named with the existing "what a number is" phrase for a 1938 car ("scheduled 1938 car", at the origin corner in the Sources row), so no other new wording is added (brief G6).
