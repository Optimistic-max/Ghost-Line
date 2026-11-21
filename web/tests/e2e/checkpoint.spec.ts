// Story-layer checkpoint (task 18): the lead race at three moments on a phone and on a laptop.
// Pictures go to test-results/screens/ (git-ignored): checkpoint-<size>-<moment>.png, full page.
// Run from web/:  npx playwright test tests/e2e/checkpoint.spec.ts --project=checkpoint
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { MAP_LAYOUT, TIMINGS } from '../../src/config';
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

// The result box is fully inside the viewport, without scrolling, when it appears (the start-time chart
// sits below the next-step actions, so it never pushes the result down).
const inside = (r: { x: number; y: number; width: number; height: number }, size: { width: number; height: number }): boolean =>
  r.x >= 0 && r.y >= 0 && r.x + r.width <= size.width && r.y + r.height <= size.height;

for (const [label, size] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
  test(`${label} result box is inside the viewport, finished`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: 'reduce' });
    await guardNetwork(context, true);
    const page = await context.newPage();
    await page.clock.setFixedTime(newYork('20:00'));
    await page.goto('./');
    await page.locator('.result').waitFor();
    await fontsReady(page);
    const rect = (await page.locator('.result').boundingBox())!;
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    console.log(`${label} finished: result box ${JSON.stringify(rect)} in ${size.width}x${size.height}`);
    expect(inside(rect, size), JSON.stringify(rect)).toBe(true);
    await context.close();
  });

  test(`${label} result box is inside the viewport when it appears at the end of the live race`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: 'no-preference' });
    await guardNetwork(context, true);
    const page = await context.newPage();
    await page.clock.install({ time: beforeNewYork('20:00') });
    await page.clock.pauseAt(newYork('20:00'));
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    await fontsReady(page);
    // The result box shows at the first arrival, while the clock row is still there for the other side.
    // Step the page clock until it is in the DOM, record where it is, then run to the end of the race.
    for (let k = 0; k < 400 && (await page.locator('.result').count()) === 0; k += 1) await page.clock.runFor(100);
    await page.locator('.result').waitFor();
    await page.clock.runFor(1000);
    const atFirstArrival = (await page.locator('.result').boundingBox())!;
    for (let k = 0; k < 400 && (await page.locator('.clock-row').count()) > 0; k += 1) await page.clock.runFor(100);
    await page.clock.runFor(1500);
    const atEnd = (await page.locator('.result').boundingBox())!;
    const overflow = Math.round(atFirstArrival.y + atFirstArrival.height - size.height);
    const note = `${label} live: result box at first arrival ${JSON.stringify(atFirstArrival)} (${overflow > 0 ? `${overflow}px below the viewport` : 'inside'}); at the end of the race ${JSON.stringify(atEnd)}`;
    test.info().annotations.push({ type: 'result-box-position', description: note });
    console.log(note);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // Hard check: at the end of the live race. The first-arrival position is reported above, not asserted
    // (story-layer Req 12.7: report the pixels, keep text sizes).
    expect(inside(atEnd, size), JSON.stringify(atEnd)).toBe(true);
    await context.close();
  });
}

// The phone's route strip: "View route" never covers the route drawing or a corner name, and the trolley
// marker never covers a corner name, with the marker at the origin (before the race) and short of the
// destination (finished).
type Box = { x: number; y: number; width: number; height: number };
const meets = (a: Box, b: Box): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const moment of ['before the race', 'finished'] as const) {
  test(`phone route strip, ${moment}: the button, the drawing, the names and the marker keep apart`, async ({ browser }) => {
    const before = moment === 'before the race';
    const context = await browser.newContext({ viewport: { width: PHONE.width, height: PHONE.height }, reducedMotion: before ? 'no-preference' : 'reduce' });
    await guardNetwork(context, true);
    const page = await context.newPage();
    if (before) {
      await page.clock.install({ time: beforeNewYork('20:00') });
      await page.clock.pauseAt(newYork('20:00'));
    } else {
      await page.clock.setFixedTime(newYork('20:00'));
    }
    await page.goto('./');
    await page.locator('.route-drawing .corner-dot').first().waitFor();
    await page.locator('.drawing-marker:not([hidden])').waitFor();
    await fontsReady(page);
    if (!before) await page.locator('.result').waitFor();
    const m = await page.evaluate(() => {
      const r = (el: Element | null) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      };
      return {
        strip: r(document.querySelector('#map-area')),
        button: r(document.querySelector('.route-toggle')),
        legs: r(document.querySelector('.route-drawing .route-legs')),
        dots: [...document.querySelectorAll('.route-drawing .corner-dot')].map(r),
        names: [...document.querySelectorAll('.route-drawing .corner-name')].map((el) => ({ text: el.textContent, slug: el.getAttribute('data-slug'), box: r(el) })),
        dotsBySlug: [...document.querySelectorAll('.route-drawing .corner')].map((g) => ({ slug: g.getAttribute('data-slug'), box: r(g.querySelector('.corner-dot')) })),
        marker: r(document.querySelector('.drawing-marker svg') ?? document.querySelector('.drawing-marker')),
      };
    });
    console.log(`phone strip ${moment}: ${JSON.stringify(m)}`);
    await context.close();
    expect(m.strip!.height).toBe(100);
    expect(m.button!.width).toBeGreaterThanOrEqual(44);
    expect(m.button!.height).toBeGreaterThanOrEqual(44);
    expect(meets(m.button!, m.legs!), 'button against the route').toBe(false);
    for (const d of m.dots) expect(meets(m.button!, d!), 'button against a corner dot').toBe(false);
    for (const n of m.names) {
      expect(meets(m.button!, n.box!), `button against ${n.text}`).toBe(false);
      expect(meets(m.marker!, n.box!), `marker against ${n.text}`).toBe(false);
      // A shown name is nearer to its own dot than to any other corner's dot, and within the fixed reach
      // (MAP_LAYOUT.phonePreview.nameReach, in the strip's own 375-wide pixels; the strip is drawn 1:1).
      const centre = (b: Box): { x: number; y: number } => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
      const away = (from: { x: number; y: number }, b: Box): number =>
        Math.hypot(Math.max(b.x - from.x, 0, from.x - (b.x + b.width)), Math.max(b.y - from.y, 0, from.y - (b.y + b.height)));
      const own = m.dotsBySlug.find((d) => d.slug === n.slug)!;
      const mine = away(centre(own.box!), n.box!);
      expect(mine, `${n.text} reach`).toBeLessThanOrEqual(MAP_LAYOUT.phonePreview.nameReach + 1);
      for (const d of m.dotsBySlug) if (d.slug !== n.slug) expect(mine, `${n.text} against another dot`).toBeLessThan(away(centre(d.box!), n.box!));
    }
    // Hidden names are allowed; the dots are not hidden.
    expect(m.names.length).toBeLessThanOrEqual(2);
    expect(m.dotsBySlug.length).toBeGreaterThanOrEqual(2);
  });
}
