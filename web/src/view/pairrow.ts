// The pair row: origin → destination and the swap button (R4, screen-brief 3A.1).
// The names open the corner picker: a button named "Choose two corners" (copy
// table, pair row controls) lies over the heading, so the heading still names
// the race card (index.html labels the card by #pair-names). The inferred
// corner carries the "Inferred corner" chip by its name (R6.7).
import { INFERRED_CHIP, PICKER_TITLE, SWAP_DIRECTION } from '../copy/copy';
import { h } from './dom';
import { GLYPH } from './glyphs';

/** Which end of the pair is the inferred corner, if either. */
export type InferredEnd = 'origin' | 'dest' | null;

export function pairRow(originName: string, destName: string, inferred: InferredEnd = null): HTMLElement {
  const chip = (end: InferredEnd) => (inferred === end ? h('span', { class: 'chip-inferred pair-chip' }, INFERRED_CHIP) : null);
  return h(
    'div',
    { class: 'pair-row-wrap' },
    h(
      'div',
      { class: 'pair-names-wrap' },
      h(
        'h2',
        { class: 'pair-row', id: 'pair-names', 'data-chip': inferred !== null },
        h('span', { class: 'corner', id: 'origin-name' }, originName),
        chip('origin'),
        h('span', { class: 'arrow' }, ` ${GLYPH.arrow} `),
        h('span', { class: 'corner', id: 'dest-name' }, destName),
        chip('dest'),
      ),
      h('button', { type: 'button', class: 'pair-pick', 'data-action': 'picker', 'aria-label': PICKER_TITLE }),
    ),
    h('button', { type: 'button', class: 'icon-button swap', 'data-action': 'swap', 'aria-label': SWAP_DIRECTION }, GLYPH.swap),
  );
}
