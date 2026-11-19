// Mounts the race screen into the static shell of index.html and wires it to the
// store and the loader. view/* modules draw from derived view data; this module
// connects them to state and events.
import { BREAKPOINTS, LEAD_PAIR, TIMINGS } from '../config';
import { DATA_ERROR, DATA_INCOMPLETE, TRY_AGAIN, lineLabel } from '../copy/copy';
import { pairKey } from '../data/files';
import { type Loader, createLoader, dataBaseUrl } from '../data/load';
import { sliderRange } from '../data/lookup';
import type { Pair } from '../data/types';
import { routeNumberOf, yearOf } from '../format/line';
import { decode } from '../format/share';
import { defaultStart } from '../format/time';
import { initialState } from '../state/actions';
import { derive } from '../state/derive';
import type { AppState } from '../state/model';
import { type Store, createStore } from '../state/store';
import { renderCard } from './card';
import { append, h } from './dom';
import { cardButtons, footer } from './buttons';
import { SourceRegistry } from './numbers';
import type { Layout } from './vehicles';

export type AppOptions = {
  doc: Document;
  loader: Loader;
  /** The current instant, for the default start time. */
  now: () => Date;
  /** Which layout is on screen. */
  layout: () => Layout;
  /** The page's query string, for a shared pair. */
  query: string;
};

export type App = { store: Store; registry: SourceRegistry; render(): void; boot(): Promise<void> };

function byId<T extends HTMLElement>(doc: Document, id: string): T {
  const el = doc.getElementById(id);
  if (!el) throw new Error(`index.html has no #${id}`);
  return el as T;
}

export function createApp(options: AppOptions): App {
  const { doc, loader } = options;
  // Before index.json is read, only the lead pair's slugs are known; the shared pair is checked against index.json at boot.
  const startPair: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
  const store = createStore(initialState(startPair, 'full'));
  const registry = new SourceRegistry();
  const scroll = byId(doc, 'card-scroll');
  const buttons = byId(doc, 'card-buttons');
  const foot = byId(doc, 'card-footer');
  const label = byId(doc, 'line-label');

  function topBar(state: AppState): void {
    const data = state.data;
    const n = data.status === 'ready' ? routeNumberOf(data.index.line) : null;
    const year = data.status === 'ready' ? yearOf(data.index.effective) : null;
    label.textContent = n && year ? lineLabel(n, year) : '';
    label.hidden = !(n && year);
  }

  /** The data error: corner names stay, no number anywhere (R14.1); task 15.4 completes this state. */
  function errorView(): HTMLElement[] {
    const names = doc.getElementById('pair-names')?.cloneNode(true) as HTMLElement | undefined;
    return [
      names ?? h('span'),
      h(
        'div',
        { class: 'data-error', role: 'alert' },
        h('p', { class: 'data-error-title display' }, DATA_ERROR),
        h('p', { class: 'data-error-line' }, DATA_INCOMPLETE),
        h('button', { type: 'button', class: 'button button-filled', 'data-action': 'retry' }, TRY_AGAIN),
      ),
    ];
  }

  function render(): void {
    const state = store.get();
    topBar(state);
    const derived = derive(state);
    if (derived.status === 'loading') return;
    if (derived.status === 'error') {
      const children = errorView();
      registry.clear();
      scroll.replaceChildren(...children);
      buttons.replaceChildren();
      foot.replaceChildren();
      return;
    }
    if (state.data.status !== 'ready' || state.minute === null) return;
    const race = state.data.races.get(pairKey(derived.view.pair));
    if (!race) return;
    registry.clear();
    scroll.replaceChildren();
    buttons.replaceChildren();
    foot.replaceChildren();
    append(
      scroll,
      ...renderCard(registry, {
        index: state.data.index,
        summary: state.data.summary,
        race,
        view: derived.view,
        minute: state.minute,
        minuteFromClock: state.minuteFromClock,
        layout: options.layout(),
      }),
    );
    append(buttons, ...cardButtons());
    append(foot, ...footer());
  }

  /**
   * Load the data for the pair the address names, or the lead pair. The named
   * pair can only be checked against index.json once it is read, so it is tried
   * first; if it does not load, the lead pair is loaded instead (the bad-link
   * banner is task 14).
   */
  async function boot(): Promise<void> {
    store.dispatch({ type: 'data/loading' });
    const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
    const named = decode(options.query, new Set(slugsOf(options.query))).pair;
    let pair = named;
    let result = await loader.boot(pair);
    if (result.status !== 'ready' && !samePair(pair, lead)) {
      pair = lead;
      result = await loader.boot(pair);
    }
    if (result.status !== 'ready') {
      store.dispatch({ type: 'data/error' });
      return;
    }
    const { index, summary, race } = result.data;
    if (!samePair(store.get().pair, pair)) store.dispatch({ type: 'pair/set', pair });
    const { first, last } = sliderRange(race);
    store.dispatch({ type: 'data/ready', index, summary, race, start: defaultStart(options.now(), first, last) });
  }

  async function changePair(): Promise<void> {
    const state = store.get();
    if (state.data.status !== 'ready') return;
    const result = await loader.race(state.pair);
    if (result.status === 'ready') store.dispatch({ type: 'data/race', race: result.data });
    else store.dispatch({ type: 'data/error' });
  }

  store.subscribe((state, previous) => {
    render();
    if (state.pair !== previous.pair && state.data.status === 'ready') void changePair();
  });

  doc.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest<HTMLElement>('[data-action]');
    if (!target) return;
    switch (target.dataset['action']) {
      case 'minus':
        store.dispatch({ type: 'minute/step', step: -1 });
        break;
      case 'plus':
        store.dispatch({ type: 'minute/step', step: 1 });
        break;
      case 'retry':
        void boot();
        break;
    }
  });
  doc.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement | null;
    if (target?.id === 'start-time') store.dispatch({ type: 'minute/set', minute: Number(target.value) });
  });

  return { store, registry, render, boot };
}

function samePair(a: Pair, b: Pair): boolean {
  return a.origin === b.origin && a.dest === b.dest;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The slugs a query names that have the shape of a corner slug, so decode can
 * accept them before index.json is read. Anything else never reaches a file path.
 */
function slugsOf(query: string): string[] {
  try {
    const params = new URLSearchParams(query);
    return [...params.getAll('from'), ...params.getAll('to')].filter((s) => SLUG.test(s));
  } catch {
    return [];
  }
}

/** Boot the page: the real loader, the real clock and the layout from the media query. */
export function startPage(doc: Document, win: Window): App {
  const media = win.matchMedia(`(min-width: ${BREAKPOINTS.desktopMinWidth}px)`);
  const app = createApp({
    doc,
    loader: createLoader({ baseUrl: dataBaseUrl(), timeoutMs: TIMINGS.dataTimeoutMs, leadPair: LEAD_PAIR }),
    now: () => new Date(),
    layout: () => (media.matches ? 'desktop' : 'phone'),
    query: win.location.search,
  });
  media.addEventListener('change', () => app.render());
  void app.boot();
  return app;
}
