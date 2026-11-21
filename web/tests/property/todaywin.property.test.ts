// Task 4.2 properties P10 and P11: the today-win shortcut and its notice.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { pairKey } from '../../src/data/files';
import { sliderRange } from '../../src/data/lookup';
import type { Summary, TodayWin } from '../../src/data/types';
import { encode } from '../../src/format/share';
import { minutesOf } from '../../src/format/time';
import { initialState, reduce } from '../../src/state/actions';
import { HI, LO, bootedState, moveActionArb, otherActionArb, run } from '../support/actions';
import { fixtureData } from '../support/fixture';
import { realData } from '../support/realdata';

const real = realData();
const fixture = fixtureData();

function clock(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

/** A made-up list over real pairs; times stay inside the lead race's slider range. */
const listArb: fc.Arbitrary<TodayWin[]> = fc.array(
  fc.record({
    pair: fc.constantFrom(...real.index.pairs),
    minute: fc.integer({ min: LO, max: HI }),
    margin: fc.double({ min: 1, max: 30, noNaN: true }),
  }),
  { minLength: 1, maxLength: 12 },
).map((rows) => rows.map((r) => ({ origin: r.pair.origin, dest: r.pair.dest, t: clock(r.minute), margin: r.margin })));

function withList(list: TodayWin[]): Summary {
  return { ...real.summary, today_wins: list };
}

function checkPresses(list: readonly TodayWin[], summary: Summary, presses: number): void {
  let state = bootedState(summary);
  for (let k = 1; k <= presses; k++) {
    state = reduce(state, { type: 'todaywin/select' });
    const entry = list[(k - 1) % list.length]!;
    expect(state.todayWinNotice).toEqual(entry);
    expect(state.pair).toEqual({ origin: entry.origin, dest: entry.dest });
    expect(encode(state.pair)).toBe(encode({ origin: entry.origin, dest: entry.dest }));
    expect(state.minute).toBe(minutesOf(entry.t));
  }
}

describe('today-win shortcut (P10)', () => {
  it('Feature: story-layer, Property 10: The today-win shortcut walks the list in file order (made-up lists)', () => {
    fc.assert(
      fc.property(listArb, fc.integer({ min: 1, max: 40 }), (list, presses) => {
        checkPresses(list, withList(list), presses);
      }),
      { numRuns: 200 },
    );
  });

  it('Feature: story-layer, Property 10: The today-win shortcut walks the list in file order (real summary)', () => {
    const list = real.summary.today_wins;
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 3 * list.length + 1 }), (presses) => {
        checkPresses(list, real.summary, presses);
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: story-layer, Property 10: The today-win shortcut walks the list in file order (fixture summary)', () => {
    const list = fixture.summary.today_wins;
    const [first] = fixture.index.pairs;
    const race = fixture.races.get(pairKey(first!))!;
    expect(list.length).toBeGreaterThan(0);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (presses) => {
        let state = reduce(initialState(first!, 'full'), {
          type: 'data/ready',
          index: fixture.index,
          summary: fixture.summary,
          race,
          start: { minute: minutesOf(sliderRange(race).first), fromClock: false },
          guided: true,
        });
        for (let k = 1; k <= presses; k++) {
          state = reduce(state, { type: 'todaywin/select' });
          const entry = list[(k - 1) % list.length]!;
          expect(state.todayWinNotice).toEqual(entry);
          expect(state.pair).toEqual({ origin: entry.origin, dest: entry.dest });
          expect(state.minute).toBe(minutesOf(entry.t));
        }
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: story-layer, Property 10: an empty list does nothing', () => {
    fc.assert(
      fc.property(fc.array(fc.oneof(moveActionArb, otherActionArb), { maxLength: 10 }), (prefix) => {
        const state = run(bootedState(withList([])), prefix);
        expect(reduce(state, { type: 'todaywin/select' })).toBe(state);
      }),
      { numRuns: 100 },
    );
  });
});

describe('today-win notice (P11)', () => {
  it('Feature: story-layer, Property 11: The today-win notice leaves with the next pair or time change', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(moveActionArb, otherActionArb), { maxLength: 8 }),
        fc.oneof(moveActionArb, otherActionArb),
        (prefix, action) => {
          const before = reduce(run(bootedState(), prefix), { type: 'todaywin/select' });
          expect(before.todayWinNotice).not.toBeNull();
          const after = reduce(before, action);
          const changed = after.pair.origin !== before.pair.origin || after.pair.dest !== before.pair.dest || after.minute !== before.minute;
          if (changed) expect(after.todayWinNotice).toBeNull();
          else expect(after.todayWinNotice).toBe(before.todayWinNotice);
        },
      ),
      { numRuns: 300 },
    );
  });
});
