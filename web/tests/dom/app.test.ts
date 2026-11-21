// Task 10.5: the first running page loads the lead pair from web/public/data and
// shows its finished state, every number a button. Since task 11 the first race
// plays by itself first, so these tests run it to the finish on a fake clock.
import { afterEach, describe, expect, it } from 'vitest';
import { FALLBACK_START, LEAD_PAIR, TIMINGS } from '../../src/config';
import * as C from '../../src/copy/copy';
import { cornerName } from '../../src/data/lookup';
import { routeNumberOf, yearOf } from '../../src/format/line';
import { label12, minutesOf } from '../../src/format/time';
import { MAX_SECONDS } from '../../src/play/timeline';
import { realData, slugNamed } from '../support/realdata';
import { type PageOptions, bootPage } from '../support/page';
import { text } from '../support/render';
import { fakeTime } from '../support/time';

const { index } = realData();

/** Boot the page and let the first race run to its finish: it starts by itself and lasts at most 12 s. */
async function bootFinished(options: PageOptions = {}) {
  const time = fakeTime();
  const app = await bootPage({ ...options, time });
  // A guided first visit waits for the orientation line first (story-layer Req 4.1); a linked visit waits 300 ms.
  time.advance(TIMINGS.orientationMs + (MAX_SECONDS + 1) * 1000);
  expect(app.store.get().race.phase).toBe('finished');
  return app;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the first running page', () => {
  it('shows the lead pair at the fallback start, finished, with the line label from index.json', async () => {
    const app = await bootFinished();
    expect(app.store.get().data.status).toBe('ready');
    expect(text(document.getElementById('origin-name'))).toBe(cornerName(index, LEAD_PAIR.origin));
    expect(text(document.getElementById('dest-name'))).toBe(cornerName(index, LEAD_PAIR.dest));
    expect(document.querySelector<HTMLInputElement>('#start-time')?.value).toBe(String(minutesOf(FALLBACK_START)));
    expect(text(document.querySelector('.slider-time'))).toBe(label12(FALLBACK_START));
    const label = document.getElementById('line-label')!;
    expect(label.hidden).toBe(false);
    expect(text(label)).toBe(C.lineLabel(routeNumberOf(index.line)!, yearOf(index.effective)!));
    expect(document.querySelector('.result')).not.toBeNull();
    expect(document.getElementById('loading-line')).toBeNull();
  });

  it('puts the two buttons under the card and the footer line', async () => {
    await bootPage();
    expect([...document.querySelectorAll('#card-buttons button')].map(text)).toEqual([C.SOURCES, C.SHARE_THIS_RACE]);
    expect([...document.getElementById('card-footer')!.children].map(text)).toEqual([C.ABOUT_AND_CREDITS, C.FOOTER_LINE]);
  });

  it('registers a source for every number button on the page', async () => {
    const app = await bootFinished();
    const buttons = [...document.querySelectorAll<HTMLElement>('button.num')];
    expect(buttons.length).toBeGreaterThan(10);
    for (const b of buttons) expect(app.registry.get(b.dataset['source']!), b.dataset['source']).toBeDefined();
  });

  it('starts at the New York time of day when it is inside the slider range, and says so', async () => {
    // A clock-derived start needs a valid share link (story-layer Req 3.3); with no query the visit is guided at 10:00.
    await bootPage({ query: `?from=${LEAD_PAIR.origin}&to=${LEAD_PAIR.dest}`, now: new Date('2026-11-04T11:23:40-05:00') });
    expect(document.querySelector<HTMLInputElement>('#start-time')?.value).toBe(String(minutesOf('11:23')));
    expect(text(document.querySelector('.schedule'))).toContain(C.START_IS_NOW);
  });

  it('opens a shared pair from the address', async () => {
    const origin = slugNamed('Westwood & Carey');
    const dest = slugNamed('Preston & Caroline');
    const app = await bootPage({ query: `?from=${origin}&to=${dest}` });
    expect(app.store.get().pair).toEqual({ origin, dest });
    expect(text(document.getElementById('origin-name'))).toBe(cornerName(index, origin));
  });

  it('falls back to the lead pair when the address names corners that are not on the line', async () => {
    const app = await bootPage({ query: '?from=nowhere&to=elsewhere' });
    expect(app.store.get().pair).toEqual({ origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest });
    expect(app.store.get().data.status).toBe('ready');
  });

  it('never puts a slug that is not slug-shaped into a file path', async () => {
    const app = await bootPage({ query: '?from=..%2F..%2Fsecret&to=aliceanna-bond' });
    expect(app.store.get().pair).toEqual({ origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest });
  });

  it('moves the start by one minute with minus and plus, and with the slider', async () => {
    await bootPage();
    const start = minutesOf(FALLBACK_START);
    document.querySelector<HTMLButtonElement>('[data-action="plus"]')!.click();
    expect(document.querySelector<HTMLInputElement>('#start-time')?.value).toBe(String(start + 1));
    document.querySelector<HTMLButtonElement>('[data-action="minus"]')!.click();
    document.querySelector<HTMLButtonElement>('[data-action="minus"]')!.click();
    expect(document.querySelector<HTMLInputElement>('#start-time')?.value).toBe(String(start - 1));
    const input = document.querySelector<HTMLInputElement>('#start-time')!;
    input.value = String(minutesOf('12:00'));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text(document.querySelector('.slider-time'))).toBe(label12('12:00'));
  });

  it('shows the data error, with no number anywhere and the corner names kept, when a file fails', async () => {
    const app = await bootPage({ fail: new Set(['summary.json']) });
    expect(app.store.get().data.status).toBe('error');
    const box = document.querySelector('.data-error')!;
    // Task 15.4: the trolley is drawn too (mockup 09), dim and without its route number (R14.1).
    const art = box.querySelector('.data-error-art')!;
    expect(art.querySelector('[data-vehicle="trolley"]')).not.toBeNull();
    expect(art.querySelector('[data-part="route-number"]')).toBeNull();
    expect([...box.children].filter((c) => c !== art).map(text)).toEqual([C.DATA_ERROR, C.DATA_INCOMPLETE, C.TRY_AGAIN]);
    expect(document.getElementById('line-label')!.hidden).toBe(true);
    // The card and the top bar hold no digit. (The desktop headline's approved second line names
    // the year 1938 in its wording; whether P7 covers it is open for task 15.6.)
    for (const id of ['race-card', 'topbar']) {
      const t = text(document.getElementById(id));
      expect(t.replace(/\d/g, ''), id).toBe(t);
    }
    expect(text(document.getElementById('origin-name'))).toBe(cornerName(index, LEAD_PAIR.origin));
  });
});
