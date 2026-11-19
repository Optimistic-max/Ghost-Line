// Task 11.2: the race clock. One frame loop; events in time order, each once;
// stop, skip, the catch-up of a hidden tab and the frame-rate watchdog.
import { describe, expect, it } from 'vitest';
import { type ClockDeps, type ClockEvents, MIN_FRAMES_PER_SECOND, createClock } from '../../src/play/clock';
import { type Timeline, buildTimeline } from '../../src/play/timeline';
import type { RaceView } from '../../src/state/model';
import { fakeTime } from '../support/time';

/** A timeline from made-up ends: 1938 arrives at `a`, today at `b`, the result at `r` (scheduled minutes). */
function timelineOf(a: number, b: number | null, result: RaceView['result']): Timeline {
  const lane = (side: '1938' | 'today', parts: [string, number][]) => ({
    side,
    phases: parts.map(([kind, stored]) => ({ side, kind, stored, shown: Math.round(stored) })),
  });
  return buildTimeline({
    lane1938: lane('1938', [['wait', a / 2], ['ride', a / 2]]),
    laneToday: b === null ? null : lane('today', [['walk-to-stop', 1], ['wait', b / 2 - 1], ['ride', b / 2], ['walk-from-stop', 0]]),
    result,
  } as unknown as RaceView);
}

type Log = string[];

function recorder(log: Log, frames: number[] = []): ClockEvents {
  return {
    frame: (e) => frames.push(e),
    arrive: (side) => log.push(`arrive ${side}`),
    result: () => log.push('result'),
    finish: () => log.push('finish'),
    slow: () => log.push('slow'),
  };
}

describe('the race clock', () => {
  it('fires the arrivals in time order, the result at its moment and the finish last, each once', () => {
    const time = fakeTime();
    const log: Log = [];
    const clock = createClock(time, recorder(log));
    const t = timelineOf(16, 40, '1938');
    clock.start(t);
    time.advance(t.durationMs + 1000);
    expect(log).toEqual(['arrive 1938', 'result', 'arrive today', 'finish']);
    expect(clock.running()).toBe(false);
    expect(clock.elapsed()).toBe(t.finishAt);
  });

  it('shows a today win at the bus arrival and a photo finish when both have arrived', () => {
    for (const [result, expected] of [
      ['today', ['arrive today', 'result', 'arrive 1938', 'finish']],
      ['photo_finish', ['arrive today', 'arrive 1938', 'result', 'finish']],
    ] as const) {
      const time = fakeTime();
      const log: Log = [];
      const clock = createClock(time, recorder(log));
      const t = timelineOf(30, 29.5, result);
      clock.start(t);
      time.advance(t.durationMs + 100);
      expect(log, result).toEqual(expected);
    }
  });

  it('fires the result at the right real time: 4 scheduled minutes a second', () => {
    const time = fakeTime();
    const log: Log = [];
    const clock = createClock(time, recorder(log));
    const t = timelineOf(16, 40, '1938');
    clock.start(t);
    time.advance(3900);
    expect(log).toEqual([]);
    time.advance(200);
    expect(log).toEqual(['arrive 1938', 'result']);
  });

  it('draws frame 0 at the start and then one frame per display frame, linear in time', () => {
    const time = fakeTime();
    const frames: number[] = [];
    const clock = createClock(time, recorder([], frames));
    clock.start(timelineOf(16, 40, '1938'));
    expect(frames).toEqual([0]);
    time.advance(1000);
    expect(frames.length).toBeGreaterThan(MIN_FRAMES_PER_SECOND);
    // The last frame ran on the last 16 ms boundary before 1 s.
    const lastFrameMs = Math.floor(1000 / 16) * 16;
    expect(frames.at(-1)).toBeCloseTo((lastFrameMs / 1000) * 4, 6);
  });

  it('stops at once with no further events, and starts again from zero', () => {
    const time = fakeTime();
    const log: Log = [];
    const frames: number[] = [];
    const clock = createClock(time, recorder(log, frames));
    const t = timelineOf(16, 40, '1938');
    clock.start(t);
    time.advance(2000);
    clock.stop();
    const seen = frames.length;
    time.advance(20000);
    expect(frames.length).toBe(seen);
    expect(log).toEqual([]);
    expect(clock.running()).toBe(false);
    expect(clock.elapsed()).toBe(0);
    clock.start(t);
    expect(frames.at(-1)).toBe(0);
    time.advance(t.durationMs + 100);
    expect(log).toEqual(['arrive 1938', 'result', 'arrive today', 'finish']);
  });

  it('skips to the finish, firing what is left in order; skipping again does nothing', () => {
    const time = fakeTime();
    const log: Log = [];
    const frames: number[] = [];
    const clock = createClock(time, recorder(log, frames));
    const t = timelineOf(16, 40, '1938');
    clock.start(t);
    time.advance(1000);
    clock.skip();
    expect(log).toEqual(['arrive 1938', 'result', 'arrive today', 'finish']);
    expect(frames.at(-1)).toBe(t.finishAt);
    clock.skip();
    time.advance(20000);
    expect(log).toEqual(['arrive 1938', 'result', 'arrive today', 'finish']);
  });

  it('skips after the result without firing it again', () => {
    const time = fakeTime();
    const log: Log = [];
    const clock = createClock(time, recorder(log));
    const t = timelineOf(16, 40, '1938');
    clock.start(t);
    time.advance(5000);
    expect(log).toEqual(['arrive 1938', 'result']);
    clock.skip();
    expect(log).toEqual(['arrive 1938', 'result', 'arrive today', 'finish']);
  });

  it('catches up after a hidden tab: the next frame jumps to the real time and fires what it missed, in order', () => {
    let now = 0;
    let queued: ((t: number) => void) | null = null;
    const deps: ClockDeps = {
      now: () => now,
      requestFrame: (cb) => {
        queued = cb;
        return 1;
      },
      cancelFrame: () => {
        queued = null;
      },
    };
    const log: Log = [];
    const frames: number[] = [];
    const clock = createClock(deps, recorder(log, frames));
    const t = timelineOf(16, 40, '1938');
    clock.start(t);
    // The tab is hidden for 30 s: no frame runs. Then one frame.
    now = 30000;
    const run = queued as ((t: number) => void) | null;
    run?.(now);
    expect(frames.at(-1)).toBe(t.finishAt);
    expect(log).toEqual(['arrive 1938', 'result', 'arrive today', 'finish']);
  });

  it('calls slow once when the first second runs under 30 frames, and not on a 60 Hz display', () => {
    const slowTime = fakeTime({ frameMs: 50 });
    const slowLog: Log = [];
    createClock(slowTime, recorder(slowLog)).start(timelineOf(40, 44, '1938'));
    slowTime.advance(11000);
    expect(slowLog.filter((e) => e === 'slow')).toEqual(['slow']);

    const fastTime = fakeTime({ frameMs: 16 });
    const fastLog: Log = [];
    createClock(fastTime, recorder(fastLog)).start(timelineOf(40, 44, '1938'));
    fastTime.advance(11000);
    expect(fastLog).not.toContain('slow');
  });
});
