// Task 10.3: the start-time chart on the page (story-layer Req 9.2 to 9.5, 9.7 to 9.9, 16.8, 16.9).
// Expected values are worked out here from the stored totals of the race file: the chart's path is read
// back into minutes, the hatch from `before_table`, the cursor from the row's position, and the readout
// from a rounding written out in this file. Nothing is computed by calling the chart code.
import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEAD_PAIR, TIMINGS } from '../../src/config';
import * as C from '../../src/copy/copy';
import { INDEX_FILE, pairKey, raceFileName } from '../../src/data/files';
import { createLoader } from '../../src/data/load';
import type { Pair, RaceFile, RaceRow } from '../../src/data/types';
import { clockOf, label12 } from '../../src/format/time';
import { type App, createApp } from '../../src/view/app';
import { chartView, updateChart } from '../../src/view/chart';
import { CHART_HEIGHT } from '../../src/view/layout';
import { SourceRegistry } from '../../src/view/numbers';
import { FIXTURE_DIR, fixtureData } from '../support/fixture';
import { readRepoText } from '../support/files';
import { folderFetch } from '../support/page';
import { realData } from '../support/realdata';
import { num, text, value } from '../support/render';
import { type FakeTime, fakeTime } from '../support/time';

const real = realData();
const fake = fixtureData();
const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

const settle = async (): Promise<void> => {
  for (let k = 0; k < 5; k += 1) await new Promise((done) => setTimeout(done, 0));
};

/** A stored total shown to the nearest whole minute, halves up: the stored totals have three decimals. */
const shown = (stored: number): number => Math.floor(stored + 0.5);

// ---- reading the drawing back --------------------------------------------------------------

/** A step path "M-0.5 y H0.5 V y H1.5 ..." read back into one value per column, in minutes. */
function readPath(d: string, max: number): { values: number[]; ends: number[] } {
  const values: number[] = [];
  const ends: number[] = [];
  for (const token of d.split(' ')) {
    if (token.startsWith('H')) ends.push(Number(token.slice(1)));
    else if (token.startsWith('V')) values.push(max * (1 - Number(token.slice(1)) / CHART_HEIGHT));
    else if (token.startsWith('M')) continue;
    else values.push(max * (1 - Number(token) / CHART_HEIGHT));
  }
  return { values, ends };
}

const stored1938 = (rows: readonly RaceRow[]): number[] => rows.map((r) => r.y1938.total);

/** The one-seat series of a file whose rows all have a one-seat ride, or null when none has. */
function storedToday(rows: readonly RaceRow[]): number[] | null {
  if (rows.every((r) => r.today === null)) return null;
  if (rows.some((r) => r.today === null)) throw new Error('mixed file: not used by these tests');
  return rows.map((r) => r.today!.total);
}

function expectSeries(root: ParentNode, rows: readonly RaceRow[]): void {
  const s1938 = stored1938(rows);
  const sToday = storedToday(rows);
  const max = Math.max(...s1938, ...(sToday ?? []));
  const paths = [...root.querySelectorAll('.chart-svg path.chart-line')];
  expect(paths).toHaveLength(sToday ? 2 : 1);
  const old = readPath(root.querySelector('.chart-line-1938')!.getAttribute('d')!, max);
  expect(old.ends).toEqual(rows.map((_, k) => k + 0.5));
  old.values.forEach((v, k) => expect(v).toBeCloseTo(s1938[k]!, 1));
  expect(old.values).toHaveLength(rows.length);
  const todayPath = root.querySelector('.chart-line-today');
  if (!sToday) {
    expect(todayPath).toBeNull();
    return;
  }
  const bus = readPath(todayPath!.getAttribute('d')!, max);
  expect(bus.ends).toEqual(rows.map((_, k) => k + 0.5));
  expect(bus.values).toHaveLength(rows.length);
  bus.values.forEach((v, k) => expect(v).toBeCloseTo(sToday[k]!, 1));
}

