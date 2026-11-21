// Task 15: the remaining states, each reached in a test (R17.1, 15.6): loading,
// ready, before the midday table, the inferred corner, no one-seat ride (the
// fixture, with its tag), the data error with Try again and the 3 s timeout,
// and the line label and route number from index.json. Real data where the
// state is real; expected text from the copy table and the files.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_LINE, LEAD_PAIR, TIMINGS } from '../../src/config';
import * as C from '../../src/copy/copy';
import { cornerName } from '../../src/data/lookup';
import type { Index, Pair } from '../../src/data/types';
import { routeNumberOf, yearOf } from '../../src/format/line';
import { minutesOf, serviceDateLabel, shortClock } from '../../src/format/time';
import { FIXTURE_DIR, fixtureData } from '../support/fixture';
import { bootPage, mountPage } from '../support/page';
import { raceOf, readData, realData, slugNamed } from '../support/realdata';
import { text } from '../support/render';

const { index } = realData();
const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
const inferred = index.corners.find((c) => c.inferred)!;
const newYork = (hhmm: string): Date => new Date(`${index.service_date}T${hhmm}:00-05:00`);
const query = (p: Pair): string => `?from=${p.origin}&to=${p.dest}`;
const digitsIn = (el: Element | null): string[] => (el?.textContent ?? '').match(/\d+/g) ?? [];

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.documentElement.className = '';
});

describe('loading and ready (15.1)', () => {
  it('shows the pair names and the loading line, and only "Ghost Line" in the top bar, until the data is in', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const app = mountPage({ hang: new Set(['summary.json']) });
    const booting = app.boot();
    await vi.advanceTimersByTimeAsync(0);
    expect(app.store.get().data.status).toBe('loading');
    expect(text(document.getElementById('loading-line'))).toBe(C.LOADING);
    expect(text(document.getElementById('origin-name'))).toBe(cornerName(index, lead.origin));
    expect(text(document.getElementById('topbar'))).toBe(C.WORDMARK);
    expect(document.querySelector<HTMLElement>('#app > button.info')!.hidden).toBe(true);
    // After 3 s without the data, the data error (R2.2).
    await vi.advanceTimersByTimeAsync(TIMINGS.dataTimeoutMs - 1);
    expect(app.store.get().data.status).toBe('loading');
    await vi.advanceTimersByTimeAsync(1);
    await booting;
    expect(app.store.get().data.status).toBe('error');
    expect(document.querySelector('.data-error')).not.toBeNull();
  });

  it('is ready with the schedule line, "Start time is the time now." only for a clock time, and the race starting by itself', async () => {
    const app = await bootPage({ motion: 'reduced' });
    expect(text(document.querySelector('.schedule'))).toBe(C.ready(serviceDateLabel(index.service_date)));
    expect(text(document.querySelector('.schedule'))).not.toContain(C.START_IS_NOW);
    expect(app.store.get().race.phase).toBe('finished');
    // A clock-derived start needs a valid share link (story-layer Req 3.3).
    await bootPage({ motion: 'reduced', query: query(lead), now: newYork('11:23') });
    expect(text(document.querySelector('.schedule'))).toContain(C.START_IS_NOW);
  });
});

describe('before the midday table (15.2): the lead pair at the first slider minute', () => {
  const race = raceOf(lead);
  const first = race.races[0]!;

  it('names row.start in a notice in place of the schedule line, races from it, and leaves the thumb where it was', async () => {
    expect(first.before_table).toBe(true);
    await bootPage({ query: query(lead), now: newYork(first.t) });
    const notice = document.querySelector('.notice[data-notice="before-table"]')!;
    expect(text(notice)).toBe(C.beforeTable(shortClock(first.start)));
    expect(document.querySelector('.schedule')).not.toBeNull();
    expect(document.querySelector<HTMLInputElement>('#start-time')!.value).toBe(String(minutesOf(first.t)));
    // Both lanes and the board start from row.start; the start time in the notice is a number with its source.
    expect(text(document.querySelector('.clock-readout'))).toBe(C.clockReadout(shortClock(first.start)));
    expect(text(document.querySelector('.board-head'))).toBe(C.boardHeader(shortClock(first.start)));
    const buttons = [...notice.querySelectorAll<HTMLElement>('button.num')];
    expect(buttons.map((b) => b.dataset['source'])).toEqual(['next-1938', 'next-1938']);
    // Apart from the word 1938 in its wording, the notice's only numbers are those buttons.
    const loose = (notice.textContent ?? '').replace(/\b1938\b/g, '');
    expect((loose.match(/\d+/g) ?? []).join(' ')).toBe(buttons.flatMap((b) => digitsIn(b)).join(' '));
  });
});

