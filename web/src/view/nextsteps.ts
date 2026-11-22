// The three next-step actions (story-layer Req 10): try another time, try other corners, show a
// race today wins. Drawn in the card's content after the takeaway; app.ts handles the clicks.
import { NEXT_SHOW_TODAY_WIN, NEXT_TRY_CORNERS, NEXT_TRY_TIME, REPLAY_RACE } from '../copy/copy';
import { h } from './dom';

/**
 * "Replay this race" (task 25.3). Always in the card while a race can play, so the page does not move
 * when it appears; it is invisible (and out of the tab order) until the finish sets `data-ready`.
 */
export function replayRow(ready: boolean): HTMLElement {
  return h(
    'div',
    { class: 'replay-row', ...(ready ? { 'data-ready': '' } : {}) },
    h('button', { type: 'button', class: 'button button-outline replay', 'data-action': 'replay' }, REPLAY_RACE),
  );
}

export function nextSteps(): HTMLElement {
  return h(
    'div',
    { class: 'next-steps' },
    h('button', { type: 'button', class: 'button button-filled next-step', 'data-action': 'next-time' }, NEXT_TRY_TIME),
    h('button', { type: 'button', class: 'button button-filled next-step', 'data-action': 'next-corners' }, NEXT_TRY_CORNERS),
    h('button', { type: 'button', class: 'button button-filled next-step', 'data-action': 'next-today-win' }, NEXT_SHOW_TODAY_WIN),
  );
}
