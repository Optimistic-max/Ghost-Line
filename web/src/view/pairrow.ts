// The pair row: origin → destination and the swap button (R4, screen-brief 3A.1).
import { SWAP_DIRECTION } from '../copy/copy';
import { h } from './dom';
import { GLYPH } from './glyphs';

export function pairRow(originName: string, destName: string): HTMLElement {
  return h(
    'div',
    { class: 'pair-row-wrap' },
    h(
      'h2',
      { class: 'pair-row', id: 'pair-names' },
      h('span', { class: 'corner', id: 'origin-name' }, originName),
      h('span', { class: 'arrow' }, ` ${GLYPH.arrow} `),
      h('span', { class: 'corner', id: 'dest-name' }, destName),
    ),
    h('button', { type: 'button', class: 'icon-button swap', 'data-action': 'swap', 'aria-label': SWAP_DIRECTION }, GLYPH.swap),
  );
}
