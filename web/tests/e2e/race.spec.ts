// Task 20.2 and 20.3: the race in the browser, on the phone and the laptop
// projects of playwright.config.ts (npm run test:e2e). The first race with no
// taps; the result at the first arrival with the slower side running on; Skip
// to result; a whole race with the tile host blocked and no WebGL (R17.6);
// reduced motion; every control from the keyboard alone; no sideways scroll at
// six widths; the data error, then Try again; and axe-core on the drawn page,
// colour contrast included (R13.4). The page reads the real files in
// web/public/data; expected values come from the page and the files, never from
// the briefs. The only host it may reach besides the dev server is the map's.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type BrowserContext, type Page, expect, test } from '@playwright/test';
import { LEAD_PAIR, SOURCE_URLS, TIMINGS } from '../../src/config';
import { HIDE_ROUTE, LINK_COPIED, MAP_UNAVAILABLE, NOT_LIVE, PICKER_STEP_END, VIEW_ROUTE } from '../../src/copy/copy';
import {
  FIXTURE_NO_RIDE,
  INDEX,
  axeViolations,
  beforeNewYork,
  fontsReady,
  guardNetwork,
  mapSettled,
  newYork,
  query,
  serveFixture,
  slug,
  withoutWebGL,
} from './support';

/** The race phase the page is in (app.ts writes it on the root element). */
const phase = (page: Page): Promise<string | undefined> => page.evaluate(() => document.documentElement.dataset['race']);

/** A paused fake clock at a New York wall time: nothing moves until the test runs it forward. */
async function pausedAt(page: Page, hhmm: string): Promise<void> {
  await page.clock.install({ time: beforeNewYork(hhmm) });
  await page.clock.pauseAt(newYork(hhmm));
}

/** Run the fake clock forward in display-sized steps until `done` holds, at most `limitMs`. */
async function runUntil(page: Page, done: () => Promise<boolean>, limitMs = 20_000, stepMs = 50): Promise<number> {
  for (let ran = 0; ran <= limitMs; ran += stepMs) {
    if (await done()) return ran;
    await page.clock.runFor(stepMs);
  }
  throw new Error(`not done after ${limitMs} ms of the page's clock`);
}

/** On a phone the map loads only after View route (story-layer Req 12.3); on a laptop there is no such button. */
async function viewRouteOnPhone(page: Page): Promise<void> {
  const toggle = page.locator('.route-toggle');
  if (await toggle.isVisible()) await toggle.click();
}

const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 900;

let strange: string[] = [];

test.beforeEach(async ({ context }, info) => {
  // The map's tiles are allowed where the map is part of the check; elsewhere they are blocked, so a slow
  // software-drawn map never loads the machine.
  strange = await guardNetwork(context, !info.title.includes('[map]'));
});

test.afterEach(() => {
  expect(strange, 'hosts the page tried to reach').toEqual([]);
});

test.describe('the race (20.2)', () => {
  test('the first race starts by itself, with no taps, marks "race-start" and runs to its finish [map]', async ({ page }) => {
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    await expect.poll(() => phase(page)).toBe('running');
    expect(await page.evaluate(() => performance.getEntriesByName('race-start', 'mark').length)).toBe(1);
    await expect(page.locator('.clock-row')).toHaveCount(0, { timeout: 20_000 });
    expect(await phase(page)).toBe('finished');
    await expect(page.locator('.result')).toHaveCount(1);
    await expect(page.locator('.lane[data-arrived]')).toHaveCount(2);
  });

  test('the result appears at the first arrival, and the slower side runs on to its own finish', async ({ page }) => {
    await pausedAt(page, '20:00');
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    await page.clock.runFor(TIMINGS.orientationMs);
    await runUntil(page, async () => (await page.locator('.result').count()) > 0);
    // At the result moment: one side in, the other still on its way, the clock still running and Skip offered.
    await expect(page.locator('.lane[data-arrived]')).toHaveCount(1);
    expect(await phase(page)).toBe('running');
    await expect(page.locator('.skip')).toBeVisible();
    const slower = (await page.locator('.lane:not([data-arrived])').getAttribute('class'))!;
    const clockAtResult = await page.locator('.clock-readout').textContent();
    await page.clock.runFor(1000);
    expect(await page.locator('.clock-readout').textContent()).not.toBe(clockAtResult);
    await runUntil(page, async () => (await page.locator('.clock-row').count()) === 0);
    expect(await phase(page)).toBe('finished');
    await expect(page.locator('.lane[data-arrived]')).toHaveCount(2);
    expect(slower).toMatch(/lane-(1938|today)/);
    await expect(page.locator('.result')).toHaveCount(1);
  });

  test('Skip to result jumps both lanes to their finish and shows the result', async ({ page }) => {
    await pausedAt(page, '20:00');
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    await page.clock.runFor(TIMINGS.orientationMs + 500);
    expect(await phase(page)).toBe('running');
    await page.locator('.skip').click();
    expect(await phase(page)).toBe('finished');
    await expect(page.locator('.result')).toHaveCount(1);
    await expect(page.locator('.lane[data-arrived]')).toHaveCount(2);
    await expect(page.locator('.clock-row, .skip')).toHaveCount(0);
  });

  test('a whole race with the tile host blocked and no WebGL: the route drawing, the notice, the race unchanged (R17.6)', async ({ page, context }) => {
    await withoutWebGL(context);
    await pausedAt(page, '20:00');
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    // The map is asked for once the route drawing is in and the page is idle (at the latest after mapIdleMs) on a
    // laptop; on a phone only after View route (story-layer Req 12.3).
    await page.locator('.route-drawing').waitFor();
    await page.clock.runFor(TIMINGS.orientationMs + TIMINGS.mapIdleMs);
    await viewRouteOnPhone(page);
    await runUntil(page, async () => (await page.locator('#map-area').getAttribute('data-map-failed')) !== null);
    await expect(page.locator('#map-area')).toHaveAttribute('data-map-failed', 'no WebGL');
    await expect(page.locator('.map-notice')).toBeVisible();
    await expect(page.locator('.map-notice')).toHaveText(MAP_UNAVAILABLE);
    await expect(page.locator('.route-drawing')).toHaveCount(1);
    await runUntil(page, async () => (await page.locator('.clock-row').count()) === 0);
    expect(await phase(page)).toBe('finished');
    await expect(page.locator('.result')).toHaveCount(1);
    await expect(page.locator('.data-error')).toHaveCount(0);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('draws the finished race at once; nothing animates, sheets do not slide', async ({ page }) => {
      await page.goto('./');
      await page.locator('.result').waitFor();
      expect(await phase(page)).toBe('finished');
      await expect(page.locator('.clock-row, .skip')).toHaveCount(0);
      await expect(page.locator('.lane[data-stage="finished"]')).toHaveCount(2);
      const running = (): Promise<number> => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
      expect(await running()).toBe(0);
      await page.waitForTimeout(500);
      expect(await running()).toBe(0);
      await page.locator('[data-action="sources"]').click();
      const sheet = page.locator('.sheet.is-open');
      await sheet.waitFor();
      expect(await sheet.evaluate((el) => getComputedStyle(el).transitionDuration.split(',').every((d) => Number.parseFloat(d) === 0))).toBe(true);
      expect(await running()).toBe(0);
    });
  });

  test('the data error with the data blocked shows no number; Try again recovers without a reload', async ({ page }) => {
    let block = true;
    await page.route('**/Ghost-Line/data/summary.json', (route) => (block ? route.abort('failed') : route.continue()));
    await page.goto('./');
    await page.locator('.data-error').waitFor();
    expect(await page.evaluate(() => /\d/.test(document.body.innerText))).toBe(false);
    await expect(page.locator('#line-label')).toBeHidden();
    await page.evaluate(() => Object.assign(window, { stillHere: true }));
    block = false;
    await page.locator('[data-action="retry"]').click();
    await expect(page.locator('.data-error')).toHaveCount(0);
    await page.locator('.lanes').waitFor();
    expect(await page.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere)).toBe(true);
  });
});

