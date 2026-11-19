// Screenshots of the screen states built so far, named after the mockup each one
// matches, for side-by-side review with docs/planning/ui-mockups/; and the
// dev-only vehicle sheet.
// Run from web/:  npm run screens      PNGs go to test-results/screens/ (git-ignored).
//
// The page reads the real files in web/public/data from the dev server. The
// start time comes from the page's own rule (the New York time of day, or 10:00
// outside the slider range), so each state sets the browser clock. Racing
// states run on Playwright's fake clock, paused, and advance it to the moment
// of the mockup; finished states use the device's reduced-motion setting, which
// draws the finished state at once. Phone pictures are taken at 2x, like the
// phone mockups (750 x 1334).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Browser, type Page, expect, test } from '@playwright/test';
import { FONT_SIZES, ROUTE_NUMBER_MIN_WIDTH, TIMINGS } from '../../src/config';
import { routeNumberOf } from '../../src/format/line';

const OUT = resolve(import.meta.dirname, '..', '..', 'test-results', 'screens');
const INDEX = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', '..', 'public', 'data', 'index.json'), 'utf8'));

const PHONE = { width: 375, height: 667, deviceScaleFactor: 2 };
const DESKTOP = { width: 1280, height: 800, deviceScaleFactor: 1 };

/** A New York wall time on the service date. */
const newYork = (hhmm: string): Date => new Date(`${INDEX.service_date}T${hhmm}:00-05:00`);
/** Half a minute before: the fake clock is installed there, so pausing at the wall time is never in its past, however slow the machine. */
const beforeNewYork = (hhmm: string): Date => new Date(newYork(hhmm).getTime() - 30_000);
const slug = (name: string): string => INDEX.corners.find((c: { name: string }) => c.name === name).slug;
const westToPreston = `?from=${slug('Westwood & Carey')}&to=${slug('Preston & Caroline')}`;

/** Real milliseconds of race before the picture: 2 s is 8 scheduled minutes ("10:08 scheduled"). */
const TEN_OH_EIGHT = 2000;

type State = {
  file: string;
  size: typeof PHONE;
  at: string;
  query?: string;
  /** A racing state: this many real milliseconds into the race (0 is the pause before it starts). */
  racing?: number;
};

const STATES: State[] = [
  // 20:00 is outside the slider range, so the start falls back to 10:00 (mockups 01 to 03, 13 to 15).
  { file: '01-firstload', size: PHONE, at: '20:00', racing: 0 },
  { file: '02-racing', size: PHONE, at: '20:00', racing: TEN_OH_EIGHT },
  { file: '13-desktop-firstload', size: DESKTOP, at: '20:00', racing: 0 },
  { file: '14-desktop-racing', size: DESKTOP, at: '20:00', racing: TEN_OH_EIGHT },
  { file: '03-wins1938', size: PHONE, at: '20:00' },
  { file: '15-desktop-wins1938', size: DESKTOP, at: '20:00' },
  { file: '04-todaywins', size: PHONE, at: '11:23', query: westToPreston },
  { file: '16-desktop-todaywins', size: DESKTOP, at: '11:23', query: westToPreston },
  { file: '05-photofinish', size: PHONE, at: '10:30' },
  { file: '12-reducedmotion', size: PHONE, at: '12:00' },
];

async function fontsReady(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('600 24px "Barlow Condensed"'))).toBe(true);
}

async function shoot(browser: Browser, state: State): Promise<void> {
  const racing = state.racing !== undefined;
  const context = await browser.newContext({
    viewport: { width: state.size.width, height: state.size.height },
    deviceScaleFactor: state.size.deviceScaleFactor,
    reducedMotion: racing ? 'no-preference' : 'reduce',
  });
  const page = await context.newPage();
  if (racing) {
    // A paused fake clock: nothing moves until the test runs it forward.
    await page.clock.install({ time: beforeNewYork(state.at) });
    await page.clock.pauseAt(newYork(state.at));
  } else {
    await page.clock.setFixedTime(newYork(state.at));
  }
  await page.goto(`./${state.query ?? ''}`);
  await page.locator(racing ? '.clock-row' : '.result').waitFor();
  await fontsReady(page);
  if (racing && state.racing) {
    await page.clock.runFor(TIMINGS.racePauseMs);
    await page.clock.runFor(state.racing + 20);
    await expect(page.locator('.result')).toHaveCount(0);
  }
  // CSS animations run on the real clock: finite ones (the trolley's fade-in) are shown at their end, loops at rest.
  await page.screenshot({ path: resolve(OUT, `${state.file}.png`), animations: 'disabled' });
  // Nothing scrolls sideways at the design sizes.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await context.close();
}

for (const state of STATES) {
  test(`${state.file} (${state.size.width} x ${state.size.height})`, async ({ browser }) => shoot(browser, state));
}

