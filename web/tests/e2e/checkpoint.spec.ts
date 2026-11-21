// Story-layer checkpoint (task 18): the lead race at three moments on a phone and on a laptop.
// Pictures go to test-results/screens/ (git-ignored): checkpoint-<size>-<moment>.png, full page.
// Run from web/:  npx playwright test tests/e2e/checkpoint.spec.ts --project=checkpoint
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { TIMINGS } from '../../src/config';
import { DESKTOP, PHONE, beforeNewYork, fontsReady, guardNetwork, newYork } from './support';

const OUT = resolve(import.meta.dirname, '..', '..', 'test-results', 'screens');

// Real ms after load on a guided visit: the orientation pause, then 1 s per 4 scheduled minutes.
const MOMENTS = [
  { name: '1000-start', racing: TIMINGS.orientationMs + 100 },
  { name: '1008', racing: TIMINGS.orientationMs + 2000 },
  { name: 'finished', racing: undefined },
];

for (const [label, size] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
  for (const moment of MOMENTS) {
    test(`${label} ${moment.name}`, async ({ browser }) => {
      const racing = moment.racing !== undefined;
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: size.deviceScaleFactor,
        reducedMotion: racing ? 'no-preference' : 'reduce',
      });
      await guardNetwork(context, true);
      const page = await context.newPage();
      if (racing) {
        await page.clock.install({ time: beforeNewYork('20:00') });
        await page.clock.pauseAt(newYork('20:00'));
      } else {
        await page.clock.setFixedTime(newYork('20:00'));
      }
      await page.goto('./');
      await page.locator(racing ? '.clock-row' : '.result').waitFor();
      await fontsReady(page);
      if (racing) await page.clock.runFor(moment.racing! + 20);
      await page.screenshot({ path: resolve(OUT, `checkpoint-${label}-${moment.name}.png`), fullPage: true, animations: 'disabled' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log(`${label} ${moment.name}: sideways overflow ${overflow}px`);
      await context.close();
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}
