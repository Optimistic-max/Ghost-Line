// Task 15.2: the phone's View route / Hide route button, the strip versus the map
// drawing, desktop having no toggle, and map failures leaving the race alone
// (story-layer Req 12.3, 12.8, 12.9, 12.10). The request-log checks run in task 20.
import { afterEach, describe, expect, it } from 'vitest';
import { HIDE_ROUTE, VIEW_ROUTE } from '../../src/copy/copy';
import type { DrawingPlan } from '../../src/map/routedrawing';
import type { MapStart } from '../../src/map/map';
import type { MapModule } from '../../src/view/mapview';
import type { Layout } from '../../src/view/vehicles';
import { bootPage } from '../support/page';

afterEach(() => {
  document.body.innerHTML = '';
  delete document.documentElement.dataset['route'];
  window.history.replaceState(null, '', '/');
});

async function settle(): Promise<void> {
  for (let k = 0; k < 5; k += 1) await new Promise((done) => setTimeout(done, 0));
}

type Started = { start: MapStart; corners: DrawingPlan[]; removed: boolean };

function fakeChunk(): { load: () => Promise<MapModule>; started: Started[]; imports: { count: number } } {
  const started: Started[] = [];
  const imports = { count: 0 };
  const module: MapModule = {
    startMap(start) {
      const run: Started = { start, corners: [], removed: false };
      started.push(run);
      return {
        corners: (plan) => run.corners.push(plan),
        marker: () => undefined,
        remove: () => {
          run.removed = true;
        },
      };
    },
  };
  return {
    load: () => {
      imports.count += 1;
      return Promise.resolve(module);
    },
    started,
    imports,
  };
}

const now = (run: () => void): void => run();
const area = (): HTMLElement => document.getElementById('map-area')!;
const toggle = (): HTMLButtonElement => area().querySelector<HTMLButtonElement>('.route-toggle')!;
const labels = (): number => area().querySelectorAll('.route-drawing .street-label').length;
const viewBox = (): string => area().querySelector('.route-drawing')!.getAttribute('viewBox') ?? '';
const lanes = (): Element | null => document.querySelector('#card-scroll .lanes');

describe('the phone toggle (Req 12.3, 12.8, 12.9)', () => {
  it('starts as the strip: View route, aria-expanded false, no map, no import', async () => {
    const chunk = fakeChunk();
    const app = await bootPage({ layout: 'phone', loadMap: chunk.load, whenIdle: now });
    await settle();
    expect(toggle().hidden).toBe(false);
    expect(toggle().textContent).toBe(VIEW_ROUTE);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(document.documentElement.dataset['route']).toBe('strip');
    expect(app.store.get().routeOpen).toBe(false);
    expect(area().querySelectorAll('.route-drawing')).toHaveLength(1);
    expect(labels()).toBe(0);
    expect(chunk.imports.count).toBe(0);
    expect(chunk.started).toHaveLength(0);
    expect(area().querySelector('.map-canvas')).toBeNull();
    expect(area().querySelector<HTMLElement>('.map-credit')!.hidden).toBe(true);
  });

  it('View route opens the map: Hide route, aria-expanded true, the full drawing and one map start', async () => {
    const chunk = fakeChunk();
    const app = await bootPage({ layout: 'phone', loadMap: chunk.load, whenIdle: now });
    await settle();
    const stripBox = viewBox();
    toggle().click();
    await settle();
    expect(app.store.get().routeOpen).toBe(true);
    expect(toggle().textContent).toBe(HIDE_ROUTE);
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(document.documentElement.dataset['route']).toBe('open');
    expect(viewBox()).not.toBe(stripBox);
    expect(labels()).toBeGreaterThan(0);
    expect(chunk.imports.count).toBe(1);
    expect(chunk.started).toHaveLength(1);
    expect(chunk.started[0]!.start.layout).toBe('phone');
    expect(area().querySelector('.map-canvas')).not.toBeNull();
    expect(area().querySelectorAll('.route-drawing')).toHaveLength(1);
  });

  it('Hide route removes the map and canvas, draws the strip again and does not stay open', async () => {
    const chunk = fakeChunk();
    const app = await bootPage({ layout: 'phone', loadMap: chunk.load, whenIdle: now });
    await settle();
    const stripBox = viewBox();
    toggle().click();
    await settle();
    chunk.started[0]!.start.ready();
    expect(app.store.get().mapStatus).toBe('ready');
    toggle().click();
    await settle();
    expect(chunk.started[0]!.removed).toBe(true);
    expect(area().querySelector('.map-canvas')).toBeNull();
    expect(app.store.get().routeOpen).toBe(false);
    expect(app.store.get().mapStatus).toBe('pending');
    expect(toggle().textContent).toBe(VIEW_ROUTE);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(document.documentElement.dataset['route']).toBe('strip');
    expect(viewBox()).toBe(stripBox);
    expect(labels()).toBe(0);
    expect(area().querySelectorAll('.route-drawing')).toHaveLength(1);
    expect(area().querySelector('.route-drawing')!.classList.contains('is-faded')).toBe(false);
    expect(chunk.started).toHaveLength(1);
  });

  it('opening again after Hide route starts a second map', async () => {
    const chunk = fakeChunk();
    await bootPage({ layout: 'phone', loadMap: chunk.load, whenIdle: now });
    await settle();
    toggle().click();
    await settle();
    toggle().click();
    await settle();
    toggle().click();
    await settle();
    expect(chunk.started).toHaveLength(2);
    expect(chunk.started[0]!.removed).toBe(true);
    expect(chunk.started[1]!.removed).toBe(false);
  });

  it('a chunk that arrives after Hide route is dropped', async () => {
    let release: (module: MapModule) => void = () => undefined;
    const started: Started[] = [];
    const module: MapModule = {
      startMap(start) {
        const run: Started = { start, corners: [], removed: false };
        started.push(run);
        return { corners: () => undefined, marker: () => undefined, remove: () => undefined };
      },
    };
    await bootPage({
      layout: 'phone',
      loadMap: () => new Promise<MapModule>((resolve) => (release = resolve)),
      whenIdle: now,
    });
    await settle();
    toggle().click();
    await settle();
    toggle().click();
    release(module);
    await settle();
    expect(started).toHaveLength(0);
    expect(area().querySelector('.map-canvas')).toBeNull();
  });
});

