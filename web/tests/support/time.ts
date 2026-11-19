// A fake time source for the page in jsdom tests: a millisecond clock that moves
// only when a test advances it, timeouts, and animation frames at a fixed rate
// (every 16 ms by default, like a 60 Hz display; a slow device uses a longer
// frame time).
import type { PageTimers } from '../../src/play/clock';

export type FakeTime = PageTimers & {
  /** Move the clock forward, running due timeouts and frames in time order. */
  advance(ms: number): void;
  /** Milliseconds since the fake clock started. */
  current(): number;
  /** Frames run so far. */
  frameCount(): number;
  /** The performance marks made. */
  marks: string[];
  /** Timeouts not yet run. */
  pendingTimeouts(): number;
};

export function fakeTime(options: { frameMs?: number; random?: () => number } = {}): FakeTime {
  const frameMs = options.frameMs ?? 16;
  let now = 0;
  let nextId = 1;
  let frames = 0;
  const timeouts = new Map<number, { at: number; callback: () => void }>();
  const frameCallbacks = new Map<number, (time: number) => void>();
  const marks: string[] = [];

  /** The next frame boundary after `t`. */
  const nextFrameAfter = (t: number): number => (Math.floor(t / frameMs) + 1) * frameMs;

  function nextTimeout(): [number, { at: number; callback: () => void }] | undefined {
    let best: [number, { at: number; callback: () => void }] | undefined;
    for (const entry of timeouts) if (!best || entry[1].at < best[1].at) best = entry;
    return best;
  }

  return {
    now: () => now,
    requestFrame(callback) {
      const id = nextId++;
      frameCallbacks.set(id, callback);
      return id;
    },
    cancelFrame(id) {
      frameCallbacks.delete(id);
    },
    later(callback, ms) {
      const id = nextId++;
      timeouts.set(id, { at: now + Math.max(0, ms), callback });
      return id;
    },
    cancel(id) {
      timeouts.delete(id);
    },
    random: options.random ?? (() => 0.5),
    mark(name) {
      marks.push(name);
    },
    marks,
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const timeout = nextTimeout();
        const frameAt = frameCallbacks.size > 0 ? nextFrameAfter(now) : Infinity;
        const timeoutAt = timeout ? timeout[1].at : Infinity;
        const at = Math.min(frameAt, timeoutAt);
        if (at > end) break;
        now = at;
        if (timeout && timeoutAt <= frameAt) {
          timeouts.delete(timeout[0]);
          timeout[1].callback();
        } else {
          const due = [...frameCallbacks.values()];
          frameCallbacks.clear();
          frames += 1;
          for (const callback of due) callback(now);
        }
      }
      now = end;
    },
    current: () => now,
    frameCount: () => frames,
    pendingTimeouts: () => timeouts.size,
  };
}
