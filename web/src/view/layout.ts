// Layout (design 13.3, P-B 2): bar widths on one shared time scale, so the longer
// trip is visibly longer, and positions in the map area (design 12.1, 12.2).
// Allowed arithmetic: fractions of the longer stored total, and geometry of the
// route's own coordinates. Nothing here reads a time or decides a result.
import type { RaceFile } from '../data/types';
import type { LaneFrame } from '../play/timeline';
import type { Lane, RaceView } from '../state/model';
import { MARKER_VIEWBOX } from './vehicles';

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
 * Where a lane's bar marker centre stands, in pixels from the bar's left edge
 * (the marker track adds half a marker on each side). Before the ride it is the
 * ride's start, during it the filled end, after it the ride's end: all of that
 * is `frame.vehicle`. The gaps drawn before the ride shift it by `segGapPx`
 * each. A null frame is the reduced-motion case: parked at the ride's end.
 */
export function markerCentre(layout: LaneLayout, frame: Pick<LaneFrame, 'vehicle'> | null, barPx: number, segGapPx: number): number {
  const share = frame ? frame.vehicle : layout.park;
  return share * barPx + layout.gapsBefore * segGapPx;
}

// ---- The start-time chart (story-layer design 6.1) ------------------------------------
// Geometry only: stored totals are copied and scaled, never combined or compared.

export type ChartPlan = {
  /** One column per race row. */
  columns: number;
  /** The largest stored total of both series: the scale runs 0 to max. */
  max: number;
  series1938: number[];
  /** Null when every row has no one-seat ride. A row with no one-seat ride inside it is null: a gap. */
  seriesToday: (number | null)[] | null;
  /** The column range (inclusive) where before_table is true, or null. */
  hatch: { from: number; to: number } | null;
};

export function chartPlan(race: Pick<RaceFile, 'races'>): ChartPlan {
  const rows = race.races;
  const series1938 = rows.map((r) => r.y1938.total);
  const anyToday = rows.some((r) => r.today !== null);
  const seriesToday = anyToday
    ? rows.map((r) => (r.today === null ? null : r.today.total))
    : null;
  const first = rows.findIndex((r) => r.before_table);
  const last = rows.findLastIndex((r) => r.before_table);
  return {
    columns: rows.length,
    max: Math.max(0, ...series1938, ...(seriesToday ?? [])),
    series1938,
    seriesToday,
    hatch: first === -1 ? null : { from: first, to: last },
  };
}

/** The drawing's height in viewBox units; only its ratio to the plotted values matters. */
export const CHART_HEIGHT = 40;

export type ChartGeometry = {
  /** The viewBox width: column k is centred on x = k, so the first and last columns are the slider's ends. */
  width: number;
  /** The hatched rect in viewBox units (column k spans k - 0.5 to k + 0.5), or null. */
  hatch: { x: number; width: number } | null;
  /** Where the hatch label starts, as a percentage of the plot width. */
  hatchLeftPct: number;
};

/** Viewbox geometry of a plan: columns, the hatch and the label's offset. Scaling only. */
export function chartGeometry(plan: ChartPlan): ChartGeometry {
  const width = Math.max(1, plan.columns - 1);
  const hatch = plan.hatch ? { x: plan.hatch.from - 0.5, width: plan.hatch.to - plan.hatch.from + 1 } : null;
  const hatchLeftPct = plan.hatch ? Number(((plan.hatch.from / width) * 100).toFixed(3)) : 0;
  return { width, hatch, hatchLeftPct };
}

/** The cursor's shift in viewBox units for a column (a column of -1, no such row, parks at 0). */
export function cursorShift(column: number): number {
  return Math.max(column, 0);
}

const unit = (n: number): string => String(Number(n.toFixed(3)));

/**
 * A step path in viewBox units: column k spans x from k - 0.5 to k + 0.5 at
 * y = height x (1 - value / max). No smoothing, no averaging. A null value (no one-seat
 * ride) breaks the path: nothing is drawn for that column and the line restarts with a
 * new move at the next stored value.
 */
