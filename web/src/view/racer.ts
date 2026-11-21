// Playback on the drawn card (design 9.2, 9.3). The clock calls frame() with the
// scheduled minutes elapsed; this writes the bar fills, the vehicle positions,
// the status lines and the clock readout into the elements lanes.ts and card.ts
// built. Positions come from timeline.ts; nothing here does arithmetic. Only
// custom properties read by transforms, opacity classes and text change.
import { type CaptionKey, ORIENTATION_LINE, captionText, clockReadout } from '../copy/copy';
import { clockLabel } from '../format/time';
import { type Timeline, laneFrame } from '../play/timeline';
import { type Side38, type SideToday, captionFor, phaseOf } from '../state/captions';
import type { Lane, RaceView, Side } from '../state/model';
import type { Num } from '../state/specs';
import { keepFocus } from './a11y';
import { h, setVar } from './dom';
import type { LaneLayout, RaceLayout } from './layout';
import { statusKey, statusLine } from './lanes';
import type { SourceRegistry } from './numbers';

export type RacerInput = {
  view: RaceView;
  timeline: Timeline;
  layout: RaceLayout;
  /** The next car and the next bus, for the waiting status lines. */
  next: { '1938': Num; today: Num | null };
  /** The departures board stays after the finish (desktop) or goes (phone) (R8.4). */
  keepBoard: boolean;
};

export type Racer = {
  frame(elapsed: number): void;
  /** A side has arrived. The first arrival's bar end brightens and settles (R5.6). */
  arrive(side: Side): void;
  /** The result moment. A photo finish gives both bar ends the emphasis now, together. */
  result(): void;
  /** Both sides are done: the clock row (and on a phone the board) goes, the legends stay. The illustrations keep their size. */
  finish(): void;
};

type BoundLane = {
  lane: Lane;
  layout: LaneLayout;
  next: Num;
  el: HTMLElement;
  segs: HTMLElement[];
  marker: HTMLElement | null;
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
    marker: el.querySelector<HTMLElement>('.bar-marker'),
    status: el.querySelector<HTMLElement>('.status'),
    legend: el.querySelector<HTMLElement>('.legend'),
    shown: '',
  };
}

/**
 * Change a status line. Keyboard focus inside it stays on its number button if
 * the new line has it again, and otherwise moves on to the next control (the
 * legend's first number when the line gives way to it).
 */
function changeStatus(scope: HTMLElement, status: HTMLElement, change: () => void): void {
  if (status.contains(status.ownerDocument.activeElement)) keepFocus(scope, change);
  else change();
}

export function createRacer(root: HTMLElement, registry: SourceRegistry, input: RacerInput): Racer {
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

  // The caption area (Req 7): rewritten only when the caption key changes. While it shows the orientation
  // line the racer leaves it alone; app.ts clears that line when the race starts.
  const caption = root.querySelector<HTMLElement>('#race-caption');
  let captionShown = '';
  const phases: { '1938': Side38 | null; today: SideToday | null } = { '1938': null, today: null };

  function drawCaption(key: CaptionKey): void {
    if (!caption || caption.textContent === ORIENTATION_LINE) return;
    const id = JSON.stringify(key);
    if (id === captionShown) return;
    captionShown = id;
    caption.textContent = captionText(key);
  }

  function drawLane(b: BoundLane, elapsed: number): void {
    const f = laneFrame(b.lane, timeline, elapsed, { from: b.layout.rideFrom, to: b.layout.park });
    b.segs.forEach((seg, k) => {
      setVar(seg, '--f', f.fills[k] ?? 0);
      seg.toggleAttribute('data-reached', f.reached[k] ?? false);
      seg.toggleAttribute('data-current', k === f.current && !f.arrived);
    });
    if (b.marker) setVar(b.marker, '--x', f.vehicle);
    if (b.lane.side === '1938') phases['1938'] = phaseOf(b.lane, f) as Side38;
    else phases.today = phaseOf(b.lane, f) as SideToday;
    b.el.classList.toggle('is-moving', f.moving);
    b.el.toggleAttribute('data-arrived', f.arrived);
    if (!f.arrived) b.el.classList.remove('is-arriving');
    // Racing, a lane shows its status line; from its arrival, its total and its legend (design 9.3).
    const status = b.status;
    if (b.legend) b.legend.hidden = !f.arrived;
    if (status && status.hidden !== f.arrived) changeStatus(root, status, () => void (status.hidden = f.arrived));
    const shown = f.arrived ? 'arrived' : statusKey(b.lane, f.current, f.countdown);
    if (status && shown !== b.shown && !f.arrived) {
      changeStatus(root, status, () => status.replaceChildren(statusLine(registry, b.lane, f.current, f.countdown, b.next)));
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
      if (phases['1938']) drawCaption(captionFor({ p1938: phases['1938'], today: view.laneToday ? phases.today : null, orientation: false }));
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
      drawCaption(captionFor({ p1938: 'arrived', today: view.laneToday ? 'arrived' : null, orientation: false }));
      root.querySelector('.clock-row')?.remove();
      if (!input.keepBoard) {
        const board = root.querySelector('.board');
        board?.querySelectorAll<HTMLElement>('button.num').forEach((b) => registry.delete(b.dataset['source'] ?? ''));
        board?.remove();
      }
      for (const b of lanes) {
        b.el.dataset['stage'] = 'finished';
        b.el.classList.remove('is-moving');
        // The status line's next car or bus leaves the screen, and so its Sources row.
        b.status?.querySelectorAll<HTMLElement>('button.num').forEach((n) => registry.delete(n.dataset['source'] ?? ''));
        b.status?.remove();
        b.status = null;
        if (b.legend) b.legend.hidden = false;
      }
    },
  };
}
