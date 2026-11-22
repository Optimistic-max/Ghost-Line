// Task 12.2: the three next-step actions (story-layer Req 10.1 to 10.8, 16.10) pressed as real buttons.
// Order, keyboard reach, 44 px targets (jsdom has no layout, so the stylesheet rule is read), focus on the
// slider, the picker opening, and each action ending the Guided_Parts. The made-up summary checks that
// the order and the notice follow the file (Req 16.6). Expected pairs and times are read from the files.
import { afterEach, describe, expect, it } from 'vitest';
import { LEAD_PAIR, TIMINGS } from '../../src/config';
import * as C from '../../src/copy/copy';
import { cornerName } from '../../src/data/lookup';
import type { Pair } from '../../src/data/types';
import { encode } from '../../src/format/share';
import { label12, minutesOf } from '../../src/format/time';
import { stylesheets } from '../support/css';
import { FIXTURE_DIR, fixtureData } from '../support/fixture';
import { controlName, press, tabTo } from '../support/keyboard';
import { type PageOptions, bootPage } from '../support/page';
import { realData } from '../support/realdata';
import { text } from '../support/render';
import { type FakeTime, fakeTime } from '../support/time';

const real = realData();
const fake = fixtureData();
const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };

const ACTIONS = ['next-time', 'next-corners', 'next-today-win'] as const;
const SECONDARY = ['sources', 'share'] as const;
const button = (action: string): HTMLButtonElement => document.querySelector<HTMLButtonElement>(`#race-card [data-action="${action}"]`)!;
const settle = async (): Promise<void> => {
  for (let k = 0; k < 5; k += 1) await new Promise((done) => setTimeout(done, 0));
};

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
  window.history.replaceState(null, '', '/');
});

async function open(options: PageOptions = {}) {
  const time: FakeTime = options.time ?? fakeTime();
  const app = await bootPage({ motion: 'reduced', ...options, time });
  time.advance(TIMINGS.racePauseMs);
  await settle();
  return { app, time };
}

const guidedPartsShown = (): boolean =>
  document.querySelector('.example-label') !== null ||
  document.querySelector('.chart-prompt') !== null ||
  text(document.getElementById('race-caption')) === C.ORIENTATION_LINE;

/** The declarations of every rule whose selector list names `selector` exactly. */
function declarations(selector: string): string[] {
  const out: string[] = [];
  for (const css of stylesheets().values()) {
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (m[1]!.split(',').some((s) => s.trim() === selector)) out.push(m[2]!);
    }
  }
  return out;
}

/** The largest px value of `property` over the rules for `selector`. */
function pxOf(selector: string, property: string): number {
  const values = declarations(selector).flatMap((d) => [...d.matchAll(new RegExp(`(?:^|[;\\s])${property}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`, 'g'))].map((m) => Number(m[1])));
  return values.length === 0 ? 0 : Math.max(...values);
}

describe('order and place (Req 10.1, 10.7)', () => {
  it('shows the three actions in the order of the labels, then Sources and Share this race', async () => {
    await open();
    const all = [...ACTIONS, ...SECONDARY].map(button);
    all.forEach((b) => expect(b, 'every button exists').not.toBeNull());
    for (let k = 1; k < all.length; k += 1) {
      expect(all[k - 1]!.compareDocumentPosition(all[k]!) & Node.DOCUMENT_POSITION_FOLLOWING, `${k - 1} before ${k}`).toBeTruthy();
    }
    expect(ACTIONS.map((a) => text(button(a)))).toEqual([C.NEXT_TRY_TIME, C.NEXT_TRY_CORNERS, C.NEXT_SHOW_TODAY_WIN]);
    expect(SECONDARY.map((a) => button(a).classList.contains('button-outline'))).toEqual([true, true]);
    expect(ACTIONS.map((a) => button(a).classList.contains('button-outline'))).toEqual([false, false, false]);
    expect(document.querySelectorAll('.next-steps')).toHaveLength(1);
  });

  it('puts the three actions after the result, on both layouts', async () => {
    for (const layout of ['phone', 'desktop'] as const) {
      await open({ layout });
      const result = document.querySelector('.result')!;
      expect(result.compareDocumentPosition(button('next-time')) & Node.DOCUMENT_POSITION_FOLLOWING, layout).toBeTruthy();
      document.body.innerHTML = '';
    }
  });
});

