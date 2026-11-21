// Task 9.2: "Where the time goes" on the page (story-layer Req 8.2 to 8.7, 16.8).
// Expected values are read from the lane legends of the same render and from the stored race rows;
// the takeaway's own numbers are never used to work out what it should say.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import * as C from '../../src/copy/copy';
import { pairKey } from '../../src/data/files';
import type { Pair, RaceFile } from '../../src/data/types';
import { fixtureData } from '../support/fixture';
import { realData } from '../support/realdata';
import { type Data, type Rendered, num, renderAt, text, value } from '../support/render';

const real = realData();
const fake = fixtureData();

const legend = (root: Element, side: '1938' | 'today'): number[] =>
  [...root.querySelectorAll(`.lane-${side} .legend button.num`)].map(value);

const takeawayRows = (root: Element): string[] => [...root.querySelectorAll('.takeaway .takeaway-row')].map(text);
const mostSentence = (root: Element): Element | null => root.querySelector('.takeaway .takeaway-most');

/** The rows the takeaway must show, worked out from the lane legends of the same render. */
function expectedRows(r: Rendered): string[] {
  const [wait38, ride38] = legend(r.root, '1938') as [number, number];
  if (!r.view.row.today) return [C.takeawayWaitingTrolley(wait38), C.takeawayRidingTrolley(ride38)];
  const [walkTo, waitToday, rideToday, walkFrom] = legend(r.root, 'today') as [number, number, number, number];
  return [
    C.takeawayWaiting(wait38, waitToday),
    C.takeawayWalking(walkTo + walkFrom),
    C.takeawayRiding(ride38, rideToday),
  ];
}

function checkNumbers(r: Rendered): void {
  const buttons = [...r.root.querySelectorAll<HTMLButtonElement>('.takeaway button.num')];
  expect(buttons.length).toBe(r.view.row.today ? 5 : 2);
  for (const b of buttons) {
    const id = b.dataset['source']!;
    expect(id.startsWith('take-'), id).toBe(true);
    expect(r.registry.get(id), id).toBeDefined();
    expect(r.registry.list().some((s) => s.id === id), id).toBe(true);
  }
}

function withFlag(data: Data, race: RaceFile, t: string, flag: boolean): Data {
  const races = new Map(data.races);
  races.set(pairKey(race), { ...race, races: race.races.map((row) => (row.t === t ? { ...row, wait_most: flag } : row)) });
  return { ...data, races };
}

const sources: [string, Data][] = [
  ['real', real],
  ['fixture', fake],
];

describe('Property 8: the takeaway repeats the lane values and follows the stored flag', () => {
  // Feature: story-layer, Property 8: The takeaway repeats the lane values and follows the stored flag
  it.each(sources)('holds on %s rows, and flips with a copy of the row with the flag flipped', (_name, data) => {
    const races = [...data.races.values()];
    fc.assert(
      fc.property(fc.nat(races.length - 1), fc.nat(10_000), (pi, ri) => {
        const race = races[pi]!;
        const t = race.races[ri % race.races.length]!.t;
        const r = renderAt(data, race, t);
        expect(takeawayRows(r.root)).toEqual(expectedRows(r));
        checkNumbers(r);
        const stored = r.view.row.wait_most;
        expect(mostSentence(r.root) !== null).toBe(stored);
        if (mostSentence(r.root)) expect(text(mostSentence(r.root))).toBe(C.TAKEAWAY_MOST);

        // The same row with the flag flipped: only the sentence changes.
        const flipped = renderAt(withFlag(data, race, t, !stored), race, t);
        expect(mostSentence(flipped.root) !== null).toBe(!stored);
        expect(takeawayRows(flipped.root)).toEqual(takeawayRows(r.root));
      }),
      { numRuns: 100 },
    );
  }, 60_000);
});

describe('the lead race at 10:00 on real data', () => {
  const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
  const r = renderAt(real, lead, '10:00');

  it('shows the heading, three rows and the most-of-the-difference sentence from the stored flag', () => {
    expect(r.view.row.wait_most).toBe(true);
    expect(text(r.root.querySelector('.takeaway .takeaway-heading'))).toBe(C.TAKEAWAY_HEADING);
    expect(takeawayRows(r.root)).toEqual(expectedRows(r));
    expect(text(mostSentence(r.root))).toBe(C.TAKEAWAY_MOST);
  });

  it('repeats the lane legend values as its own number buttons', () => {
    const [wait38, ride38] = legend(r.root, '1938') as [number, number];
    const [walkTo, wait, ride, walkFrom] = legend(r.root, 'today') as [number, number, number, number];
    expect(value(num(r.root, 'take-wait-1938'))).toBe(wait38);
    expect(value(num(r.root, 'take-ride-1938'))).toBe(ride38);
    expect(value(num(r.root, 'take-wait-today'))).toBe(wait);
    expect(value(num(r.root, 'take-ride-today'))).toBe(ride);
    expect(value(num(r.root, 'take-walk-today'))).toBe(walkTo + walkFrom);
  });

  it('gives every takeaway number a Number_Button with a Sources row, the walk sum marked as an estimate', () => {
    checkNumbers(r);
    const walk = num(r.root, 'take-walk-today');
    expect(r.registry.get('take-walk-today')?.walk).toBe(true);
    expect(walk.getAttribute('aria-label') ?? '').toContain('estimate');
  });

  it('prints no bare digit in the takeaway', () => {
    const walker = document.createTreeWalker(r.root.querySelector('.takeaway')!, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.parentElement!.closest('button.num')) continue;
      expect(n.textContent ?? '').not.toMatch(/\d/);
    }
  });
});

describe('the made-up rows', () => {
  const findRow = (pred: (row: RaceFile['races'][number]) => boolean): { race: RaceFile; t: string } => {
    for (const race of fake.races.values()) {
      const row = race.races.find(pred);
      if (row) return { race, t: row.t };
    }
    throw new Error('the fixture has no such row');
  };

  it('omits the sentence on a win where walking and riding make up most of the margin (stored flag false)', () => {
    const { race, t } = findRow((row) => !!row.today && (row.result === '1938' || row.result === 'today') && !row.wait_most);
    const r = renderAt(fake, race, t);
    expect(r.view.row.wait_most).toBe(false);
    expect(mostSentence(r.root)).toBeNull();
    expect(takeawayRows(r.root)).toEqual(expectedRows(r));
    expect(takeawayRows(r.root)).toHaveLength(3);
    checkNumbers(r);
  });

  it('shows trolley rows only when there is no one-seat ride', () => {
    const { race, t } = findRow((row) => row.today === null);
    const r = renderAt(fake, race, t);
    expect(r.view.row.today).toBeNull();
    const rows = takeawayRows(r.root);
    expect(rows).toEqual(expectedRows(r));
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).toContain('trolley');
    expect(r.root.querySelector('.takeaway')!.textContent).not.toMatch(/bus|Walking/);
    expect(mostSentence(r.root)).toBeNull();
    checkNumbers(r);
    expect(r.root.querySelector('button.num[data-source="take-wait-today"]')).toBeNull();
    expect(r.root.querySelector('button.num[data-source="take-walk-today"]')).toBeNull();
  });
});