function expectHatch(root: ParentNode, rows: readonly RaceRow[]): void {
  const first = rows.findIndex((r) => r.before_table);
  const rect = root.querySelector('.chart-hatch');
  const label = root.querySelector('.chart-hatch-label');
  if (first === -1) {
    expect(rect).toBeNull();
    expect(label).toBeNull();
    return;
  }
  const last = rows.map((r) => r.before_table).lastIndexOf(true);
  expect(Number(rect!.getAttribute('x'))).toBe(first - 0.5);
  expect(Number(rect!.getAttribute('width'))).toBe(last - first + 1);
  expect(text(label)).toBe(C.CHART_HATCH_LABEL);
}

function expectCursor(root: ParentNode, rows: readonly RaceRow[], minute: number): void {
  const column = rows.findIndex((r) => r.t === clockOf(minute));
  const cursor = root.querySelector<SVGElement>('.chart-cursor')!;
  const shift = /translateX\((-?[\d.]+)px\)/.exec(cursor.getAttribute('style') ?? '');
  expect(Number(shift?.[1])).toBe(Math.max(column, 0));
  expect(cursor.getAttribute('visibility') === 'hidden').toBe(column < 0);
}

function expectReadout(root: ParentNode, registry: SourceRegistry, row: RaceRow, hasToday: boolean): void {
  const readout = root.querySelector('.chart-readout')!;
  const n = shown(row.y1938.total);
  expect(value(num(readout, 'readout-1938'))).toBe(n);
  expect(registry.get('readout-1938')).toBeDefined();
  if (hasToday) {
    const m = shown(row.today!.total);
    expect(value(num(readout, 'readout-today'))).toBe(m);
    expect(registry.get('readout-today')).toBeDefined();
    expect(text(readout)).toBe(`At ${label12(row.t)}: trolley ${n} min, today's bus ${m} min.`);
  } else {
    expect(readout.querySelector('button.num[data-source="readout-today"]')).toBeNull();
    expect(text(readout)).toBe(`At ${label12(row.t)}: trolley ${n} min.`);
  }
}

// ---- Property 9 on random and real race files ---------------------------------------------

const names = (race: RaceFile): [string, string] => {
  const name = (slug: string): string => real.index.corners.find((c) => c.slug === slug)?.name ?? fake.index.corners.find((c) => c.slug === slug)!.name;
  return [name(race.origin), name(race.dest)];
};

/** A made-up race file cut from the fixture's first pair: random totals, a random before-table prefix, with or without a one-seat ride. */
const base = fake.races.get(pairKey(fake.index.pairs[0]!))!;
const madeUp: fc.Arbitrary<{ race: RaceFile; pick: number; withToday: boolean }> = fc
  .record({
    from: fc.integer({ min: 0, max: base.races.length - 3 }),
    length: fc.integer({ min: 2, max: 60 }),
    withToday: fc.boolean(),
    prefix: fc.integer({ min: 0, max: 60 }),
    totals: fc.array(fc.tuple(fc.integer({ min: 500, max: 90_000 }), fc.integer({ min: 500, max: 90_000 })), { minLength: 60, maxLength: 60 }),
    pick: fc.nat(1000),
  })
  .map(({ from, length, withToday, prefix, totals, pick }) => {
    const rows = base.races.slice(from, from + length).map((row, k): RaceRow => {
      const [a, b] = totals[k]!;
      return {
        ...row,
        before_table: k < prefix,
        y1938: { ...row.y1938, total: a / 1000 },
        today: withToday && row.today ? { ...row.today, total: b / 1000 } : null,
      };
    });
    return { race: { ...base, races: rows }, pick: pick % rows.length, withToday: withToday && rows.every((r) => r.today) };
  });