describe('keyboard reach (Req 10.8)', () => {
  it('Tab reaches the three actions, then Sources and Share this race, in that order', async () => {
    await open();
    const seen: string[] = [];
    for (const name of [...ACTIONS, ...SECONDARY]) seen.push(controlName(tabTo(name)));
    expect(seen).toEqual([...ACTIONS, ...SECONDARY]);
  });

  it('Enter on each focused action presses it', async () => {
    const { app } = await open();
    tabTo('next-time');
    press('Enter');
    expect(document.activeElement?.id).toBe('start-time');
    tabTo('next-corners');
    press('Enter');
    expect(app.store.get().picker).toEqual({ step: 'start' });
  });
});

describe('44 px targets (Req 10.8)', () => {
  it('the stylesheet gives every action and secondary button a min-height and min-width of at least 44 px', () => {
    expect(pxOf('.next-step', 'min-height')).toBeGreaterThanOrEqual(44);
    expect(pxOf('.next-step', 'min-width')).toBeGreaterThanOrEqual(44);
    expect(pxOf('.button', 'min-height')).toBeGreaterThanOrEqual(44);
  });

  it('every action and secondary button carries the classes those rules select', async () => {
    await open();
    for (const a of ACTIONS) expect(button(a).classList.contains('next-step'), a).toBe(true);
    for (const a of [...ACTIONS, ...SECONDARY]) expect(button(a).classList.contains('button'), a).toBe(true);
  });
});

describe('each action ends the Guided_Parts (Req 10.2, 10.3, 10.4, 16.10)', () => {
  it('"Try another time" moves focus to the slider and scrolls it into view', async () => {
    const { app } = await open();
    expect(app.store.get().guided).toBe(true);
    expect(guidedPartsShown()).toBe(true);
    const slider = document.getElementById('start-time') as HTMLElement;
    let scrolled = 0;
    slider.scrollIntoView = () => {
      scrolled += 1;
    };
    button('next-time').click();
    expect(document.activeElement).toBe(slider);
    expect(scrolled).toBe(1);
    expect(app.store.get().guided).toBe(false);
    expect(guidedPartsShown()).toBe(false);
  });

  it('"Try another time" starts no race, even during the guided pause, and highlights the slider briefly (task 25.1)', async () => {
    const time = fakeTime();
    const app = await bootPage({ motion: 'full', time });
    await settle();
    expect(app.store.get().race.phase).toBe('idle');
    button('next-time').click();
    const track = document.querySelector('.slider-track')!;
    expect(track.classList.contains('is-flash')).toBe(true);
    time.advance(TIMINGS.orientationMs + TIMINGS.racePauseMs);
    await settle();
    expect(app.store.get().race.phase).toBe('idle');
    expect(document.activeElement?.id).toBe('start-time');
    expect(track.classList.contains('is-flash')).toBe(false);
  });

  it('"Try another time" gives no highlight under reduced motion (task 25.1)', async () => {
    await open();
    button('next-time').click();
    expect(document.querySelector('.slider-track.is-flash')).toBeNull();
    expect(document.activeElement?.id).toBe('start-time');
  });

  it('"Replay this race" shows after the finish and plays the same pair and start again (task 25.3)', async () => {
    const time = fakeTime();
    const app = await bootPage({ motion: 'full', time });
    time.advance(TIMINGS.orientationMs);
    await settle();
    const row = (): Element => document.querySelector('.replay-row')!;
    const before = { pair: app.store.get().pair, minute: app.store.get().minute };
    // Reserved from the start, but not shown (and not in the tab order) while racing.
    expect(app.store.get().race.phase).toBe('running');
    expect(row().hasAttribute('data-ready')).toBe(false);
    (document.querySelector('[data-action="skip"]') as HTMLElement).click();
    await settle();
    expect(app.store.get().race.phase).toBe('finished');
    expect(row().hasAttribute('data-ready')).toBe(true);
    expect(text(button('replay'))).toBe(C.REPLAY_RACE);
    button('replay').click();
    expect(app.store.get().race.phase).toBe('idle');
    time.advance(TIMINGS.racePauseMs);
    await settle();
    expect(app.store.get().race.phase).toBe('running');
    expect({ pair: app.store.get().pair, minute: app.store.get().minute }).toEqual(before);
    expect(row().hasAttribute('data-ready')).toBe(false);
  });

  it('offers no replay under reduced motion, where every race is drawn finished (task 25.3)', async () => {
    await open();
    expect(document.documentElement.classList.contains('motion-reduced')).toBe(true);
    expect(declarations('.motion-reduced .replay-row').some((d) => /display\s*:\s*none/.test(d))).toBe(true);
  });

  it('"Try other corners" opens the corner picker', async () => {
    const { app } = await open();
    expect(guidedPartsShown()).toBe(true);
    button('next-corners').click();
    expect(app.store.get().picker).toEqual({ step: 'start' });
    expect(document.querySelector('.sheet:not([aria-hidden]) .corner-choice')).not.toBeNull();
    expect(app.store.get().guided).toBe(false);
    expect(guidedPartsShown()).toBe(false);
  });

  it('"Show a race today wins" shows the first listed entry and the Guided_Parts stay gone', async () => {
    const { app } = await open();
    const entry = real.summary.today_wins[0]!;
    expect(guidedPartsShown()).toBe(true);
    button('next-today-win').click();
    expect(app.store.get().guided).toBe(false);
    expect(guidedPartsShown()).toBe(false);
    expect(app.store.get().pair).toEqual({ origin: entry.origin, dest: entry.dest });
    await settle();
    expect(guidedPartsShown()).toBe(false);
  });
});

