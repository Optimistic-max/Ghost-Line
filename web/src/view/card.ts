// The race card's content, in the order of the mockups: pair row, slider,
// schedule line, the two lanes, the result box and the honest line. Every number
// is a number button registered in the card's source registry.
import { NO_SINGLE_BUS, START_IS_NOW, minutes, ready } from '../copy/copy';
import type { Index, RaceFile, Summary } from '../data/types';
import { sliderRange } from '../data/lookup';
import { routeNumberOf } from '../format/line';
import { serviceDateLabel } from '../format/time';
import type { RaceView } from '../state/model';
import { honestNumbers, raceNumbers, type RaceNumbers } from '../state/specs';
import { h } from './dom';
import { honestLine } from './honest';
import { laneView } from './lanes';
import { raceLayout } from './layout';
import type { SourceRegistry } from './numbers';
import { pairRow } from './pairrow';
import { resultBox } from './resultbox';
import { slider } from './slider';
import { type Layout, vehicleWidths } from './vehicles';

export type CardInput = {
  index: Index;
  summary: Summary;
  race: RaceFile;
  view: RaceView;
  minute: number;
  minuteFromClock: boolean;
  layout: Layout;
};

/** The numbers of the race on screen, with their sources. */
export function cardNumbers(input: CardInput): RaceNumbers {
  return raceNumbers(input.race, input.view, minutes);
}

export function renderCard(registry: SourceRegistry, input: CardInput): HTMLElement[] {
  const { index, summary, race, view } = input;
  const nums = cardNumbers(input);
  const layout = raceLayout(view);
  const widths = vehicleWidths(input.layout);
  const routeNumber = routeNumberOf(index.line);
  const { first, last } = sliderRange(race);

  const schedule = h('p', { class: 'schedule' }, ready(serviceDateLabel(index.service_date)), input.minuteFromClock ? ` ${START_IS_NOW}` : '');

  const lane1938 = laneView(
    registry,
    view.lane1938,
    layout.lane1938,
    { total: nums.lane1938.total, phases: [nums.lane1938.wait, nums.lane1938.ride] },
    widths,
    routeNumber,
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
          },
          widths,
          routeNumber,
        )
      : h('p', { class: 'no-bus' }, NO_SINGLE_BUS);

  const result = resultBox(registry, view, {
    total1938: nums.lane1938.total,
    totalToday: nums.today?.total ?? null,
    margin: nums.margin,
  });
  const honest = honestLine(registry, view.honest, honestNumbers(summary));

  return [
    pairRow(view.originName, view.destName),
    slider({ first, last, minute: input.minute }),
    schedule,
    h('div', { class: 'lanes' }, lane1938, today),
    result,
    honest,
  ];
}