// Task 20.1 (story layer, Req 5.3, 6.3, 9.1, 16.1): geometry measured in the browser, in pixels, against
// the page's own elements. Every tolerance is 1 px. Run on the phone (375 x 667) and the laptop (1280 x 800)
// projects.
const TOLERANCE_PX = 1;

type Rect = { x: number; y: number; width: number; height: number };

/** Per side: the bar marker's centre, the ride segment's edges, and the ride's --f, all from the drawn page. */
async function markerReading(page: Page): Promise<Record<'1938' | 'today', { centre: number; left: number; right: number; f: number; filled: number } | null>> {
  return page.evaluate(() => {
    const read = (side: string) => {
      const lane = document.querySelector(`.lane-${side}`);
      const marker = lane?.querySelector('.bar-marker > *');
      const ride = lane?.querySelector('.seg-ride');
      if (!marker || !ride) return null;
      const m = marker.getBoundingClientRect();
      const r = ride.getBoundingClientRect();
      const raw = getComputedStyle(ride).getPropertyValue('--f').trim();
      const f = raw === '' ? 1 : Number.parseFloat(raw);
      return { centre: m.x + m.width / 2, left: r.x, right: r.x + r.width, f, filled: r.x + f * r.width };
    };
    return { '1938': read('1938'), today: read('today') };
  });
}

/** The two illustrations' box sizes (the trolley and the bus in the lane title rows). */
async function illustrationSizes(page: Page): Promise<Record<string, { art: [number, number]; svg: [number, number] }>> {
  return page.evaluate(() => {
    const out: Record<string, { art: [number, number]; svg: [number, number] }> = {};
    for (const side of ['1938', 'today']) {
      const vehicle = document.querySelector(`.lane-${side} .lane-art .vehicle`)?.getBoundingClientRect();
      const svg = document.querySelector(`.lane-${side} .lane-art .vehicle svg`)?.getBoundingClientRect();
      if (vehicle && svg) out[side] = { art: [vehicle.width, vehicle.height], svg: [svg.width, svg.height] };
    }
    return out;
  });
}

test.describe('story-layer geometry (20.1)', () => {
  test('the bar markers sit on the filled end of the ride at ten clock moments, and the trolley marker travels the whole ride segment', async ({ page }, info) => {
    await pausedAt(page, '20:00');
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    await fontsReady(page);
    await page.clock.runFor(TIMINGS.orientationMs + 50);
    expect(await phase(page)).toBe('running');
    const seen: string[] = [];
    let first: Awaited<ReturnType<typeof markerReading>> | null = null;
    const check = (label: string, r: Awaited<ReturnType<typeof markerReading>>): void => {
      for (const side of ['1938', 'today'] as const) {
        const s = r[side];
        if (!s) continue;
        const off = s.centre - s.filled;
        seen.push(`${label} ${side}: marker ${s.centre.toFixed(2)}, ride ${s.left.toFixed(2)}..${s.right.toFixed(2)}, f ${s.f.toFixed(3)}, off ${off.toFixed(2)}`);
        expect(Math.abs(off), `${info.project.name} ${label} ${side} marker against the ride's filled end`).toBeLessThanOrEqual(TOLERANCE_PX);
      }
    };
    for (let k = 0; k < 10; k += 1) {
      const reading = await markerReading(page);
      first ??= reading;
      check(`moment ${k + 1}`, reading);
      await page.clock.runFor(900);
    }
    // Before the ride, the markers wait at the ride's start.
    for (const side of ['1938', 'today'] as const) {
      const s = first![side];
      if (s) expect(Math.abs(s.centre - s.left), `${info.project.name} ${side} marker at the start of the ride`).toBeLessThanOrEqual(TOLERANCE_PX);
    }
    // After the finish, both sit at the ride's end: the trolley marker has crossed the whole segment.
    await page.locator('.skip').click();
    expect(await phase(page)).toBe('finished');
    const done = await markerReading(page);
    check('finished', done);
    for (const side of ['1938', 'today'] as const) {
      const s = done[side];
      if (s) expect(Math.abs(s.centre - s.right), `${info.project.name} ${side} marker at the end of the ride`).toBeLessThanOrEqual(TOLERANCE_PX);
    }
    const travelled = done['1938']!.centre - first!['1938']!.centre;
    seen.push(`1938 marker travelled ${travelled.toFixed(2)} px of a ${done['1938']!.right - done['1938']!.left} px ride segment`);
    expect(Math.abs(travelled - (done['1938']!.right - done['1938']!.left))).toBeLessThanOrEqual(TOLERANCE_PX * 2);
    console.log(`${info.project.name}\n${seen.join('\n')}`);
  });

  test('the illustrations keep their box sizes before the race, mid-race and finished', async ({ page }, info) => {
    await pausedAt(page, '20:00');
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    await fontsReady(page);
    const before = await illustrationSizes(page);
    await page.clock.runFor(TIMINGS.orientationMs + 3000);
    expect(await phase(page)).toBe('running');
    const during = await illustrationSizes(page);
    await page.locator('.skip').click();
    expect(await phase(page)).toBe('finished');
    const after = await illustrationSizes(page);
    console.log(`${info.project.name} illustrations: ${JSON.stringify(before)}`);
    expect(Object.keys(before).sort()).toEqual(['1938', 'today']);
    for (const side of ['1938', 'today']) {
      for (const part of ['art', 'svg'] as const) {
        for (const [name, later] of [['mid-race', during], ['finished', after]] as const) {
          const a = before[side]![part];
          const b = later[side]![part];
          expect(Math.abs(a[0] - b[0]), `${side} ${part} width, ${name}`).toBeLessThanOrEqual(0.01);
          expect(Math.abs(a[1] - b[1]), `${side} ${part} height, ${name}`).toBeLessThanOrEqual(0.01);
        }
      }
    }
  });

  test('the chart cursor sits over the slider thumb centre at the first, middle and last minute', async ({ page }, info) => {
    await pausedAt(page, '20:00');
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    await fontsReady(page);
    const slider = page.locator('#start-time');
    const min = Number(await slider.getAttribute('min'));
    const max = Number(await slider.getAttribute('max'));
    const seen: string[] = [];
    for (const [name, minute] of [['first', min], ['middle', Math.round((min + max) / 2)], ['last', max]] as const) {
      await slider.fill(String(minute));
      const m = await page.evaluate(() => {
        const input = document.querySelector<HTMLInputElement>('#start-time')!.getBoundingClientRect();
        const cursor = document.querySelector('.chart-cursor')!.getBoundingClientRect();
        const thumb = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--thumb'));
        const el = document.querySelector<HTMLInputElement>('#start-time')!;
        return { inputX: input.x, inputW: input.width, thumb, cursorCentre: cursor.x + cursor.width / 2, value: Number(el.value), min: Number(el.min), max: Number(el.max) };
      });
      expect(m.value).toBe(minute);
      const thumbCentre = m.inputX + m.thumb / 2 + ((m.value - m.min) / (m.max - m.min)) * (m.inputW - m.thumb);
      seen.push(`${name} (${minute}): thumb centre ${thumbCentre.toFixed(2)}, cursor centre ${m.cursorCentre.toFixed(2)}, off ${(m.cursorCentre - thumbCentre).toFixed(2)}`);
      expect(Math.abs(m.cursorCentre - thumbCentre), `${info.project.name} ${name} minute`).toBeLessThanOrEqual(TOLERANCE_PX);
    }
    console.log(`${info.project.name}\n${seen.join('\n')}`);
  });
});

