# Race screen mockups

Twenty-six pictures of the intended race screen, drawn on November 15, 2026, during planning, with Claude Code. They are images only: the markup used to draw them is not in this repository, and the site is built in Kiro. The written direction is `../screen-brief.md`, sections 2, 3 and 3A.

All pictures use the chosen palette, B ("Gaslight and brick"). Phone pictures are 375 × 667 px, saved at 2× (750 × 1334). Desktop pictures are 1280 × 800.

Numbers in the pictures are planning values computed from the pinned feed. The built site reads every number, and every count such as "5,582 of 5,666", from its data files.

The map is drawn from real geometry: OpenStreetMap street data saved during planning (© OpenStreetMap contributors, ODbL) and the 1938 route trace built from the facts file. No shoreline is drawn; the harbour is the area without streets.

Vehicle size is style, not data. Only the bars under each vehicle are drawn to scale.

## Phone

| Image | Note |
| --- | --- |
| `01-firstload.png` | First load. The race is about to start: large trolley under its two wires, later phases dimmed, the departures board under the lanes, and the slider's range under its ends. |
| `02-racing.png` | Racing. The clock reads "10:08 scheduled". The trolley is riding; the bus side is still waiting. |
| `03-wins1938.png` | 1938 wins by 30 minutes at 10:00. The shown parts add up to the totals (2 + 31 + 8 + 4 = 45), and both walks say "estimate". |
| `04-todaywins.png` | Today wins by 4 minutes (Westwood & Carey to Preston & Caroline at 11:23). Same box, size and position as a 1938 win. The line under it opens with "Today wins this race." |
| `05-photofinish.png` | Photo finish at 10:30: under a minute apart, so no winner is called. |
| `06-beforetable.png` | Slider at 9:00, before the first listed 1938 car at this corner. The notice says both sides race from 9:21. |
| `07-inferred.png` | A pair that uses the inferred corner: dashed chip, dashed dot and stretch on the map, one-line caution. The corner's name sits directly under its dashed dot. |
| `08-sharelink.png` | A share link was opened. A banner names the pair for 5 seconds. |
| `09-dataerror.png` | The data did not load. No number anywhere: none in the top bar, none on the trolley. Corner names and "Try again" only. |
| `10-sources.png` | Sources sheet, opened by tapping a number. The wait row shows the exact value beside the rounded one. |
| `11-credits.png` | Sources and credits sheet. |
| `12-reducedmotion.png` | Reduced motion: both lanes drawn finished, the result shown at once (12:00 start). |
| `19-corners.png` | Corner picker, second step: the start is set and tagged; five corners west to east; the inferred chip on Brevard & Preston. |
| `20-badshare.png` | A share link with unknown corners. The banner says so and names the default pair, which races as usual underneath. |
| `21-noseat-fixture.png` | No one-seat ride. Shown only from a made-up test fixture, tagged as such: no bus lane, no bus total, no winner, no map. |
| `22-mapunavailable.png` | Map unavailable: the bundled route drawing on a plain background, with a one-line notice. The race is unchanged. |

## Desktop

| Image | Note |
| --- | --- |
| `13-desktop-firstload.png` | The real street map fills the left under the headline "Same ride, longer wait."; the race column is a fixed 440 px on the right. Race about to start. |
| `14-desktop-racing.png` | Racing. The small trolley marker moves along the route in step with the lane. |
| `15-desktop-wins1938.png` | 1938 wins. The departures board stays visible; the buttons sit directly under the content, then the footer line. |
| `16-desktop-todaywins.png` | Today wins. The line under the result opens with "Today wins this race." |
| `17-desktop-sources.png` | The Sources panel slides over the race column; the map dims. |
| `23-desktop-corners.png` | Corner picker as a panel over the race column. |
| `24-desktop-badshare.png` | Bad share link banner over the race column. |
| `25-desktop-noseat-fixture.png` | No one-seat ride, from the test fixture: tagged, no map, no bus total. |
| `26-desktop-mapunavailable.png` | Map unavailable: route drawing only, with the notice. |

## The trolley

| Image | Note |
| --- | --- |
| `18-trolley-sheet.png` | The trolley illustration at 360, 168 and 112 px, the simplified 28 px map marker, and today's bus. An original drawing: two poles, two wires, tyres, no rails. |

## Known limits of these pictures

- Motion, glow breathing and the finish moment cannot be shown in a still picture; they are specified in `../screen-brief.md`, section 3A.6.
- In `06` and `07` the result box wraps to two lines, so on a 667 px tall phone the "When today wins" link is scrolled out of view under the pinned buttons. The card scrolls inside itself; taller phones show it without scrolling.
- In `16` the map marker sits over part of the "Preston St" label.
- On desktop in the racing states there is unused space at the bottom of the race column, below the footer line.
- The no-one-seat pictures still show "No. 21, 1938" and the Baltimore slider range around made-up corners; in the build the fixture is used in tests only and never shipped.
- Desktop versions of states 05 to 12 are not drawn; they follow the same layout rules.
