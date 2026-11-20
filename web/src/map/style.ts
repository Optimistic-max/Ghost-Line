// The map's style in palette B (design 12.2, R11.1, screen-brief 3A.3). The
// OpenFreeMap dark style arrives at run time; this keeps its background and its
// vector source and hides its own layers, then draws from that source only what
// the design wants: streets as hairlines (main roads brighter and about twice
// as thick), no fills, no shoreline, and on desktop the street names off the
// route and the water names in --muted at 80% opacity or more. Over them, the
// 1938 line from route.geojson: a blurred copy, the bright line and the dashed
// inferred stretch; then its street names and the corner names in the display
// face from the bundled font file, at the places the route drawing gives them
// (the map fits the same bounds with the same padding). Colours come from the
// page's tokens; no colour is typed here.
import type { TransformStyleFunction } from 'maplibre-gl';
import { MAP_LAYOUT } from '../config';
import type { Route } from '../data/types';
import type { Layout } from '../view/vehicles';
import type { DrawingPlan } from './routedrawing';

/** The palette-B tokens the map uses, read from tokens.css on the page. */
export type Palette = { night: string; street: string; street2: string; muted: string; ghost: string; ink: string };

export const PALETTE_TOKENS: Record<keyof Palette, string> = {
  night: '--night',
  street: '--street',
  street2: '--street2',
  muted: '--muted',
  ghost: '--ghost',
  ink: '--ink',
};

/** The display face, declared for the map from the bundled font file (the style's font-faces). */
export const ROUTE_FONT = 'Barlow Condensed 600';

/** OpenMapTiles road classes: main roads, and every residential and larger street (screen-brief 3A.3). */
const MAIN_ROADS = ['motorway', 'trunk', 'primary', 'secondary'];
const STREETS = [...MAIN_ROADS, 'tertiary', 'minor'];

export const ROUTE_SOURCE = 'ghost-route';
/** The route's street names and the corner names, as points where the route drawing sets them. */
export const NAMES_SOURCE = 'ghost-names';

export type StyleInput = {
  palette: Palette;
  layout: Layout;
  route: Route;
  /** The street and corner names for the pair on screen, placed by the route drawing's plan. */
  names: Pick<DrawingPlan, 'mapLabels' | 'mapNames'>;
  /** The bundled display font file's address (the page's preload); without it the names use the tiles' label font. */
  fontUrl: string | null;
};

/** A MapLibre style document (the package exports it only through the style transform's type). */
export type StyleSpecification = ReturnType<TransformStyleFunction>;
type Layer = StyleSpecification['layers'][number];
type SymbolLayer = Extract<Layer, { type: 'symbol' }>;

/** The text font of the base style's first label layer drawn from a source layer, so its glyphs exist on the tile host. */
function baseFont(base: StyleSpecification, sourceLayer: string): string[] | null {
  for (const layer of base.layers) {
    if (layer.type !== 'symbol' || layer['source-layer'] !== sourceLayer) continue;
    const font = layer.layout?.['text-font'];
    if (Array.isArray(font) && font.every((f) => typeof f === 'string')) return font as string[];
  }
  return null;
}

/** route.geojson as a source. */
function routeSource(route: Route): StyleSpecification['sources'][string] {
  return {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: route.features.map((f) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: { street: f.properties.street, method: f.properties.method },
      })),
    },
  };
}

/** The names as points: street names along the route ('street'), and corner names ('corner', chosen or not). */
export function namesData(names: StyleInput['names']): NamesData {
  return {
    type: 'FeatureCollection',
    features: [
      ...names.mapLabels.map((l) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: l.lonlat },
        properties: { kind: 'street', text: l.street, angle: l.angle, anchor: 'center', size: 0, chosen: false },
      })),
      ...names.mapNames.map((n) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: n.lonlat },
        properties: { kind: 'corner', text: n.text, angle: 0, anchor: n.anchor, size: n.size, chosen: n.chosen },
      })),
    ],
  };
}

export type NamesData = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { kind: string; text: string; angle: number; anchor: string; size: number; chosen: boolean };
  }[];
};

