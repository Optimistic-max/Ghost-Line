import { describe, expect, it } from 'vitest';
import { markerCentre, type LaneLayout } from '../../src/view/layout';

// A made-up lane: wait then ride, one gap before the ride. Shares of a made-up scale.
const layout: LaneLayout = { widths: [0.2, 0.5], end: 0.7, rideFrom: 0.2, park: 0.7, gapsBefore: 1 };
const BAR = 200;
const GAP = 4;

describe('markerCentre', () => {
  it('holds the ride start before the ride', () => {
    expect(markerCentre(layout, { vehicle: layout.rideFrom }, BAR, GAP)).toBeCloseTo(0.2 * BAR + GAP, 6);
  });

  it('stands on the filled end during the ride', () => {
    expect(markerCentre(layout, { vehicle: 0.45 }, BAR, GAP)).toBeCloseTo(0.45 * BAR + GAP, 6);
  });

  it('holds the ride end after the ride', () => {
    expect(markerCentre(layout, { vehicle: layout.park }, BAR, GAP)).toBeCloseTo(0.7 * BAR + GAP, 6);
  });

  it('adds nothing for gaps when the gap is zero', () => {
    expect(markerCentre(layout, { vehicle: 0.45 }, BAR, 0)).toBeCloseTo(0.45 * BAR, 6);
  });

  it('parks at the ride end with no frame (reduced motion)', () => {
    expect(markerCentre(layout, null, BAR, GAP)).toBe(markerCentre(layout, { vehicle: layout.park }, BAR, GAP));
  });
});
