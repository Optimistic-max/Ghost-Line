// Number buttons and the per-render source registry (design 10, R9). Every number
// the card prints is a button with a dotted underline that opens the Sources
// sheet at its row. Creating a button registers its source, so the Sources
// sheet is built from the same registry: every number on the card has a row.
import { numberLabel } from '../copy/copy';
import type { SourceSpec } from '../state/specs';
import { h } from './dom';

export type { SourceSpec };

/** The sources of the numbers on screen, by id. Cleared on each render. */
export class SourceRegistry {
  private readonly specs = new Map<string, SourceSpec>();

  add(spec: SourceSpec): void {
    this.specs.set(spec.id, spec);
  }

  get(id: string): SourceSpec | undefined {
    return this.specs.get(id);
  }

  /** Drop the entry of a number no longer on screen (a board redrawn while the slider moves). */
  delete(id: string): void {
    this.specs.delete(id);
  }

  /** The entries in the order they first appeared on screen. */
  list(): SourceSpec[] {
    return [...this.specs.values()];
  }

  clear(): void {
    this.specs.clear();
  }
}

/**
 * A number on screen: its source, its text as printed alone ("15 min"), and the
 * number without its unit for use inside a sentence ("15").
 */
export type NumberSlot = { spec: SourceSpec; text: string; bare: string };

/**
 * A number button. Its text is printed as given; its name starts with that same
 * text, then says what it is and that it opens its source ("6 min, scheduled 1938
 * wait. Show source."), so the visible text is part of the name (WCAG 2.5.3).
 */
export function numberButton(registry: SourceRegistry, slot: NumberSlot): HTMLButtonElement {
  registry.add(slot.spec);
  return h(
    'button',
    { type: 'button', class: 'num', 'data-source': slot.spec.id, 'aria-label': numberLabel(slot.text, slot.spec.what) },
    slot.text,
  );
}

/** A number for a sentence: printed as `text`, counted as `n` for the minute words. */
export type Slot = NumberSlot & { n: number };

/** A number-button token: prints as a marker, and counts as its number for the minute words. */
class Token {
  constructor(
    private readonly n: number,
    private readonly key: string,
  ) {}

  valueOf(): number {
    return this.n;
  }

  toString(): string {
    return `\u0001${this.key}\u0002`;
  }
}

const MARK = /\u0001([^\u0002]*)\u0002/;
const UNIT_AFTER = /^ (min|minutes?)\b/;
const PUNCTUATION_AFTER = /^[.,;:]/;

function isSlot(arg: unknown): arg is Slot {
  return typeof arg === 'object' && arg !== null && 'spec' in arg && 'n' in arg;
}

/**
 * A copy-table template rendered with some of its numbers as buttons. Each slot
 * argument becomes a button holding the slot's text and the unit that follows
 * it in the template ("6 min", "30 minutes"); the rest is plain text. Other
 * arguments are passed as they are.
 */
export function sentence<A extends unknown[]>(
  registry: SourceRegistry,
  template: (...args: A) => string,
  ...args: { [K in keyof A]: A[K] | Slot }
): DocumentFragment {
  const slots = new Map<string, Slot>();
  const passed = args.map((arg) => {
    if (!isSlot(arg)) return arg;
    slots.set(arg.spec.id, arg);
    return new Token(arg.n, arg.spec.id);
  }) as unknown as A;
  // split() with a capturing group alternates text and slot ids, starting and ending with text.
  const pieces = template(...passed).split(MARK);
  const out = document.createDocumentFragment();
  let isKey = false;
  let pending: Slot | undefined;
  for (const piece of pieces) {
    if (isKey) {
      pending = slots.get(piece);
    } else {
      let text = piece;
      if (pending) {
        const unit = UNIT_AFTER.exec(text)?.[0] ?? '';
        const button = numberButton(registry, { ...pending, text: `${pending.bare}${unit}` });
        text = text.slice(unit.length);
        // Punctuation right after a number stays on its line.
        const mark = PUNCTUATION_AFTER.exec(text)?.[0] ?? '';
        out.append(mark ? h('span', { class: 'nowrap' }, button, mark) : button);
        text = text.slice(mark.length);
        pending = undefined;
      }
      if (text) out.append(text);
    }
    isKey = !isKey;
  }
  return out;
}
