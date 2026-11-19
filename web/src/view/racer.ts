// Playback on the drawn card (design 9.2, 9.3). The clock calls frame() with the
// scheduled minutes elapsed; this writes the bar fills, the vehicle positions,
// the status lines and the clock readout into the elements lanes.ts and card.ts
// built. Positions come from timeline.ts; nothing here does arithmetic. Only
// custom properties read by transforms, opacity classes and text change.
import { clockReadout } from '../copy/copy';
import { clockLabel } from '../format/time';
import { type Timeline, laneFrame } from '../play/timeline';
import type { Lane, RaceView, Side } from '../state/model';
import type { Num } from '../state/specs';
import { h, setVar } from './dom';
import type { LaneLayout, RaceLayout } from './layout';
import { statusLine, vehicleMarkup } from './lanes';
import type { SourceRegistry } from './numbers';

export type RacerInput = {
  view: RaceView;
  timeline: Timeline;
  layout: RaceLayout;
  /** The next car and the next bus, for the waiting status lines. */
  next: { '1938': Num; today: Num | null };
  /** The trolley after the finish (phone: 104 px). */
  finishedTrolley: { width: number; routeNumber: string | null };
};

export type Racer = {
  frame(elapsed: number): void;
  /** A side has arrived. The first arrival's bar end brightens and settles (R5.6). */
  arrive(side: Side): void;
  /** The result moment. A photo finish gives both bar ends the emphasis now, together. */
  result(): void;
  /** Both sides are done: the clock row goes, the legends stay, the trolley takes its finished size. */
  finish(): void;
};

type BoundLane = {
  lane: Lane;
  layout: LaneLayout;
  next: Num;
  el: HTMLElement;
  segs: HTMLElement[];
  runner: HTMLElement | null;
  row: HTMLElement | null;
  status: HTMLElement | null;
  legend: HTMLElement | null;
  /** The phase and countdown the status line shows, so it is rewritten only when they change. */
  shown: string;
};

function bind(root: ParentNode, lane: Lane, layout: LaneLayout | null, next: Num | null): BoundLane | null {
  const el = root.querySelector<HTMLElement>(`.lane-${lane.side}`);
  if (!el || !layout || !next) return null;
  return {
    lane,
    layout,
    next,
    el,
    segs: [...el.querySelectorAll<HTMLElement>('.seg')],
    runner: el.querySelector<HTMLElement>('.runner'),
    row: el.querySelector<HTMLElement>('.vehicle-row'),
    status: el.querySelector<HTMLElement>('.status'),
    legend: el.querySelector<HTMLElement>('.legend'),
    shown: '',
  };
}

/** Replace a status line's content, keeping keyboard focus on its number button if it had it. */
function setStatus(status: HTMLElement, content: DocumentFragment): void {
  const focused = status.contains(status.ownerDocument.activeElement);
  status.replaceChildren(content);
  if (focused) status.querySelector<HTMLElement>('button')?.focus();
}

export function createRacer(root: ParentNode, registry: SourceRegistry, input: RacerInput): Racer {
  const { view, timeline, layout } = input;
  const lanes = [
    bind(root, view.lane1938, layout.lane1938, input.next['1938']),
    view.laneToday ? bind(root, view.laneToday, layout.laneToday, input.next.today) : null,
  ].filter((b): b is BoundLane => b !== null);
  const readout = root.querySelector<HTMLElement>('.clock-readout');
  let readoutShown = '';
  let firstArrived = false;

  function emphasize(lane: BoundLane): void {
    lane.el.classList.add('is-arriving');
  }

  function drawLane(b: BoundLane, elapsed: number): void {
    const f = laneFrame(b.lane, timeline, elapsed, b.layout.park);
    b.segs.forEach((seg, k) => {
      setVar(seg, '--f', f.fills[k] ?? 0);
      seg.toggleAttribute('data-reached', f.reached[k] ?? false);
      seg.toggleAttribute('data-current', k === f.current && !f.arrived);
    });
    if (b.runner) setVar(b.runner, '--p', f.vehicle);
    b.el.classList.toggle('is-moving', f.moving);
    b.el.toggleAttribute('data-arrived', f.arrived);
    if (!f.arrived) b.el.classList.remove('is-arriving');
    // Racing, a lane shows its status line; from its arrival, its total and its legend (design 9.3).
    if (b.status) b.status.hidden = f.arrived;
    if (b.legend) b.legend.hidden = !f.arrived;
    const shown = f.arrived ? 'arrived' : `${f.current} ${f.countdown}`;
    if (b.status && shown !== b.shown && !f.arrived) {
      setStatus(b.status, statusLine(registry, b.lane, f.current, f.countdown, b.next));
    }
    b.shown = shown;
  }

  function drawReadout(elapsed: number): void {
    if (!readout) return;
    const hm = clockLabel(view.start, elapsed);
    if (hm === readoutShown) return;
    readoutShown = hm;
    const text = clockReadout(hm);
    // The time in the display face, then the word "scheduled" (mockup 02).
    readout.replaceChildren(
      ...(text.startsWith(hm) ? [h('span', { class: 'clock-time display' }, hm), text.slice(hm.length)] : [text]),
    );
  }

  let framed = false;

  return {
    frame(elapsed) {
      for (const b of lanes) drawLane(b, elapsed);
      drawReadout(elapsed);
      // Drawn again mid-race (a layout change): a lane already in means the first arrival has passed.
      if (!framed) {
        framed = true;
        firstArrived = lanes.some((b) => b.el.hasAttribute('data-arrived'));
      }
    },
    arrive(side) {
      if (firstArrived) return;
      firstArrived = true;
      if (view.result === 'photo_finish') return;
      const lane = lanes.find((b) => b.lane.side === side);
      if (lane) emphasize(lane);
    },
    result() {
      if (view.result === 'photo_finish') lanes.forEach(emphasize);
    },
    finish() {
      root.querySelector('.clock-row')?.remove();
      for (const b of lanes) {
        b.el.dataset['stage'] = 'finished';
        b.el.classList.remove('is-moving');
        b.status?.remove();
        b.status = null;
        if (b.legend) b.legend.hidden = false;
      }
      const trolley = lanes.find((b) => b.lane.side === '1938');
      const { width, routeNumber } = input.finishedTrolley;
      const size = `${width}px`;
      if (trolley?.row && trolley.row.style.getPropertyValue('--veh-w') !== size) {
        trolley.row.querySelector('.vehicle')?.replaceChildren(vehicleMarkup('1938', width, routeNumber));
        setVar(trolley.row, '--veh-w', size);
      }
    },
  };
}
