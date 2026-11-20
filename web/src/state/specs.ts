// The source of every number the card prints (design 10, R9.4): what it is,
// where it comes from, how it was worked out and the date of the data. Built
// from the view and the files by lookups and display rounding only.
import {
  METHOD_CAR_1938,
  METHOD_MARGIN,
  METHOD_RACE_COUNTS,
  METHOD_RIDE_1938,
  METHOD_RIDE_BUS,
  METHOD_RIDE_VERDICTS,
  METHOD_TOTAL_1938,
  METHOD_WAIT_BUS,
  WHAT,
  frequency,
  methodBusTrip,
  methodNextCar,
  methodTotalToday,
  methodWalk,
  minShort,
  whatAt,
  whatBetween,
  whatBusGaps,
  whatFrom,
} from '../copy/copy';
import type { RaceFile, SourceId, Summary, Trip } from '../data/types';
import { formatCount } from '../format/count';
import { gapPart, spacing1938 } from '../format/gaps';
import { isPlainRounding, roundWhole } from '../format/rounding';
import { dropSeconds, label12, shortClock } from '../format/time';
import type { Lane, Phase, RaceView } from './model';

/** Which date line a Sources row carries (R9.4): the 1938 timetable's, the feed's, or both. */
export type DateKind = 'effective' | 'feed' | 'both';

export type SourceSpec = {
  /** Stable per number on screen, for example "wait-1938" or "board-today-1". */
  id: string;
  /** The value as the row opens with it: "6 min", "10:06" or a count with its thousands comma. */
  value: string;
  /** What it is, as the number button's name says it. */
  what: string;
  /** What it is, as the Sources row says it (extended with the pair, time or corner). */
  rowWhat: string;
  /** Catalog entries that cover it, in order. */
  sourceIds: SourceId[];
  /** A more specific link from the race file (the 1938 diagram or timetable page), when there is one. */
  url?: string;
  /** How it was worked out, one line. */
  method: string;
  date: DateKind;
  /** For bus numbers: the trip's route and headsign (the only place headsigns are shown). */
  trip?: { route: string; headsign: string };
  /** For a bus wait, ride or total: the trip's own line, naming its route and headsign, when the method line does not. */
  tripLine?: string;
  /** A walk: the row adds "estimate" and the method entry's own text (R9.5). */
  walk?: boolean;
  /** A shown part that is not the plain rounding of its stored value (R7.7). */
  exact?: { stored: number; shownTotal: number };
};

/**
 * A number on screen with its source: `text` as printed alone ("15 min"), `bare`
 * inside a sentence whose template carries the unit ("15"), `spoken` in its
 * button's name, `n` for the minute words.
 */
export type Num = { spec: SourceSpec; text: string; bare: string; spoken: string; n: number };

/** The minute counts as spoken in a number button's name, for example "9 minutes" (built by the view). */
export type Spoken = (n: number) => string;

type Ctx = { race: RaceFile; view: RaceView; spoken: Spoken };

const RACE_IDS: SourceId[] = ['guide1938_diagram', 'guide1938_timetable', 'mta_gtfs', 'method'];

function minutesNum(ctx: Ctx, spec: Omit<SourceSpec, 'value'>, n: number): Num {
  const text = minShort(n);
  return { spec: { ...spec, value: text }, text, bare: String(n), spoken: ctx.spoken(n), n };
}

function timeNum(spec: Omit<SourceSpec, 'value'>, hhmm: string): Num {
  const text = shortClock(hhmm);
  return { spec: { ...spec, value: text }, text, bare: text, spoken: text, n: Number.NaN };
}

function exactOf(phase: Phase, lane: Lane): SourceSpec['exact'] {
  return isPlainRounding(phase.shown, phase.stored) ? undefined : { stored: phase.stored, shownTotal: lane.shownTotal };
}

function busTrip(trip: Trip): SourceSpec['trip'] {
  return { route: trip.route, headsign: trip.headsign_display };
}

/** "CityLink Lime toward Harbor East leaves stop 8564 at 9:17." */
function tripLineOf(trip: Trip): string {
  return methodBusTrip(trip.route_display, trip.headsign_display, trip.board.stop_id, shortClock(dropSeconds(trip.dep)));
}

