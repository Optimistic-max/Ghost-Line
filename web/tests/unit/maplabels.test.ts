// The street names along the route and the trolley marker where it stands
// (Emmanuel, Nov 20): before the ride the marker waits at the origin corner,
// after it it stands short of the destination corner (R5.9). No street name may
// lie under it in either place: a name the marker would cover moves along its
// leg until it is clear, or is left out. Checked for every pair on both layouts,
// with the marker's boxes and the names' outlines worked out here, apart from
// the plan's own check: the marker from its track, its size from config.ts and
// its drawing's view box; each name as the rectangle its text covers along its
// line, tested against the boxes edge by edge.
import { describe, expect, it } from 'vitest';
import { MAP_LAYOUT, VEHICLE_SIZES } from '../../src/config';
import { pairKey } from '../../src/data/files';
import { planDrawing } from '../../src/map/routedrawing';
import { alongSpots, markerTrack, nameOffsets, readingChord, textWidth, trackPoint } from '../../src/view/layout';
import { markerSvg } from '../../src/view/vehicles';
import { realData } from '../support/realdata';

type P = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

const { index, route, races } = realData();

/** The marker drawing's height for a width, from the view box in its markup. */
function markerHeight(width: number): number {
  const [, , w, h] = /viewBox="([^"]+)"/.exec(markerSvg({ width }))![1]!.split(' ').map(Number);
  return (width * h!) / w!;
}

const markerWidth = { phone: VEHICLE_SIZES.phone.mapMarker, desktop: VEHICLE_SIZES.desktop.mapMarker };

/** The ink of a name: from its baseline up 0.7 em. */
const INK = { above: 0.7, below: 0 };

/**
 * The four corners of the band a name covers: `width` along its line, centred at `along`, from
 * `band.below` ems under its baseline to `band.above` ems over it. The browser's glyph boxes
 * (config.ts glyphBox) are the larger band; the ink is the smaller.
 */
function nameOutline(from: P, to: P, along: number, width: number, font: number, band = INK): P[] {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const u = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  // The side the text stands on: left of the reading direction, on a screen whose y runs down.
  const n = { x: u.y, y: -u.x };
  const c = { x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along };
  const at = (s: number, t: number): P => ({ x: c.x + u.x * s + n.x * t, y: c.y + u.y * s + n.y * t });
  const half = width / 2;
  const [low, high] = [-band.below * font, band.above * font];
  return [at(-half, low), at(half, low), at(half, high), at(-half, high)];
}

/** Whether a convex polygon and a box overlap (separating axes). */
function overlaps(poly: P[], box: Rect): boolean {
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
  const axes: P[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length]!;
    axes.push({ x: q.y - p.y, y: p.x - q.x });
  });
  return axes.every((a) => {
    const span = (pts: P[]) => pts.map((p) => p.x * a.x + p.y * a.y);
    const s1 = span(poly);
    const s2 = span(corners);
    return Math.max(...s1) > Math.min(...s2) && Math.max(...s2) > Math.min(...s1);
  });
}

