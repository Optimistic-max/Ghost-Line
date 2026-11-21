// The route drawing (design 12.1, R11.4): an SVG of the 1938 line built from
// route.geojson and the corners in index.json only. It is the map area's
// placeholder while the map loads, and stays as the fallback when the map is
// unavailable: legs as paths (inferred legs dashed), street names along the legs,
// corner dots (origin filled, destination a ring, the inferred corner dashed)
// and corner names beside their dots (all five on desktop, the chosen two on a
// phone). The plan (projection, name places, legs to name) is shared with the
// map, which places its corner names the same way. Positions come from
// view/layout.ts; this module only arranges them.
import { MAP_LAYOUT } from '../config';
import { MAP_INFERRED } from '../copy/copy';
import type { Corner, Index, Pair, RaceFile, Route, RouteLeg } from '../data/types';
import {
  type Box,
  type Chord,
  type NamePlace,
  type Pt,
  type StripRule,
  buttonColumn,
  stripPlace,
  usableView,
  type Size,
  type Track,
  alongPercent,
  alongSpots,
  apartFrom,
  bestPlace,
  dotBox,
  fitProjection,
  glyphRows,
  insideBox,
  labelAnchor,
  labelSamples,
  linesMeet,
  markerBox,
  markerTrack,
  lineProximity,
  nameAnchor,
  nameOffsets,
  namePlaces,
  readingChord,
  textWidth,
  trackPoint,
} from '../view/layout';
import { type Layout, vehicleWidths } from '../view/vehicles';

export type DrawingInput = {
  index: Index;
  route: Route;
  pair: Pair;
  layout: Layout;
  /** The map area's size in CSS pixels; the layout's design size when it has none (before layout, or in tests). */
  size?: Size;
  /** The race file's direction, once it is in: it gives the trolley marker's track. */
  direction?: RaceFile['direction'] | null;
  /**
   * The phone's collapsed route preview (story-layer Req 12.3): the 100 px strip, the chosen two corners named,
   * no street names. Only meaningful on the phone layout.
   */
  preview?: boolean;
};

export type Role = 'origin' | 'dest' | 'other';

export type PlannedDot = { corner: Corner; role: Role; radius: number; at: Pt; box: Box };
export type PlannedName = { dot: PlannedDot; text: string; font: number; place: NamePlace };

export type DrawingPlan = {
  size: Size;
  project: (lonlat: readonly number[]) => Pt;
  pxPerMetre: number;
  /** Each leg's points, from its west end. */
  legs: Pt[][];
  dots: PlannedDot[];
  names: PlannedName[];
  /**
   * The street names the drawing sets, each on the line it is set along, centred at the share `along` of it.
   * `offset` is how far that line lies from the street's own leg, to the side the letters stand on (negative:
   * the other side); the usual offset is MAP_LAYOUT.gap, and another means the name was moved out of the marker's way.
   */
  labels: { street: string; from: Pt; to: Pt; along: number; offset: number }[];
  /** The trolley marker's track for the race's direction, or null before its race file is in. */
  track: Track | null;
  /** The boxes the trolley marker covers where it stands: at the origin, and short of the destination. */
  markerBoxes: Box[];
  /** The same street names for the map: the [lon, lat] of each one's centre, and its angle in degrees clockwise. */
  mapLabels: MapLabel[];
  /** The corner names for the map: where each hangs from, on which side, at which size. */
  mapNames: MapName[];
};

export type MapLabel = { street: string; lonlat: [number, number]; angle: number };
export type MapName = { text: string; lonlat: [number, number]; anchor: 'left' | 'center' | 'right'; size: number; chosen: boolean };

export type RouteDrawing = {
  svg: SVGSVGElement;
  plan: DrawingPlan;
  /** The street names set along the route. */
  streets: string[];
  /** The corners named, by slug. */
  named: string[];
};

/** The id of the blur behind the route, and the prefix of the lines street names are set on. */
const GLOW_ID = 'route-glow-blur';
const LABEL_ID = 'route-label';

/** The phone strip's corner names follow the map's street-name rule for the marker, with its numbers. */
const STRIP_RULE: StripRule = {
  gap: MAP_LAYOUT.gap,
  maxOffset: MAP_LAYOUT.labelMaxOffset,
  offsetStep: MAP_LAYOUT.labelOffsetStep,
  slideStep: MAP_LAYOUT.labelOffsetAlongStep,
  markerRoom: MAP_LAYOUT.markerRoom,
  reach: MAP_LAYOUT.phonePreview.nameReach,
  glyphBox: MAP_LAYOUT.glyphBox,
};

/** Every coordinate the drawing shows: the legs and the corners. The map fits the same bounds. */
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

