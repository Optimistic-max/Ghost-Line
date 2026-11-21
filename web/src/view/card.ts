// The race card's content, in the order of the mockups: pair row, slider,
// schedule line, the two lanes, the race clock row while racing, the result box
// and the honest line once the result is shown, and the departures board. Every
// number in the race is a number button registered in the card's source
// registry.
import {
  CHART_PROMPT_HEADING,
  INFERRED_CAUTION,
  LANE_TITLE_TODAY,
  NO_SINGLE_BUS,
  SKIP_TO_RESULT,
  START_IS_NOW,
  beforeTable,
  exampleLabel,
  ready,
} from '../copy/copy';
import type { Index, RaceFile, Summary } from '../data/types';
import { sliderRange } from '../data/lookup';
import { routeNumberOf } from '../format/line';
import { clockOf, label12, serviceDateLabel } from '../format/time';
import type { RaceView } from '../state/model';
import { honestNumbers, raceNumbers, type RaceNumbers } from '../state/specs';
import { boardView } from './board';
import { h } from './dom';
import { honestLine } from './honest';
import { type Stage, laneView } from './lanes';
import { type RaceLayout, raceLayout } from './layout';
import { type SourceRegistry, sentence } from './numbers';
import { pairRow } from './pairrow';
import { resultBox } from './resultbox';
import { slider } from './slider';
import { type Layout, vehicleWidths } from './vehicles';

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
  if (entering) {
    box.classList.add('entering');
    honest.classList.add('entering');
  }
  return [box, honest];
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

export function renderCard(registry: SourceRegistry, input: CardInput): HTMLElement[] {
  const { index, race, view, stage } = input;
  const nums = cardNumbers(input);
  const layout = cardLayout(input);
  const widths = vehicleWidths(input.layout);
  const routeNumber = routeNumberOf(index.line);
  const { first, last } = sliderRange(race);
  const trolleyWidth = stage === 'finished' ? widths.trolleyFinished : widths.trolleyRacing;

  // Under the slider: the notices when there are any (they hide the schedule line), else the schedule line (R6.6, R6.7).
  const under =
    view.notices.length > 0
      ? h(
          'div',
          { class: 'notices' },
          ...view.notices.map((notice) =>
            notice === 'before-table'
              ? // The covered-from time is the first listed car at this corner, row.start: a number with its source.
                h('p', { class: 'notice', 'data-notice': notice }, sentence(registry, beforeTable, nums.lane1938.next))
              : h('p', { class: 'notice', 'data-notice': notice }, INFERRED_CAUTION),
          ),
        )
      : h('p', { class: 'schedule' }, ready(serviceDateLabel(index.service_date)), input.minuteFromClock ? ` ${START_IS_NOW}` : '');
  const inferredSlug = index.corners.find((c) => c.inferred)?.slug;
  const inferredEnd = !view.inferred ? null : view.pair.origin === inferredSlug ? 'origin' : view.pair.dest === inferredSlug ? 'dest' : null;

  const lane1938 = laneView(
    registry,
    view.lane1938,
    layout.lane1938,
    { total: nums.lane1938.total, phases: [nums.lane1938.wait, nums.lane1938.ride], next: nums.lane1938.next },
    { vehicleWidth: trolleyWidth, routeNumber, stage, firstPaint: input.firstPaint ?? false },
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
          { vehicleWidth: widths.bus, routeNumber, stage },
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
    slider({ first, last, minute: input.minute }),
    ...(input.guided
      ? [
          h('p', { class: 'example-label' }, exampleLabel(label12(clockOf(input.minute)))),
          h('h3', { class: 'chart-prompt' }, CHART_PROMPT_HEADING),
        ]
      : []),
    under,
    h('div', { class: 'lanes' }, lane1938, today),
    ...(stage === 'racing' ? [clockRow(input.canSkip)] : []),
    ...(input.resultShown ? resultElements(registry, input, false) : []),
    ...(boardShown(input) ? [cardBoard(registry, input)] : []),
  ];
}

/** The departures board shows before and during the race, and on desktop after it too (R8.4, R5.11). */
export function boardShown(input: Pick<CardInput, 'layout' | 'stage'>): boolean {
  return input.layout === 'desktop' || input.stage === 'racing';
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
