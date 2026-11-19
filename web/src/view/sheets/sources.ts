// The Sources sheet (R9.3 to R9.6, design 10): one row for every number on
// screen, built from the same registry the number buttons filled, so every
// number has its row. A row gives the value and what it is; where it comes
// from (the catalog label, linked, or the race file's own page); how it was
// worked out; and the date of the data. Walk rows add the method entry's own
// text, bus rows their trip, and a part that is not the plain rounding of its
// stored value its exact value. The last row opens the credits.
import {
  NEW_TAB,
  SOURCES_AND_CREDITS,
  SOURCES_TITLE,
  dateEffective,
  dateFeed,
  exactValue,
} from '../../copy/copy';
import type { Index, SourceId } from '../../data/types';
import { storedText } from '../../format/rounding';
import { longDateLabel, weekdayDateLabel } from '../../format/time';
import type { SourceSpec } from '../../state/specs';
import { h } from '../dom';
import type { SourceRegistry } from '../numbers';
import type { SheetParts } from './sheet';

/** A link that opens in a new tab, with the words that say so (R9.4). */
export function sourceLink(label: string, url: string | null): HTMLElement {
  if (!url) return h('span', { class: 'source-label' }, label);
  return h(
    'span',
    { class: 'source-label' },
    h('a', { href: url, target: '_blank', rel: 'noopener' }, label),
    ` ${NEW_TAB}`,
  );
}

function fromLines(index: Index, spec: SourceSpec): HTMLElement[] {
  return spec.sourceIds.map((id: SourceId, k) => {
    const entry = index.sources[id];
    // The race file's own page (the 1938 diagram or timetable) stands in for the first source's link.
    const url = k === 0 && spec.url ? spec.url : entry.url;
    return h('p', { class: 'source-from', 'data-catalog': id }, sourceLink(entry.label, url));
  });
}

function dateLines(index: Index, spec: SourceSpec): HTMLElement[] {
  const effective = h('p', { class: 'source-date' }, dateEffective(longDateLabel(index.effective)));
  const feed = h('p', { class: 'source-date' }, dateFeed(index.feed_version, weekdayDateLabel(index.service_date)));
  if (spec.date === 'effective') return [effective];
  if (spec.date === 'feed') return [feed];
  return [effective, feed];
}

function row(index: Index, spec: SourceSpec, target: boolean): HTMLElement {
  return h(
    'li',
    { class: target ? 'source-row is-target' : 'source-row', 'data-source': spec.id },
    h(
      'p',
      { class: 'source-head' },
      h('span', { class: 'source-value display' }, spec.value),
      ' ',
      h('span', { class: 'source-what' }, spec.rowWhat),
    ),
    ...fromLines(index, spec),
    h('p', { class: 'source-method' }, spec.method),
    spec.walk ? h('p', { class: 'source-method', 'data-part': 'formula' }, index.sources.method.what) : null,
    spec.tripLine ? h('p', { class: 'source-trip' }, spec.tripLine) : null,
    spec.exact ? h('p', { class: 'source-exact' }, exactValue(storedText(spec.exact.stored), spec.exact.shownTotal)) : null,
    ...dateLines(index, spec),
  );
}

/** The sheet's parts; `target` is the tapped number's id, whose row gets the --ghost edge. */
export function sourcesSheet(registry: SourceRegistry, index: Index, target: string | null): SheetParts {
  const rows = registry.list().map((spec) => row(index, spec, spec.id === target));
  const credits = h(
    'li',
    { class: 'source-row source-credits' },
    h('button', { type: 'button', class: 'link', 'data-action': 'credits' }, SOURCES_AND_CREDITS),
  );
  return { name: 'sources', title: SOURCES_TITLE, body: [h('ul', { class: 'source-rows' }, ...rows, credits)] };
}

/** Bring the tapped number's row into view (design 10). */
export function showTarget(sheet: HTMLElement): void {
  const row = sheet.querySelector<HTMLElement>('.source-row.is-target');
  if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' });
}