describe('desktop has no toggle (Req 12.8)', () => {
  it('hides the button, never draws the strip, and loads the map when idle', async () => {
    const chunk = fakeChunk();
    await bootPage({ layout: 'desktop', loadMap: chunk.load, whenIdle: now });
    await settle();
    expect(toggle().hidden).toBe(true);
    expect(document.documentElement.dataset['route']).toBe('open');
    expect(labels()).toBeGreaterThan(0);
    expect(chunk.started).toHaveLength(1);
  });
});

describe('failures leave the race alone (Req 12.10)', () => {
  async function opened(
    options: { loadMap: () => Promise<MapModule> },
  ): Promise<Awaited<ReturnType<typeof bootPage>>> {
    const app = await bootPage({ layout: 'phone', loadMap: options.loadMap, whenIdle: now });
    await settle();
    toggle().click();
    await settle();
    return app;
  }

  it('an import failure shows the notice, keeps the drawing and the race, and View route can try again', async () => {
    let fail = true;
    const chunk = fakeChunk();
    const app = await opened({ loadMap: () => (fail ? Promise.reject(new Error('blocked')) : chunk.load()) });
    const data = app.store.get().data;
    expect(app.store.get().mapStatus).toBe('unavailable');
    expect(area().dataset['mapFailed']).toBe('import');
    expect(app.store.get().data).toBe(data);
    expect(area().querySelector<HTMLElement>('.map-notice')!.hidden).toBe(false);
    expect(area().querySelectorAll('.route-drawing')).toHaveLength(1);
    expect(lanes()).not.toBeNull();
    // Hide route, then View route with the chunk available again.
    fail = false;
    toggle().click();
    await settle();
    toggle().click();
    await settle();
    expect(app.store.get().mapStatus).toBe('pending');
    expect(area().dataset['mapFailed']).toBeUndefined();
    expect(chunk.started).toHaveLength(1);
    expect(area().querySelector<HTMLElement>('.map-notice')!.hidden).toBe(true);
  });

  it.each(['webgl', 'tile'])('a %s failure removes the map, keeps the drawing and the race', async (cause) => {
    const chunk = fakeChunk();
    const app = await opened({ loadMap: chunk.load });
    const data = app.store.get().data;
    chunk.started[0]!.start.failed(cause);
    expect(chunk.started[0]!.removed).toBe(true);
    expect(area().dataset['mapFailed']).toBe(cause);
    expect(app.store.get().mapStatus).toBe('unavailable');
    expect(app.store.get().data).toBe(data);
    expect(area().querySelector('.map-canvas')).toBeNull();
    expect(area().querySelector<HTMLElement>('.map-notice')!.hidden).toBe(false);
    expect(area().querySelectorAll('.route-drawing')).toHaveLength(1);
    expect(area().querySelector('.route-drawing')!.classList.contains('is-faded')).toBe(false);
    expect(lanes()).not.toBeNull();
    expect(toggle().textContent).toBe(HIDE_ROUTE);
    expect(toggle().hidden).toBe(false);
  });

  it('a failed route.geojson shows the notice on a phone and the race still draws', async () => {
    const app = await bootPage({ layout: 'phone', fail: new Set(['route.geojson']) });
    await settle();
    expect(app.store.get().mapStatus).toBe('unavailable');
    expect(area().querySelector<HTMLElement>('.map-notice')!.hidden).toBe(false);
    expect(toggle().hidden).toBe(false);
    expect(lanes()).not.toBeNull();
  });

  it('a layout change from desktop to phone drops the map and shows the strip', async () => {
    let layout: Layout = 'desktop';
    const chunk = fakeChunk();
    const app = await bootPage({ layout: () => layout, loadMap: chunk.load, whenIdle: now });
    await settle();
    expect(chunk.started).toHaveLength(1);
    layout = 'phone';
    app.render();
    await settle();
    expect(chunk.started[0]!.removed).toBe(true);
    expect(document.documentElement.dataset['route']).toBe('strip');
    expect(toggle().hidden).toBe(false);
  });
});
