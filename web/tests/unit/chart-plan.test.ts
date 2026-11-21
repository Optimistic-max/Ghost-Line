// Task 10.1: chart geometry from a small made-up race (fake numbers, not real data).
import { describe, expect, it } from 'vitest';
import type { RaceRow } from '../../src/data/types';
import { chartPath, chartPlan } from '../../src/view/layout';

function row(t: string, total1938: number, today: number | null, before = false): RaceRow {
  return {
    t,
    start: t,
    before_table: before,
    y1938: { dep: t, wait: 1, total: total1938 },
    today: today === null ? null : { trip: 1, wait: 1, total: today },
    result: today === null ? 'no_one_seat_ride' : 'photo_finish',
    wait_most: false,
  };
}

describe('chartPlan', () => {
  const rows = [row('09:00', 10, 30, true), row('09:01', 12.5, 20, true), row('09:02', 8, 40)];

  it('has one column per row, stored series and a shared max', () => {
    const plan = chartPlan({ races: rows });
    expect(plan.columns).toBe(3);
    expect(plan.series1938).toEqual([10, 12.5, 8]);
    expect(plan.seriesToday).toEqual([30, 20, 40]);
    expect(plan.max).toBe(40);
  });

  it('takes the hatch range from before_table', () => {
    expect(chartPlan({ races: rows }).hatch).toEqual({ from: 0, to: 1 });
    expect(chartPlan({ races: [row('09:00', 5, 6)] }).hatch).toBeNull();
  });

  it('has no today series when no row has a one-seat ride', () => {
    const plan = chartPlan({ races: [row('09:00', 7, null), row('09:01', 9, null)] });
    expect(plan.seriesToday).toBeNull();
    expect(plan.max).toBe(9);
  });
});

describe('chartPath', () => {
  it('draws one flat step per column, with no smoothing', () => {
    expect(chartPath([10, 5, 0], 10, 100)).toBe('M-0.5 0 H0.5 V50 H1.5 V100 H2.5');
  });

  it('is empty for an empty series', () => {
    expect(chartPath([], 10, 100)).toBe('');
  });

  it('scales from 0 at the bottom to max at the top', () => {
    expect(chartPath([7.5], 10, 40)).toBe('M-0.5 10 H0.5');
  });
});
