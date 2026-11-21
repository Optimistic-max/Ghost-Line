// Task 11.2: the three notices (before the midday table, the inferred corner, the today-win shortcut)
// sit directly under the schedule line, and the schedule line with "Scheduled, not live." stays visible
// while each shows (story-layer Req 7.13, 10.5, 12.2). The today-win notice and the example label carry
// their times as plain text, with no number button (Req 3.8, 10.5). Pairs and times come from the files.
import { afterEach, describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import * as C from '../../src/copy/copy';
import { cornerName } from '../../src/data/lookup';
import type { Pair } from '../../src/data/types';
import { label12, minutesOf, serviceDateLabel, shortClock } from '../../src/format/time';
import { bootPage } from '../support/page';
import { raceOf, realData, slugNamed } from '../support/realdata';
import { text } from '../support/render';

const { index, summary } = realData();
const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
const inferred = index.corners.find((c) => c.inferred)!;
const newYork = (hhmm: string): Date => new Date(`${index.service_date}T${hhmm}:00-05:00`);
const query = (p: Pair): string => `?from=${p.origin}&to=${p.dest}`;
const settle = async (): Promise<void> => {
  for (let k = 0; k < 5; k += 1) await new Promise((done) => setTimeout(done, 0));
};

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
});

/** Not hidden by the `hidden` attribute, on the element or any ancestor. */
function visible(el: Element | null): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node instanceof HTMLElement && node.hidden) return false;
  }
  return el !== null;
}

const kinds = (): string[] => [...document.querySelectorAll<HTMLElement>('.notices > .notice')].map((n) => n.dataset['notice']!);

/** The schedule line is visible with the fixed phrase, and the notices block is its next sibling. */
function expectUnderScheduleLine(expected: string[]): void {
  const schedule = document.querySelector('.schedule');
  expect(visible(schedule)).toBe(true);
  expect(text(schedule).startsWith(C.ready(serviceDateLabel(index.service_date)))).toBe(true);
  expect(text(schedule)).toContain(C.NOT_LIVE);
  const block = document.querySelector('.notices');
  expect(block).not.toBeNull();
  expect(schedule!.nextElementSibling).toBe(block);
  expect(document.querySelectorAll('.notices')).toHaveLength(1);
  expect(kinds()).toEqual(expected);
  expect(visible(block)).toBe(true);
}

describe('each notice follows the schedule line directly', () => {
  it('before the midday table: the first slider minute of the lead pair', async () => {
    const first = raceOf(lead).races[0]!;
    expect(first.before_table).toBe(true);
    await bootPage({ query: query(lead), now: newYork(first.t), motion: 'reduced' });
    expectUnderScheduleLine(['before-table']);
    expect(text(document.querySelector('.notice[data-notice="before-table"]'))).toBe(C.beforeTable(shortClock(first.start)));
  });

  it('the inferred corner: a pair with Brevard & Preston, at a start inside the table', async () => {
    const pair: Pair = { origin: inferred.slug, dest: slugNamed('Aliceanna & Bond') };
    const covered = raceOf(pair).races.find((r) => !r.before_table)!;
    await bootPage({ query: query(pair), now: newYork(covered.t), motion: 'reduced' });
    expectUnderScheduleLine(['inferred']);
    expect(text(document.querySelector('.notice[data-notice="inferred"]'))).toBe(C.INFERRED_CAUTION);
  });

  it('the inferred corner and a start before the table: both notices, in that order, under the line', async () => {
    const pair: Pair = { origin: inferred.slug, dest: slugNamed('Aliceanna & Bond') };
    const before = raceOf(pair).races.find((r) => r.before_table)!;
    await bootPage({ query: query(pair), now: newYork(before.t), motion: 'reduced' });
    expectUnderScheduleLine(['before-table', 'inferred']);
  });

  it('the today-win shortcut: the first summary.today_wins entry, after the schedule line, last in the block', async () => {
    const entry = summary.today_wins[0]!;
    const app = await bootPage({ motion: 'reduced' });
    expect(document.querySelector('[data-notice="today-win"]')).toBeNull();
    app.store.dispatch({ type: 'todaywin/select' });
    await settle();
    expect(app.store.get().todayWinNotice).toEqual(entry);
    const notice = document.querySelector<HTMLElement>('.notice[data-notice="today-win"]')!;
    expect(notice).not.toBeNull();
    const shown = kinds();
    expect(shown[shown.length - 1]).toBe('today-win');
    expectUnderScheduleLine(shown);
    expect(visible(notice)).toBe(true);
    expect(text(notice)).toBe(
      C.todayWinNotice(cornerName(index, entry.origin)!, cornerName(index, entry.dest)!, label12(entry.t)),
    );
  });
});

describe('times in the example label and the today-win notice are plain text (Req 3.8, 10.5)', () => {
  it('the example label on a guided visit has no number button', async () => {
    await bootPage({ motion: 'reduced' });
    const label = document.querySelector('.example-label');
    expect(label).not.toBeNull();
    expect(label!.querySelector('button.num')).toBeNull();
    expect(label!.querySelectorAll('button')).toHaveLength(0);
  });

  it('the today-win notice has no number button', async () => {
    const app = await bootPage({ motion: 'reduced' });
    app.store.dispatch({ type: 'todaywin/select' });
    await settle();
    const notice = document.querySelector('.notice[data-notice="today-win"]')!;
    expect(notice.querySelector('button.num')).toBeNull();
    expect(notice.querySelectorAll('button')).toHaveLength(0);
    expect(minutesOf(summary.today_wins[0]!.t)).toBe(app.store.get().minute);
  });
});
