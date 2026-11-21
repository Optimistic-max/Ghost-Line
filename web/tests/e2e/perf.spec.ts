// Task 22.2 (R16.2, R17.7): how long the deployed page takes to start its first race on a
// throttled phone. Tagged `timing`: it asserts a wall-clock limit, so it is left out of the
// default runs (npm test, npm run test:e2e) and run alone, on a quiet machine, with
//
//   npm run perf
//
// Five cold loads of the page (a new browser context each: no cache), a phone-sized touch
// viewport, slow-4G network and a 4x slower processor through the browser's debugging protocol.
// Each load waits for the `race-start` performance mark the page makes the first time a card
// with data is drawn (story-layer Req 4.7), not when the first lane begins to move, and reads its time after the page started loading. All five are printed; the
// median must be under 5,000 ms. The map's tile host is blocked, as the first race does not
// wait for the map and the check must reach nothing outside the page. To measure another
// address (the local preview, for instance) set PERF_URL first:
//   $env:PERF_URL = 'http://127.0.0.1:4173/Ghost-Line/'
import { expect, test } from '@playwright/test';
import { SOURCE_URLS } from '../../src/config';
import { PERF, median, pagesUrl } from './perf-config';

const TILE_HOST = new URL(SOURCE_URLS.baseMapStyle).hostname;
const URL_UNDER_TEST = process.env['PERF_URL'] || pagesUrl(SOURCE_URLS.repository);

test.describe('timing', () => {
  test(`@timing the first race starts within ${PERF.limitMs} ms on a throttled phone (median of ${PERF.runs})`, async ({ browser }, info) => {
    info.setTimeout(PERF.runs * (PERF.waitMs + 15_000));
    const times: number[] = [];
    for (let run = 1; run <= PERF.runs; run += 1) {
      const context = await browser.newContext({
        viewport: PERF.viewport,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        serviceWorkers: 'block',
      });
      // The page and its own files only: anything else (the map's tiles) is blocked.
      const reached = new Set<string>();
      await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        reached.add(url.host);
        return url.host === new URL(URL_UNDER_TEST).host ? route.continue() : route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: PERF.network.latencyMs,
        downloadThroughput: PERF.network.downloadBytesPerSecond,
        uploadThroughput: PERF.network.uploadBytesPerSecond,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: PERF.cpuSlowdown });
      await page.goto(URL_UNDER_TEST, { waitUntil: 'commit', timeout: PERF.waitMs });
      await page.waitForFunction(() => performance.getEntriesByName('race-start', 'mark').length > 0, null, { timeout: PERF.waitMs });
      const ms = await page.evaluate(() => performance.getEntriesByName('race-start', 'mark')[0]!.startTime);
      times.push(ms);
      console.log(`PERF run ${run} of ${PERF.runs}: race-start at ${Math.round(ms)} ms`);
      // Nothing was reached but the page's own host and (blocked) the tile host.
      expect([...reached].filter((h) => h !== new URL(URL_UNDER_TEST).host && h !== TILE_HOST), `run ${run}: hosts reached`).toEqual([]);
      await context.close();
    }
    const mid = median(times);
    console.log(`PERF ${URL_UNDER_TEST}`);
    console.log(`PERF runs (ms): ${times.map((t) => Math.round(t)).join(', ')}`);
    console.log(`PERF median: ${Math.round(mid)} ms (limit ${PERF.limitMs} ms)`);
    expect(mid, `median of ${times.map((t) => Math.round(t)).join(', ')} ms`).toBeLessThan(PERF.limitMs);
  });
});