describe('Property 9: the chart is the race file\'s stored totals', () => {
  // Feature: story-layer, Property 9: The chart is the race file's stored totals
  it('holds on random race files made from the fixture', () => {
    fc.assert(
      fc.property(madeUp, fc.boolean(), ({ race, pick, withToday }, guided) => {
        const registry = new SourceRegistry();
        const row = race.races[pick]!;
        const minute = Number(row.t.slice(0, 2)) * 60 + Number(row.t.slice(3));
        const root = document.createElement('div');
        root.append(chartView(registry, { race, originName: 'A', destName: 'B', minute, guided }));
        expect(root.querySelectorAll('.chart-svg')).toHaveLength(1);
        expectSeries(root, race.races);
        expectHatch(root, race.races);
        expectCursor(root, race.races, minute);
        expectReadout(root, registry, row, withToday);
        expect(root.querySelector('.chart-swatch.is-today') !== null).toBe(withToday);
      }),
      { numRuns: 100 },
    );
  }, 60_000);

  it('holds on the 20 real race files at random slider minutes', () => {
    const races = [...real.races.values()];
    fc.assert(
      fc.property(fc.nat(races.length - 1), fc.nat(10_000), (pi, ri) => {
        const race = races[pi]!;
        const row = race.races[ri % race.races.length]!;
        const minute = Number(row.t.slice(0, 2)) * 60 + Number(row.t.slice(3));
        const registry = new SourceRegistry();
        const root = document.createElement('div');
        const [originName, destName] = names(race);
        root.append(chartView(registry, { race, originName, destName, minute, guided: false }));
        expectSeries(root, race.races);
        expectHatch(root, race.races);
        expectCursor(root, race.races, minute);
        expectReadout(root, registry, row, row.today !== null);
      }),
      { numRuns: 100 },
    );
  }, 60_000);
});

// ---- the drawing -------------------------------------------------------------------------

