# Ghost Line: video script (2:50)

Written Nov 23, 2026 from docs/planning/final/WIN-PLAN.md section 5, with Emmanuel's changes of Nov 23. Every string marked "On screen" is copied from the deployed site as it appears. Every number said or shown is in the app or in `web/public/data/summary.json`.

**Rules for the edit**
- Never say or caption: the banned words for service times, "every 7.5 minutes", "came every", "ran every", "buses come every N minutes". Say "scheduled".
- Show no number that is not in the app.
- The race film is labelled every second it is on screen.
- The 38-vs-36 Skeptic run is a planted test. Say so.
- Keep under 3:00. Target 2:50.

**Recording settings:** the deployed site at https://optimistic-max.github.io/Ghost-Line/, desktop 1280 x 800, browser zoom 100%. The race starts by itself on the lead pair at the labelled example start, 10:00 AM.

| Time | Picture | On screen (exact) | Voice-over |
| --- | --- | --- | --- |
| 0:00-0:06 | The app on desktop, the lead race finished. | "1938 wins by 30 minutes." and "Trolley 15 min. Today's bus 45 min, walking included (estimated)." | "Ten o'clock on a weekday, Preston and Caroline to Aliceanna and Bond. The 1938 trolley: fifteen minutes. Today's scheduled bus: forty-five, walking included." |
| 0:06-0:38 | **The race film**, `race-split.mp4` (30.1 s), from 0:06.0 to 0:36.1, then its last frame held to 0:38. | Lower third, all 32 s: "Illustration driven by the same scheduled data. Not the app." Plus the map credit the film's Google tiles require, for the 26.1 s they show (see the check below). | "Both riders leave the corner at ten. The trolley comes at six past. Today's rider walks to the stop and waits for the 10:32 bus. In 1938, four trolleys were scheduled past this corner before today's bus leaves. The No. 21 trackless trolley was an electric bus on two overhead wires. Ghost Line brings back its 1938 timetable and races it against today's schedule." |
| 0:38-0:52 | **The ghost moment, in the app:** "Replay this race". On the map, the fainter 1938 cars run the route while today's passenger waits; the counter in the today lane counts up. | "1938 trolleys scheduled past this corner: 2", then 3, then 4; then "4 1938 trolleys were scheduled here before today's bus." Map: "Fainter cars: other scheduled 1938 departures." | "Watch the counter. Every faint car is a scheduled 1938 departure from this corner, while today's passenger is still waiting to board." |
| 0:52-1:05 | The bars after the finish, then "Where the time goes". | Today's bar: "Walk 2 min · estimate", "Wait 31 min", "Ride 8 min", "Walk 4 min · estimate" (2 + 31 + 8 + 4 = 45). The trolley's: "Wait 6 min", "Ride 9 min". Then "Same ride, longer wait." | "The ride takes about as long: nine minutes then, eight now. The difference is the wait: six minutes then, thirty-one now." |
| 1:05-1:15 | Drag the slider across the start-time chart. | "How much does the start time matter?" | "In the 1938 timetable a car was scheduled at this corner every seven or eight minutes. For these corners today, the one-seat buses are scheduled thirty-four to thirty-nine minutes apart. The ride is about as long in 17 of the line's 20 pairs of corners." |
| 1:15-1:25 | Set the slider to 10:30: a photo finish. Then press "Show a race today wins" once: it opens the first entry of `summary.json` `today_wins`, Westwood & Carey to Dolphin & Myrtle at 11:23 (`todaywin/select` in web/src/state/actions.ts starts at entry 0). | "Photo finish." "Both about 15 minutes." Then "Showing a race today wins: Westwood & Carey → Dolphin & Myrtle, starting 11:23 AM (scheduled)." and "Today wins by 2 minutes." | "Ten o'clock is a bad minute for the bus. At half past, it's a photo finish. Across every covered start on this line, the trolley gets there first in 5,582 of 5,666 races. Today wins 25, and they look exactly the same." |
| 1:25-1:32 | Tap "30 minutes"; the Sources sheet opens at its row. | "Where these numbers come from" | "Every number is one tap from its source. Scheduled, not live." |
| 1:32-2:32 | **Kiro, 60 s**, screen recordings with captions (clips below). | Captions as listed. | As listed. |
| 2:32-2:42 | Text over the trolley drawing. | "One line, one weekday, scheduled times only, no transfers." | "One line, one weekday, scheduled times only, no transfers." |
| 2:42-2:50 | The glowing trolley under its wires, then the site address. | "Ghost Line" and "optimistic-max.github.io/Ghost-Line" | "Ghost Line." |

## The Kiro clips (1:32-2:32)

| Time | Clip | Caption | Voice-over |
| --- | --- | --- | --- |
| 1:32-1:42 | The `.kiro/specs` tree: five specs (race-engine, race-screen, story-layer, skeptic, ghost-cars). Open ghost-cars/requirements.md. | "Five specs: requirements, design, tasks." | "Kiro built Ghost Line from five specs, each one requirements, then design, then tasks." |
| 1:42-1:52 | `.kiro/steering/product.md`, the honesty rules. Zoom on rule 3, "Never invent a number." | "Steering holds the rules that never bend." | "Steering holds the honesty rules: every time is scheduled, and no number is invented." |
| 1:52-2:02 | In a docs file, type one of the banned words for service times and save. The `copy-and-source-guard` hook fails the save. | "A hook guards every saved word." | "Save a banned word in the docs, and the hook fails the save." |
| 2:02-2:12 | The MCP Server view, `ghostline-gtfs`: `trips_serving` for stops 8564 and 9486 answers 36. | "An MCP server reads the real feed." | "Our MCP server reads the transit feed on its own, without the pipeline's code: thirty-six one-seat trips." |
| 2:12-2:22 | `/skeptic-check tests/fixtures/skeptic/planted.md`: FAIL on the planted 38. Then `/skeptic-check` on the real docs: PASS. | "Planted test: 38 against 36." | "A Skeptic agent checks our own words against it. This 38 is a planted test, and it fails. Our real docs pass." |
| 2:22-2:32 | Commit 0cfcfe9: the shuffle property and the fix in `pipeline/mcp_server.py`. | "A property test caught a real bug." | "And a property test caught a real bug: the server's answer depended on row order." |

## Checks before recording

1. **Google tiles in the film.** The film shows Google map tiles for 26.1 s. Google's terms ask for its logo and its map data credit on screen while the tiles show. Check the film carries them, or add them as a fixed corner credit in the edit. Not checked by Kiro: the film is outside the repository.
2. Record the app after the last deploy, logged out, at 1280 x 800.
3. The Skeptic's PASS on the real docs is recorded only after `/skeptic-check` passes on README.md, docs/devpost.md and this file.