export function chartPath(series: readonly (number | null)[], max: number, height: number): string {
  const y = (v: number): string => unit(max > 0 ? height * (1 - v / max) : height);
  let d = '';
  let open = false;
  series.forEach((v, k) => {
    if (v === null) {
      open = false;
      return;
    }
    d += open ? ` V${y(v)}` : `${d === '' ? '' : ' '}M${unit(k - 0.5)} ${y(v)}`;
    d += ` H${unit(k + 0.5)}`;
    open = true;
  });
  return d;
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
export type Projection = {
  project: (lonlat: readonly number[]) => Pt;
  /** The [lon, lat] of a point of the box. */
  unproject: (p: Pt) => [number, number];
  /** CSS pixels per metre on the ground. */
  pxPerMetre: number;
};

/** Metres per degree of latitude (the mean earth radius); enough at the scale of one city. */
const METRES_PER_DEGREE = 111_195;

export type Bounds = [[number, number], [number, number]];

/** The south-west and north-east corners around the points, as [lon, lat] pairs. */
export function lonLatBounds(points: readonly (readonly number[])[]): Bounds {
  let [minLon, maxLon, minLat, maxLat] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const [lon = 0, lat = 0] of points) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  if (!Number.isFinite(minLon)) return [[0, 0], [0, 0]];
  return [[minLon, minLat], [maxLon, maxLat]];
}

export function fitProjection(points: readonly (readonly number[])[], size: Size, padding: Padding): Projection {
  const [[minLon, minLat], [maxLon, maxLat]] = lonLatBounds(points);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = (maxLon - minLon) * k;
  const spanY = maxLat - minLat;
  const innerW = Math.max(1, size.width - padding.left - padding.right);
  const innerH = Math.max(1, size.height - padding.top - padding.bottom);
  const fit = Math.min(spanX > 0 ? innerW / spanX : Infinity, spanY > 0 ? innerH / spanY : Infinity);
  const scale = Number.isFinite(fit) ? fit : 1;
  const left = padding.left + (innerW - spanX * scale) / 2;
  const top = padding.top + (innerH - spanY * scale) / 2;
  return {
    project: ([lon = 0, lat = 0]) => ({ x: left + (lon - minLon) * k * scale, y: top + (maxLat - lat) * scale }),
    unproject: ({ x, y }) => [minLon + (x - left) / (k * scale), maxLat - (y - top) / scale],
    pxPerMetre: scale / METRES_PER_DEGREE,
  };
}

/**
 * The centre of a street name set along a line (as the drawing sets it: its
 * baseline on the line, standing to the line's left), and the line's angle in
 * degrees clockwise, for the map's symbol at the same place.
 */
export function labelAnchor(from: Pt, to: Pt, fontPx: number, along = 0.5): { at: Pt; angle: number } {
  const n = normal(from, to);
  const up = fontPx * 0.35;
  return {
    at: { x: from.x + (to.x - from.x) * along + n.x * up, y: from.y + (to.y - from.y) * along + n.y * up },
    angle: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
  };
}

/** A share along a line as the drawing's startOffset: 0.5 is "50%". */
export function alongPercent(along: number): string {
  return `${Number((along * 100).toFixed(2))}%`;
}

/**
 * Where the centre of a name `width` wide can sit along a chord, as shares of
 * the chord from its start: the middle first, then `step` pixels further each
 * way in turn (towards the start first), as long as the whole name stays on
 * the chord.
 */
export function alongSpots(chord: Chord, width: number, step: number): number[] {
  const { length } = chord;
  const spots = [0.5];
  if (length <= 0 || step <= 0) return spots;
  const room = (length - width) / 2;
  for (let shift = step; shift <= room; shift += step) spots.push(0.5 - shift / length, 0.5 + shift / length);
  return spots;
}

