// The route drawing (design 12.1, R11.4): an SVG of the 1938 line built from
// route.geojson and the corners in index.json only. It is the map area's
// placeholder while the map loads, and stays as the fallback when the map is
// unavailable: legs as paths (inferred legs dashed), street names along the legs,
// corner dots (origin filled, destination a ring, the inferred corner dashed)
// and corner names beside their dots (all five on desktop, the chosen two on a
// phone). Positions come from view/layout.ts; this module only arranges them.
import { MAP_LAYOUT } from '../config';
import { MAP_INFERRED } from '../copy/copy';
import type { Corner, Index, Pair, Route, RouteLeg } from '../data/types';
import {
  type Box,
  type Pt,
  type Size,
  bestPlace,
  dotBox,
  fitProjection,
  insideBox,
  labelSamples,
  linesMeet,
  namePlaces,
  readingChord,
  textWidth,
} from '../view/layout';
import type { Layout } from '../view/vehicles';

export type DrawingInput = {
  index: Index;
  route: Route;
  pair: Pair;
  layout: Layout;
  /** The map area's size in CSS pixels; the layout's design size when it has none (before layout, or in tests). */
  size?: Size;
};

export type RouteDrawing = {
  svg: SVGSVGElement;
  /** The street names set along the route. */
  streets: string[];
  /** The corners named, by slug. */
  named: string[];
};

type Role = 'origin' | 'dest' | 'other';

/** The id of the blur behind the route, and the prefix of the lines street names are set on. */
const GLOW_ID = 'route-glow-blur';
const LABEL_ID = 'route-label';

/** Every coordinate the drawing shows: the legs and the corners. */
export function drawingPoints(index: Index, route: Route): number[][] {
  return [...route.features.flatMap((f) => f.geometry.coordinates), ...index.corners.map((c) => [...c.lonlat])];
}

function roleOf(corner: Corner, pair: Pair): Role {
  if (corner.slug === pair.origin) return 'origin';
  if (corner.slug === pair.dest) return 'dest';
  return 'other';
}

/** A corner's name on the map: "(inferred)" follows the inferred corner's name (R11.2). */
export function mapName(corner: Corner): string {
  return corner.inferred ? `${corner.name} ${MAP_INFERRED}` : corner.name;
}

const fixed = (n: number): string => n.toFixed(1);

function pathData(points: readonly Pt[]): string {
  return `M ${points.map((p) => `${fixed(p.x)} ${fixed(p.y)}`).join(' L ')}`;
}

/** The same line drawn from its west end, so the dashes of the two directions of a stretch fall together. */
function fromWest(points: Pt[]): Pt[] {
  const first = points[0];
  const last = points.at(-1);
  return first && last && last.x < first.x ? [...points].reverse() : points;
}

/** For each street name, the longest leg that carries it, in file order of first appearance. */
function legPerStreet(features: readonly RouteLeg[]): { leg: RouteLeg; at: number }[] {
  const chosen = new Map<string, { leg: RouteLeg; at: number }>();
  features.forEach((leg, at) => {
    const best = chosen.get(leg.properties.street);
    if (!best || leg.properties.length_m > best.leg.properties.length_m) chosen.set(leg.properties.street, { leg, at });
  });
  return [...chosen.values()];
}

