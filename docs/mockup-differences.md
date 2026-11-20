# Mockup differences (race-screen task 23.3)

The built screens set beside the 26 pictures in `docs/planning/ui-mockups/`, on Nov 20, 2026. The built pictures are the output of `npm run screens` (`web/test-results/screens/`, git-ignored). Nothing in the design was changed to hide a difference: this file lists them for review.

The mockups are pictures drawn during planning. They are a visual target, not a specification: where a picture and the approved copy table or an owner decision disagree, the table or the decision is what was built.

## What was compared

| How far | Mockups |
|---|---|
| Side by side in the 23.3 walk (15) | 02, 04, 05, 06, 07, 08, 09, 10, 11, 14, 16, 17, 19, 25, 26 |
| Side by side earlier on Nov 20, before later changes to the map area (3) | 01, 21, 22 |
| Not compared with their mockups (8) | 03, 12, 13, 15, 18, 20, 23, 24 |

For 03 and 15 only the built picture was looked at. 18 is the dev-only vehicle sheet and was not compared with its mockup. 12, 13, 20, 23 and 24 were not looked at in this walk.

An earlier summary said 21 of the 26 had been compared. That count was too high; the table above is the record.

## Expected differences

Each follows from the approved copy table (requirements.md) or an owner decision, not from a fault.

- **Racing status lines count down.** At 10:08 the trolley's line reads "Riding 7 min (scheduled)" where mockup 02 reads "Riding 9 min". The bus's wait line names the bus ("Waiting for the 10:32 bus (scheduled).") and has no countdown (owner decision, Nov 19).
- **Photo finish (05).** The box reads "Photo finish." and "Both about 15 minutes." Mockup 05 adds "Under a minute apart, so no winner is called." The meaning of "photo finish" is in the credits sheet instead.
- **Before the table (06).** The box reads "1938 wins by 39 minutes." and "Trolley 9 min. Today's bus 48 min, walking included (estimated)." Mockup 06 has a different second line ("From 9:21. Trolley 9 min. Bus 48 min, ..."). The notice names 9:21 and its two times are number buttons.
- **Inferred corner (07).** The chip reads "Inferred corner" (mockup: "inferred"), and the pair row wraps onto two lines on a phone.
- **Data error (09).** The message is the approved title, then the approved second line, then "Try again".
- **Map notice and credit line.** They sit at the foot of the map strip on a phone, beside the attribution button (owner decision, Nov 20). Mockup 22 has the notice at the top left.
- **Sources sheet (10, 17).** Each row also carries the lines of the copy table: the method line, the trip line for buses, the "Exact value" line where a part is not the plain rounding, and the date line.
- **Credits sheet (11).** Its wording and order follow the copy table and the catalog labels and links, not the mockup's.
- **Number buttons.** Each is named from its visible text ("6 min, scheduled 1938 wait. Show source."); not visible in a picture.
- **Streets under the route (14, 16).** The map is OpenFreeMap's, recoloured at run time, so its streets and labels differ from the planning artwork. Street names along the route are placed by the site (see the next section).

## Things to check

- **Map behind a phone sheet (10, 19).** With a sheet open on a phone, the automated pictures show only the corner dots in the strip above it. The map is intact: the part of the strip the sheet does not cover captures correctly on its own, and the whole map returns when the sheet closes. It looks like how the headless browser captures a partly covered WebGL canvas, not a fault, but this was not confirmed on a real GPU. Check a sheet over the map on a real phone.
- **Maps not drawn in the pictures (14, 22, 26).** 14 pauses the browser's clock, so the map, which loads when the page is idle, never starts; 22 and 26 block the map's tile host on purpose. Each therefore shows the route drawing on a plain background.
- **Marker beside a street name (07).** The last letter of "Caroline Street" ends about 1 px from the trolley marker's pole. They do not overlap, which the browser check confirms, but it is tight.
- **Moved street names.** When no place along its leg clears the standing trolley marker, a name is placed beside the leg (owner decision, Nov 20). For the lead pair on a phone this is Caroline Street, which stands to one side of its line. A few other pairs move a name on each layout; `web/tests/unit/maplabels.test.ts` checks, for every pair and both layouts, that no name lies under the marker and that a moved name keeps off the route's other lines and the other names.
- **Inferred origin dot.** When the inferred corner is the origin, it is drawn as the filled origin dot, so its dashed outline cannot show. The "(inferred)" suffix and the dashed stretch of route still mark it.
- **Map timeout.** In the headless browser the map sometimes misses its 8 second limit and the page falls back to the route drawing with the notice, as designed. It happened on the first load of the deployed page in testing. Watch for it on a slow phone.
- **Honest line below the visible card (04).** At 375 x 667 the honest line ("Today wins this race. Across this line: ...") is below the pinned buttons in the picture, and the result box is cut at its foot; the card scrolls inside itself, and a taller phone shows them without scrolling (R1.2).

## Defects in the mockups, not in the build

- **10 and 17:** the first rows of the Sources sheet are drawn with overlapping text (the selected row's lines run over the rows below it).

## Not compared

See "What was compared": 03, 12, 13, 15, 18, 20, 23 and 24 have no side-by-side record, and 01, 21 and 22 were compared before the map-area changes later that day. A second walk of those eleven would close the gap.
