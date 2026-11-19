---
inclusion: fileMatch
fileMatchPattern: "web/**/*"
---

# UI

The full direction is docs/planning/screen-brief.md, sections 2, 3 and 3A
(3A wins where they differ). The pictures in docs/planning/ui-mockups/ show the
intended look on a phone and on a laptop; match them closely.

- One web page, two layouts. Below 900 px wide: phone layout, designed at
  375 x 667 px. From 900 px up: desktop layout, designed at 1280 x 800 px.
- Phone: top bar 40 px, map 150 px, race card from 181 px down, two buttons
  pinned at the bottom (Sources; Share this race). Sheets slide up.
- Desktop: map on the left, a fixed 440 px race column on the right with the
  same content in the same order. The buttons sit directly under the content,
  then a footer line. Sheets slide in over the race column.
- Nothing scrolls sideways. Every tap target is at least 44 x 44 px.
- Colours (palette B, "Gaslight and brick"): --night #17121F, --panel #221A2D,
  --line #3B3049, --ink #ECE7F2, --muted #A99FB8, --ghost #FFE7A8 (1938 only),
  --today #F47C5A (today only), --lit #FFF8E0 (trolley windows), result box
  #100C16, --water #1E1A33, --street #2A2137, --alert #FF8A80 (errors only).
  Text contrast at least 4.5:1; faint map text never below 80% opacity.
- Type: Barlow Condensed 600 (@fontsource package, Latin subset) for the wordmark,
  corner names, lane titles, times, totals and the result line; the system font
  for everything else. Tabular figures. Sentence case; no all-caps labels.
- Only the 1938 trolley glows. It is the detailed illustration described in
  screen-brief.md 3A.2, hanging from two hairline wires that cross the whole
  card. Phone: 150 px wide while racing, 104 px after the finish. Desktop:
  200 px. The map uses the separate simplified marker. Today's bus is flat and
  plain, 84 px on a phone and 104 px on desktop, on one hairline. Vehicle size
  is style; only the bars are drawn to scale.
- Lanes: one 9 px bar per side on a shared time scale. Wait = hatched,
  ride = solid, walk = dotted, each named in text.
- Display rounding follows screen-brief.md 2.10: the shown parts always add up
  to the shown total, and the shown margin is the difference of the two shown
  totals.
- Every count on screen is read from summary.json (screen-brief.md 2.11).
- The result sits in a dark box like a destination sign, in the winner's colour
  (--ink for a photo finish). A win for today looks exactly like a win for 1938.
- Before and during a race, a departures board sits under the lanes
  (screen-brief.md 3A.5).
- Map: real streets as hairlines, the 1938 line as the brightest thing, its
  streets named along it. No neighbourhood names. Streets come from
  OpenStreetMap data or the base-map tiles; the route from route.geojson.
- Desktop only: the headline "Same ride, longer wait." sits over the top left
  of the map (screen-brief.md 3A.1).
- Every walk time carries the word "estimate" ("Walk 2 min · estimate"). The
  slider shows "9:00" and "13:52" in small muted text under its two ends.
- Data error state: no number anywhere on screen, including the route number
  on the trolley and "No. 21, 1938" in the top bar.
- Motion follows screen-brief.md 3A.6 exactly: 1 s per 4 scheduled minutes, at
  most 12 s, linear movement, only transform and opacity animated, a visible
  "Skip to result". The clock reads "10:08 scheduled" and nothing more.
  Reduced motion: no animation; both lanes drawn finished.
- The result is announced once, through an aria-live region, when the race ends.
- Every number is a button with a dotted underline that opens the Sources sheet
  at its row.
- Use only the copy strings in the race-screen spec. Do not write new wording.
