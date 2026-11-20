// Task 18: accessibility (R13). 18.2: axe-core finds nothing on any state a test
// can reach (R17.1, the picker, each sheet, reduced motion), on both layouts.
// 18.3: every control works from the keyboard alone, and keyboard focus stays
// put while the card is drawn again for each race. 18.4: the race is announced
// once, at the result moment, in the approved words, from the numbers on screen.
// Text contrast is computed from the tokens in tests/unit/contrast.test.ts.
import axe from 'axe-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LEAD_PAIR, TIMINGS } from '../../src/config';
import * as A from '../../src/copy/announce';
import * as C from '../../src/copy/copy';
import { rowAt } from '../../src/data/lookup';
import type { Pair, RaceResult } from '../../src/data/types';
import { clockOf, label12 } from '../../src/format/time';
import type { App } from '../../src/view/app';
import { ANNOUNCE_DELAY_MS } from '../../src/view/a11y';
import type { Layout } from '../../src/view/vehicles';
import { FIXTURE_DIR, fixtureData } from '../support/fixture';
import { controlName, press, tabOrder, tabTo } from '../support/keyboard';
import { type PageOptions, bootPage, mountPage } from '../support/page';
import { raceOf, realData, slugNamed } from '../support/realdata';
import { text, value } from '../support/render';
import { type FakeTime, fakeTime } from '../support/time';

const { index } = realData();
const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
const westToPreston: Pair = { origin: slugNamed('Westwood & Carey'), dest: slugNamed('Preston & Caroline') };
const inferredPair: Pair = { origin: index.corners.find((c) => c.inferred)!.slug, dest: slugNamed('Aliceanna & Bond') };
const fixture = fixtureData();
const noRide = fixture.index.pairs.find((p) => fixture.races.get(`${p.origin}__${p.dest}`)!.today.trips.length === 0)!;
const newYork = (hhmm: string): Date => new Date(`${index.service_date}T${hhmm}:00-05:00`);
const query = (p: Pair): string => `?from=${p.origin}&to=${p.dest}`;
const STEP = 16;

/** Let the loader's promises settle. */
async function settle(): Promise<void> {
  for (let k = 0; k < 5; k += 1) await new Promise((done) => setTimeout(done, 0));
}

beforeAll(() => {
  // jsdom has no canvas; axe asks for one to measure icon fonts and copes without it. Say so quietly.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.documentElement.className = '';
  window.history.replaceState(null, '', '/');
});

// ---- 18.2: axe-core on every reachable state ----------------------------------------

/**
 * Every axe rule except colour contrast, which needs a drawn page: jsdom draws
 * nothing. Contrast is computed from the tokens (contrast.test.ts) and checked
 * by axe in the browser (task 20.3).
 */
