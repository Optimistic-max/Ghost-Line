// The two lanes (R5.3, design 13.3): title and total, the vehicle on its
// hairlines, one 9 px bar on the shared scale, and the phase legend. This draws
// the finished state; playback (task 11) moves the same elements by transform.
import { LANE_TITLE_1938, LANE_TITLE_TODAY, legendRide, legendWait, legendWalk } from '../copy/copy';
import type { Lane, Phase } from '../state/model';
import type { Num } from '../state/specs';
import { h, setVar } from './dom';
import type { LaneLayout } from './layout';
import { type SourceRegistry, numberButton, sentence } from './numbers';
import { busSvg, trolleySvg, type VehicleWidths } from './vehicles';
import { fromMarkup } from './dom';

export type LaneNumbers = { total: Num; phases: Num[] };

const LEGEND: Record<Phase['kind'], (n: number) => string> = {
  'walk-to-stop': legendWalk,
  wait: legendWait,
  ride: legendRide,
  'walk-from-stop': legendWalk,
};

function bar(lane: Lane, layout: LaneLayout): HTMLElement {
  const el = h('div', { class: 'bar', 'aria-hidden': 'true' });
  lane.phases.forEach((phase, k) => {
    const seg = h('span', { class: `seg seg-${phase.kind}`, 'data-phase': phase.kind, 'data-empty': phase.stored === 0 }, h('span', { class: 'seg-fill' }));
    setVar(seg, '--w', layout.widths[k] ?? 0);
    el.append(seg);
  });
  return el;
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

function vehicleRow(lane: Lane, layout: LaneLayout, widths: VehicleWidths, routeNumber: string | null): HTMLElement {
  const isTrolley = lane.side === '1938';
  const width = isTrolley ? widths.trolleyFinished : widths.bus;
  const markup = isTrolley ? trolleySvg({ routeNumber, width }) : busSvg({ width });
  const runner = h('div', { class: 'runner' }, h('div', { class: 'vehicle' }, fromMarkup(markup)));
  setVar(runner, '--p', layout.park);
  const row = h(
    'div',
    { class: `vehicle-row vehicle-row-${lane.side}`, 'aria-hidden': 'true' },
    ...(isTrolley ? [h('span', { class: 'wire wire-1' }), h('span', { class: 'wire wire-2' })] : [h('span', { class: 'road' })]),
    runner,
  );
  setVar(row, '--veh-w', `${width}px`);
  return row;
}

export function laneView(
  registry: SourceRegistry,
  lane: Lane,
  layout: LaneLayout,
  nums: LaneNumbers,
  widths: VehicleWidths,
  routeNumber: string | null,
): HTMLElement {
  const title = lane.side === '1938' ? LANE_TITLE_1938 : LANE_TITLE_TODAY;
  const el = h(
    'section',
    { class: `lane lane-${lane.side}`, 'data-side': lane.side, 'aria-label': title },
    h('div', { class: 'lane-head' }, h('h3', { class: 'lane-title display' }, title), h('span', { class: 'lane-total display' }, numberButton(registry, nums.total))),
    vehicleRow(lane, layout, widths, routeNumber),
    bar(lane, layout),
    legend(registry, lane, nums.phases),
  );
  setVar(el, '--end', layout.end);
  return el;
}
