// Accessibility helpers (R13, design 15). The race announcement: one write to
// the polite result region per race, at the result moment (for a photo finish,
// when both sides have arrived; at once under reduced motion), built from the
// shown numbers, after clearing the region. Keyboard focus kept across the
// card's redraws. The rest of the wiring lives with the parts it belongs to:
// the landmarks and the two status regions in index.html, the number buttons'
// labels in numbers.ts, the slider's in slider.ts, the modal sheets in
// sheets/sheet.ts and the focus ring in base.css.
import { announce1938Wins, announceNoOneSeatRide, announcePhotoFinish, announceTodayWins } from '../copy/announce';
import { label12 } from '../format/time';
import type { RaceView } from '../state/model';

/** The spoken summary of the race on screen. The walking total is the sum of the shown walk parts (R7.5). */
export function announcement(view: RaceView): string {
  const race = { origin: view.originName, dest: view.destName, time: label12(view.start), trolley: view.lane1938.shownTotal };
  const rv = view.resultView;
  if (rv.kind === 'no_one_seat_ride' || !view.laneToday || view.walkShown === null) return announceNoOneSeatRide(race);
  const bus = { ...race, bus: view.laneToday.shownTotal, walk: view.walkShown };
  switch (rv.kind) {
    case '1938':
      return announce1938Wins({ ...bus, margin: rv.shownMargin });
    case 'today':
      return announceTodayWins({ ...bus, margin: rv.shownMargin });
    case 'photo_finish':
      return announcePhotoFinish(bus);
  }
}

/** Delay between clearing the region and writing it, so assistive technology hears the new text. */
export const ANNOUNCE_DELAY_MS = 50;

// ---- Keyboard focus across a redraw (R13.1) ------------------------------------
// The card is drawn again for each race, and the finish removes the clock row.
// A keyboard user's focus stays on the control they were using, or on the one
// now standing in its place; if that control is gone, on the next one after it.

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';
/** The attributes that say which control an element is, besides its id. */
const NAMING = ['data-action', 'data-source', 'data-slug', 'data-index'] as const;

/** A control, by what it is and which of the controls of that kind. */
type Mark = { selector: string; nth: number };

function usable(el: HTMLElement): boolean {
  return el.isConnected && !el.closest('[hidden], [inert]') && !el.matches(':disabled') && el.getAttribute('tabindex') !== '-1';
}

function markOf(el: HTMLElement, scope: HTMLElement): Mark | null {
  // Ids and the naming attributes hold the site's own slug-like names, safe in a selector.
  const named = NAMING.filter((name) => el.hasAttribute(name)).map((name) => `[${name}="${el.getAttribute(name)}"]`);
  const selector = el.id ? `#${el.id}` : named.length > 0 ? `${el.localName}${named.join('')}` : null;
  if (!selector) return null;
  return { selector, nth: [...scope.querySelectorAll(selector)].indexOf(el) };
}

function find(scope: HTMLElement, mark: Mark): HTMLElement | null {
  const el = scope.querySelectorAll<HTMLElement>(mark.selector)[mark.nth];
  return el && usable(el) ? el : null;
}

/** The usable controls in a scope, in document order. */
function controlsIn(scope: HTMLElement): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(usable);
}

/**
 * Change the card, keeping keyboard focus: on the control that had it if it is
 * still usable; else on the control now standing in its place (the same id, or
 * the same action or number); else, when the old control is still on the page
 * but hidden, on the next control after it in the page (the previous one at the
 * end); else on the nearest control that came after it before the change and is
 * still there, or before it.
 */
export function keepFocus(scope: HTMLElement, change: () => void): void {
  const active = scope.ownerDocument.activeElement;
  if (!(active instanceof HTMLElement) || !scope.contains(active) || !usable(active)) {
    change();
    return;
  }
  const controls = controlsIn(scope);
  const at = controls.indexOf(active);
  if (at === -1) {
    change();
    return;
  }
  const marks = controls.map((el) => markOf(el, scope));
  const own = markOf(active, scope);
  const after = marks.slice(at);
  const before = marks.slice(0, at).reverse();
  change();
  if (usable(active) && scope.ownerDocument.activeElement === active) return;
  const standIn = own ? find(scope, own) : null;
  if (standIn) {
    standIn.focus();
    return;
  }
  if (active.isConnected && scope.contains(active)) {
    const now = controlsIn(scope);
    const next = now.find((el) => active.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    const previous = now.filter((el) => active.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING).at(-1);
    (next ?? previous)?.focus();
    return;
  }
  for (const mark of [...after, ...before]) {
    const el = mark ? find(scope, mark) : null;
    if (el) {
      el.focus();
      return;
    }
  }
}

export type Announcer = {
  /** Clear the region, then write the text after a short delay. */
  say(text: string): void;
  /** Drop a write not yet made. */
  cancel(): void;
};

export function createAnnouncer(
  region: HTMLElement | null,
  later: (callback: () => void, ms: number) => number,
  cancel: (handle: number) => void,
): Announcer {
  let pending: number | null = null;
  const drop = (): void => {
    if (pending !== null) cancel(pending);
    pending = null;
  };
  return {
    say(text) {
      if (!region) return;
      drop();
      region.textContent = '';
      pending = later(() => {
        pending = null;
        region.textContent = text;
      }, ANNOUNCE_DELAY_MS);
    },
    cancel: drop,
  };
}
