// Task 16.2: with the made-up summary of the fake line (never written to web/public), every count,
// the "When today wins" heading, the shortcut list and the Sources method lines show the fixture's values.
import { afterEach, describe, expect, it } from 'vitest';
import * as C from '../../src/copy/copy';
import { cornerName } from '../../src/data/lookup';
import { formatCount } from '../../src/format/count';
import { shortClock } from '../../src/format/time';
import { FIXTURE_DIR, fixtureData } from '../support/fixture';
import { bootPage } from '../support/page';
import { realData } from '../support/realdata';
import { text } from '../support/render';

const { index, summary } = fixtureData();
const pair = index.pairs[0]!;

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
});

const sheet = (): HTMLElement => document.querySelector<HTMLElement>('.sheet:not([aria-hidden])')!;
const click = (selector: string): void => document.querySelector<HTMLElement>(selector)!.click();

describe('every count on the card and in the sheet is the made-up summary\'s (Req 13.4, 16.6)', () => {
  const expected: Record<string, number> = {
    'count-races': summary.races,
    'count-wins-1938': summary.wins_1938,
    'count-wins-today': summary.wins_today,
    'count-ride-same': summary.ride_same,
    'count-pairs': summary.pairs.length,
    'count-ride-faster': summary.ride_faster_today,
    'count-ride-slower': summary.ride_slower_today,
  };

  it('shows only fixture values on every count button, in each result, with the heading open', async () => {
    await bootPage({ motion: 'reduced', folder: FIXTURE_DIR, leadPair: pair, query: `?from=${pair.origin}&to=${pair.dest}` });
    click('#card-scroll [data-action="whentoday"]');
    const buttons = [...document.querySelectorAll<HTMLElement>('button.num[data-source^="count-"]')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      const id = b.dataset['source']!;
      expect(expected, id).toHaveProperty(id);
      expect(text(b), id).toBe(formatCount(expected[id]!));
    }
    // The fixture's counts differ from the real file's, so none of these is a leftover real value.
    const real = realData().summary;
    expect(summary.races).not.toBe(real.races);
    expect(summary.wins_today).not.toBe(real.wins_today);
  });
});

describe('the made-up summary drives the counts, the heading and the method lines', () => {
  it('shows the fixture\'s values in the heading, the shortcut list and every Sources row', async () => {
    await bootPage({ motion: 'reduced', folder: FIXTURE_DIR, leadPair: pair, query: `?from=${pair.origin}&to=${pair.dest}` });
    click('#card-scroll [data-action="whentoday"]');
    expect(text(sheet().querySelector('.whentoday-heading'))).toBe(C.whenTodayWinsHeading(formatCount(summary.wins_today)));
    expect(sheet().querySelectorAll('.today-win')).toHaveLength(summary.today_wins.length);
    expect([...sheet().querySelectorAll('.today-win')].map(text)).toEqual(
      summary.today_wins.map((w) => C.todayWinEntry(cornerName(index, w.origin)!, cornerName(index, w.dest)!, shortClock(w.t))),
    );
    const heading = sheet().querySelector<HTMLElement>('.whentoday-heading button.num')!;
    expect(heading.dataset['source']).toBe('count-wins-today');

    click('.sheet:not([aria-hidden]) button.num[data-source="count-ride-same"]');
    const row = (id: string): HTMLElement => sheet().querySelector<HTMLElement>(`.source-row[data-source="${id}"]`)!;
    const verdicts = C.methodRideVerdicts(String(summary.ride_same_rule.minutes), String(summary.ride_same_rule.fraction_pct));
    const covered = [
      ['count-races', summary.races],
      ['count-wins-1938', summary.wins_1938],
      ['count-wins-today', summary.wins_today],
    ] as const;
    for (const [id, n] of covered) {
      expect(text(row(id).querySelector('.source-value')), id).toBe(formatCount(n));
      expect(text(row(id).querySelector('.source-method')), id).toBe(C.METHOD_RACE_COUNTS);
    }
    const verdictCounts = [
      ['count-ride-same', summary.ride_same],
      ['count-pairs', summary.pairs.length],
      ['count-ride-faster', summary.ride_faster_today],
      ['count-ride-slower', summary.ride_slower_today],
    ] as const;
    for (const [id, n] of verdictCounts) {
      expect(text(row(id).querySelector('.source-value')), id).toBe(formatCount(n));
      expect(text(row(id).querySelector('.source-method')), id).toBe(verdicts);
      // The tolerance is plain text in the line, not a number button.
      expect(row(id).querySelector('.source-method button'), id).toBeNull();
      expect(row(id).querySelector('.source-method .num'), id).toBeNull();
    }
    expect(verdicts).toContain('2.5');
    expect(verdicts).toContain('20%');
  });
});
