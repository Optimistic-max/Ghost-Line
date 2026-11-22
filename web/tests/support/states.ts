// Every state of the screen a jsdom test can reach (R17.1): loading, racing at
// several moments, each result, before the midday table, the inferred corner,
// no one-seat ride (the made-up fixture line), the link banners, the data
// error, the map unavailable, the corner picker in both steps, each sheet, the
// share status, and reduced motion. Shared by the accessibility tests (task 18)
// and the wording tests (task 19). Each state is reached on the page in
// document.body; it gives back the fake clock it runs on (none while loading),
// so a test can let a pending announcement land.
import { vi } from 'vitest';
import { LEAD_PAIR, TIMINGS } from '../../src/config';
import * as C from '../../src/copy/copy';
import type { Pair } from '../../src/data/types';
import type { Layout } from '../../src/view/vehicles';
import { FIXTURE_DIR, fixtureData } from './fixture';
import { type PageOptions, bootPage, mountPage } from './page';
import { raceOf, realData, slugNamed } from './realdata';
import { text } from './render';
import { type FakeTime, fakeTime } from './time';

const { index } = realData();
export const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
export const westToPreston: Pair = { origin: slugNamed('Westwood & Carey'), dest: slugNamed('Preston & Caroline') };
export const inferredPair: Pair = { origin: index.corners.find((c) => c.inferred)!.slug, dest: slugNamed('Aliceanna & Bond') };
const fixture = fixtureData();
/** The fixture pair with no one-seat ride (R6.8). */
export const noRide: Pair = fixture.index.pairs.find((p) => fixture.races.get(`${p.origin}__${p.dest}`)!.today.trips.length === 0)!;
/** A New York wall time on the service date, so the page starts at that minute. */
export const newYork = (hhmm: string): Date => new Date(`${index.service_date}T${hhmm}:00-05:00`);
export const query = (p: Pair): string => `?from=${p.origin}&to=${p.dest}`;

/** Let the loader's promises settle. */
export async function settle(): Promise<void> {
  for (let k = 0; k < 5; k += 1) await new Promise((done) => setTimeout(done, 0));
}

export const click = (selector: string): void => {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`nothing matches ${selector}`);
  el.click();
};

export type Reach = (layout: Layout) => Promise<FakeTime | null>;

/** Boot a page on a fresh fake clock and give the clock back. */
async function boot(layout: Layout, options: PageOptions = {}): Promise<FakeTime> {
  const time = fakeTime();
  await bootPage({ ...options, layout, time });
  return time;
}

/** The lead pair's race, this many real milliseconds after the page booted (the 2,000 ms orientation pause of a guided first visit included). */
function racingAt(ms: number): Reach {
  return async (layout) => {
    const time = await boot(layout);
    time.advance(ms);
    if (!document.querySelector('.clock-row')) throw new Error(`the race is over at ${ms} ms`);
    return time;
  };
}

/** A finished race with reduced motion, then the controls to click, in order. */
function finished(options: PageOptions, ...clicks: string[]): Reach {
  return async (layout) => {
    const time = await boot(layout, { motion: 'reduced', ...options });
    await settle();
    for (const selector of clicks) click(selector);
    return time;
  };
}

// A clock-derived start needs a valid share link (story-layer Req 3.3); with no query the visit is guided at 10:00.
const beforeTable = { query: query(lead), now: newYork(raceOf(lead).races[0]!.t) };
const todayWins = { query: query(westToPreston), now: newYork('11:23') };
const photoFinish = { query: query(lead), now: newYork('10:30') };
const fixtureLine = { folder: FIXTURE_DIR, query: query(noRide), leadPair: noRide };
const sources = '#card-scroll button.num[data-source="total-today"], #card-scroll button.num[data-source="total-1938"]';

export const STATES: [string, Reach][] = [
  [
    'loading',
    async (layout) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      void mountPage({ layout, hang: new Set(['summary.json']) }).boot();
      await vi.advanceTimersByTimeAsync(0);
      if (!document.getElementById('loading-line')) throw new Error('not loading');
      // The page stays loading (its 3 s limit is on the fake clock, which stops here); the checks need real timers.
      vi.useRealTimers();
      return null;
    },
  ],
  ['ready, before the first race starts', racingAt(0)],
  ['racing: the trolley riding, the bus waiting', racingAt(TIMINGS.orientationMs + 2000)],
  ['racing: the trolley in, the result shown, the bus waiting', racingAt(TIMINGS.orientationMs + 4500)],
  ['racing: the bus riding', racingAt(TIMINGS.orientationMs + 9000)],
  ['racing: the bus walking from the stop', racingAt(TIMINGS.orientationMs + 10800)],
  ['racing, with the Sources sheet open', async (layout) => {
    const time = await racingAt(TIMINGS.orientationMs + 2000)(layout);
    // A time on the departures board, which shows while the race runs.
    click('#card-scroll .board button.num');
    return time;
  }],
  ['1938 wins, reduced motion', finished({})],
  ['today wins', finished(todayWins)],
  ['photo finish', finished(photoFinish)],
  ['before the midday table', finished(beforeTable)],
  ['the inferred corner', finished({ query: query(inferredPair) })],
  ['no one-seat ride (the made-up fixture line)', finished(fixtureLine)],
  ['a shared link, with its banner', finished({ query: query(lead) })],
  ['a bad link, with its banner', finished({ query: `?from=nowhere&to=${lead.dest}` })],
  ['the data error', finished({ fail: new Set(['summary.json']) })],
  [
    'the map unavailable, with no route drawing',
    async (layout) => {
      const time = await finished({ fail: new Set(['route.geojson']) })(layout);
      if (text(document.querySelector('.map-notice')) !== C.MAP_UNAVAILABLE_NO_DRAWING) throw new Error('no notice');
      return time;
    },
  ],
  [
    'the map unavailable, with the route drawing',
    async (layout) => {
      const time = fakeTime();
      const app = await bootPage({ layout, time, motion: 'reduced' });
      await settle();
      app.store.dispatch({ type: 'map/status', status: 'unavailable' });
      return time;
    },
  ],
  ['the corner picker, first step', finished({}, '[data-action="picker"]')],
  ['the corner picker, second step', finished({}, '[data-action="picker"]', `.corner-choice[data-slug="${lead.origin}"]`)],
  ['the Sources sheet at a number', finished({}, '#card-scroll button.num[data-source="wait-1938"]')],
  ['the Sources sheet, today wins', finished(todayWins, sources)],
  ['the Sources sheet, photo finish', finished(photoFinish, sources)],
  ['the Sources sheet, before the midday table', finished(beforeTable, sources)],
  ['the Sources sheet, the inferred corner', finished({ query: query(inferredPair) }, sources)],
  ['the Sources sheet, no one-seat ride', finished(fixtureLine, '#card-scroll button.num[data-source="total-1938"]')],
  ['About and credits', finished({}, 'button.info')],
  ['When today wins', finished({}, '[data-action="whentoday"]')],
  [
    'the link copied',
    async (layout) => {
      const time = await boot(layout, { motion: 'reduced', share: { writeText: async () => {} } });
      click('[data-action="share"]');
      await settle();
      if (text(document.getElementById('share-status')) !== C.LINK_COPIED) throw new Error('not copied');
      return time;
    },
  ],
];
