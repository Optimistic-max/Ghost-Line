// The race card's content, in the order of the mockups: pair row, start row,
// start-time chart, slider row, schedule line, the two lanes, the race clock row while racing, the result box
// and the honest line once the result is shown, and the departures board. Every
// number in the race is a number button registered in the card's source
// registry.
import {
  INFERRED_CAUTION,
  LANE_TITLE_TODAY,
  NO_SINGLE_BUS,
  ORIENTATION_LINE,
  SKIP_TO_RESULT,
  START_IS_NOW,
  beforeTable,
  captionText,
  ready,
  todayWinNotice,
} from '../copy/copy';
import type { Index, RaceFile, Summary, TodayWin } from '../data/types';
import { cornerName, sliderRange } from '../data/lookup';
import { routeNumberOf } from '../format/line';
import { label12, serviceDateLabel } from '../format/time';
import { captionFor } from '../state/captions';
import type { RaceView } from '../state/model';
import { honestNumbers, raceNumbers, takeawayNumbers, type RaceNumbers } from '../state/specs';
import { boardView } from './board';
import { departuresView } from './departures';
import { h } from './dom';
import { honestLine } from './honest';
import { type Stage, laneView } from './lanes';
import { type RaceLayout, raceLayout } from './layout';
import { type SourceRegistry, sentence } from './numbers';
import { nextSteps } from './nextsteps';
import { pairRow } from './pairrow';
import { resultBox } from './resultbox';
import { takeawayView } from './takeaway';
import { chartView } from './chart';
import { sliderRow, startRow } from './slider';
import { type Layout, vehicleWidths } from './vehicles';
import { VEHICLE_SIZES } from '../config';

export type { Stage };

export type CardInput = {
  index: Index;
  summary: Summary;
  race: RaceFile;
  view: RaceView;
  minute: number;
  minuteFromClock: boolean;
  layout: Layout;
  stage: Stage;
  /** The result box and honest line are on screen. */
  resultShown: boolean;
  /** "Skip to result" is offered (not with reduced motion). */
  canSkip: boolean;
  /** A guided visit: the example label and the chart prompt heading show (story-layer Req 3.4). */
  guided?: boolean;
  /** The orientation line shows in the caption area: a guided visit before its first race has started (Req 4.1). */
  orientation?: boolean;
  /** The summary.today_wins entry the shortcut selected, while its notice shows (Req 10.5). */
  todayWinNotice?: TodayWin | null;
  /** The departures section is open (Req 11.2). */
  departuresOpen?: boolean;
  /** The trolley's one fade-in, on the first paint of the page (R2.5). */
  firstPaint?: boolean;
};

/** The numbers of the race on screen, with their sources. */
export function cardNumbers(input: CardInput): RaceNumbers {
  return raceNumbers(input.race, input.view);
}

export function cardLayout(input: CardInput): RaceLayout {
  return raceLayout(input.view);
}

/** The result box and the honest line (R5.7). `entering` gives them their entrance (motion.css). */
export function resultElements(registry: SourceRegistry, input: CardInput, entering: boolean): HTMLElement[] {
  const nums = cardNumbers(input);
  const box = resultBox(registry, input.view, {
    total1938: nums.lane1938.total,
    totalToday: nums.today?.total ?? null,
    margin: nums.margin,
  });
  const honest = honestLine(registry, input.view.honest, honestNumbers(input.summary));
  const takeaway = takeawayView(registry, input.view, takeawayNumbers(input.race, input.view));
  if (entering) {
    box.classList.add('entering');
    honest.classList.add('entering');
    takeaway.classList.add('entering');
  }
  return [box, honest, takeaway];
}

/** The race clock row while anything moves: "10:08 scheduled" (racer.ts writes it) and "Skip to result". */
function clockRow(canSkip: boolean): HTMLElement {
  return h(
    'div',
    { class: 'clock-row' },
    h('p', { class: 'clock-readout', 'aria-hidden': 'true' }),
    canSkip ? h('button', { type: 'button', class: 'link skip', 'data-action': 'skip' }, SKIP_TO_RESULT) : null,
  );
}

/** The caption once both sides are done (Req 7.9): both arrived, or the trolley alone with no one-seat ride. */
export function finishedCaption(view: RaceView): string {
  return captionText(captionFor({ p1938: 'arrived', today: view.laneToday ? 'arrived' : null, orientation: false }));
}

function initialCaption(input: CardInput): string {
  if (input.orientation) return ORIENTATION_LINE;
  return input.stage === 'finished' ? finishedCaption(input.view) : '';
}

