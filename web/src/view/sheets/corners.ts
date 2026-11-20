// The corner picker (R4.1, screen-brief 2.12, mockup 19): the title, the step
// line, the five corners as full-width buttons in index.json's order (west to
// east along the line), the "inferred" chip, the "Start" tag on the chosen
// start, which is disabled in the second step, the note and Cancel.
import {
  CANCEL,
  INFERRED_TAG,
  PICKER_START_TAG,
  PICKER_STEP_END,
  PICKER_STEP_START,
  PICKER_TITLE,
  pickerNote,
} from '../../copy/copy';
import type { Index } from '../../data/types';
import type { Picker } from '../../state/model';
import { h } from '../dom';
import type { SheetParts } from './sheet';

export function cornersSheet(index: Index, picker: Picker): SheetParts {
  const second = picker.step === 'end';
  const start = picker.step === 'end' ? picker.start : null;
  const inferred = index.corners.find((c) => c.inferred);
  const choices = index.corners.map((corner) => {
    const isStart = corner.slug === start;
    return h(
      'li',
      {},
      h(
        'button',
        {
          type: 'button',
          class: isStart ? 'corner-choice is-start' : 'corner-choice',
          'data-action': 'pick',
          'data-slug': corner.slug,
          // In the second step the start cannot be chosen again (R4.1).
          disabled: isStart,
          'aria-pressed': second && isStart ? 'true' : null,
        },
        h('span', { class: 'corner-name display' }, corner.name),
        corner.inferred ? h('span', { class: 'chip-inferred' }, INFERRED_TAG) : null,
        isStart ? h('span', { class: 'start-tag' }, PICKER_START_TAG) : null,
      ),
    );
  });
  return {
    name: 'corners',
    title: PICKER_TITLE,
    body: [
      h('p', { class: 'picker-step', 'aria-live': 'polite' }, second ? PICKER_STEP_END : PICKER_STEP_START),
      h('ul', { class: 'corner-list' }, ...choices),
      inferred ? h('p', { class: 'picker-note' }, pickerNote(inferred.name)) : null,
    ],
    closeLabel: CANCEL,
  };
}

/** The first corner that can be chosen, to take the focus in each step. */
export function firstChoice(sheet: HTMLElement): HTMLElement | null {
  return sheet.querySelector<HTMLElement>('.corner-choice:not([disabled])');
}
