// Task 6.1 and 6.2: reducers, the store, and derive() on the made-up fixture.
import { describe, expect, it, vi } from 'vitest';
import { pairKey } from '../../src/data/files';
import { sliderRange } from '../../src/data/lookup';
import type { Pair, RaceFile } from '../../src/data/types';
import { minutesOf } from '../../src/format/time';
import { type Action, initialState, reduce } from '../../src/state/actions';
import { derive } from '../../src/state/derive';
import type { AppState, MotionLevel } from '../../src/state/model';
import { createStore } from '../../src/state/store';
import { fixtureData } from '../support/fixture';

const data = fixtureData();
const [pairA, pairB] = data.index.pairs as [Pair, Pair];
const raceA = data.races.get(pairKey(pairA))!;
const { first, last } = sliderRange(raceA);
const lo = minutesOf(first);
const hi = minutesOf(last);
const start = { minute: lo, fromClock: true };

function run(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reduce, state);
}

function ready(motion: MotionLevel = 'full', race: RaceFile = raceA): AppState {
  return run(initialState({ origin: race.origin, dest: race.dest }, motion), {
    type: 'data/ready',
    index: data.index,
    summary: data.summary,
    race,
    start,
    guided: false,
  });
}

describe('data actions', () => {
  it('starts loading, with no minute yet', () => {
    const s = initialState(pairA, 'full');
    expect(s.data.status).toBe('loading');
    expect(s.minute).toBeNull();
    expect(derive(s)).toEqual({ status: 'loading' });
  });

  it('takes the default start once, and keeps the minute on a later boot (retry)', () => {
    const s = ready();
    expect(s.minute).toBe(lo);
    expect(s.minuteFromClock).toBe(true);
    const moved = run(s, { type: 'minute/set', minute: lo + 5 });
    const again = run(moved, { type: 'data/ready', index: data.index, summary: data.summary, race: raceA, start, guided: false });
    expect(again.minute).toBe(lo + 5);
    expect(again.minuteFromClock).toBe(false);
  });

  it('adds an on-demand race file to the cache', () => {
    const raceB = data.races.get(pairKey(pairB))!;
    const s = run(ready(), { type: 'data/race', race: raceB });
    expect(s.data.status === 'ready' && s.data.races.has(pairKey(pairB))).toBe(true);
  });

  it('goes to the data error and closes any sheet', () => {
    const s = run(ready(), { type: 'sheet/open', sheet: 'sources', target: 'x' }, { type: 'data/error' });
    expect(s.data.status).toBe('error');
    expect(s.sheet).toBeNull();
    expect(derive(s)).toEqual({ status: 'error' });
  });
});

describe('race lifecycle', () => {
  it('runs, shows the result while running, then finishes', () => {
    let s = run(ready(), { type: 'race/start' });
    expect(s.race).toEqual({ phase: 'running', resultShown: false });
    s = run(s, { type: 'race/result' });
    expect(s.race).toEqual({ phase: 'running', resultShown: true });
    s = run(s, { type: 'race/finish' });
    expect(s.race).toEqual({ phase: 'finished', resultShown: true });
  });

  it('skips to the finished state, before or after the result', () => {
    expect(run(ready(), { type: 'race/start' }, { type: 'race/skip' }).race).toEqual({ phase: 'finished', resultShown: true });
    expect(run(ready(), { type: 'race/start' }, { type: 'race/result' }, { type: 'race/skip' }).race.phase).toBe('finished');
  });

  it('stops a running race on any slider move, minus, plus or pair change', () => {
    const running = run(ready(), { type: 'race/start' });
    for (const action of [
      { type: 'minute/set', minute: lo + 3 },
      { type: 'minute/step', step: 1 },
      { type: 'pair/set', pair: pairB },
      { type: 'pair/swap' },
    ] as Action[]) {
      expect(run(running, action).race, action.type).toEqual({ phase: 'idle', resultShown: false });
    }
  });

  it('never runs with reduced motion: every change shows the finished state at once', () => {
    const s = ready('reduced');
    expect(s.race).toEqual({ phase: 'finished', resultShown: true });
    expect(run(s, { type: 'race/start' }).race.phase).toBe('finished');
    expect(run(s, { type: 'minute/set', minute: lo + 1 }).race).toEqual({ phase: 'finished', resultShown: true });
    expect(run(ready(), { type: 'race/start' }, { type: 'motion/set', level: 'reduced' }).race.phase).toBe('finished');
  });

  it('ignores lifecycle actions out of order', () => {
    const s = ready();
    expect(run(s, { type: 'race/result' })).toBe(s);
    expect(run(s, { type: 'race/finish' })).toBe(s);
    expect(run(s, { type: 'race/stop' })).toBe(s);
  });
});

