# Ghost cars: Tasks

Rules for every task: no schema change, no new library, no new URL, no change to a golden value, a facts file or the pipeline. A computed value that differs from the brief's golden value is a STOP and report to Emmanuel. A browser or timing test that fails only by its time limit under load is run again on its own and both runs are recorded; no time limit is raised.

- [ ] 1. Copy and the copy table
  - [ ] 1.1 `web/src/copy/copy.ts`: `ghostCounting(k)`, `ghostFinished(n)`, `METHOD_GHOST_COUNT`, `MAP_GHOSTS`, the four strings of the ghost-cars copy table.
  - [ ] 1.2 `web/tests/support/copytable.ts` reads the ghost-cars table; `copy-table.test.ts` renders the four; `ui.md` names the ghost-cars spec in its copy rule.
  - _Requirements: 4.2, 4.4, 4.5, 6.1, 6.3_

- [ ] 2. Cars and timing
  - [ ] 2.1 `format/time.ts` `secondsOf`; `data/lookup.ts` `carsOf`; `state/derive.ts` `RaceView.ghosts` for a Ghost_Row only.
  - [ ] 2.2 `play/timeline.ts`: `Timeline.ghosts`, `ghostShares`, `counterAt`.
  - [ ] 2.3 Tests: unit tests of `secondsOf`, `carsOf` (seconds compare, covered, no trip), `ghostShares` and `counterAt` on made-up timelines; the golden lead-pair check (n = 4, 10:06, 10:13, 10:21, 10:28); the fast-check property of Req 7.2 over the fixture and the real files; the real-data sweep (Req 7.4) written to the task report.
  - _Requirements: 1, 2, 3.1, 3.2, 4.2 to 4.4, 7.1, 7.2, 7.4_

- [ ] 3. The counter on the card
  - [ ] 3.1 `state/specs.ts` `ghostCountNum`; `view/lanes.ts` the reserved `p.ghost-counter` with the finished sentence on a finished card; `view/racer.ts` the counting line per frame and the finished sentence at `finish()`; CSS for the 12 px line.
  - [ ] 3.2 DOM tests (Req 7.3): changes at the clock moments; finished sentence; the button opens the `ghost-count` Sources row with the timetable link and the method line; card height unchanged while counting; reduced motion and skip give the finished sentence.
  - _Requirements: 4, 5.1, 5.3, 7.3_

- [ ] 4. Ghost cars on the map and the drawing
  - [ ] 4.1 `view/mapview.ts` `ghosts(shares)` with the drawing pool, the map line and the at-rest rule; `map/map.ts` `ghosts(points)`; `view/app.ts` calls it from the clock frame; `map.css` the `.ghost-car` look.
  - [ ] 4.2 DOM tests: ghosts on the drawing appear at their pass and leave at their arrival on the fake clock; none at rest, under reduced motion or after skip; the map line shows only while they do; only transform moves them (the stylesheet scan still passes).
  - _Requirements: 3, 5, 6.1, 6.2_

- [ ] 5. Pictures, budgets and the report
  - [ ] 5.1 `screens.spec.ts`: `ghost-cars-desktop.png` and `ghost-cars-phone.png`, the lead race with two Ghost cars on the route and the Counter at 2 or 3.
  - [ ] 5.2 Run `npm test`, `npm run typecheck`, `npm run test:e2e`, `npm run screens`, the checkpoint spec, `npm run check:size`; the phone fit test with the counter in place; `python -m pipeline check_sources`.
  - [ ] 5.3 The task report in `docs/kiro-usage.md`: the sweep, the hidden rows, the phone fit numbers, every rerun.
  - _Requirements: 7.5, 7.6_
