// Task 4.2 property P4: the guided visit ends at the first Visitor_Input and stays ended.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import { pairKey } from '../../src/data/files';
import { type Action, reduce } from '../../src/state/actions';
import { bootedState, moveActionArb, otherActionArb } from '../support/actions';
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
