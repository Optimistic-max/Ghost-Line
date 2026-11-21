// The Scheduled departures section (story-layer Req 11): the departures board behind a toggle
// button, below the next-step actions. The board is always in the DOM, so its number buttons
// register their Sources rows whether the section is open or closed. app.ts handles the click
// (`departures/toggle`, not a Visitor_Input) and keeps the section in step with state.
import { DEPARTURES_BUTTON } from '../copy/copy';
import { h } from './dom';

export const DEPARTURES_REGION_ID = 'departures-region';

export function departuresView(board: HTMLElement, open: boolean): HTMLElement {
  return h(
    'section',
    { class: 'departures' },
    h(
      'button',
      {
        type: 'button',
        class: 'departures-toggle',
        'data-action': 'departures',
        'aria-expanded': String(open),
        'aria-controls': DEPARTURES_REGION_ID,
      },
      DEPARTURES_BUTTON,
    ),
    h('div', { class: 'departures-region', id: DEPARTURES_REGION_ID, hidden: !open }, board),
  );
}

/** Bring a drawn section in line with state, in place (the card is not redrawn). */
export function syncDepartures(root: ParentNode, open: boolean): void {
  root.querySelector('.departures-toggle')?.setAttribute('aria-expanded', String(open));
  const region = root.querySelector<HTMLElement>('.departures-region');
  if (region) region.hidden = !open;
}
