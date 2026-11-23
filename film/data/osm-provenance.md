# Provenance

Sources copied verbatim from design-v3/assets/data.js, design-v3/camera/clock.js, camera.js and camera-notes.md. race-source.json is the race/path/stop subset extracted with Node vm, without changing coordinates or schedules. route.geojson is copied from the read-only Ghost line/web/public/data/route.geojson. The rendered historical path is DATA.historical, the selected race segment; full route retained for audit.

## OSM acquisition
{
  "retrieved_utc": "2026-11-23T00:29:43.731669+00:00",
  "endpoint": "https://overpass-api.de/api/interpreter",
  "bbox_s_w_n_e": [
    39.27979811594946,
    -76.6027811617259,
    39.30881988405054,
    -76.5905517382741
  ],
  "padding_m": 400,
  "sha256": "82145b0d4b260988a8419377bda7c9bfdcfc4dfa1ea40f87c8bb9d24e4d30b96",
  "elements": 9274
}

Exact request: overpass-query.txt; immutable response: osm.json. Copyright OpenStreetMap contributors, ODbL, https://www.openstreetmap.org/copyright . Current buildings and streets, not a reconstruction of 1938. Polygon coordinates are never randomized. Relation rings are stitched and rendered with curve fill for courtyard holes. Ground is a neutral stage. Street width is illustrative (2/4/8/12 m by OSM road class); centerline geometry is OSM. Coastline is preserved as a polyline; open coastline is not closed with invented land/water.

## Building height counts
{
  "height": 30,
  "building:levels \u00d7 3.2 m": 339,
  "fallback 6 m": 5753
}

Only positive parseable height tags take precedence, then positive levels × 3.2, then exactly 6 m. Footprints are extruded without facade or footprint invention.

## Projection
Equirectangular metres, centre longitude -76.59666645, latitude 39.294309; 111195 m/degree latitude and cosine correction for longitude. Route bounds plus 400 m in all directions.

## Schedule
10:00 weekday row, source service date Nov 4, 2026. Trolley 10:06–10:15. Bus 10:32:43–10:41:00, trip 4110804. Walk 2.258 and 4.156 min. Finish 10:45:09.36. Rounded displayed margin 30 min. The GTFS path endpoints and stop coordinates differ; vehicles retain the former and the walking estimates retain the latter. Boarding/alighting is an illustrative transition, with no invented connecting vehicle path.

Omissions: []