/** Where everything goes, for a pair on a layout. */
export function planDrawing(input: DrawingInput): DrawingPlan {
  const { index, route, pair, layout } = input;
  const look = MAP_LAYOUT[layout];
  const preview = input.preview === true && layout === 'phone';
  const frame = preview ? MAP_LAYOUT.phonePreview : look;
  const size = input.size ?? frame.size;
  // On the strip the right-hand column belongs to the View route button, and the card's top covers the foot.
  const view: Box = preview
    ? usableView(size, buttonColumn(MAP_LAYOUT.phonePreview.button), MAP_LAYOUT.phonePreview.cardOverlap)
    : usableView(size, 0, 0);
  const { project, unproject, pxPerMetre } = fitProjection(drawingPoints(index, route), size, frame.padding);

  const legs = route.features.map((f) => fromWest(f.geometry.coordinates.map(project)));
  const dots = index.corners.map((corner): PlannedDot => {
    const role = roleOf(corner, pair);
    const radius = role === 'other' ? look.dot.other : look.dot.chosen;
    const at = project(corner.lonlat);
    return { corner, role, radius, at, box: dotBox(at, radius) };
  });

  // The trolley marker stands at the origin before the ride and short of the destination after it (R5.9), on the
  // track of the race's direction.
  const track = markerTrackFor(input, pxPerMetre);
  const markerWidth = vehicleWidths(layout).marker;
  const markerBoxes = track ? [trackPoint(track, 0), trackPoint(track, 1)].map((p) => markerBox(project(p), markerWidth)) : [];

  // Corner names: the chosen two first, so they get the best places; on a phone only they are named.
  const toName = [...dots.filter((d) => d.role !== 'other'), ...(layout === 'desktop' ? dots.filter((d) => d.role === 'other') : [])];
  const nameBoxes: Box[] = [];
  const names = toName.flatMap((dot): PlannedName[] => {
    const text = mapName(dot.corner);
    const font = dot.role === 'other' ? look.otherNameFont : look.nameFont;
    const width = textWidth(text, font, MAP_LAYOUT.glyphEm);
    const others = dots.filter((o) => o !== dot).map((o) => o.box);
    // On the strip a corner name also keeps off the boxes the standing trolley marker covers, as the street names
    // do on the map. (The map's own corner names keep their places: Caroline Street's place depends on them.)
    // A strip name that cannot sit next to its own dot is hidden (the pair row names both corners).
    const place = preview
      ? stripPlace(dot, dots.filter((o) => o !== dot).map((o) => o.at), width, font, { lines: legs, boxes: [...nameBoxes, ...others], view }, markerBoxes, STRIP_RULE)
      : bestPlace(namePlaces(dot.at, dot.radius, width, font, MAP_LAYOUT.gap), { lines: legs, boxes: [...nameBoxes, ...others], view }, 2);
    if (!place) return [];
    nameBoxes.push(place.box);
    return [{ dot, text, font, place }];
  });

  // Street names: one per street, on its longest leg; the dashed stretch carries none (mockups 07, 26). With the
  // inferred corner chosen on a phone, the streets that meet the inferred stretch make room for its name (R11.2).
  const crowded = layout === 'phone' && dots.some((d) => d.corner.inferred && d.role !== 'other');
  const inferredLegs = legs.filter((_, k) => route.features[k]?.properties.method === 'inferred');
  const meetsInferred = new Set(
    route.features
      .filter((_, k) => inferredLegs.some((other) => linesMeet(legs[k] ?? [], other, MAP_LAYOUT.meet)))
      .map((f) => f.properties.street),
  );
  const named = legPerStreet(route.features).filter(
    ({ leg }) => !preview && leg.properties.method !== 'inferred' && !(crowded && meetsInferred.has(leg.properties.street)),
  );

  // The drawing sets a name only where it fits along its leg and clears the corners and the edges. Where the
  // standing trolley marker would cover it, the name first moves along its leg; if no place along it is clear,
  // it moves out from its leg, to the side that clears, a pixel at a time; and it is left out only when nothing fits
  // (Emmanuel, Nov 20). A name moved out also keeps off the route's other lines and the names already set.
  const blocked = [...nameBoxes, ...dots.map((d) => d.box)];
  const font = look.streetFont;
  const offsets = nameOffsets(font, MAP_LAYOUT.gap, MAP_LAYOUT.labelMaxOffset, MAP_LAYOUT.labelOffsetStep);
  const placed: Pt[] = [];
  const nearRoute = lineProximity(legs, MAP_LAYOUT.lineRoom);
  const labels = named.flatMap(({ leg, at }) => {
    const street = leg.properties.street;
    const width = textWidth(street, font, MAP_LAYOUT.glyphEm);
    const base = readingChord(legs[at] ?? [], MAP_LAYOUT.gap);
    if (base.length < width) return [];
    /**
     * Whether the name set on `chord` at `along` is clear; `outside` adds the checks for a name moved out.
     * The markers are kept off the name's whole glyph boxes, which stand higher and lower than its ink.
     */
    const clear = (chord: Chord, along: number, markers: readonly Box[], outside: boolean): boolean =>
      labelSamples(chord, width, font, along).every(
        (p) => insideBox(p, view) && !blocked.some((b) => insideBox(p, b, 1)) && (!outside || (apartFrom(p, placed, MAP_LAYOUT.labelRoom) && !nearRoute(p))),
      ) &&
      (markers.length === 0 ||
        labelSamples(chord, width, font, along, glyphRows(MAP_LAYOUT.glyphBox)).every(
          (p) => !markers.some((b) => insideBox(p, b, MAP_LAYOUT.markerRoom)),
        ));
    const set = (chord: Chord, along: number, offset: number): { street: string; from: Pt; to: Pt; along: number; offset: number }[] => {
      placed.push(...labelSamples(chord, width, font, along));
      return [{ street, from: chord.from, to: chord.to, along, offset }];
    };
    if (!clear(base, 0.5, [], false)) return [];
    const along = alongSpots(base, width, MAP_LAYOUT.labelStep).find((spot) => clear(base, spot, markerBoxes, false));
    if (along !== undefined) return set(base, along, MAP_LAYOUT.gap);
    // Beside the leg: the text's near edge `d` pixels from the line, on its usual side and then the other, nearest first.
    for (const offset of offsets) {
      const chord = readingChord(legs[at] ?? [], offset);
      const spot = alongSpots(chord, width, MAP_LAYOUT.labelOffsetAlongStep).find((s) => clear(chord, s, markerBoxes, true));
      if (spot !== undefined) return set(chord, spot, offset);
    }
    return [];
  });

  // The map fits the same bounds with the same padding, so its names go where the drawing's do.
  const mapLabels = labels.map(({ street, from, to, along }): MapLabel => {
    const { at, angle } = labelAnchor(from, to, look.streetFont, along);
    return { street, lonlat: unproject(at), angle };
  });
  const mapNames = names.map(({ dot, text, font, place }): MapName => {
    const { at, anchor } = nameAnchor(place);
    return { text, lonlat: unproject(at), anchor, size: font, chosen: dot.role !== 'other' };
  });

  return { size, project, pxPerMetre, legs, dots, names, labels, track, markerBoxes, mapLabels, mapNames };
}

