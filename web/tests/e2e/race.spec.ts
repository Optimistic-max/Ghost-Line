// Task 20.2 and 20.3: the race in the browser, on the phone and the laptop
// projects of playwright.config.ts (npm run test:e2e). The first race with no
// taps; the result at the first arrival with the slower side running on; Skip
// to result; a whole race with the tile host blocked and no WebGL (R17.6);
// reduced motion; every control from the keyboard alone; no sideways scroll at
// six widths; the data error, then Try again; and axe-core on the drawn page,
// colour contrast included (R13.4). The page reads the real files in
// web/public/data; expected values come from the page and the files, never from
// the briefs. The only host it may reach besides the dev server is the map's.
import { type BrowserContext, type Page, expect, test } from '@playwright/test';
import { LEAD_PAIR, TIMINGS } from '../../src/config';
import { LINK_COPIED, MAP_UNAVAILABLE, PICKER_STEP_END } from '../../src/copy/copy';
import {
  FIXTURE_NO_RIDE,
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
    await page.clock.runFor(TIMINGS.racePauseMs);
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
    await page.clock.runFor(TIMINGS.racePauseMs + 500);
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
    // The map is asked for once the route drawing is in and the page is idle (at the latest after mapIdleMs).
    await page.locator('.route-drawing').waitFor();
    await page.clock.runFor(TIMINGS.racePauseMs + TIMINGS.mapIdleMs);
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

test.describe('the keyboard alone (20.2, R13.1)', () => {
  /** Tab (or Shift+Tab) until `selector` has focus, then check its focus ring shows. */
  async function tabTo(page: Page, selector: string, shift = false): Promise<void> {
    for (let k = 0; k < 120; k += 1) {
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

  const focusMatches = (page: Page, selector: string): Promise<boolean> =>
    page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector);

  async function noShareSheet(context: BrowserContext): Promise<void> {
    // The system share sheet cannot be driven here: without it the page copies the link, as on a desktop without one.
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
    });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  }

  test('runs through every control with no pointer', async ({ page, context }) => {
    await noShareSheet(context);
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
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await page.evaluate(() => location.href));

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
});

test.describe('nothing scrolls sideways (20.2, R1.4)', () => {
  test('at 320, 375, 899, 900, 1280 and 1920 px wide: racing, finished, and with a sheet open', async ({ browser }, info) => {
    test.skip(info.project.name !== 'phone', 'the widths are set here, so one project runs it');
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
      // The map draws in software here; if it gives up in time, the drawing and notice are checked instead.
      await mapSettled(page);
      expect(await axeViolations(page)).toEqual([]);
    });

    test('the map unavailable: the route drawing and the notice', async ({ page, context }) => {
      await withoutWebGL(context);
      await page.goto('./');
      await page.locator('.result').waitFor();
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
