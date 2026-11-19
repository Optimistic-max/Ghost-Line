// Task 6.4 (P9): for every pair and every minute of the real files, the view's
// result, margin sign and winner colour equal the stored row; shown totals are
// the stored totals rounded; each lane's shown parts add up; and the result
// moment is the first arrival for a win and the later one for a photo finish.
// Expected values are read from the files.
//
// Each test checks all views and collects every mismatch, then asserts the list
// is empty: one assertion per test keeps the run fast and the report readable.
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

type Labelled = { view: RaceView; label: string };

/** Every view of every real race file. */
function allViews(): Labelled[] {
  const out: Labelled[] = [];
  for (const pair of index.pairs) {
    const race = raceOf(pair);
    for (const row of race.races) {
      out.push({ view: buildView(index, summary, race, row.t), label: `${pair.origin}__${pair.dest} ${row.t}` });
    }
  }
  return out;
}

const views = allViews();

/** The labels of the views for which `check` returns a problem. */
function problems(check: (view: RaceView) => string | null): string[] {
  const found: string[] = [];
  for (const { view, label } of views) {
    const problem = check(view);
    if (problem) found.push(`${label}: ${problem}`);
  }
  return found;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

describe('the view of every real race (P9)', () => {
  it('covers every row of every pair', () => {
    const rows = index.pairs.reduce((n, pair) => n + raceOf(pair).races.length, 0);
    expect(views).toHaveLength(rows);
  });

  it('shows the stored result and its colour', () => {
    expect(
      problems((v) => {
        if (v.result !== v.row.result || v.resultView.kind !== v.row.result) return `result ${v.result}, row ${v.row.result}`;
        if (v.colour !== EXPECTED_COLOUR[v.row.result]) return `colour ${v.colour}`;
        return null;
      }),
    ).toEqual([]);
  });

  it('shows each stored total rounded, with shown parts that add up to it', () => {
    expect(
      problems((v) => {
        const lanes = [
          [v.lane1938, v.row.y1938.total],
          [v.laneToday, v.row.today?.total],
        ] as const;
        for (const [lane, stored] of lanes) {
          if (!lane || stored === undefined) continue;
          if (lane.storedTotal !== stored) return `${lane.side} stored total ${lane.storedTotal}, row ${stored}`;
          if (lane.shownTotal !== roundTotal(stored)) return `${lane.side} shown total ${lane.shownTotal}`;
          const sum = sumShown(lane.phases.map((p) => p.shown));
          if (sum !== lane.shownTotal) return `${lane.side} parts add up to ${sum}, not ${lane.shownTotal}`;
        }
        return null;
      }),
    ).toEqual([]);
  });

  it('reads every phase from the file', () => {
    expect(
      problems((v) => {
        const race = raceOf(v.pair);
        if (!same(v.lane1938.phases.map((p) => p.stored), [v.row.y1938.wait, race.y1938.ride_min])) return '1938 phases';
        if (v.row.today && v.trip && v.laneToday) {
          if (v.trip !== race.today.trips[v.row.today.trip]) return 'trip';
          const expected = [v.trip.board.walk_min, v.row.today.wait, v.trip.ride_min, v.trip.alight.walk_min];
          if (!same(v.laneToday.phases.map((p) => p.stored), expected)) return 'bus phases';
        }
        return null;
      }),
    ).toEqual([]);
  });

  it('gives the winner the smaller shown total, and a win a shown margin of at least one minute', () => {
    expect(
      problems((v) => {
        const a = v.lane1938.shownTotal;
        const b = v.laneToday?.shownTotal;
        const rv = v.resultView;
        if (rv.kind === '1938' || rv.kind === 'today') {
          if (b === undefined) return 'a win without a bus total';
          const [winner, loser] = rv.kind === '1938' ? [a, b] : [b, a];
          if (!(winner < loser)) return `winner ${winner}, loser ${loser}`;
          if (rv.shownMargin !== loser - winner) return `margin ${rv.shownMargin}`;
          if (rv.shownMargin < 1) return `margin ${rv.shownMargin} under one minute`;
        } else if (rv.kind === 'photo_finish') {
          if (b === undefined || Math.abs(a - b) > 1) return `photo finish totals ${a} and ${b}`;
          if (rv.totals.form === 'both' ? a !== b : !same([rv.totals.n, rv.totals.m], [Math.min(a, b), Math.max(a, b)])) {
            return 'photo finish copy totals';
          }
        }
        return null;
      }),
    ).toEqual([]);
  });

  it('shows the result at the first arrival for a win and at the later one for a photo finish', () => {
    expect(
      problems((v) => {
        const { end1938, endToday } = ends(v);
        const at = resultAt(v);
        const expected =
          endToday === null ? end1938 : v.result === 'photo_finish' ? Math.max(end1938, endToday) : Math.min(end1938, endToday);
        return at === expected ? null : `result at ${at}, expected ${expected}`;
      }),
    ).toEqual([]);
  });

  it('starts the board at the row: the next car and the next bus first', () => {
    expect(
      problems((v) => {
        if (v.board.after !== v.row.start) return 'board start';
        if (v.board.cars[0] !== v.row.y1938.dep) return 'first car';
        if (v.trip && v.board.buses[0] !== v.trip) return 'first bus';
        return null;
      }),
    ).toEqual([]);
  });

  it('uses the today-wins form of the honest line exactly when today wins, with counts from summary.json', () => {
    expect(
      problems((v) => {
        if ((v.honest.form === 'today-wins') !== (v.row.result === 'today')) return `form ${v.honest.form}`;
        if (v.honest.wins1938 !== summary.wins_1938 || v.honest.races !== summary.races) return 'counts';
        return null;
      }),
    ).toEqual([]);
  });

  it('names the notices from the row and the file', () => {
    expect(
      problems((v) => {
        if (v.notices.includes('before-table') !== v.row.before_table) return 'before-table notice';
        if (v.notices.includes('inferred') !== raceOf(v.pair).inferred) return 'inferred notice';
        return null;
      }),
    ).toEqual([]);
  });
});
