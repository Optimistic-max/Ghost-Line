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
import { type Browser, type BrowserContext, type Page, expect, test } from '@playwright/test';
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
  /** The picture shows the link's banner. */
  banner?: boolean;
  /** Serve the data differently: summary.json failing, for the data error. */
  data?: 'fail-summary';
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
  // the data error with summary.json failing. No one-seat ride (21, 25) exists only on the made-up fixture
  // line, which the page cannot load (index.json must list the lead pair); jsdom tests cover it.
  { file: '06-beforetable', size: PHONE, at: '09:00' },
  { file: '07-inferred', size: PHONE, at: '20:00', query: `?from=${slug('Brevard & Preston')}&to=${slug('Aliceanna & Bond')}` },
  { file: '09-dataerror', size: PHONE, at: '20:00', data: 'fail-summary' },
  // The map unavailable (mockups 22, 26): the tile host blocked, the lead pair finished at 10:00.
  { file: '22-mapunavailable', size: PHONE, at: '20:00', noTiles: true },
  { file: '26-desktop-mapunavailable', size: DESKTOP, at: '20:00', noTiles: true },
];

/** The only host outside the dev server the page may reach: the map's style, tiles and glyphs (tech.md, approved). */
const TILE_HOST = 'tiles.openfreemap.org';

/**
 * Let through the dev server and the tile host only; any other request is
 * blocked and recorded, and the state fails. With `noTiles` the tile host is
 * blocked too. Returns the hosts blocked that were not meant to be.
 */
async function guardNetwork(context: BrowserContext, noTiles: boolean): Promise<string[]> {
  const strange: string[] = [];
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const local = url.hostname === '127.0.0.1' || url.protocol === 'data:' || url.protocol === 'blob:';
    if (local || (url.hostname === TILE_HOST && !noTiles)) return route.continue();
    if (url.hostname !== TILE_HOST) strange.push(url.host);
    return route.abort('blockedbyclient');
  });
  return strange;
}

/** The map has either drawn its first frame (the drawing faded) or given up (the notice shows). */
async function mapSettled(page: Page): Promise<'ready' | 'unavailable'> {
  await page.waitForFunction(
    () => document.querySelector('.route-drawing.is-faded') !== null || document.querySelector<HTMLElement>('.map-notice')?.hidden === false,
    null,
    { timeout: 20_000 },
  );
  // Tiles still arriving after the first frame: let the map go quiet before the picture.
  await page.waitForTimeout(1500);
  return (await page.locator('.route-drawing.is-faded').count()) > 0 ? 'ready' : 'unavailable';
}

type Rect = { left: number; top: number; right: number; bottom: number; what: string };

/**
 * What the map area draws, as boxes on the page: each glyph of each street name
 * on the route drawing (when it shows), the trolley marker standing on it, the
 * corner names and dots, the visible line of text (credit or notice), the
 * map's attribution button and the card's top edge.
 */
async function mapBoxes(page: Page): Promise<{ glyphs: Rect[]; marker: Rect | null; drawn: Rect[]; line: Rect | null; attribution: Rect | null; cardTop: number }> {
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
    const attribution = document.querySelector('#map-area .maplibregl-ctrl-attrib');
    return {
      glyphs,
      marker: drawing && markerArt ? box(markerArt, 'trolley marker') : null,
      drawn: [...drawn, ...glyphs],
      line: line ? box(line, line.textContent ?? '') : null,
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
    const covered = boxes.drawn.filter((d) => meet(d, boxes.line!)).map((d) => d.what);
    expect(covered, `${at}: the map's line of text over the drawing`).toEqual([]);
    if (boxes.attribution) expect(meet(boxes.attribution, boxes.line), `${at}: attribution over the line`).toBe(false);
    if (state.size === PHONE) {
      expect(boxes.line.bottom, `${at}: the line above the card`).toBeLessThanOrEqual(boxes.cardTop);
      // At the foot of the map area: nearer the card than the top bar.
      expect(boxes.cardTop - boxes.line.bottom, `${at}: the line at the foot`).toBeLessThan(10);
      if (boxes.attribution) expect(boxes.attribution.bottom, `${at}: attribution above the card`).toBeLessThanOrEqual(boxes.cardTop);
    }
  }
}

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
  const strange = await guardNetwork(context, state.noTiles ?? false);
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
  // The route drawing is the map area's placeholder. On the paused clock of a racing state the map
  // never starts (it waits for an idle moment), so those pictures show the drawing; the others wait
  // for the map to draw or give up.
  if (state.data !== 'fail-summary') {
    await page.locator('.route-drawing').waitFor();
    if (!racing) {
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
    await page.clock.runFor(TIMINGS.racePauseMs);
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
  if (state.data !== 'fail-summary') await checkMapArea(page, state);
  // Nothing scrolls sideways at the design sizes.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await context.close();
  // No request left for any host but the dev server and the tile host.
  expect(strange, `${state.file}: blocked hosts`).toEqual([]);
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

// Design 9.3 (Emmanuel, Nov 19): a vehicle's front edge is the filled end of its
// ride portion, never nearer the lane start than its own width, so it never
// reaches past the lane start and moves during its ride only. The finish
// marker sits at the end of each bar the whole time. The lead pair at 10:00,
// measured at moments across the race and after the finish.
for (const size of [PHONE, DESKTOP]) {
  test(`vehicle front edges on the filled end of the ride (${size.width} x ${size.height})`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
    const page = await context.newPage();
    await page.clock.install({ time: beforeNewYork('20:00') });
    await page.clock.pauseAt(newYork('20:00'));
    await page.goto('./');
    await page.locator('.clock-row').waitFor();
    await fontsReady(page);
    // Real milliseconds after the pause: 1938 waiting, riding twice, arrived; bus waiting, riding twice, the last walk; finished.
    const pause = TIMINGS.racePauseMs;
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
        const front = Math.max(l.laneStart + l.vehicle.width, l.rideFilled);
        expect(Math.abs(l.vehicle.right - front), label).toBeLessThanOrEqual(1.5);
        expect(l.vehicle.left, label).toBeGreaterThanOrEqual(l.laneStart - 0.5);
        expect(Math.abs(l.markCentre - l.barEnd), label).toBeLessThanOrEqual(1.5);
        expect(l.markOpacity, label).toBe(1);
        // Only the trolley glows (ui.md): the bus lane's marker is a solid tick; the arrival flash glows on neither side.
        if (l.side === '1938') expect(l.markGlow, label).not.toBe('none');
        else expect(l.markGlow, label).toBe('none');
        expect(l.capGlow, label).toBe('none');
        lefts[l.side]!.push(l.vehicle.left);
      }
    }
    // The bus stays put through its first walk and its wait, and again through its last walk.
    expect(lefts.today![0]).toBeCloseTo(lefts.today![4]!, 1);
    expect(lefts.today![7]).toBeCloseTo(lefts.today![8]!, 1);
    // It moves during its ride.
    expect(lefts.today![6]!).toBeGreaterThan(lefts.today![5]!);
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