describe('minute and pair', () => {
  it('keeps the minute inside the race file range', () => {
    const s = ready();
    expect(run(s, { type: 'minute/set', minute: lo - 1 })).toBe(s);
    expect(run(s, { type: 'minute/set', minute: hi + 1 })).toBe(s);
    expect(run(s, { type: 'minute/set', minute: lo + 0.5 })).toBe(s);
    expect(run(s, { type: 'minute/step', step: -1 })).toBe(s);
    const end = run(s, { type: 'minute/set', minute: hi });
    expect(run(end, { type: 'minute/step', step: 1 })).toBe(end);
    expect(run(end, { type: 'minute/step', step: -1 }).minute).toBe(hi - 1);
  });

  it('only sets a listed pair of two different corners', () => {
    const s = ready();
    expect(run(s, { type: 'pair/set', pair: { origin: pairA.origin, dest: pairA.origin } })).toBe(s);
    expect(run(s, { type: 'pair/set', pair: { origin: 'nowhere', dest: pairA.dest } })).toBe(s);
    expect(run(s, { type: 'pair/set', pair: pairA })).toBe(s);
    expect(run(s, { type: 'pair/set', pair: pairB }).pair).toEqual(pairB);
  });

  it('swaps the direction', () => {
    const swapped = run(ready(), { type: 'pair/swap' });
    expect(swapped.pair).toEqual({ origin: pairA.dest, dest: pairA.origin });
  });
});

describe('picker, sheets, banner and map', () => {
  it('picks a pair in two steps; the start cannot be chosen twice', () => {
    let s = run(ready(), { type: 'picker/open' });
    expect(s.sheet).toBe('corners');
    expect(s.picker).toEqual({ step: 'start' });
    s = run(s, { type: 'picker/choose', slug: pairB.origin });
    expect(s.picker).toEqual({ step: 'end', start: pairB.origin });
    expect(run(s, { type: 'picker/choose', slug: pairB.origin })).toBe(s);
    s = run(s, { type: 'picker/choose', slug: pairB.dest });
    expect(s.pair).toEqual(pairB);
    expect(s.picker).toBeNull();
    expect(s.sheet).toBeNull();
  });

  it('cancels the picker by closing the sheet, with the pair unchanged', () => {
    const s = run(ready(), { type: 'picker/open' }, { type: 'picker/choose', slug: pairB.origin }, { type: 'sheet/close' });
    expect(s.pair).toEqual(pairA);
    expect(s.picker).toBeNull();
  });

  it('opens the Sources sheet at a number and closes it', () => {
    const s = run(ready(), { type: 'sheet/open', sheet: 'sources', target: 'total-today' });
    expect([s.sheet, s.sourcesTarget]).toEqual(['sources', 'total-today']);
    expect(run(s, { type: 'sheet/close' })).toMatchObject({ sheet: null, sourcesTarget: null });
  });

  it('shows and hides banners and records the map status', () => {
    const s = run(ready(), { type: 'banner/show', banner: { kind: 'bad' } });
    expect(s.banner).toEqual({ kind: 'bad' });
    expect(run(s, { type: 'banner/hide' }).banner).toBeNull();
    expect(run(s, { type: 'map/status', status: 'unavailable' }).mapStatus).toBe('unavailable');
  });
});

describe('store', () => {
  it('notifies subscribers on a change only', () => {
    const store = createStore(ready());
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.dispatch({ type: 'race/result' });
    expect(listener).not.toHaveBeenCalled();
    store.dispatch({ type: 'race/start' });
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    store.dispatch({ type: 'race/skip' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get().race.phase).toBe('finished');
  });
});

describe('derive', () => {
  it('gives the race view of the pair and minute', () => {
    const d = derive(ready());
    expect(d.status).toBe('ready');
    if (d.status === 'ready') {
      expect(d.view.row.t).toBe(first);
      expect(d.view.pair).toEqual(pairA);
    }
  });

  it('is loading while a new pair race file is not here yet', () => {
    expect(derive(run(ready(), { type: 'pair/set', pair: pairB }))).toEqual({ status: 'loading' });
  });

  it('gives the data error when the parts cannot be shown consistently', () => {
    const broken = structuredClone(raceA);
    broken.races[0]!.y1938.total = broken.races[0]!.y1938.total + 5;
    expect(derive(ready('full', broken))).toEqual({ status: 'error' });
  });
});
