// The time slider (R3): a native range input over the race file's minute rows,
// minus and plus buttons, the range ends in small muted text, and the start time
// in 12-hour form.
import { ONE_MINUTE_EARLIER, ONE_MINUTE_LATER, START_TIME, sliderValueText } from '../copy/copy';
import { clockOf, label12, minutesOf, shortClock } from '../format/time';
import { h } from './dom';
import { GLYPH } from './glyphs';

export type SliderModel = { first: string; last: string; minute: number };

export function slider(model: SliderModel): HTMLElement {
  const label = label12(clockOf(model.minute));
  const input = h('input', {
    type: 'range',
    class: 'slider-input',
    id: 'start-time',
    min: String(minutesOf(model.first)),
    max: String(minutesOf(model.last)),
    step: '1',
    value: String(model.minute),
    'aria-label': START_TIME,
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
        h('span', {}, shortClock(model.first)),
        h('span', {}, shortClock(model.last)),
      ),
    ),
    h('button', { type: 'button', class: 'icon-button step', 'data-action': 'plus', 'aria-label': ONE_MINUTE_LATER }, GLYPH.plus),
    h('output', { class: 'slider-time display', for: 'start-time', 'aria-hidden': 'true' }, label),
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
