// Task 4.3 property P2: the default time is inside the slider range for every
// clock time, and is the New York time of day (seconds dropped) when inside it.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import { sliderRange } from '../../src/data/lookup';
import { defaultStart, minutesOf } from '../../src/format/time';
import { raceOf } from '../support/realdata';

const { first, last } = sliderRange(raceOf(LEAD_PAIR));
const lo = minutesOf(first);
const hi = minutesOf(last);
const MINUTE_MS = 60_000;

/** Check one instant whose New York wall time is `wallMinute` minutes after midnight. */
function check(at: Date, wallMinute: number): void {
  const { minute, fromClock } = defaultStart(at, first, last);
  expect(minute).toBeGreaterThanOrEqual(lo);
  expect(minute).toBeLessThanOrEqual(hi);
  const inside = wallMinute >= lo && wallMinute <= hi;
  expect(fromClock).toBe(inside);
  if (inside) expect(minute).toBe(wallMinute);
}

describe('default start time (P2)', () => {
  it('holds for every minute of a standard-time day, at any second', () => {
    // Local midnight of 2026-11-04 in New York is 05:00 UTC.
    const midnight = Date.UTC(2026, 10, 4, 5, 0);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1439 }), fc.integer({ min: 0, max: 59_999 }), (m, ms) => {
        check(new Date(midnight + m * MINUTE_MS + ms), m);
      }),
    );
    for (let m = 0; m < 1440; m += 1) check(new Date(midnight + m * MINUTE_MS), m);
  });

  it('holds across the spring-forward day, with its missing hour', () => {
    // 2026-03-08: midnight is 05:00 UTC; at 07:00 UTC clocks jump from 2:00 to 3:00.
    const start = Date.UTC(2026, 2, 8, 5, 0);
    const change = Date.UTC(2026, 2, 8, 7, 0);
    for (let t = start; t < start + 23 * 60 * MINUTE_MS; t += MINUTE_MS) {
      const offsetMinutes = t < change ? 5 * 60 : 4 * 60;
      const wall = ((t / MINUTE_MS - offsetMinutes) % 1440 + 1440) % 1440;
      check(new Date(t), wall);
    }
  });

  it('holds across the fall-back day, with its repeated hour', () => {
    // 2026-11-01: midnight is 04:00 UTC; at 06:00 UTC clocks go back from 2:00 to 1:00.
    const start = Date.UTC(2026, 10, 1, 4, 0);
    const change = Date.UTC(2026, 10, 1, 6, 0);
    for (let t = start; t < start + 25 * 60 * MINUTE_MS; t += MINUTE_MS) {
      const offsetMinutes = t < change ? 4 * 60 : 5 * 60;
      const wall = ((t / MINUTE_MS - offsetMinutes) % 1440 + 1440) % 1440;
      check(new Date(t), wall);
    }
  });
});
