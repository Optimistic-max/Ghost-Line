// A sheet (R1.5, design 15): a modal dialog that slides up on a phone and in
// from the right of the race column on desktop, over a scrim. Focus moves into
// it and is kept there; Escape, the scrim and Close shut it, and focus returns
// to the control that opened it. The slide is the stylesheet's transition
// (220 ms in, 160 ms out); with reduced motion the root class removes it.
import { CLOSE } from '../../copy/copy';
import { h } from '../dom';

export type SheetParts = {
  /** The sheet's name, for the store and for tests. */
  name: string;
  title: string;
  body: Node[];
};

export type OpenSheet = {
  el: HTMLElement;
  /** Shut the sheet. With `returnFocus`, focus goes back to the control that opened it. */
  close(returnFocus: boolean): void;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The control to give focus back to: the opener, or the control now standing in its place after a redraw. */
function returnTarget(doc: Document, opener: HTMLElement | null): HTMLElement | null {
  if (!opener) return null;
  if (opener.isConnected) return opener;
  const source = opener.dataset['source'];
  const action = opener.dataset['action'];
  // Source ids and actions are the site's own slug-like names, safe in a selector.
  if (source) return doc.querySelector<HTMLElement>(`#card-scroll [data-source="${source}"]`);
  if (action) return doc.querySelector<HTMLElement>(`[data-action="${action}"]`);
  return null;
}

/** Keep Tab and Shift+Tab inside the sheet. */
function trapFocus(sheet: HTMLElement, event: KeyboardEvent): void {
  const items = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = items[0];
  const last = items.at(-1);
  if (!first || !last) return;
  const active = sheet.ownerDocument.activeElement;
  const inside = active instanceof HTMLElement && sheet.contains(active);
  if (event.shiftKey && (active === first || !inside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    first.focus();
  }
}

export function openSheet(
  doc: Document,
  root: HTMLElement,
  scrim: HTMLElement,
  parts: SheetParts,
  opener: HTMLElement | null,
  onEscape: () => void,
): OpenSheet {
  const title = h('h2', { class: 'sheet-title display', id: 'sheet-title', tabindex: '-1' }, parts.title);
  const el = h(
    'section',
    { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title', 'data-sheet': parts.name },
    h('div', { class: 'sheet-handle', 'aria-hidden': 'true' }),
    title,
    h('div', { class: 'sheet-body' }, ...parts.body),
    h('button', { type: 'button', class: 'button button-outline sheet-close', 'data-action': 'close-sheet' }, CLOSE),
  );
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onEscape();
    } else if (event.key === 'Tab') trapFocus(el, event);
  });
  root.replaceChildren(el);
  // Read the layout once, so the slide starts from the closed position.
  void el.offsetWidth;
  el.classList.add('is-open');
  scrim.classList.add('is-open');
  title.focus();

  let closed = false;
  return {
    el,
    close(returnFocus) {
      if (closed) return;
      closed = true;
      el.classList.remove('is-open');
      scrim.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      el.toggleAttribute('inert', true);
      // Gone once the slide out has run; at once when nothing slides.
      const remove = (): void => el.remove();
      el.addEventListener('transitionend', (event) => {
        if (event.target === el) remove();
      });
      if (getComputedStyle(el).transitionDuration.split(',').every((d) => Number.parseFloat(d) === 0)) remove();
      if (returnFocus) returnTarget(doc, opener)?.focus();
    },
  };
}
