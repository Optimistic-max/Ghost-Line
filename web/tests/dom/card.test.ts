// Task 10.6: the static card on real data, and the four results. Expected values
// are read from the files; the pairs and times are the requirements' real cases
// (R17.4), and each test first checks the file has that result there.
import { describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import * as C from '../../src/copy/copy';
import { formatCount } from '../../src/format/count';
import { roundTotal } from '../../src/format/rounding';
import { label12, minutesOf, shortClock } from '../../src/format/time';
import { rowAt } from '../../src/data/lookup';
import { bannedTerms } from '../support/banned';
import { readRepoText } from '../support/files';
import { fixtureData } from '../support/fixture';
import { realData, slugNamed } from '../support/realdata';
import { num, renderAt, text, value } from '../support/render';
import { minuteWordProblems } from '../support/words';

const data = realData();
const lead = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
const westToPreston = { origin: slugNamed('Westwood & Carey'), dest: slugNamed('Preston & Caroline') };

/** The minutes shown in a lane's legend, in phase order. */
function legendMinutes(root: Element, side: '1938' | 'today'): number[] {
  return [...root.querySelectorAll(`.lane-${side} .legend button.num`)].map(value);
}

function resultOf(pair: { origin: string; dest: string }, hhmm: string): string {
  const race = data.races.get(`${pair.origin}__${pair.dest}`)!;
  return rowAt(race, hhmm)!.result;
}

describe('a 1938 win: the lead pair at 10:00', () => {
  it('is a 1938 win in the file', () => expect(resultOf(lead, '10:00')).toBe('1938'));
  const { root, view, registry } = renderAt(data, lead, '10:00');

  it('shows each stored total rounded, and parts that add up to it', () => {
    const t1938 = value(num(root, 'total-1938'));
    const tToday = value(num(root, 'total-today'));
    expect(t1938).toBe(roundTotal(view.row.y1938.total));
    expect(tToday).toBe(roundTotal(view.row.today!.total));
    expect(legendMinutes(root, '1938').reduce((a, b) => a + b, 0)).toBe(t1938);
    expect(legendMinutes(root, 'today').reduce((a, b) => a + b, 0)).toBe(tToday);
  });

  it('gives the margin as the difference of the shown totals, in the 1938 colour', () => {
    const box = root.querySelector('.result')!;
    expect(box.getAttribute('data-result')).toBe('1938');
    const margin = value(num(root, 'margin'));
    expect(margin).toBe(value(num(root, 'total-today')) - value(num(root, 'total-1938')));
    expect(text(box.querySelector('.result-line'))).toBe(C.wins1938(margin));
  });

  it('says walking included (estimated) beside the bus total', () => {
    const totals = text(root.querySelector('.result-totals'));
    expect(totals).toBe(C.totals1938Wins(value(num(root, 'total-1938')), value(num(root, 'total-today'))));
    expect(totals).toContain('walking included (estimated)');
  });

  it('uses the plain honest line, with the counts of summary.json', () => {
    const honest = root.querySelector('.honest')!;
    expect(honest.getAttribute('data-form')).toBe('plain');
    expect(text(honest)).toBe(C.honestLine(formatCount(data.summary.wins_1938), formatCount(data.summary.races)));
    expect(text(num(root, 'count-wins-1938'))).toBe(formatCount(data.summary.wins_1938));
    expect(text(num(root, 'count-races'))).toBe(formatCount(data.summary.races));
  });

  it('labels the legend phases in text, walks with "estimate"', () => {
    const legend = text(root.querySelector('.lane-today .legend'));
    const [walkTo, wait, ride, walkFrom] = legendMinutes(root, 'today');
    expect(legend).toBe([C.legendWalk(walkTo!), C.legendWait(wait!), C.legendRide(ride!), C.legendWalk(walkFrom!)].join(' '));
  });

  it('shows the slider range from the race file and the start time in 12-hour form', () => {
    const race = data.races.get(`${lead.origin}__${lead.dest}`)!;
    const first = race.races[0]!.t;
    const last = race.races.at(-1)!.t;
    const input = root.querySelector<HTMLInputElement>('#start-time')!;
    expect([...root.querySelectorAll('.slider-ends span')].map(text)).toEqual([label12(first), label12(last)]);
    expect([input.min, input.max, input.step, input.value]).toEqual(
      [minutesOf(first), minutesOf(last), 1, minutesOf('10:00')].map(String),
    );
    expect(input.getAttribute('aria-valuetext')).toBe(C.sliderValueText(label12('10:00')));
    expect(text(root.querySelector('.slider-time'))).toBe(label12('10:00'));
  });

  it('gives every number button a source, and every source a button', () => {
    const buttons = [...root.querySelectorAll<HTMLElement>('button.num')];
    expect(buttons.length).toBeGreaterThan(10);
    for (const b of buttons) expect(registry.get(b.dataset['source']!), b.dataset['source']).toBeDefined();
    for (const spec of registry.list()) expect(root.querySelector(`button.num[data-source="${spec.id}"]`), spec.id).not.toBeNull();
  });

  it('prints every number as a number button (apart from the start time on the slider and the board header, the schedule date and the word 1938), on both layouts', () => {
    // The board header's time is the slider's start time (Emmanuel, Nov 19). The phone's finished card
    // has no board, so the board is checked as the desktop card draws it.
    const board = renderAt(data, lead, '10:00', 'desktop').root.querySelector('.board')!;
    expect(board).not.toBeNull();
    for (const card of [root, board]) {
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      const loose: string[] = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement!;
        if (el.closest('button.num, .slider-row, .start-row, .schedule, .board-head')) continue;
        // The chart readout opens with the slider's start time, plain text like the slider's (story-layer Req 9.7).
        const t = (n.textContent ?? '').replace(/\b1938\b/g, '').replace(/^At \d{1,2}:\d{2} [AP]M/, '');
        if (/\d/.test(t)) loose.push(t.trim());
      }
      expect(loose).toEqual([]);
    }
  });

  it('names each number button by its visible text, then what it is', () => {
    const b = num(root, 'ride-1938');
    expect(text(b)).toBe(C.minShort(value(b)));
    expect(b.getAttribute('aria-label')).toBe(C.numberLabel(text(b), C.WHAT.ride1938));
    expect(b.getAttribute('aria-label')).toMatch(/^\d+ min, /);
  });
});