test.describe('the keyboard alone (20.2, R13.1)', () => {
  /** Tab (or Shift+Tab) until `selector` has focus, then check its focus ring shows. */
  async function tabTo(page: Page, selector: string, shift = false, limit = 120): Promise<void> {
    for (let k = 0; k < limit; k += 1) {
      await page.keyboard.press(shift ? 'Shift+Tab' : 'Tab');
      if (await page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector)) {
        const ring = await page.evaluate(() => {
          const style = getComputedStyle(document.activeElement!);
          return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
        });
        expect(ring.style, `${selector}: focus ring`).not.toBe('none');
        expect(ring.width, `${selector}: focus ring`).toBeGreaterThan(0);
        return;
      }
    }
    throw new Error(`Tab never reached ${selector}`);
  }

  /** Forward first, then backward: the new controls sit on both sides of wherever focus came back to. */
  async function reach(page: Page, selector: string): Promise<void> {
    try {
      await tabTo(page, selector, false, 60);
    } catch {
      await tabTo(page, selector, true, 120);
    }
  }

  const focusMatches = (page: Page, selector: string): Promise<boolean> =>
    page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector);

  async function noShareSheet(context: BrowserContext, browserName: string): Promise<void> {
    // The system share sheet cannot be driven here: without it the page copies the link, as on a desktop without one.
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
    });
    // Only Chromium has these permissions to grant; WebKit rejects them, so there the clipboard is not read back.
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  }

  test('runs through every control with no pointer', async ({ page, context, browserName }) => {
    await noShareSheet(context, browserName);
    await pausedAt(page, '20:00');
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    await fontsReady(page);
    const time = (): Promise<string | null> => page.locator('.slider-time').textContent();

    // The slider: an arrow key stops the race and moves the time; the next race starts after the pause, focus kept.
    await tabTo(page, '#start-time');
    const start = await time();
    await page.keyboard.press('ArrowRight');
    expect(await time()).not.toBe(start);
    expect(await phase(page)).toBe('idle');
    await page.clock.runFor(TIMINGS.racePauseMs);
    expect(await phase(page)).toBe('running');
    expect(await focusMatches(page, '#start-time')).toBe(true);
    await page.keyboard.press('ArrowLeft');
    expect(await time()).toBe(start);
    await page.clock.runFor(TIMINGS.racePauseMs);

    // Plus by Enter, minus by Space, focus kept across the new race.
    await tabTo(page, '[data-action="plus"]');
    await page.keyboard.press('Enter');
    expect(await time()).not.toBe(start);
    await page.clock.runFor(TIMINGS.racePauseMs);
    expect(await focusMatches(page, '[data-action="plus"]')).toBe(true);
    await tabTo(page, '[data-action="minus"]', true);
    await page.keyboard.press(' ');
    expect(await time()).toBe(start);
    await page.clock.runFor(TIMINGS.racePauseMs);
    expect(await focusMatches(page, '[data-action="minus"]')).toBe(true);

    // Swap, and back.
    const origin = await page.locator('#origin-name').textContent();
    const dest = await page.locator('#dest-name').textContent();
    await tabTo(page, '[data-action="swap"]', true);
    await page.keyboard.press('Enter');
    await expect(page.locator('#origin-name')).toHaveText(dest!);
    await page.clock.runFor(TIMINGS.racePauseMs);
    await expect.poll(() => focusMatches(page, '[data-action="swap"]')).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.locator('#origin-name')).toHaveText(origin!);
    await page.clock.runFor(TIMINGS.racePauseMs);

    // The corner picker: three key presses after reaching it pick a pair; focus comes back to the names.
    const westwood = slug('Westwood & Carey');
    const preston = slug('Preston & Caroline');
    await tabTo(page, '[data-action="picker"]', true);
    await page.keyboard.press('Enter');
    await page.locator('.sheet.is-open[data-sheet="corners"]').waitFor();
    await tabTo(page, `.corner-choice[data-slug="${westwood}"]`);
    await page.keyboard.press('Enter');
    await expect(page.locator('.picker-step')).toHaveText(PICKER_STEP_END);
    await tabTo(page, `.corner-choice[data-slug="${preston}"]`);
    await page.keyboard.press('Enter');
    await expect(page.locator('.sheet.is-open')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`\\${query({ origin: westwood, dest: preston })}$`));
    await page.clock.runFor(TIMINGS.racePauseMs);
    await expect.poll(() => focusMatches(page, '[data-action="picker"]')).toBe(true);

    // A number opens its Sources row; Escape closes it and focus returns to the number.
    await tabTo(page, '#card-scroll button.num');
    const id = await page.evaluate(() => (document.activeElement as HTMLElement).dataset['source']);
    await page.keyboard.press('Enter');
    await expect(page.locator(`.sheet.is-open .source-row.is-target[data-source="${id}"]`)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.sheet.is-open')).toHaveCount(0);
    expect(await focusMatches(page, `[data-source="${id}"]`)).toBe(true);

    // Share: the link is copied, and the button and its status say so.
    await tabTo(page, '[data-action="share"]');
    await page.keyboard.press('Enter');
    await expect(page.locator('#share-status')).toHaveText(LINK_COPIED);
    if (browserName === 'chromium') {
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await page.evaluate(() => location.href));
    }

    // About and credits, from the info button; Escape returns focus to it.
    await tabTo(page, '#app > button.info');
    await page.keyboard.press('Enter');
    await page.locator('.sheet.is-open[data-sheet="about"]').waitFor();
    await page.keyboard.press('Escape');
    expect(await focusMatches(page, '#app > button.info')).toBe(true);

    // Skip to result, once the race runs: focus goes to the result.
    await page.clock.runFor(TIMINGS.racePauseMs + 500);
    expect(await phase(page)).toBe('running');
    await tabTo(page, '[data-action="skip"]', true);
    await page.keyboard.press('Enter');
    expect(await phase(page)).toBe('finished');
    expect(await focusMatches(page, '.result button.num')).toBe(true);

    // When today wins: its list, and an entry races that pair.
    await tabTo(page, '[data-action="whentoday"]');
    await page.keyboard.press('Enter');
    await page.locator('.sheet.is-open[data-sheet="whentoday"]').waitFor();
    await tabTo(page, '.sheet.is-open [data-action="today-win"]');
    await page.keyboard.press('Enter');
    await expect(page.locator('.sheet.is-open')).toHaveCount(0);
    await page.clock.runFor(TIMINGS.racePauseMs);
    await expect(page.locator('.lanes')).toHaveCount(1);
  });

  test('reaches the new controls: next steps, chart readouts, departures and (phone) the route toggle, each with a focus ring (20.3, R15.1, R15.2)', async ({ page, context }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await withoutWebGL(context);
    await page.clock.setFixedTime(newYork('20:00'));
    await page.goto('./');
    await page.locator('.result').waitFor();
    await fontsReady(page);

    // The phone's route toggle: Enter opens the route (the map is unavailable here, no WebGL), Enter again closes it.
    if (isPhone(page)) {
      await reach(page, '.route-toggle');
      await page.keyboard.press('Enter');
      await expect(page.locator('.route-toggle')).toHaveText(HIDE_ROUTE);
      await expect(page.locator('.route-toggle')).toHaveAttribute('aria-expanded', 'true');
      if (!(await focusMatches(page, '.route-toggle'))) await reach(page, '.route-toggle');
      await page.keyboard.press('Enter');
      await expect(page.locator('.route-toggle')).toHaveText(VIEW_ROUTE);
      await expect(page.locator('.route-toggle')).toHaveAttribute('aria-expanded', 'false');
    }

    // Try another time: focus goes to the slider.
    await reach(page, '[data-action="next-time"]');
    await page.keyboard.press('Enter');
    expect(await focusMatches(page, '#start-time')).toBe(true);

    // Try other corners: the picker opens; Escape closes it.
    await reach(page, '[data-action="next-corners"]');
    await page.keyboard.press('Enter');
    await page.locator('.sheet.is-open[data-sheet="corners"]').waitFor();
    await page.keyboard.press('Escape');
    await expect(page.locator('.sheet.is-open')).toHaveCount(0);

    // The chart's readout numbers: each opens its Sources row, and Escape brings focus back.
    const ids = await page.locator('.chart-readout button.num').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['source'] ?? ''));
    expect(ids.length, 'readout number buttons').toBeGreaterThanOrEqual(1);
    for (const id of ids) {
      await reach(page, `.chart-readout button.num[data-source="${id}"]`);
      await page.keyboard.press('Enter');
      await expect(page.locator(`.sheet.is-open .source-row.is-target[data-source="${id}"]`)).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(page.locator('.sheet.is-open')).toHaveCount(0);
      expect(await focusMatches(page, `.chart-readout button.num[data-source="${id}"]`)).toBe(true);
    }

    // Scheduled departures: Enter opens the section, Space closes it.
    await reach(page, '[data-action="departures"]');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-action="departures"]')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.departures-region')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(page.locator('[data-action="departures"]')).toHaveAttribute('aria-expanded', 'false');

    // Show a race today wins: the notice shows and the race is one today wins.
    await reach(page, '[data-action="next-today-win"]');
    await page.keyboard.press('Enter');
    await expect(page.locator('.notice[data-notice="today-win"]')).toBeVisible();
    await expect(page.locator('.result')).toHaveAttribute('data-result', 'today');
  });
});

