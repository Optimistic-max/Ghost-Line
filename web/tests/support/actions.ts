// Shared helpers for the reducer property tests (story-layer Properties 4, 10, 11).
import fc from 'fast-check';
import { LEAD_PAIR } from '../../src/config';
import { pairKey } from '../../src/data/files';
import { sliderRange } from '../../src/data/lookup';
import type { Pair, Summary } from '../../src/data/types';
import { minutesOf } from '../../src/format/time';
import { type Action, initialState, reduce } from '../../src/state/actions';
import type { AppState } from '../../src/state/model';
import { realData } from './realdata';

const real = realData();
const leadRace = real.races.get(pairKey(LEAD_PAIR))!;
const range = sliderRange(leadRace);
export const LO = minutesOf(range.first);
export const HI = minutesOf(range.last);

/** A booted state on the real index with the lead race cached and the given summary. */
export function bootedState(summary: Summary = real.summary, guided = true): AppState {
  return reduce(initialState({ origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest }, 'full'), {
    type: 'data/ready',
    index: real.index,
    summary,
    race: leadRace,
    start: { minute: LO, fromClock: false },
    guided,
  });
}

export function run(state: AppState, actions: readonly Action[]): AppState {
  return actions.reduce(reduce, state);
}

const pairArb: fc.Arbitrary<Pair> = fc.constantFrom(...real.index.pairs);
const slugArb = fc.constantFrom(...real.index.corners.map((c) => c.slug));
const minuteArb = fc.integer({ min: LO - 5, max: HI + 5 });

/** Actions that change the pair or the minute, or may (rejected ones are fine). */
export const moveActionArb: fc.Arbitrary<Action> = fc.oneof(
  pairArb.map((pair): Action => ({ type: 'pair/set', pair })),
  fc.constant<Action>({ type: 'pair/swap' }),
  minuteArb.map((minute): Action => ({ type: 'minute/set', minute })),
  fc.constantFrom<-1 | 1>(-1, 1).map((step): Action => ({ type: 'minute/step', step })),
  slugArb.map((slug): Action => ({ type: 'picker/choose', slug })),
  slugArb.map((slug): Action => ({ type: 'picker/start', slug, sheet: true })),
);

/** Actions that never change the pair or the minute. */
export const otherActionArb: fc.Arbitrary<Action> = fc.oneof(
  fc.constantFrom<Action>(
    { type: 'race/start' },
    { type: 'race/result' },
    { type: 'race/finish' },
    { type: 'race/skip' },
    { type: 'race/stop' },
    { type: 'race/oriented' },
    { type: 'departures/toggle' },
    { type: 'route/toggle' },
    { type: 'sheet/close' },
    { type: 'picker/open' },
    { type: 'picker/cancel' },
    { type: 'banner/hide' },
    { type: 'map/status', status: 'ready' },
  ),
  fc.constantFrom<'sources' | 'about' | 'whentoday'>('sources', 'about', 'whentoday').map(
    (sheet): Action => ({ type: 'sheet/open', sheet }),
  ),
  fc.constantFrom<'full' | 'reduced'>('full', 'reduced').map((level): Action => ({ type: 'motion/set', level })),
);
