// The race card's content, in the order of the mockups: pair row, slider,
// schedule line, the two lanes, the result box and the honest line once the
// result is shown, and the race clock row while racing. Every number is a
// number button registered in the card's source registry.
import { NO_SINGLE_BUS, SKIP_TO_RESULT, START_IS_NOW, minutes, ready } from '../copy/copy';
import type { Index, RaceFile, Summary } from '../data/types';
import { sliderRange } from '../data/lookup';
import { routeNumberOf } from '../format/line';
import { serviceDateLabel } from '../format/time';
import type { RaceView } from '../state/model';
import { honestNumbers, raceNumbers, type RaceNumbers } from '../state/specs';
import { h } from './dom';
import { honestLine } from './honest';
import { type Stage, laneView } from './lanes';
import { type RaceLayout, raceLayout } from './layout';
import type { SourceRegistry } from './numbers';
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
  /** The trolley's one fade-in, on the first paint of the page (R2.5). */
  firstPaint?: boolean;
};

/** The numbers of the race on screen, with their sources. */
export function cardNumbers(input: CardInput): RaceNumbers {
  return raceNumbers(input.race, input.view, minutes);
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

  const schedule = h(
    'p',
    { class: 'schedule' },
    ready(serviceDateLabel(index.service_date)),
    input.minuteFromClock ? ` ${START_IS_NOW}` : '',
  );

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
      : h('p', { class: 'no-bus' }, NO_SINGLE_BUS);

  return [
    pairRow(view.originName, view.destName),
    slider({ first, last, minute: input.minute }),
    schedule,
    h('div', { class: 'lanes' }, lane1938, today),
    ...(input.resultShown ? resultElements(registry, input, false) : []),
    ...(stage === 'racing' ? [clockRow(input.canSkip)] : []),
  ];
}
