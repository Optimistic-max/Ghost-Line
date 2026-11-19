// Screenshots of the screen at the two design sizes, and of the dev-only vehicle
// sheet, for side-by-side review with docs/planning/ui-mockups/.
// Run from web/:  npm run screens      PNGs go to test-results/screens/ (git-ignored).
//
// Every request for the data folder is answered from the made-up fixture in
// tests/fixtures/fake, so no Baltimore data is read and nothing is added to the
// build. Phone pictures are taken at 2x, like the phone mockups (750 x 1334).
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { type Page, expect, test } from '@playwright/test';
import { routeNumberOf } from '../../src/format/line';

const FIXTURE = resolve(import.meta.dirname, '..', 'fixtures', 'fake');
const OUT = resolve(import.meta.dirname, '..', '..', 'test-results', 'screens');
const DATA_PATH = '/Ghost-Line/data/';

/** Answer every data request from the fixture. Returns the names served. */
async function serveFixture(page: Page): Promise<string[]> {
  const served: string[] = [];
  await page.route(`**${DATA_PATH}**`, (route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.slice(DATA_PATH.length));
    const file = resolve(FIXTURE, name);
    if (!file.startsWith(FIXTURE + sep)) return route.fulfill({ status: 404 });
    try {
      const body = readFileSync(file);
      served.push(name);
      return route.fulfill({ status: 200, body, contentType: 'application/json' });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });
  return served;
}

const SIZES = [
  { name: 'phone', width: 375, height: 667, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1280, height: 800, deviceScaleFactor: 1 },
] as const;

for (const size of SIZES) {
  test(`shell, ${size.name} ${size.width} x ${size.height}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.deviceScaleFactor,
    });
    const page = await context.newPage();
    const served = await serveFixture(page);

    await page.goto('./');
    await page.evaluate(() => document.fonts.ready);
    // The display face is loaded, not the system fallback.
    expect(await page.evaluate(() => document.fonts.check('600 24px "Barlow Condensed"'))).toBe(true);
    await page.screenshot({ path: resolve(OUT, `shell-${size.name}.png`) });

    // Nothing scrolls sideways at the design sizes.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    test.info().annotations.push({ type: 'fixture files served', description: served.join(', ') || 'none' });
    await context.close();
  });
}

// The vehicle sheet reads the real index.json from the dev server (not the
// fixture), so the trolleys carry the line's real route number, from the data.
test('vehicle sheet (dev only), beside mockup 18', async ({ browser }) => {
  const index = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', '..', 'public', 'data', 'index.json'), 'utf8'));
  const expected = routeNumberOf(index.line);
  expect(expected).not.toBeNull();

  const context = await browser.newContext({ viewport: { width: 1280, height: 420 } });
  const page = await context.newPage();
  await page.goto('./dev/vehicles.html');
  await page.locator('#sheet figure').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(OUT, 'vehicles.png'), fullPage: true });
  expect(await page.locator('#sheet [data-vehicle]').count()).toBe(9);
  // Every trolley carries the number from the data, except the data-error one.
  const trolleys = await page.locator('#sheet [data-vehicle="trolley"]').count();
  const numbers = await page.locator('#sheet [data-part="route-number"]').allTextContents();
  expect(numbers).toEqual(Array(trolleys - 1).fill(expected));
  await context.close();
});