/**
 * The box the trolley marker covers when it stands at a point: its wheels on
 * the point, centred across it (map.css .drawing-marker, the map's marker
 * anchored at its bottom), its height from its width and its view box.
 */
export function markerBox(at: Pt, width: number): Box {
  const height = (width * MARKER_VIEWBOX.height) / MARKER_VIEWBOX.width;
  return { x: at.x - width / 2, y: at.y - height, width, height };
}

/** The point a corner's name hangs from on the map: its anchor side, half way down its line. */
export function nameAnchor(place: { anchor: 'start' | 'middle' | 'end'; x: number; box: Box }): { at: Pt; anchor: 'left' | 'center' | 'right' } {
  const anchor = place.anchor === 'start' ? 'left' : place.anchor === 'end' ? 'right' : 'center';
  return { at: { x: place.x, y: place.box.y + place.box.height / 2 }, anchor };
}

// ---- The map marker's track (design 12.2) ---------------------------------------------
// The trolley marker moves along the joined route line of the race's direction,
// by distance along the line's own segments, from the origin's place on it to a
// short way before the destination's. Ride progress p (0 to 1) picks the point.

export type Track = {
  /** The joined line, [lon, lat] points. */
  points: number[][];
  /** Metres along the line at each point. */
  at: number[];
  /** Where the marker starts and stops, in metres along the line. */
  from: number;
  to: number;
};

function metresBetween(a: readonly number[], b: readonly number[]): number {
  const [lonA = 0, latA = 0] = a;
  const [lonB = 0, latB = 0] = b;
  const k = Math.cos((((latA + latB) / 2) * Math.PI) / 180);
  return Math.hypot((lonB - lonA) * k, latB - latA) * METRES_PER_DEGREE;
}

/** The place along the line nearest to a point, in metres from its start. */
function locate(points: readonly number[][], at: readonly number[], p: readonly number[]): number {
  let best = 0;
  let nearest = Infinity;
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const k = Math.cos(((a[1] ?? 0) * Math.PI) / 180);
    const ax = (a[0] ?? 0) * k;
    const ay = a[1] ?? 0;
    const dx = (b[0] ?? 0) * k - ax;
    const dy = (b[1] ?? 0) - ay;
    const px = (p[0] ?? 0) * k - ax;
    const py = (p[1] ?? 0) - ay;
    const span = dx * dx + dy * dy;
    const t = span > 0 ? Math.min(1, Math.max(0, (px * dx + py * dy) / span)) : 0;
    const off = Math.hypot(px - t * dx, py - t * dy);
    if (off < nearest) {
      nearest = off;
      best = at[i]! + t * (at[i + 1]! - at[i]!);
    }
  }
  return best;
}

/**
 * The marker's track: the legs (in travel order) joined into one line, from the
 * origin's place on it to `stopPx` before the destination's at the drawing's scale.
 */
export function markerTrack(legs: readonly (readonly number[][])[], origin: readonly number[], dest: readonly number[], stopPx: number, pxPerMetre: number): Track {
  const points = legs.flatMap((leg) => leg.map((p) => [...p]));
  const at: number[] = [];
  points.forEach((p, i) => at.push(i === 0 ? 0 : at[i - 1]! + metresBetween(points[i - 1]!, p)));
  const from = locate(points, at, origin);
  const end = locate(points, at, dest);
  const stop = pxPerMetre > 0 ? stopPx / pxPerMetre : 0;
  return { points, at, from, to: Math.max(from, end - stop) };
}

