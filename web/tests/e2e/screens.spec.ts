// Screenshots of every mockup state (01 to 26), each named after the mockup it
// matches, for side-by-side review with docs/planning/ui-mockups/ (task 20.4);
// 18 is the dev-only vehicle sheet. Desktop versions of 05 to 12 are not drawn
// as mockups and are not taken.
// Run from web/:  npm run screens      PNGs go to test-results/screens/ (git-ignored).
//
// The page reads the real files in web/public/data from the dev server, except
// the no-one-seat-ride states (21, 25), which exist only on the made-up fixture
// line: for them every data request is answered from tests/fixtures/fake by
// request interception (support.ts), so no test-only route is in the build. The
// start time comes from the page's own rule (the New York time of day, or 10:00
// outside the slider range), so each state sets the browser clock. Racing
// states run on Playwright's fake clock, paused, and advance it to the moment
// of the mockup; finished states use the device's reduced-motion setting, which
// draws the finished state at once. Phone pictures are taken at 2x, like the
// phone mockups (750 x 1334).
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { type Browser, type Page, expect, test } from '@playwright/test';
import { FONT_SIZES, ROUTE_NUMBER_MIN_WIDTH, TIMINGS } from '../../src/config';
import { FIXTURE_TAG } from '../../src/copy/copy';
import { routeNumberOf } from '../../src/format/line';
import {
  DESKTOP,
  FIXTURE_NO_RIDE,
  INDEX,
  PHONE,
  beforeNewYork,
  fontsReady,
  guardNetwork,
  mapSettled,
  newYork,
  query,
  serveFixture,
  slug,
} from './support';

const OUT = resolve(import.meta.dirname, '..', '..', 'test-results', 'screens');
const westToPreston = `?from=${slug('Westwood & Carey')}&to=${slug('Preston & Caroline')}`;

/**
 * Real milliseconds after the page loads, for an unqueried (guided) visit: the orientation pause, then 2 s
 * of race, which is 8 scheduled minutes ("10:08 scheduled").
 */
const TEN_OH_EIGHT = TIMINGS.orientationMs + 2000;

type State = {
  file: string;
  size: typeof PHONE;
  at: string;
  query?: string;
  /** A racing state: this many real milliseconds into the race (0 is the pause before it starts). */
  racing?: number;
  /** The picture shows the link's banner. */
  banner?: boolean;
  /** Serve the data differently: summary.json failing, for the data error; or the made-up fixture line, which has no map. */
  data?: 'fail-summary' | 'fixture';
  /** Block the tile host too, so the map is unavailable and the route drawing stays (mockups 22, 26). */
  noTiles?: boolean;
  /** Controls to click before the picture, in order, to open a sheet. */
  open?: string | string[];
};

/** The picker in its second step, with Preston & Caroline chosen as the start (mockup 19). */
const PICKER_STEP_TWO = ['#card-scroll [data-action="picker"]', `.corner-choice[data-slug="${slug('Preston & Caroline')}"]`];

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
  // The sheets, opened from a number (Sources at its row) and from the info button.
  { file: '10-sources', size: PHONE, at: '20:00', open: '#card-scroll button.num[data-source="wait-1938"]' },
  { file: '11-credits', size: PHONE, at: '20:00', open: '#app > button.info' },
  { file: '17-desktop-sources', size: DESKTOP, at: '20:00', open: '#card-scroll button.num[data-source="wait-1938"]' },
  // The corner picker and the link banners, over the race about to start (mockups 08, 19, 20, 23, 24).
  { file: '19-corners', size: PHONE, at: '20:00', racing: 0, open: PICKER_STEP_TWO },
  { file: '23-desktop-corners', size: DESKTOP, at: '20:00', racing: 0, open: PICKER_STEP_TWO },
  { file: '08-sharelink', size: PHONE, at: '20:00', racing: 0, banner: true, query: `?from=${slug('Preston & Caroline')}&to=${slug('Aliceanna & Bond')}` },
  { file: '20-badshare', size: PHONE, at: '20:00', racing: 0, banner: true, query: '?from=nowhere&to=aliceanna-bond' },
  { file: '24-desktop-badshare', size: DESKTOP, at: '20:00', racing: 0, banner: true, query: '?from=nowhere&to=aliceanna-bond' },
  // The remaining states (mockups 06, 07, 09): before the table at the first minute, an inferred pair, and
  // the data error with summary.json failing.
  { file: '06-beforetable', size: PHONE, at: '09:00' },
  { file: '07-inferred', size: PHONE, at: '20:00', query: `?from=${slug('Brevard & Preston')}&to=${slug('Aliceanna & Bond')}` },
  { file: '09-dataerror', size: PHONE, at: '20:00', data: 'fail-summary' },
  // No one-seat ride (mockups 21, 25): only on the made-up fixture line, tagged, with no map.
  { file: '21-noseat-fixture', size: PHONE, at: '20:00', data: 'fixture', query: query(FIXTURE_NO_RIDE) },
  { file: '25-desktop-noseat-fixture', size: DESKTOP, at: '20:00', data: 'fixture', query: query(FIXTURE_NO_RIDE) },
  // The map unavailable (mockups 22, 26): the tile host blocked, the lead pair finished at 10:00.
  { file: '22-mapunavailable', size: PHONE, at: '20:00', noTiles: true },
  { file: '26-desktop-mapunavailable', size: DESKTOP, at: '20:00', noTiles: true },
];

