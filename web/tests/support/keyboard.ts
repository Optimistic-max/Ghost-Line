// A keyboard for jsdom tests. jsdom dispatches key events but performs none of
// a browser's default actions, so this does the ones the race screen relies on,
// only when the page's own handlers have not prevented them: Tab and Shift+Tab
// move focus through the tab order; Enter and Space press a button or follow a
// link; the arrow keys, Home and End move a range input and fire its input and
// change events. Playwright runs the real keyboard in the browser (task 20).

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

/** Whether a browser would stop on the element when tabbing. */
function tabbable(el: HTMLElement): boolean {
  if (el.matches(':disabled') || el.getAttribute('tabindex') === '-1') return false;
  return el.isConnected && !el.closest('[hidden], [inert], [aria-hidden="true"]');
}

/** The page's tab order: the tabbable elements in document order (the site uses no positive tabindex). */
export function tabOrder(doc: Document = document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(tabbable);
}

/** A short name for a control: its id, its action and number, or its text. */
export function controlName(el: Element | null): string {
  if (!(el instanceof HTMLElement)) return '(none)';
  if (el.id) return `#${el.id}`;
  const { action, source, slug, index } = el.dataset;
  if (source) return `num:${source}`;
  // The desktop footer's "About and credits" is told apart from the info button.
  if (action) return [action, slug, index].filter(Boolean).join(':') + (el.closest('#card-footer') ? '@footer' : '');
  return `${el.localName}:${(el.textContent ?? '').trim()}`;
}

function key(type: 'keydown' | 'keyup', target: Element, name: string, shift: boolean): boolean {
  return target.dispatchEvent(new KeyboardEvent(type, { key: name, shiftKey: shift, bubbles: true, cancelable: true }));
}

function moveRange(input: HTMLInputElement, name: string): void {
  const min = Number(input.min);
  const max = Number(input.max);
  const step = Number(input.step) || 1;
  const now = Number(input.value);
  const next =
    name === 'Home' ? min : name === 'End' ? max : name === 'ArrowRight' || name === 'ArrowUp' ? Math.min(max, now + step) : Math.max(min, now - step);
  if (next === now) return;
  input.value = String(next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Press a key on the focused element (or the body), as a browser would. */
export function press(name: string, options: { shift?: boolean } = {}): void {
  const doc = document;
  const shift = options.shift ?? false;
  const target = doc.activeElement ?? doc.body;
  const go = key('keydown', target, name, shift);
  if (go) {
    if (name === 'Tab') {
      // From wherever focus is (a heading with tabindex -1 too), to the next stop after it in the page, wrapping round.
      const order = tabOrder(doc);
      const next = shift
        ? [...order].reverse().find((el) => target.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) ?? order.at(-1)
        : order.find((el) => el !== target && target.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) ?? order[0];
      next?.focus();
    } else if ((name === 'Enter' || name === ' ') && target instanceof HTMLButtonElement && !target.disabled) {
      target.click();
    } else if (name === 'Enter' && target instanceof HTMLAnchorElement) {
      target.click();
    } else if (target instanceof HTMLInputElement && target.type === 'range' && /^(Arrow(Left|Right|Up|Down)|Home|End)$/.test(name)) {
      moveRange(target, name);
    }
  }
  key('keyup', doc.activeElement ?? doc.body, name, shift);
}

/** Tab until the control named `name` has focus; fails after a whole round of the tab order. */
export function tabTo(name: string, options: { shift?: boolean } = {}): HTMLElement {
  const rounds = tabOrder().length + 1;
  for (let k = 0; k < rounds; k += 1) {
    press('Tab', options);
    if (controlName(document.activeElement) === name) return document.activeElement as HTMLElement;
  }
  throw new Error(`Tab never reached ${name}; the tab order is ${tabOrder().map(controlName).join(', ')}`);
}