describe('street names and the standing trolley marker', () => {
  for (const layout of ['phone', 'desktop'] as const) {
    it(`no street name lies under the marker at the origin or short of the destination, for every pair (${layout})`, () => {
      const look = MAP_LAYOUT[layout];
      let named = 0;
      for (const pair of index.pairs) {
        const race = races.get(pairKey(pair))!;
        const plan = planDrawing({ index, route, pair, layout, direction: race.direction });
        const legs = route.features.filter((f) => f.properties.direction === race.direction).map((f) => f.geometry.coordinates);
        const lonlat = (slug: string) => index.corners.find((c) => c.slug === slug)!.lonlat;
        const track = markerTrack(legs, lonlat(pair.origin), lonlat(pair.dest), look.markerStop, plan.pxPerMetre);
        const width = markerWidth[layout];
        const height = markerHeight(width);
        const boxes = [0, 1].map((p) => {
          const at = plan.project(trackPoint(track, p));
          return { x: at.x - width / 2, y: at.y - height, width, height };
        });
        // The plan works from the same marker, at the same two places.
        expect(plan.markerBoxes, pairKey(pair)).toHaveLength(2);
        plan.markerBoxes.forEach((b, k) => {
          expect(b.x, pairKey(pair)).toBeCloseTo(boxes[k]!.x, 6);
          expect(b.y, pairKey(pair)).toBeCloseTo(boxes[k]!.y, 6);
        });
        for (const label of plan.labels) {
          // The marker is kept off the whole glyph box, as a browser reports it, not only off the ink.
          const outline = nameOutline(
            label.from,
            label.to,
            label.along,
            textWidth(label.street, look.streetFont, MAP_LAYOUT.glyphEm),
            look.streetFont,
            MAP_LAYOUT.glyphBox,
          );
          for (const [k, box] of boxes.entries()) {
            expect(overlaps(outline, box), `${layout} ${pairKey(pair)}: ${label.street} under the marker ${k === 0 ? 'at the origin' : 'short of the destination'}`).toBe(false);
          }
          named += 1;
        }
      }
      // Names are still set along the route.
      expect(named).toBeGreaterThan(index.pairs.length);
    });
  }

  it('moves a name the marker would cover along its own leg, staying on it: Preston Street beside the lead pair\'s origin (phone)', () => {
    const lead = { origin: 'preston-caroline', dest: 'aliceanna-bond' };
    const race = races.get(pairKey(lead))!;
    const plan = planDrawing({ index, route, pair: lead, layout: 'phone', direction: race.direction });
    const preston = plan.labels.find((l) => l.street === 'Preston Street');
    expect(preston).toBeDefined();
    // Moved off the middle of its line, away from the corner the marker stands at (its east end), and the
    // whole name still on the line.
    expect(preston!.along).toBeLessThan(0.5);
    const { length } = readingChord([preston!.from, preston!.to], 0);
    const width = textWidth('Preston Street', MAP_LAYOUT.phone.streetFont, MAP_LAYOUT.glyphEm);
    expect(preston!.along * length - width / 2).toBeGreaterThanOrEqual(0);
    expect(preston!.along * length + width / 2).toBeLessThanOrEqual(length);
  });

  it('keeps Caroline Street visible for the lead pair on both layouts (Emmanuel, Nov 20)', () => {
    const lead = { origin: 'preston-caroline', dest: 'aliceanna-bond' };
    const race = races.get(pairKey(lead))!;
    // (The drawing and the map are checked from this plan in tests/dom/map.test.ts and mapstyle.test.ts.)
    for (const layout of ['phone', 'desktop'] as const) {
      const plan = planDrawing({ index, route, pair: lead, layout, direction: race.direction });
      expect(plan.labels.map((l) => l.street), layout).toContain('Caroline Street');
      expect(plan.mapLabels.map((l) => l.street), `${layout}: on the map`).toContain('Caroline Street');
    }
    // On the phone, along the leg alone it cannot clear both marker places and the corner names: it stands beside its leg.
    const phone = planDrawing({ index, route, pair: lead, layout: 'phone', direction: race.direction });
    const caroline = phone.labels.find((l) => l.street === 'Caroline Street')!;
    expect(caroline.offset).not.toBe(MAP_LAYOUT.gap);
    expect(Math.abs(caroline.offset)).toBeGreaterThan(MAP_LAYOUT.gap);
    // The desktop name stays where it always was.
    const desktop = planDrawing({ index, route, pair: lead, layout: 'desktop', direction: race.direction });
    expect(desktop.labels.find((l) => l.street === 'Caroline Street')!.offset).toBe(MAP_LAYOUT.gap);
  });

  it('keeps a name moved out from its leg beside that leg, off the other lines and off the other names (every pair, both layouts)', () => {
    let moved = 0;
    for (const layout of ['phone', 'desktop'] as const) {
      const look = MAP_LAYOUT[layout];
      for (const pair of index.pairs) {
        const race = races.get(pairKey(pair))!;
        const plan = planDrawing({ index, route, pair, layout, direction: race.direction });
        const outlines = plan.labels.map((l) => ({
          label: l,
          shape: nameOutline(l.from, l.to, l.along, textWidth(l.street, look.streetFont, MAP_LAYOUT.glyphEm), look.streetFont),
        }));
        for (const { label, shape } of outlines) {
          if (label.offset === MAP_LAYOUT.gap) continue;
          moved += 1;
          const where = `${layout} ${pairKey(pair)}: ${label.street}`;
          // Beside its own leg: the letters' near edge is at most labelMaxOffset from the line (checked from the offset).
          const near = label.offset > 0 ? label.offset : -label.offset - look.streetFont * 0.7;
          expect(near, where).toBeLessThanOrEqual(MAP_LAYOUT.labelMaxOffset + 1e-9);
          expect(near, where).toBeGreaterThanOrEqual(MAP_LAYOUT.gap - 1e-9);
          // Off every line of the route, its own included, by more than the line's own width.
          for (const line of plan.legs) {
            expect(distanceToPolyline(shape, line), where).toBeGreaterThan(1.5);
          }
          // Off the other names.
          for (const other of outlines) {
            if (other.label === label) continue;
            expect(polygonsApart(shape, other.shape), `${where} and ${other.label.street}`).toBe(true);
          }
        }
      }
    }
    // Some name really was moved out, so the checks above ran.
    expect(moved).toBeGreaterThan(0);
  });

  it('leaves a name out when nothing fits: no offset up to the limit clears the marker', () => {
    // With the search held to the usual offset, Caroline Street cannot clear the marker on the phone, and is left out.
    const lead = { origin: 'preston-caroline', dest: 'aliceanna-bond' };
    const race = races.get(pairKey(lead))!;
    const saved = MAP_LAYOUT.labelMaxOffset;
    try {
      (MAP_LAYOUT as { labelMaxOffset: number }).labelMaxOffset = MAP_LAYOUT.gap;
      const plan = planDrawing({ index, route, pair: lead, layout: 'phone', direction: race.direction });
      expect(plan.labels.map((l) => l.street)).not.toContain('Caroline Street');
    } finally {
      (MAP_LAYOUT as { labelMaxOffset: number }).labelMaxOffset = saved;
    }
  });

  it('without the race file there is no track yet, and the names are set as before', () => {
    const lead = { origin: 'preston-caroline', dest: 'aliceanna-bond' };
    const plan = planDrawing({ index, route, pair: lead, layout: 'phone' });
    expect(plan.track).toBeNull();
    expect(plan.markerBoxes).toEqual([]);
    for (const label of plan.labels) expect(label.along).toBe(0.5);
  });
});

