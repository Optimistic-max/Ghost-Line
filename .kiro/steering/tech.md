---
inclusion: always
---

# Tech

## Stack (fixed)

- Pipeline: Python 3.12, pandas, pyproj, PyYAML, jsonschema, pytest, Hypothesis.
- MCP server: the official Python MCP SDK, stdio transport. Check its current
  docs before writing the server.
- Site: Vite, TypeScript, MapLibre GL JS, vitest, fast-check. Plain TypeScript
  and CSS, no UI framework.
- Hosting: GitHub Pages, deployed by a GitHub Action from web/dist. Vite `base`
  must be "/<repo-name>/".
- The developer machine is Windows. Every hook command and npm script is one
  command: no &&, no pipes, no shell-specific syntax.

## Commands

- `python -m pipeline validate`  fast checks: facts schema, 1938 clock, JSON
  schemas, copy rules. Under 10 s. Does not read the feed.
- `python -m pipeline build`     full build into web/public/data/. Under 60 s.
- `python -m pipeline check`     build, then run pytest. The one command hooks use.
- `python -m pipeline verify`    rebuild from raw/ and fail if the committed
  data files differ.
- `python -m pipeline check_sources`  fail on a banned word or an unsourced
  number in web/ or docs/.
- In web/: `npm run dev`, `npm run build`, `npm test`.

## Pinned feed

- MDOT MTA local bus GTFS, feed_version 20260821. Service date 2026-11-04,
  the only active service_id is 2251.
- File: raw/mta_local_bus.zip
  SHA-256 8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694
  SHA-1   945358eadbe4f00a3e4a6f76d177f1e8c6af53f0
- raw/ is git-ignored. Never commit the zip.
- Never download a feed automatically. The public URL serves newer versions.
  If the file is missing or its SHA-256 differs, stop with a clear error.
- Cache the service-date rows of stop_times under raw/cache/ so builds are fast.
- Never read a real-time or vehicle-position feed.

## Source URLs

Links for the index.json source catalog. pipeline/emit.py reads them from one
constants block that cites this list. Do not add a URL anywhere else.

- mta_gtfs: https://feeds.mta.maryland.gov/gtfs/local-bus
  The pinned feed's source, from the Nov 1 v2 plan. Link only: the build never
  downloads from it.
- osm: https://www.openstreetmap.org/copyright
  OSM's required attribution page.
- repository: https://github.com/Optimistic-max/Ghost-Line
  The project's git remote (origin). Link only, for the credits.
- base map style: https://tiles.openfreemap.org/styles/dark
  openfreemap.org; verified Nov 18, 2026. The site's map requests it at run time
  and recolours it to palette B. MapLibre adds the map's own attribution from it.
- base map credit text: OpenFreeMap © OpenMapTiles Data from OpenStreetMap
  openfreemap.org; verified Nov 18, 2026. Required credit. Shown in the credits
  sheet and in the video.
- font: npm package @fontsource/barlow-condensed, weight 600, Latin subset only.
  SIL Open Font Licence 1.1; the licence file ships in the package. Credited in
  the credits sheet. No URL: installed from npm, never fetched at run time.

## Numbers

- Times are minutes after midnight, as decimals. GTFS hours can pass 24.
- Distances are WGS84 geodesic: pyproj.Geod(ellps="WGS84").
- Walk minutes = metres x 1.3 / 1.2 / 60. Stop radius: 400 m.
- Store three decimals. Round only for display: durations to the nearest whole
  minute, clock times with seconds dropped.
- Photo-finish band: 1.0 minute. One constant, defined once.

## Race rule in brief (the race-engine spec has the detail)

- start = the later of the slider time and the first listed 1938 car at the
  origin corner. Both sides race from start.
- 1938: the next listed car at or after start; walk 0; total = wait + ride.
- Today: among one-seat trips the rider can still reach after walking to the
  stop, the one that gets to the destination corner first, walking included.
- Window averages (for example 12.8 and 32.6 minutes for the lead pair) are not
  race results. Show them only with the label "average, 10 AM to 1 PM".

## Tests

- Every algorithm has example tests, golden tests on the pinned feed, and
  Hypothesis property tests.
- Golden tests skip with a clear message when raw/ is missing, so the hosted
  build passes. They must pass locally before any commit touching pipeline/ or data/.
- tests/fixtures/ holds a made-up line and a tiny made-up feed. They are named
  fake and are never written to web/.

## Site rules

- The browser only looks up, rounds and animates. No race arithmetic in
  TypeScript.
- The first race must not wait for MapLibre. Load the map with a lazy import
  after the race card is on screen.
- First-screen budget: 100 KB compressed, map excluded.
- Animate only transform and opacity. Respect prefers-reduced-motion.
