// Task 13.2: the Scheduled departures section (story-layer Req 11.1 to 11.5). Real data, the page booted
// with reduced motion so the card is drawn finished. Expected times and counts are read from the race file.
import { afterEach, describe, expect, it } from 'vitest';
import { BOARD, LEAD_PAIR } from '../../src/config';
import * as C from '../../src/copy/copy';
import { rowAt } from '../../src/data/lookup';
import { dropSeconds, shortClock } from '../../src/format/time';
import type { Layout } from '../../src/view/vehicles';
import { bootPage } from '../support/page';
import { raceOf } from '../support/realdata';
import { text } from '../support/render';

const lead = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
});

const toggle = (): HTMLButtonElement => document.querySelector<HTMLButtonElement>('[data-action="departures"]')!;
const region = (): HTMLElement => document.getElementById(toggle().getAttribute('aria-controls')!)!;
const cardNumbers = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('#card-scroll button.num')];

for (const layout of ['phone', 'desktop'] as Layout[]) {
  describe(`the departures section on the ${layout} layout`, () => {
    it('is closed by default, with the section button named "Scheduled departures"', async () => {
      const app = await bootPage({ motion: 'reduced', layout });
      expect(app.store.get().departuresOpen).toBe(false);
      expect(toggle()).not.toBeNull();
      expect(text(toggle())).toBe(C.DEPARTURES_BUTTON);
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(region().hidden).toBe(true);
      expect(region().querySelector('.board')).not.toBeNull();
    });

    it('toggles aria-expanded and the region with each press', async () => {
      const app = await bootPage({ motion: 'reduced', layout });
      toggle().click();
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(region().hidden).toBe(false);
      expect(app.store.get().departuresOpen).toBe(true);
      toggle().click();
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(region().hidden).toBe(true);
      expect(app.store.get().departuresOpen).toBe(false);
    });

    it('labels the rows and the header, and lists exactly the race file\'s next cars and buses', async () => {
      await bootPage({ motion: 'reduced', layout });
      toggle().click();
      const race = raceOf(lead);
      const row = rowAt(race, '10:00')!;
      const from = race.y1938.passes.indexOf(row.y1938.dep);
      const cars = race.y1938.passes.slice(from, from + BOARD.cars1938).map(shortClock);
      const buses = race.today.trips.slice(row.today!.trip, row.today!.trip + BOARD.buses).map((t) => shortClock(dropSeconds(t.dep)));
      expect(text(region().querySelector('.board-head'))).toBe(C.boardHeader(shortClock(row.start)));
      expect(text(region().querySelector('.board-row-1938 .board-label'))).toBe(C.BOARD_1938);
      expect(text(region().querySelector('.board-row-today .board-label'))).toBe(C.BOARD_TODAY);
      const chips = (side: string): string[] => [...region().querySelectorAll(`.board-row-${side} .chip`)].map(text);
      expect(chips('1938')).toEqual(cars);
      expect(chips('today')).toEqual(buses);
      expect(cars).toHaveLength(BOARD.cars1938);
      expect(buses).toHaveLength(BOARD.buses);
    });

    it('makes every time and gap in the open section a number button with a source row', async () => {
      const app = await bootPage({ motion: 'reduced', layout });
      toggle().click();
      const chips = [...region().querySelectorAll<HTMLElement>('.chip')];
      const gaps = [...region().querySelectorAll<HTMLElement>('.board-gaps')];
      expect(chips.length).toBe(BOARD.cars1938 + BOARD.buses);
      expect(gaps).toHaveLength(2);
      for (const el of [...chips, ...gaps]) {
        expect(el.matches('button.num'), text(el)).toBe(true);
        expect(app.registry.get(el.dataset['source']!), el.dataset['source']).toBeDefined();
      }
      // No time or gap in the section is loose text.
      const walker = document.createTreeWalker(region(), NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement!;
        if (el.closest('button.num, .board-head')) continue;
        expect((n.textContent ?? '').replace(/\b1938\b/g, ''), text(el)).not.toMatch(/\d/);
      }
    });

    it('registers a Sources row for every number button on the card, with the section closed and open (P3)', async () => {
      const app = await bootPage({ motion: 'reduced', layout });
      for (const open of [false, true]) {
        if (open) toggle().click();
        const buttons = cardNumbers();
        const board = buttons.filter((b) => b.closest('.departures'));
        expect(board.length).toBeGreaterThan(0);
        for (const b of buttons) expect(app.registry.get(b.dataset['source']!), `${b.dataset['source']} open=${open}`).toBeDefined();
        // Every registered source that starts with board- has its button in the section.
        for (const spec of app.registry.list().filter((s) => s.id.startsWith('board-'))) {
          expect(document.querySelector(`.departures button.num[data-source="${spec.id}"]`), spec.id).not.toBeNull();
        }
      }
    });
  });
}
