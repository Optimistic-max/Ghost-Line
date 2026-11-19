// Render the card for a pair and slider time, from the real files or the fixture,
// into a detached element (jsdom tests only).
import { pairKey } from '../../src/data/files';
import type { Index, Pair, RaceFile, Summary } from '../../src/data/types';
import { minutesOf } from '../../src/format/time';
import { buildView } from '../../src/state/derive';
import type { RaceView } from '../../src/state/model';
import { renderCard } from '../../src/view/card';
import { SourceRegistry } from '../../src/view/numbers';
import type { Layout } from '../../src/view/vehicles';

export type Data = { index: Index; summary: Summary; races: Map<string, RaceFile> };

export type Rendered = { root: HTMLElement; registry: SourceRegistry; view: RaceView; race: RaceFile };

export function renderAt(data: Data, pair: Pair, hhmm: string, layout: Layout = 'phone', fromClock = false): Rendered {
  const race = data.races.get(pairKey(pair));
  if (!race) throw new Error(`no race file for ${pairKey(pair)}`);
  const view = buildView(data.index, data.summary, race, hhmm);
  const registry = new SourceRegistry();
  const root = document.createElement('div');
  root.append(
    ...renderCard(registry, {
      index: data.index,
      summary: data.summary,
      race,
      view,
      minute: minutesOf(hhmm),
      minuteFromClock: fromClock,
      layout,
    }),
  );
  return { root, registry, view, race };
}

/** The text of an element with runs of white space made single. */
export function text(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The number button with a source id. */
export function num(root: Element, id: string): HTMLButtonElement {
  const el = root.querySelector<HTMLButtonElement>(`button.num[data-source="${id}"]`);
  if (!el) throw new Error(`no number button ${id}`);
  return el;
}

/** The whole number at the start of a number button's text ("15 min" gives 15). */
export function value(el: Element): number {
  const m = /^\d[\d,]*/.exec(text(el));
  if (!m) throw new Error(`no number in "${text(el)}"`);
  return Number(m[0].replace(/,/g, ''));
}