describe('the chart drawing', () => {
  const race = real.races.get(pairKey(lead))!;
  const rows = race.races;
  const minute = 10 * 60;
  const draw = (guided: boolean) => {
    const registry = new SourceRegistry();
    const el = chartView(registry, { race, originName: 'A', destName: 'B', minute, guided });
    const root = document.createElement('div');
    root.append(el);
    return { root, registry, el };
  };

  it('has one column per row, both series, the hatch and the cursor (lead pair, 10:00)', () => {
    const { root } = draw(false);
    expectSeries(root, rows);
    expectHatch(root, rows);
    expectCursor(root, rows, minute);
    const svg = root.querySelector('.chart-svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe(C.CHART_ACCESSIBLE_NAME);
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    expect(svg.querySelectorAll('.chart-cursor')).toHaveLength(1);
  });

  it('shows the readout of the slider minute with two number buttons that have source rows', () => {
    const { root, registry } = draw(false);
    expectReadout(root, registry, rows.find((r) => r.t === clockOf(minute))!, true);
  });

  it('draws no numeric axis labels', () => {
    const { root } = draw(false);
    expect(root.querySelectorAll('.chart-svg text')).toHaveLength(0);
  });

  it('has the prompt heading while guided and the normal heading otherwise', () => {
    const guided = draw(true).root.querySelector('.chart-heading')!;
    expect(text(guided)).toBe(C.CHART_PROMPT_HEADING);
    expect(guided.classList.contains('chart-prompt')).toBe(true);
    const normal = draw(false).root.querySelector('.chart-heading')!;
    expect(text(normal)).toBe(C.CHART_HEADING);
    expect(normal.classList.contains('chart-prompt')).toBe(false);
    expect(C.CHART_PROMPT_HEADING).not.toBe(C.CHART_HEADING);
  });

  it('holds no listeners and no inline handlers, and the stylesheet blocks pointer input on it', () => {
    const added: EventTarget[] = [];
    const original = EventTarget.prototype.addEventListener;
    vi.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(function (this: EventTarget, ...args: Parameters<typeof original>) {
      added.push(this);
      return original.apply(this, args);
    });
    const { root, registry } = draw(true);
    updateChart(root, registry, { race, originName: 'A', destName: 'B', minute: minute + 7, guided: false });
    expect(added.filter((t) => t instanceof Node && root.contains(t))).toEqual([]);
    for (const el of root.querySelectorAll('*')) {
      expect([...el.attributes].filter((a) => a.name.startsWith('on'))).toEqual([]);
    }
    const css = readRepoText('web/src/styles/card.css');
    expect(/\.chart-svg\s*\{[^}]*pointer-events:\s*none/.test(css)).toBe(true);
    expect(/\.chart-plot\s*\{[^}]*pointer-events:\s*none/.test(css)).toBe(true);
  });

  it('moves the cursor and rewrites the readout when the slider minute changes, with no redraw and no stale source rows', () => {
    const { root, registry } = draw(false);
    const svg = root.querySelector('.chart-svg');
    const next = minute + 13;
    updateChart(root, registry, { race, originName: 'A', destName: 'B', minute: next, guided: false });
    expect(root.querySelector('.chart-svg')).toBe(svg);
    expectCursor(root, rows, next);
    expectReadout(root, registry, rows.find((r) => r.t === clockOf(next))!, true);
    expect(root.querySelectorAll('.chart-readout button.num')).toHaveLength(2);
    expect(registry.list().filter((s) => s.id.startsWith('readout-'))).toHaveLength(2);
  });
});

// ---- the chart on the page ---------------------------------------------------------------

const BASE = '/Ghost-Line/data/';

type Page = { app: App; log: string[]; time: FakeTime; scroll: HTMLElement };

/** The page booted on a data folder, with every file the loader asks for written to a log. */
async function bootLogged(folder: string, leadPair: Pair, query = false): Promise<Page> {
  const log: string[] = [];
  const inner = folderFetch(folder);
  const html = readRepoText('web/index.html');
  const body = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';
  document.documentElement.lang = /<html[^>]*\slang="([^"]*)"/.exec(html)?.[1] ?? '';
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
  const time = fakeTime();
  const app = createApp({
    doc: document,
    loader: createLoader({
      baseUrl: BASE,
      timeoutMs: TIMINGS.dataTimeoutMs,
      leadPair,
      fetch: (url, init) => {
        log.push(url.slice(BASE.length));
        return inner(url, init);
      },
    }),
    // 20:00 in New York is outside the slider range: the guided example start, 10:00.
    now: () => new Date('2026-11-04T20:00:00-05:00'),
    layout: () => 'phone',
    query: query ? `?from=${leadPair.origin}&to=${leadPair.dest}` : '',
    motion: 'full',
    timers: time,
    share: {},
    address: { origin: window.location.origin, path: window.location.pathname, replace: (url) => window.history.replaceState(null, '', url) },
  });
  await app.boot();
  return { app, log, time, scroll: document.getElementById('card-scroll')! };
}

const raceFetches = (log: readonly string[]): string[] => log.filter((name) => name.startsWith('race/'));

/** The chart on screen equals the race file of the pair in the state, and nothing but the visited pairs' files was fetched. */
function expectFollows(page: Page, races: Map<string, RaceFile>, visited: Set<string>): void {
  const state = page.app.store.get();
  const race = races.get(pairKey(state.pair))!;
  expect(race, pairKey(state.pair)).toBeDefined();
  expect(page.scroll.querySelectorAll('.chart-svg')).toHaveLength(1);
  expectSeries(page.scroll, race.races);
  expectHatch(page.scroll, race.races);
  expectCursor(page.scroll, race.races, state.minute);
  const row = race.races.find((r) => r.t === clockOf(state.minute))!;
  const registry = page.app.registry;
  expectReadout(page.scroll, registry, row, row.today !== null);
  // The chart is drawn before the new race starts: the start pause has not run yet.
  expect(state.race.phase).toBe('idle');
  visited.add(raceFileName(state.pair));
  const fetched = raceFetches(page.log);
  expect([...new Set(fetched)].sort()).toEqual([...visited].sort());
  expect(fetched.length).toBe(visited.size);
}

