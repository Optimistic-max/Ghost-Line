// Screenshots of the screen states built so far, named after the mockup each one
// matches, for side-by-side review with docs/planning/ui-mockups/; and the
// dev-only vehicle sheet.
// Run from web/:  npm run screens      PNGs go to test-results/screens/ (git-ignored).
//
// The page reads the real files in web/public/data from the dev server. The
// start time comes from the page's own rule (the New York time of day, or 10:00
// outside the slider range), so each state fixes the browser clock. Phone
// pictures are taken at 2x, like the phone mockups (750 x 1334).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Browser, expect, test } from '@playwright/test';
import { ROUTE_NUMBER_MIN_WIDTH } from '../../src/config';
import { routeNumberOf } from '../../src/format/line';

const OUT = resolve(import.meta.dirname, '..', '..', 'test-results', 'screens');
const INDEX = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', '..', 'public', 'data', 'index.json'), 'utf8'));

const PHONE = { width: 375, height: 667, deviceScaleFactor: 2 };
const DESKTOP = { width: 1280, height: 800, deviceScaleFactor: 1 };

/** A New York wall time on the service date. */
const newYork = (hhmm: string): Date => new Date(`${INDEX.service_date}T${hhmm}:00-05:00`);
const slug = (name: string): string => INDEX.corners.find((c: { name: string }) => c.name === name).slug;

type State = { file: string; size: typeof PHONE; at: string; query?: string };

const STATES: State[] = [
  // 20:00 is outside the slider range, so the start falls back to 10:00 (mockups 03 and 15).
  { file: '03-wins1938', size: PHONE, at: '20:00' },
  { file: '15-desktop-wins1938', size: DESKTOP, at: '20:00' },
  {
    file: '04-todaywins',
    size: PHONE,
    at: '11:23',
    query: `?from=${slug('Westwood & Carey')}&to=${slug('Preston & Caroline')}`,
  },
  {
    file: '16-desktop-todaywins',
    size: DESKTOP,
    at: '11:23',
    query: `?from=${slug('Westwood & Carey')}&to=${slug('Preston & Caroline')}`,
  },
  { file: '05-photofinish', size: PHONE, at: '10:30' },
];

async function shoot(browser: Browser, state: State): Promise<void> {
  const context = await browser.newContext({ viewport: { width: state.size.width, height: state.size.height }, deviceScaleFactor: state.size.deviceScaleFactor });
  const page = await context.newPage();
  await page.clock.setFixedTime(newYork(state.at));
  await page.goto(`./${state.query ?? ''}`);
  await page.locator('.result').waitFor();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('600 24px "Barlow Condensed"'))).toBe(true);
  await page.screenshot({ path: resolve(OUT, `${state.file}.png`) });
  // Nothing scrolls sideways at the design sizes.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await context.close();
}

for (const state of STATES) {
  test(`${state.file} (${state.size.width} x ${state.size.height})`, async ({ browser }) => shoot(browser, state));
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