export function renderCard(registry: SourceRegistry, input: CardInput): HTMLElement[] {
  const { index, race, view, stage } = input;
  const nums = cardNumbers(input);
  const layout = cardLayout(input);
  const widths = vehicleWidths(input.layout);
  const routeNumber = routeNumberOf(index.line);
  const { first, last } = sliderRange(race);
  // One fixed size for each illustration, before, during and after the race (Req 5.3).
  const trolleyWidth = widths.trolleyRacing;
  const markerWidth = VEHICLE_SIZES[input.layout].barMarker;

  // Under the slider: the schedule line always shows (story-layer decision 16, Req 7.13), then the
  // notices block directly after it (Req 12.2).
  const schedule = h('p', { class: 'schedule' }, ready(serviceDateLabel(index.service_date)), input.minuteFromClock ? ` ${START_IS_NOW}` : '');
  const win = input.todayWinNotice ?? null;
  const notices =
    view.notices.length > 0 || win
      ? h(
          'div',
          { class: 'notices' },
          ...view.notices.map((notice) =>
            notice === 'before-table'
              ? // The covered-from time is the first listed car at this corner, row.start: a number with its source.
                h('p', { class: 'notice', 'data-notice': notice }, sentence(registry, beforeTable, nums.lane1938.next))
              : h('p', { class: 'notice', 'data-notice': notice }, INFERRED_CAUTION),
          ),
          // The today-win notice: plain text, no number button, after the other notices (Req 10.5).
          win
            ? h(
                'p',
                { class: 'notice', 'data-notice': 'today-win' },
                todayWinNotice(cornerName(index, win.origin) ?? win.origin, cornerName(index, win.dest) ?? win.dest, label12(win.t)),
              )
            : null,
        )
      : null;
  const inferredSlug = index.corners.find((c) => c.inferred)?.slug;
  const inferredEnd = !view.inferred ? null : view.pair.origin === inferredSlug ? 'origin' : view.pair.dest === inferredSlug ? 'dest' : null;

  const lane1938 = laneView(
    registry,
    view.lane1938,
    layout.lane1938,
    { total: nums.lane1938.total, phases: [nums.lane1938.wait, nums.lane1938.ride], next: nums.lane1938.next },
    { vehicleWidth: trolleyWidth, markerWidth, routeNumber, stage, firstPaint: input.firstPaint ?? false },
  );
  const today =
    view.laneToday && layout.laneToday && nums.today
      ? laneView(
          registry,
          view.laneToday,
          layout.laneToday,
          {
            total: nums.today.total,
            phases: [nums.today.walkTo, nums.today.wait, nums.today.ride, nums.today.walkFrom],
            next: nums.today.next,
          },
          { vehicleWidth: widths.bus, markerWidth, routeNumber, stage },
        )
      : // No one-seat ride: in place of the bus lane, its title and the sentence; no vehicle, total or margin (R6.8).
        h(
          'section',
          { class: 'lane-none', 'aria-label': LANE_TITLE_TODAY },
          h('h3', { class: 'lane-title display' }, LANE_TITLE_TODAY),
          h('p', { class: 'no-bus' }, NO_SINGLE_BUS),
        );

  // The clock row sits right under the lanes while racing, so the result arriving
  // under it never pushes it out of sight on a phone (R1.2); it goes at the finish.
  return [
    pairRow(view.originName, view.destName, inferredEnd),
    startRow(input.minute, input.guided ?? false),
    chartView(registry, {
      race,
      originName: view.originName,
      destName: view.destName,
      minute: input.minute,
      guided: input.guided ?? false,
    }),
    sliderRow({ first, last, minute: input.minute }),
    schedule,
    ...(notices ? [notices] : []),
    h('div', { class: 'lanes' }, lane1938, today),
    // Plain text, outside the announcer's region. Racing, racer.ts writes it; a finished card (the finish,
    // skip, reduced motion) is drawn with the finished caption, or the orientation line on a guided visit.
    h('p', { class: 'caption', id: 'race-caption' }, initialCaption(input)),
    ...(stage === 'racing' ? [clockRow(input.canSkip)] : []),
    ...(input.resultShown ? resultElements(registry, input, false) : []),
    nextSteps(),
    ...(boardShown(input) ? [departuresView(cardBoard(registry, input), input.departuresOpen ?? false)] : []),
  ];
}

/** The departures section is on the card on both layouts and in every stage (story-layer Req 11.1). */
export function boardShown(_input: Pick<CardInput, 'layout' | 'stage'>): boolean {
  return true;
}

/** The board for the card's race; also drawn again while the slider moves (R3.5). */
export function cardBoard(registry: SourceRegistry, input: CardInput): HTMLElement {
  const nums = cardNumbers(input);
  return boardView(registry, input.view, {
    cars: nums.boardCars,
    buses: nums.boardBuses,
    spacing: nums.boardSpacing,
    gaps: nums.boardGaps,
  });
}
