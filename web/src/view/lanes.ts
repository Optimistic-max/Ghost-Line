// The two lanes (R5.3, design 13.3): title and total, the vehicle on its
// hairlines, one 9 px bar on the shared scale, the status line while racing and
// the phase legend after the lane arrives. Playback (racer.ts) moves these same
// elements by transform and opacity; nothing is re-laid out per frame.
import {
  LANE_TITLE_1938,
  LANE_TITLE_TODAY,
  legendRide,
  legendWait,
  legendWalk,
  riding,
  waiting1938,
  waitingBus,
  walkingFromStop,
  walkingToStop,
} from '../copy/copy';
import type { Lane, Phase } from '../state/model';
import type { Num } from '../state/specs';
import { fromMarkup, h, setVar } from './dom';
import type { LaneLayout } from './layout';
import { type SourceRegistry, numberButton, sentence } from './numbers';
import { busSvg, trolleySvg } from './vehicles';

/** Racing: before and during the race. Finished: after it. */
export type Stage = 'racing' | 'finished';

export type LaneNumbers = { total: Num; phases: Num[]; next: Num };

const LEGEND: Record<Phase['kind'], (n: number) => string> = {
  'walk-to-stop': legendWalk,
  wait: legendWait,
  ride: legendRide,
  'walk-from-stop': legendWalk,
};

/**
 * One phase of the bar: a dim track (the phase not yet reached, R5.3), and the
 * filled part over it, revealed from the left by --f (motion.css). A walk also
 * carries the small dot that travels it.
 */
function segment(phase: Phase, width: number): HTMLElement {
  const isWalk = phase.kind === 'walk-to-stop' || phase.kind === 'walk-from-stop';
  const seg = h(
    'span',
    { class: `seg seg-${phase.kind}`, 'data-phase': phase.kind, 'data-empty': phase.stored === 0 },
    h('span', { class: 'seg-track' }),
    h('span', { class: 'seg-fill' }, h('span', { class: 'seg-paint' })),
    isWalk ? h('span', { class: 'seg-dot-track' }, h('span', { class: 'seg-dot' })) : null,
  );
  setVar(seg, '--w', width);
  return seg;
}

function bar(lane: Lane, layout: LaneLayout): HTMLElement {
  return h(
    'div',
    { class: 'bar', 'aria-hidden': 'true' },
    ...lane.phases.map((phase, k) => segment(phase, layout.widths[k] ?? 0)),
    // The end of the bar, which brightens and settles at the first arrival (R5.6).
    h('span', { class: 'bar-cap' }),
  );
}

function legend(registry: SourceRegistry, lane: Lane, nums: Num[]): HTMLElement {
  const el = h('p', { class: 'legend' });
  const items = lane.phases.flatMap((phase, k) => {
    const num = nums[k];
    return num ? [h('span', { class: 'legend-item', 'data-phase': phase.kind }, sentence(registry, LEGEND[phase.kind], num))] : [];
  });
  // A space between items, so the legend reads as separate phrases.
  items.forEach((item, k) => el.append(...(k ? [' ', item] : [item])));
  return el;
}

/**
 * The status line of a lane during the race (R5.4): the phase under way and its
 * whole minutes left, counting down from the shown part, with the next car or
 * bus as a number button.
 */
export function statusLine(registry: SourceRegistry, lane: Lane, phaseIndex: number, minutesLeft: number, next: Num): DocumentFragment {
  const phase = lane.phases[phaseIndex];
  switch (phase?.kind) {
    case 'wait':
      return lane.side === '1938'
        ? sentence(registry, waiting1938, minutesLeft, next)
        : sentence(registry, waitingBus, minutesLeft, next);
    case 'ride':
      return sentence(registry, riding, minutesLeft);
    case 'walk-to-stop':
      return sentence(registry, walkingToStop, minutesLeft);
    case 'walk-from-stop':
      return sentence(registry, walkingFromStop, minutesLeft);
    default:
      return document.createDocumentFragment();
  }
}

/** The vehicle drawn at a width; the trolley's route number follows its own size rule. */
export function vehicleMarkup(side: Lane['side'], width: number, routeNumber: string | null): DocumentFragment {
  return fromMarkup(side === '1938' ? trolleySvg({ routeNumber, width }) : busSvg({ width }));
}

function vehicleRow(lane: Lane, layout: LaneLayout, options: LaneOptions): HTMLElement {
  const vehicle = h(
    'div',
    { class: options.firstPaint ? 'vehicle first-paint' : 'vehicle' },
    vehicleMarkup(lane.side, options.vehicleWidth, options.routeNumber),
  );
  const runner = h('div', { class: 'runner' }, vehicle);
  setVar(runner, '--p', layout.park);
  const row = h(
    'div',
    { class: `vehicle-row vehicle-row-${lane.side}`, 'aria-hidden': 'true' },
    ...(lane.side === '1938' ? [h('span', { class: 'wire wire-1' }), h('span', { class: 'wire wire-2' })] : [h('span', { class: 'road' })]),
    runner,
  );
  setVar(row, '--veh-w', `${options.vehicleWidth}px`);
  return row;
}

export type LaneOptions = {
  vehicleWidth: number;
  routeNumber: string | null;
  stage: Stage;
  /** The trolley's one fade-in on the first paint (R2.5). */
  firstPaint?: boolean;
};

/**
 * A lane. Finished: the total and the legend. Racing: the status line, with the
 * total and the legend held back until the lane arrives (racer.ts sets
 * data-arrived; design 9.3).
 */
export function laneView(registry: SourceRegistry, lane: Lane, layout: LaneLayout, nums: LaneNumbers, options: LaneOptions): HTMLElement {
  const title = lane.side === '1938' ? LANE_TITLE_1938 : LANE_TITLE_TODAY;
  const racing = options.stage === 'racing';
  const legendEl = legend(registry, lane, nums.phases);
  legendEl.hidden = racing;
  const el = h(
    'section',
    { class: `lane lane-${lane.side}`, 'data-side': lane.side, 'data-stage': options.stage, 'aria-label': title },
    h(
      'div',
      { class: 'lane-head' },
      h('h3', { class: 'lane-title display' }, title),
      h('span', { class: 'lane-total display' }, numberButton(registry, nums.total)),
    ),
    vehicleRow(lane, layout, options),
    bar(lane, layout),
    racing ? h('p', { class: 'status' }) : null,
    legendEl,
  );
  setVar(el, '--end', layout.end);
  return el;
}