describe('the chart follows the race file on the page', () => {
  it('draws the made-up race file: its columns, its before-table hatch, its cursor and its readout', async () => {
    const pair = fake.index.pairs[0]!;
    const page = await bootLogged(FIXTURE_DIR, pair, true);
    const race = fake.races.get(pairKey(pair))!;
    expect(page.app.store.get().pair).toEqual(pair);
    expectFollows(page, fake.races, new Set([raceFileName(pair)]));
    // The made-up file is before the table until 09:10: ten hatched columns, not the real file's.
    expect(race.races.filter((r) => r.before_table)).toHaveLength(10);
    expect(page.scroll.querySelector('.chart-hatch')).not.toBeNull();
    const real10 = real.races.get(pairKey(lead))!.races.map((r) => r.y1938.total);
    expect(stored1938(race.races)).not.toEqual(real10);
  });

  it('redraws from the new file after every pair change, swap and today-win shortcut on the made-up line, fetching nothing extra', async () => {
    const pair = fake.index.pairs[0]!;
    const page = await bootLogged(FIXTURE_DIR, pair, true);
    const visited = new Set([raceFileName(pair)]);
    expectFollows(page, fake.races, visited);
    const { store } = page.app;
    // Pairs 0, 1, 2 and 4 have a one-seat ride on every row or on none; pair 3 is a mixed file.
    for (const k of [1, 2, 4, 0]) {
      store.dispatch({ type: 'pair/set', pair: fake.index.pairs[k]! });
      await settle();
      expectFollows(page, fake.races, visited);
    }
    store.dispatch({ type: 'pair/set', pair });
    await settle();
    store.dispatch({ type: 'pair/swap' });
    await settle();
    expect(store.get().pair).toEqual(fake.index.pairs[1]);
    expectFollows(page, fake.races, visited);
    store.dispatch({ type: 'pair/swap' });
    await settle();
    expect(store.get().pair).toEqual(pair);
    expectFollows(page, fake.races, visited);
    // The shortcut walks the made-up summary's list and draws each entry's file.
    const wins = fake.summary.today_wins;
    expect(wins.length).toBeGreaterThan(0);
    const reachable = wins.filter((w) => !(w.origin === fake.index.pairs[3]!.origin && w.dest === fake.index.pairs[3]!.dest));
    expect(reachable.length).toBe(wins.length);
    for (let k = 0; k < Math.min(wins.length, 8); k += 1) {
      store.dispatch({ type: 'todaywin/select' });
      await settle();
      const entry = wins[k]!;
      expect(store.get().pair).toEqual({ origin: entry.origin, dest: entry.dest });
      expect(clockOf(store.get().minute)).toBe(entry.t);
      expectFollows(page, fake.races, visited);
    }
  }, 30_000);

  it('redraws from the new file after every pair change, swap and today-win shortcut on the real line, fetching nothing extra', async () => {
    const page = await bootLogged('web/public/data', lead);
    const visited = new Set([raceFileName(lead)]);
    expectFollows(page, real.races, visited);
    const { store } = page.app;
    for (const pair of real.index.pairs) {
      store.dispatch({ type: 'pair/set', pair });
      await settle();
      expect(store.get().pair).toEqual(pair);
      expectFollows(page, real.races, visited);
      store.dispatch({ type: 'pair/swap' });
      await settle();
      expect(store.get().pair).toEqual({ origin: pair.dest, dest: pair.origin });
      expectFollows(page, real.races, visited);
    }
    const wins = real.summary.today_wins;
    for (let k = 0; k < wins.length + 1; k += 1) {
      store.dispatch({ type: 'todaywin/select' });
      await settle();
      const entry = wins[k % wins.length]!;
      expect(store.get().pair).toEqual({ origin: entry.origin, dest: entry.dest });
      expect(clockOf(store.get().minute)).toBe(entry.t);
      expectFollows(page, real.races, visited);
    }
    // Every file asked for was a race file of a pair on the line, and none twice.
    expect(raceFetches(page.log).every((name) => real.index.pairs.some((p) => raceFileName(p) === name))).toBe(true);
    expect(page.log.filter((n) => n === INDEX_FILE)).toHaveLength(1);
  }, 120_000);
});