type Rect = { left: number; top: number; right: number; bottom: number; what: string };

/**
 * What the map area draws, as boxes on the page: each glyph of each street name
 * on the route drawing (when it shows), the trolley marker standing on it, the
 * corner names and dots, the visible line of text (credit or notice), the
 * map's attribution button and the card's top edge.
 */
async function mapBoxes(page: Page): Promise<{
  glyphs: Rect[];
  marker: Rect | null;
  drawn: Rect[];
  line: Rect | null;
  lineRects: Rect[];
  attribution: Rect | null;
  cardTop: number;
}> {
  return page.evaluate(() => {
    const box = (el: Element, what: string) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, what };
    };
    const drawing = document.querySelector<SVGSVGElement>('.route-drawing:not(.is-faded)');
    const glyphs: Rect[] = [];
    const drawn: Rect[] = [];
    if (drawing) {
      const ctm = drawing.getScreenCTM()!;
      for (const text of drawing.querySelectorAll<SVGTextElement>('.street-label')) {
        for (let i = 0; i < text.getNumberOfChars(); i += 1) {
          const e = text.getExtentOfChar(i);
          const pts = [[e.x, e.y], [e.x + e.width, e.y], [e.x, e.y + e.height], [e.x + e.width, e.y + e.height]].map(([x, y]) =>
            new DOMPoint(x, y).matrixTransform(ctm),
          );
          const xs = pts.map((p) => p.x);
          const ys = pts.map((p) => p.y);
          glyphs.push({ left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys), what: `${text.textContent} [${i}]` });
        }
      }
      for (const el of drawing.querySelectorAll('.corner-name, .corner-dot')) drawn.push(box(el, el.textContent || el.getAttribute('class') || ''));
    }
    const markerArt = document.querySelector('#map-area .drawing-marker:not([hidden]) .marker-art');
    const line = [...document.querySelectorAll<HTMLElement>('#map-area .map-lines > p')].find((p) => !p.hidden);
    // The line's text itself, line by line (its paragraph is as wide as the map area).
    const range = document.createRange();
    if (line) range.selectNodeContents(line);
    const lineRects = line
      ? [...range.getClientRects()].map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, what: line.textContent ?? '' }))
      : [];
    const attribution = document.querySelector('#map-area .maplibregl-ctrl-attrib');
    return {
      glyphs,
      marker: drawing && markerArt ? box(markerArt, 'trolley marker') : null,
      drawn: [...drawn, ...glyphs],
      line: line ? box(line, line.textContent ?? '') : null,
      lineRects,
      attribution: attribution ? box(attribution, 'attribution') : null,
      cardTop: document.getElementById('race-card')!.getBoundingClientRect().top,
    };
  });
}

