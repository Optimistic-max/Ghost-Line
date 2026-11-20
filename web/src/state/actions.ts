// Pure reducers for the race screen (design 4). Each returns the same state
// object when nothing changes, so subscribers are not called.
import { pairKey } from '../data/files';
import { hasPair, sliderRange } from '../data/lookup';
import type { Index, Pair, RaceFile, Summary } from '../data/types';
import { type DefaultStart, minutesOf, stepMinute } from '../format/time';
import type { AppState, Banner, MapStatus, MotionLevel, SheetName } from './model';

export type Action =
  | { type: 'data/loading' }
  /** Boot succeeded. `start` is the default start (R3.4), used only if no minute is set yet. */
  | { type: 'data/ready'; index: Index; summary: Summary; race: RaceFile; start: DefaultStart }
  /** An on-demand race file arrived. */
  | { type: 'data/race'; race: RaceFile }
  | { type: 'data/error' }
  | { type: 'pair/set'; pair: Pair }
  | { type: 'pair/swap' }
  | { type: 'minute/set'; minute: number }
  | { type: 'minute/step'; step: -1 | 1 }
  | { type: 'race/start' }
  | { type: 'race/result' }
  | { type: 'race/finish' }
  | { type: 'race/skip' }
  | { type: 'race/stop' }
  | { type: 'motion/set'; level: MotionLevel }
  | { type: 'sheet/open'; sheet: Exclude<SheetName, 'corners'>; target?: string }
  | { type: 'sheet/close' }
  | { type: 'picker/open' }
  | { type: 'picker/choose'; slug: string }
  /** A corner tapped on the map is the start: on a phone in the Corners sheet, on desktop over the map (design 12.4). */
  | { type: 'picker/start'; slug: string; sheet: boolean }
  | { type: 'picker/cancel' }
  | { type: 'banner/show'; banner: Banner }
  | { type: 'banner/hide' }
  | { type: 'map/status'; status: MapStatus };

const IDLE: AppState['race'] = { phase: 'idle', resultShown: false };
const FINISHED: AppState['race'] = { phase: 'finished', resultShown: true };

export function initialState(pair: Pair, motion: MotionLevel): AppState {
  return {
    data: { status: 'loading' },
    pair,
    minute: null,
    minuteFromClock: false,
    race: IDLE,
    motion,
    sheet: null,
    sourcesTarget: null,
    picker: null,
    banner: null,
    mapStatus: 'pending',
  };
}

/** After a change of pair or minute a running race stops (R3.5); with reduced motion the finished state shows at once (R5.11). */
function reset(state: AppState): AppState['race'] {
  return state.motion === 'reduced' ? FINISHED : IDLE;
}

function currentRace(state: AppState): RaceFile | undefined {
  return state.data.status === 'ready' ? state.data.races.get(pairKey(state.pair)) : undefined;
}

function setPair(state: AppState, pair: Pair): AppState {
  if (pair.origin === pair.dest) return state;
  if (pair.origin === state.pair.origin && pair.dest === state.pair.dest) return state;
  if (state.data.status === 'ready' && !hasPair(state.data.index, pair)) return state;
  const sheet = state.sheet === 'corners' ? null : state.sheet;
  return { ...state, pair, race: reset(state), picker: null, sheet };
}

function setMinute(state: AppState, minute: number): AppState {
  if (!Number.isInteger(minute) || minute === state.minute) return state;
  const race = currentRace(state);
  if (race) {
    const { first, last } = sliderRange(race);
    if (minute < minutesOf(first) || minute > minutesOf(last)) return state;
  }
  return { ...state, minute, minuteFromClock: false, race: reset(state) };
}

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'data/loading':
      return { ...state, data: { status: 'loading' }, race: IDLE };

    case 'data/ready': {
      const races = new Map(state.data.status === 'ready' ? state.data.races : []);
      races.set(pairKey({ origin: action.race.origin, dest: action.race.dest }), action.race);
      const fresh = state.minute === null;
      return {
        ...state,
        data: { status: 'ready', index: action.index, summary: action.summary, races },
        minute: fresh ? action.start.minute : state.minute,
        minuteFromClock: fresh ? action.start.fromClock : state.minuteFromClock,
        race: reset(state),
      };
    }

    case 'data/race': {
      if (state.data.status !== 'ready') return state;
      const races = new Map(state.data.races);
      races.set(pairKey({ origin: action.race.origin, dest: action.race.dest }), action.race);
      return { ...state, data: { ...state.data, races } };
    }

    case 'data/error':
      return { ...state, data: { status: 'error' }, race: IDLE, sheet: null, sourcesTarget: null, picker: null };

    case 'pair/set':
      return setPair(state, action.pair);

    case 'pair/swap':
      return setPair(state, { origin: state.pair.dest, dest: state.pair.origin });

    case 'minute/set':
      return setMinute(state, action.minute);

    case 'minute/step': {
      const race = currentRace(state);
      if (!race || state.minute === null) return state;
      const { first, last } = sliderRange(race);
      return setMinute(state, stepMinute(state.minute, action.step, first, last));
    }

    case 'race/start':
      if (state.race.phase !== 'idle') return state;
      return { ...state, race: state.motion === 'reduced' ? FINISHED : { phase: 'running', resultShown: false } };

    case 'race/result':
      if (state.race.phase !== 'running' || state.race.resultShown) return state;
      return { ...state, race: { phase: 'running', resultShown: true } };

    case 'race/finish':
    case 'race/skip':
      return state.race.phase === 'running' ? { ...state, race: FINISHED } : state;

    case 'race/stop':
      return state.race.phase === 'idle' ? state : { ...state, race: reset(state) };

    case 'motion/set': {
      if (action.level === state.motion) return state;
      const race = action.level === 'reduced' && state.race.phase === 'running' ? FINISHED : state.race;
      return { ...state, motion: action.level, race };
    }

    case 'sheet/open':
      return { ...state, sheet: action.sheet, sourcesTarget: action.target ?? null, picker: null };

    case 'sheet/close':
      return state.sheet === null ? state : { ...state, sheet: null, sourcesTarget: null, picker: null };

    case 'picker/open':
      return { ...state, sheet: 'corners', picker: { step: 'start' }, sourcesTarget: null };

    case 'picker/choose': {
      const { picker } = state;
      if (!picker) return state;
      if (picker.step === 'start') return { ...state, picker: { step: 'end', start: action.slug } };
      // The start is disabled in the second step (R4.1).
      if (action.slug === picker.start) return state;
      return setPair({ ...state, picker: null, sheet: null }, { origin: picker.start, dest: action.slug });
    }

    case 'picker/start': {
      if (state.data.status !== 'ready' || !state.data.index.corners.some((c) => c.slug === action.slug)) return state;
      const sheet = action.sheet ? 'corners' : state.sheet === 'corners' ? null : state.sheet;
      return { ...state, picker: { step: 'end', start: action.slug }, sheet, sourcesTarget: null };
    }

    case 'picker/cancel':
      if (state.picker === null) return state;
      return { ...state, picker: null, sheet: state.sheet === 'corners' ? null : state.sheet };

    case 'banner/show':
      return { ...state, banner: action.banner };

    case 'banner/hide':
      return state.banner === null ? state : { ...state, banner: null };

    case 'map/status':
      return action.status === state.mapStatus ? state : { ...state, mapStatus: action.status };
  }
}
