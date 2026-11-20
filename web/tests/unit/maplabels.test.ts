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
import { alongSpots, markerTrack, readingChord, textWidth, trackPoint } from '../../src/view/layout';
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

/** The four corners of the band a name covers: `width` along its line, centred at `along`, from its baseline up 0.7 em. */
function nameOutline(from: P, to: P, along: number, width: number, font: number): P[] {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const u = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  // The side the text stands on: left of the reading direction, on a screen whose y runs down.
  const n = { x: u.y, y: -u.x };
  const c = { x: from.x + (to.x - from.x) * along, y: from.y + (to.y - from.y) * along };
  const at = (s: number, t: number): P => ({ x: c.x + u.x * s + n.x * t, y: c.y + u.y * s + n.y * t });
  const half = width / 2;
  const up = font * 0.7;
  return [at(-half, 0), at(half, 0), at(half, up), at(-half, up)];
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
          const outline = nameOutline(label.from, label.to, label.along, textWidth(label.street, look.streetFont, MAP_LAYOUT.glyphEm), look.streetFont);
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

  it('without the race file there is no track yet, and the names are set as before', () => {
    const lead = { origin: 'preston-caroline', dest: 'aliceanna-bond' };
    const plan = planDrawing({ index, route, pair: lead, layout: 'phone' });
    expect(plan.track).toBeNull();
    expect(plan.markerBoxes).toEqual([]);
    for (const label of plan.labels) expect(label.along).toBe(0.5);
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
