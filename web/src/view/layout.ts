// Layout (design 13.3, P-B 2): bar widths on one shared time scale, so the longer
// trip is visibly longer, and positions in the map area (design 12.1, 12.2).
// Allowed arithmetic: fractions of the longer stored total, and geometry of the
// route's own coordinates. Nothing here reads a time or decides a result.
import type { Lane, RaceView } from '../state/model';

export type LaneLayout = {
  /** Each phase's share of the shared scale, in phase order. */
  widths: number[];
  /** Where the lane's bar ends, as a share of the scale. */
  end: number;
  /** Where the ride phase starts, as a share of the scale. */
  rideFrom: number;
  /** Where the ride phase ends, as a share of the scale: the vehicle's front edge after the ride. */
  park: number;
  /** The gaps between phases drawn before the ride, which also shift its start (card.css --seg-gap). */
  gapsBefore: number;
};

export type RaceLayout = { lane1938: LaneLayout; laneToday: LaneLayout | null };

function laneLayout(lane: Lane, longest: number): LaneLayout {
  const widths = lane.phases.map((p) => (longest > 0 ? p.stored / longest : 0));
  const rideIndex = Math.max(0, lane.phases.findIndex((p) => p.kind === 'ride'));
  const rideFrom = widths.slice(0, rideIndex).reduce((a, b) => a + b, 0);
  const park = rideFrom + (widths[rideIndex] ?? 0);
  const end = widths.reduce((a, b) => a + b, 0);
  return { widths, end, rideFrom, park, gapsBefore: rideIndex };
}

/**
 * Shrink an element's font until its one line of text fits its width, in half
 * pixels and never below `minPx` (the desktop pair names, R1.3). Without a
 * layout (jsdom) nothing is measured and nothing changes.
 */
export function fitOneLine(el: HTMLElement, minPx: number): void {
  el.style.removeProperty('font-size');
  for (let tries = 0; tries < 4 && el.scrollWidth > el.clientWidth && el.clientWidth > 0; tries += 1) {
    const size = Number.parseFloat(getComputedStyle(el).fontSize);
    const next = Math.max(minPx, Math.floor(((size * el.clientWidth) / el.scrollWidth) * 2) / 2);
    const smaller = next < size ? next : Math.max(minPx, size - 0.5);
    if (smaller >= size) return;
    el.style.fontSize = `${smaller}px`;
  }
}

/** The bars of both lanes on one scale: the longer stored total fills the track. */
export function raceLayout(view: RaceView): RaceLayout {
  const sum = (lane: Lane): number => lane.phases.reduce((a, p) => a + p.stored, 0);
  const longest = Math.max(sum(view.lane1938), view.laneToday ? sum(view.laneToday) : 0);
  return {
    lane1938: laneLayout(view.lane1938, longest),
    laneToday: view.laneToday ? laneLayout(view.laneToday, longest) : null,
  };
}

// ---- Map geometry -----------------------------------------------------------------
// Positions in the map area from the coordinates of route.geojson and index.json:
// a projection, straight lines for street names, and boxes for corner names.
// Geometry only: no stored minute is read here.

export type Pt = { x: number; y: number };
export type Box = { x: number; y: number; width: number; height: number };
export type Padding = { top: number; right: number; bottom: number; left: number };
export type Size = { width: number; height: number };

/**
 * A projection of [lon, lat] into a box: longitudes scaled by the cosine of the
 * middle latitude (the city is small, so this keeps its shape), fitted inside
 * the padding and centred. The points fix the bounds.
 */
export function fitProjection(points: readonly (readonly number[])[], size: Size, padding: Padding): (lonlat: readonly number[]) => Pt {
  let [minLon, maxLon, minLat, maxLat] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const [lon = 0, lat = 0] of points) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  if (!Number.isFinite(minLon)) [minLon, maxLon, minLat, maxLat] = [0, 0, 0, 0];
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = (maxLon - minLon) * k;
  const spanY = maxLat - minLat;
  const innerW = Math.max(1, size.width - padding.left - padding.right);
  const innerH = Math.max(1, size.height - padding.top - padding.bottom);
  const fit = Math.min(spanX > 0 ? innerW / spanX : Infinity, spanY > 0 ? innerH / spanY : Infinity);
  const scale = Number.isFinite(fit) ? fit : 1;
  const left = padding.left + (innerW - spanX * scale) / 2;
  const top = padding.top + (innerH - spanY * scale) / 2;
  return ([lon = 0, lat = 0]) => ({ x: left + (lon - minLon) * k * scale, y: top + (maxLat - lat) * scale });
}

/** The width of a line of display type before it is drawn, from the face's average glyph advance. */
export function textWidth(text: string, fontPx: number, glyphEm: number): number {
  return text.length * fontPx * glyphEm;
}

export type Chord = { from: Pt; to: Pt; length: number };

/**
 * The straight line from a leg's first point to its last, running left to right
 * (top to bottom when upright) so a name set along it never reads upside down,
 * moved `offset` pixels to the side its text stands on.
 */