// R1.2 (Emmanuel, Nov 19): on a 375 x 667 phone, during the race, both lanes,
// their status lines and the clock row are fully visible above the pinned
// button strip, which is solid --panel with the card scrolling under it.
test('phone race layout: lanes, status lines and clock row clear of the button strip (375 x 667)', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: PHONE.width, height: PHONE.height } });
  const page = await context.newPage();
  await page.clock.install({ time: beforeNewYork('20:00') });
  await page.clock.pauseAt(newYork('20:00'));
  await page.goto('./');
  await page.locator('.clock-row').waitFor();
  await fontsReady(page);
  const panel = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--panel').trim());
  // The start, 10:08 scheduled, just after the trolley arrives and the result shows, and just before the finish.
  const moments = [0, TIMINGS.racePauseMs + TEN_OH_EIGHT, TIMINGS.racePauseMs + 4200, TIMINGS.racePauseMs + 11000];
  let at = 0;
  for (const moment of moments) {
    await page.clock.runFor(moment - at);
    at = moment;
    await expect(page.locator('.clock-row')).toHaveCount(1);
    const layout = await page.evaluate(() => {
      const strip = document.getElementById('card-buttons')!;
      const card = document.getElementById('card-scroll')!;
      const boxes = [...document.querySelectorAll<HTMLElement>('.lane, .lane .status:not([hidden]), .lane .legend:not([hidden]), .clock-row')].map(
        (el) => ({ name: el.className, top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom }),
      );
      const style = getComputedStyle(strip);
      return {
        stripTop: strip.getBoundingClientRect().top,
        cardTop: card.getBoundingClientRect().top,
        cardScroll: card.scrollTop,
        stripBackground: style.backgroundColor,
        stripPosition: style.position,
        result: document.querySelector('.result') !== null,
        boxes,
      };
    });
    expect(layout.cardScroll).toBe(0);
    expect(layout.boxes.length).toBeGreaterThanOrEqual(5);
    for (const box of layout.boxes) {
      expect(box.top, `${box.name} at ${moment} ms`).toBeGreaterThanOrEqual(layout.cardTop);
      expect(box.bottom, `${box.name} at ${moment} ms`).toBeLessThanOrEqual(layout.stripTop);
    }
    expect(layout.stripPosition).toBe('absolute');
    expect(layout.stripBackground).toBe(hexToRgb(panel));
    if (moment === TIMINGS.racePauseMs + 4200) expect(layout.result).toBe(true);
  }
  await context.close();
});

// R1.3 (Emmanuel, Nov 19): on desktop the pair names stay on one line, the font
// shrinking as far as a long pair needs. Every pair is tried, the longest included.
test('desktop pair names on one line, for every pair (1280 x 800)', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: DESKTOP.width, height: DESKTOP.height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const names = new Map<string, string>(INDEX.corners.map((c: { slug: string; name: string }) => [c.slug, c.name]));
  const pairs: { origin: string; dest: string }[] = INDEX.pairs;
  const length = (p: { origin: string; dest: string }): number => `${names.get(p.origin)} → ${names.get(p.dest)}`.length;
  const longest = [...pairs].sort((a, b) => length(b) - length(a))[0]!;
  let longestSize = 0;
  for (const pair of pairs) {
    await page.goto(`./?from=${pair.origin}&to=${pair.dest}`);
    await page.locator('.result').waitFor();
    await fontsReady(page);
    // The page fits the names again once the font has loaded.
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    const row = await page.evaluate(() => {
      const el = document.getElementById('pair-names')!;
      const origin = document.getElementById('origin-name')!.getBoundingClientRect();
      const dest = document.getElementById('dest-name')!.getBoundingClientRect();
      return { scroll: el.scrollWidth, client: el.clientWidth, sameLine: origin.top === dest.top, size: parseFloat(getComputedStyle(el).fontSize) };
    });
    const label = `${pair.origin} → ${pair.dest}`;
    expect(row.scroll, label).toBeLessThanOrEqual(row.client);
    expect(row.sameLine, label).toBe(true);
    expect(row.size, label).toBeGreaterThanOrEqual(FONT_SIZES.desktop.cornerNamesMin);
    expect(row.size, label).toBeLessThanOrEqual(FONT_SIZES.desktop.cornerNames);
    if (pair === longest) longestSize = row.size;
  }
  // The longest pair fits too, at a size no larger than the token's.
  expect(longestSize).toBeGreaterThan(0);
  await context.close();
});

/** "#rrggbb" as the browser reports a computed colour. */
function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)!;
  return `rgb(${parseInt(m[1]!, 16)}, ${parseInt(m[2]!, 16)}, ${parseInt(m[3]!, 16)})`;
}

// The vehicle sheet reads the real index.json from the dev server, so the
// trolleys carry the line's real route number, from the data.
test('vehicle sheet (dev only), beside mockup 18', async ({ browser }) => {
  const expected = routeNumberOf(INDEX.line);
  expect(expected).not.toBeNull();

  const context = await browser.newContext({ viewport: { width: 1280, height: 420 } });
  const page = await context.newPage();
  await page.goto('./dev/vehicles.html');
  await page.locator('#sheet figure').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(OUT, 'vehicles.png'), fullPage: true });
  expect(await page.locator('#sheet [data-vehicle]').count()).toBe(9);
  // Trolleys from the cut-off width up carry the number from the data; narrower ones and the data-error one do not.
  const widths = await page
    .locator('#sheet [data-vehicle="trolley"] .trolley-art')
    .evaluateAll((svgs) => svgs.map((s) => Number(s.getAttribute('width'))));
  const numbered = widths.filter((w) => w >= ROUTE_NUMBER_MIN_WIDTH).length;
  expect(numbered).toBeGreaterThan(0);
  const numbers = await page.locator('#sheet [data-part="route-number"]').allTextContents();
  expect(numbers).toEqual(Array(numbered).fill(expected));
  await context.close();
});
