// Screenshots of the screen at the two design sizes, for side-by-side review with
// docs/planning/ui-mockups/. Run from web/:  npm run screens
// PNGs go to test-results/screens/ (git-ignored).
//
// Every request for the data folder is answered from the made-up fixture in
// tests/fixtures/fake, so no Baltimore data is read and nothing is added to the
// build. Phone pictures are taken at 2x, like the phone mockups (750 x 1334).
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { expect, test } from '@playwright/test';

const FIXTURE = resolve(import.meta.dirname, '..', 'fixtures', 'fake');
const OUT = resolve(import.meta.dirname, '..', '..', 'test-results', 'screens');
const DATA_PATH = '/Ghost-Line/data/';

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
    const served: string[] = [];
    await page.route(`**${DATA_PATH}**`, async (route) => {
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

    await page.goto('./');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(OUT, `shell-${size.name}.png`) });

    // Nothing scrolls sideways at the design sizes.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    test.info().annotations.push({ type: 'fixture files served', description: served.join(', ') || 'none' });
    await context.close();
  });
}
