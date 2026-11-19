# Race Screen: Requirements

## Feature Description

Build the one-screen site in web/ that plays a race from the JSON files written by the race engine. Follow the steering files, especially ui.md. The layout, every state, the exact wording, the desktop layout and the motion spec are in docs/planning/screen-brief.md, sections 2, 3 and 3A (3A wins where they differ). The pictures in docs/planning/ui-mockups/ show the intended look on a phone and on a laptop; match them closely. The site must work at both sizes: phone layout below 900 px wide, desktop layout from 900 px up. The data file formats are in docs/planning/race-brief.md, section 4, as built by the race-engine spec plus its task 35 (below). The browser never does race arithmetic: it looks up the row for the chosen pair and minute, rounds for display, and animates.

Status: requirements for review. Emmanuel's decisions on the first draft's eight open points are folded in. Nothing is designed or built yet.

## Dependency on the race engine (task 35)

This spec needs data the pipeline does not write yet. They are specified as race-engine task 35 (not run yet). Until task 35 is done and the data regenerated, the real files lack these fields and the site cannot be finished against them. The site's tests of the real data path read them from the files; tests of the fixture line carry them in the fixture.

| New field | Where | Meaning |
| --- | --- | --- |
| `label` | each entry of index.json `sources` | Human-readable source name, for example "1938 route diagram, Digital Maryland" |
| `street_order_checked` | index.json | One boolean: the `street_order_checked` flag of the 1938 facts file (the 1933 file is not read) |
| `gap_min`, `gap_max` | race file `y1938` | Smallest and largest 1938 spacing at the origin corner in the window below |
| `window_from`, `window_to` | race file `today` | The window the bus gaps cover, "09:00" and "14:00" |
| `route_display` | each trip | Display route name, for example "CityLink Lime" |
| `route_names` | race file `today` | The distinct display route names of the pair's trips |
| `trips` (new rule) | race file `today` | Every eligible trip from 09:00 through the third trip after the last trip any race row uses; `i` is the index in that list |

An MIT LICENSE file ("Copyright (c) 2026 Emmanuel Chukwuemeka") is added at the repository root in the same task (done).

## Principles (these outrank the detailed requirements)

- **P-A. The site only reads.** Every time, duration, margin, result, count, verdict, gap and route name is read from the generated files. The site never decides who wins, never subtracts clock times to get a wait or a total, never picks a trip, never computes a median, gap or count.
- **P-B. What the site may compute.** (1) Display rounding (R7, and whole-minute rounding of gaps in R8). (2) Layout: bar widths on one shared scale, positions, sizes. (3) Playback timing: the race clock and its speed cap. (4) Lookups: a row by pair and minute; a trip by index; the next listed times after a given one by position in a list. (5) Date and time-zone formatting for the default time and for "Nov 4, 2026", and 12-hour formatting of clock strings. Nothing else.
- **P-C. Never invent a number** (product.md rule 3). A number appears on screen only if it is in a generated file. The numbers in the brief and the mockups (counts, minutes, clock times) are planning values that show the format; they never appear in the code, the copy strings or the tests of the real data path.
- **P-D. Scheduled, never live** (product.md rule 1). Every time carries the word "scheduled". The words live, real-time, realtime, "arriving now" and "right now" never appear in rendered text, except in the fixed phrase "Scheduled, not live."
- **P-E. A win for today looks exactly like a win for 1938** (product.md rule 5): same box, size, weight, position and timing.

## Data contract

The site reads these files from web/public/data/ and nothing else, plus map tiles at run time (R11). Field names are those the pipeline writes, with the task 35 additions marked +.

| File | Fields the screen uses | Used for |
| --- | --- | --- |
| index.json | line, effective, corners[] (slug, name, lonlat, inferred, note), pairs[], service_date, feed_version, feed_sha256, street_order_checked+, sources{} (guide1938_diagram, guide1938_timetable, guide1938_route, mta_gtfs, osm, method; each with label+, what, year, where, url) | Corner list and order, map points, inferred chip, "No. 21, 1938", "Nov 4, 2026", Sources sheet rows, credits |
| summary.json | races, wins_1938, wins_today, photo_finishes, ride_same, ride_faster_today, ride_slower_today, pairs_without_one_seat_ride, today_wins[] (origin, dest, t, margin), pairs[] (counts, ride_1938, ride_today_median, delta, ride_verdict), sources{} | Honest line, "When today wins" list, the pair count, any count on screen |
| race/<origin>__<dest>.json | origin, dest, direction, inferred, service_date, feed_version, y1938 (ride_min, covered_from, passes[], gap_min+, gap_max+, sources), today (gap_min, gap_max, window_from+, window_to+, route_names+, trips[] with route, route_display+, headsign, board, alight, dep, arr, ride_min), races[293] (t, start, before_table, y1938{dep, wait, total}, today{trip, wait, total} or null, result, margin), sources{} | The race, lanes, board, frequency sentence |
| route.geojson | features[] (LineString; properties direction, street, method, note, length_m) | Map route, street names along the route, dashed inferred stretches, map marker path, fallback drawing |

