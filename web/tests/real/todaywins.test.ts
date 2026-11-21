// @vitest-environment jsdom
// Task 12.2: "Show a race today wins" on the real files (story-layer Req 10.4, 10.5, 16.6).
// One press per summary.today_wins entry (the count read from the file), then one more to show the wrap.
// Each press: the address equals encode(pair), the notice shows, and the race played on fake timers ends
// in the result the entry's own race-file row stores, which is "today". Nothing is typed in.
import { afterEach, describe, expect, it } from 'vitest';
import { TIMINGS } from '../../src/config';
import * as C from '../../src/copy/copy';
import { cornerName } from '../../src/data/lookup';
import { encode } from '../../src/format/share';
import { label12, minutesOf } from '../../src/format/time';
import { bootPage } from '../support/page';
import { raceOf, realData } from '../support/realdata';
import { text } from '../support/render';
import { fakeTime } from '../support/time';

const { index, summary } = realData();
const settle = async (): Promise<void> => {
  for (let k = 0; k < 5; k += 1) await new Promise((done) => setTimeout(done, 0));
};

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
  window.history.replaceState(null, '', '/');
});

describe('the today-win shortcut on the real summary', () => {
  it('each press, then one more: address, notice, and a race that ends "today"', { timeout: 120_000 }, async () => {
    const list = summary.today_wins;
    expect(list.length).toBeGreaterThan(0);
    const time = fakeTime();
    const app = await bootPage({ time });
    // Let the first guided race run out, so the card is idle and each press starts from a card on screen.
    time.advance(TIMINGS.orientationMs + 30_000);
    await settle();
    const press = (): void => document.querySelector<HTMLElement>('[data-action="next-today-win"]')!.click();

    for (let k = 0; k <= list.length; k += 1) {
      const entry = list[k % list.length]!;
      const pair = { origin: entry.origin, dest: entry.dest };
      press();
      await settle();
      time.advance(TIMINGS.racePauseMs + 30_000);
      await settle();
      time.advance(30_000);

      const label = `press ${k + 1} (${entry.origin} to ${entry.dest} at ${entry.t})`;
      const state = app.store.get();
      expect(state.pair, label).toEqual(pair);
      expect(state.minute, label).toBe(minutesOf(entry.t));
      expect(window.location.search, label).toBe(encode(pair));
      expect(text(document.querySelector('.notice[data-notice="today-win"]')), label).toBe(
        C.todayWinNotice(cornerName(index, entry.origin)!, cornerName(index, entry.dest)!, label12(entry.t)),
      );
      const row = raceOf(pair).races.find((r) => r.t === entry.t);
      expect(row, `${label}: a row in the race file`).toBeDefined();
      expect(row!.result, label).toBe('today');
      expect(state.race.phase, label).toBe('finished');
      expect(document.querySelector('.result')?.getAttribute('data-result'), label).toBe(row!.result);
    }
  });
});