/** The distance from a point to a segment. */
function pointToSegment(p: P, a: P, b: P): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const span = dx * dx + dy * dy;
  const t = span > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / span)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The points of a quadrilateral's edges, every pixel and a half, for distances. */
function edgePoints(poly: P[]): P[] {
  const out: P[] = [];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]!;
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 1.5));
    for (let k = 0; k <= steps; k += 1) out.push({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps });
  });
  return out;
}

/** The least distance from a name's outline to a polyline, taken over points along the outline's edges. */
function distanceToPolyline(poly: P[], line: readonly P[]): number {
  let least = Infinity;
  for (const p of edgePoints(poly)) {
    for (let i = 0; i + 1 < line.length; i += 1) least = Math.min(least, pointToSegment(p, line[i]!, line[i + 1]!));
  }
  // A line crossing the outline crosses an edge, so some edge point is near it: the least distance is then small.
  return least;
}

/** Whether two quadrilaterals keep apart: no edge point of either inside, or within a pixel of, the other. */
function polygonsApart(a: P[], b: P[]): boolean {
  const inside = (p: P, poly: P[]): boolean => overlaps(poly, { x: p.x - 0.5, y: p.y - 0.5, width: 1, height: 1 });
  return !edgePoints(a).some((p) => inside(p, b)) && !edgePoints(b).some((p) => inside(p, a));
}

describe('nameOffsets', () => {
  it('tries the other side at the usual gap, then each step out on the usual side and then the other, up to the limit', () => {
    const font = 10;
    const offsets = nameOffsets(font, 5, 8, 1);
    // The letters stand 7 px tall (0.7 of the font); on the other side the baseline is that much further out.
    expect(offsets.map((o) => Number(o.toFixed(6)))).toEqual([-12, 6, -13, 7, -14, 8, -15]);
    // The usual side at the usual gap (offset 5) is the place already tried.
    expect(offsets).not.toContain(5);
    expect(nameOffsets(font, 5, 5, 1)).toEqual([-12]);
  });
});

describe('alongSpots', () => {
  const chord = { from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, length: 100 };

  it('tries the middle first, then steps out each way in turn, keeping the whole name on the line', () => {
    expect(alongSpots(chord, 90, 1).map((s) => Number(s.toFixed(9)))).toEqual([0.5, 0.49, 0.51, 0.48, 0.52, 0.47, 0.53, 0.46, 0.54, 0.45, 0.55]);
    for (const spot of alongSpots(chord, 40, 0.5)) {
      expect(spot * 100 - 20).toBeGreaterThanOrEqual(-1e-9);
      expect(spot * 100 + 20).toBeLessThanOrEqual(100 + 1e-9);
    }
  });

  it('offers only the middle when the name fills the line', () => {
    expect(alongSpots(chord, 100, 1)).toEqual([0.5]);
    expect(alongSpots({ ...chord, length: 0 }, 10, 1)).toEqual([0.5]);
  });
});