/** The marker's point at ride progress p, clamped to 0 to 1. */
export function trackPoint(track: Track, p: number): [number, number] {
  const share = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
  const d = track.from + (track.to - track.from) * share;
  const { points, at } = track;
  let i = at.findIndex((m) => m >= d);
  if (i === -1) i = points.length - 1;
  const b = points[i] ?? [0, 0];
  if (i === 0) return [b[0] ?? 0, b[1] ?? 0];
  const a = points[i - 1]!;
  const span = at[i]! - at[i - 1]!;
  const t = span > 0 ? (d - at[i - 1]!) / span : 0;
  return [(a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * t, (a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * t];
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

/** The rows, as shares of the font size above the baseline, that the letters of a name cover. */
export const INK_ROWS: readonly number[] = [0, 0.35, 0.7];

/**
 * The rows a browser's glyph boxes cover, from below the baseline to above the
 * capitals: the ascent and descent of the face, in ems (config.ts MAP_LAYOUT.glyphBox).
 * A name must clear the trolley marker by this much, not only by its ink.
 */
export function glyphRows(box: { above: number; below: number }): number[] {
  return [-box.below, 0, box.above / 3, (box.above * 2) / 3, box.above];
}

/**
 * Points on the band a name of `width` and `fontPx` covers, centred at the share
 * `along` of the chord it is set along, on each of `rows` above its baseline.
 */
export function labelSamples(chord: Chord, width: number, fontPx: number, along = 0.5, rows: readonly number[] = INK_ROWS): Pt[] {
  const { from, to, length } = chord;
  if (length === 0) return [from];
  const u = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const n = normal(from, to);
  const mid = { x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along };
  const out: Pt[] = [];
  const steps = Math.max(1, Math.ceil(width / 3));
  for (let i = 0; i <= steps; i += 1) {
    const along = (i / steps - 0.5) * width;
    for (const up of rows) {
      out.push({ x: mid.x + u.x * along + n.x * up * fontPx, y: mid.y + u.y * along + n.y * up * fontPx });
    }
  }
  return out;
}

/**
 * The offsets from a leg, in order, at which a street name moved out of the
 * marker's way is tried: the near edge of its letters `d` pixels from the line,
 * `d` from the usual gap up to `max` in steps, on the usual side and then the
 * other (a negative offset: the letters stand on the other side, so the baseline
 * lies a letters' height beyond the edge). The usual side at the usual gap is the
 * place already tried.
 */
export function nameOffsets(fontPx: number, gap: number, max: number, step: number): number[] {
  const reach = fontPx * 0.7;
  const out: number[] = [];
  for (let d = gap; d <= max; d += step) {
    if (d > gap) out.push(d);
    out.push(-(d + reach));
  }
  return out;
}

/** Whether a point is further than `room` pixels from every one of the points. */
export function apartFrom(p: Pt, points: readonly Pt[], room: number): boolean {
  return points.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > room);
}

/**
 * A test for whether a point is within `room` pixels of any of the lines. The
 * segments are filed once in a grid of square cells, so a point is measured only
 * against the few segments whose reach covers its cell.
 */
export function lineProximity(lines: readonly (readonly Pt[])[], room: number): (p: Pt) => boolean {
  const cell = 16;
  const grid = new Map<string, [Pt, Pt][]>();
  const key = (cx: number, cy: number): string => `${cx},${cy}`;
  for (const line of lines) {
    for (let i = 0; i + 1 < line.length; i += 1) {
      const a = line[i]!;
      const b = line[i + 1]!;
      const [x0, x1] = [Math.floor((Math.min(a.x, b.x) - room) / cell), Math.floor((Math.max(a.x, b.x) + room) / cell)];
      const [y0, y1] = [Math.floor((Math.min(a.y, b.y) - room) / cell), Math.floor((Math.max(a.y, b.y) + room) / cell)];
      for (let cx = x0; cx <= x1; cx += 1) {
        for (let cy = y0; cy <= y1; cy += 1) {
          const k = key(cx, cy);
          const bucket = grid.get(k);
          if (bucket) bucket.push([a, b]);
          else grid.set(k, [[a, b]]);
        }
      }
    }
  }
  return (p) => {
    for (const [a, b] of grid.get(key(Math.floor(p.x / cell), Math.floor(p.y / cell))) ?? []) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const span = dx * dx + dy * dy;
      const t = span > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / span)) : 0;
      if (Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) <= room) return true;
    }
    return false;
  };
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