const meet = (a: Rect, b: Rect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Emmanuel, Nov 20: no street name lies under the trolley marker where it
 * stands at a corner; the map's line of text sits at the foot of the map area,
 * clear of the drawing, the attribution button and (on a phone) the card.
 */
async function checkMapArea(page: Page, state: State): Promise<void> {
  const boxes = await mapBoxes(page);
  const at = `${state.file}`;
  // The marker stands at a corner before the race and after the finish; while it rides it may pass a name.
  if (boxes.marker && state.racing !== TEN_OH_EIGHT) {
    const under = boxes.glyphs.filter((g) => meet(g, boxes.marker!)).map((g) => g.what);
    expect(under, `${at}: street name glyphs under the standing trolley marker`).toEqual([]);
  }
  if (boxes.line) {
    expect(boxes.lineRects.length, `${at}: the line's text`).toBeGreaterThan(0);
    const covered = boxes.drawn.filter((d) => boxes.lineRects.some((r) => meet(d, r))).map((d) => d.what);
    expect(covered, `${at}: the map's line of text over the drawing`).toEqual([]);
    if (boxes.attribution) {
      expect(boxes.lineRects.some((r) => meet(boxes.attribution!, r)), `${at}: attribution over the line`).toBe(false);
    }
    if (state.size === PHONE) {
      expect(boxes.line.bottom, `${at}: the line above the card`).toBeLessThanOrEqual(boxes.cardTop);
      // At the foot of the map area: nearer the card than the top bar.
      expect(boxes.cardTop - boxes.line.bottom, `${at}: the line at the foot`).toBeLessThan(10);
      if (boxes.attribution) expect(boxes.attribution.bottom, `${at}: attribution above the card`).toBeLessThanOrEqual(boxes.cardTop);
    }
  }
}

async function shoot(browser: Browser, state: State): Promise<void> {
  const racing = state.racing !== undefined;
  const fixture = state.data === 'fixture';
  const context = await browser.newContext({
    viewport: { width: state.size.width, height: state.size.height },
    deviceScaleFactor: state.size.deviceScaleFactor,
    reducedMotion: racing ? 'no-preference' : 'reduce',
  });
  const strange = await guardNetwork(context, state.noTiles ?? false);
  if (fixture) await serveFixture(context);
  const page = await context.newPage();
  // Kept for the failure message if the map gives up when it should not.
  const failedRequests: string[] = [];
  page.on('requestfailed', (request) => failedRequests.push(`${request.failure()?.errorText ?? ''} ${request.url()}`));
  if (racing) {
    // A paused fake clock: nothing moves until the test runs it forward.
    await page.clock.install({ time: beforeNewYork(state.at) });
    await page.clock.pauseAt(newYork(state.at));
  } else {
    await page.clock.setFixedTime(newYork(state.at));
  }
  if (state.data === 'fail-summary') await page.route('**/data/summary.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto(`./${state.query ?? ''}`);
  await page.locator(state.data === 'fail-summary' ? '.data-error' : racing ? '.clock-row' : '.result').waitFor();
  await fontsReady(page);
  // The made-up line has no map: its area holds only the fixture tag (R6.8, mockups 21 and 25).
  if (fixture) {
    await expect(page.locator('.fixture-tag')).toHaveText(FIXTURE_TAG);
    await expect(page.locator('.route-drawing, .map-canvas')).toHaveCount(0);
    await expect(page.locator('.result')).toHaveAttribute('data-result', 'no_one_seat_ride');
  }
  // The route drawing is the map area's placeholder. On the paused clock of a racing state the map
  // never starts (it waits for an idle moment), so those pictures show the drawing; the others wait
  // for the map to draw or give up.
  if (state.data !== 'fail-summary' && !fixture) {
    await page.locator('.route-drawing').waitFor();
    // On a phone the map loads only after "View route" (story-layer Req 12.3): the strip with the route
    // drawing is the state, so there is no map to wait for. Nothing may have asked for the tile host.
    if (state.size === PHONE) {
      await expect(page.locator('.route-toggle')).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.route-drawing.is-faded')).toHaveCount(0);
    } else if (!racing) {
      let map = await mapSettled(page);
      let cause = await page.locator('#map-area').getAttribute('data-map-failed');
      // Headless Chromium draws the map in software; on a busy machine the first frame can miss the map's
      // 8 s limit, and the page rightly shows the route drawing. That one cause gets one reload.
      if (!state.noTiles && map === 'unavailable' && cause === 'timeout') {
        await page.reload();
        await page.locator('.result').waitFor();
        await fontsReady(page);
        map = await mapSettled(page);
        cause = await page.locator('#map-area').getAttribute('data-map-failed');
      }
      expect(map, `${state.file}: the map (${cause ?? ''}; failed requests: ${failedRequests.slice(0, 5).join('; ')})`).toBe(
        state.noTiles ? 'unavailable' : 'ready',
      );
    }
  }
  if (racing && state.racing) {
    // These racing states have no valid link, so the visit is guided: the orientation pause is included in state.racing.
    expect(state.query, `${state.file}: a link would skip the orientation pause`).toBeUndefined();
    await page.clock.runFor(state.racing + 20);
    await expect(page.locator('.result')).toHaveCount(0);
  }
  if (state.open) {
    for (const selector of [state.open].flat()) await page.locator(selector).click();
    await page.locator('.sheet.is-open').waitFor();
  }
  // A link opens with its banner: kept for the banner states, waited out (5 s) for the others.
  if (state.query && state.banner) await page.locator('#banner-root .banner.is-open').waitFor();
  else if (state.query) await page.locator('#banner-root .banner').waitFor({ state: 'detached', timeout: 10_000 });
  // CSS animations run on the real clock: finite ones (the trolley's fade-in) are shown at their end, loops at rest.
  await page.screenshot({ path: resolve(OUT, `${state.file}.png`), animations: 'disabled' });
  if (state.data === undefined) await checkMapArea(page, state);
  // Nothing scrolls sideways at the design sizes.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await context.close();
  // No request left for any host but the dev server and the tile host.
  expect(strange, `${state.file}: blocked hosts`).toEqual([]);
}

for (const state of STATES) {
  test(`${state.file} (${state.size.width} x ${state.size.height})`, async ({ browser }) => shoot(browser, state));
}

// R1.2 (Emmanuel, Nov 19), as superseded by story-layer Req 12.1: on a 375 x 667 phone, during the race, both
// lanes, their status lines and the clock row are visible in the page flow and nothing covers them. The button
// strip is no longer pinned: it is position static, below those boxes, and the card does not scroll inside.
test('phone race layout: lanes, status lines and clock row in flow, the button strip not pinned or over them (375 x 667)', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: PHONE.width, height: PHONE.height } });
  const page = await context.newPage();
  await page.clock.install({ time: beforeNewYork('20:00') });
  await page.clock.pauseAt(newYork('20:00'));
  await page.goto('./');
  await page.locator('.clock-row').waitFor();
  await fontsReady(page);
  // The start, 10:08 scheduled, just after the trolley arrives and the result shows, and just before the finish.
  const moments = [0, TEN_OH_EIGHT, TIMINGS.orientationMs + 4200, TIMINGS.orientationMs + 11000];
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
        stripPosition: style.position,
        result: document.querySelector('.result') !== null,
        boxes,
      };
    });
    expect(layout.cardScroll).toBe(0);
    expect(layout.boxes.length).toBeGreaterThanOrEqual(5);
    for (const box of layout.boxes) {
      // Visible in the flow: a real height, below the card's top, and the button strip never overlaps it.
      expect(box.bottom - box.top, `${box.name} at ${moment} ms: has a box`).toBeGreaterThan(0);
      expect(box.top, `${box.name} at ${moment} ms`).toBeGreaterThanOrEqual(layout.cardTop);
      expect(box.bottom, `${box.name} at ${moment} ms`).toBeLessThanOrEqual(layout.stripTop + 0.5);
    }
    expect(layout.stripPosition).toBe('static');
    if (moment === TIMINGS.orientationMs + 4200) expect(layout.result).toBe(true);
  }
  await context.close();
});

