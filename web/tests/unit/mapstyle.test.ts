// Task 17.4: the map's style in palette B (design 12.2, R11.1, R11.3). The base
// style here is made up, in the shape of the OpenMapTiles styles the tile host
// serves; the real one is requested only by the page at run time.
import { describe, expect, it } from 'vitest';
import { LEAD_PAIR, MAP_LAYOUT } from '../../src/config';
import { planDrawing } from '../../src/map/routedrawing';
import {
  NAMES_SOURCE,
  PALETTE_TOKENS,
  type Palette,
  ROUTE_FONT,
  ROUTE_SOURCE,
  type StyleSpecification,
  STRETCH_SOURCE,
  mapStyle,
  stretchData,
} from '../../src/map/style';
import type { Layout } from '../../src/view/vehicles';
import { tokenBlocks } from '../support/css';
import { realData } from '../support/realdata';

const { phone: tokens } = tokenBlocks();
const palette = Object.fromEntries(Object.entries(PALETTE_TOKENS).map(([k, token]) => [k, tokens.get(token)!])) as Palette;
const { index, route } = realData();
const lead = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
const planFor = (layout: Layout) => planDrawing({ index, route, pair: lead, layout });
const FONT = '/Ghost-Line/assets/fake-font.woff2';

const BASE = {
  version: 8,
  sources: { fakevector: { type: 'vector', url: 'fake-tilejson' } },
  sprite: 'fake-sprite',
  glyphs: 'fake-glyphs/{fontstack}/{range}.pbf',
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#000000' } },
    { id: 'water', type: 'fill', source: 'fakevector', 'source-layer': 'water', paint: { 'fill-color': '#112233' } },
    { id: 'building', type: 'fill', source: 'fakevector', 'source-layer': 'building', paint: { 'fill-color': '#223344' } },
    { id: 'road-casing', type: 'line', source: 'fakevector', 'source-layer': 'transportation', paint: { 'line-color': '#333333', 'line-width': 6 } },
    { id: 'road', type: 'line', source: 'fakevector', 'source-layer': 'transportation', paint: { 'line-color': '#444444' } },
    { id: 'waterway', type: 'line', source: 'fakevector', 'source-layer': 'waterway', paint: { 'line-color': '#0000ff' } },
    {
      id: 'road-label',
      type: 'symbol',
      source: 'fakevector',
      'source-layer': 'transportation_name',
      layout: { 'text-field': '{name}', 'text-font': ['Fake Sans Regular'] },
      paint: { 'text-opacity': 0.4, 'text-color': '#999999' },
    },
    { id: 'water-label', type: 'symbol', source: 'fakevector', 'source-layer': 'water_name', layout: { 'text-field': '{name}', 'text-font': ['Fake Sans Italic'] } },
    { id: 'place-label', type: 'symbol', source: 'fakevector', 'source-layer': 'place', layout: { 'text-field': '{name}', 'text-font': ['Fake Sans Bold'] } },
  ],
} as unknown as StyleSpecification;

type AnyLayer = StyleSpecification['layers'][number] & { paint?: Record<string, unknown>; layout?: Record<string, unknown>; filter?: unknown };

const styleFor = (layout: Layout, fontUrl: string | null = FONT): StyleSpecification =>
  mapStyle(structuredClone(BASE), { palette, layout, route, names: planFor(layout), fontUrl });
const visible = (style: StyleSpecification): AnyLayer[] => (style.layers as AnyLayer[]).filter((l) => l.layout?.['visibility'] !== 'none');

/** Every colour string in a paint value, expressions included. */
function colours(value: unknown): string[] {
  if (typeof value === 'string') return /^#[0-9a-f]{6}$/i.test(value) ? [value.toLowerCase()] : [];
  if (Array.isArray(value)) return value.flatMap(colours);
  return [];
}

function paintColours(style: StyleSpecification): string[] {
  return visible(style).flatMap((l) => Object.entries(l.paint ?? {}).filter(([k]) => k.endsWith('-color')).flatMap(([, v]) => colours(v)));
}

