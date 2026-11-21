// The three next-step actions (story-layer Req 10): try another time, try other corners, show a
// race today wins. Drawn in the card's content after the takeaway; app.ts handles the clicks.
import { NEXT_SHOW_TODAY_WIN, NEXT_TRY_CORNERS, NEXT_TRY_TIME } from '../copy/copy';
import { h } from './dom';

export function nextSteps(): HTMLElement {
  return h(
    'div',
    { class: 'next-steps' },
    h('button', { type: 'button', class: 'button button-filled next-step', 'data-action': 'next-time' }, NEXT_TRY_TIME),
    h('button', { type: 'button', class: 'button button-filled next-step', 'data-action': 'next-corners' }, NEXT_TRY_CORNERS),
    h('button', { type: 'button', class: 'button button-filled next-step', 'data-action': 'next-today-win' }, NEXT_SHOW_TODAY_WIN),
  );
}
