// Task 12.3: the departures board and the frequency sentence on real data and on
// the made-up fixture line. Every expected time, gap and name is read from the
// race files here, with the rounding written out (halves up), so the test does
// not lean on the site's own helpers for its expectations.
import { afterEach, describe, expect, it } from 'vitest';
import { BOARD, LEAD_PAIR, TIMINGS } from '../../src/config';
import * as C from '../../src/copy/copy';
import { rowAt } from '../../src/data/lookup';
import type { Pair, RaceFile } from '../../src/data/types';
import { dropSeconds, label12, serviceDateLabel, shortClock } from '../../src/format/time';
import { MAX_SECONDS } from '../../src/play/timeline';
import { fixtureData } from '../support/fixture';
import { bootPage } from '../support/page';
import { raceOf, realData, slugNamed } from '../support/realdata';
import { renderAt, text } from '../support/render';
import { fakeTime } from '../support/time';

const data = realData();
const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
const westToAliceanna: Pair = { origin: slugNamed('Westwood & Carey'), dest: slugNamed('Aliceanna & Bond') };

/** Whole minutes, halves up (R8.5). */
const whole = (x: number): number => Math.floor(x + 0.5);

/** The names joined as R8.5 says: "A", "A and B", "A, B and C". */
function joined(names: string[]): string {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} ${C.LIST_AND} ${names.at(-1)}`;
}

/** What the board should list at slider time `hhmm`, from the race file alone. */
function expectedBoard(race: RaceFile, hhmm: string) {
  const row = rowAt(race, hhmm)!;
  const from = race.y1938.passes.indexOf(row.y1938.dep);
  const cars = race.y1938.passes.slice(from, from + BOARD.cars1938).map(shortClock);
  const buses = row.today ? race.today.trips.slice(row.today.trip, row.today.trip + BOARD.buses).map((t) => shortClock(dropSeconds(t.dep))) : [];
  return { row, cars, buses };
}

const chips = (root: ParentNode, side: '1938' | 'today'): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(`.board-row-${side} .chip`)];

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
});

describe('the board for the lead pair at 10:00 (desktop, finished)', () => {
  const race = raceOf(lead);
  const { root, registry } = renderAt(data, lead, '10:00', 'desktop');
  const want = expectedBoard(race, '10:00');

  it('starts at row.start and lists the file\'s next four cars and next three buses, in order', () => {
    expect(text(root.querySelector('.board-head'))).toBe(C.boardHeader(shortClock(want.row.start)));
    expect(chips(root, '1938').map(text)).toEqual(want.cars);
    expect(chips(root, 'today').map(text)).toEqual(want.buses);
    expect(want.cars).toHaveLength(BOARD.cars1938);
    expect(want.buses).toHaveLength(BOARD.buses);
    // The next one on each side is the lane's own next car and bus.
    expect(text(chips(root, '1938')[0])).toBe(shortClock(want.row.y1938.dep));
  });

  it('fills the next chip on each side only, and makes every time a number button with a source', () => {
    for (const side of ['1938', 'today'] as const) {
      const row = chips(root, side);
      expect(row.map((c) => c.classList.contains('chip-next'))).toEqual(row.map((_, k) => k === 0));
      for (const c of row) {
        expect(c.matches('button.num')).toBe(true);
        expect(registry.get(c.dataset['source']!), c.dataset['source']).toBeDefined();
      }
    }
    expect(text(root.querySelector('.board-row-1938 .board-label'))).toBe(C.BOARD_1938);
    expect(text(root.querySelector('.board-row-today .board-label'))).toBe(C.BOARD_TODAY);
  });

  it('gives the bus gaps and the 1938 spacing from the file, rounded to whole minutes', () => {
    const [a, b] = [whole(race.today.gap_min!), whole(race.today.gap_max!)];
    const [c, d] = [whole(race.y1938.gap_min), whole(race.y1938.gap_max)];
    // The lead pair's file has a range of bus gaps and two different 1938 gaps.
    expect(a).toBeGreaterThan(0);
    expect(a).not.toBe(b);
    expect(c).not.toBe(d);
    expect(text(root.querySelector('.board-row-today .board-gaps'))).toBe(C.boardGapRange(a, b));
    expect(text(root.querySelector('.board-row-1938 .board-gaps'))).toBe(C.boardEveryOr(c, d));
  });

  it('makes the spacing and the gaps number buttons, named from their visible text (Emmanuel, Nov 19 and 20)', () => {
    const { today, y1938 } = race;
    const spacing = root.querySelector<HTMLElement>('.board-row-1938 .board-gaps')!;
    const gaps = root.querySelector<HTMLElement>('.board-row-today .board-gaps')!;
    expect(spacing.matches('button.num')).toBe(true);
    expect(gaps.matches('button.num')).toBe(true);
    const spacingText = C.boardEveryOr(whole(y1938.gap_min), whole(y1938.gap_max));
    const gapsText = C.boardGapRange(whole(today.gap_min!), whole(today.gap_max!));
    expect(text(spacing)).toBe(spacingText);
    expect(text(gaps)).toBe(gapsText);
    expect(spacing.getAttribute('aria-label')).toBe(C.numberLabel(spacingText, C.WHAT.spacing1938));
    expect(gaps.getAttribute('aria-label')).toBe(
      C.numberLabel(gapsText, C.whatBusGaps(label12(today.window_from), label12(today.window_to))),
    );
  });

  it('keeps the frequency sentence off the card and gives it, filled from the file, as both rows\' method', () => {
    const { today, y1938 } = race;
    const sentence = C.frequency(
      C.gapRange(whole(today.gap_min!), whole(today.gap_max!)),
      label12(today.window_from),
      label12(today.window_to),
      joined(today.route_names),
      serviceDateLabel(race.service_date),
      C.everyMinutesOr(whole(y1938.gap_min), whole(y1938.gap_max)),
    );
    expect(text(root)).not.toContain(sentence);
    expect(root.querySelector('.frequency')).toBeNull();
    for (const side of ['1938', 'today'] as const) {
      const id = root.querySelector<HTMLElement>(`.board-row-${side} .board-gaps`)!.dataset['source']!;
      expect(registry.get(id)?.method, id).toBe(sentence);
    }
    expect(registry.get(root.querySelector<HTMLElement>('.board-row-1938 .board-gaps')!.dataset['source']!)?.date).toBe('effective');
    expect(registry.get(root.querySelector<HTMLElement>('.board-row-today .board-gaps')!.dataset['source']!)?.date).toBe('feed');
  });
});

describe('a pair served by two routes: Westwood & Carey to Aliceanna & Bond', () => {
  const race = raceOf(westToAliceanna);
  const { root, registry } = renderAt(data, westToAliceanna, '10:00', 'desktop');

  const gapsMethod = (): string | undefined =>
    registry.get(root.querySelector<HTMLElement>('.board-row-today .board-gaps')!.dataset['source']!)?.method;

  it('has a lower bus gap that rounds to 0 in the file, so both texts use the "up to" form', () => {
    expect(whole(race.today.gap_min!)).toBe(0);
    const max = whole(race.today.gap_max!);
    expect(text(root.querySelector('.board-row-today .board-gaps'))).toBe(C.boardGapUpTo(max));
    // The name starts with the printed short form; the Sources row's method line has the sentence form.
    expect(root.querySelector('.board-row-today .board-gaps')!.getAttribute('aria-label')).toMatch(
      new RegExp(`^${C.boardGapUpTo(max)}, `),
    );
    expect(gapsMethod()).toContain(C.gapUpTo(max));
  });

  it('names every route of the file in the sentence, joined with "and"', () => {
    expect(race.today.route_names.length).toBeGreaterThan(1);
    expect(gapsMethod()).toContain(`(${joined(race.today.route_names)}, `);
  });

  it('lists the file\'s next buses whichever route they are on', () => {
    expect(chips(root, 'today').map(text)).toEqual(expectedBoard(race, '10:00').buses);
  });
});

describe('before the midday table: the lead pair at the first slider minute', () => {
  const race = raceOf(lead);
  const first = race.races[0]!.t;
  const { root } = renderAt(data, lead, first, 'desktop');

  it('starts the board at the covered-from time, row.start (R8.3)', () => {
    const row = rowAt(race, first)!;
    expect(row.before_table).toBe(true);
    expect(row.start).not.toBe(row.t);
    expect(text(root.querySelector('.board-head'))).toBe(C.boardHeader(shortClock(row.start)));
    expect(text(chips(root, '1938')[0])).toBe(shortClock(row.start));
  });
});

describe('the made-up fixture line', () => {
  const fixture = fixtureData();
  const races = [...fixture.races.values()];

  it('lists each pair\'s own next cars and buses at every tenth minute', () => {
    for (const race of races) {
      for (const row of race.races.filter((_, k) => k % 10 === 0)) {
        const pair = { origin: race.origin, dest: race.dest };
        const { root } = renderAt(fixture, pair, row.t, 'desktop');
        const want = expectedBoard(race, row.t);
        expect(chips(root, '1938').map(text), `${race.origin} ${row.t}`).toEqual(want.cars);
        expect(chips(root, 'today').map(text), `${race.origin} ${row.t}`).toEqual(want.buses);
      }
    }
  });

  it('has a 1938 row and no bus row with no one-seat ride; with no frequency sentence the spacing row cites the timetable line', () => {
    const race = races.find((r) => r.today.trips.length === 0)!;
    const { root, registry } = renderAt(fixture, { origin: race.origin, dest: race.dest }, race.races[0]!.t, 'desktop');
    expect(chips(root, '1938').length).toBeGreaterThan(0);
    expect(root.querySelector('.board-row-today')).toBeNull();
    const spacing = root.querySelector<HTMLElement>('.board-row-1938 .board-gaps')!;
    expect(registry.get(spacing.dataset['source']!)?.method).toBe(C.METHOD_CAR_1938);
  });
});

describe('where the board shows (R8.4, R5.11)', () => {
  it('on a phone: before, during and after the finish', async () => {
    const time = fakeTime();
    const app = await bootPage({ time });
    expect(document.querySelector('.board')).not.toBeNull();
    time.advance(TIMINGS.orientationMs + 1500);
    expect(app.store.get().race.phase).toBe('running');
    expect(document.querySelector('.board')).not.toBeNull();
    time.advance((MAX_SECONDS + 1) * 1000);
    expect(app.store.get().race.phase).toBe('finished');
    expect(document.querySelector('.board')).not.toBeNull();
    expect(app.registry.list().some((s) => s.id.startsWith('board-'))).toBe(true);
  });

  it('on desktop: before, during and after the race', async () => {
    const time = fakeTime();
    const app = await bootPage({ time, layout: 'desktop' });
    expect(document.querySelector('.board')).not.toBeNull();
    time.advance(TIMINGS.orientationMs + (MAX_SECONDS + 1) * 1000);
    expect(app.store.get().race.phase).toBe('finished');
    expect(document.querySelector('.board')).not.toBeNull();
  });

  it('with reduced motion: on a phone and on desktop', async () => {
    await bootPage({ motion: 'reduced' });
    expect(document.querySelector('.board')).not.toBeNull();
    await bootPage({ motion: 'reduced', layout: 'desktop' });
    expect(document.querySelector('.board')).not.toBeNull();
  });
});

describe('while the slider moves (R3.5)', () => {
  it('updates the board to the new minute with the race stopped, and nothing else on the lanes', async () => {
    const time = fakeTime();
    const app = await bootPage({ time });
    time.advance(1500);
    const status = text(document.querySelector('.lane-1938 .status'));
    const input = document.querySelector<HTMLInputElement>('#start-time')!;
    input.value = '720';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(app.store.get().race.phase).toBe('idle');
    const want = expectedBoard(raceOf(lead), '12:00');
    expect(text(document.querySelector('.board-head'))).toBe(C.boardHeader(shortClock(want.row.start)));
    expect(chips(document, '1938').map(text)).toEqual(want.cars);
    expect(chips(document, 'today').map(text)).toEqual(want.buses);
    expect(text(document.querySelector('.lane-1938 .status'))).toBe(status);
    for (const c of [...chips(document, '1938'), ...chips(document, 'today')]) {
      expect(app.registry.get(c.dataset['source']!)?.value).toBe(text(c));
    }
  });
});