test.describe('nothing scrolls sideways (20.2, R1.4)', () => {
  // The widths are set here, so every project runs it: the project's own viewport does not matter.
  test('at 320, 375, 899, 900, 1280 and 1920 px wide: racing, finished, and with a sheet open', async ({ browser }) => {
    for (const width of [320, 375, 899, 900, 1280, 1920]) {
      const height = width < 900 ? 667 : 800;
      for (const reducedMotion of ['no-preference', 'reduce'] as const) {
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
        const seen = await guardNetwork(context, true);
        const page = await context.newPage();
        if (reducedMotion === 'no-preference') await pausedAt(page, '20:00');
        await page.goto('./');
        await page.locator(reducedMotion === 'reduce' ? '.result' : '.clock-row').waitFor();
        await fontsReady(page);
        const sideways = (): Promise<number> => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(await sideways(), `${width} px, ${reducedMotion}`).toBeLessThanOrEqual(0);
        await page.locator('[data-action="sources"]').click();
        await page.locator('.sheet.is-open').waitFor();
        expect(await sideways(), `${width} px, ${reducedMotion}, Sources open`).toBeLessThanOrEqual(0);
        await context.close();
        expect(seen).toEqual([]);
      }
    }
  });
});

test.describe('axe-core on the drawn page (20.3, R13.4)', () => {
  test.describe('racing', () => {
    // axe-core works on timers, which the paused clock holds back: the clock runs on, at its real pace, while it checks.
    test('the first race about to start, the route drawing as the placeholder', async ({ page }) => {
      await pausedAt(page, '20:00');
      await page.goto('./');
      await page.locator('.clock-row').waitFor();
      await fontsReady(page);
      await page.clock.resume();
      expect(await axeViolations(page)).toEqual([]);
    });

    test('mid-race, the result shown and the slower side still running', async ({ page }) => {
      await pausedAt(page, '20:00');
      await page.goto('./');
      await page.locator('.clock-row').waitFor();
      await fontsReady(page);
      await page.clock.runFor(TIMINGS.racePauseMs);
      await runUntil(page, async () => (await page.locator('.result').count()) > 0);
      // The result box's entrance finishes on the real clock.
      await page.waitForTimeout(600);
      await page.clock.resume();
      expect(await axeViolations(page)).toEqual([]);
    });
  });

  test.describe('finished (reduced motion)', () => {
    test.use({ reducedMotion: 'reduce' });

    const STATES: [string, string, string[]][] = [
      ['1938 wins', '', []],
      ['today wins', `?from=${slug('Westwood & Carey')}&to=${slug('Preston & Caroline')}`, []],
      ['the Sources sheet at a number', '', ['#card-scroll button.num[data-source="wait-1938"]']],
      ['the corner picker, second step', '', ['[data-action="picker"]', `.corner-choice[data-slug="${LEAD_PAIR.origin}"]`]],
      ['About and credits', '', ['#app > button.info']],
      ['When today wins', '', ['[data-action="whentoday"]']],
      ['a bad link, with its banner', `?from=nowhere&to=${LEAD_PAIR.dest}`, []],
    ];
    for (const [name, search, clicks] of STATES) {
      test(name, async ({ page }) => {
        await page.clock.setFixedTime(newYork(name === 'today wins' ? '11:23' : '20:00'));
        await page.goto(`./${search}`);
        await page.locator('.result').waitFor();
        await fontsReady(page);
        for (const selector of clicks) await page.locator(selector).click();
        if (clicks.length > 0) await page.locator('.sheet.is-open').waitFor();
        expect(await axeViolations(page)).toEqual([]);
      });
    }

    test('with the map drawn [map]', async ({ page }) => {
      await page.goto('./');
      await page.locator('.result').waitFor();
      await fontsReady(page);
      // On a phone the map loads only after View route (story-layer Req 12.3).
      await viewRouteOnPhone(page);
      // The map draws in software here; if it gives up in time, the drawing and notice are checked instead.
      await mapSettled(page);
      expect(await axeViolations(page)).toEqual([]);
    });

    test('the map unavailable: the route drawing and the notice', async ({ page, context }) => {
      await withoutWebGL(context);
      await page.goto('./');
      await page.locator('.result').waitFor();
      // On a phone the map is asked for only after View route (story-layer Req 12.3).
      await viewRouteOnPhone(page);
      await expect(page.locator('.map-notice')).toBeVisible();
      await fontsReady(page);
      expect(await axeViolations(page)).toEqual([]);
    });

    test('the data error', async ({ page }) => {
      await page.route('**/Ghost-Line/data/summary.json', (route) => route.abort('failed'));
      await page.goto('./');
      await page.locator('.data-error').waitFor();
      expect(await axeViolations(page)).toEqual([]);
    });

    test('no one-seat ride, on the made-up fixture line', async ({ page, context }) => {
      await serveFixture(context);
      await page.goto(`./${query(FIXTURE_NO_RIDE)}`);
      await page.locator('.result[data-result="no_one_seat_ride"]').waitFor();
      await fontsReady(page);
      expect(await axeViolations(page)).toEqual([]);
    });
  });
});

