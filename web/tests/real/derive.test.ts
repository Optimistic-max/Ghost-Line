// Task 6.4 (P9): for every pair and every minute of the real files, the view's
// result, margin sign and winner colour equal the stored row; shown totals are
// the stored totals rounded; each lane's shown parts add up; and the result
// moment is the first arrival for a win and the later one for a photo finish.
// Expected values are read from the files.
import { describe, expect, it } from 'vitest';
import type { RaceResult } from '../../src/data/types';
import { roundTotal, sumShown } from '../../src/format/rounding';
import { ends, resultAt } from '../../src/play/timeline';
import { buildView } from '../../src/state/derive';
import type { RaceView } from '../../src/state/model';
import { raceOf, realData } from '../support/realdata';

const EXPECTED_COLOUR: Record<RaceResult, string> = {
  '1938': 'ghost',
  today: 'today',
  photo_finish: 'ink',
  no_one_seat_ride: 'ink',
};

const { index, summary } = realData();

/** Every view of every real race file. */
function allViews(): { view: RaceView; label: string }[] {
  const out: { view: RaceView; label: string }[] = [];
  for (const pair of index.pairs) {
    const race = raceOf(pair);
    for (const row of race.races) {
      out.push({ view: buildView(index, summary, race, row.t), label: `${pair.origin}__${pair.dest} ${row.t}` });
    }
  }
  return out;
}

const views = allViews();

describe('the view of every real race (P9)', () => {
  it('covers every row of every pair', () => {
    const rows = index.pairs.reduce((n, pair) => n + raceOf(pair).races.length, 0);
    expect(views).toHaveLength(rows);
  });

  it('shows the stored result and its colour', () => {
    for (const { view, label } of views) {
      expect(view.result, label).toBe(view.row.result);
      expect(view.resultView.kind, label).toBe(view.row.result);
      expect(view.colour, label).toBe(EXPECTED_COLOUR[view.row.result]);
    }
  });

  it('shows each stored total rounded, with shown parts that add up to it', () => {
    for (const { view, label } of views) {
      const lanes = [
        [view.lane1938, view.row.y1938.total],
        [view.laneToday, view.row.today?.total],
      ] as const;
      for (const [lane, stored] of lanes) {
        if (!lane || stored === undefined) continue;
        expect(lane.storedTotal, label).toBe(stored);
        expect(lane.shownTotal, label).toBe(roundTotal(stored));
        expect(sumShown(lane.phases.map((p) => p.shown)), label).toBe(lane.shownTotal);
      }
    }
  });

  it('reads every phase from the file', () => {
    for (const { view, label } of views) {
      const race = raceOf(view.pair);
      expect(view.lane1938.phases.map((p) => p.stored), label).toEqual([view.row.y1938.wait, race.y1938.ride_min]);
      if (view.row.today && view.trip && view.laneToday) {
        expect(view.trip).toBe(race.today.trips[view.row.today.trip]);
        expect(view.laneToday.phases.map((p) => p.stored), label).toEqual([
          view.trip.board.walk_min,
          view.row.today.wait,
          view.trip.ride_min,
          view.trip.alight.walk_min,
        ]);
      }
    }
  });

  it('gives the winner the smaller shown total, and a win a shown margin of at least one minute', () => {
    for (const { view, label } of views) {
      const a = view.lane1938.shownTotal;
      const b = view.laneToday?.shownTotal;
      const rv = view.resultView;
      if (rv.kind === '1938' || rv.kind === 'today') {
        expect(b, label).toBeDefined();
        const [winner, loser] = rv.kind === '1938' ? [a, b!] : [b!, a];
        expect(winner, label).toBeLessThan(loser);
        expect(rv.shownMargin, label).toBe(loser - winner);
        expect(rv.shownMargin, label).toBeGreaterThanOrEqual(1);
      } else if (rv.kind === 'photo_finish') {
        expect(Math.abs(a - b!), label).toBeLessThanOrEqual(1);
        if (rv.totals.form === 'both') expect(a, label).toBe(b);
        else expect([rv.totals.n, rv.totals.m], label).toEqual([Math.min(a, b!), Math.max(a, b!)]);
      }
    }
  });

  it('shows the result at the first arrival for a win and at the later one for a photo finish', () => {
    for (const { view, label } of views) {
      const { end1938, endToday } = ends(view);
      const at = resultAt(view);
      if (endToday === null) {
        expect(at, label).toBe(end1938);
      } else if (view.result === 'photo_finish') {
        expect(at, label).toBe(Math.max(end1938, endToday));
      } else {
        expect(at, label).toBe(Math.min(end1938, endToday));
      }
    }
  });

  it('starts the board at the row: the next car and the next bus first', () => {
    for (const { view, label } of views) {
      expect(view.board.after, label).toBe(view.row.start);
      expect(view.board.cars[0], label).toBe(view.row.y1938.dep);
      if (view.trip) expect(view.board.buses[0], label).toBe(view.trip);
    }
  });

  it('uses the today-wins form of the honest line exactly when today wins, with counts from summary.json', () => {
    for (const { view, label } of views) {
      expect(view.honest.form === 'today-wins', label).toBe(view.row.result === 'today');
      expect(view.honest.wins1938).toBe(summary.wins_1938);
      expect(view.honest.races).toBe(summary.races);
    }
  });

  it('names the notices from the row and the file', () => {
    for (const { view, label } of views) {
      expect(view.notices.includes('before-table'), label).toBe(view.row.before_table);
      expect(view.notices.includes('inferred'), label).toBe(raceOf(view.pair).inferred);
    }
  });
});