export function readingChord(points: readonly Pt[], offset: number): Chord {
  const a = points[0] ?? { x: 0, y: 0 };
  const b = points[points.length - 1] ?? a;
  const [from, to] = b.x < a.x || (b.x === a.x && b.y < a.y) ? [b, a] : [a, b];
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const n = normal(from, to);
  return {
    from: { x: from.x + n.x * offset, y: from.y + n.y * offset },
    to: { x: to.x + n.x * offset, y: to.y + n.y * offset },
    length,
  };
}

/** The unit vector to the left of the direction a to b on screen (y down): where text set along a to b stands. */
function normal(a: Pt, b: Pt): Pt {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return length > 0 ? { x: (b.y - a.y) / length, y: (a.x - b.x) / length } : { x: 0, y: -1 };
}

/** Points on the band a name of `width` and `fontPx` covers, centred on the chord it is set along. */
export function labelSamples(chord: Chord, width: number, fontPx: number): Pt[] {
  const { from, to, length } = chord;
  if (length === 0) return [from];
  const u = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const n = normal(from, to);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const out: Pt[] = [];
  const steps = Math.max(1, Math.ceil(width / 3));
  for (let i = 0; i <= steps; i += 1) {
    const along = (i / steps - 0.5) * width;
    for (const up of [0, 0.35, 0.7]) {
      out.push({ x: mid.x + u.x * along + n.x * up * fontPx, y: mid.y + u.y * along + n.y * up * fontPx });
    }
  }
  return out;
}

export function insideBox(p: Pt, box: Box, margin = 0): boolean {
  return (
    p.x >= box.x - margin && p.x <= box.x + box.width + margin && p.y >= box.y - margin && p.y <= box.y + box.height + margin
  );
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function grow(box: Box, by: number): Box {
  return { x: box.x - by, y: box.y - by, width: box.width + by * 2, height: box.height + by * 2 };
}

/** Whether the segment a to b crosses the box (Liang and Barsky's clip). */
export function segmentHitsBox(a: Pt, b: Pt, box: Box): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, a.x - box.x],
    [dx, box.x + box.width - a.x],
    [-dy, a.y - box.y],
    [dy, box.y + box.height - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      t0 = Math.max(t0, t);
    } else {
      if (t < t0) return false;
      t1 = Math.min(t1, t);
    }
  }
  return true;
}

/** Whether an end of one line lies within `within` pixels of an end of the other: the two legs meet. */
export function linesMeet(a: readonly Pt[], b: readonly Pt[], within: number): boolean {
  const ends = (line: readonly Pt[]): Pt[] => [line[0], line.at(-1)].filter((p): p is Pt => p !== undefined);
  return ends(a).some((p) => ends(b).some((q) => Math.hypot(p.x - q.x, p.y - q.y) <= within));
}

/** The square a dot of `radius` covers. */
export function dotBox(dot: Pt, radius: number): Box {
  return { x: dot.x - radius, y: dot.y - radius, width: radius * 2, height: radius * 2 };
}

export type NamePlace = { anchor: 'start' | 'middle' | 'end'; x: number; y: number; box: Box };

/**
 * Where a corner's name can sit beside its dot, in order of preference: right,
 * below right, above right, below, above, left, below left, above left. `x` and
 * `y` are the text's anchor and baseline.
 */
export function namePlaces(dot: Pt, radius: number, width: number, fontPx: number, gap: number): NamePlace[] {
  const near = radius + gap;
  const baseline = fontPx * 0.78;
  const rightX = dot.x + near;
  const leftX = dot.x - near;
  const middleY = dot.y - fontPx / 2;
  const belowY = dot.y + near;
  const aboveY = dot.y - near - fontPx;
  const place = (anchor: NamePlace['anchor'], boxX: number, boxY: number): NamePlace => ({
    anchor,
    x: anchor === 'start' ? boxX : anchor === 'end' ? boxX + width : boxX + width / 2,
    y: boxY + baseline,
    box: { x: boxX, y: boxY, width, height: fontPx },
  });
  return [
    place('start', rightX, middleY),
    place('start', dot.x + radius, belowY),
    place('start', dot.x + radius, aboveY),
    place('middle', dot.x - width / 2, belowY),
    place('middle', dot.x - width / 2, aboveY),
    place('end', leftX - width, middleY),
    place('end', dot.x - radius - width, belowY),
    place('end', dot.x - radius - width, aboveY),
  ];
}

export type Obstacles = { lines: readonly (readonly Pt[])[]; boxes: readonly Box[]; view: Box };

/** The place with the fewest lines and boxes in its way, staying inside the view; the earlier place on a tie. */
export function bestPlace(places: readonly NamePlace[], obstacles: Obstacles, margin: number): NamePlace {
  let best = places[0]!;
  let fewest = Infinity;
  for (const place of places) {
    const box = grow(place.box, margin);
    let hits = insideBox({ x: place.box.x, y: place.box.y }, obstacles.view) &&
      insideBox({ x: place.box.x + place.box.width, y: place.box.y + place.box.height }, obstacles.view)
      ? 0
      : 100;
    for (const line of obstacles.lines) {
      for (let i = 0; i + 1 < line.length; i += 1) {
        if (segmentHitsBox(line[i]!, line[i + 1]!, box)) {
          hits += 1;
          break;
        }
      }
    }
    for (const other of obstacles.boxes) if (boxesOverlap(box, other)) hits += 1;
    if (hits < fewest) {
      fewest = hits;
      best = place;
    }
  }
  return best;
}