export function routeDrawing(doc: Document, input: DrawingInput): RouteDrawing {
  const { index, route, pair, layout } = input;
  const look = MAP_LAYOUT[layout];
  const size = input.size ?? look.size;
  const view: Box = { x: 0, y: 0, width: size.width, height: size.height };
  const project = fitProjection(drawingPoints(index, route), size, look.padding);

  const legs = route.features.map((f) => fromWest(f.geometry.coordinates.map(project)));
  const dots = index.corners.map((corner) => {
    const role = roleOf(corner, pair);
    const radius = role === 'other' ? look.dot.other : look.dot.chosen;
    const at = project(corner.lonlat);
    return { corner, role, radius, at, box: dotBox(at, radius) };
  });

  // Corner names: the chosen two first, so they get the best places; on a phone only they are named.
  const toName = [...dots.filter((d) => d.role !== 'other'), ...(layout === 'desktop' ? dots.filter((d) => d.role === 'other') : [])];
  const nameBoxes: Box[] = [];
  const names = toName.map((d) => {
    const text = mapName(d.corner);
    const font = d.role === 'other' ? look.otherNameFont : look.nameFont;
    const width = textWidth(text, font, MAP_LAYOUT.glyphEm);
    const others = dots.filter((o) => o !== d).map((o) => o.box);
    const place = bestPlace(namePlaces(d.at, d.radius, width, font, MAP_LAYOUT.gap), { lines: legs, boxes: [...nameBoxes, ...others], view }, 2);
    nameBoxes.push(place.box);
    return { d, text, font, place };
  });

  // Street names: one per street, on its longest leg, where the name fits along the leg and clears the corners.
  // With the inferred corner chosen on a phone, the streets that meet the inferred stretch make room for its name (R11.2).
  const crowded = layout === 'phone' && dots.some((d) => d.corner.inferred && d.role !== 'other');
  const inferredLegs = legs.filter((_, k) => route.features[k]?.properties.method === 'inferred');
  const meetsInferred = new Set(
    route.features
      .filter((_, k) => inferredLegs.some((other) => linesMeet(legs[k] ?? [], other, MAP_LAYOUT.meet)))
      .map((f) => f.properties.street),
  );
  const blocked = [...nameBoxes, ...dots.map((d) => d.box)];
  const labels = legPerStreet(route.features).flatMap(({ leg, at }) => {
    const street = leg.properties.street;
    const points = legs[at] ?? [];
    const chord = readingChord(points, MAP_LAYOUT.gap);
    const width = textWidth(street, look.streetFont, MAP_LAYOUT.glyphEm);
    if (chord.length < width) return [];
    if (crowded && meetsInferred.has(street)) return [];
    if (labelSamples(chord, width, look.streetFont).some((p) => !insideBox(p, view) || blocked.some((b) => insideBox(p, b, 1)))) return [];
    return [{ street, chord }];
  });

  const svg = svgRoot(doc, size);
  const defs = add(svg, 'defs');
  const blur = add(defs, 'filter', { id: GLOW_ID, x: '-20%', y: '-20%', width: '140%', height: '140%' });
  add(blur, 'feGaussianBlur', { stdDeviation: '3' });

  // A blurred copy beneath the bright line; the inferred stretch is dashed and has none.
  const glow = add(svg, 'g', { class: 'route-glow', filter: `url(#${GLOW_ID})` });
  const lines = add(svg, 'g', { class: 'route-legs' });
  route.features.forEach((leg, k) => {
    const d = pathData(legs[k] ?? []);
    const inferred = leg.properties.method === 'inferred';
    if (!inferred) add(glow, 'path', { class: 'leg-glow', d });
    add(lines, 'path', {
      class: inferred ? 'leg leg-inferred' : 'leg',
      d,
      'data-street': leg.properties.street,
      'data-method': leg.properties.method,
      'data-direction': leg.properties.direction,
    });
  });

  const streetNames = add(svg, 'g', { class: 'street-labels' });
  labels.forEach(({ street, chord }, k) => {
    const id = `${LABEL_ID}-${k}`;
    add(defs, 'path', { id, d: pathData([chord.from, chord.to]) });
    const text = add(streetNames, 'text', { class: 'street-label', 'font-size': String(look.streetFont) });
    add(text, 'textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' }).textContent = street;
  });

  const corners = add(svg, 'g', { class: 'corners' });
  for (const d of dots) {
    const classes = ['corner-dot', `is-${d.role}`, d.corner.inferred ? 'is-inferred' : ''].filter(Boolean).join(' ');
    const group = add(corners, 'g', { class: 'corner', 'data-slug': d.corner.slug });
    add(group, 'circle', { class: classes, cx: fixed(d.at.x), cy: fixed(d.at.y), r: String(d.radius) });
  }
  const cornerNames = add(svg, 'g', { class: 'corner-names' });
  for (const { d, text, font, place } of names) {
    add(cornerNames, 'text', {
      class: d.role === 'other' ? 'corner-name' : 'corner-name is-chosen',
      'data-slug': d.corner.slug,
      x: fixed(place.x),
      y: fixed(place.y),
      'text-anchor': place.anchor,
      'font-size': String(font),
    }).textContent = text;
  }

  return { svg, streets: labels.map((l) => l.street), named: names.map((n) => n.d.corner.slug) };
}

/** The drawing's root, parsed as HTML so it takes the SVG namespace without naming it. Decorative: the pair is named on the card. */
function svgRoot(doc: Document, size: Size): SVGSVGElement {
  const template = doc.createElement('template');
  template.innerHTML = '<svg class="route-drawing" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"></svg>';
  const svg = template.content.firstElementChild as SVGSVGElement;
  svg.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
  return svg;
}

function add(parent: Element, tag: string, attrs: Record<string, string> = {}): SVGElement {
  const el = parent.ownerDocument.createElementNS(parent.namespaceURI, tag) as SVGElement;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  parent.appendChild(el);
  return el;
}
