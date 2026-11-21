// Task 18: accessibility (R13). 18.2: axe-core finds nothing on any state a test
// can reach (R17.1, the picker, each sheet, reduced motion), on both layouts.
// 18.3: every control works from the keyboard alone, and keyboard focus stays
// put while the card is drawn again for each race. 18.4: the race is announced
// once, at the result moment, in the approved words, from the numbers on screen.
// Text contrast is computed from the tokens in tests/unit/contrast.test.ts.
import axe from 'axe-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TIMINGS } from '../../src/config';
import * as A from '../../src/copy/announce';
import * as C from '../../src/copy/copy';
import { rowAt } from '../../src/data/lookup';
import type { RaceResult } from '../../src/data/types';
import { clockOf, label12 } from '../../src/format/time';
import type { App } from '../../src/view/app';
import { ANNOUNCE_DELAY_MS } from '../../src/view/a11y';
import { FIXTURE_DIR } from '../support/fixture';
import { controlName, press, tabOrder, tabTo } from '../support/keyboard';
import { type PageOptions, bootPage } from '../support/page';
import { stylesheets } from '../support/css';
import { raceOf, realData } from '../support/realdata';
import { text, value } from '../support/render';
import { STATES, click, lead, newYork, noRide, query, settle, westToPreston } from '../support/states';
import { type FakeTime, fakeTime } from '../support/time';

