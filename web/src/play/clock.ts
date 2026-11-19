// The race clock (design 9.2): one requestAnimationFrame loop drives a race.
// Elapsed time comes from timestamp differences, so a hidden tab catches up and
// finishes at its real time, firing the events it missed in order. A frame-rate
// watchdog turns the extra motion off for a device that cannot hold 30 frames
// per second (R5.10).
import { type Timeline, elapsedAt } from './timeline';

export type ClockDeps = {
  now(): number;
  requestFrame(callback: (time: number) => void): number;
  cancelFrame(handle: number): void;
};

export type ClockEvents = {
  /** Every frame, with the scheduled minutes since the start. */
  frame(elapsed: number): void;
  /** When a side arrives (once each, in time order). */
  arrive(side: '1938' | 'today'): void;
  /** At the result moment (once). */
  result(): void;
  /** When both sides are done (once). */
  finish(): void;
  /** Once, when the first second of a race ran under 30 frames per second. */
  slow(): void;
};

export type Clock = {
  start(timeline: Timeline): void;
  /** Stop at once, with no further events. */
  stop(): void;
  /** Jump to the finish, firing the events not yet fired, in order. */
  skip(): void;
  running(): boolean;
  /** Scheduled minutes since the start of the race under way; 0 with none. */
  elapsed(): number;
};

/** Frames a device must draw in the first second to keep the full motion (R5.10). */
export const MIN_FRAMES_PER_SECOND = 30;
const WATCH_MS = 1000;
/** A gap this long between two frames means the tab was hidden, so the first second cannot be judged. */
const HIDDEN_GAP_MS = 500;

export function createClock(deps: ClockDeps, on: ClockEvents): Clock {
  let timeline: Timeline | null = null;
  let t0 = 0;
  let lastMs = 0;
  let handle: number | null = null;
  let frames = 0;
  let watched = false;
  let fired = new Set<EventKey>();

  type EventKey = 'arrive 1938' | 'arrive today' | 'result' | 'finish';
  /** Same-moment events run arrivals first, then the result, then the finish. */
  const RANK: Record<EventKey, number> = { 'arrive 1938': 0, 'arrive today': 0, result: 1, finish: 2 };

  function run(key: EventKey): void {
    if (key === 'arrive 1938') on.arrive('1938');
    else if (key === 'arrive today') on.arrive('today');
    else if (key === 'result') on.result();
    else {
      stopLoop();
      on.finish();
    }
  }

  /** Fire every event at or before `elapsed` not yet fired, in time order (a skip or a hidden tab can pass several). */
  function fire(elapsed: number): void {
    if (!timeline) return;
    const race = timeline;
    const events: [EventKey, number][] = [['arrive 1938', race.end1938]];
    if (race.endToday !== null) events.push(['arrive today', race.endToday]);
    events.push(['result', race.resultAt], ['finish', race.finishAt]);
    events.sort((a, b) => a[1] - b[1] || RANK[a[0]] - RANK[b[0]]);
    for (const [key, at] of events) {
      // A handler may stop the clock or start another race; then nothing more fires for this one.
      if (timeline !== race) return;
      if (fired.has(key) || elapsed < at) continue;
      fired.add(key);
      run(key);
    }
  }

  function stopLoop(): void {
    if (handle !== null) deps.cancelFrame(handle);
    handle = null;
  }

  function tick(): void {
    handle = null;
    if (!timeline) return;
    const ms = deps.now() - t0;
    frames += 1;
    if (!watched && ms - lastMs > HIDDEN_GAP_MS) watched = true;
    if (!watched && ms >= WATCH_MS) {
      watched = true;
      if (frames < MIN_FRAMES_PER_SECOND) on.slow();
    }
    lastMs = ms;
    const elapsed = elapsedAt(timeline, ms);
    on.frame(elapsed);
    fire(elapsed);
    if (timeline && !fired.has('finish') && handle === null) handle = deps.requestFrame(tick);
  }

  return {
    start(next) {
      stopLoop();
      timeline = next;
      t0 = deps.now();
      lastMs = 0;
      frames = 0;
      watched = false;
      fired = new Set<EventKey>();
      on.frame(0);
      handle = deps.requestFrame(tick);
    },
    stop() {
      stopLoop();
      timeline = null;
    },
    skip() {
      if (!timeline || fired.has('finish')) return;
      stopLoop();
      on.frame(timeline.finishAt);
      fire(timeline.finishAt);
    },
    running() {
      return timeline !== null && !fired.has('finish');
    },
    elapsed() {
      if (!timeline) return 0;
      return fired.has('finish') ? timeline.finishAt : elapsedAt(timeline, deps.now() - t0);
    },
  };
}

/** Timers for the page: the clock's frames, plain timeouts, randomness and performance marks. */
export type PageTimers = ClockDeps & {
  later(callback: () => void, ms: number): number;
  cancel(handle: number): void;
  random(): number;
  mark(name: string): void;
};

/** The browser's clock, frames and timers. */
export function browserTimers(win: Window): PageTimers {
  return {
    now: () => win.performance.now(),
    requestFrame: (cb) => win.requestAnimationFrame(cb),
    cancelFrame: (h) => win.cancelAnimationFrame(h),
    later: (cb, ms) => win.setTimeout(cb, ms),
    cancel: (h) => win.clearTimeout(h),
    random: () => Math.random(),
    mark: (name) => {
      win.performance.mark(name);
    },
  };
}