/** The trolley marker's track: the legs of the race's direction in travel order, from the origin to short of the destination. */
function markerTrackFor(input: DrawingInput, pxPerMetre: number): Track | null {
  const { index, route, pair, layout, direction } = input;
  const origin = index.corners.find((c) => c.slug === pair.origin)?.lonlat;
  const dest = index.corners.find((c) => c.slug === pair.dest)?.lonlat;
  if (!direction || !origin || !dest) return null;
  const legs = route.features.filter((f) => f.properties.direction === direction).map((f) => f.geometry.coordinates);
  return markerTrack(legs, origin, dest, MAP_LAYOUT[layout].markerStop, pxPerMetre);
}

export function routeDrawing(doc: Document, input: DrawingInput): RouteDrawing {
  const plan = planDrawing(input);
  const { route, layout } = input;
  const look = MAP_LAYOUT[layout];

  const svg = svgRoot(doc, plan.size);
  const defs = add(svg, 'defs');
  const blur = add(defs, 'filter', { id: GLOW_ID, x: '-20%', y: '-20%', width: '140%', height: '140%' });
  add(blur, 'feGaussianBlur', { stdDeviation: '3' });

  // A blurred copy beneath the bright line; the inferred stretch is dashed and has none.
  const glow = add(svg, 'g', { class: 'route-glow', filter: `url(#${GLOW_ID})` });
  const lines = add(svg, 'g', { class: 'route-legs' });
  route.features.forEach((leg, k) => {
    const d = pathData(plan.legs[k] ?? []);
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
  plan.labels.forEach(({ street, from, to, along }, k) => {
    const id = `${LABEL_ID}-${k}`;
    add(defs, 'path', { id, d: pathData([from, to]) });
    const text = add(streetNames, 'text', { class: 'street-label', 'font-size': String(look.streetFont) });
    add(text, 'textPath', { href: `#${id}`, startOffset: alongPercent(along), 'text-anchor': 'middle' }).textContent = street;
  });

  // Each dot sits in a 44 px target: a tap or click on it feeds the corner picker (design 12.4).
  const corners = add(svg, 'g', { class: 'corners' });
  for (const d of plan.dots) {
    const classes = ['corner-dot', `is-${d.role}`, d.corner.inferred ? 'is-inferred' : ''].filter(Boolean).join(' ');
    const group = add(corners, 'g', { class: 'corner', 'data-action': 'map-corner', 'data-slug': d.corner.slug });
    add(group, 'circle', { class: 'corner-hit', cx: fixed(d.at.x), cy: fixed(d.at.y), r: String(MAP_LAYOUT.hit) });
    add(group, 'circle', { class: classes, cx: fixed(d.at.x), cy: fixed(d.at.y), r: String(d.radius) });
  }
  const cornerNames = add(svg, 'g', { class: 'corner-names' });
  for (const { dot, text, font, place } of plan.names) {
    add(cornerNames, 'text', {
      class: dot.role === 'other' ? 'corner-name' : 'corner-name is-chosen',
      'data-slug': dot.corner.slug,
      x: fixed(place.x),
      y: fixed(place.y),
      'text-anchor': place.anchor,
      'font-size': String(font),
    }).textContent = text;
  }

  return { svg, plan, streets: plan.labels.map((l) => l.street), named: plan.names.map((n) => n.dot.corner.slug) };
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