const { index } = realData();
const STEP = 16;

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
    // The departures toggle is in the Tab order; it opens and closes the region it controls (Req 11.2).
    expect(at('departures')).toBeGreaterThanOrEqual(0);
    const toggle = (): HTMLElement => document.querySelector<HTMLElement>('[data-action="departures"]')!;
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    const region = document.getElementById(toggle().getAttribute('aria-controls')!)!;
    expect(region).not.toBeNull();
    expect(region.hidden).toBe(true);
    toggle().click();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(region.hidden).toBe(false);
    const numbers = [...document.querySelectorAll<HTMLElement>('#card-scroll button.num')].filter((b) => !b.closest('[hidden]'));
    expect(numbers.length).toBeGreaterThan(5);
    const openOrder = tabOrder().map(controlName);
    for (const b of numbers) expect(openOrder, controlName(b)).toContain(controlName(b));
    toggle().click();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(region.hidden).toBe(true);
    // The map's corner dots are for the pointer; the picker does the same from the keyboard (R4.2).
    expect(order.some((n) => n.startsWith('map-corner'))).toBe(false);
  });

  it('moves the start time with the arrow keys, Home and End; the race stops at once and starts 300 ms after the last key, focus kept', async () => {
    const page = await open();
    page.time.advance(TIMINGS.orientationMs + 500);
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
  { name: 'photo finish (the lead pair at 10:30)', result: 'photo_finish', options: { query: query(lead), now: newYork('10:30') } },
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

// ---- Story layer 19.4: the new parts, axe and the keyboard ------------------------------

const noMap = { loadMap: () => Promise.resolve({ startMap: () => ({ corners: () => undefined, marker: () => undefined, remove: () => undefined }) }), whenIdle: (run: () => void) => run() };

const storyStates: [string, 'phone' | 'desktop', () => Promise<void>][] = [];
for (const layout of ['phone', 'desktop'] as const) {
  storyStates.push(
    [
      'the first visit',
      layout,
      async () => {
        await bootPage({ layout });
      },
    ],
    [
      'racing, with a caption',
      layout,
      async () => {
        const time = fakeTime();
        await bootPage({ layout, time });
        time.advance(TIMINGS.orientationMs + 2000);
        if (text(document.getElementById('race-caption')) === '') throw new Error('no caption');
      },
    ],
    [
      'finished, with the takeaway and the chart',
      layout,
      async () => {
        await bootPage({ layout, motion: 'reduced' });
        await settle();
        if (!document.querySelector('.takeaway') || !document.querySelector('.chart')) throw new Error('not finished');
      },
    ],
    [
      'the today-win notice',
      layout,
      async () => {
        await bootPage({ layout, motion: 'reduced' });
        await settle();
        click('#race-card [data-action="next-today-win"]');
        await settle();
        if (!document.querySelector('.notices')) throw new Error('no notice block');
      },
    ],
    [
      'the open departures section',
      layout,
      async () => {
        await bootPage({ layout, motion: 'reduced' });
        click('[data-action="departures"]');
      },
    ],
  );
}
storyStates.push([
  'the expanded route preview',
  'phone',
  async () => {
    await bootPage({ motion: 'reduced', layout: 'phone', ...noMap });
    await settle();
    click('.route-toggle');
    await settle();
    if (document.querySelector('.route-toggle')?.getAttribute('aria-expanded') !== 'true') throw new Error('route not open');
  },
]);

describe('axe-core finds nothing on the story-layer states (19.4, R15.1)', () => {
  for (const [name, layout, reach] of storyStates) {
    it(`${name} (${layout})`, async () => {
      await reach();
      expect(await violations()).toEqual([]);
    });
  }
});

describe('the story-layer controls by keyboard alone (19.4, R15.2, R15.3)', () => {
  const NEXT = ['next-time', 'next-corners', 'next-today-win'];

  for (const layout of ['phone', 'desktop'] as const) {
    it(`Tab reaches the three next-step actions, the chart readout buttons and the departures toggle (${layout})`, async () => {
      await open({ layout, motion: 'reduced' });
      await settle();
      const order = tabOrder().map(controlName);
      for (const name of NEXT) expect(order, name).toContain(name);
      expect(order).toContain('departures');
      const readout = [...document.querySelectorAll<HTMLElement>('.chart-readout button.num')];
      expect(readout.length).toBeGreaterThan(0);
      for (const b of readout) expect(tabOrder(), controlName(b)).toContain(b);
      // Reading order: the actions, then the chart, then the departures toggle.
      expect(order.indexOf('next-today-win')).toBeLessThan(order.indexOf(controlName(readout[0]!)));
      expect(order.indexOf(controlName(readout.at(-1)!))).toBeLessThan(order.indexOf('departures'));
      for (const name of [...NEXT, 'departures']) {
        tabTo(name);
        expectFocusOn(name);
      }
      for (const b of readout) {
        tabTo(controlName(b));
        expectFocusOn(controlName(b));
      }
    });

    it(`Enter on each next-step action does its work (${layout})`, async () => {
      const page = await open({ layout, motion: 'reduced' });
      await settle();
      tabTo('next-corners');
      press('Enter');
      expect(sheetOpen('corners')).toBe(true);
      press('Escape');
      expect(sheetOpen('corners')).toBe(false);
      tabTo('next-today-win');
      press('Enter');
      await settle();
      page.time.advance(TIMINGS.racePauseMs);
      expect(document.querySelector('.notices')).not.toBeNull();
      expect(document.activeElement!.isConnected).toBe(true);
    });
  }

  it('Tab reaches the route toggle on the phone and Enter opens and closes it', async () => {
    await open({ layout: 'phone', motion: 'reduced', ...noMap });
    await settle();
    expect(tabOrder().map(controlName)).toContain('button:View route');
    const toggle = tabTo('button:View route');
    expect(toggle.classList.contains('route-toggle')).toBe(true);
    press('Enter');
    await settle();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(toggle);
    press('Enter');
    await settle();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('puts no control of the story layer out of the Tab order with a positive or negative tabindex', async () => {
    for (const layout of ['phone', 'desktop'] as const) {
      document.body.innerHTML = '';
      await open({ layout, motion: 'reduced', ...(layout === 'phone' ? noMap : {}) });
      await settle();
      const selector = '[data-action^="next-"], [data-action="departures"], .chart-readout button.num, .route-toggle';
      const controls = [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => !el.hidden);
      expect(controls.length).toBeGreaterThanOrEqual(layout === 'phone' ? 6 : 5);
      for (const el of controls) {
        const tabindex = el.getAttribute('tabindex');
        expect(tabindex === null || Number(tabindex) >= 0, controlName(el)).toBe(true);
        expect(el.matches(':disabled'), controlName(el)).toBe(false);
      }
    }
  });

  it('draws a focus ring on every control: one :focus-visible rule, and no stylesheet turns an outline off a control', () => {
    const sheets = stylesheets();
    const base = sheets.get([...sheets.keys()].find((k) => k.endsWith('base.css'))!)!;
    expect(base).toMatch(/(^|\})\s*:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ink\)/);
    // jsdom has no layout; the rule is the universal one, so it covers a button and the range input alike.
    for (const [file, css] of sheets) {
      for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const [, selector, body] = m;
        if (!/outline\s*:\s*(none|0)\b/.test(body!)) continue;
        // The sheet title takes focus by script, not as a control (it is not in the Tab order).
        expect(selector!.trim(), file).toBe('.sheet-title:focus');
      }
    }
  });
});

describe('the announcement and the caption area (19.4, R15.4)', () => {
  const LIVE = '[aria-live], [role="status"], [role="alert"], [role="log"]';

  it('keeps the caption area, its status lines and the chart readout out of every live region', async () => {
    const time = fakeTime();
    await open({ time });
    const check = (): void => {
      for (const el of document.querySelectorAll('#race-caption, .caption, .status, .chart-readout, .clock-readout, .takeaway')) {
        expect(el.closest(LIVE), `${el.className} is inside a live region`).toBeNull();
        expect(el.querySelector(LIVE), `${el.className} holds a live region`).toBeNull();
        expect(el.getAttribute('aria-live')).toBeNull();
        expect(el.getAttribute('role') ?? '').not.toMatch(/status|alert|log/);
      }
    };
    check();
    const captions = new Set<string>();
    for (let t = 0; t < 14000; t += STEP) {
      time.advance(STEP);
      captions.add(text(document.getElementById('race-caption')));
      if (t % 800 === 0) check();
    }
    check();
    // The caption changed through the race, and nothing of it reached the announcer.
    expect([...captions].filter(Boolean).length).toBeGreaterThan(1);
    expect(said()).not.toContain(text(document.getElementById('race-caption')));
  });

  it('writes the result once per race while the caption changes; the live regions are the two status lines only', async () => {
    const page = await open();
    const regions = [...document.querySelectorAll(LIVE)].filter((el) => el.closest('.sheet') === null);
    expect(regions.map((el) => el.id || el.className).sort()).toEqual(['result-status', 'share-status']);
    const heard = listen(page, 14000);
    expect(writes(heard)).toHaveLength(1);
    expect(page.app.store.get().race.phase).toBe('finished');
    const finalSaid = said();
    // Using the finished card (the next-step actions, the departures section) does not speak the result again.
    click('[data-action="departures"]');
    click('[data-action="next-today-win"]');
    await settle();
    expect(said()).toBe(finalSaid);
  });
});