describe('the inferred corner (15.2)', () => {
  const pair: Pair = { origin: inferred.slug, dest: slugNamed('Aliceanna & Bond') };

  it('shows the chip by its name and the caution in place of the schedule line; the lead pair never shows them', async () => {
    await bootPage({ query: query(pair), motion: 'reduced' });
    const row = document.getElementById('pair-names')!;
    expect(row.hasAttribute('data-chip')).toBe(true);
    const chip = row.querySelector('.pair-chip')!;
    expect(text(chip)).toBe(C.INFERRED_CHIP);
    expect(chip.previousElementSibling?.id).toBe('origin-name');
    expect(text(document.querySelector('.notice[data-notice="inferred"]'))).toBe(C.INFERRED_CAUTION);
    expect(document.querySelector('.schedule')).not.toBeNull();
    await bootPage({ motion: 'reduced' });
    expect(document.querySelector('.pair-chip, .notice')).toBeNull();
  });

  it('puts the chip by the destination when the inferred corner is the destination', async () => {
    await bootPage({ query: query({ origin: pair.dest, dest: pair.origin }), motion: 'reduced' });
    expect(document.querySelector('#pair-names .pair-chip')!.previousElementSibling?.id).toBe('dest-name');
  });

  it('shows both notices before the midday table at an inferred corner', async () => {
    const race = raceOf(pair);
    const before = race.races.find((r) => r.before_table);
    expect(before).toBeDefined();
    await bootPage({ query: query(pair), motion: 'reduced', now: newYork(before!.t) });
    expect([...document.querySelectorAll<HTMLElement>('.notice')].map((n) => n.dataset['notice'])).toEqual(['before-table', 'inferred']);
  });
});

describe('no one-seat ride (15.3): only the fixture, with its tag', () => {
  const fixture = fixtureData();
  const pair = fixture.index.pairs.find((p) => fixture.races.get(`${p.origin}__${p.dest}`)!.today.trips.length === 0)!;

  it('keeps the 1938 lane, says no single bus links the corners, and shows no bus vehicle, total or margin', async () => {
    expect(fixture.index.line).toBe(FIXTURE_LINE);
    await bootPage({ folder: FIXTURE_DIR, query: query(pair), leadPair: pair, motion: 'reduced' });
    const tag = document.querySelector<HTMLElement>('.fixture-tag')!;
    expect(tag.hidden).toBe(false);
    expect(text(tag)).toBe(C.FIXTURE_TAG);
    expect(text(document.querySelector('.lane-none .lane-title'))).toBe(C.LANE_TITLE_TODAY);
    expect(text(document.querySelector('.lane-none .no-bus'))).toBe(C.NO_SINGLE_BUS);
    expect(document.querySelector('.lane-today, [data-vehicle="bus"], [data-source="total-today"], [data-source="margin"]')).toBeNull();
    expect(text(document.querySelector('.result-line'))).toBe(C.NO_ONE_SEAT_RIDE);
  });

  it('is never reached with the shipped data, which never carries the tag', async () => {
    expect(index.line).not.toBe(FIXTURE_LINE);
    for (const race of realData().races.values()) {
      expect(race.races.every((r) => r.result !== 'no_one_seat_ride'), `${race.origin} → ${race.dest}`).toBe(true);
    }
    await bootPage({ motion: 'reduced' });
    expect(document.querySelector<HTMLElement>('.fixture-tag')!.hidden).toBe(true);
  });
});

describe('the data error (15.4)', () => {
  it('shows the message, Try again and the corner names, and recovers on Try again without a reload', async () => {
    const fail = new Set(['summary.json']);
    const app = await bootPage({ fail, motion: 'reduced' });
    expect(app.store.get().data.status).toBe('error');
    expect(text(document.getElementById('origin-name'))).toBe(cornerName(index, lead.origin));
    // The headline keeps "Same ride, longer wait." and drops its second line while the error shows.
    expect(text(document.querySelector('#headline .headline-title'))).toBe(C.SAME_RIDE);
    expect(document.querySelector('#headline .headline-line')).toBeNull();
    fail.delete('summary.json');
    document.querySelector<HTMLElement>('[data-action="retry"]')!.click();
    for (let k = 0; k < 5; k += 1) await new Promise((done) => setTimeout(done, 0));
    expect(app.store.get().data.status).toBe('ready');
    expect(document.querySelector('.data-error')).toBeNull();
    expect(document.querySelector('.result')).not.toBeNull();
    expect(text(document.querySelector('#headline .headline-line'))).toBe(C.HEADLINE_LINE);
  });

  it('shows the data error when a file fails its shape check', async () => {
    const broken: Record<string, unknown> = { ...readData<Index>('index.json') };
    delete broken['corners'];
    const app = await bootPage({ override: { 'index.json': broken } });
    expect(app.store.get().data.status).toBe('error');
  });

  it('renders no number anywhere in the page (P7)', async () => {
    await bootPage({ fail: new Set(['summary.json']) });
    expect(digitsIn(document.body)).toEqual([]);
  });
});

describe('the line label and the route number (15.5)', () => {
  it('builds "No. 21, 1938" from index.json, and shows the trolley\'s number on desktop only (the 104 px phone trolley is under the cut-off)', async () => {
    await bootPage({ layout: 'desktop' });
    const n = routeNumberOf(index.line)!;
    expect(text(document.getElementById('line-label'))).toBe(C.lineLabel(n, yearOf(index.effective)!));
    expect(text(document.querySelector('.lane-1938 [data-part="route-number"]'))).toBe(n);
    document.body.innerHTML = '';
    await bootPage({ layout: 'phone' });
    expect(text(document.getElementById('line-label'))).toBe(C.lineLabel(n, yearOf(index.effective)!));
    expect(document.querySelector('[data-part="route-number"]')).toBeNull();
  });

  it('leaves both out when the line is not of that form', async () => {
    const other = { ...readData<Index>('index.json'), line: 'trolley' };
    await bootPage({ override: { 'index.json': other } });
    expect(document.getElementById('line-label')!.hidden).toBe(true);
    expect(text(document.getElementById('topbar'))).toBe(C.WORDMARK);
    expect(document.querySelector('[data-part="route-number"]')).toBeNull();
    expect(document.querySelector('.lane-1938')).not.toBeNull();
  });
});