async function violations(): Promise<string[]> {
  const result = await axe.run(document, { resultTypes: ['violations'], rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
}

const click = (selector: string): void => document.querySelector<HTMLElement>(selector)!.click();

type Reach = (layout: Layout) => Promise<void>;

/** Each state of R17.1, the picker in both steps, each sheet, and reduced motion. */
const STATES: [string, Reach][] = [
  [
    'loading',
    async (layout) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      void mountPage({ layout, hang: new Set(['summary.json']) }).boot();
      await vi.advanceTimersByTimeAsync(0);
      expect(document.getElementById('loading-line')).not.toBeNull();
      // The page stays loading (its 3 s limit is on the fake clock, which stops here); axe needs real timers.
      vi.useRealTimers();
    },
  ],
  ['ready, before the first race starts', async (layout) => void (await bootPage({ layout }))],
  [
    'racing',
    async (layout) => {
      const time = fakeTime();
      await bootPage({ layout, time });
      time.advance(TIMINGS.racePauseMs + 2000);
      expect(document.querySelector('.clock-row')).not.toBeNull();
    },
  ],
  ['1938 wins, reduced motion', async (layout) => void (await bootPage({ layout, motion: 'reduced' }))],
  ['today wins', async (layout) => void (await bootPage({ layout, motion: 'reduced', query: query(westToPreston), now: newYork('11:23') }))],
  ['photo finish', async (layout) => void (await bootPage({ layout, motion: 'reduced', now: newYork('10:30') }))],
  ['before the midday table', async (layout) => void (await bootPage({ layout, motion: 'reduced', now: newYork(raceOf(lead).races[0]!.t) }))],
  ['the inferred corner', async (layout) => void (await bootPage({ layout, motion: 'reduced', query: query(inferredPair) }))],
  [
    'no one-seat ride (the made-up fixture line)',
    async (layout) => void (await bootPage({ layout, motion: 'reduced', folder: FIXTURE_DIR, query: query(noRide), leadPair: noRide })),
  ],
  [
    'a shared link, with its banner',
    async (layout) => {
      await bootPage({ layout, motion: 'reduced', query: query(lead) });
      expect(document.querySelector('#banner-root .banner')).not.toBeNull();
    },
  ],
  [
    'a bad link, with its banner',
    async (layout) => {
      await bootPage({ layout, motion: 'reduced', query: `?from=nowhere&to=${lead.dest}` });
      expect(document.querySelector('#banner-root .banner')).not.toBeNull();
    },
  ],
  ['the data error', async (layout) => void (await bootPage({ layout, fail: new Set(['summary.json']) }))],
  [
    'the map unavailable, with no route drawing',
    async (layout) => {
      await bootPage({ layout, motion: 'reduced', fail: new Set(['route.geojson']) });
      await settle();
      expect(text(document.querySelector('.map-notice'))).toBe(C.MAP_UNAVAILABLE_NO_DRAWING);
    },
  ],
  [
    'the map unavailable, with the route drawing',
    async (layout) => {
      const app = await bootPage({ layout, motion: 'reduced' });
      await settle();
      app.store.dispatch({ type: 'map/status', status: 'unavailable' });
      expect(document.querySelector('.route-drawing')).not.toBeNull();
    },
  ],
  [
    'the corner picker, first step',
    async (layout) => {
      await bootPage({ layout, motion: 'reduced' });
      click('[data-action="picker"]');
      expect(document.querySelector('.sheet[data-sheet="corners"]')).not.toBeNull();
    },
  ],
  [
    'the corner picker, second step',
    async (layout) => {
      await bootPage({ layout, motion: 'reduced' });
      click('[data-action="picker"]');
      click(`.corner-choice[data-slug="${lead.origin}"]`);
      expect(document.querySelector('.corner-choice[disabled]')).not.toBeNull();
    },
  ],
  [
    'the Sources sheet at a number',
    async (layout) => {
      await bootPage({ layout, motion: 'reduced' });
      click('#card-scroll button.num[data-source="wait-1938"]');
      expect(document.querySelector('.sheet .source-row.is-target')).not.toBeNull();
    },
  ],
  [
    'About and credits',
    async (layout) => {
      await bootPage({ layout, motion: 'reduced' });
      click('#app > button.info');
      expect(document.querySelector('.sheet[data-sheet="about"]')).not.toBeNull();
    },
  ],
  [
    'When today wins',
    async (layout) => {
      await bootPage({ layout, motion: 'reduced' });
      click('[data-action="whentoday"]');
      expect(document.querySelector('.sheet[data-sheet="whentoday"]')).not.toBeNull();
    },
  ],
];

describe('axe-core finds nothing on any state (18.2, R13.4)', () => {
  for (const layout of ['phone', 'desktop'] as const) {
    for (const [name, reach] of STATES) {
      it(`${name} (${layout})`, async () => {
        await reach(layout);
        expect(await violations()).toEqual([]);
      });
    }
  }

  it('would report a control with no name', async () => {
    await bootPage({ motion: 'reduced' });
    // The button over the pair names has no text of its own: its label is its only name.
    document.querySelector('[data-action="picker"]')!.removeAttribute('aria-label');
    expect((await violations()).some((v) => v.startsWith('button-name'))).toBe(true);
  });
});

// ---- 18.3: the keyboard alone ---------------------------------------------------------

type Page = { app: App; time: FakeTime };

async function open(options: PageOptions = {}): Promise<Page> {
  const time = options.time ?? fakeTime();
  const app = await bootPage({ ...options, time });
  return { app, time };
}

const focused = (): string => controlName(document.activeElement);
const sheetOpen = (name: string): boolean => document.querySelector(`.sheet.is-open[data-sheet="${name}"]`) !== null;

/** Focus is on a control on the page (not lost to the body with a removed element). */
function expectFocusOn(name: string): void {
  expect(focused()).toBe(name);
  expect(document.activeElement!.isConnected).toBe(true);
}

describe('every control by keyboard alone (18.3, R13.1)', () => {
  it('reaches every control of the card with Tab, in reading order, with no trap', async () => {
    await open();
    const order = tabOrder().map(controlName);
    const before = [...order];
    const seen: string[] = [];
    for (let k = 0; k < order.length; k += 1) {
      press('Tab');
      seen.push(focused());
    }
    expect(seen).toEqual(order);
    // A full round comes back to the start.
    press('Tab');
    expect(focused()).toBe(order[0]);
    expect(tabOrder().map(controlName)).toEqual(before);
    const at = (name: string): number => order.indexOf(name);
    for (const name of ['picker', 'swap', 'minus', '#start-time', 'plus', 'skip', 'sources', 'share', 'about']) expect(at(name), name).toBeGreaterThanOrEqual(0);
    expect(at('picker')).toBeLessThan(at('swap'));
    expect(at('swap')).toBeLessThan(at('minus'));
    expect(at('minus')).toBeLessThan(at('#start-time'));
    expect(at('#start-time')).toBeLessThan(at('plus'));
    expect(at('plus')).toBeLessThan(at('skip'));
    expect(at('skip')).toBeLessThan(at('sources'));
    expect(at('sources')).toBeLessThan(at('share'));
    // Every number on the card is a stop of its own (the legends wait, hidden, for each lane's arrival).
    const numbers = [...document.querySelectorAll<HTMLElement>('#card-scroll button.num')].filter((b) => !b.closest('[hidden]'));
    expect(numbers.length).toBeGreaterThan(5);
    for (const b of numbers) expect(order, controlName(b)).toContain(controlName(b));
    // The map's corner dots are for the pointer; the picker does the same from the keyboard (R4.2).
    expect(order.some((n) => n.startsWith('map-corner'))).toBe(false);
  });

  it('moves the start time with the arrow keys, Home and End; the race stops at once and starts 300 ms after the last key, focus kept', async () => {
    const page = await open();
    page.time.advance(TIMINGS.racePauseMs + 500);
    expect(page.app.store.get().race.phase).toBe('running');
    tabTo('#start-time');
    const start = page.app.store.get().minute!;
    press('ArrowRight');
    expect(page.app.store.get().minute).toBe(start + 1);
    expect(page.app.store.get().race.phase).toBe('idle');
    expect(text(document.querySelector('.slider-time'))).toBe(label12(clockOf(start + 1)));
    page.time.advance(TIMINGS.racePauseMs - 1);
    press('ArrowRight');
    page.time.advance(TIMINGS.racePauseMs - 1);
    expect(page.app.store.get().race.phase).toBe('idle');
    page.time.advance(1);
    expect(page.app.store.get().race.phase).toBe('running');
    expect(page.app.store.get().minute).toBe(start + 2);
    // The card was drawn again for the new race; the keyboard is still on the slider.
    expectFocusOn('#start-time');
    expect(document.querySelector<HTMLInputElement>('#start-time')!.value).toBe(String(start + 2));
    press('ArrowLeft');
    expect(page.app.store.get().minute).toBe(start + 1);
    const race = raceOf(lead);
    press('Home');
    page.time.advance(TIMINGS.racePauseMs);
    expect(clockOf(page.app.store.get().minute!)).toBe(race.races[0]!.t);
    expectFocusOn('#start-time');
    press('End');
    page.time.advance(TIMINGS.racePauseMs);
    expect(clockOf(page.app.store.get().minute!)).toBe(race.races.at(-1)!.t);
    expectFocusOn('#start-time');
  });

  it('steps the time with minus and plus by Enter and Space, focus kept across the new race', async () => {
    const page = await open();
    const start = page.app.store.get().minute!;
    tabTo('plus');
    press('Enter');
    expect(page.app.store.get().minute).toBe(start + 1);
    page.time.advance(TIMINGS.racePauseMs);
    expect(page.app.store.get().race.phase).toBe('running');
    expectFocusOn('plus');
    tabTo('minus', { shift: true });
    press(' ');
    page.time.advance(TIMINGS.racePauseMs);
    expect(page.app.store.get().minute).toBe(start);
    expectFocusOn('minus');
  });

  it('swaps the direction by keyboard; focus stays on the swap button once the other race is drawn', async () => {
    const page = await open();
    tabTo('swap');
    press('Enter');
    await settle();
    page.time.advance(TIMINGS.racePauseMs);
    expect(page.app.store.get().pair).toEqual({ origin: lead.dest, dest: lead.origin });
    expect(text(document.getElementById('origin-name'))).toBe(index.corners.find((c) => c.slug === lead.dest)!.name);
    expectFocusOn('swap');
  });

  it('picks a pair in the corner picker by keyboard: focus in the sheet, kept there, and back on the pair names after', async () => {
    const page = await open();
    tabTo('picker');
    press('Enter');
    expect(sheetOpen('corners')).toBe(true);
    expect(document.activeElement?.id).toBe('sheet-title');
    // Tab stays inside the open sheet, both ways round.
    const inSheet = (): boolean => document.querySelector('.sheet.is-open')!.contains(document.activeElement);
    for (let k = 0; k < 8; k += 1) {
      press('Tab');
      expect(inSheet()).toBe(true);
    }
    for (let k = 0; k < 8; k += 1) {
      press('Tab', { shift: true });
      expect(inSheet()).toBe(true);
    }
    tabTo(`pick:${westToPreston.origin}`);
    press('Enter');
    // Step two: focus on the first corner that can be chosen; the start cannot be chosen again.
    expect(text(document.querySelector('.picker-step'))).toBe(C.PICKER_STEP_END);
    expect(document.activeElement?.matches('.corner-choice:not([disabled])')).toBe(true);
    expect(tabOrder().map(controlName)).not.toContain(`pick:${westToPreston.origin}`);
    tabTo(`pick:${westToPreston.dest}`);
    press('Enter');
    expect(page.app.store.get().pair).toEqual(westToPreston);
    expect(sheetOpen('corners')).toBe(false);
    await settle();
    page.time.advance(TIMINGS.racePauseMs);
    expect(text(document.getElementById('dest-name'))).toBe(index.corners.find((c) => c.slug === westToPreston.dest)!.name);
    expectFocusOn('picker');
  });

  it('closes the picker with Escape and leaves the pair as it was', async () => {
    const page = await open();
    tabTo('picker');
    press('Enter');
    tabTo(`pick:${westToPreston.origin}`);
    press('Enter');
    press('Escape');
    expect(sheetOpen('corners')).toBe(false);
    expect(page.app.store.get().pair).toEqual(lead);
    expectFocusOn('picker');
  });

  it('opens a number\'s Sources row by keyboard; Escape closes it and focus returns to the number', async () => {
    await open();
    tabTo('num:next-1938');
    press('Enter');
    expect(sheetOpen('sources')).toBe(true);
    expect(document.querySelector('.sheet .source-row.is-target')?.getAttribute('data-source')).toBe('next-1938');
    press('Escape');
    expect(sheetOpen('sources')).toBe(false);
    expectFocusOn('num:next-1938');
    // The last row of the sheet opens the credits, by keyboard too.
    tabTo('sources');
    press('Enter');
    tabTo('credits');
    press('Enter');
    expect(sheetOpen('about')).toBe(true);
    press('Escape');
    expectFocusOn('sources');
  });

  it('skips to the result by keyboard, and focus goes to the result', async () => {
    const page = await open();
    page.time.advance(TIMINGS.racePauseMs + 500);
    tabTo('skip');
    press('Enter');
    expect(page.app.store.get().race.phase).toBe('finished');
    expect(document.querySelector('.skip')).toBeNull();
    expect(document.activeElement?.closest('.result')).not.toBeNull();
    expect(document.activeElement?.matches('button.num')).toBe(true);
  });

  it('keeps focus on the card when a lane\'s status line gives way to its legend, and at the finish', async () => {
    const page = await open();
    page.time.advance(TIMINGS.racePauseMs + 200);
    tabTo('num:next-1938');
    for (let k = 0; k < 1000 && page.app.store.get().race.phase !== 'finished'; k += 1) {
      page.time.advance(STEP);
      const active = document.activeElement as HTMLElement;
      expect(active.isConnected && active.closest('#race-card') !== null && active.closest('[hidden]') === null, `${page.time.current()} ms: ${focused()}`).toBe(
        true,
      );
    }
    expect(page.app.store.get().race.phase).toBe('finished');
  });

  it('shares the race by keyboard: the link is copied and both the button and its status say so', async () => {
    const copied: string[] = [];
    await open({ share: { writeText: async (url) => void copied.push(url) } });
    tabTo('share');
    press('Enter');
    await settle();
    expect(copied).toEqual([`${window.location.origin}${window.location.pathname}${query(lead)}`]);
    expect(text(document.activeElement)).toBe(C.LINK_COPIED);
    expect(text(document.getElementById('share-status'))).toBe(C.LINK_COPIED);
  });

  it('opens About and credits from the info button, and on desktop from the footer; Escape returns focus to each', async () => {
    await open();
    tabTo('about');
    press('Enter');
    expect(sheetOpen('about')).toBe(true);
    press('Escape');
    expectFocusOn('about');
    document.body.innerHTML = '';
    await open({ layout: 'desktop' });
    tabTo('about@footer');
    press('Enter');
    expect(sheetOpen('about')).toBe(true);
    press('Escape');
    expectFocusOn('about@footer');
  });

  it('opens When today wins by keyboard, and an entry races that pair at that time', async () => {
    // The honest line and its link arrive with the result; reduced motion shows them at once.
    const page = await open({ motion: 'reduced' });
    tabTo('whentoday');
    press('Enter');
    expect(sheetOpen('whentoday')).toBe(true);
    const win = realData().summary.today_wins[0]!;
    tabTo('today-win:0');
    press('Enter');
    await settle();
    page.time.advance(TIMINGS.racePauseMs);
    expect(page.app.store.get().pair).toEqual({ origin: win.origin, dest: win.dest });
    expect(clockOf(page.app.store.get().minute!)).toBe(win.t);
    expect(sheetOpen('whentoday')).toBe(false);
    expectFocusOn('whentoday');
  });

  it('recovers from the data error with Try again by keyboard', async () => {
    const fail = new Set(['summary.json']);
    const page = await open({ fail });
    expect(page.app.store.get().data.status).toBe('error');
    fail.delete('summary.json');
    tabTo('retry');
    press('Enter');
    await settle();
    expect(page.app.store.get().data.status).toBe('ready');
  });
});

// ---- 18.4: the announcement -------------------------------------------------------------

const said = (): string => text(document.getElementById('result-status'));

type Case = { name: string; result: RaceResult; options: PageOptions };

const CASES: Case[] = [
  { name: '1938 wins (the lead pair at 10:00)', result: '1938', options: {} },
  { name: 'today wins (Westwood & Carey to Preston & Caroline at 11:23)', result: 'today', options: { query: query(westToPreston), now: newYork('11:23') } },
  { name: 'photo finish (the lead pair at 10:30)', result: 'photo_finish', options: { now: newYork('10:30') } },
  {
    name: 'no one-seat ride (the made-up fixture line)',
    result: 'no_one_seat_ride',
    options: { folder: FIXTURE_DIR, query: query(noRide), leadPair: noRide },
  },
];

/** The row on screen, from the data the page loaded. */
function rowOn(app: App) {
  const state = app.store.get();
  if (state.data.status !== 'ready' || state.minute === null) throw new Error('no data');
  const race = state.data.races.get(`${state.pair.origin}__${state.pair.dest}`)!;
  return rowAt(race, clockOf(state.minute))!;
}

/** The approved words for the race on screen, filled from the numbers the screen shows (R13.2, R7.5). */
function expectedWords(app: App): string {
  const shown = (id: string): number => value(document.querySelector(`#card-scroll button.num[data-source="${id}"]`)!);
  const race = {
    origin: text(document.getElementById('origin-name')),
    dest: text(document.getElementById('dest-name')),
    time: label12(rowOn(app).start),
    trolley: shown('total-1938'),
  };
  const result = rowOn(app).result;
  if (result === 'no_one_seat_ride') return A.announceNoOneSeatRide(race);
  // The walking total is the sum of the shown walk parts.
  const walk = [...document.querySelectorAll('.lane-today .legend-item[data-phase^="walk"] button.num')].map(value).reduce((a, b) => a + b, 0);
  const bus = { ...race, bus: shown('total-today'), walk };
  if (result === 'photo_finish') return A.announcePhotoFinish(bus);
  const margin = shown('margin');
  return result === '1938' ? A.announce1938Wins({ ...bus, margin }) : A.announceTodayWins({ ...bus, margin });
}

type Heard = { ms: number; said: string; result: boolean; arrived: number };

function listen(page: Page, ms: number): Heard[] {
  const out: Heard[] = [];
  for (let t = 0; t <= ms; t += STEP) {
    out.push({
      ms: page.time.current(),
      said: said(),
      result: document.querySelector('.result') !== null,
      arrived: document.querySelectorAll('.lane[data-arrived]').length,
    });
    page.time.advance(STEP);
  }
  return out;
}

/** The moments the region went from silent to speaking. */
const writes = (heard: Heard[]): Heard[] => heard.filter((h, k) => h.said !== '' && heard[k - 1]?.said === '');

describe('the race announcement (18.4, R13.2)', () => {
  for (const c of CASES) {
    it(`${c.name}: one write, at the result moment, in the approved words from the shown numbers; silent before`, async () => {
      const page = await open(c.options);
      expect(rowOn(page.app).result).toBe(c.result);
      const heard = listen(page, 14000);
      expect(page.app.store.get().race.phase).toBe('finished');
      const result = heard.find((h) => h.result)!;
      expect(result).toBeDefined();
      // The result moment: the first arrival for a win; both sides in for a photo finish.
      const lanes = document.querySelectorAll('.lane').length;
      if (c.result === 'photo_finish') expect(result.arrived).toBe(lanes);
      else expect(result.arrived).toBe(1);
      const once = writes(heard);
      expect(once).toHaveLength(1);
      expect(once[0]!.ms - result.ms).toBeGreaterThanOrEqual(ANNOUNCE_DELAY_MS);
      expect(once[0]!.ms - result.ms).toBeLessThanOrEqual(ANNOUNCE_DELAY_MS + 2 * STEP);
      // Nothing is said during the animation before it, and nothing changes after it.
      expect(heard.filter((h) => h.ms < once[0]!.ms).every((h) => h.said === '')).toBe(true);
      expect(new Set(heard.filter((h) => h.ms >= once[0]!.ms).map((h) => h.said)).size).toBe(1);
      expect(said()).toBe(expectedWords(page.app));
    });

    it(`${c.name}, reduced motion: spoken once per race, in the same words`, async () => {
      const page = await open({ ...c.options, motion: 'reduced' });
      const first = listen(page, 500);
      expect(writes(first)).toHaveLength(1);
      expect(said()).toBe(expectedWords(page.app));
      // A new minute is a new race: the region is cleared and written once more.
      click('[data-action="plus"]');
      const second = listen(page, 1000);
      expect(writes(second)).toHaveLength(1);
      expect(said()).toBe(expectedWords(page.app));
    });
  }
});
