// Boot the race screen in jsdom: the body of index.html, a loader whose fetch
// serves a data folder from disk (the real files or the fixture), a fixed clock,
// a fake time source for the race clock and a chosen layout and motion level.
import { LEAD_PAIR, TIMINGS } from '../../src/config';
import { type FetchLike, createLoader } from '../../src/data/load';
import type { Pair } from '../../src/data/types';
import type { MotionLevel } from '../../src/state/model';
import { type App, type AppOptions, createApp } from '../../src/view/app';
import type { ShareDeps } from '../../src/view/sharing';
import type { Layout } from '../../src/view/vehicles';
import { readRepoJson, readRepoText, repoFileExists } from './files';
import { type FakeTime, fakeTime } from './time';

const BASE = '/Ghost-Line/data/';

/**
 * A fetch serving files from a repository folder; `fail` names files that fail,
 * and `override` serves changed copies of files by name (for example a
 * summary.json with other counts).
 */
export function folderFetch(
  folder: string,
  fail: ReadonlySet<string> = new Set(),
  override: Record<string, unknown> = {},
  hang: ReadonlySet<string> = new Set(),
): FetchLike {
  return async (url) => {
    const name = url.slice(BASE.length);
    const path = `${folder}/${name}`;
    if (hang.has(name)) return new Promise(() => {});
    if (name in override) return { ok: true, status: 200, json: async () => structuredClone(override[name]) };
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
  /** Changed copies of data files, by file name. */
  override?: Record<string, unknown>;
  /** The share sheet and clipboard to offer; none by default. */
  share?: ShareDeps;
  /** Files whose request never answers. */
  hang?: ReadonlySet<string>;
  /** A stand-in for the map chunk; none by default, so the route drawing stays. */
  loadMap?: AppOptions['loadMap'];
  /** When the page is idle; by default the app's own timeout on the fake clock. */
  whenIdle?: AppOptions['whenIdle'];
};

/** The app's options for a test page. */
function appOptions(options: PageOptions): AppOptions {
  return {
    doc: document,
    loader: createLoader({
      baseUrl: BASE,
      timeoutMs: TIMINGS.dataTimeoutMs,
      leadPair: options.leadPair ?? LEAD_PAIR,
      fetch: folderFetch(options.folder ?? 'web/public/data', options.fail, options.override, options.hang),
    }),
    // 20:00 in New York is outside the slider range, so the start falls back to 10:00.
    now: () => options.now ?? new Date('2026-11-04T20:00:00-05:00'),
    layout: () => (typeof options.layout === 'function' ? options.layout() : (options.layout ?? 'phone')),
    query: options.query ?? '',
    motion: options.motion ?? 'full',
    timers: options.time ?? fakeTime(),
    share: options.share ?? {},
    // jsdom's own address bar: tests read window.location after a change.
    address: {
      origin: window.location.origin,
      path: window.location.pathname,
      replace: (url) => window.history.replaceState(null, '', url),
    },
    loadMap: options.loadMap,
    whenIdle: options.whenIdle,
  };
}

/** Mount index.html's body and create the app without booting it (for the loading state). */
export function mountPage(options: PageOptions = {}): App {
  const html = readRepoText('web/index.html');
  const body = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';
  // The page's language and title come with it, as a browser would have them from index.html.
  document.documentElement.lang = /<html[^>]*\slang="([^"]*)"/.exec(html)?.[1] ?? '';
  document.title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
  return createApp(appOptions(options));
}

/** Mount index.html's body and boot the app. Resolves when the first boot has finished. */
export async function bootPage(options: PageOptions = {}): Promise<App> {
  const app = mountPage(options);
  await app.boot();
  return app;
}