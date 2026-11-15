# Race screen mockups

Eighteen pictures of the intended race screen, drawn on November 15, 2026, during planning, with Claude Code. They are images only: the markup used to draw them is not in this repository, and the site is built in Kiro. The written direction is `../screen-brief.md`, sections 2, 3 and 3A.

All pictures use the chosen palette, B ("Gaslight and brick"). Phone pictures are 375 × 667 px, saved at 2× (750 × 1334). Desktop pictures are 1280 × 800.

Numbers in the pictures are planning values computed from the pinned feed. The built site reads every number, and every count such as "5,582 of 5,666", from its data files. On the maps, the street grid, the harbour outline and the neighbourhood labels were sketched by hand and are approximate; the built map takes them from OpenStreetMap.

Vehicle size is style, not data. Only the bars under each vehicle are drawn to scale.

## Phone

| Image | Note |
| --- | --- |
| `01-firstload.png` | First load. The race is about to start: large trolley under its two wires, later phases dimmed, and the departures board under the lanes. |
| `02-racing.png` | Racing. The clock reads "10:08 scheduled". The trolley is riding; the bus side is still waiting. |
| `03-wins1938.png` | 1938 wins by 30 minutes at 10:00. The shown parts add up to the totals (2 + 31 + 8 + 4 = 45). |
| `04-todaywins.png` | Today wins by 4 minutes (Westwood & Carey to Preston & Caroline at 11:23). Same box, size and position as a 1938 win. The line under it opens with "Today wins this race." |
| `05-photofinish.png` | Photo finish at 10:30: under a minute apart, so no winner is called. |
| `06-beforetable.png` | Slider at 9:00, before the first listed 1938 car at this corner. The notice says both sides race from 9:21. |
| `07-inferred.png` | A pair that uses the inferred corner: dashed chip, dashed dot and stretch on the map, one-line caution. The corner's name sits directly under its dashed dot; two street labels are hidden to make room. |
| `08-sharelink.png` | A share link was opened. A banner names the pair for 5 seconds. |
| `09-dataerror.png` | The data did not load. No numbers, a dimmed trolley and map, one "Try again" button. |
| `10-sources.png` | Sources sheet, opened by tapping a number. The wait row shows the exact value beside the rounded one. |
| `11-credits.png` | Sources and credits sheet. |
| `12-reducedmotion.png` | Reduced motion: both lanes drawn finished, the result shown at once (12:00 start). |

## Desktop

| Image | Note |
| --- | --- |
| `13-desktop-firstload.png` | The map fills the left; the race column is a fixed 440 px on the right. Race about to start. |
| `14-desktop-racing.png` | Racing. The small trolley marker moves along the route in step with the lane. |
| `15-desktop-wins1938.png` | 1938 wins. The departures board stays visible; the buttons sit directly under the content, then the footer line. |
| `16-desktop-todaywins.png` | Today wins. The map marker stops short of the destination so it does not cover the corner name. The line under the result opens with "Today wins this race." |
| `17-desktop-sources.png` | The Sources panel slides over the race column; the map dims. |

## The trolley

| Image | Note |
| --- | --- |
| `18-trolley-sheet.png` | The trolley illustration at 360, 168 and 112 px, the simplified 28 px map marker, and today's bus. An original drawing: two poles, two wires, tyres, no rails. |

## Known limits of these pictures

- Motion, glow breathing and the finish moment cannot be shown in a still picture; they are specified in `../screen-brief.md`, section 3A.6.
- On desktop in the racing states there is unused space at the bottom of the race column, below the footer line.
- The trolley sheet shows 168 and 112 px examples; the sizes to build are in `../screen-brief.md`, section 3A.2.

Not drawn: the corner picker, the bad-share-link notice, the "no one-seat ride" state, "map unavailable", and desktop versions of states 05 to 12. Their wording is in `../screen-brief.md`, section 2.4, and they follow the same layout rules.