describe('a today win: Westwood & Carey to Preston & Caroline at 11:23', () => {
  it('is a today win in the file', () => expect(resultOf(westToPreston, '11:23')).toBe('today'));
  const { root } = renderAt(data, westToPreston, '11:23');

  it('shows the today result in the today colour, with the margin as the difference of shown totals', () => {
    const box = root.querySelector('.result')!;
    expect(box.getAttribute('data-result')).toBe('today');
    const margin = value(num(root, 'margin'));
    expect(margin).toBe(value(num(root, 'total-1938')) - value(num(root, 'total-today')));
    expect(text(box.querySelector('.result-line'))).toBe(C.winsToday(margin));
    expect(text(box.querySelector('.result-totals'))).toContain('walking included (estimated)');
  });

  it('uses the today-wins honest line', () => {
    const honest = root.querySelector('.honest')!;
    expect(honest.getAttribute('data-form')).toBe('today-wins');
    expect(text(honest)).toBe(C.honestLineTodayWins(formatCount(data.summary.wins_1938), formatCount(data.summary.races)));
  });

  it('draws the result box exactly like a 1938 win, apart from the colour (P8)', () => {
    const shape = (el: Element): string =>
      `${el.tagName}.${[...el.classList].join('.')}[${[...el.children].map(shape).join(',')}]`;
    const win1938 = renderAt(data, lead, '10:00').root.querySelector('.result')!;
    const winToday = root.querySelector('.result')!;
    // The same elements and classes; the number buttons inside may sit in a different order.
    const boxes = (el: Element): string[] => [...el.children].map((c) => `${c.tagName}.${[...c.classList].join('.')}`);
    expect(boxes(winToday)).toEqual(boxes(win1938));
    expect(winToday.className).toBe(win1938.className);
    expect(shape(winToday).replace(/BUTTON\.num\[\]/g, 'N')).toBe(shape(win1938).replace(/BUTTON\.num\[\]/g, 'N'));
  });
});

