// @vitest-environment jsdom
// Task 4.2 property P4: the guided visit ends at the first Visitor_Input and stays ended.
import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';
import { EXAMPLE_START, LEAD_PAIR } from '../../src/config';
import { pairKey } from '../../src/data/files';
import { type Action, reduce } from '../../src/state/actions';
import { bootedState, moveActionArb, otherActionArb } from '../support/actions';
import { minutesOf } from '../../src/format/time';
import { bootPage } from '../support/page';
import { realData } from '../support/realdata';

const real = realData();
const leadRace = real.races.get(pairKey(LEAD_PAIR))!;

const readyAgainArb = fc.boolean().map(
  (guided): Action => ({
    type: 'data/ready',
    index: real.index,
    summary: real.summary,
    race: leadRace,
    start: { minute: 0, fromClock: true },
    guided,
  }),
);

const anyActionArb: fc.Arbitrary<Action> = fc.oneof(
  { weight: 6, arbitrary: moveActionArb },
  { weight: 6, arbitrary: otherActionArb },
  { weight: 2, arbitrary: fc.constant<Action>({ type: 'todaywin/select' }) },
  { weight: 2, arbitrary: fc.constant<Action>({ type: 'guided/end' }) },
  { weight: 1, arbitrary: fc.constant<Action>({ type: 'data/loading' }) },
  { weight: 1, arbitrary: readyAgainArb },
);

describe('guided visit (P4)', () => {
  it('Feature: story-layer, Property 4: Guided parts end at the first Visitor_Input and stay gone', () => {
    fc.assert(
      fc.property(fc.array(anyActionArb, { maxLength: 40 }), (actions) => {
        let state = bootedState();
        expect(state.guided).toBe(true);
        let ended = false;
        for (const action of actions) {
          if (action.type === 'guided/end') ended = true;
          state = reduce(state, action);
          expect(state.guided).toBe(!ended);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('Feature: story-layer, Property 4: Guided parts end at the first Visitor_Input and stay gone (skip, sheets, departures and route never change guided)', () => {
    fc.assert(
      fc.property(fc.array(otherActionArb, { maxLength: 30 }), (actions) => {
        let state = bootedState();
        for (const action of actions) {
          state = reduce(state, action);
          expect(state.guided).toBe(true);
        }
        state = reduce(state, { type: 'guided/end' });
        expect(state.guided).toBe(false);
        expect(reduce(state, { type: 'guided/end' })).toBe(state);
      }),
      { numRuns: 100 },
    );
  });
});

// Task 5.3 property P3: the start time follows the link's validity. The page boots for real (jsdom,
// the committed files, reduced motion so no timer is needed); the oracle below reads the query on its own.
afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
  window.history.replaceState(null, '', '/');
});

const slugPool = [...real.index.corners.map((c) => c.slug), 'nowhere', ''];
const fragmentArb = fc.oneof(
  fc.constantFrom(...slugPool).map((s) => `from=${s}`),
  fc.constantFrom(...slugPool).map((s) => `to=${s}`),
  fc.constant('utm_source=social'),
);
const pairQueryArb = fc.constantFrom(...real.index.pairs).map((p) => `?from=${p.origin}&to=${p.dest}`);
const queryArb = fc.oneof(
  { weight: 3, arbitrary: pairQueryArb },
  { weight: 1, arbitrary: fc.constant('') },
  { weight: 4, arbitrary: fc.array(fragmentArb, { maxLength: 4 }).map((f) => (f.length ? `?${f.join('&')}` : '')) },
);
// Any instant over the service weekend, to the minute, so both inside and outside the slider range occur.
const instantArb = fc.integer({ min: 0, max: 24 * 60 * 3 }).map((m) => new Date(Date.parse('2026-11-04T00:00:00-05:00') + m * 60_000 - 12 * 3600_000));

/** The New York minute of day, read another way than src/format/time. */
function newYorkMinuteOf(instant: Date): number {
  const [h, m] = instant.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit' }).split(':');
  return Number(h) * 60 + Number(m);
}

describe('guided boot (P3)', () => {
  it("Feature: story-layer, Property 3: The start time follows the link's validity", async () => {
    await fc.assert(
      fc.asyncProperty(queryArb, instantArb, async (query, instant) => {
        const params = new URLSearchParams(query);
        const from = params.getAll('from');
        const to = params.getAll('to');
        const named = real.index.pairs.find((p) => from.length === 1 && to.length === 1 && p.origin === from[0] && p.dest === to[0]);
        const app = await bootPage({ query, now: instant, motion: 'reduced' });
        const state = app.store.get();
        expect(state.data.status).toBe('ready');
        if (!named) {
          expect(state.guided).toBe(true);
          expect(state.minute).toBe(minutesOf(EXAMPLE_START));
          expect(state.minuteFromClock).toBe(false);
          return;
        }
        const race = real.races.get(pairKey(named))!;
        const lo = minutesOf(race.races[0]!.t);
        const hi = minutesOf(race.races.at(-1)!.t);
        const clock = newYorkMinuteOf(instant);
        const inside = clock >= lo && clock <= hi;
        expect(state.guided).toBe(false);
        expect(state.minute).toBe(inside ? clock : minutesOf(EXAMPLE_START));
        expect(state.minuteFromClock).toBe(inside);
        expect(state.minute).toBeGreaterThanOrEqual(lo);
        expect(state.minute).toBeLessThanOrEqual(hi);
      }),
      { numRuns: 100 },
    );
    // Each run boots the page; a busy machine needs the room.
  }, 60_000);
});
