// Task 8.3 property 5: the bar markers sit on the ride's filled end and move only during the ride (story-layer Req 6).
// Lanes are made up here (random phase minutes, zeros included); the expected positions are worked out from
// the phase boundaries in the test, not by calling the code under test.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildTimeline, laneFrame } from '../../src/play/timeline';
import type { Lane, Phase, PhaseKind, RaceView } from '../../src/state/model';
import { markerCentre, raceLayout } from '../../src/view/layout';

const BAR = 300;
const KINDS_1938: PhaseKind[] = ['wait', 'ride'];
const KINDS_TODAY: PhaseKind[] = ['walk-to-stop', 'wait', 'ride', 'walk-from-stop'];

function lane(side: Lane['side'], kinds: PhaseKind[], minutes: number[]): Lane {
  const phases: Phase[] = kinds.map((kind, k) => ({ side, kind, stored: minutes[k]!, shown: Math.round(minutes[k]!) }));
  const total = minutes.reduce((a, b) => a + b, 0);
  return { side, phases, storedTotal: total, shownTotal: Math.round(total), next: '10:00' };
}

// Minutes with a good share of exact zeros, to three decimals like the files.
const minutes = fc.oneof({ weight: 1, arbitrary: fc.constant(0) }, { weight: 3, arbitrary: fc.integer({ min: 0, max: 60000 }).map((n) => n / 1000) });

const scenario = fc.record({
  withToday: fc.boolean(),
  old: fc.tuple(minutes, minutes),
  today: fc.tuple(minutes, minutes, minutes, minutes),
  gap: fc.integer({ min: 0, max: 8 }),
  times: fc.array(fc.double({ min: 0, max: 130, noNaN: true }), { minLength: 2, maxLength: 40 }),
});

describe('Property 5: Markers sit on the ride\'s filled end and move only during the ride', () => {
  it('is non-decreasing, constant while walking or waiting and after the ride, and at the ride end at the finish', () => {
    // Feature: story-layer, Property 5: Markers sit on the ride's filled end and move only during the ride
    fc.assert(
      fc.property(scenario, ({ withToday, old, today, gap, times }) => {
        const lane1938 = lane('1938', KINDS_1938, old);
        const laneToday = withToday ? lane('today', KINDS_TODAY, today) : null;
        const view = { lane1938, laneToday, result: '1938' } as unknown as RaceView;
        const timeline = buildTimeline(view);
        const layout = raceLayout(view);
        const sorted = [...times, 0, timeline.finishAt, timeline.finishAt + 5].sort((a, b) => a - b);

        for (const [l, ll] of [[lane1938, layout.lane1938], ...(laneToday && layout.laneToday ? [[laneToday, layout.laneToday] as const] : [])] as const) {
          // Expected boundaries, from the stored parts.
          const before = l.phases.slice(0, ll.gapsBefore).reduce((a, p) => a + p.stored, 0);
          const rideStart = before;
          const rideEnd = before + l.phases[ll.gapsBefore]!.stored;
          const total = l.phases.reduce((a, p) => a + p.stored, 0);
          const startX = markerCentre(ll, { vehicle: ll.rideFrom }, BAR, gap);
          const endX = markerCentre(ll, { vehicle: ll.park }, BAR, gap);
          let previous = -Infinity;
          for (const t of sorted) {
            const x = markerCentre(ll, laneFrame(l, timeline, t, { from: ll.rideFrom, to: ll.park }), BAR, gap);
            expect(x).toBeGreaterThanOrEqual(previous - 1e-9);
            previous = x;
            if (t <= rideStart) expect(x).toBeCloseTo(startX, 6);
            else if (t >= rideEnd) expect(x).toBeCloseTo(endX, 6);
            else {
              expect(x).toBeGreaterThanOrEqual(startX - 1e-9);
              expect(x).toBeLessThanOrEqual(endX + 1e-9);
            }
            if (t >= total) expect(x).toBeCloseTo(endX, 6);
          }
          // The finish of the whole race: both markers are at their ride's end.
          expect(markerCentre(ll, laneFrame(l, timeline, timeline.finishAt, { from: ll.rideFrom, to: ll.park }), BAR, gap)).toBeCloseTo(endX, 6);
        }
      }),
      { numRuns: 200 },
    );
  });
});
