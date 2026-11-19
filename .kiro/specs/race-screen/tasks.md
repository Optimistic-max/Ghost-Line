# Race Screen: Tasks

Implements `requirements.md` and `design.md` in this folder. Requirement IDs (R1 to R17), principles (P-A to P-E) and properties (P1 to P13) refer to the requirements file; section numbers refer to the design file.

## Rules for running these tasks

- Run in order, one task at a time. Full test run after each task (`npm test` in web/, plus `python -m pipeline check` before any commit that touches pipeline/ or web/public/data/). Commit "Task N: title" only when green.
- Stop and report, without committing, on: any expected value that differs from the requirements, the brief or the data; any fix that would weaken a test or a tolerance; any conflict between this spec and a steering file; any need for the network, a write under raw/, or a change to data/lines/.
- The site never computes a race result (principle P-A and the table in design section 1). No count, time or minute value from the brief or the mockups is typed into src/ or into the tests of the real data path.
- No new wording: every visible string is a row of the copy table in requirements.md.
- Needs the network and so needs Emmanuel's go-ahead before it runs: task 1 (`npm install`), task 8 (the font file), task 20 (Playwright's browsers), task 22 (the deployed page). Tell Emmanuel before each of these.
- Never edit web/public/data/ by hand; it is written only by `python -m pipeline build`.

## Setup

