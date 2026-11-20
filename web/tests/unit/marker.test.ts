// Task 17.4: the map marker's position helper, geometry only (design 12.2, R5.9).
// The trolley runs along the joined route line of the race's direction, from
// the origin to a short way before the destination, by ride progress p.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAP_LAYOUT } from '../../src/config';
import { pairKey } from '../../src/data/files';
import { planDrawing } from '../../src/map/routedrawing';
import { markerTrack, trackPoint } from '../../src/view/layout';
import { realData } from '../support/realdata';

/** Metres between two [lon, lat] points (haversine), for checking the helper from outside. */
function metres(a: readonly number[], b: readonly number[]): number {
  const rad = Math.PI / 180;
  const [lon1 = 0, lat1 = 0] = a;
  const [lon2 = 0, lat2 = 0] = b;
  const h = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

describe('on a made-up straight line', () => {
  // About 1.1 km due east at the equator; 1 px is 1 m, and the marker stops 100 px (100 m) short.
  const line = [[[0, 0], [0.005, 0]], [[0.005, 0], [0.01, 0]]];
  const track = markerTrack(line, [0, 0], [0.01, 0], 100, 1);

  it('starts at the origin and stops the given distance before the destination', () => {
    expect(metres(trackPoint(track, 0), [0, 0])).toBeLessThan(0.5);
    expect(metres(trackPoint(track, 1), [0.01, 0])).toBeCloseTo(100, 0);
  });

  it('moves linearly along the line', () => {
    const half = trackPoint(track, 0.5);
    expect(metres([0, 0], half)).toBeCloseTo(metres(half, trackPoint(track, 1)), 0);
    expect(half[1]).toBeCloseTo(0, 9);
  });

  it('clamps progress outside 0 to 1 and treats a missing one as the start', () => {
    expect(trackPoint(track, -2)).toEqual(trackPoint(track, 0));
    expect(trackPoint(track, 5)).toEqual(trackPoint(track, 1));
    expect(trackPoint(track, Number.NaN)).toEqual(trackPoint(track, 0));
  });

  it('never runs backwards (property)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(metres([0, 0], trackPoint(track, lo))).toBeLessThanOrEqual(metres([0, 0], trackPoint(track, hi)) + 1e-6);
      }),
    );
  });

  it('starts between the ends when the origin lies beside the line', () => {
    const beside = markerTrack(line, [0.002, 0.0001], [0.01, 0], 0, 1);
    expect(trackPoint(beside, 0)[0]).toBeCloseTo(0.002, 6);
    expect(trackPoint(beside, 0)[1]).toBeCloseTo(0, 9);
  });

  it('does not run backwards when the destination is nearer than the stop', () => {
    const short = markerTrack(line, [0, 0], [0.0005, 0], 1000, 1);
    expect(trackPoint(short, 1)).toEqual(trackPoint(short, 0));
  });
});

describe('on the real route, for every pair', () => {
  const { index, route, races } = realData();

  for (const layout of ['phone', 'desktop'] as const) {
    it(`runs from the origin to just short of the destination (${layout})`, () => {
      for (const pair of index.pairs) {
        const race = races.get(pairKey(pair))!;
        const legs = route.features.filter((f) => f.properties.direction === race.direction).map((f) => f.geometry.coordinates);
        const corner = (slug: string) => index.corners.find((c) => c.slug === slug)!.lonlat;
        const plan = planDrawing({ index, route, pair, layout });
        const stop = MAP_LAYOUT[layout].markerStop / plan.pxPerMetre;
        const track = markerTrack(legs, corner(pair.origin), corner(pair.dest), MAP_LAYOUT[layout].markerStop, plan.pxPerMetre);
        const label = `${pairKey(pair)} ${layout}`;
        // The corners sit on or beside the trace; the inferred one is drawn from the 1938 diagram.
        expect(metres(trackPoint(track, 0), corner(pair.origin)), label).toBeLessThan(60);
        const toDest = metres(trackPoint(track, 1), corner(pair.dest));
        expect(toDest, label).toBeGreaterThan(stop * 0.5);
        expect(toDest, label).toBeLessThan(stop * 1.5 + 60);
        expect(track.to, label).toBeGreaterThan(track.from);
      }
    });
  }
});