How the lanes are filled from one race row (lookups only, no arithmetic):

- 1938 lane: wait = row.y1938.wait; ride = y1938.ride_min; total = row.y1938.total; next car = row.y1938.dep.
- Today lane: walk to the stop = today.trips[row.today.trip].board.walk_min; wait = row.today.wait; ride = that trip's ride_min; walk from the stop = that trip's alight.walk_min; total = row.today.total; next bus = that trip's dep (seconds dropped).
- Result and margin = row.result and row.margin. Start = row.start. "Before the midday table" = row.before_table.

## Requirements

### R1. Layout and responsiveness
- **R1.1** One web page, two layouts. Below 900 px wide: phone layout, designed at 375 × 667 px. From 900 px up: desktop layout, designed at 1280 × 800 px. (screen-brief 3A, ui.md)
- **R1.2** Phone zones: top bar 40 px; map 150 px; race card from 181 px down; the two buttons (Sources, Share this race) pinned 6 px above the bottom. If the card's content is taller than the screen, the card scrolls inside itself and the buttons stay pinned on a solid panel strip. (3A, 3.4)
- **R1.3** Desktop zones: top bar over the map (56 px); the headline "Same ride, longer wait." with its muted line over the top left of the map; the map fills everything left of the race column; the race column is a fixed 440 px, full height, with the same content in the same order as the phone card, the two buttons directly under the content (not pinned), then a footer line ("About and credits" left, "Open source. Built in Kiro." right). Above 1280 px only the map grows. Below 720 px tall the race column scrolls inside itself. (3A.1)
- **R1.4** Nothing scrolls sideways at any width. Every tap target is at least 44 × 44 px. Everything the phone can do, the desktop can do with a mouse and a keyboard.
- **R1.5** Sheets (Sources, Corners, About and credits): phone slides up from the bottom; desktop slides in over the race column only. A dark scrim; the map dims behind it. On close, focus returns to the control that opened the sheet.
- **R1.6** The desktop headline is about the whole line and never changes with the result.

### R2. First load and loading state
- **R2.1** On first load a race starts by itself for the default pair, Preston & Caroline → Aliceanna & Bond, with zero taps and without waiting for the map. The default pair is never the inferred corner.
- **R2.2** Loading: the two pair names are already in the HTML, and under them the card says the loading line (copy table). The top bar shows only "Ghost Line" until index.json has been read and passed its shape check; only then does "No. 21, 1938" appear, built from index.json's `line` (the digits after "no" and before the hyphen) and the year of `effective`. If `line` does not have that form, the label is left out. After 3 s without data the data-error state shows.
- **R2.3** The page loads index.json, summary.json and the one race file the pair needs. Other race files load only when a different pair is chosen.
- **R2.4** The map is loaded after the race card is on screen, by a lazy import; a failed or slow map never delays or blocks the race. (tech.md)
- **R2.5** First paint: the card content appears with no entrance animation; the trolley fades in from nothing to full glow, 400 ms, ease-out, once. The race clock starts after a fixed 300 ms pause once data is ready.

