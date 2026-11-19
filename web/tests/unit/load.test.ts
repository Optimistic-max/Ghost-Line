// Task 3.3: the loader with a fake fetch serving the real files.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEAD_PAIR, TIMINGS } from '../../src/config';
import { INDEX_FILE, ROUTE_FILE, SUMMARY_FILE, raceFileName } from '../../src/data/files';
import { type FetchLike, createLoader } from '../../src/data/load';
import type { Pair } from '../../src/data/types';
import { readData } from '../support/realdata';

const BASE = '/Ghost-Line/data/';
const lead: Pair = { ...LEAD_PAIR };
const other: Pair = { origin: LEAD_PAIR.dest, dest: LEAD_PAIR.origin };

type Behaviour = 'ok' | 'reject' | 'http' | 'json' | 'shape' | 'hang' | { body: unknown };

type Fake = { fetch: FetchLike; calls: string[]; signals: (AbortSignal | undefined)[]; release(): void };

/** A fetch that serves web/public/data, with a behaviour per file name. */
function fakeFetch(behaviours: Record<string, Behaviour> = {}): Fake {
  const calls: string[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  const held: (() => void)[] = [];
  const fetch: FetchLike = (url, init) => {
    calls.push(url);
    signals.push(init?.signal);
    const name = url.slice(BASE.length);
    const behaviour = behaviours[name] ?? 'ok';
    const body = (): unknown => {
      if (typeof behaviour === 'object') return behaviour.body;
      const real = readData<Record<string, unknown>>(name);
      if (behaviour === 'shape') delete real[Object.keys(real)[1]!];
      return real;
    };
    const response = {
      ok: behaviour !== 'http',
      status: behaviour === 'http' ? 404 : 200,
      json: () => (behaviour === 'json' ? Promise.reject(new SyntaxError('Unexpected token <')) : Promise.resolve(body())),
    };
    if (behaviour === 'reject') return Promise.reject(new TypeError('Failed to fetch'));
    if (behaviour === 'hang') return new Promise((resolve) => held.push(() => resolve(response)));
    return Promise.resolve(response);
  };
  return { fetch, calls, signals, release: () => held.splice(0).forEach((go) => go()) };
}

function loaderWith(fake: Fake) {
  return createLoader({ baseUrl: BASE, timeoutMs: TIMINGS.dataTimeoutMs, leadPair: lead, fetch: fake.fetch });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('boot', () => {
  it('loads index, summary and the pair race file together, and nothing else', async () => {
    const fake = fakeFetch();
    const loader = loaderWith(fake);
    const result = await loader.boot(lead);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.data.index.line).toBe(readData<{ line: string }>(INDEX_FILE).line);
    expect(result.data.race.origin).toBe(lead.origin);
    expect(result.data.race.dest).toBe(lead.dest);
    expect(fake.calls.sort()).toEqual([INDEX_FILE, SUMMARY_FILE, raceFileName(lead)].map((n) => BASE + n).sort());
    expect(loader.cachedRace(lead)).toBe(result.data.race);
  });

  for (const file of [INDEX_FILE, SUMMARY_FILE, raceFileName(lead)]) {
    for (const behaviour of ['reject', 'http', 'json', 'shape'] as const) {
      it(`gives the data error when ${file} fails (${behaviour})`, async () => {
        const result = await loaderWith(fakeFetch({ [file]: behaviour })).boot(lead);
        expect(result.status).toBe('data-error');
      });
    }
  }

  it('gives the data error when index.json does not list the lead pair', async () => {
    const index = readData<{ pairs: Pair[] }>(INDEX_FILE);
    index.pairs = index.pairs.filter((p) => !(p.origin === lead.origin && p.dest === lead.dest));
    const result = await loaderWith(fakeFetch({ [INDEX_FILE]: { body: index } })).boot(other);
    expect(result.status).toBe('data-error');
  });

  it('gives the data error after the timeout, and a late arrival does not replace it', async () => {
    vi.useFakeTimers();
    const fake = fakeFetch({ [SUMMARY_FILE]: 'hang' });
    const loader = loaderWith(fake);
    let result: Awaited<ReturnType<typeof loader.boot>> | undefined;
    void loader.boot(lead).then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(TIMINGS.dataTimeoutMs - 1);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({ status: 'data-error', cause: 'timeout' });
    expect(fake.signals.every((s) => s?.aborted)).toBe(true);
    fake.release();
    await vi.advanceTimersByTimeAsync(TIMINGS.dataTimeoutMs);
    expect(result).toEqual({ status: 'data-error', cause: 'timeout' });
  });

  it('is ready when the files arrive just inside the timeout', async () => {
    vi.useFakeTimers();
    const fake = fakeFetch({ [INDEX_FILE]: 'hang' });
    const loader = loaderWith(fake);
    let status: string | undefined;
    void loader.boot(lead).then((r) => (status = r.status));
    await vi.advanceTimersByTimeAsync(TIMINGS.dataTimeoutMs - 1);
    fake.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(status).toBe('ready');
  });

  it('recovers on retry without a new loader', async () => {
    const behaviours: Record<string, Behaviour> = { [INDEX_FILE]: 'reject' };
    const loader = loaderWith(fakeFetch(behaviours));
    expect((await loader.boot(lead)).status).toBe('data-error');
    delete behaviours[INDEX_FILE];
    expect((await loader.boot(lead)).status).toBe('ready');
  });
});

describe('race files on demand', () => {
  it('needs a successful boot first', async () => {
    const result = await loaderWith(fakeFetch()).race(other);
    expect(result.status).toBe('data-error');
  });

  it('fetches a new pair once, caches it, and shares one request between callers', async () => {
    const fake = fakeFetch();
    const loader = loaderWith(fake);
    await loader.boot(lead);
    const [a, b] = await Promise.all([loader.race(other), loader.race(other)]);
    expect(a.status).toBe('ready');
    expect(b).toEqual(a);
    await loader.race(other);
    expect(fake.calls.filter((u) => u === BASE + raceFileName(other))).toHaveLength(1);
    expect(loader.cachedRace(other)?.origin).toBe(other.origin);
  });

  it('serves the boot pair from the cache', async () => {
    const fake = fakeFetch();
    const loader = loaderWith(fake);
    await loader.boot(lead);
    const calls = fake.calls.length;
    expect((await loader.race(lead)).status).toBe('ready');
    expect(fake.calls).toHaveLength(calls);
  });

  for (const behaviour of ['reject', 'http', 'json', 'shape'] as const) {
    it(`gives the data error when the on-demand file fails (${behaviour}), and recovers on retry`, async () => {
      const behaviours: Record<string, Behaviour> = { [raceFileName(other)]: behaviour };
      const loader = loaderWith(fakeFetch(behaviours));
      await loader.boot(lead);
      expect((await loader.race(other)).status).toBe('data-error');
      expect(loader.cachedRace(other)).toBeUndefined();
      delete behaviours[raceFileName(other)];
      expect((await loader.race(other)).status).toBe('ready');
    });
  }

  it('gives the data error when the on-demand file is the wrong pair', async () => {
    const loader = loaderWith(fakeFetch({ [raceFileName(other)]: { body: readData(raceFileName(lead)) } }));
    await loader.boot(lead);
    expect((await loader.race(other)).status).toBe('data-error');
  });
});

describe('route.geojson', () => {
  it('is not part of the boot gate', async () => {
    const fake = fakeFetch({ [ROUTE_FILE]: 'http' });
    const loader = loaderWith(fake);
    expect((await loader.boot(lead)).status).toBe('ready');
    expect(fake.calls).not.toContain(BASE + ROUTE_FILE);
    expect(await loader.route()).toBeNull();
  });

  it('loads after boot and is cached', async () => {
    const fake = fakeFetch();
    const loader = loaderWith(fake);
    await loader.boot(lead);
    const route = await loader.route();
    expect(route?.features.length).toBe(readData<{ features: unknown[] }>(ROUTE_FILE).features.length);
    expect(await loader.route()).toBe(route);
    expect(fake.calls.filter((u) => u === BASE + ROUTE_FILE)).toHaveLength(1);
  });

  it('gives null on a shape failure', async () => {
    const loader = loaderWith(fakeFetch({ [ROUTE_FILE]: 'shape' }));
    await loader.boot(lead);
    expect(await loader.route()).toBeNull();
  });
});