- [ ] 1. Scaffold web/ (R16.3 to R16.5)
  - [ ] 1.1 Create web/package.json with scripts `dev` (vite), `build` (vite build), `test` (vitest run), each one command with no `&&`, pipes or shell syntax; dev dependencies vite, typescript, vitest, fast-check, jsdom, axe-core, @playwright/test; runtime dependency maplibre-gl only. (Needs the network: ask first.)
  - [ ] 1.2 vite.config.ts with `base: '/Ghost-Line/'`, a manual chunk so maplibre-gl and src/map/map.ts form a separate chunk, and the dev server serving web/public/data. tsconfig.json strict. vitest config: node environment by default, jsdom for tests under tests/dom.
  - [ ] 1.3 .gitignore entries for web/node_modules and web/dist (the repo's .gitignore must not ignore web/public/data or .kiro).
  - [ ] 1.4 src/config.ts: one constants block with the lead pair, the 300 ms and 2 s and 5 s and 3 s timings, the 900 px and 720 px breakpoints, the vehicle and font sizes, and the Source URLs read from tech.md (repository link, base map style URL, base map credit text). A test reads tech.md and fails if any URL or credit text in config.ts is not in its Source URLs list.
  - [ ] 1.5 tests/unit/smoke.test.ts passes; `npm run build` produces web/dist with an empty page; confirm base path in the output.
  - Depends on: none

## Data and pure logic

- [ ] 2. Data types and shape validators (R14.1, section 3)
  - [ ] 2.1 src/data/types.ts as in section 3.1, including the task 35 fields.
  - [ ] 2.2 src/data/shape.ts: one validator each for index, summary, race and route; throws ShapeError naming file and field. Checks: required fields and types, finite numbers, race rows are one per whole minute with first and last `t` consistent, every `today.trip` index inside `today.trips`, every `sources` id in the catalog, label present.
  - [ ] 2.3 Contract test: read pipeline/schemas/*.schema.json and compare each schema's `required` lists (top level and the nested objects the site uses) with the validators' field lists; fail on any required field the validators do not check.
  - [ ] 2.4 Tests on the real files: all 23 files in web/public/data validate; mutated copies each fail (a field removed, a type changed, a row dropped, a trip index out of range, an unknown source id, a null where a number is needed).
  - Depends on: task 1

- [ ] 3. Loading and lookups (R2.3, R14.2, section 3.3, section 8)
  - [ ] 3.1 src/data/load.ts: fetch index, summary and the pair's race file together; 3 s timeout; one `data-error` result on any failure; retry; in-memory cache of race files by pair; route.geojson loaded separately and never part of the gate.
  - [ ] 3.2 src/data/lookup.ts: `rowAt(race, hhmm)` through a Map built once; `tripAt`; `nextAfter(list, current, count)` by position (no time comparison); source-row lookup.
  - [ ] 3.3 Tests with a fake fetch: success; each file failing; invalid JSON; shape failure; timeout with a late arrival not replacing the error; retry recovers; a failed on-demand race file gives the data error. Lookup tests, including `nextAfter` at the end of a list and with fewer than the requested count.
  - Depends on: task 2

- [ ] 4. Pure formatting modules (R3.4, R4.4, R7, R8.5, R15.5, sections 6 and 7)
  - [ ] 4.1 src/format/rounding.ts `roundParts` (largest remainder, ties to the earlier phase, throws RoundingError if the invariant cannot hold). Examples: the six rows of screen-brief 2.10. Properties (R7.8, P4): parts sum to the shown total; each shown part is a whole number within one minute of its stored value; whole inputs come back unchanged; deterministic; a stored win never shows a margin under one minute.
  - [ ] 4.2 src/format/gaps.ts: `roundMinutes`, `minuteWord`/`minutes` (singular and plural), `gapPart`, the 1938 spacing text. Properties P11 and P13: the "up to" form exactly when the lower gap rounds to 0; one number when equal; "1 minute" exactly when the number is 1; no "1 minutes" anywhere.
  - [ ] 4.3 src/format/time.ts: `defaultMinute(now, first, last)` with America/New_York; `label12`; `serviceDateLabel` ("Nov 4, 2026" from the ISO date, never shifting a day); `clockLabel`. Example rows 1 to 4 of race-brief 5.9; property P2 over every minute of a day and over the two clock-change days.
  - [ ] 4.4 src/format/share.ts `encode`/`decode`: example rows 5 to 8 of race-brief 5.9; P1 round trip for all 20 pairs; `decode` never throws on any string (fast-check over arbitrary strings, odd percent-encodings and repeated parameters); the URL never holds a time or a number.
  - [ ] 4.5 src/format/list.ts: route names joined with " and " for two and commas with "and" for more; one name alone.
  - Depends on: task 1

- [ ] 5. Copy module and wording tests (R15, section 16)
  - [ ] 5.1 src/copy/copy.ts: one template function per row of the requirements copy table, each carrying both minute forms (R15.5), including "Link copied" and the base map credit. src/copy/announce.ts: the four announcement templates.
  - [ ] 5.2 Copy-table test: parse the quoted strings of the copy table in requirements.md; fail if copy.ts holds a visible literal that is not a row's template, or a row has no template. Fixed phrase test: "Scheduled, not live." is the only place the word live appears.
  - [ ] 5.3 Banned-word helper used by later DOM tests (live, real-time, realtime, "arriving now", "right now", with the one allowed phrase); tested on its own with deliver, olive and lives.
  - Depends on: task 1

- [ ] 6. State, derived view and the made-up fixture (R5, R6, section 4, section 5)
  - [ ] 6.1 src/state/store.ts, model.ts, actions.ts: pure reducers for pair, minute, sheet, picker, banner, race phase (`idle`, `running`, `finished`, `resultShown`), motion level, map status.
  - [ ] 6.2 src/state/derive.ts: from state and data to `RaceView`: the two lanes' phases (stored and shown), shown totals, shown margin, result, notices, board data, frequency, honest line. Lookups and rounding only.
  - [ ] 6.3 web/tests/fixtures/: a made-up line named fake (5 corners with made-up names, race files including rows with `today: null`, an empty trips list, null gaps, and a today win), shaped exactly like the generated files, never under public/. The fixture carries the tag text of the copy table.
  - [ ] 6.4 Real-data tests (P9): for all 20 pairs and 293 minutes, the view's result, margin sign and winner colour equal the stored row; every shown total is the stored total rounded; each lane's shown parts add up; `resultAt` (task 11 uses it) is the first arrival for every win and the later one for every photo finish. Principle test: modules other than rounding, gaps, time, timeline, clock, layout and lookup contain no arithmetic on stored minutes (a source scan with a documented allowlist).
  - Depends on: tasks 3, 4

## Layout and drawing

- [ ] 7. Tokens, type and the page shell (R1, R12.1, R12.2, section 13)
  - [ ] 7.1 styles/tokens.css with palette B exactly as in ui.md and the size tokens of screen-brief 3.3 and 3A.1; base.css; focus ring; tabular figures; sentence case.
  - [ ] 7.2 index.html shell: top bar with "Ghost Line" only, map area, race card skeleton with the default pair's names, sheet roots, live regions (`#result-status`, `#share-status`), banner root. A test asserts the pair names in the HTML equal the lead pair's names in index.json.
  - [ ] 7.3 layout-phone.css and layout-desktop.css: the zones and sizes of R1.2 and R1.3; sheets as a bottom sheet on phones and a slide-in over the race column on desktop; pinned button strip on phones; inside scrolling; no horizontal scroll.
  - [ ] 7.4 Contrast test: compute WCAG ratios for every text/background pair used (text on --panel, --night, the result box, chips) from the tokens and fail under 4.5.
  - Depends on: task 1

- [ ] 8. Font (R12.2)
  - [ ] 8.1 Add one self-hosted Barlow Condensed 600 WOFF2 subset at web/public/fonts/ with its OFL licence text beside it, `@font-face` with `font-display: swap`, and a preload link. The file must be supplied or downloaded: Emmanuel decides which before this runs. Stop and ask if it is not in the repository.
  - [ ] 8.2 Test that only this one font file is referenced and that its licence text is present.
  - Depends on: task 7

- [ ] 9. Vehicles (R12.3, section 14)
  - [ ] 9.1 src/view/vehicles.ts: the detailed trolley SVG to screen-brief 3A.2 (two poles to two wires, retriever ropes, tyres, five windows, curved cab window, two doors, passenger silhouettes, belt rail, destination bar, headlamp, bumpers, route number from index.json, no rails); the simplified map marker; the flat bus. Original drawings, not traced.
  - [ ] 9.2 Tests: the trolley markup has exactly two pole elements and two wire elements and no rail element; the route number node is present only when given; the bus has no pole or wire; sizes per ui.md for phone and desktop come from config.
  - [ ] 9.3 A static sheet page (dev only, not shipped) showing the vehicles at the four sizes for visual comparison with mockup 18.
  - Depends on: task 7

## The card

- [ ] 10. Static card: pair row, slider, lanes, result box, honest line, buttons (R3, R5.3, R6, R7, R9, section 13.3, 13.4)
  - [ ] 10.1 view/pairrow.ts, slider.ts (native range, minus/plus, end labels from the race file, 12-hour time, aria-valuetext), buttons.ts, footer.ts.
  - [ ] 10.2 view/numbers.ts: number buttons with the dotted underline and accessible labels, and the per-render source registry.
  - [ ] 10.3 view/layout.ts and view/lanes.ts: one shared scale, hatched, solid and dotted phases with text labels, status lines and legends, vehicles on their hairlines; finished-state drawing only (no playback yet).
  - [ ] 10.4 view/resultbox.ts and view/honest.ts: the sign box, the four results, the two honest-line forms, "When today wins" link; identical geometry for every result.
  - [ ] 10.5 The first running page: loads the lead pair from web/public/data and shows its finished state with every number a button.
  - [ ] 10.6 DOM tests with real data: 1938 win (lead pair 10:00), today win (Westwood & Carey to Preston & Caroline 11:23), photo finish (lead pair 10:30): shown parts add up, margin is the difference of shown totals, "walking included (estimated)", both honest-line forms, a today win and a 1938 win have the same box geometry (P8).
  - Depends on: tasks 5, 6, 8, 9

## Playback

- [ ] 11. Timeline, clock and motion (R5, section 9)
  - [ ] 11.1 play/timeline.ts: segments from stored parts, `speed = max(4, longest / 12)`, `resultAt` chosen from `row.result`. Unit and property tests: 12 s cap, linear positions, the result moment per result type, no-ride timeline has one lane.
  - [ ] 11.2 play/clock.ts: one rAF loop, `elapsed` written as a CSS variable, `start`, `stop`, `skip`, `onResult`, `onFinish`; 300 ms pause before a race; tab-hidden catch-up; the frame-rate watchdog (`lite` under 30 per second in the first second).
  - [ ] 11.3 play/motion.ts: reduced-motion media query and levels (`full`, `lite`, `reduced`); reduced motion draws the finished state at once, with no clock and no "Skip to result".
  - [ ] 11.4 CSS and view wiring (styles/motion.css): bar fills by `transform: scaleX`, vehicles by `translateX`, dimming and arrival emphasis by `opacity`; trolley bob, pole sparks, hub rotation and glow breathing as separate elements; only transform and opacity animated (a test scans the stylesheets for animated or transitioned properties and fails on anything else); result box roller-sign entrance and honest line fade; the result is shown at `resultAt` and the slower side runs on; "Skip to result"; the trolley shrinks and the legends replace the status lines at the finish.
  - [ ] 11.5 Slider interaction: any thumb movement or minus/plus stops the race at once; only the time label and the board update while dragging; the next race starts 300 ms after the last input. `performance.mark('race-start')` when the first segment moves.
  - [ ] 11.6 Tests with fake timers: the order of events for a 1938 win, a today win, a photo finish and a no-ride race; the result and announcement happen once, at the right moment; stop and restart; skip before and after the result; reduced motion; `lite` fallback.
  - Depends on: task 10

## Board, sheets and sources

- [ ] 12. Departures board and frequency sentence (R8, 3A.5)
  - [ ] 12.1 view/board.ts: four 1938 times and three bus times by `nextAfter` from the row's own entries, filled chip for the next one, every time a number button; starts at `row.start`; visible on desktop after the finish, and on phones only before and during the race.
  - [ ] 12.2 The frequency sentence from the data: whole-minute gaps, "up to" rule, window in 12-hour form, route names, service date, 1938 spacing; "every {n} minutes" when equal.
  - [ ] 12.3 Tests on real data for the lead pair (34 to 39 and 7 or 8, read from the file), a multi-route pair (Westwood & Carey to Aliceanna & Bond: a lower gap that rounds to 0 uses the "up to" form), and the fixture; board contents equal the file's lists.
  - Depends on: task 10

- [ ] 13. Sheets, Sources, About and When today wins (R1.5, R9, R10, R6.5)
  - [ ] 13.1 view/sheets/sheet.ts: dialog with focus trap, Escape, scrim, slide (220 ms in, 160 ms out), focus returns to the opener; no sliding under reduced motion.
  - [ ] 13.2 sheets/sources.ts: rows from the registry (value and meaning, catalog `label` and link or the race file's own URL, one-line method from the copy table, date line, walk rows with "estimate" and the method entry's `what`, bus rows with route and headsign, the "Exact value" line when a part is not the plain rounding); the tapped row scrolled into view with the --ghost edge; the last row "Sources and credits".
  - [ ] 13.3 sheets/about.ts: credits list from the catalog labels and links, "Not endorsed by MDOT MTA.", the base map credit text, "original illustrations", the "how it was made" line with the checked-by-hand clause only when `street_order_checked` is true, "MIT licence" and the repository link, the inferred-corner sentence and "Scheduled, not live."; no 1933 line.
  - [ ] 13.4 sheets/whentoday.ts: the sentence (the slower clause only when above zero; the pair count from summary.pairs), then every entry of `today_wins`; each entry selects that pair and time.
  - [ ] 13.5 Tests: P3 (every number button on the card, for each state, has a registry entry and a row in the sheet, found by crawling the DOM); counts swapped for a different summary.json show the new numbers (P5); credits with the flag true and false; `today_wins` list length equals the file's.
  - Depends on: tasks 10, 12

## Pair, link and states

- [ ] 14. Corner picker, swap, share link, address bar (R4)
  - [ ] 14.1 sheets/corners.ts: two-step picker, five buttons west to east, Start tag, inferred chip, note, Cancel, the start disabled in step two.
  - [ ] 14.2 Swap; `history.replaceState` with the query only on every pair change (P12); decoding at boot; the bad-link and shared-link banners (5 s, 200 ms in and out).
  - [ ] 14.3 Share button: `navigator.share` with the link only; AbortError does nothing; otherwise copy (clipboard, then textarea fallback) and "Link copied" for 2 s with a separate polite region; the button keeps its size.
  - [ ] 14.4 Tests: all 20 pairs selectable by three taps; picker keyboard use; swap; each share path (share available, cancelled, failing and falling back, clipboard unavailable); the address bar after every change; shared link; each bad link of race-brief 5.9.
  - Depends on: tasks 4, 10, 13

- [ ] 15. Remaining states (R2, R6.6 to R6.8, R14, R2.2)
  - [ ] 15.1 Loading (the line under the pair names, top bar shows only "Ghost Line"), Ready (schedule line, "Start time is the time now." only for a clock-derived time), and the first race starting by itself.
  - [ ] 15.2 Before the midday table: notice naming `row.start`, thumb unmoved, lanes and board from `row.start`; inferred corner: chip, caution line, dashed dot and stretch; notices as tinted strips that hide the schedule line.
  - [ ] 15.3 No one-seat ride: the 1938 lane, the no-bus sentence, "No one-seat ride today", "Trolley {n} min. No winner is called.", no bus lane, vehicle, total or margin; shown from the fixture with the fixture tag, never from the shipped data.
  - [ ] 15.4 Data error: message, Retry, no number anywhere (top bar, trolley route number, counts), corner names stay; Retry recovers without a reload; the 3 s timeout.
  - [ ] 15.5 "No. 21, 1938" and the trolley's route number built from index.json's `line` and `effective` after the shape check, omitted when `line` does not match; absent in the error state.
  - [ ] 15.6 Tests for each state of R17.1 from real data where a real state exists (today win, photo finish, before the table at 9:00, an inferred pair) and from the fixture otherwise; P7: in the data-error state the DOM contains no digit.
  - Depends on: tasks 11, 12, 13, 14

## Map

- [ ] 16. Route drawing and the map area (R11.1, R11.4, section 12.1)
  - [ ] 16.1 map/routedrawing.ts: SVG from route.geojson and index.json: legs, dashed inferred legs, street names along legs, corner dots and names (origin filled, destination ring, inferred dashed with "(inferred)"), plain background; phone shows only the chosen corners; used first as the placeholder, kept as the fallback.
  - [ ] 16.2 The fallback notice "Map unavailable. Showing the route diagram." only on failure; the credit line on the map.
  - [ ] 16.3 Tests: leg count equals the file's features; inferred legs dashed; corner labels per layout; the drawing builds from the fixture's route (the fixture has no map, so the area shows nothing).
  - Depends on: task 15

- [ ] 17. MapLibre chunk (R11, section 12.2 to 12.4)
  - [ ] 17.1 map/map.ts loaded by dynamic import after the card is painted (idle callback with a 1 s fallback): the OpenFreeMap dark style from config, recoloured to palette B by map/style.ts; route, inferred dashes, street names along the route, corners, desktop-only names for all five; the simplified trolley as a DOM marker moved along the route in step with the ride phase and stopping short of the destination.
  - [ ] 17.2 Corner clicks drive the picker as in section 12.4 (phone opens the sheet; desktop advances the picker with the hint strip using the existing step lines).
  - [ ] 17.3 Failure paths (import, WebGL, style or tile error, 8 s timeout) set `mapStatus: 'unavailable'` and never touch the data state. The route drawing fades out only when the first map frame renders.
  - [ ] 17.4 Unit tests of style.ts (every palette-B colour present, no label below 80% opacity) and of the marker position helper (geometry only); the map itself is exercised in tasks 20 to 22.
  - Depends on: task 16

## Quality

- [ ] 18. Accessibility (R13)
  - [ ] 18.1 view/a11y.ts: the result live region written once at the result moment (for a photo finish, when both have arrived; immediately under reduced motion), cleared first, 50 ms delay; `#share-status`; labels; sheets as modal dialogs; visible focus ring; landmarks.
  - [ ] 18.2 axe-core in jsdom on every reachable state (each state of R17.1, picker open, each sheet open, reduced motion); the contrast test from task 7 extended to chips and sheet rows.
  - [ ] 18.3 Keyboard test: slider, minus and plus, swap, picker, number buttons, sheets, skip, share, About, without a pointer.
  - [ ] 18.4 Announcement tests: one write per race for each result type with the approved text built from shown numbers (the spoken walking total is the sum of the shown walk parts); nothing written during the animation.
  - Depends on: tasks 15, 17

- [ ] 19. Wording and rule tests across the whole screen (R15, P5, P6)
  - [ ] 19.1 Render every state and scan the text, the aria labels and the status messages for banned words, allowing only "Scheduled, not live."
  - [ ] 19.2 Every time on screen carries the word scheduled in its line, label or accessible name; walks say estimate every time; "citywide" never appears.
  - [ ] 19.3 Count test: a summary.json with different numbers changes every count on screen; no digit string from the real summary.json appears in any file under src/.
  - [ ] 19.4 Every minute string uses the singular for 1 (P13) across all states.
  - Depends on: task 18

## End to end, budgets and deploy

- [ ] 20. Playwright end-to-end (R17, R5.11, R11.4, R1.4)
  - [ ] 20.1 Install Playwright's Chromium (needs the network: ask first). Config for a phone (375 × 667) and a laptop (1280 × 800) project.
  - [ ] 20.2 Scripts `test:e2e` (one command). Tests: the first race on both layouts; the result appears at the first arrival and the slower side runs on; skip; the whole race with the tile host blocked and WebGL absent; reduced motion (no animation, finished at once); keyboard-only run through every control; no horizontal scroll at 320, 375, 899, 900, 1280 and 1920 px wide; the data-error state with the data blocked, then Retry.
  - [ ] 20.3 axe-core in the browser on both layouts for the states where layout matters.
  - [ ] 20.4 A screenshot per mockup state (01 to 26) saved under web/tests/e2e/screenshots/ (git-ignored) for side-by-side review against docs/planning/ui-mockups/; Emmanuel reviews them. The fixture state is rendered through a test-only route that is not in the build.
  - Depends on: tasks 18, 19

- [ ] 21. Build budget and chunks (R16.1)
  - [ ] 21.1 `npm run check:size`: build, then gzip the first-load assets (HTML, main script, CSS, the font, the three data files the first race loads) with the map chunk excluded; fail over 100 KB. Print each file's size.
  - [ ] 21.2 Confirm the map chunk is not in the first-load set and that `import('./map/map')` is the only reference to it.
  - Depends on: task 17

- [ ] 22. Deploy and the first-race measurement (R16.2, R16.3, R17.7)
  - [ ] 22.1 .github/workflows/pages.yml: on push to main, `npm ci`, `npm run build` in web/, upload web/dist and deploy to GitHub Pages; the generated data is committed, so the Action never runs the pipeline or reads raw/. (Needs the network and Emmanuel's go-ahead for the first push.)
  - [ ] 22.2 `npm run perf` (tagged timing, outside `npm test`): Playwright with a mobile viewport, slow-4G network throttling and CPU slowdown through the browser's debugging protocol, five runs of the page, the median of the `race-start` mark under 5,000 ms; prints all five. Run it against the deployed URL, then once on a real phone on mobile data (Emmanuel).
  - [ ] 22.3 README note in web/ for the commands, including that `python -m pipeline check --timing` and `npm run perf` are run on a quiet machine before submission.
  - Depends on: tasks 20, 21

- [ ] 23. Final validation
  - [ ] 23.1 `npm test`, `npm run test:e2e`, `npm run check:size` pass.
  - [ ] 23.2 `python -m pipeline check`, `python -m pipeline verify` and `python -m pipeline check_sources` pass (the site's text lives in web/, which check_sources scans).
  - [ ] 23.3 Walk the mockup screenshots from task 20 against every requirement of R6 states and the visual rules; list any difference for Emmanuel; do not change the design to hide one.
  - [ ] 23.4 Emmanuel runs `python -m pipeline check --timing` and `npm run perf` on a quiet machine before submission; record the results in docs/kiro-usage.md.
  - Depends on: tasks 19 to 22
