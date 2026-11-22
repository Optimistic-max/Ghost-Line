// "Where the time goes" (story-layer Req 8): the lane legends' shown values again, in rows, under
// the honest line. Every value is a number button. The "most of the difference" sentence follows
// the stored wait_most flag; nothing here compares waits.
import {
  TAKEAWAY_HEADING,
  TAKEAWAY_MOST,
  TAKEAWAY_MOST_TODAY,
  TAKEAWAY_MOST_TROLLEY,
  takeawayRiding,
  takeawayRidingTrolley,
  takeawayWaiting,
  takeawayWaitingTrolley,
  takeawayWalking,
} from '../copy/copy';
import type { RaceView } from '../state/model';
import type { takeawayNumbers } from '../state/specs';
import { h } from './dom';
import { type SourceRegistry, sentence } from './numbers';

/** The loser's wait is the one that accounts for the difference: the trolley's when today wins, today's when 1938 wins. */
function mostSentence(result: RaceView['result']): string {
  if (result === 'today') return TAKEAWAY_MOST_TROLLEY;
  if (result === '1938') return TAKEAWAY_MOST_TODAY;
  // The pipeline writes the flag only for a win; a row that is not one has no loser to name.
  return TAKEAWAY_MOST;
}

export function takeawayView(registry: SourceRegistry, view: RaceView, nums: ReturnType<typeof takeawayNumbers>): HTMLElement {
  const rows: HTMLElement[] = [];
  if (nums.today) {
    rows.push(
      h('p', { class: 'takeaway-row' }, sentence(registry, takeawayWaiting, nums.wait1938, nums.today.wait)),
      h('p', { class: 'takeaway-row' }, sentence(registry, takeawayWalking, nums.today.walk)),
      h('p', { class: 'takeaway-row' }, sentence(registry, takeawayRiding, nums.ride1938, nums.today.ride)),
    );
  } else {
    rows.push(
      h('p', { class: 'takeaway-row' }, sentence(registry, takeawayWaitingTrolley, nums.wait1938)),
      h('p', { class: 'takeaway-row' }, sentence(registry, takeawayRidingTrolley, nums.ride1938)),
    );
  }
  return h(
    'section',
    { class: 'takeaway', 'aria-labelledby': 'takeaway-heading' },
    h('h3', { class: 'takeaway-heading', id: 'takeaway-heading' }, TAKEAWAY_HEADING),
    ...rows,
    view.takeaway.waitMost ? h('p', { class: 'takeaway-most' }, mostSentence(view.result)) : null,
  );
}
