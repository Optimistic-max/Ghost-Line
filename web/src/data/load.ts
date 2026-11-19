// Loading the generated files (design 3.3). index.json, summary.json and the
// pair's race file are fetched together and must all pass their shape checks
// within the timeout, or the result is the one data error. route.geojson is
// loaded separately and never part of that gate: it only feeds the map.
import { INDEX_FILE, ROUTE_FILE, SUMMARY_FILE, pairKey, raceFileName } from './files';
import { hasPair } from './lookup';
import { type Catalog, catalogOf, checkIndex, checkRace, checkRoute, checkSummary } from './shape';
import type { Index, Pair, RaceFile, Route, Summary } from './types';

/** The part of fetch the loader uses, so tests can pass a fake. */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** A load either gives data or the single data error. `cause` is for logs and tests, never shown. */
export type Loaded<T> = { status: 'ready'; data: T } | { status: 'data-error'; cause: string };

export type BootData = { index: Index; summary: Summary; catalog: Catalog; race: RaceFile };

export type LoaderOptions = {
  /** URL of the data folder, ending in a slash. */
  baseUrl: string;
  /** Without valid data after this long, the load is a data error. */
  timeoutMs: number;
  /** The lead pair; boot fails when index.json does not list it. */
  leadPair: Pair;
  fetch?: FetchLike;
};

export type Loader = {
  /** index.json, summary.json and the pair's race file, together. Retry calls it again. */
  boot(pair: Pair): Promise<Loaded<BootData>>;
  /** A pair's race file: from the cache, or fetched on demand. */
  race(pair: Pair): Promise<Loaded<RaceFile>>;
  /** A race file already loaded, or undefined. */
  cachedRace(pair: Pair): RaceFile | undefined;
  /** route.geojson, or null on any failure (the map then shows its fallback). */
  route(): Promise<Route | null>;
};

/** The data folder under Vite's base path. */
export function dataBaseUrl(): string {
  return `${import.meta.env.BASE_URL}data/`;
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/**
 * Run `work` with an abort signal. Settles once: with its value, with its error,
 * or with a timeout, whichever comes first. A late arrival changes nothing.
 */
function gate<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<Loaded<T>> {
  const controller = new AbortController();
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: Loaded<T>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (result.status === 'data-error') controller.abort();
      resolve(result);
    };
    const timer = setTimeout(() => settle({ status: 'data-error', cause: 'timeout' }), timeoutMs);
    work(controller.signal).then(
      (data) => settle({ status: 'ready', data }),
      (error: unknown) => settle({ status: 'data-error', cause: describe(error) }),
    );
  });
}

export function createLoader(options: LoaderOptions): Loader {
  const fetchImpl: FetchLike = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const races = new Map<string, RaceFile>();
  const pending = new Map<string, Promise<Loaded<RaceFile>>>();
  let catalog: Catalog | null = null;
  let route: Route | null = null;

  async function get(name: string, signal?: AbortSignal): Promise<unknown> {
    const response = await fetchImpl(`${options.baseUrl}${name}`, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${name}`);
    return response.json();
  }

  return {
    async boot(pair) {
      const result = await gate(async (signal) => {
        const [rawIndex, rawSummary, rawRace] = await Promise.all([
          get(INDEX_FILE, signal),
          get(SUMMARY_FILE, signal),
          get(raceFileName(pair), signal),
        ]);
        const index = checkIndex(rawIndex);
        for (const needed of [options.leadPair, pair]) {
          if (!hasPair(index, needed)) throw new Error(`index.json does not list ${pairKey(needed)}`);
        }
        const fileCatalog = catalogOf(index);
        const summary = checkSummary(rawSummary, fileCatalog);
        const race = checkRace(rawRace, fileCatalog, pair);
        return { index, summary, catalog: fileCatalog, race };
      }, options.timeoutMs);
      if (result.status === 'ready') {
        catalog = result.data.catalog;
        races.set(pairKey(pair), result.data.race);
      }
      return result;
    },

    race(pair) {
      const key = pairKey(pair);
      const cached = races.get(key);
      if (cached) return Promise.resolve({ status: 'ready', data: cached });
      const known = catalog;
      if (!known) return Promise.resolve({ status: 'data-error', cause: 'index.json is not loaded' });
      let request = pending.get(key);
      if (!request) {
        request = gate(async (signal) => checkRace(await get(raceFileName(pair), signal), known, pair), options.timeoutMs);
        pending.set(key, request);
        void request.then((result) => {
          pending.delete(key);
          if (result.status === 'ready') races.set(key, result.data);
        });
      }
      return request;
    },

    cachedRace(pair) {
      return races.get(pairKey(pair));
    },

    async route() {
      if (route) return route;
      if (!catalog) return null;
      try {
        route = checkRoute(await get(ROUTE_FILE), catalog);
        return route;
      } catch {
        return null;
      }
    },
  };
}
