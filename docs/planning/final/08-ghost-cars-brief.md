# Draft 8: ghost cars during the wait (new spec: ghost-cars)

Status: Nov 22, for Kiro. A small spec: about half a day. **No schema change, no bus paths, no tilt, no new library, no new URL.** It uses only data the race files already have (`y1938.passes`, `y1938.ride_min`) and the trolley marker the site already moves along the 1938 route (race-screen R5.9).

## The idea
Two people leave the same corner at the same time. The trolley comes within minutes. Today's passenger walks to the stop and waits, and while they wait, more trolleys of the 1938 timetable glide down the route one after another. Then today's bus finally leaves. In the lead race at 10:00, **four 1938 trolleys were scheduled past this corner before today's bus leaves** (10:06, 10:13, 10:21, 10:28; the bus leaves at 10:32:43). That's the moment people remember, and every bit of it is scheduled data.

## Requirements

**G1. Which cars.**
For a race row, the cars are every `p` in `race.y1938.passes` with `start ≤ p < today's bus departure`. Compare in seconds: passes are HH:MM, the departure is HH:MM:SS.
- The first car is the race's own trolley, which is the one the race already draws.
- The others are **ghost cars**.
- `n` is the number of cars, including the race's own.

**G2. When to show them.**
Ghost cars and the counter show only when all of these hold:
- the row is not `before_table`;
- the result is not `no_one_seat_ride`;
- `n ≥ 2`.

Otherwise nothing changes. Also, if today's bus departure falls after the last covered pass, the passes may not cover the whole wait: show no counter for that row, and list such rows in the task report.

**G3. How they move.**
- Each ghost car appears at the origin corner at its pass time `p`. It moves along the same 1938 stretch to the destination over `y1938.ride_min`, linear in time by length, using the same helper and the same clock as the race's own trolley.
- It disappears when it reaches the destination; it doesn't park.
- The race's own trolley is unchanged.
- Ghost cars are drawn wherever the race's trolley marker is drawn (the map, and the bundled route drawing when the map is unavailable). They use the same simplified trolley marker in --ghost at **45% opacity with a softer glow**. Only 1938 glows; today's side is unchanged.

**G4. The counter.**
On the card, in the today lane area, from the race's own trolley departure until today's bus leaves:
- **While counting** (it ticks up by one at each pass time, with no animation beyond the number changing): "1938 trolleys scheduled past this corner: {k}".
- **After the bus leaves, and on the finished race** (replay, skip and share all give this state): "{n} trolleys were scheduled past this corner in 1938 before today's bus leaves."
- `{n}` and `{k}` are Number_Buttons that open Sources at the 1938 timetable row. Add a Sources method line: "Counted from the 1938 timetable's scheduled departures at the origin corner, from the start time until today's bus is scheduled to leave."
- The counter never reflows the card. Reserve its line's height from the start of the race, the way the result box's space is reserved (story-layer 25.4).

**G5. Motion levels.**
- **Reduced motion:** no ghost movement, and the counter shows its finished sentence at once.
- **Lite:** the ghosts keep moving.
- **"Skip to result":** ghosts that would have finished are gone, and the counter shows its finished sentence.

**G6. Honesty.**
- The map label gains one line whenever ghosts show: "Fainter cars: other scheduled 1938 departures."
- No other new text, and no number on the map.
- The banned-word scan covers the new strings.

## Copy table (ghost-cars, NEW COPY; Emmanuel approves by pasting this brief)

| Where | String |
| --- | --- |
| Counter while counting (G4) | "1938 trolleys scheduled past this corner: {k}" |
| Counter finished (G4) | "{n} trolleys were scheduled past this corner in 1938 before today's bus leaves." |
| Sources method line (G4) | "Counted from the 1938 timetable's scheduled departures at the origin corner, from the start time until today's bus is scheduled to leave." |
| Map label line (G6) | "Fainter cars: other scheduled 1938 departures." |

Steering: in ui.md, add "ghost-cars" to the list of specs whose copy strings may be used.

## Tests
1. **Golden:** the lead pair at 10:00 gives `n = 4`, with cars at 10:06, 10:13, 10:21 and 10:28. Check it against `web/public/data/race/` for that pair. If it differs, stop and report; never edit the value.
2. **Property** (fixture generator): `n` equals the count of passes in `[start, bus departure)`. No ghost exists before its pass time or after `pass + ride_min`. Ghosts never show for before_table, no_one_seat_ride or `n < 2`.
3. **DOM:**
   - the counter ticks at the right clock moments;
   - its final sentence matches the copy table;
   - the Number_Button opens the right Sources row;
   - the card height doesn't change while the counter runs;
   - reduced motion gives the finished sentence at once.
4. **Real data sweep:** for all 20 pairs, report each pair's `n` at its lead start, plus the rows that G2 hides because coverage ends.
5. **Pictures:** `npm run screens` adds desktop and phone stills of the lead race at about 6 s, with two ghost cars on the route and the counter at 2 or 3.
6. All existing suites pass. `check:size` stays under 100 KB, and `npm run perf` median stays under 5,000 ms.

## Done when
Every test above passes, Emmanuel has looked at the pictures, and the change is committed and pushed so the deploy updates.
