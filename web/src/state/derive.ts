// State and data to the RaceView (design 5). Lookups and display rounding only:
// every time, duration, result and count is read from the files. Nothing here
// adds, subtracts or compares stored minutes.
import { BOARD } from '../config';
import { pairKey } from '../data/files';
import { cornerName, nextAfter, rowAt, tripAt } from '../data/lookup';
import type { Index, RaceFile, RaceResult, RaceRow, Summary, Trip } from '../data/types';
import { boardGaps, boardSpacing1938, gapPart, spacing1938 } from '../format/gaps';
import { joinNames } from '../format/list';
import { RoundingError, photoTotals, roundParts, shownMargin, sumShown } from '../format/rounding';
import { clockOf, dropSeconds, label12, serviceDateLabel } from '../format/time';
import { ghostPlanOf } from '../play/timeline';
import type { AppState, Board, Derived, Frequency, Honest, Lane, Notice, PhaseKind, RaceView, ResultColour, ResultView, Side } from './model';

/** Data that cannot be shown consistently. derive() turns it into the data-error state. */
export class ViewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ViewError';
  }
}

const COLOURS: Record<RaceResult, ResultColour> = {
  '1938': 'ghost',
  today: 'today',
  photo_finish: 'ink',
  no_one_seat_ride: 'ink',
};

/** Which honest line goes under each result (product.md rule 6; the photo-finish line is polish brief P3). */
const HONEST_FORM: Record<RaceResult, Honest['form']> = {
  '1938': 'plain',
  today: 'today-wins',
  photo_finish: 'photo-finish',
  no_one_seat_ride: 'plain',
};

function lane(side: Side, kinds: PhaseKind[], stored: number[], storedTotal: number, next: string): Lane {
  const { shown, shownTotal } = roundParts(stored, storedTotal);
  return {
    side,
    phases: kinds.map((kind, i) => ({ side, kind, stored: stored[i] ?? 0, shown: shown[i] ?? 0 })),
    storedTotal,
    shownTotal,
    next,
  };
}

function lane1938(race: RaceFile, row: RaceRow): Lane {
  return lane('1938', ['wait', 'ride'], [row.y1938.wait, race.y1938.ride_min], row.y1938.total, row.y1938.dep);
}

function laneToday(row: RaceRow, trip: Trip): Lane {
  if (!row.today) throw new ViewError('no bus side');
  return lane(
    'today',
    ['walk-to-stop', 'wait', 'ride', 'walk-from-stop'],
    [trip.board.walk_min, row.today.wait, trip.ride_min, trip.alight.walk_min],
    row.today.total,
    dropSeconds(trip.dep),
  );
}

function resultView(result: RaceResult, a: Lane, b: Lane | null): ResultView {
  if (result === 'no_one_seat_ride') return { kind: result };
  if (!b) throw new ViewError(`${result} without a bus side`);
  if (result === 'photo_finish') return { kind: result, totals: photoTotals(a.shownTotal, b.shownTotal) };
  return { kind: result, shownMargin: shownMargin(a.shownTotal, b.shownTotal) };
}

function board(race: RaceFile, row: RaceRow, trip: Trip | null): Board {
  const { today, y1938 } = race;
  return {
    after: row.start,
    cars: nextAfter(y1938.passes, row.y1938.dep, BOARD.cars1938),
    buses: trip ? nextAfter(today.trips, trip, BOARD.buses) : [],
    spacing1938: boardSpacing1938(y1938.gap_min, y1938.gap_max),
    busGaps: today.gap_min === null || today.gap_max === null ? null : boardGaps(today.gap_min, today.gap_max),
  };
}

function frequency(race: RaceFile): Frequency | null {
  const { today, y1938 } = race;
  if (today.gap_min === null || today.gap_max === null) return null;
  return {
    gapPart: gapPart(today.gap_min, today.gap_max),
    windowFrom: label12(today.window_from),
    windowTo: label12(today.window_to),
    routeNames: joinNames(today.route_names),
    date: serviceDateLabel(race.service_date),
    spacing1938: spacing1938(y1938.gap_min, y1938.gap_max),
  };
}

/** The view of one race file at slider time `hhmm`. Throws ViewError or RoundingError on data it cannot show. */
export function buildView(index: Index, summary: Summary, race: RaceFile, hhmm: string): RaceView {
  const row = rowAt(race, hhmm);
  if (!row) throw new ViewError(`no row at ${hhmm}`);
  const trip = row.today ? (tripAt(race, row.today.trip) ?? null) : null;
  if (row.today && !trip) throw new ViewError(`no trip ${row.today.trip}`);
  const originName = cornerName(index, race.origin);
  const destName = cornerName(index, race.dest);
  if (!originName || !destName) throw new ViewError('unknown corner');

  const old = lane1938(race, row);
  const now = row.today && trip ? laneToday(row, trip) : null;
  const notices: Notice[] = [];
  if (row.before_table) notices.push('before-table');
  if (race.inferred) notices.push('inferred');
  const walks = now ? now.phases.filter((p) => p.kind === 'walk-to-stop' || p.kind === 'walk-from-stop') : [];

  const walkShown = now ? sumShown(walks.map((p) => p.shown)) : null;
  const shownOf = (l: Lane, kind: PhaseKind): number => l.phases.find((p) => p.kind === kind)?.shown ?? 0;

  return {
    pair: { origin: race.origin, dest: race.dest },
    originName,
    destName,
    row,
    trip,
    start: row.start,
    beforeTable: row.before_table,
    inferred: race.inferred,
    result: row.result,
    resultView: resultView(row.result, old, now),
    colour: COLOURS[row.result],
    lane1938: old,
    laneToday: now,
    walkShown,
    notices,
    board: board(race, row, trip),
    frequency: frequency(race),
    honest: { form: HONEST_FORM[row.result], wins1938: summary.wins_1938, races: summary.races },
    takeaway: {
      wait1938: shownOf(old, 'wait'),
      ride1938: shownOf(old, 'ride'),
      today:
        now && walkShown !== null ? { wait: shownOf(now, 'wait'), walk: walkShown, ride: shownOf(now, 'ride') } : null,
      waitMost: row.wait_most,
    },
    ghosts: ghostPlanOf(race, row),
  };
}

/** The screen's view of the state: loading, the data error, or a race view. */
export function derive(state: AppState): Derived {
  const { data } = state;
  if (data.status === 'error') return { status: 'error' };
  if (data.status === 'loading') return { status: 'loading' };
  const race = data.races.get(pairKey(state.pair));
  if (!race || state.minute === null) return { status: 'loading' };
  try {
    return { status: 'ready', view: buildView(data.index, data.summary, race, clockOf(state.minute)) };
  } catch (error) {
    if (error instanceof ViewError || error instanceof RoundingError) return { status: 'error' };
    throw error;
  }
}
