// Mounts the race screen into the static shell of index.html and wires it to the
// store, the loader and the race clock. view/* modules draw from derived view
// data; this module connects them to state, time and events. Playback (design
// 9): the card is drawn once per race; the clock then moves it through racer.ts,
// the result is inserted at the result moment, and the finish is applied in
// place, so nothing is rebuilt while it moves.
import { BREAKPOINTS, FONT_SIZES, LEAD_PAIR, TIMINGS } from '../config';
import { DATA_ERROR, DATA_INCOMPLETE, TRY_AGAIN, lineLabel } from '../copy/copy';
import { pairKey } from '../data/files';
import { type Loader, createLoader, dataBaseUrl } from '../data/load';
import { sliderRange } from '../data/lookup';
import type { Index, Pair, RaceFile, Summary } from '../data/types';
import { routeNumberOf, yearOf } from '../format/line';
import { decode } from '../format/share';
import { defaultStart } from '../format/time';
import { type PageTimers, browserTimers, createClock } from '../play/clock';
import { initialMotion, motionClass, watchMotion } from '../play/motion';
import { SPARK, type Timeline, buildTimeline, sparkGapMs } from '../play/timeline';
import { initialState } from '../state/actions';
import { derive } from '../state/derive';
import type { AppState, MotionLevel, RaceView } from '../state/model';
import { type Store, createStore } from '../state/store';
import { announcement, createAnnouncer } from './a11y';
import { cardButtons, footer } from './buttons';
import {
  type CardInput,
  type Stage,
  boardShown,
  cardBoard,
  cardLayout,
  cardNumbers,
  renderCard,
  resultElements,
} from './card';
import { h, setVar } from './dom';
import { fitOneLine } from './layout';
import { SourceRegistry } from './numbers';
import { type Racer, createRacer } from './racer';
import { updateSlider } from './slider';
import { type Layout, vehicleWidths } from './vehicles';

export type AppOptions = {
  doc: Document;
  loader: Loader;
  /** The current instant, for the default start time. */
  now: () => Date;
  /** Which layout is on screen. */
  layout: () => Layout;
  /** The page's query string, for a shared pair. */
  query: string;
  /** The motion level at boot: the device's reduced-motion setting (R5.11). */
  motion: MotionLevel;
  /** Frames, timeouts, randomness and performance marks. */
  timers: PageTimers;
};

export type App = {
  store: Store;
  registry: SourceRegistry;
  render(): void;
  boot(): Promise<void>;
  /** The device's reduced-motion setting changed. */
  setMotion(level: MotionLevel): void;
};

/** What the card on screen was drawn from, so a store change redraws only what it must. */
type Drawn = {
  index: Index;
  summary: Summary;
  race: RaceFile;
  minute: number;
  layout: Layout;
  stage: Stage;
  resultShown: boolean;
};

const LEVELS: MotionLevel[] = ['full', 'lite', 'reduced'];

function byId<T extends HTMLElement>(doc: Document, id: string): T {
  const el = doc.getElementById(id);
  if (!el) throw new Error(`index.html has no #${id}`);
  return el as T;
}

