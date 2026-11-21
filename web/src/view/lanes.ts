// The two lanes (R5.3, design 13.3; story-layer Req 5, 6): the title row with
// the lane's illustration and total, a marker track holding one bar marker,
// one 9 px bar on the shared scale, the status line while racing and
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
  waitingForBus,
  walkingFromStop,
  walkingToStop,
} from '../copy/copy';
import type { Lane, Phase } from '../state/model';
import type { Num } from '../state/specs';
import { fromMarkup, h, setVar } from './dom';
import type { LaneLayout } from './layout';
import { type SourceRegistry, numberButton, sentence } from './numbers';
import { busMarkerSvg, busSvg, markerSvg, trolleySvg } from './vehicles';

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
    // The end of the bar: a small glowing marker that always shows the finish point
    // (Emmanuel, Nov 19), and the flash that brightens and settles at the first arrival (R5.6).
    h('span', { class: 'bar-end' }, h('span', { class: 'bar-mark' }), h('span', { class: 'bar-cap' })),
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

/** True when a phase's status line names the bus instead of counting down (R5.4). */
function namesTheBus(lane: Lane, phaseIndex: number): boolean {
  return lane.side === 'today' && lane.phases[phaseIndex]?.kind === 'wait';
}

/** What a status line shows, so it is rewritten only when that changes. */
export function statusKey(lane: Lane, phaseIndex: number, minutesLeft: number): string {
  return namesTheBus(lane, phaseIndex) ? `${phaseIndex}` : `${phaseIndex} ${minutesLeft}`;
}

/**
 * The status line of a lane during the race (R5.4): the phase under way and its
 * whole minutes left, counting down from the shown part, with the next car as a
 * number button. The bus wait names the bus, a number button, and has no countdown.
 */
export function statusLine(registry: SourceRegistry, lane: Lane, phaseIndex: number, minutesLeft: number, next: Num): DocumentFragment {
  const phase = lane.phases[phaseIndex];
  if (namesTheBus(lane, phaseIndex)) return sentence(registry, waitingForBus, next);
  switch (phase?.kind) {
    case 'wait':
      return sentence(registry, waiting1938, minutesLeft, next);
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

/**
 * The lane's illustration (Req 5): the lane's identity, drawn once in the title
 * row at one fixed size. It does not travel and does not change size. The
 * trolley's two hairline wires run across the title row behind it.
 */
function laneArt(lane: Lane, options: LaneOptions): HTMLElement {
  return h(
    'div',
    { class: 'lane-art', 'aria-hidden': 'true' },
    h(
      'div',
      { class: options.firstPaint ? 'vehicle first-paint' : 'vehicle' },
      vehicleMarkup(lane.side, options.vehicleWidth, options.routeNumber),
    ),
  );
}

/**
 * The marker track (Req 6): a row directly above the bar, the bar's width plus
 * half a marker on each side (card.css), holding the one bar marker. The marker
 * is moved by transform from --x, the share of the scale at its centre, and
 * --gaps, the phase gaps drawn before it. Parked at the end of the ride until
 * racer.ts moves it (reduced motion keeps it there).
 */
function markerTrack(lane: Lane, layout: LaneLayout, options: LaneOptions): HTMLElement {
  const glyph = lane.side === '1938' ? markerSvg({ width: options.markerWidth }) : busMarkerSvg({ width: options.markerWidth });
  const marker = h('div', { class: 'bar-marker' }, fromMarkup(glyph));
  setVar(marker, '--x', layout.park);
  setVar(marker, '--gaps', layout.gapsBefore);
  return h('div', { class: 'marker-track', 'aria-hidden': 'true' }, marker);
}

export type LaneOptions = {
  vehicleWidth: number;
  /** The bar marker's width (config.ts VEHICLE_SIZES.barMarker). */
  markerWidth: number;
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
      ...(lane.side === '1938' ? [h('span', { class: 'wire wire-1', 'aria-hidden': 'true' }), h('span', { class: 'wire wire-2', 'aria-hidden': 'true' })] : []),
      laneArt(lane, options),
      h('h3', { class: 'lane-title display' }, title),
      h('span', { class: 'lane-total display' }, numberButton(registry, nums.total)),
    ),
    markerTrack(lane, layout, options),
    bar(lane, layout),
    racing ? h('p', { class: 'status' }) : null,
    legendEl,
  );
  setVar(el, '--end', layout.end);
  setVar(el, '--veh-w', `${options.vehicleWidth}px`);
  setVar(el, '--bar-marker-w', `${options.markerWidth}px`);
  return el;
}