/** The numbers of one race on screen: phases, totals, next departures, margin and board times. */
export function raceNumbers(race: RaceFile, view: RaceView, spoken: Spoken) {
  const ctx: Ctx = { race, view, spoken };
  const between = (what: string): string => whatBetween(what, view.originName, view.destName);
  const start = shortClock(view.start);
  const urls = race.y1938.sources;

  const [wait1938, ride1938] = view.lane1938.phases as [Phase, Phase];
  const lane1938 = {
    wait: minutesNum(
      ctx,
      {
        id: 'wait-1938',
        what: WHAT.wait1938,
        rowWhat: whatFrom(WHAT.wait1938, start),
        sourceIds: ['guide1938_timetable'],
        url: urls.passes,
        method: methodNextCar(shortClock(view.row.y1938.dep)),
        date: 'effective',
        exact: exactOf(wait1938, view.lane1938),
      },
      wait1938.shown,
    ),
    ride: minutesNum(
      ctx,
      {
        id: 'ride-1938',
        what: WHAT.ride1938,
        rowWhat: between(WHAT.ride1938),
        sourceIds: ['guide1938_diagram'],
        url: urls.ride_min,
        method: METHOD_RIDE_1938,
        date: 'effective',
        exact: exactOf(ride1938, view.lane1938),
      },
      ride1938.shown,
    ),
    total: minutesNum(
      ctx,
      {
        id: 'total-1938',
        what: WHAT.total1938,
        rowWhat: between(WHAT.total1938),
        sourceIds: ['guide1938_diagram', 'guide1938_timetable'],
        method: METHOD_TOTAL_1938,
        date: 'effective',
      },
      view.lane1938.shownTotal,
    ),
    next: timeNum(
      {
        id: 'next-1938',
        what: WHAT.car1938,
        rowWhat: whatAt(WHAT.car1938, view.originName),
        sourceIds: ['guide1938_timetable'],
        url: urls.passes,
        method: METHOD_CAR_1938,
        date: 'effective',
      },
      view.row.y1938.dep,
    ),
  };

  const today = view.laneToday && view.trip ? todayNumbers(ctx, view.laneToday, view.trip, between, start) : null;

  const margin =
    view.resultView.kind === '1938' || view.resultView.kind === 'today'
      ? minutesNum(
          ctx,
          {
            id: 'margin',
            what: WHAT.margin,
            rowWhat: between(WHAT.margin),
            sourceIds: RACE_IDS,
            method: METHOD_MARGIN,
            date: 'both',
          },
          view.resultView.shownMargin,
        )
      : null;

  const boardCars = view.board.cars.map((hhmm, k) =>
    timeNum(
      {
        id: `board-1938-${k}`,
        what: WHAT.car1938,
        rowWhat: whatAt(WHAT.car1938, view.originName),
        sourceIds: ['guide1938_timetable'],
        url: urls.passes,
        method: METHOD_CAR_1938,
        date: 'effective',
      },
      hhmm,
    ),
  );
  const boardBuses = view.board.buses.map((trip, k) =>
    timeNum(
      {
        id: `board-today-${k}`,
        what: WHAT.busDeparture,
        rowWhat: whatAt(WHAT.busDeparture, view.originName),
        sourceIds: ['mta_gtfs'],
        method: methodBusTrip(trip.route_display, trip.headsign_display, trip.board.stop_id, shortClock(dropSeconds(trip.dep))),
        date: 'feed',
        trip: busTrip(trip),
      },
      dropSeconds(trip.dep),
    ),
  );

  const { boardSpacing, boardGaps } = boardSpacingNumbers(race, view);

  return { lane1938, today, margin, boardCars, boardBuses, boardSpacing, boardGaps };
}

/** The frequency sentence (R8.5): the how-it-was-worked-out line of the board's spacing and gaps. Null without bus gaps. */
export function frequencySentence(view: RaceView): string | null {
  const f = view.frequency;
  return f ? frequency(f.gapPart, f.windowFrom, f.windowTo, f.routeNames, f.date, f.spacing1938) : null;
}

/**
 * The board's 1938 spacing and bus gaps as numbers on screen (Emmanuel, Nov 19):
 * printed in the board's short form, spoken in the sentence form.
 */
function boardSpacingNumbers(race: RaceFile, view: RaceView): { boardSpacing: Num; boardGaps: Num | null } {
  const sentenceText = frequencySentence(view);
  const { y1938, today } = race;
  const spacingText = view.board.spacing1938;
  const boardSpacing: Num = {
    spec: {
      id: 'board-1938-spacing',
      value: spacingText,
      what: WHAT.spacing1938,
      rowWhat: WHAT.spacing1938,
      sourceIds: ['guide1938_timetable'],
      url: y1938.sources.passes,
      // With no bus gaps there is no frequency sentence; the cars' own line explains the spacing.
      method: sentenceText ?? METHOD_CAR_1938,
      date: 'effective',
    },
    text: spacingText,
    bare: spacingText,
    spoken: spacing1938(y1938.gap_min, y1938.gap_max),
    n: Number.NaN,
  };
  const gapsText = view.board.busGaps;
  if (gapsText === null || sentenceText === null || today.gap_min === null || today.gap_max === null) {
    return { boardSpacing, boardGaps: null };
  }
  const what = whatBusGaps(label12(today.window_from), label12(today.window_to));
  const boardGaps: Num = {
    spec: { id: 'board-today-gaps', value: gapsText, what, rowWhat: what, sourceIds: ['mta_gtfs'], method: sentenceText, date: 'feed' },
    text: gapsText,
    bare: gapsText,
    spoken: gapPart(today.gap_min, today.gap_max),
    n: Number.NaN,
  };
  return { boardSpacing, boardGaps };
}