// Design 9.3 (Emmanuel, Nov 19), as superseded by story-layer Req 5 and 6: the illustrations no longer
// travel, a small bar marker does (measured in race.spec.ts, task 20.1), so here the illustration stays put.
// The finish marker sits at the end of each bar the whole time. The lead pair at 10:00,
// measured at moments across the race and after the finish.
for (const size of [PHONE, DESKTOP]) {
  test(`illustrations stay put, finish mark and glow on each bar (${size.width} x ${size.height})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
    const page = await context.newPage();
    await page.clock.install({ time: beforeNewYork('20:00') });
    await page.clock.pauseAt(newYork('20:00'));
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    await fontsReady(page);
    // Real milliseconds after the pause: 1938 waiting, riding twice, arrived; bus waiting, riding twice, the last walk; finished.
    const pause = TIMINGS.orientationMs;
    const moments = [0, pause + 1000, pause + 2500, pause + 3600, pause + 5000, pause + 8600, pause + 9800, pause + 11000, pause + 12500];
    const lefts: Record<string, number[]> = { '1938': [], today: [] };
    let at = 0;
    for (const moment of moments) {
      await page.clock.runFor(moment - at);
      at = moment;
      const lanes = await page.evaluate(() =>
        (['1938', 'today'] as const).map((side) => {
          const lane = document.querySelector(`.lane-${side}`)!;
          const box = (selector: string) => lane.querySelector(selector)!.getBoundingClientRect();
          const segs = [...lane.querySelectorAll('.seg')];
          const mark = box('.bar-mark');
          return {
            side,
            laneStart: box('.bar').left,
            vehicle: box('.vehicle'),
            rideFilled: box('.seg-ride .seg-fill').right,
            barEnd: segs.at(-1)!.getBoundingClientRect().right,
            markCentre: (mark.left + mark.right) / 2,
            markOpacity: Number(getComputedStyle(lane.querySelector('.bar-mark')!).opacity),
            markGlow: getComputedStyle(lane.querySelector('.bar-mark')!).boxShadow,
            capGlow: getComputedStyle(lane.querySelector('.bar-cap')!).boxShadow,
          };
        }),
      );
      for (const l of lanes) {
        const label = `${l.side} at ${moment} ms`;
        // The small bar marker on the filled end of the ride is measured in race.spec.ts (task 20.1).
        expect(Math.abs(l.markCentre - l.barEnd), label).toBeLessThanOrEqual(1.5);
        expect(l.markOpacity, label).toBe(1);
        // Only the trolley glows (ui.md): the bus lane's marker is a solid tick; the arrival flash glows on neither side.
        if (l.side === '1938') expect(l.markGlow, label).not.toBe('none');
        else expect(l.markGlow, label).toBe('none');
        expect(l.capGlow, label).toBe('none');
        lefts[l.side]!.push(l.vehicle.left);
      }
    }
    // Neither illustration moves at any moment, ride included.
    for (const side of ['1938', 'today']) for (const left of lefts[side]!) expect(left, side).toBeCloseTo(lefts[side]![0]!, 1);
    await context.close();
  });
}

// R1.3 (Emmanuel, Nov 19): on desktop the pair names stay on one line, the font
// shrinking as far as a long pair needs. Every pair is tried, the longest included.
test('desktop pair names on one line, for every pair (1280 x 800)', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: DESKTOP.width, height: DESKTOP.height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const names = new Map<string, string>(INDEX.corners.map((c: { slug: string; name: string }) => [c.slug, c.name]));
  const pairs: { origin: string; dest: string }[] = INDEX.pairs;
  // One page load per pair: the budget grows with the number of pairs (5 s each, 30 s base) instead of a fixed 30 s.
  test.setTimeout(30_000 + 5_000 * pairs.length);
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
  await page.screenshot({ path: resolve(OUT, '18-trolley-sheet.png'), fullPage: true });
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

// ---------------------------------------------------------------------------------------------------------------
// Layout report (story-layer design 9, task 21.1; Req 5.7, 6.10, 12.3, 12.6, 12.7, 12.11, 16.19).
// The starting sizes are not tuned by the build. These steps measure with getBoundingClientRect and WRITE DOWN what
// they find, one line each, to test-results/story-layout-report.md (git-ignored) and as test annotations. They never
// fail the run and never change a size. The one failing assertion is "no sideways scroll" (Req 12.6), further down.
// ---------------------------------------------------------------------------------------------------------------
const REPORT = resolve(import.meta.dirname, '..', '..', 'test-results', 'story-layout-report.md');

type Box = { left: number; top: number; right: number; bottom: number };
const px = (n: number): string => `${(Math.round(n * 10) / 10).toString()} px`;
const dims = (b: Box): string => `${px(b.right - b.left)} wide x ${px(b.bottom - b.top)} tall`;
/** How far two boxes intersect, in pixels each way, or null when they do not. */
const intersect = (a: Box, b: Box): { w: number; h: number } | null => {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0.5 && h > 0.5 ? { w, h } : null;
};

type Note = (kind: 'finding' | 'ok', text: string) => void;

function recorder(label: string, info: { annotations: { type: string; description?: string }[] }): Note {
  return (kind, text) => {
    const line = `- [${label}] ${kind}: ${text}`;
    info.annotations.push({ type: 'layout-' + kind, description: line });
    appendFileSync(REPORT, line + '\n');
  };
}

/** A step that reports and never throws: a measurement that cannot be taken is itself a line. */
async function step(note: Note, name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (error) {
    note('finding', `${name}: could not be measured (${String((error as Error).message).split('\n')[0]})`);
  }
}

type LaneBoxes = {
  side: string;
  head: Box;
  art: Box | null;
  vehicle: Box | null;
  title: Box | null;
  total: Box | null;
  track: Box | null;
  clip: Box | null;
  marker: Box | null;
  ride: Box | null;
  content: { what: string; box: Box }[];
};

async function laneBoxes(page: Page): Promise<LaneBoxes[]> {
  return page.evaluate(() => {
    const rect = (el: Element | null): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width === 0 && r.height === 0 ? null : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const clipOf = (el: Element | null): Box | null => {
      for (let p = el?.parentElement ?? null; p && p !== document.documentElement; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') return rect(p);
      }
      return null;
    };
    return [...document.querySelectorAll('.lane')].map((lane) => {
      const marker = lane.querySelector('.bar-marker svg') ?? lane.querySelector('.bar-marker');
      const rides = [...lane.querySelectorAll('.seg-ride:not([data-empty="true"])')];
      const widest = rides.map((r) => rect(r)).filter((r): r is Box => r !== null);
      const narrowest = widest.sort((a, b) => a.right - a.left - (b.right - b.left))[0] ?? null;
      const content = ['.lane-head', '.lane-title', '.lane-total', '.bar', '.status', '.legend'].flatMap((selector) => {
        const box = rect(lane.querySelector(selector));
        return box ? [{ what: selector, box }] : [];
      });
      return {
        side: lane.getAttribute('data-side') ?? '',
        head: rect(lane.querySelector('.lane-head'))!,
        art: rect(lane.querySelector('.lane-art')),
        vehicle: rect(lane.querySelector('.vehicle')),
        title: rect(lane.querySelector('.lane-title')),
        total: rect(lane.querySelector('.lane-total')),
        track: rect(lane.querySelector('.marker-track')),
        clip: clipOf(marker),
        marker: rect(marker),
        ride: narrowest,
        content,
      };
    });
  });
}

/** A finished lead-pair page at the given size, on a reduced-motion device, with the tile host blocked (the route drawing shows). */
async function finishedPage(browser: Browser, size: { width: number; height: number }) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: 'reduce' });
  await guardNetwork(context, true);
  const page = await context.newPage();
  await page.clock.setFixedTime(newYork('20:00'));
  await page.goto('./');
  await page.locator('.result').waitFor();
  await fontsReady(page);
  await page.locator('.route-drawing').waitFor();
  return { context, page };
}

/** A guided visit on a paused clock, run forward until the result box first appears. Returns the page at that moment. */
async function resultMoment(browser: Browser, size: { width: number; height: number }, search = '', onTick?: (page: Page, ran: number) => Promise<void>) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: 'no-preference' });
  await guardNetwork(context, true);
  const page = await context.newPage();
  await page.clock.install({ time: beforeNewYork('20:00') });
  await page.clock.pauseAt(newYork('20:00'));
  await page.goto(`./${search}`);
  await page.locator('.clock-row').waitFor();
  await fontsReady(page);
  let ran = 0;
  while ((await page.locator('.result').count()) === 0 && ran < 20_000) {
    await page.clock.runFor(100);
    ran += 100;
    await onTick?.(page, ran);
  }
  return { context, page, ran };
}

test.describe.serial('layout report', () => {
  test.beforeAll(() => {
    mkdirSync(dirname(REPORT), { recursive: true });
    writeFileSync(REPORT, '# Story layer layout report\n\nMeasured with getBoundingClientRect. Findings only; no size was changed.\n\n');
  });

  for (const size of [PHONE, DESKTOP]) {
    const label = `${size.width} x ${size.height}`;

    test(`layout report: lanes, markers and route strip (${label})`, async ({ browser }, info) => {
      const note = recorder(label, info);
      const { context, page } = await finishedPage(browser, size);
      await step(note, 'illustration', async () => {
        for (const lane of await laneBoxes(page)) {
          const art = lane.vehicle ?? lane.art;
          if (!art) throw new Error(`no illustration in the ${lane.side} lane`);
          const where = `${lane.side} lane illustration (${dims(art)})`;
          let any = false;
          for (const [what, other] of [['title', lane.title], ['total', lane.total]] as const) {
            const hit = other && intersect(art, other);
            if (hit) {
              any = true;
              note('finding', `${where} overlaps the ${what} by ${px(hit.w)} across and ${px(hit.h)} down`);
            }
          }
          const clipped: string[] = [];
          if (art.left < lane.head.left - 0.5) clipped.push(`${px(lane.head.left - art.left)} at the left`);
          if (art.right > lane.head.right + 0.5) clipped.push(`${px(art.right - lane.head.right)} at the right`);
          if (art.top < lane.head.top - 0.5) clipped.push(`${px(lane.head.top - art.top)} at the top`);
          if (art.bottom > lane.head.bottom + 0.5) clipped.push(`${px(art.bottom - lane.head.bottom)} at the bottom`);
          if (clipped.length) {
            any = true;
            note('finding', `${where} reaches outside its title row (${dims(lane.head)}): ${clipped.join(', ')}`);
          }
          const growth = lane.head.bottom - lane.head.top - (art.bottom - art.top);
          if (growth > 0.5) {
            any = true;
            note('finding', `${lane.side} title row is ${px(growth)} taller than its illustration (row ${px(lane.head.bottom - lane.head.top)}, illustration ${px(art.bottom - art.top)})`);
          }
          if (!any) note('ok', `${where} clear of title and total, inside its row, row not taller than it`);
        }
      });
      await step(note, 'markers', async () => {
        const lanes = await laneBoxes(page);
        for (const lane of lanes) {
          const m = lane.marker;
          if (!m) throw new Error(`no bar marker in the ${lane.side} lane`);
          const where = `${lane.side} marker (${dims(m)})`;
          let any = false;
          for (const [what, box] of [['track', lane.track], ['clipping ancestor', lane.clip]] as const) {
            if (!box) continue;
            if (m.left < box.left - 0.5) {
              any = true;
              note('finding', `${where} is clipped ${px(box.left - m.left)} at the left end of the ${what}`);
            }
            if (m.right > box.right + 0.5) {
              any = true;
              note('finding', `${where} is clipped ${px(m.right - box.right)} at the right end of the ${what}`);
            }
          }
          for (const other of lanes.filter((l) => l !== lane)) {
            for (const c of other.content) {
              const hit = intersect(m, c.box);
              if (hit) {
                any = true;
                note('finding', `${where} overlaps the ${other.side} lane's ${c.what} by ${px(hit.w)} across and ${px(hit.h)} down`);
              }
            }
          }
          if (lane.ride && m.right - m.left > lane.ride.right - lane.ride.left + 0.5) {
            any = true;
            note('finding', `${where} is ${px(m.right - m.left - (lane.ride.right - lane.ride.left))} wider than its ride segment (${px(lane.ride.right - lane.ride.left)})`);
          }
          if (!any) note('ok', `${where} not clipped, clear of the other lane, no wider than its ride segment`);
        }
      });
      await step(note, 'route strip', async () => {
        const strip = await page.evaluate(() => {
          const rect = (el: Element | null): Box | null => {
            if (!el || (el as HTMLElement).hidden) return null;
            const r = el.getBoundingClientRect();
            return r.width === 0 && r.height === 0 ? null : { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
          };
          const area = document.getElementById('map-area');
          return {
            area: rect(area),
            credit: rect(document.querySelector('#map-area .map-credit')),
            toggle: rect(document.querySelector('#map-area .route-toggle')),
            // The drawing's content, not its SVG box (which spans the whole strip): the legs, corner dots and
            // corner names, each on its own.
            drawing: [...document.querySelectorAll('#map-area .route-drawing:not(.is-faded) :is(.route-legs, .corner-dot, .corner-name)')]
              .map((el) => ({ what: el.classList.contains('corner-name') ? `name "${el.textContent ?? ''}"` : el.classList.contains('corner-dot') ? 'corner dot' : 'route legs', box: rect(el) }))
              .filter((p): p is { what: string; box: Box } => p.box !== null),
          };
        });
        if (size === DESKTOP) {
          note('ok', `route strip: not a strip on the laptop (map area ${strip.area ? dims(strip.area) : 'absent'}); toggle ${strip.toggle ? 'shown' : 'not shown'}`);
          return;
        }
        if (!strip.area) throw new Error('no map area');
        let any = false;
        const parts: (readonly [string, Box | null])[] = [['credit line', strip.credit], ['toggle', strip.toggle], ...strip.drawing.map((p) => [`route drawing ${p.what}`, p.box] as const)];
        for (let i = 0; i < parts.length; i += 1) {
          for (let j = i + 1; j < parts.length; j += 1) {
            const a = parts[i]!;
            const b = parts[j]!;
            // The drawing's own parts meet each other by design (dots sit on the legs); only the other parts are compared.
            const hit = a[1] && b[1] && !(a[0].startsWith('route drawing') && b[0].startsWith('route drawing')) && intersect(a[1], b[1]);
            if (hit) {
              any = true;
              note('finding', `strip (${dims(strip.area)}): ${a[0]} overlaps ${b[0]} by ${px(hit.w)} across and ${px(hit.h)} down`);
            }
          }
        }
        if (!any) note('ok', `strip (${dims(strip.area)}): credit line ${strip.credit ? 'shown' : 'not shown'}, toggle ${strip.toggle ? 'shown' : 'not shown'}, drawing content (legs, dots, names: ${strip.drawing.length} boxes) ${strip.drawing.length ? 'shown' : 'not shown'}; no overlap`);
      });
      await context.close();
    });
  }

  // The banner on a bad-link guided visit, at the result moment (Req 12.11, 16.19).
  for (const size of [{ width: 375, height: 667 }, { width: 320, height: 667 }]) {
    const label = `${size.width} x ${size.height}`;
    test(`layout report: banner against the result and next steps (${label})`, async ({ browser }, info) => {
      const note = recorder(`${label} banner`, info);
      await step(note, 'banner', async () => {
        let lastOpen: { at: number; box: Box } | null = null;
        const { context, page, ran } = await resultMoment(browser, size, '?from=nowhere&to=aliceanna-bond', async (p, at) => {
          const box = await p.evaluate(() => {
            const b = document.querySelector('#banner-root .banner.is-open');
            if (!b) return null;
            const r = b.getBoundingClientRect();
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
          });
          if (box) lastOpen = { at, box };
        });
        try {
          const boxes = await page.evaluate(() => {
            const rect = (el: Element): Box => {
              const r = el.getBoundingClientRect();
              return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
            };
            const banner = document.querySelector('#banner-root .banner');
            return {
              banner: banner ? rect(banner) : null,
              open: banner?.classList.contains('is-open') ?? false,
              result: [...document.querySelectorAll('.result')].map(rect),
              steps: [...document.querySelectorAll('.next-step')].map((el) => ({ what: el.getAttribute('data-action') ?? '', box: rect(el) })),
            };
          });
          if (!boxes.banner || !boxes.open) {
            const seen = lastOpen as { at: number; box: Box } | null;
            note('finding', `banner was not open at the result moment (${ran} ms into the race); last seen open at ${seen ? `${seen.at} ms, ${dims(seen.box)}, bottom at ${px(seen.box.bottom)}` : 'never'}`);
            if (seen) {
              for (const r of boxes.result) {
                const hit = intersect(seen.box, r);
                note(hit ? 'finding' : 'ok', `banner's last open box ${hit ? `intersects the result box by ${px(hit.w)} across and ${px(hit.h)} down` : `is clear of the result box (result top at ${px(r.top)})`}`);
              }
              for (const s of boxes.steps) {
                const hit = intersect(seen.box, s.box);
                note(hit ? 'finding' : 'ok', `banner's last open box ${hit ? `intersects the ${s.what} next step by ${px(hit.w)} across and ${px(hit.h)} down` : `is clear of the ${s.what} next step (top at ${px(s.box.top)})`}`);
              }
            }
            return;
          }
          let any = false;
          for (const r of boxes.result) {
            const hit = intersect(boxes.banner, r);
            if (hit) {
              any = true;
              note('finding', `banner (${dims(boxes.banner)}) intersects the result box by ${px(hit.w)} across and ${px(hit.h)} down`);
            }
          }
          for (const s of boxes.steps) {
            const hit = intersect(boxes.banner, s.box);
            if (hit) {
              any = true;
              note('finding', `banner intersects the ${s.what} next step by ${px(hit.w)} across and ${px(hit.h)} down`);
            }
          }
          if (!any) {
            const nearest = [...boxes.result, ...boxes.steps.map((s) => s.box)].map((b) => b.top - boxes.banner!.bottom);
            note('ok', `banner (${dims(boxes.banner)}, bottom at ${px(boxes.banner.bottom)}) clear of the result box and ${boxes.steps.length} next step boxes; the nearest top is ${px(Math.min(...nearest))} below it`);
          }
        } finally {
          await context.close();
        }
      });
    });
  }

  // The phone fit at the lead example's result moment (Req 12.7).
  test('layout report: phone fit at the result moment (375 x 667)', async ({ browser }, info) => {
    const note = recorder('375 x 667 fit', info);
    await step(note, 'phone fit', async () => {
      const { context, page, ran } = await resultMoment(browser, PHONE);
      try {
        const fit = await page.evaluate(() => {
          const bottom = (selector: string): number | null => {
            const el = document.querySelector(selector);
            return el ? el.getBoundingClientRect().bottom : null;
          };
          return { height: window.innerHeight, caption: bottom('#race-caption'), result: bottom('.result-line'), box: bottom('.result') };
        });
        for (const [what, bottom] of [['caption area', fit.caption], ['result line', fit.result]] as const) {
          if (bottom === null) throw new Error(`no ${what}`);
          const cut = bottom - fit.height;
          if (cut > 0.5) note('finding', `${what} bottom is at ${px(bottom)} against ${fit.height} px: ${px(cut)} cut off (result moment ${ran} ms into the race)`);
          else note('ok', `${what} bottom is at ${px(bottom)} against ${fit.height} px: fits with ${px(-cut)} to spare (result moment ${ran} ms into the race)`);
        }
      } finally {
        await context.close();
      }
    });
  });
});

