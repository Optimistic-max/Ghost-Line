// Shared by the browser checks (race.spec.ts) and the mockup screenshots
// (screens.spec.ts): the real index.json for names and dates, New York wall
// times on the service date, the network guard, the made-up fixture served by
// request interception, the fonts, and axe-core in the page.
import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { type BrowserContext, type Page, expect } from '@playwright/test';
import { LEAD_PAIR } from '../../src/config';

export const INDEX = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', '..', 'public', 'data', 'index.json'), 'utf8'));

export const PHONE = { width: 375, height: 667, deviceScaleFactor: 2 };
export const DESKTOP = { width: 1280, height: 800, deviceScaleFactor: 1 };

/** A New York wall time on the service date. */
export const newYork = (hhmm: string): Date => new Date(`${INDEX.service_date}T${hhmm}:00-05:00`);
/** Half a minute before: a fake clock is installed there, so pausing at the wall time is never in its past, however slow the machine. */
export const beforeNewYork = (hhmm: string): Date => new Date(newYork(hhmm).getTime() - 30_000);
export const slug = (name: string): string => INDEX.corners.find((c: { name: string }) => c.name === name).slug;
export const query = (pair: { origin: string; dest: string }): string => `?from=${pair.origin}&to=${pair.dest}`;

/** The only host outside the dev server the page may reach: the map's style, tiles and glyphs (tech.md, approved). */
export const TILE_HOST = 'tiles.openfreemap.org';

/**
 * Let through the dev server and the tile host only; any other request is
 * blocked and recorded. With `noTiles` the tile host is blocked too. Returns
 * the hosts blocked that were not meant to be.
 */
export async function guardNetwork(context: BrowserContext, noTiles: boolean): Promise<string[]> {
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

const FIXTURE = resolve(import.meta.dirname, '..', 'fixtures', 'fake');

/**
 * The page requires index.json to list the lead pair, so the made-up line's
 * first two corners answer to the lead pair's slugs while it is served. Their
 * made-up names, and everything else in the fixture, stay as they are.
 */
const STAND_INS: [fake: string, lead: string][] = [
  ['fake-first', LEAD_PAIR.origin],
  ['fake-second', LEAD_PAIR.dest],
];

/** The fixture pair with no one-seat ride, as the page knows it while the fixture is served. */
export const FIXTURE_NO_RIDE = { origin: LEAD_PAIR.origin, dest: 'fake-fifth' };

/**
 * Answer every data request from the made-up fixture line (tests/fixtures/fake),
 * by request interception, so no test-only route is in the build. Registered
 * after guardNetwork, it is asked first.
 */
export async function serveFixture(context: BrowserContext): Promise<void> {
  await context.route('**/Ghost-Line/data/**', async (route) => {
    let name = new URL(route.request().url()).pathname.split('/Ghost-Line/data/')[1] ?? '';
    for (const [fake, lead] of STAND_INS) name = name.replaceAll(lead, fake);
    const path = resolve(FIXTURE, name);
    if (!path.startsWith(FIXTURE + sep) || !existsSync(path)) return route.fulfill({ status: 404, body: '' });
    let body = readFileSync(path, 'utf8');
    for (const [fake, lead] of STAND_INS) body = body.replaceAll(`"${fake}"`, `"${lead}"`);
    return route.fulfill({ status: 200, contentType: 'application/json', body });
  });
}

/** Make the page see no WebGL, as on a device without it (R11.4, R17.6). */
export async function withoutWebGL(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (/webgl/i.test(kind)) return null;
      return (original as (...args: unknown[]) => RenderingContext | null).call(this, kind, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

/** The map has either drawn its first frame (the drawing faded) or given up (the notice shows). */
export async function mapSettled(page: Page): Promise<'ready' | 'unavailable'> {
  await page.waitForFunction(
    () => document.querySelector('.route-drawing.is-faded') !== null || document.querySelector<HTMLElement>('.map-notice')?.hidden === false,
    null,
    { timeout: 20_000 },
  );
  // Tiles still arriving after the first frame: let the map go quiet.
  await page.waitForTimeout(1500);
  return (await page.locator('.route-drawing.is-faded').count()) > 0 ? 'ready' : 'unavailable';
}

export async function fontsReady(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('600 24px "Barlow Condensed"'))).toBe(true);
}

const AXE = resolve(import.meta.dirname, '..', '..', 'node_modules', 'axe-core', 'axe.min.js');

/** axe-core's violations on the page as drawn, colour contrast included (R13.4). */
export async function axeViolations(page: Page): Promise<string[]> {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run(context: Document, options: object): Promise<{ violations: { id: string; help: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const result = await axe.run(document, { resultTypes: ['violations'] });
    return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
  });
}