describe('the result box CSS', () => {
  it('changes only the colour of the result line between results (P8)', () => {
    const css = readRepoText('web/src/styles/card.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => m[1]!.includes('[data-result'));
    expect(rules.length).toBeGreaterThanOrEqual(3);
    for (const [, , body] of rules) {
      const props = [...body!.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]);
      expect(props).toEqual(['color']);
    }
  });
});

describe('a photo finish: the lead pair at 10:30', () => {
  it('is a photo finish in the file', () => expect(resultOf(lead, '10:30')).toBe('photo_finish'));
  const { root, view } = renderAt(data, lead, '10:30');

  it('names no winner and shows the shown totals in the photo-finish form', () => {
    const box = root.querySelector('.result')!;
    expect(box.getAttribute('data-result')).toBe('photo_finish');
    expect(text(box.querySelector('.result-line'))).toBe(C.PHOTO_FINISH);
    const a = value(num(root, 'total-1938'));
    const b = value(num(root, 'total-today'));
    const expected = a === b ? C.bothAbout(a) : C.aboutAnd(Math.min(a, b), Math.max(a, b));
    expect(text(box.querySelector('.result-totals'))).toBe(expected);
    expect(root.querySelector('[data-source="margin"]')).toBeNull();
    expect(view.honest.form).toBe('plain');
  });
});

describe('no one-seat ride (the made-up fixture line)', () => {
  const fixture = fixtureData();
  const pair = fixture.index.pairs.find((p) => fixture.races.get(`${p.origin}__${p.dest}`)!.today.trips.length === 0)!;
  const { root } = renderAt(fixture, pair, fixture.races.get(`${pair.origin}__${pair.dest}`)!.races[0]!.t);

  it('keeps the 1938 lane, says no single bus links the corners, and calls no winner', () => {
    expect(root.querySelector('.lane-1938')).not.toBeNull();
    expect(root.querySelector('.lane-today')).toBeNull();
    expect(text(root.querySelector('.no-bus'))).toBe(C.NO_SINGLE_BUS);
    const box = root.querySelector('.result')!;
    expect(box.getAttribute('data-result')).toBe('no_one_seat_ride');
    expect(text(box.querySelector('.result-line'))).toBe(C.NO_ONE_SEAT_RIDE);
    expect(text(box.querySelector('.result-totals'))).toBe(C.trolleyNoWinner(value(num(root, 'total-1938'))));
    expect(root.querySelector('[data-source="total-today"], [data-source="margin"]')).toBeNull();
  });
});

describe('wording on the card', () => {
  const cases = [renderAt(data, lead, '10:00'), renderAt(data, westToPreston, '11:23'), renderAt(data, lead, '10:30')];

  it('has no banned word and only correct minute words, in text and names', () => {
    for (const { root } of cases) {
      const names = [...root.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).join(' ');
      for (const t of [text(root), names]) {
        expect(bannedTerms(t)).toEqual([]);
        expect(minuteWordProblems(t)).toEqual([]);
      }
    }
  });

  it('shows the schedule line, and "Start time is the time now." only for a clock-derived time', () => {
    const date = /^Weekday schedule as of (.+)\. Scheduled, not live\.$/;
    expect(text(cases[0]!.root.querySelector('.schedule'))).toMatch(date);
    expect(text(renderAt(data, lead, '10:00', 'phone', true).root.querySelector('.schedule'))).toBe(
      `${text(cases[0]!.root.querySelector('.schedule'))} ${C.START_IS_NOW}`,
    );
  });
});