describe('the made-up summary: the order and the notice follow the file (Req 16.6)', () => {
  it('walks the whole list in file order, then wraps to the first; each press shows that entry\'s notice', async () => {
    const pair = fake.index.pairs[0]!;
    const list = fake.summary.today_wins;
    expect(list.length).toBeGreaterThan(1);
    const { app } = await open({ folder: FIXTURE_DIR, query: `?from=${pair.origin}&to=${pair.dest}`, leadPair: pair });
    for (let k = 0; k <= list.length; k += 1) {
      const entry = list[k % list.length]!;
      button('next-today-win').click();
      const state = app.store.get();
      expect(state.todayWinNotice, `press ${k + 1}`).toEqual(entry);
      expect(state.pair).toEqual({ origin: entry.origin, dest: entry.dest });
      expect(state.minute).toBe(minutesOf(entry.t));
      expect(window.location.search).toBe(encode({ origin: entry.origin, dest: entry.dest }));
      await settle();
      const notice = document.querySelector('.notice[data-notice="today-win"]');
      expect(text(notice)).toBe(C.todayWinNotice(cornerName(fake.index, entry.origin)!, cornerName(fake.index, entry.dest)!, label12(entry.t)));
    }
    // Task 25.11: each press redraws the whole card for a new pair; about 15 s on a quiet machine, so the dom
    // project's 30 s ran out under load. Every press and check is kept; the time allowed is 90 s.
  }, 90_000);

  it('a later change of the start time removes the notice', async () => {
    const pair = fake.index.pairs[0]!;
    const { app } = await open({ folder: FIXTURE_DIR, query: `?from=${pair.origin}&to=${pair.dest}`, leadPair: pair });
    button('next-today-win').click();
    await settle();
    expect(document.querySelector('[data-notice="today-win"]')).not.toBeNull();
    button('plus').click();
    expect(app.store.get().todayWinNotice).toBeNull();
  });
});

describe('real data sanity', () => {
  it('the lead pair opens guided with the real summary listing at least one entry', async () => {
    const { app } = await open();
    expect(app.store.get().pair).toEqual(lead);
    expect(real.summary.today_wins.length).toBeGreaterThan(0);
  });
});