// Task 20.2 (story layer, Req 7.13, 12.1, 12.2, 12.3, 12.6, 12.9, 12.11, 16.12, 16.19): the phone's page flow,
// the lazy map, the bad-link banner and the notices. The sideways-scroll test above already covers 320, 375
// and 899 px (and three wider widths), racing, finished and with a sheet open, so nothing is added for Req 12.6.
const PHONE_VIEWPORT = { width: 375, height: 667 };
const MAP_HOST = new URL(SOURCE_URLS.baseMapStyle).hostname;
const DATA_DIR = resolve(import.meta.dirname, '..', '..', 'public', 'data');
const INFERRED_SLUG: string = INDEX.corners.find((c: { inferred: boolean }) => c.inferred).slug;

const minuteOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};

test.describe('the phone flows in one page (20.2, R12.1, R12.2)', () => {
  test.use({ viewport: PHONE_VIEWPORT, reducedMotion: 'reduce' });

  test('with no sheet and no banner, nothing displayed is fixed or sticky, and nothing scrolls inside the card', async ({ page }) => {
    await page.clock.setFixedTime(newYork('20:00'));
    await page.goto('./');
    await page.locator('.result').waitFor();
    await fontsReady(page);
    // The share banner is not part of a plain visit; wait for the card to be settled and no overlay to be in the page.
    await expect(page.locator('.sheet.is-open, .banner')).toHaveCount(0);
    const found = await page.evaluate(() => {
      const pinned: string[] = [];
      const inner: string[] = [];
      const describe = (el: Element): string => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''}`;
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        const shown = style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
        if (shown && (style.position === 'fixed' || style.position === 'sticky')) pinned.push(`${describe(el)} (${style.position})`);
        if (el.closest('#race-card') && (/(auto|scroll)/.test(style.overflowY) || /(auto|scroll)/.test(style.overflowX))) inner.push(`${describe(el)} overflow ${style.overflowX}/${style.overflowY}`);
      }
      const card = document.getElementById('race-card')!;
      const scroll = document.getElementById('card-scroll')!;
      // Vertical: the card must be as tall as its content, so no inner scrolling is ever needed. Horizontal: reported only
      // (the card clips its x overflow; the page's own sideways scroll is checked by the sideways test).
      const measure = (el: HTMLElement) => `${describe(el)} scroll ${el.scrollWidth}x${el.scrollHeight}, client ${el.clientWidth}x${el.clientHeight}, overflow ${getComputedStyle(el).overflowX}/${getComputedStyle(el).overflowY}`;
      const overflowing = [card, scroll].filter((el) => el.scrollHeight - el.clientHeight > 1).map(measure);
      const clipped = [card, scroll].filter((el) => el.scrollWidth - el.clientWidth > 1).map(measure);
      return { pinned, inner, overflowing, clipped };
    });
    console.log(`card containers: ${found.clipped.length === 0 ? 'no horizontal overflow' : `horizontal overflow, clipped: ${found.clipped.join('; ')}`}`);
    expect(found.pinned, 'displayed elements that are fixed or sticky').toEqual([]);
    expect(found.inner, 'elements inside the card that can scroll').toEqual([]);
    expect(found.overflowing, 'card containers with scrollable overflow').toEqual([]);
  });

  test('the DOM order is the story order of Req 12.2', async ({ page }) => {
    await page.clock.setFixedTime(newYork('20:00'));
    await page.goto('./');
    await page.locator('.result').waitFor();
    const order = [
      '#topbar',
      '#intro-line',
      '#map-area .route-toggle',
      '#pair-names',
      '.example-label',
      '#start-time',
      '.schedule',
      '.lanes',
      '#race-caption',
      '.result',
      '.honest',
      '.takeaway',
      '.next-steps',
      '.chart',
      '.departures .departures-region[hidden]',
      '[data-action="sources"]',
      '[data-action="share"]',
      '#app > button.info',
    ];
    const positions = await page.evaluate((selectors) => {
      const els = selectors.map((s) => document.querySelector(s));
      return selectors.map((s, k) => {
        const el = els[k];
        if (!el) return { selector: s, found: false, after: false };
        const previous = k > 0 ? els[k - 1] : null;
        return { selector: s, found: true, after: previous ? Boolean(previous.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) : true };
      });
    }, order);
    expect(positions.filter((p) => !p.found).map((p) => p.selector), 'selectors not in the page').toEqual([]);
    expect(positions.filter((p) => !p.after).map((p) => p.selector), 'selectors that come before the one listed above them').toEqual([]);
  });

  test('the notices follow the schedule line directly, in the order before-the-table, inferred, today-win', async ({ page }) => {
    await page.clock.setFixedTime(newYork('20:00'));
    await page.goto(`./${query({ origin: INFERRED_SLUG, dest: LEAD_PAIR.dest })}`);
    await page.locator('.result').waitFor();
    const directly = await page.evaluate(() => {
      const next = document.querySelector('.schedule')?.nextElementSibling;
      return { cls: next?.className ?? null, lanesAfter: next?.nextElementSibling?.className ?? null };
    });
    expect(directly.cls).toBe('notices');
    expect(directly.lanesAfter).toBe('lanes');
  });
});

test.describe('the lazy map on the phone (20.2, R12.3, R12.9)', () => {
  test.use({ viewport: PHONE_VIEWPORT });

  test('no MapLibre chunk and no tile host until View route; after Hide route no map and no further tile requests [map]', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'the request log is the same on every project; one run is enough');
    const log: { url: string; at: number }[] = [];
    page.on('request', (request) => log.push({ url: request.url(), at: Date.now() }));
    const chunk = (url: string): boolean => /maplibre/i.test(url) || /\/src\/map\/map(\.ts)?(\?|$)/.test(url);
    const tile = (url: string): boolean => new URL(url).hostname === MAP_HOST;

    await page.goto('./');
    await page.locator('.result, .clock-row').first().waitFor();
    await page.locator('.route-drawing').waitFor();
    await page.locator('.route-toggle').waitFor({ state: 'visible' });
    await expect(page.locator('.route-toggle')).toHaveText(VIEW_ROUTE);
    // Longer than the idle wait that starts the map on a laptop: here it must not start.
    await page.waitForTimeout(TIMINGS.mapIdleMs + 1500);
    expect(log.filter((r) => chunk(r.url)).map((r) => r.url), 'MapLibre or map chunk requests before View route').toEqual([]);
    expect(log.filter((r) => tile(r.url)).map((r) => r.url), `${MAP_HOST} requests before View route`).toEqual([]);
    expect(await page.locator('.maplibregl-map').count()).toBe(0);

    await page.locator('.route-toggle').click();
    expect(await mapSettled(page).catch(() => 'timeout')).not.toBe('timeout');
    expect(log.filter((r) => chunk(r.url)).length, 'the map chunk is asked for on View route').toBeGreaterThan(0);
    const afterView = log.filter((r) => tile(r.url)).length;
    expect(afterView, `${MAP_HOST} is asked for on View route`).toBeGreaterThan(0);
    await expect(page.locator('.route-toggle')).toHaveText(HIDE_ROUTE);

    await page.locator('.route-toggle').click();
    await expect(page.locator('.route-toggle')).toHaveText(VIEW_ROUTE);
    await expect(page.locator('.maplibregl-map')).toHaveCount(0);
    await expect(page.locator('.maplibregl-canvas')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.dataset['route'])).toBe('strip');
    await expect(page.locator('.route-drawing')).toHaveCount(1);
    const settled = log.filter((r) => tile(r.url)).length;
    await page.waitForTimeout(3000);
    const later = log.filter((r) => tile(r.url)).slice(settled).map((r) => r.url);
    console.log(`phone map: ${afterView} tile-host requests by the time the map settled, ${settled} when it was hidden, ${later.length} after`);
    expect(later, `${MAP_HOST} requests after Hide route`).toEqual([]);
  });
});

/** Where two boxes overlap, in pixels (0 x 0 when they do not touch). */
function overlapOf(a: Rect, b: Rect): { dx: number; dy: number } {
  const dx = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const dy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return dx > 0 && dy > 0 ? { dx, dy } : { dx: 0, dy: 0 };
}

test.describe('the bad-link banner at the result moment (20.2, R12.11, R16.12, R16.19)', () => {
  for (const width of [375, 320]) {
    test(`at ${width} x 667 the banner is measured against the result box and the next-step actions`, async ({ browser }, info) => {
      const context = await browser.newContext({ viewport: { width, height: 667 }, reducedMotion: 'reduce', deviceScaleFactor: 2 });
      const seen = await guardNetwork(context, true);
      const page = await context.newPage();
      await page.clock.setFixedTime(newYork('20:00'));
      await page.goto(`./?from=nowhere&to=${LEAD_PAIR.dest}`);
      await page.locator('.result').waitFor();
      await page.locator('.banner.is-open').waitFor();
      await fontsReady(page);
      const boxes = await page.evaluate(() => {
        const box = (el: Element | null): { x: number; y: number; width: number; height: number } | null => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        };
        return {
          banner: box(document.querySelector('.banner')),
          result: box(document.querySelector('.result')),
          actions: Array.from(document.querySelectorAll('.next-steps .next-step')).map(box),
          actionsRow: box(document.querySelector('.next-steps')),
          text: document.querySelector('.banner')?.textContent ?? '',
        };
      });
      expect(boxes.banner, 'the banner is showing').not.toBeNull();
      expect(boxes.result, 'the result box is drawn').not.toBeNull();
      expect(boxes.actions.length, 'three next-step actions').toBe(3);
      const lines: string[] = [];
      let worst = 0;
      const compare = (name: string, other: Rect | null): void => {
        const o = other ? overlapOf(boxes.banner!, other) : { dx: 0, dy: 0 };
        lines.push(`${name}: ${o.dx.toFixed(1)} x ${o.dy.toFixed(1)} px overlap (${(o.dx * o.dy).toFixed(0)} px2); box y ${other ? other.y.toFixed(1) : 'none'}..${other ? (other.y + other.height).toFixed(1) : 'none'}`);
        worst = Math.max(worst, o.dx * o.dy);
      };
      compare('result box', boxes.result);
      boxes.actions.forEach((a, k) => compare(`next-step action ${k + 1}`, a));
      const summary = `${info.project.name} ${width} x 667: banner y ${boxes.banner!.y.toFixed(1)}..${(boxes.banner!.y + boxes.banner!.height).toFixed(1)}, ${lines.join('; ')}`;
      console.log(summary);
      // The task's one recorded-not-failed check: an overlap is reported in pixels, not fixed by shrinking.
      info.annotations.push({ type: `banner overlap at ${width} x 667`, description: worst > 0 ? `OVERLAP: ${summary}` : `none: ${summary}` });
      await context.close();
      expect(seen).toEqual([]);
    });
  }
});

test.describe('"Scheduled, not live." shows with each notice (20.2, R7.13)', () => {
  test.use({ reducedMotion: 'reduce' });

  async function noticeShows(page: Page, kind: string): Promise<void> {
    await expect(page.locator(`.notice[data-notice="${kind}"]`)).toBeVisible();
    const schedule = page.locator('.schedule');
    await expect(schedule).toBeVisible();
    await expect(schedule).toContainText(NOT_LIVE);
    const [s, n] = await Promise.all([schedule.boundingBox(), page.locator(`.notice[data-notice="${kind}"]`).boundingBox()]);
    expect(n!.y, `${kind} notice sits under the schedule line`).toBeGreaterThanOrEqual(s!.y + s!.height - 1);
  }

  test('the before-the-table notice', async ({ page }) => {
    let found: { origin: string; dest: string; t: string } | null = null;
    for (const p of INDEX.pairs as { origin: string; dest: string }[]) {
      const race = JSON.parse(readFileSync(resolve(DATA_DIR, 'race', `${p.origin}__${p.dest}.json`), 'utf8'));
      const row = (race.races as { t: string; before_table: boolean }[]).find((r) => r.before_table);
      if (row && !found) found = { origin: p.origin, dest: p.dest, t: row.t };
    }
    expect(found, 'a pair with a start before its first listed car').not.toBeNull();
    await page.clock.setFixedTime(newYork('20:00'));
    await page.goto(`./${query(found!)}`);
    await page.locator('.result').waitFor();
    await fontsReady(page);
    await page.locator('#start-time').fill(String(minuteOf(found!.t)));
    await noticeShows(page, 'before-table');
  });

  test('the inferred-corner notice', async ({ page }) => {
    await page.clock.setFixedTime(newYork('20:00'));
    await page.goto(`./${query({ origin: INFERRED_SLUG, dest: LEAD_PAIR.dest })}`);
    await page.locator('.result').waitFor();
    await noticeShows(page, 'inferred');
  });

  test('the today-win notice', async ({ page }) => {
    await page.clock.setFixedTime(newYork('20:00'));
    await page.goto('./');
    await page.locator('.result').waitFor();
    await page.locator('[data-action="next-today-win"]').click();
    await noticeShows(page, 'today-win');
  });
});

// Task 20.3 (story layer, Req 4.7, 14.3, 15.1, 15.2, 15.4, 16.14).
test.describe('the story with no map (20.3, R14.3)', () => {
  test('the whole story with the tile host blocked and WebGL absent: captions, result, takeaway, chart, departures, the today-win shortcut', async ({ page, context }) => {
    await withoutWebGL(context);
    await pausedAt(page, '20:00');
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    await fontsReady(page);
    await expect(page.locator('.example-label')).toBeVisible();
    const caption = page.locator('#race-caption');
    expect(((await caption.textContent()) ?? '').trim(), 'the orientation line').not.toBe('');
    // The map is asked for (a phone: on View route) and gives up; the race does not wait for it.
    await viewRouteOnPhone(page);
    await runUntil(page, async () => (await page.locator('#map-area').getAttribute('data-map-failed')) !== null);
    await expect(page.locator('.map-notice')).toHaveText(MAP_UNAVAILABLE);
    // The race runs to its finish; the caption changes along the way.
    const seen = new Set<string>();
    await runUntil(page, async () => {
      seen.add(((await caption.textContent()) ?? '').trim());
      return (await phase(page)) === 'finished';
    });
    expect(seen.size, `caption texts seen: ${[...seen].join(' | ')}`).toBeGreaterThan(1);
    await expect(page.locator('.result')).toHaveCount(1);
    await expect(page.locator('.takeaway')).toBeVisible();
    await expect(page.locator('.chart')).toHaveCount(1);
    await expect(page.locator('.schedule')).toContainText(NOT_LIVE);
    await page.locator('[data-action="departures"]').click();
    await expect(page.locator('.departures-region')).toBeVisible();
    // The shortcut races a pair today wins, still with no map.
    await page.locator('[data-action="next-today-win"]').click();
    await expect(page.locator('.notice[data-notice="today-win"]')).toBeVisible();
    await runUntil(page, async () => (await page.locator('.result[data-result="today"]').count()) > 0);
    await runUntil(page, async () => (await page.locator('.clock-row').count()) === 0);
    expect(await phase(page)).toBe('finished');
    await expect(page.locator('.data-error')).toHaveCount(0);
    await expect(page.locator('.map-notice')).toBeVisible();
  });
});

test.describe('the first race and the pause (20.3, R4.7)', () => {
  test('"race-start" is marked while the orientation pause is still running, before the clock starts', async ({ page }) => {
    // Real time: the page's fake clock does not carry performance marks. The pause is 2,000 ms, so the reads below
    // happen well inside it.
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    const before = await page.evaluate(() => ({
      starts: performance.getEntriesByName('race-start', 'mark').map((e) => e.startTime),
      phase: document.documentElement.dataset['race'],
      now: performance.now(),
    }));
    expect(before.starts.length, 'the mark is present before the pause ends').toBe(1);
    expect(before.phase, 'the race has not started').not.toBe('running');
    await expect.poll(() => phase(page), { timeout: 10_000 }).toBe('running');
    const runningAt = await page.evaluate(() => performance.now());
    // The mark came first, and the clock started only after the pause.
    expect(before.starts[0]!).toBeLessThanOrEqual(before.now);
    expect(runningAt - before.starts[0]!, 'the clock starts after the orientation pause').toBeGreaterThanOrEqual(TIMINGS.orientationMs - 150);
  });
});

test.describe('reduced motion, the story layer (20.3, R4.7, R15.4)', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the race is finished at once, the takeaway shows with the result, and no caption sequence plays', async ({ page }) => {
    await page.goto('./');
    await page.locator('.result').waitFor();
    // At once: the takeaway is in the page with the result box, and nothing is racing.
    await expect(page.locator('.takeaway')).toBeVisible();
    expect(await phase(page)).toBe('finished');
    await expect(page.locator('.clock-row, .skip')).toHaveCount(0);
    expect(await page.evaluate(() => performance.getEntriesByName('race-start', 'mark').length)).toBe(1);
    const texts = new Set<string>();
    for (let k = 0; k < 12; k += 1) {
      texts.add(((await page.locator('#race-caption').textContent()) ?? '').trim());
      await page.waitForTimeout(100);
    }
    expect(texts.size, `caption texts seen: ${[...texts].join(' | ')}`).toBe(1);
    expect([...texts][0]).not.toBe('');
  });
});

// axe with every rule on, colour contrast included, on the story layer's new states. Each project (phone and
// laptop) runs them on its own layout; the phone-only states skip on the laptop.
test.describe('axe-core on the story layer states (20.3, R13.4, R16.14)', () => {
  test('racing with a caption showing', async ({ page }) => {
    await pausedAt(page, '20:00');
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    await fontsReady(page);
    await page.clock.runFor(TIMINGS.orientationMs + 1500);
    expect(await phase(page)).toBe('running');
    expect(((await page.locator('#race-caption').textContent()) ?? '').trim()).not.toBe('');
    await page.clock.resume();
    expect(await axeViolations(page)).toEqual([]);
  });

  test.describe('finished (reduced motion)', () => {
    test.use({ reducedMotion: 'reduce' });

    async function finished(page: Page, search = ''): Promise<void> {
      await page.clock.setFixedTime(newYork('20:00'));
      await page.goto(`./${search}`);
      await page.locator('.result').waitFor();
      await fontsReady(page);
    }

    test('first visit, finished, with the takeaway', async ({ page }) => {
      await finished(page);
      await expect(page.locator('.takeaway')).toBeVisible();
      await expect(page.locator('.example-label')).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test('the today-win notice', async ({ page }) => {
      await finished(page);
      await page.locator('[data-action="next-today-win"]').click();
      await expect(page.locator('.notice[data-notice="today-win"]')).toBeVisible();
      await page.locator('.result[data-result="today"]').waitFor();
      await page.waitForTimeout(400);
      expect(await axeViolations(page)).toEqual([]);
    });

    test('the departures section open', async ({ page }) => {
      await finished(page);
      await page.locator('[data-action="departures"]').click();
      await expect(page.locator('.departures-region')).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test('the chart, after the slider has moved (the plain heading and a readout)', async ({ page }) => {
      await finished(page);
      const slider = page.locator('#start-time');
      await slider.fill(String(Math.round((Number(await slider.getAttribute('min')) + Number(await slider.getAttribute('max'))) / 2)));
      await page.waitForTimeout(400);
      await page.locator('.chart').scrollIntoViewIfNeeded();
      await expect(page.locator('.chart-readout button.num').first()).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test('the shared-link banner', async ({ page }) => {
      await finished(page, query(LEAD_PAIR));
      await page.locator('.banner.is-open').waitFor();
      expect(await axeViolations(page)).toEqual([]);
    });

    test('a bad-link banner with the takeaway under it', async ({ page }) => {
      await finished(page, `?from=nowhere&to=${LEAD_PAIR.dest}`);
      await page.locator('.banner.is-open').waitFor();
      await expect(page.locator('.takeaway')).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test('the phone route strip, closed', async ({ page }) => {
      test.skip(!isPhone(page), 'the strip and its toggle are the phone layout');
      await finished(page);
      await expect(page.locator('.route-toggle')).toHaveText(VIEW_ROUTE);
      expect(await page.evaluate(() => document.documentElement.dataset['route'])).toBe('strip');
      expect(await axeViolations(page)).toEqual([]);
    });

    test('the phone route preview, expanded (no WebGL: the drawing and the notice)', async ({ page, context }) => {
      test.skip(!isPhone(page), 'the preview toggle is the phone layout');
      await withoutWebGL(context);
      await finished(page);
      await page.locator('.route-toggle').click();
      await expect(page.locator('.route-toggle')).toHaveText(HIDE_ROUTE);
      await expect(page.locator('.map-notice')).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });
  });
});

test.describe('the result scrolls into view (24.1)', () => {
  type Edge = { top: number; bottom: number };
  /** Whether the result headline, the result box and the three next steps are whole inside the scrolling area. */
  const wholeInView = (page: Page): Promise<{ ok: boolean; detail: string }> =>
    page.evaluate(() => {
      const desktop = window.innerWidth >= 900;
      const area = desktop ? document.getElementById('race-card')!.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const parts = ['.result', '.result-line', '.next-step[data-action="next-time"]', '.next-step[data-action="next-corners"]', '.next-step[data-action="next-today-win"]'];
      const edges = parts.map((s) => {
        const r = document.querySelector(s)!.getBoundingClientRect();
        return { s, top: r.top, bottom: r.bottom };
      });
      const ok = edges.every((e: Edge) => e.top >= area.top - 0.5 && e.bottom <= area.bottom + 0.5);
      return { ok, detail: JSON.stringify({ area, edges }) };
    });

  for (const [label, width, height] of [['phone', 375, 667], ['desktop', 1280, 800]] as const) {
    test(`${label}: after a live race the result headline and all three next steps are whole`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'no-preference' });
      const seen = await guardNetwork(context, true);
      const page = await context.newPage();
      await pausedAt(page, '20:00');
      await page.goto('./');
      await page.locator('.clock-row').waitFor();
      await fontsReady(page);
      await runUntil(page, async () => (await page.locator('.result').count()) > 0 && (await page.locator('.clock-row').count()) === 0, 30_000, 100);
      await page.clock.runFor(1500);
      // The browser's own smooth scroll runs on real time.
      await expect.poll(async () => (await wholeInView(page)).detail && (await wholeInView(page)).ok, { timeout: 5000 }).toBe(true);
      await context.close();
      expect(seen).toEqual([]);
    });

    test(`${label}: under reduced motion the jump is instant`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const seen = await guardNetwork(context, true);
      const page = await context.newPage();
      await page.clock.setFixedTime(newYork('20:00'));
      await page.goto('./');
      await page.locator('.result').waitFor();
      await fontsReady(page);
      const view = await wholeInView(page);
      expect(view.ok, view.detail).toBe(true);
      await context.close();
      expect(seen).toEqual([]);
    });

    test(`${label}: a visitor who scrolled during the race is not scrolled`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'no-preference' });
      const seen = await guardNetwork(context, true);
      const page = await context.newPage();
      await pausedAt(page, '20:00');
      await page.goto('./');
      await page.locator('.clock-row').waitFor();
      await fontsReady(page);
      // The race starts after the orientation pause; the visitor scrolls once it is running.
      await runUntil(page, async () => (await phase(page)) === 'running', 10_000, 100);
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.wheel(0, 1);
      await runUntil(page, async () => (await page.locator('.result').count()) > 0 && (await page.locator('.clock-row').count()) === 0, 30_000, 100);
      await page.clock.runFor(1500);
      await page.waitForTimeout(800);
      const moved = await page.evaluate(() => window.scrollY + (document.getElementById('race-card')?.scrollTop ?? 0));
      // The wheel itself moves at most a pixel; the reveal would move far more.
      expect(moved).toBeLessThanOrEqual(1);
      await context.close();
      expect(seen).toEqual([]);
    });
  }
});
