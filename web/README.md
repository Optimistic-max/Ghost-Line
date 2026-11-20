# Ghost Line: the site

The race screen: a static page that brings back Baltimore's 1938 No. 21 trackless trolley and races
it against today's scheduled MTA bus. Vite, TypeScript, plain CSS and MapLibre GL JS, with no UI
framework. The page only looks up, rounds and animates; every number is read from the generated
files in `public/data/`, which only `python -m pipeline build` writes (never edit them by hand).

All commands run in `web/` and are one command each.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | The dev server, with the data served from `public/data/`. |
| `npm run build` | The production build into `dist/`, with the base path `/Ghost-Line/`. |
| `npm test` | The site's tests (vitest: unit, property, real-data and jsdom tests). |
| `npm run test:e2e` | The race in a real browser on a 375 x 667 phone and a 1280 x 800 laptop, with axe-core on the drawn page. Needs Playwright's Chromium once: `npx playwright install chromium`. |
| `npm run screens` | One picture per mockup state in `test-results/screens/` (git-ignored), to put beside `docs/planning/ui-mockups/`. |
| `npm run check:size` | Builds the site and adds up what the first race loads, as served, with the map left out. Fails over 100 KB, or if the map is part of that set. Prints each file. |
| `npm run perf` | The first-race measurement of the deployed page: see below. |

From the repository root, before a commit that touches `pipeline/` or `web/public/data/`:
`python -m pipeline check`. Its fast form for editing is `python -m pipeline check --quick`.
`python -m pipeline check_sources` fails on a banned word or an unsourced number in `web/` or `docs/`.

## Timing checks: run them on a quiet machine

Two checks assert a wall-clock limit. They are tagged `timing`, left out of every default run, and
must be run on their own, with nothing else running, before submission:

- `python -m pipeline check --timing` (from the repository root): the pipeline's limits, 10 s for
  `validate` and 60 s for `build`.
- `npm run perf` (in `web/`): five cold loads of the deployed page on a phone-sized touch
  viewport, with slow-4G network and a 4x slower processor, through the browser's debugging
  protocol. Each waits for the `race-start` performance mark, which the page makes when its first
  lane begins to move, and reads its time after the page started loading. It prints all five and
  the median, and fails if the median is 5,000 ms or more. The map's tile host is blocked, as the
  first race does not wait for the map. It measures the deployed page by default; to measure
  another address, such as `npm run build` followed by `npx vite preview`, set `PERF_URL` first:
  `$env:PERF_URL = 'http://127.0.0.1:4173/Ghost-Line/'`.

Then once on a real phone, on mobile data (Wi-Fi off), after clearing the site's data: open the
deployed page, then read the same mark from the phone's DevTools (Chrome on the phone, connected
by USB, `chrome://inspect` on the laptop):
`performance.getEntriesByName('race-start')[0].startTime`. Reload a few times and note the numbers.

## Hosting

GitHub Pages serves `dist/` at https://optimistic-max.github.io/Ghost-Line/ . The workflow
`.github/workflows/pages.yml` builds this folder (`npm ci`, then `npm run build`) on every push to
`main` and deploys `dist/`. It only builds the site: the generated data is committed, so it never
runs the pipeline and never needs `raw/`. The repository's Pages setting must be "GitHub Actions".
Vite's `base` is `/Ghost-Line/`, the repository's name, so every asset and data address sits under
it.

## Licences and credits

The code is MIT-licensed (see `LICENSE`). The route geometry derives from OpenStreetMap
(ODbL, "OpenStreetMap contributors"). The base map is OpenFreeMap, requested at run time. The
font is Barlow Condensed (SIL Open Font Licence 1.1), installed from npm and bundled. The data on
bus schedules is MDOT MTA's; this site is not endorsed by MDOT MTA. The About and credits sheet in
the page lists every source with its link.
