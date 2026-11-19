// Boot the race screen in jsdom: the body of index.html, a loader whose fetch
// serves a data folder from disk (the real files or the fixture), a fixed clock,
// a fake time source for the race clock and a chosen layout and motion level.
import { LEAD_PAIR, TIMINGS } from '../../src/config';
import { type FetchLike, createLoader } from '../../src/data/load';
import type { Pair } from '../../src/data/types';
import type { MotionLevel } from '../../src/state/model';
import { type App, createApp } from '../../src/view/app';
import type { Layout } from '../../src/view/vehicles';
import { readRepoJson, readRepoText, repoFileExists } from './files';
import { type FakeTime, fakeTime } from './time';

const BASE = '/Ghost-Line/data/';

/** A fetch serving files from a repository folder; `fail` names files that fail. */
export function folderFetch(folder: string, fail: ReadonlySet<string> = new Set()): FetchLike {
  return async (url) => {
    const name = url.slice(BASE.length);
    const path = `${folder}/${name}`;
    const ok = !fail.has(name) && repoFileExists(path);
    return { ok, status: ok ? 200 : 404, json: async () => readRepoJson(path) };
  };
}

export type PageOptions = {
  folder?: string;
  now?: Date;
  /** The layout on screen, or a function a test can change it through. */
  layout?: Layout | (() => Layout);
  query?: string;
  fail?: ReadonlySet<string>;
  /** The device's motion level at boot; full by default. */
  motion?: MotionLevel;
  /** The time source the race clock runs on; a fresh fake one by default. */
  time?: FakeTime;
  /** The pair the loader requires index.json to list: the lead pair, or one of the fixture's. */
  leadPair?: Pair;
};

/** Mount index.html's body and boot the app. Resolves when the first boot has finished. */
export async function bootPage(options: PageOptions = {}): Promise<App> {
  const html = readRepoText('web/index.html');
  const body = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
  const app = createApp({
    doc: document,
    loader: createLoader({
      baseUrl: BASE,
      timeoutMs: TIMINGS.dataTimeoutMs,
      leadPair: options.leadPair ?? LEAD_PAIR,
      fetch: folderFetch(options.folder ?? 'web/public/data', options.fail),
    }),
    // 20:00 in New York is outside the slider range, so the start falls back to 10:00.
    now: () => options.now ?? new Date('2026-11-04T20:00:00-05:00'),
    layout: () => (typeof options.layout === 'function' ? options.layout() : (options.layout ?? 'phone')),
    query: options.query ?? '',
    motion: options.motion ?? 'full',
    timers: options.time ?? fakeTime(),
  });
  await app.boot();
  return app;
}