/** The base style recoloured to palette B, with the 1938 line over it. */
export function mapStyle(base: StyleSpecification, input: StyleInput): StyleSpecification {
  const { palette, layout, route, names, fontUrl } = input;
  const look = MAP_LAYOUT[layout];
  const vector = Object.entries(base.sources).find(([, s]) => s.type === 'vector')?.[0] ?? null;
  const routeStreets = [...new Set(route.features.map((f) => f.properties.street))];
  const nameFont = fontUrl ? [ROUTE_FONT] : baseFont(base, 'transportation_name');

  const backgrounds: Layer[] = base.layers
    .filter((l) => l.type === 'background')
    .map((l) => ({ id: l.id, type: 'background', paint: { 'background-color': palette.night, 'background-opacity': 1 } }));
  if (backgrounds.length === 0) backgrounds.push({ id: 'ghost-background', type: 'background', paint: { 'background-color': palette.night } });
  const hidden: Layer[] = base.layers
    .filter((l) => l.type !== 'background')
    .map((l) => ({ ...l, layout: { ...(l.layout ?? {}), visibility: 'none' } }) as Layer);

  const streets: Layer[] = vector
    ? [
        {
          id: 'ghost-streets',
          type: 'line',
          source: vector,
          'source-layer': 'transportation',
          filter: ['all', ['in', ['get', 'class'], ['literal', STREETS]], ['!=', ['get', 'brunnel'], 'tunnel']],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['match', ['get', 'class'], MAIN_ROADS, palette.street2, palette.street],
            'line-width': ['match', ['get', 'class'], MAIN_ROADS, look.lines.main, look.lines.street],
            'line-opacity': 1,
          },
        },
      ]
    : [];

  // Desktop only: street names off the route, and the water names, from the tiles (R11.1).
  const tileLabels: Layer[] = [];
  if (vector && layout === 'desktop') {
    const { size, opacity } = MAP_LAYOUT.desktop.tileLabels;
    const label = (id: string, sourceLayer: string, font: string[], filter: SymbolLayer['filter'], placement: 'line' | 'point'): SymbolLayer => ({
      id,
      type: 'symbol',
      source: vector,
      'source-layer': sourceLayer,
      filter,
      layout: { 'symbol-placement': placement, 'text-field': ['get', 'name'], 'text-font': font, 'text-size': size },
      paint: { 'text-color': palette.muted, 'text-opacity': opacity, 'text-halo-color': palette.night, 'text-halo-width': 1 },
    });
    const streetFont = baseFont(base, 'transportation_name');
    if (streetFont) {
      tileLabels.push(
        label(
          'ghost-street-names',
          'transportation_name',
          streetFont,
          ['all', ['in', ['get', 'class'], ['literal', MAIN_ROADS]], ['!', ['in', ['get', 'name'], ['literal', routeStreets]]]],
          'line',
        ),
      );
    }
    const waterFont = baseFont(base, 'water_name');
    if (waterFont) tileLabels.push(label('ghost-water-names', 'water_name', waterFont, ['has', 'name'], 'point'));
  }

  const routeLayers: Layer[] = [
    {
      id: 'ghost-route-glow',
      type: 'line',
      source: ROUTE_SOURCE,
      filter: ['!=', ['get', 'method'], 'inferred'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': palette.ghost, 'line-width': look.lines.glow, 'line-blur': look.lines.glow, 'line-opacity': 0.55 },
    },
    {
      id: 'ghost-route',
      type: 'line',
      source: ROUTE_SOURCE,
      filter: ['!=', ['get', 'method'], 'inferred'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': palette.ghost, 'line-width': look.lines.route },
    },
    {
      id: 'ghost-route-inferred',
      type: 'line',
      source: ROUTE_SOURCE,
      filter: ['==', ['get', 'method'], 'inferred'],
      paint: { 'line-color': palette.ghost, 'line-width': look.lines.inferred, 'line-dasharray': [2, 1.6] },
    },
  ];

  // The names go where the route drawing sets them: street names in --ghost along their legs, corner names
  // beside their dots (the dots are DOM markers, map.ts). Always shown: the drawing has already made room.
  const nameLayers: Layer[] = nameFont
    ? [
        {
          id: 'ghost-route-names',
          type: 'symbol',
          source: NAMES_SOURCE,
          filter: ['==', ['get', 'kind'], 'street'],
          layout: {
            'text-field': ['get', 'text'],
            'text-font': nameFont,
            'text-size': look.streetFont,
            'text-rotate': ['get', 'angle'],
            'text-rotation-alignment': 'map',
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: { 'text-color': palette.ghost, 'text-opacity': 1, 'text-halo-color': palette.night, 'text-halo-width': 1.5 },
        },
        {
          id: 'ghost-corner-names',
          type: 'symbol',
          source: NAMES_SOURCE,
          filter: ['==', ['get', 'kind'], 'corner'],
          layout: {
            'text-field': ['get', 'text'],
            'text-font': nameFont,
            'text-size': ['get', 'size'],
            'text-anchor': ['match', ['get', 'anchor'], 'left', 'left', 'right', 'right', 'center'],
            // One line, as in the drawing (MapLibre otherwise wraps names past 10 ems).
            'text-max-width': 100,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': ['case', ['get', 'chosen'], palette.ink, palette.muted],
            'text-opacity': 1,
            'text-halo-color': palette.night,
            'text-halo-width': 1.5,
          },
        },
      ]
    : [];

  const { sprite: _sprite, ...rest } = base;
  return {
    ...rest,
    ...(fontUrl ? { 'font-faces': { ...(base['font-faces'] ?? {}), [ROUTE_FONT]: fontUrl } } : {}),
    sources: {
      ...base.sources,
      [ROUTE_SOURCE]: routeSource(route),
      [NAMES_SOURCE]: { type: 'geojson', data: namesData(names) },
    },
    layers: [...backgrounds, ...hidden, ...streets, ...tileLabels, ...routeLayers, ...nameLayers],
  };
}

