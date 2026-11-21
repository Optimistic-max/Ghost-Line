// The time controls (R3, story-layer Req 9.12), in two rows: the start row (the visible label, the
// example label while the visit is guided, and the large start time in 12-hour form) and the slider
// row (minus, a native range input over the race file's minute rows, plus, and the range ends in
// small muted text). The start-time chart sits between them.
import { ONE_MINUTE_EARLIER, ONE_MINUTE_LATER, SLIDER_LABEL, exampleLabel, sliderValueText } from '../copy/copy';
import { clockOf, label12, minutesOf } from '../format/time';
import { h } from './dom';
import { GLYPH } from './glyphs';

export type SliderModel = { first: string; last: string; minute: number };

/** The label, the example label (guided visits only, plain text) and the large start time. */
export function startRow(minute: number, guided: boolean): HTMLElement {
  const label = label12(clockOf(minute));
  return h(
    'div',
    { class: 'start-row' },
    h(
      'div',
      { class: 'start-text' },
      h('label', { class: 'slider-label', for: 'start-time' }, SLIDER_LABEL),
      guided ? h('p', { class: 'example-label' }, exampleLabel(label)) : null,
    ),
    h('output', { class: 'slider-time display', for: 'start-time', 'aria-hidden': 'true' }, label),
  );
}

/** Minus, the input, plus, and the two ends read from the first and last race row. */
export function sliderRow(model: SliderModel): HTMLElement {
  const label = label12(clockOf(model.minute));
  const input = h('input', {
    type: 'range',
    class: 'slider-input',
    id: 'start-time',
    min: String(minutesOf(model.first)),
    max: String(minutesOf(model.last)),
    step: '1',
    value: String(model.minute),
    'aria-valuetext': sliderValueText(label),
  });
  return h(
    'div',
    { class: 'slider-row' },
    h('button', { type: 'button', class: 'icon-button step', 'data-action': 'minus', 'aria-label': ONE_MINUTE_EARLIER }, GLYPH.minus),
    h(
      'div',
      { class: 'slider-track' },
      input,
      h(
        'div',
        { class: 'slider-ends', 'aria-hidden': 'true' },
        h('span', {}, label12(model.first)),
        h('span', {}, label12(model.last)),
      ),
    ),
    h('button', { type: 'button', class: 'icon-button step', 'data-action': 'plus', 'aria-label': ONE_MINUTE_LATER }, GLYPH.plus),
  );
}

/** While the slider is moved, only the time label changes (R3.5): the value, its spoken text and the large time. */
export function updateSlider(root: ParentNode, minute: number): void {
  const label = label12(clockOf(minute));
  const input = root.querySelector<HTMLInputElement>('#start-time');
  if (input) {
    if (input.value !== String(minute)) input.value = String(minute);
    input.setAttribute('aria-valuetext', sliderValueText(label));
  }
  const time = root.querySelector('.slider-time');
  if (time) time.textContent = label;
}