export function createApp(options: AppOptions): App {
  const { doc, loader, timers } = options;
  const root = doc.documentElement;
  // Before index.json is read, only the lead pair's slugs are known; the shared pair is checked against index.json at boot.
  const startPair: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
  const store = createStore(initialState(startPair, options.motion));
  const registry = new SourceRegistry();
  const scroll = byId(doc, 'card-scroll');
  const buttons = byId(doc, 'card-buttons');
  const foot = byId(doc, 'card-footer');
  const label = byId(doc, 'line-label');
  const announcer = createAnnouncer(doc.getElementById('result-status'), timers.later, timers.cancel);

  let drawn: Drawn | null = null;
  let racer: Racer | null = null;
  /** The timeline of the race drawn in the racing stage. */
  let timeline: Timeline | null = null;
  /** The timer that starts the next race (R2.5, R3.5). */
  let pending: number | null = null;
  /** The slider moved: the race is stopped and only the time label follows it until the next race (R3.5). */
  let held = false;
  /** The slider thumb is held down. */
  let dragging = false;
  /** The card has been drawn once: the trolley's fade-in is for the first paint only (R2.5). */
  let painted = false;
  let marked = false;
  /** The watchdog found the device too slow; the extra motion stays off for the session. */
  let slowDevice = false;
  /** The race last started, and the race last announced: one announcement per race (R13.2). */
  let run: object | null = null;
  let announced: object | null = null;
  let spark: number | null = null;

  const clock = createClock(timers, {
    frame(elapsed) {
      racer?.frame(elapsed);
      setVar(root, '--elapsed', elapsed);
    },
    arrive(side) {
      racer?.arrive(side);
    },
    result() {
      store.dispatch({ type: 'race/result' });
      racer?.result();
    },
    finish() {
      stopSparks();
      racer?.finish();
      if (drawn) drawn.stage = 'finished';
      store.dispatch({ type: 'race/finish' });
    },
    slow() {
      slowDevice = true;
      stopSparks();
      if (store.get().motion === 'full') store.dispatch({ type: 'motion/set', level: 'lite' });
    },
  });

  function topBar(state: AppState): void {
    const data = state.data;
    const n = data.status === 'ready' ? routeNumberOf(data.index.line) : null;
    const year = data.status === 'ready' ? yearOf(data.index.effective) : null;
    label.textContent = n && year ? lineLabel(n, year) : '';
    label.hidden = !(n && year);
  }

  /** The motion level as a root class, so the stylesheets can gate the extra motion (design 9.4). */
  function motionClasses(level: MotionLevel): void {
    for (const each of LEVELS) root.classList.toggle(motionClass(each), each === level);
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

  function drawError(): void {
    stopRace();
    run = null;
    drawn = null;
    racer = null;
    timeline = null;
    const children = errorView();
    registry.clear();
    scroll.replaceChildren(...children);
    buttons.replaceChildren();
    foot.replaceChildren();
  }

  /** Draw the whole card for a race, at the clock's elapsed time when racing. */
  function draw(input: CardInput): void {
    registry.clear();
    const firstPaint = !painted && input.stage === 'racing';
    scroll.replaceChildren(...renderCard(registry, { ...input, firstPaint }));
    buttons.replaceChildren(...cardButtons());
    foot.replaceChildren(...footer());
    fitPairRow();
    painted = true;
    const { index, summary, race, minute, layout, stage, resultShown } = input;
    drawn = { index, summary, race, minute, layout, stage, resultShown };
    racer = null;
    timeline = null;
    if (stage !== 'racing') return;
    timeline = buildTimeline(input.view);
    const nums = cardNumbers(input);
    racer = createRacer(scroll, registry, {
      view: input.view,
      timeline,
      layout: cardLayout(input),
      next: { '1938': nums.lane1938.next, today: nums.today?.next ?? null },
      finishedTrolley: { width: vehicleWidths(layout).trolleyFinished, routeNumber: routeNumberOf(index.line) },
      keepBoard: boardShown({ layout, stage: 'finished' }),
    });
    racer.frame(clock.elapsed());
  }

  /** On desktop the pair names stay on one line, their font shrinking as far as a long pair needs (R1.3). */
  function fitPairRow(): void {
    const row = scroll.querySelector<HTMLElement>('.pair-row');
    if (row && options.layout() === 'desktop') fitOneLine(row, FONT_SIZES.desktop.cornerNamesMin);
  }

  /** The result box and honest line arrive at the result moment, under the clock row (R5.7, R1.2). */
  function showResult(input: CardInput, motion: MotionLevel): void {
    const above = scroll.querySelector('.clock-row') ?? scroll.querySelector('.lanes');
    above?.after(...resultElements(registry, input, motion !== 'reduced'));
    if (drawn) drawn.resultShown = true;
  }

  /** The board, if it is on screen, for the minute the slider now shows. */
  function redrawBoard(input: CardInput): void {
    const old = scroll.querySelector('.board');
    if (!old) return;
    old.querySelectorAll<HTMLElement>('button.num').forEach((b) => registry.delete(b.dataset['source'] ?? ''));
    old.replaceWith(cardBoard(registry, input));
  }

  /** The one announcement of a race, once its result is on screen (R13.2). */
  function announceIfDue(view: RaceView): void {
    const state = store.get();
    if (!run || announced === run || !state.race.resultShown) return;
    announced = run;
    announcer.say(announcement(view));
  }

  function render(): void {
    const state = store.get();
    topBar(state);
    motionClasses(state.motion);
    root.dataset['race'] = state.race.phase;
    const derived = derive(state);
    if (derived.status === 'loading') return;
    if (derived.status === 'error') {
      drawError();
      return;
    }
    if (state.data.status !== 'ready' || state.minute === null) return;
    const race = state.data.races.get(pairKey(derived.view.pair));
    if (!race) return;
    const input: CardInput = {
      index: state.data.index,
      summary: state.data.summary,
      race,
      view: derived.view,
      minute: state.minute,
      minuteFromClock: state.minuteFromClock,
      layout: options.layout(),
      stage: state.race.phase === 'finished' ? 'finished' : 'racing',
      resultShown: state.race.resultShown,
      canSkip: state.motion !== 'reduced',
    };
    // While the slider moves, only the time label and the departures board follow it (R3.5).
    if (held && drawn) {
      updateSlider(scroll, input.minute);
      redrawBoard(input);
      return;
    }
    const same =
      drawn !== null &&
      drawn.index === input.index &&
      drawn.summary === input.summary &&
      drawn.race === race &&
      drawn.minute === input.minute &&
      drawn.layout === input.layout &&
      drawn.stage === input.stage;
    if (same && drawn?.resultShown === input.resultShown) {
      announceIfDue(derived.view);
      return;
    }
    if (same && input.resultShown) showResult(input, state.motion);
    else draw(input);
    announceIfDue(derived.view);
  }

  function cancelStart(): void {
    if (pending !== null) timers.cancel(pending);
    pending = null;
  }

  function stopSparks(): void {
    if (spark !== null) timers.cancel(spark);
    spark = null;
    scroll.querySelector('.lane-1938')?.classList.remove('is-sparking');
  }

  /** Pole sparks: one timer per race, a random gap of 1.5 to 4 s, a 120 ms flash (design 9.5). */
  function scheduleSpark(): void {
    spark = timers.later(() => {
      const lane = scroll.querySelector('.lane-1938');
      lane?.classList.add('is-sparking');
      spark = timers.later(() => {
        lane?.classList.remove('is-sparking');
        scheduleSpark();
      }, SPARK.flashMs);
    }, sparkGapMs(timers.random()));
  }

  function stopRace(): void {
    clock.stop();
    stopSparks();
    cancelStart();
    announcer.cancel();
  }

  /** The next race starts after the fixed pause (R2.5, R3.5). */
  function scheduleRace(): void {
    cancelStart();
    pending = timers.later(startRace, TIMINGS.racePauseMs);
  }

  function startRace(): void {
    pending = null;
    if (dragging) return;
    held = false;
    const before = store.get();
    if (before.data.status !== 'ready' || !before.data.races.has(pairKey(before.pair))) return;
    run = {};
    // Reduced motion: the reducer gives the finished state at once and no clock runs (R5.11).
    store.dispatch({ type: 'race/start' });
    render();
    const state = store.get();
    if (state.race.phase !== 'running' || !timeline) return;
    if (!marked) {
      marked = true;
      timers.mark('race-start');
    }
    clock.start(timeline);
    if (state.motion === 'full') scheduleSpark();
  }

  /** Any slider movement or minus or plus stops the race at once (R3.5). */
  function holdRace(): void {
    stopRace();
    held = true;
    store.dispatch({ type: 'race/stop' });
  }

  /**
   * Load the data for the pair the address names, or the lead pair. The named
   * pair can only be checked against index.json once it is read, so it is tried
   * first; if it does not load, the lead pair is loaded instead (the bad-link
   * banner is task 14).
   */
  async function boot(): Promise<void> {
    stopRace();
    held = false;
    run = null;
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
    scheduleRace();
  }

  async function changePair(): Promise<void> {
    const state = store.get();
    if (state.data.status !== 'ready') return;
    const result = await loader.race(state.pair);
    if (result.status === 'ready') {
      store.dispatch({ type: 'data/race', race: result.data });
      scheduleRace();
    } else store.dispatch({ type: 'data/error' });
  }

  store.subscribe((state, previous) => {
    const pairChanged = state.pair !== previous.pair && state.data.status === 'ready';
    if (pairChanged) {
      stopRace();
      held = false;
    }
    render();
    if (pairChanged) void changePair();
  });

  doc.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest<HTMLElement>('[data-action]');
    if (!target) return;
    switch (target.dataset['action']) {
      case 'minus':
        holdRace();
        store.dispatch({ type: 'minute/step', step: -1 });
        scheduleRace();
        break;
      case 'plus':
        holdRace();
        store.dispatch({ type: 'minute/step', step: 1 });
        scheduleRace();
        break;
      case 'skip':
        clock.skip();
        break;
      case 'retry':
        void boot();
        break;
    }
  });
  const isSlider = (event: Event): boolean => (event.target as Element | null)?.id === 'start-time';
  doc.addEventListener('input', (event) => {
    if (!isSlider(event)) return;
    // Read the thumb first: stopping the race redraws the time label from the minute before.
    const minute = Number((event.target as HTMLInputElement).value);
    holdRace();
    store.dispatch({ type: 'minute/set', minute });
    scheduleRace();
  });
  // The next race starts 300 ms after the thumb is released (R3.5).
  doc.addEventListener('change', (event) => {
    if (isSlider(event) && held) scheduleRace();
  });
  doc.addEventListener('pointerdown', (event) => {
    if (isSlider(event)) dragging = true;
  });
  const release = (): void => {
    if (!dragging) return;
    dragging = false;
    if (held) scheduleRace();
  };
  doc.addEventListener('pointerup', release);
  doc.addEventListener('pointercancel', release);

  // The display font arrives after the first paint; the pair names are fitted again with its real widths.
  void doc.fonts?.ready.then(fitPairRow);

  function setMotion(level: MotionLevel): void {
    // After the watchdog, the extra motion stays off for the session.
    const next = level === 'full' && slowDevice ? 'lite' : level;
    if (next === 'reduced') {
      clock.stop();
      stopSparks();
    }
    store.dispatch({ type: 'motion/set', level: next });
  }

  return { store, registry, render, boot, setMotion };
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
    motion: initialMotion(win),
    timers: browserTimers(win),
  });
  media.addEventListener('change', () => app.render());
  watchMotion(win, (level) => app.setMotion(level));
  void app.boot();
  return app;
}