function todayNumbers(ctx: Ctx, lane: Lane, trip: Trip, between: (what: string) => string, start: string) {
  const [walkTo, wait, ride, walkFrom] = lane.phases as [Phase, Phase, Phase, Phase];
  const walk = (id: string, what: string, phase: Phase, metres: number): Num =>
    minutesNum(
      ctx,
      {
        id,
        what,
        rowWhat: between(what),
        sourceIds: ['mta_gtfs', 'method'],
        method: methodWalk(roundWhole(metres)),
        date: 'feed',
        walk: true,
        exact: exactOf(phase, lane),
      },
      phase.shown,
    );
  return {
    walkTo: walk('walk-to-stop', WHAT.walkToStop, walkTo, trip.board.walk_m),
    wait: minutesNum(
      ctx,
      {
        id: 'wait-today',
        what: WHAT.waitBus,
        rowWhat: whatFrom(WHAT.waitBus, start),
        sourceIds: ['mta_gtfs', 'method'],
        method: METHOD_WAIT_BUS,
        date: 'feed',
        trip: busTrip(trip),
        tripLine: tripLineOf(trip),
        exact: exactOf(wait, lane),
      },
      wait.shown,
    ),
    ride: minutesNum(
      ctx,
      {
        id: 'ride-today',
        what: WHAT.rideBus,
        rowWhat: between(WHAT.rideBus),
        sourceIds: ['mta_gtfs'],
        method: METHOD_RIDE_BUS,
        date: 'feed',
        trip: busTrip(trip),
        tripLine: tripLineOf(trip),
        exact: exactOf(ride, lane),
      },
      ride.shown,
    ),
    walkFrom: walk('walk-from-stop', WHAT.walkFromStop, walkFrom, trip.alight.walk_m),
    total: minutesNum(
      ctx,
      {
        id: 'total-today',
        what: WHAT.totalToday,
        rowWhat: between(WHAT.totalToday),
        sourceIds: ['mta_gtfs', 'method'],
        method: methodTotalToday(start),
        date: 'feed',
        trip: busTrip(trip),
        tripLine: tripLineOf(trip),
      },
      lane.shownTotal,
    ),
    next: timeNum(
      {
        id: 'next-today',
        what: WHAT.busDeparture,
        rowWhat: whatAt(WHAT.busDeparture, ctx.view.originName),
        sourceIds: ['mta_gtfs'],
        method: methodBusTrip(trip.route_display, trip.headsign_display, trip.board.stop_id, shortClock(lane.next)),
        date: 'feed',
        trip: busTrip(trip),
      },
      lane.next,
    ),
  };
}

/** A count from summary.json as a number on screen. */
export function countNum(summary: Summary, key: keyof Summary['sources'] & string, what: string, method: string, n: number, id: string): Num {
  const text = formatCount(n);
  return {
    spec: { id, value: text, what, rowWhat: what, sourceIds: summary.sources[key] ?? RACE_IDS, method, date: 'both' },
    text,
    bare: text,
    spoken: text,
    n,
  };
}

/** The honest-line counts. */
export function honestNumbers(summary: Summary) {
  return {
    wins1938: countNum(summary, 'wins_1938', WHAT.wins1938, METHOD_RACE_COUNTS, summary.wins_1938, 'count-wins-1938'),
    races: countNum(summary, 'races', WHAT.races, METHOD_RACE_COUNTS, summary.races, 'count-races'),
  };
}

/** The counts of the "When today wins" sentence (R6.5). */
export function verdictNumbers(summary: Summary) {
  return {
    rideSame: countNum(summary, 'ride_same', WHAT.rideSame, METHOD_RIDE_VERDICTS, summary.ride_same, 'count-ride-same'),
    pairs: countNum(summary, 'pairs', WHAT.pairs, METHOD_RIDE_VERDICTS, summary.pairs.length, 'count-pairs'),
    rideFaster: countNum(
      summary,
      'ride_faster_today',
      WHAT.rideFasterToday,
      METHOD_RIDE_VERDICTS,
      summary.ride_faster_today,
      'count-ride-faster',
    ),
    rideSlower: countNum(
      summary,
      'ride_slower_today',
      WHAT.rideSlowerToday,
      METHOD_RIDE_VERDICTS,
      summary.ride_slower_today,
      'count-ride-slower',
    ),
  };
}

export type RaceNumbers = ReturnType<typeof raceNumbers>;