describe('the map style in palette B', () => {
  it('reads every palette colour from tokens.css', () => {
    for (const [key, token] of Object.entries(PALETTE_TOKENS)) expect(tokens.get(token), `${key} ${token}`).toMatch(/^#[0-9a-f]{6}$/i);
  });

  for (const layout of ['phone', 'desktop'] as const) {
    it(`uses every palette-B colour of the map, and no other colour (${layout})`, () => {
      const used = new Set(paintColours(styleFor(layout)));
      const allowed = new Set(Object.values(palette).map((c) => c.toLowerCase()));
      for (const c of used) expect(allowed.has(c), c).toBe(true);
      for (const [key, c] of Object.entries(palette)) expect(used.has(c.toLowerCase()), key).toBe(true);
    });
  }

  it('paints the background --night and hides every other layer of the base style', () => {
    const style = styleFor('desktop');
    const byId = new Map((style.layers as AnyLayer[]).map((l) => [l.id, l]));
    expect(byId.get('background')?.paint?.['background-color']).toBe(palette.night);
    for (const id of ['water', 'building', 'road-casing', 'road', 'waterway', 'road-label', 'water-label', 'place-label']) {
      expect(byId.get(id)?.layout?.['visibility'], id).toBe('none');
    }
  });

  it('draws no fill and no shoreline: the harbour is the area with no streets', () => {
    for (const layout of ['phone', 'desktop'] as const) {
      const shown = visible(styleFor(layout));
      expect(shown.filter((l) => l.type === 'fill' || l.type === 'fill-extrusion'), layout).toEqual([]);
      expect(shown.filter((l) => (l as { 'source-layer'?: string })['source-layer'] === 'waterway'), layout).toEqual([]);
    }
  });

  it('keeps no label below 80% opacity', () => {
    for (const layout of ['phone', 'desktop'] as const) {
      const labels = visible(styleFor(layout)).filter((l) => l.type === 'symbol');
      expect(labels.length, layout).toBeGreaterThan(0);
      for (const l of labels) {
        const opacity = l.paint?.['text-opacity'];
        expect(typeof opacity, l.id).toBe('number');
        expect(opacity as number, l.id).toBeGreaterThanOrEqual(0.8);
      }
    }
  });

  it('names streets off the route and the water from the tiles on desktop only, never the route streets twice and no places', () => {
    const desktop = visible(styleFor('desktop')).filter((l) => l.type === 'symbol');
    const sourceLayers = desktop.map((l) => (l as { 'source-layer'?: string })['source-layer'] ?? l.id);
    expect(sourceLayers).toContain('transportation_name');
    expect(sourceLayers).toContain('water_name');
    expect(sourceLayers).not.toContain('place');
    const streetNames = desktop.find((l) => (l as { 'source-layer'?: string })['source-layer'] === 'transportation_name')!;
    expect(JSON.stringify(streetNames.filter)).toContain(JSON.stringify(route.features[0]!.properties.street));
    // Their glyphs come from the base style's own label fonts, which the tile host serves.
    expect(streetNames.layout?.['text-font']).toEqual(['Fake Sans Regular']);
    const phone = visible(styleFor('phone')).filter((l) => l.type === 'symbol');
    expect(phone.map((l) => l.id)).toEqual(['ghost-route-names', 'ghost-corner-names']);
  });

  it('draws streets as hairlines, main roads brighter and about twice as thick', () => {
    for (const layout of ['phone', 'desktop'] as const) {
      const streets = visible(styleFor(layout)).find((l) => l.id === 'ghost-streets')!;
      expect(JSON.stringify(streets.paint?.['line-color'])).toContain(palette.street2);
      const { street, main } = MAP_LAYOUT[layout].lines;
      expect(streets.paint?.['line-width']).toEqual(['match', ['get', 'class'], expect.any(Array), main, street]);
      expect(main / street).toBeGreaterThanOrEqual(1.8);
      expect(main / street).toBeLessThanOrEqual(2.2);
    }
  });

  it('draws the 1938 line over a blurred copy and dashes the inferred stretch', () => {
    const style = styleFor('desktop');
    const source = style.sources[ROUTE_SOURCE] as { type: string; data: { features: { properties: { street: string; method: string } }[] } };
    expect(source.type).toBe('geojson');
    expect(source.data.features.map((f) => f.properties)).toEqual(
      route.features.map((f) => ({ street: f.properties.street, method: f.properties.method })),
    );
    const ids = (style.layers as AnyLayer[]).map((l) => l.id).filter((id) => id !== 'ghost-stretch');
    expect(ids.slice(-5)).toEqual(['ghost-route-glow', 'ghost-route', 'ghost-route-inferred', 'ghost-route-names', 'ghost-corner-names']);
    const byId = new Map((style.layers as AnyLayer[]).map((l) => [l.id, l]));
    expect(byId.get('ghost-route-glow')?.paint?.['line-blur']).toBeGreaterThan(0);
    expect(byId.get('ghost-route')?.filter).toEqual(['!=', ['get', 'method'], 'inferred']);
    expect(byId.get('ghost-route-inferred')?.filter).toEqual(['==', ['get', 'method'], 'inferred']);
    expect(byId.get('ghost-route-inferred')?.paint?.['line-dasharray']).toBeDefined();
  });

  for (const layout of ['phone', 'desktop'] as const) {
    it(`sets the street and corner names where the route drawing sets them, in the display face (${layout})`, () => {
      const style = styleFor(layout);
      const plan = planFor(layout);
      type Named = { geometry: { coordinates: [number, number] }; properties: { kind: string; text: string; chosen: boolean } };
      const names = (style.sources[NAMES_SOURCE] as { data: { features: Named[] } }).data.features;
      const of = (kind: string) => names.filter((f) => f.properties.kind === kind);
      expect(of('street').map((f) => f.properties.text)).toEqual(plan.labels.map((l) => l.street));
      expect(of('street').map((f) => f.geometry.coordinates)).toEqual(plan.mapLabels.map((l) => l.lonlat));
      expect(of('corner').map((f) => f.properties.text)).toEqual(plan.names.map((n) => n.text));
      expect(of('corner')).toHaveLength(layout === 'desktop' ? index.corners.length : 2);
      const byId = new Map((style.layers as AnyLayer[]).map((l) => [l.id, l]));
      for (const id of ['ghost-route-names', 'ghost-corner-names']) {
        expect(byId.get(id)?.layout?.['text-font'], id).toEqual([ROUTE_FONT]);
        expect(byId.get(id)?.layout?.['text-field'], id).toEqual(['get', 'text']);
      }
      expect(JSON.stringify(byId.get('ghost-route-names')?.paint?.['text-color'])).toBe(JSON.stringify(palette.ghost));
      expect((style as { 'font-faces'?: Record<string, string> })['font-faces']?.[ROUTE_FONT]).toBe(FONT);
    });
  }

  it('without the font file, names the route in the tiles label font and declares no font file', () => {
    const style = styleFor('desktop', null);
    const names = (style.layers as AnyLayer[]).find((l) => l.id === 'ghost-route-names');
    expect(names?.layout?.['text-font']).toEqual(['Fake Sans Regular']);
    expect((style as { 'font-faces'?: unknown })['font-faces']).toBeUndefined();
  });

  it('on desktop draws the pair\'s stretch bright over dimmer route lines, with no label below 80% opacity; the phone is unchanged', () => {
    const plan = planDrawing({ index, route, pair: lead, layout: 'desktop', direction: 'eastbound' });
    expect(plan.track).not.toBeNull();
    const style = mapStyle(structuredClone(BASE), { palette, layout: 'desktop', route, names: plan, track: plan.track, fontUrl: FONT });
    const byId = new Map((style.layers as AnyLayer[]).map((l) => [l.id, l]));
    const ids = (style.layers as AnyLayer[]).map((l) => l.id);
    expect(ids.indexOf('ghost-stretch')).toBeGreaterThan(ids.indexOf('ghost-route-inferred'));
    const stretch = (style.sources[STRETCH_SOURCE] as { data: ReturnType<typeof stretchData> }).data;
    const line = stretch.features[0]!.geometry.coordinates;
    expect(line.length).toBeGreaterThanOrEqual(2);
    // From the origin corner's point to the destination corner's point (checkpoint 18), not where the marker stops.
    const cornerAt = (slug: string) => index.corners.find((c) => c.slug === slug)!.lonlat;
    expect(line[0]).toEqual([...cornerAt(lead.origin)]);
    expect(line.at(-1)).toEqual([...cornerAt(lead.dest)]);
    expect(byId.get('ghost-stretch')?.paint?.['line-opacity']).toBe(1);
    for (const id of ['ghost-route', 'ghost-route-inferred', 'ghost-route-glow']) {
      expect(byId.get(id)?.paint?.['line-opacity'] as number, id).toBeLessThan(1);
    }
    for (const l of visible(style).filter((x) => x.type === 'symbol')) expect(l.paint?.['text-opacity'] as number, l.id).toBeGreaterThanOrEqual(0.8);
    expect(stretchData(null).features).toEqual([]);
    const phone = styleFor('phone');
    expect((phone.layers as AnyLayer[]).some((l) => l.id === 'ghost-stretch')).toBe(false);
    expect(phone.sources[STRETCH_SOURCE]).toBeUndefined();
    expect((phone.layers as AnyLayer[]).find((l) => l.id === 'ghost-route')?.paint?.['line-opacity']).toBeUndefined();
  });

  it('asks for no sprite, since it draws no icons', () => {
    expect((styleFor('desktop') as { sprite?: unknown }).sprite).toBeUndefined();
  });
});