### R3. Time slider and default time
- **R3.1** A native range input, one-minute steps, over the minute rows in the race file (the first and last row's t; today 9:00 to 13:52). Minus and plus buttons step by one minute. The slider thumb and buttons are keyboard operable.
- **R3.2** The two ends of the track show the first and last row's t in small muted text (about 9.5 px, never as large as the start time). They are read from the race file, not typed.
- **R3.3** The start time is shown large, in 12-hour form (for example "10:00 AM"). The input's aria-valuetext reads like "10:00 AM, scheduled weekday time".
- **R3.4** Default time (race-brief 5.9): the current America/New_York time of day, seconds dropped, if it is inside the slider range (both ends inclusive); otherwise 10:00. The device's own time zone is never used. The screen says which: with a clock-derived time, the Ready state adds "Start time is the time now."
- **R3.5** While the thumb is dragged or minus/plus is pressed, a running race stops at once; only the time label and the departures board update; no animation during dragging. The new race starts 300 ms after release (or 300 ms after the last minus or plus press).
- **R3.6** The share link carries no time. A shared link opens with the normal default time.

### R4. Choosing the pair, swapping and sharing
- **R4.1** Corner picker: a plain list of five full-width buttons, west to east, in two steps (start, then end). Title and step lines, the "Start" tag, the "inferred" chip on the inferred corner, the note and a Cancel button as in screen-brief 2.12. In the second step the chosen start is disabled, so the same corner cannot be chosen twice. Opening the picker is one tap; choosing a pair takes three taps.
- **R4.2** Tapping a corner on the map opens the picker (phone) or is the main way to pick a pair (desktop). The picker still exists for keyboard and screen-reader users, and everything works without the map.
- **R4.3** One tap on the swap button reverses the pair (origin and destination swap; the matching race file loads).
- **R4.4** Share link (race-brief 5.9): `?from=<slug>&to=<slug>` and nothing else: no time and no number. "Share this race" shares the URL of the current pair (R4.8). `decode(encode(p)) = p` for all 20 pairs; decode never throws on any text. Decode reads only `from` and `to` and ignores any other parameter, such as a tracking tag a social app adds (Emmanuel, Nov 19); a missing, repeated, unknown or equal pair is still a bad link.
- **R4.5** A valid link selects the pair and shows the share banner for 5 s: slide in 200 ms, hold 5,000 ms, slide out 200 ms; it names the pair only.
- **R4.6** A bad link (a slug unknown, or origin equals destination) falls back to the default pair, races it as usual underneath, and shows the bad-link banner. No query at all is the default pair with no banner.
- **R4.7** The address bar follows the pair: each time the pair changes (picker, swap, map tap, "When today wins" entry) the page updates its URL with `history.replaceState`, query only (`?from=…&to=…`), no history entries. A reload or a copied address bar therefore opens the same pair.
- **R4.8** Share button: when `navigator.share` exists the button calls it with the link only. If the visitor cancels, nothing else happens. If it is missing or fails for any other reason, the link is copied to the clipboard and the button shows "Link copied" for 2 s (a polite status message says the same for screen readers). The button keeps its size while the label changes.

### R5. Race playback
- **R5.1** One race clock drives everything; both sides start from the same instant, including the clamped start in the before-the-table state. It reads as the time and the word "scheduled" only ("10:08 scheduled"); the playback speed is never printed. (3A.6)
- **R5.2** 1 real second = 4 scheduled minutes. If the longer trip would take more than 12 s, speed up so it takes exactly 12 s. Movement is linear in time, with no easing inside a phase. Movement uses the stored durations, never the rounded minutes shown on screen.
- **R5.3** 1938 lane phases: wait, then ride. Today lane phases: walk to the stop, wait, ride, walk from the stop. Each lane is one 9 px bar on one shared time scale, so the longer trip is visibly longer. Wait is hatched, ride is solid, walk is dotted, and every phase is also named in text. Phases not yet reached are dimmed (28% opacity); the status line carries the information.
- **R5.4** Racing status lines (copy table) count down in whole minutes from the shown part. After the finish the status line is replaced by the phase legend ("Wait 6 min  Ride 9 min", each number a source button). Walks say "estimate" everywhere.
- **R5.5** The 1938 vehicle waits at the start of its bar, then moves; the bus slides at clock speed and does not move during a walk. The trolley has the bob, the pole sparks, turning hubs and the breathing glow of 3A.6; the bus has none of them. Only transform and opacity are animated; the glow layers are separate elements whose opacity changes.
- **R5.6** First arrival: the end of the arriving bar brightens and settles (200 ms emphasis, 600 ms ease-out settle), identical whichever side arrives first. The slower side keeps running to its real finish; its vehicle may dim to 70% but its text keeps full contrast. A photo finish gives both ends the same emphasis at the same moment.
- **R5.7** The result moment is the first arrival, not the end of the slower side. The winner and the margin come from the data (row.result and row.margin name the winning side; nothing is compared), and the box shows both stored totals at once. The box arrives like a roller sign (scales 96% to 100%, text rolls up 8 px, 260 ms, ease-out), then the honest line fades in (200 ms, starting 150 ms later). Same place, size and weight whichever side won. The slower side keeps running to its real finish after the result is shown. For a photo finish the result appears when both sides have arrived. For no one-seat ride it appears when the 1938 side arrives.
- **R5.8** "Skip to result" is visible and reachable by tap and keyboard for as long as anything is moving, including while the slower side runs on after the result is shown. It jumps both lanes to finished and shows the result with its normal entrance if it is not shown yet.
- **R5.9** The small trolley on the map moves along the route in step with the lane, only during the ride phase, and stops just short of the destination dot.
- **R5.10** If a device cannot hold 30 frames per second, drop the bob, sparks and glow breathing and keep the movement. Nothing loops when no race is running, except the finished trolley's glow held steady at 100%.
- **R5.11** Reduced motion (the device asks for it): no clock, no movement, no bob, no sparks, no breathing, no entrance animation. On load and after every slider change both lanes are drawn finished, the vehicles are parked at the end of their bars, and the result box is simply present. Sheets and the banner appear without sliding. "Skip to result" is not shown. On a phone the departures board is not shown.

### R6. Results, the honest line and the "When today wins" list
- **R6.1** Exactly one of four results per race, taken from row.result: 1938 wins, Today wins, Photo finish, No one-seat ride today. The result is never derived from the shown numbers.
- **R6.2** The result sits in a dark sign-like box (#100C16) with the result line in the winner's colour (--ghost for 1938, --today for today, --ink for a photo finish). Box, size, weight and position are identical for every result.
- **R6.3** Result copy for each state is in the copy table. Totals in the box are the shown totals; the shown margin is the difference of the two shown totals (R7). "Walking included (estimated)" appears every time a bus total is shown.
- **R6.4** Honest line under every result. The first form for 1938 wins, photo finishes and no-one-seat; the "Today wins this race. Across this line: …" form when today wins the race on screen. Its counts are wins_1938 and races read from summary.json. "Across this line" is the only scope wording; the word "citywide" never appears.
- **R6.5** The words "When today wins" are a link that opens a list. The list starts with one sentence: "On {ride_same} of {pairs} corner pairs today's scheduled ride is about as long as in 1938; on {ride_faster_today} it is faster", with "; on {ride_slower_today} it is slower" added only when ride_slower_today is above zero. {pairs} is the length of summary.pairs, never typed. Then every entry of summary.today_wins as pair and start time, each one tap from its race (it selects that pair and time).
- **R6.6** Before the midday table: when row.before_table is true, the notice (copy table) names row.start; the slider thumb does not move; both lanes start at row.start; the departures board starts there.
- **R6.7** Inferred corner: when the pair includes the corner with inferred = true, show the "Inferred corner" chip by its name, the one-line caution, a dashed dot on the map, and the dashed stretch(es) of route. The notice is a tinted strip with a --ghost left edge under the slider; when a notice shows, the schedule line is hidden to make room, and the same sentence is on the About sheet.
- **R6.8** No one-seat ride (row.today is null and row.result is "no_one_seat_ride"): the 1938 lane keeps its time; in place of the bus lane the card shows "No single scheduled bus links these corners on this weekday schedule." (nothing about nearby routes); the result box reads "No one-seat ride today" in --ink then "Trolley {n} min. No winner is called."; no bus total, no bus vehicle, no margin. This state cannot occur with the pinned feed. It is built and tested from a made-up fixture line that carries the visible tag "Test fixture: a made-up line and made-up numbers. Not Baltimore data." and has no map. The fixture lives with the tests and is never shipped in web/public/data.

### R7. Display rounding (screen-brief 2.10)
- **R7.1** One small pure function. Stored values keep three decimals.
- **R7.2** Total: each side's shown total is its stored total rounded to the nearest whole minute, halves rounding up.
- **R7.3** Parts (largest remainder): round every part down; count the minutes missing from the shown total; give one minute each to the parts with the largest fractions, largest first; on a tie the earlier phase gets it.
- **R7.4** Margin: the shown margin is the difference of the two shown totals. Which result applies is decided from the stored values and the stored 1.0-minute band (row.result), never from shown numbers.
- **R7.5** The walking total in the spoken summary is the sum of the shown walk parts. Status lines count down from the shown part.
- **R7.6** Photo finish copy: if the two shown totals are equal, "Both about N minutes"; if they differ by one, "About N and M minutes".
- **R7.7** Sources sheet: when a shown part is not the plain rounding of its stored value, its row adds "Exact value X min. Parts are rounded so they add up to the N min total."
- **R7.8** The six example rows of screen-brief 2.10 are example tests. These properties hold for any list of non-negative parts: shown parts sum to the shown total; every shown part is a whole number within one minute of its stored value; whole-number inputs come back unchanged; the same input always gives the same output.

### R8. Departures board and frequency sentence
- **R8.1** Before and during a race the space under the lanes holds the departures board (3A.5): the header, a 1938 row and a bus row. The next departure on each side is a filled chip in that side's colour; the others are plain; every time is a source button.
- **R8.2** 1938 times come from the race file's passes (the next listed car is row.y1938.dep; the following ones are the next entries of passes). Bus times come from the race file's `today.trips`, which after task 35 holds every eligible trip from 09:00 through the third after the last one any race uses (the next bus is trips[row.today.trip]; the following ones are the next entries of the list). No time is compared or subtracted to choose them. Four 1938 times and three bus times are shown when that many are listed; fewer when the list ends.
- **R8.3** The board starts from row.start, so in the before-the-table state it starts at the covered-from time.
- **R8.4** The board stays visible after the finish on desktop. On a phone it shows only before and during the race.
- **R8.5** Frequency sentence (copy table), always in one full form, filled from the race file for the pair and direction on screen. The window, the date and the 1938 sentence are always present; only the gap part changes:
  - Bus gaps are today.gap_min and today.gap_max rounded to whole minutes, halves up.
  - The gap part is "up to {max} minutes apart" when gap_min rounds to 0; otherwise "{min} to {max} minutes apart"; or "{n} minutes apart" when the two rounded values are equal. (The "up to" rule is checked first.)
  - The window is today.window_from and today.window_to shown in 12-hour form ("9:00 AM", "2:00 PM").
  - The route names are today.route_names, shown as given (for example "CityLink Lime"), joined with " and " when there are two and with commas and "and" when there are more. Headsigns are not shown on the card; they appear only in the Sources sheet.
  - The date is service_date shown as "Nov 4, 2026".
  - The 1938 spacing is y1938.gap_min and y1938.gap_max rounded the same way: "every {a} or {b} minutes", or "every {a} minutes" when the two rounded values are equal.
  - Every value comes from the data files; no number of minutes is ever typed.

### R9. Number buttons and the Sources sheet
- **R9.1** Every number on the card is a button with a dotted underline. This covers the totals, the legend durations, the clock times on the board, the next-car and next-bus times in the status lines, and the honest-line counts. Tapping it opens the Sources sheet scrolled to that number's row.
- **R9.2** Each button has an accessible label such as "9 minutes, scheduled 1938 ride. Show source."
- **R9.3** Every number rendered on the card has a matching row in the Sources sheet.
- **R9.4** Each row has four parts: (1) the value and what it is; (2) where it comes from: the catalog entry's `label` with its `url` as a link that opens in a new tab (for numbers that carry their own source URL in the race file, such as the 1938 ride and passes, that URL); (3) how it was worked out, in one line from the copy table; (4) the date of the data: the `effective` date for 1938 numbers, the feed version and service date for today's numbers. For a bus time or ride the row also names the trip's route (as in `route`) and its headsign; this is the only place headsigns are shown.
- **R9.5** Walk times carry the word "estimate" and the formula text of the catalog's `method` entry (its `what`), and nothing else is written about the formula in the site's copy.
- **R9.6** The tapped number's row is tinted with a --ghost left edge. The sheet's last row is always "Sources and credits", which opens the credits list.

### R10. About and credits
- **R10.1** A plain list, one line each, each with its link (copy table, from screen-brief 2.9): the 1938 timetables, today's schedule feed with "Not endorsed by MDOT MTA.", streets and route geometry, the base map (OpenFreeMap tiles and MapLibre GL JS, with the credit text "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" from the Source URLs list in tech.md; the same credit is also required in the video), vehicle drawings ("original illustrations"), how it was made, the code licence and the repository link. Each catalog-backed line uses the catalog `label` and `url`.
- **R10.2** There is no 1933 link and no 1933 line (structure.md was updated to match).
- **R10.3** Code licence: "MIT licence", linking to the LICENSE file in the repository. The repository link is https://github.com/Optimistic-max/Ghost-Line (the git remote); that URL is first added to the "Source URLs" list in tech.md, so it lives in one constants block, as the other two do.
- **R10.4** "How it was made": "Facts files and expected test values were prepared during planning with Claude Code and Codex; the pipeline and app were built in Kiro." The words "and checked by hand against the scans" are added only when `street_order_checked` in index.json is true (that one flag alone decides it; today it is false, so the clause is absent).
- **R10.5** The About sheet also holds the inferred-corner sentence and the "Scheduled, not live." statement.
- **R10.6** Scans are linked, never reproduced. No MTA colours or logos.

### R11. Map
- **R11.1** The map is 2D MapLibre GL JS with the OpenFreeMap dark style (https://tiles.openfreemap.org/styles/dark, from the Source URLs list in tech.md) requested at run time (approved) and recoloured to palette B: street lines as hairlines (--street, main roads --street2), no fills, the harbour as the area with no streets. Street names off the route and any water label come from the tiles, not from typed text. The 1938 line, drawn from route.geojson, is the brightest thing (--ghost with a blurred copy beneath), its streets named along it in --ghost condensed type with a dark outline from the features' `street` property. No neighbourhood names.
- **R11.2** Corners: all five named on desktop; on a phone only the two chosen ones. Origin is a filled dot, destination a ring. The inferred corner has a dashed outline, and "(inferred)" after its name on the map; the inferred stretch is dashed. Each name sits beside its own dot. When the inferred corner is one of the phone pair, the Dolphin St and Preston St labels are hidden to make room.
- **R11.3** Faint map text is never below 80% opacity. The map shows the attribution MapLibre adds from the style (OpenFreeMap and OpenStreetMap), and the line "Streets © OpenStreetMap contributors. Dashed stretch of the route is inferred."
- **R11.4** Map unavailable (tiles or WebGL fail, or the map is blocked): the map area shows the bundled route drawing (route, its street names, corner dots, plain background, built from route.geojson and index.json only) and the line "Map unavailable. Showing the route diagram." The race is unchanged. The site still plays a race with the map blocked. The race starts before and without the map in every case.

### R12. Visual direction
- **R12.1** Palette B tokens and rules of ui.md: --ghost is only for 1938 data and --today only for today's data; --alert only for errors. Text contrast at least 4.5:1, checked by an automated test.
- **R12.2** Type: Barlow Condensed 600, Latin subset, from the @fontsource/barlow-condensed package (one WOFF2, bundled by Vite), for the wordmark, corner names, lane titles, times, totals and the result line; the system font for everything else; tabular figures; sentence case. Sizes as in 3.3 (phone) and 3A.1 (desktop).
- **R12.3** Vehicles: the detailed original trolley illustration of 3A.2 (two trolley poles to two overhead wires, tyres, no rails, faint passengers) at the sizes in ui.md; the separate simplified map marker (28 px phone, 58 px desktop); today's flat plain bus (84 px phone, 104 px desktop) on one hairline. Both drawn from scratch, not traced. The route number on the trolley is built from index.json like the top-bar label (R2.2) and is absent in the data-error state.
- **R12.4** Press feedback changes opacity only (80 ms). Sheets: 220 ms ease-out in, 160 ms ease-in out.
- **R12.5** Mockups 01 to 26 are the visual target for every state they show. Desktop versions of states 05 to 12 follow the same layout rules.

### R13. Accessibility
- **R13.1** Works by keyboard alone and with a screen reader; a visible focus ring on every control.
- **R13.2** The result region is aria-live polite and speaks once, when the result appears (the first arrival; for a photo finish, when both sides have arrived), with the summary for that result (copy table: 1938 wins, today wins, photo finish, no one-seat ride), built from the shown numbers. Nothing is announced during the animation, and with reduced motion it still speaks once per race.
- **R13.3** Information never rests on colour alone: each phase has a text label; the inferred stretch is dashed and named in text.
- **R13.4** An automated accessibility check (axe-core in jsdom, and in Playwright where layout matters) runs in the tests on every state that can be reached in a test.

### R14. Data errors and the shape check
- **R14.1** Every data file is shape-checked when it arrives (required fields present, types right, the race file has the expected rows, every source ID resolves in the catalog). If any file fails to load or fails the check, no number is rendered anywhere: no times, totals or counts; no "No. 21, 1938" in the top bar; the trolley is drawn without its route number. Corner names stay.
- **R14.2** The data-error state shows its message and a "Try again" button (copy table). The button reloads the files and recovers without a page reload.
- **R14.3** A failed map does not trigger the data-error state.

### R15. Wording
- **R15.1** Only the strings in the copy table are used. No new wording is written in code.
- **R15.2** Banned in any rendered text: live, real-time, realtime, "arriving now", "right now", except the fixed phrase "Scheduled, not live." (the `aria-live` attribute name is not rendered text). A test scans every state's rendered text.
- **R15.3** Every time on screen carries the word "scheduled" in its line, label or accessible name. The screen states "weekday schedule as of Nov 4, 2026", with the date read from service_date.
- **R15.4** Counts come from summary.json at run time. A test swaps in a summary.json holding different numbers and checks the screen shows them; no count is in the code or the copy strings.
- **R15.5** Every string with a minute count has a singular form: "1 minute" where the number is 1 and "minutes" otherwise ("1938 wins by 1 minute", "Both about 1 minute", "1 minute apart", "up to 1 minute apart", "every 1 minute", "Trolley 1 min" is unchanged because "min" is an abbreviation). In "About {n} and {m} minutes" the unit follows {m}. One helper chooses the form; the copy table templates carry both.

### R16. Performance, hosting and budgets
- **R16.1** First-screen budget: 100 KB compressed, map excluded (tech.md). The first race must not wait for the map.
- **R16.2** The deployed GitHub Pages URL starts the first race within 5 seconds on a throttled phone profile. Measured with Playwright (approved) driving a mobile-sized Chromium with slow-4G network throttling and CPU slowdown through the browser's debugging protocol: a performance mark "race-start" when the first lane begins to move, five runs, the median under 5,000 ms; repeated once on a real phone. (Lighthouse was not approved, so it is not used.)
- **R16.3** Vite `base` is "/Ghost-Line/". The site is deployed by a GitHub Action from web/dist.
- **R16.4** No AI model and no network model runs in the deployed app. No real-time or vehicle-position feed is read. Plain TypeScript and CSS, MapLibre GL JS, no UI framework.
- **R16.5** npm scripts are one command each (dev, build, test). Dev-only tools approved for tests: jsdom, axe-core, Playwright.

### R17. Tests
- **R17.1** Every state in screen-brief 2.4 and 2.12 can be reached in a test: loading, ready, racing, 1938 wins, today wins, photo finish, before the midday table, no one-seat ride, inferred corner, share link opened, bad share link, data error, map unavailable (plus the corner picker and reduced motion).
- **R17.2** Example tests for the race-brief 5.9 table (eight rows) and the six rounding rows of 2.10.
- **R17.3** Property tests (fast-check) for the correctness properties below.
- **R17.4** The state tests run against the real generated files where a real state exists (today wins: Westwood & Carey → Preston & Caroline at 11:23; photo finish: lead pair at 10:30; before the table: lead pair at 9:00; inferred corner: any Brevard pair) and against the made-up fixture where it does not (no one-seat ride).
- **R17.5** Tests of the real data path read their expected values from the files, not from the brief.
- **R17.6** The "map blocked" test runs the whole race in Playwright with the tile host blocked and WebGL absent.
- **R17.7** A test that asserts a wall-clock limit is tagged `timing`, left out of the default run, and run with its own command on a quiet machine before submission: `python -m pipeline check --timing` for the pipeline and `npm run perf` for the site's first-race measurement (R16.2). The limits do not change.

## Correctness Properties

- **P1.** encode then decode returns the same pair for all 20 pairs; decode never throws on any text; the URL never contains a time or a number.
- **P2.** The default time is inside the slider range for every possible clock time (and is the clock time, seconds dropped, when inside it).
- **P3.** Every number rendered on the card has a matching row in the Sources sheet.
- **P4.** Display rounding: shown parts sum to the shown total; every shown part is within one minute of its stored value; the shown margin equals the difference of the shown totals; whole inputs are unchanged; deterministic. A stored win (margin of 1.0 or more) never shows a margin below one minute.
- **P5.** Every count on screen is read from summary.json: with a different summary.json the screen shows those numbers.
- **P6.** No banned word in any rendered text, in any state.
- **P7.** If a data file fails its shape check, no number is rendered.
- **P8.** The result shown is row.result; a win for today and a win for 1938 have identical structure, size and position.
- **P9.** Nothing the site computes is a race result: the shown result, margin sign and winner colour match the stored row for every pair and minute in the real files.
- **P10.** With reduced motion, no animation runs and the finished state is shown at once; with motion, only transform and opacity are animated.
- **P13.** For every number n in any minute string, the word is "minute" exactly when the number it follows is 1 and "minutes" otherwise; no rendered text contains "1 minutes".
- **P11.** Gap display: for any gap_min and gap_max the gap part shows whole minutes; it is "up to {max} minutes apart" exactly when gap_min rounds to 0; otherwise "{min} to {max} minutes apart", or "{n} minutes apart" when the rounded values are equal. The window, the date and the 1938 sentence are present in every case; the 1938 part reads "every {n} minutes" exactly when its rounded values are equal.
- **P12.** The address bar after any pair change equals encode(pair); it never holds a time.

## Copy strings

Placeholders in braces are read from the data at run time. These are the only strings the screen may use. Source: screen-brief 2.4, 2.5, 2.6, 2.8, 2.9, 2.12, with the decisions above. Rows marked (draft) were drafted on Nov 19 from the mockups and the brief, for Emmanuel's review; they are used like the other rows until he changes them.

| Where | String |
| --- | --- |
| Loading | "Loading the 1938 timetable…" |
| Top bar | "Ghost Line"; after index.json is read, "No. {n}, {year}" |
| Ready | "Weekday schedule as of {service_date as Nov 4, 2026}. Scheduled, not live." plus, with a clock-derived time, "Start time is the time now." |
| Racing, 1938 | "Waiting {n} min · next car {hh:mm} (scheduled)", then "Riding {n} min (scheduled)" |
| Racing, today | "Walking to the stop {n} min (estimate)", "Waiting {n} min · next bus {hh:mm} (scheduled)", "Riding {n} min (scheduled)", "Walking from the stop {n} min (estimate)" |
| Legend | "Walk {n} min · estimate", "Wait {n} min", "Ride {n} min" |
| 1938 wins | "1938 wins by {n} minutes." "Trolley {n} min. Today's bus {n} min, walking included (estimated)." |
| Today wins | "Today wins by {n} minutes." "Today's bus {n} min, walking included (estimated). Trolley {n} min." |
| Photo finish | "Photo finish." "Both about {n} minutes." or "About {n} and {m} minutes." |
| Before the table | "The 1938 midday timetable reaches this corner at {start}. Both sides race from {start}." |
| No one-seat ride | "No one-seat ride today." "No single scheduled bus links these corners on this weekday schedule." "Trolley {n} min. No winner is called." |
| Inferred | chip "Inferred corner"; "Brevard Street is gone. This corner's position is our best reading of the 1938 diagram, so times to and from it are less certain." |
| Honest line | "Same ride, longer wait. Trolley first in {wins_1938} of {races} races. When today wins" |
| Honest line, today wins | "Today wins this race. Across this line: same ride, longer wait. Trolley first in {wins_1938} of {races} races. When today wins" |
| When today wins list | "On {ride_same} of {pairs} corner pairs today's scheduled ride is about as long as in 1938; on {ride_faster_today} it is faster" then, only when ride_slower_today is above zero, "; on {ride_slower_today} it is slower", then "." |
| Frequency | "Scheduled one-seat buses on this stretch leave {gap part} between {window_from} and {window_to} ({route_names}, weekday schedule as of {service_date}). In 1938 a trolley was scheduled every {y1938.gap_min} or {y1938.gap_max} minutes." {gap part} is "up to {max} minutes apart" when gap_min rounds to 0, "{min} to {max} minutes apart" otherwise, or "{n} minutes apart" when equal. If the 1938 values are equal: "every {n} minutes". |
| Share | "Link copied" (on the Share this race button for 2 s after a copy; the same text in the status message) |
| Share banner | "Shared race: {origin} → {dest}." |
| Bad link | "That link's corners weren't recognized. Showing Preston & Caroline → Aliceanna & Bond." |
| Data error | "The timetable data didn't load. Check your connection and try again." and the button "Try again" |
| Map unavailable | "Map unavailable. Showing the route diagram." |
| Map credit | "Streets © OpenStreetMap contributors. Dashed stretch of the route is inferred." plus the OpenFreeMap attribution |
| Picker | "Choose two corners"; "Choose where the ride starts"; "Start is set. Now choose where the ride ends."; "Corners are listed west to east along the 1938 line. Brevard & Preston's position is inferred."; "Start"; "inferred"; "Cancel" |
| Slider | range ends from the race file; label "{hh:mm AM/PM}" |
| Announcement, 1938 wins | "Race result. {origin} to {dest}, starting {time}. 1938 trackless trolley: {n} minutes. Today's bus: {n} minutes, including {n} minutes of walking, estimated. 1938 was faster by {n} minutes. All times are scheduled." |
| Announcement, today wins | "Race result. {origin} to {dest}, starting {time}. 1938 trackless trolley: {n} minutes. Today's bus: {n} minutes, including {n} minutes of walking, estimated. Today was faster by {n} minutes. All times are scheduled." |
| Announcement, photo finish | "Race result. {origin} to {dest}, starting {time}. 1938 trackless trolley: {n} minutes. Today's bus: {n} minutes, including {n} minutes of walking, estimated. Photo finish. No winner is called. All times are scheduled." |
| Announcement, no one-seat ride | "Race result. {origin} to {dest}, starting {time}. 1938 trackless trolley: {n} minutes. No one-seat ride today: no single scheduled bus links these corners. No winner is called. All times are scheduled." |
| Credits | the catalog `label` and link for each source; "OpenFreeMap © OpenMapTiles Data from OpenStreetMap"; "Not endorsed by MDOT MTA."; "Font: Barlow Condensed, SIL Open Font Licence 1.1."; "Vehicle drawings: original illustrations."; "How it was made: Facts files and expected test values were prepared during planning with Claude Code and Codex; the pipeline and app were built in Kiro." plus " and checked by hand against the scans" only when street_order_checked is true; "MIT licence"; "Source code" |
| Fixture tag | "Test fixture: a made-up line and made-up numbers. Not Baltimore data." |
| Buttons and bars | "Sources", "Share this race", "Skip to result", "About and credits", "Open source. Built in Kiro.", "Ghost Line", "{n}:{nn} scheduled" |
| Lane titles (draft) | "1938 trackless trolley"; "Today's bus" |
| Lane total (draft) | "{n} min" |
| Departures board (draft) | header "Scheduled departures from this corner after {h:mm}"; row labels "1938 trolley" and "Today's bus"; 1938 spacing "every {a} or {b} min", or "every {n} min" when equal; bus gaps "up to {max} min apart", "{min} to {max} min apart" or "{n} min apart", by the rule of the Frequency row |
| Number button, accessible name (draft) | "{value}, {what}. Show source." where {value} is a minute count as "{n} minutes", a time as {h:mm}, or a count, and {what} is a phrase of the next row |
| What a number is (draft) | "scheduled 1938 wait"; "scheduled 1938 ride"; "scheduled 1938 total"; "scheduled 1938 car"; "walk to the stop (estimate)"; "scheduled wait today"; "scheduled bus ride"; "walk from the stop (estimate)"; "today's scheduled total, walking included (estimated)"; "scheduled bus departure"; "difference of the two scheduled totals"; "races the 1938 trolley is first"; "races on this line"; "corner pairs with about the same scheduled ride"; "corner pairs on this line"; "corner pairs where today's scheduled ride is faster"; "corner pairs where today's scheduled ride is slower" |
| Sources sheet (draft) | title "Where these numbers come from"; each row opens with the value ("{n} min", a time or a count) and {what}, extended where it applies as "{what}, {origin} to {dest}", "{what} from {h:mm}" or "{what} at {corner}"; "(opens in a new tab)" after each source link; last row "Sources and credits"; button "Close" |
| Sources, how it was worked out (draft) | "Sum of the diagram's segment minutes between the two corners."; "Next listed car passes at {h:mm}."; "Listed in the 1938 timetable at this corner."; "Wait plus ride."; "Straight-line {n} m from the corner to the stop."; "From {h:mm}, after the walk, to the scheduled departure."; "From the trip's scheduled departure to its scheduled arrival."; "{route} toward {headsign} leaves stop {stop_id} at {h:mm}."; "Walks, wait and ride, from {h:mm} to the destination corner."; "The difference of the two totals as shown."; "Counted over every race on this line, one per corner pair and slider minute."; "Counted over this line's corner pairs, comparing each 1938 ride with the median of today's scheduled rides." Walk rows then add the catalog method entry's `what` as written (R9.5). |
| Sources, date of the data (draft) | "Effective {date}" for 1938 numbers, {date} being effective in its long form (March 6, 1938); "MTA feed version {feed_version}, service date {date}" for today's numbers, {date} being service_date with its weekday (Wed Nov 4, 2026); counts carry both |
| Sources, exact value (R7.7) | "Exact value {x} min. Parts are rounded so they add up to the {n} min total." |
| Slider controls (draft) | input name "Start time"; value text "{hh:mm AM/PM}, scheduled weekday time"; buttons "One minute earlier" and "One minute later" |
| Pair row controls (draft) | swap button "Swap direction"; the pair names open the picker and are named "Choose two corners"; the info button is named "About and credits" |
| Desktop headline, second line (draft) | "Baltimore's 1938 trackless trolley, raced against today's scheduled bus between the same two corners." |
| When today wins list entry (draft) | "{origin} → {dest}, {h:mm} (scheduled)" |
| Map corner label (R11.2) | "(inferred)" after the inferred corner's name |

Minute words follow R15.5: where a template says "minutes", the site uses "minute" for 1 (for example "1938 wins by 1 minute.", "Both about 1 minute.", "leave up to 1 minute apart", "every 1 minute").

## Out of scope

"Why is it slower?" text, the census sentence, the HOLC layer, anything 3D, any AI-written text at run time, real-time feeds, trip planning, transfers, a kit for other lines, a 1933 link, a bundled street layer, Lighthouse, and any change to the race-engine pipeline other than task 35.
