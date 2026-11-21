// The two buttons under the card (Sources; Share this race) and the desktop footer line.
import { ABOUT_AND_CREDITS, FOOTER_LINE, SHARE_THIS_RACE, SOURCES } from '../copy/copy';
import { h } from './dom';

export function cardButtons(): HTMLElement[] {
  return [
    h('button', { type: 'button', class: 'button button-outline', 'data-action': 'sources' }, SOURCES),
    h('button', { type: 'button', class: 'button button-outline', 'data-action': 'share' }, SHARE_THIS_RACE),
  ];
}

export function footer(): HTMLElement[] {
  return [
    h('button', { type: 'button', class: 'link', 'data-action': 'about' }, ABOUT_AND_CREDITS),
    h('span', { class: 'footer-line' }, FOOTER_LINE),
  ];
}