// Polish brief P4: on a phone the "Same ride, longer wait." headline shows, and at the lead example's result
// moment the result line ends at least 16 px above the foot of the first screen. Measured from the top of the
// page (getBoundingClientRect plus scrollY), so the result-into-view scroll (story-layer 24.1) does not count.
// The room of the ghost-cars counter line (polish brief P6) is counted before it exists: one 12 px line at the
// body line height plus its 2 px margin. After P6 the counter is in the page and is measured as it is.
// Stable measurement (Emmanuel, Nov 23): fonts ready, the route strip drawn, then the page clock is stepped one
// frame at a time until two frames in a row show no layout change. Three runs; the assertion is on the worst.
const PHONE_FIT_SPARE_PX = 16;
const PHONE_FIT_RUNS = 3;

type Fit = { height: number; headline: string | null; resultBottom: number; counter: { top: number; bottom: number } | null; reserve: number; spare: number };

async function phoneFit(browser: Browser, size: { width: number; height: number }): Promise<Fit> {
  const { context, page } = await resultMoment(browser, size);
  try {
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.locator('#map-area svg.route-drawing').first().waitFor();
    const read = () =>
      page.evaluate(() => {
        const atTop = (selector: string): { top: number; bottom: number } | null => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
        };
        const headline = document.querySelector<HTMLElement>('#phone-headline');
        const style = getComputedStyle(document.body);
        return {
          height: window.innerHeight,
          headline: headline && headline.offsetParent !== null ? headline.textContent : null,
          result: atTop('.result-line'),
          counter: atTop('.ghost-counter'),
          lineAt12: (12 * parseFloat(style.lineHeight)) / parseFloat(style.fontSize),
          key: [...document.querySelectorAll('#app *')].slice(0, 400).map((el) => { const r = el.getBoundingClientRect(); return `${Math.round((r.top + window.scrollY) * 10)},${Math.round(r.height * 10)}`; }).join('|'),
        };
      });
    // One frame is 16 ms of the page clock; stop after two frames in a row with no layout change.
    let last = await read();
    let still = 0;
    for (let frame = 0; frame < 300 && still < 2; frame++) {
      await page.clock.runFor(16);
      const now = await read();
      still = now.key === last.key ? still + 1 : 0;
      last = now;
    }
    if (still < 2) throw new Error('the layout never settled');
    if (!last.result) throw new Error('no result line');
    const reserve = last.counter && last.counter.bottom <= last.result.top ? 0 : last.lineAt12 + 2;
    const spare = last.height - last.result.bottom - reserve;
    return { height: last.height, headline: last.headline, resultBottom: last.result.bottom, counter: last.counter, reserve, spare };
  } finally {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })).catch(() => undefined);
    await page.screenshot({ path: resolve(OUT, `p4-phone-fit-${size.width}x${size.height}.png`), animations: 'disabled' }).catch(() => undefined);
    await context.close();
  }
}

