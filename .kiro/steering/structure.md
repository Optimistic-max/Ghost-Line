---
inclusion: always
---

# Structure and git

## Layout

- data/lines/       hand-entered facts: no21-1938.yaml, no21-1933.yaml.
                    Coordinates are [lon, lat]. Agents never edit these.
- data/osm/         ways.json: OSM way shapes by id, with the download date.
- raw/              the pinned feed zip and caches. Git-ignored.
- pipeline/         one module per step: facts, clock, stops, eligible, race,
                    summary, route, emit, check_sources, cli, mcp_server.
- tests/            unit/, property/, golden/, fixtures/.
- web/              index.html, src/, public/data/ (generated JSON, committed).
- docs/planning/    briefs written before the build: race-brief.md,
                    screen-brief.md, skeptic-brief.md. ui-mockups/ holds PNG
                    pictures of the intended screens: a visual reference only,
                    with no code to copy.
- docs/             video_script.md, devpost.md, kiro-usage.md.
- .kiro/            steering, specs, hooks, agents, settings. Always committed.

## Generated files

- web/public/data/ is written only by `python -m pipeline build`. Never edit it
  by hand.
- mcp_server.py reads the raw feed with its own small reader. It must not import
  pipeline.eligible or pipeline.race: it exists to check them independently.

## Git

- Commit .kiro/ with every change. It must never appear in .gitignore.
- Small commits, imperative messages.
- Never commit raw/, tokens, or tool caches.

## Licences and credits

- Route geometry derives from OpenStreetMap: ODbL, credit "OpenStreetMap
  contributors".
- 1938 and 1933 scans: link to Digital Maryland. Do not copy scan images into
  the repo or the site.
- MDOT MTA data: credit it, use no logos, say "not endorsed by MDOT MTA".
- HOLC layer, when built: credit "Source: Mapping Inequality", CC BY-NC 2.5,
  kept separate from the code licence.
