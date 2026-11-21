// Task 1.10. Feature: story-layer, Property 13: Site rounding agrees with the
// stored flag on every real row.
// Validates: Requirement 1.8. Exhaustive over every row of all 20 race files.
import { describe, expect, it } from 'vitest';
import { roundParts } from '../../src/format/rounding';
import { realData } from '../support/realdata';
import { waitMostPredicate } from '../support/waitmost';

describe('Property 13: site rounding agrees with the stored wait_most on every real row', () => {
  it('matches on every row of every race file', () => {
    const { races } = realData();
    expect(races.size).toBe(20);
    const mismatches: string[] = [];
    let rows = 0;
    for (const [key, race] of races) {
      for (const row of race.races) {
        rows += 1;
        let computed = false;
        if (row.result === '1938' || row.result === 'today') {
          if (!row.today) throw new Error(`${key} at ${row.t}: result ${row.result} without a today side`);
          const trip = race.today.trips[row.today.trip];
          if (!trip) throw new Error(`${key} at ${row.t}: no trip ${row.today.trip}`);
          const a = roundParts([row.y1938.wait, race.y1938.ride_min], row.y1938.total);
          const b = roundParts(
            [trip.board.walk_min, row.today.wait, trip.ride_min, trip.alight.walk_min],
            row.today.total,
          );
          computed = waitMostPredicate(row.result, a.shown[0]!, a.shownTotal, b.shown[1]!, b.shownTotal);
        }
        if (computed !== row.wait_most) mismatches.push(`${key} t=${row.t} result=${row.result} stored=${row.wait_most} computed=${computed}`);
      }
    }
    expect(rows).toBeGreaterThan(0);
    expect(mismatches).toEqual([]);
  });
});