for (const size of [PHONE, { width: 390, height: 844 }]) {
  test(`phone headline shows and the result line fits the first screen with ${PHONE_FIT_SPARE_PX} px to spare, worst of ${PHONE_FIT_RUNS} runs (${size.width} x ${size.height})`, async ({ browser }) => {
    test.setTimeout(180_000);
    const runs: Fit[] = [];
    for (let k = 0; k < PHONE_FIT_RUNS; k++) runs.push(await phoneFit(browser, size));
    const line = runs
      .map((r, k) => `run ${k + 1}: result line bottom ${r.resultBottom.toFixed(1)} of ${r.height}, counter ${r.counter ? `${r.counter.top.toFixed(1)}-${r.counter.bottom.toFixed(1)}` : `not built, ${r.reserve.toFixed(1)} px counted`}, ${r.spare.toFixed(1)} px to spare`)
      .join('; ');
    test.info().annotations.push({ type: 'phone-fit', description: `${size.width} x ${size.height}: ${line}` });
    console.log(`phone fit ${size.width} x ${size.height}: ${line}`);
    for (const r of runs) expect(r.headline).toBe('Same ride, longer wait.');
    expect(Math.min(...runs.map((r) => r.spare))).toBeGreaterThanOrEqual(PHONE_FIT_SPARE_PX);
  });
}

// Story-layer pictures (task 21.2, Req 16.15): test-results/screens/story-<name>-<phone|desktop>.png, git-ignored.
// The lead pair at the labelled example start, 10:00. Finished states are full-page, because the page scrolls.
type StoryShot = { name: string; racing?: number; click?: string; wait?: string; fullPage?: boolean };
const STORY: StoryShot[] = [
  { name: 'story-1-first-visit', racing: 0 },
  { name: 'story-2-racing-caption', racing: TEN_OH_EIGHT },
  { name: 'story-3-finished-takeaway', fullPage: true },
  { name: 'story-4-today-win-notice', click: '[data-action="next-today-win"]', wait: '.notice[data-notice="today-win"]', fullPage: true },
  { name: 'story-5-chart', wait: '.chart-plot', fullPage: true },
];
for (const [label, size] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
  for (const shot of STORY) {
    test(`story picture: ${shot.name} (${label})`, async ({ browser }) => {
      const racing = shot.racing !== undefined;
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
      if (racing && shot.racing) await page.clock.runFor(shot.racing + 20);
      if (shot.click) await page.locator(shot.click).click();
      if (shot.wait) await page.locator(shot.wait).first().waitFor();
      if (shot.name === 'story-4-today-win-notice') await page.locator('.notice[data-notice="today-win"]').scrollIntoViewIfNeeded();
      if (shot.name === 'story-5-chart') await page.locator('.chart').scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(OUT, `${shot.name}-${label}.png`), fullPage: shot.fullPage ?? false, animations: 'disabled' });
      await context.close();
    });
  }
}

// The phone page at the lead example's result moment (Req 12.7), a viewport picture of what a 375 x 667 phone shows.
test('story picture: story-6-result-moment (phone)', async ({ browser }) => {
  const { context, page } = await resultMoment(browser, PHONE);
  await page.screenshot({ path: resolve(OUT, 'story-6-result-moment-phone.png'), animations: 'disabled' });
  await context.close();
});

// Req 12.6: nothing scrolls sideways at 320, 375 and 899 px. This one is a real assertion.
for (const width of [320, 375, 899]) {
  test(`no sideways scroll at ${width} px`, async ({ browser }) => {
    const { context, page } = await finishedPage(browser, { width, height: 667 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await context.close();
    expect(over, `${width} px: the page is this much wider than the window`).toBeLessThanOrEqual(0);
  });
}
