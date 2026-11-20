// Task 11.1: playback timing. Segments come from the stored parts, the speed is
// max(4, longest / 12) scheduled minutes a second, positions are linear in time,
// and the result moment is chosen from the stored result. Real cases are read
// from web/public/data; the property tests use made-up parts.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import type { RaceResult } from '../../src/data/types';
import {
  BASE_SPEED,
  MAX_SECONDS,
  SPARK,
  buildTimeline,
  elapsedAt,
  fillOf,
  laneFrame,
  resultAt,
  sparkGapMs,
} from '../../src/play/timeline';
import { buildView } from '../../src/state/derive';
import type { Lane, PhaseKind, RaceView, Side } from '../../src/state/model';
import { fixtureData } from '../support/fixture';
import { raceOf, realData, slugNamed } from '../support/realdata';

const KINDS_1938: PhaseKind[] = ['wait', 'ride'];
const KINDS_TODAY: PhaseKind[] = ['walk-to-stop', 'wait', 'ride', 'walk-from-stop'];

function lane(side: Side, kinds: PhaseKind[], stored: number[]): Lane {
  const total = stored.reduce((a, b) => a + b, 0);
  return {
    side,
    phases: kinds.map((kind, i) => ({ side, kind, stored: stored[i]!, shown: Math.round(stored[i]!) })),
    storedTotal: total,
    shownTotal: Math.round(total),
    next: '10:00',
  };
}

/** A view with only what playback reads: the two lanes and the result. */
function viewOf(parts1938: number[], partsToday: number[] | null, result: RaceResult): RaceView {
  return {
    lane1938: lane('1938', KINDS_1938, parts1938),
    laneToday: partsToday ? lane('today', KINDS_TODAY, partsToday) : null,
    result,
  } as unknown as RaceView;
}

function realView(pair: { origin: string; dest: string }, hhmm: string): RaceView {
  const data = realData();
  return buildView(data.index, data.summary, raceOf(pair), hhmm);
}

const lead = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
const westToPreston = { origin: slugNamed('Westwood & Carey'), dest: slugNamed('Preston & Caroline') };

// Stored parts have three decimals: zero, or at least 0.001 minute.
const part = fc.oneof(fc.constant(0), fc.double({ min: 0.001, max: 60, noNaN: true }));
const parts1938 = fc.tuple(part, fc.double({ min: 0.5, max: 60, noNaN: true }));
const partsToday = fc.tuple(part, part, fc.double({ min: 0.5, max: 90, noNaN: true }), part);
const results = fc.constantFrom<RaceResult>('1938', 'today', 'photo_finish');

describe('the timeline of a race', () => {
  it('plays the lead pair at 10:00 at 4 scheduled minutes a second: its longer side is under 48 minutes', () => {
    const view = realView(lead, '10:00');
    const t = buildTimeline(view);
    expect(t.finishAt).toBeLessThanOrEqual(BASE_SPEED * MAX_SECONDS);
    expect(t.speed).toBe(BASE_SPEED);
    expect(t.durationMs).toBeCloseTo((t.finishAt / BASE_SPEED) * 1000, 6);
    // The finish is the sum of the stored parts, which matches the stored total within its three decimals.
    expect(Math.abs(t.finishAt - view.row.today!.total)).toBeLessThanOrEqual(0.002);
  });

  it('builds the segments end to end from the stored parts, never the shown ones', () => {
    const view = realView(lead, '10:00');
    const t = buildTimeline(view);
    for (const side of ['1938', 'today'] as const) {
      const segs = t.segments.filter((s) => s.side === side);
      const phases = (side === '1938' ? view.lane1938 : view.laneToday!).phases;
      expect(segs.map((s) => s.kind)).toEqual(phases.map((p) => p.kind));
      segs.forEach((s, k) => {
        expect(s.from).toBe(k === 0 ? 0 : segs[k - 1]!.to);
        expect(s.to - s.from).toBeCloseTo(phases[k]!.stored, 9);
      });
    }
    expect(t.end1938).toBeCloseTo(view.lane1938.phases.reduce((a, p) => a + p.stored, 0), 9);
  });

  it('never lasts more than 12 s, and a race whose longer side passes 48 minutes takes exactly 12 s (property)', () => {
    fc.assert(
      fc.property(parts1938, partsToday, results, (a, b, result) => {
        const t = buildTimeline(viewOf(a, b, result));
        expect(t.durationMs).toBeLessThanOrEqual(MAX_SECONDS * 1000 + 1e-6);
        if (t.finishAt > BASE_SPEED * MAX_SECONDS) expect(t.durationMs).toBeCloseTo(MAX_SECONDS * 1000, 6);
        else expect(t.speed).toBe(BASE_SPEED);
        expect(t.finishAt).toBe(Math.max(t.end1938, t.endToday!));
      }),
    );
  });

  it('has one lane, and finishes when the 1938 side arrives, with no one-seat ride', () => {
    const fixture = fixtureData();
    const pair = fixture.index.pairs.find((p) => fixture.races.get(`${p.origin}__${p.dest}`)!.today.trips.length === 0)!;
    const race = fixture.races.get(`${pair.origin}__${pair.dest}`)!;
    const view = buildView(fixture.index, fixture.summary, race, race.races[0]!.t);
    const t = buildTimeline(view);
    expect(view.result).toBe('no_one_seat_ride');
    expect(new Set(t.segments.map((s) => s.side))).toEqual(new Set(['1938']));
    expect(t.endToday).toBeNull();
    expect(t.finishAt).toBe(t.end1938);
    expect(t.resultAt).toBe(t.end1938);
  });
});

describe('the result moment', () => {
  it('is the winner\'s arrival for a win, the later arrival for a photo finish, the 1938 arrival with no bus', () => {
    const a = [3, 9];
    const b = [2, 20, 8, 4];
    const { end1938, endToday } = buildTimeline(viewOf(a, b, '1938'));
    expect(resultAt(viewOf(a, b, '1938'))).toBe(end1938);
    expect(resultAt(viewOf(a, b, 'today'))).toBe(endToday);
    expect(resultAt(viewOf(a, b, 'photo_finish'))).toBe(Math.max(end1938, endToday!));
    expect(resultAt(viewOf(a, null, 'no_one_seat_ride'))).toBe(end1938);
  });

  it('follows the stored result on the real cases: a 1938 win, a today win and a photo finish', () => {
    const win1938 = buildTimeline(realView(lead, '10:00'));
    expect(win1938.resultAt).toBe(win1938.end1938);
    expect(win1938.resultAt).toBeLessThan(win1938.finishAt);
    const winToday = buildTimeline(realView(westToPreston, '11:23'));
    expect(winToday.resultAt).toBe(winToday.endToday);
    expect(winToday.resultAt).toBeLessThan(winToday.finishAt);
    const photo = buildTimeline(realView(lead, '10:30'));
    expect(photo.resultAt).toBe(photo.finishAt);
  });
});

describe('positions in time', () => {
  /** A ride portion for the cases where the vehicle's place does not matter. */
  const HALF = { from: 0.25, to: 0.5 };
  it('turns real time into scheduled minutes linearly, stopping at the finish (property)', () => {
    fc.assert(
      fc.property(parts1938, partsToday, fc.double({ min: 0, max: 20000, noNaN: true }), (a, b, ms) => {
        const t = buildTimeline(viewOf(a, b, '1938'));
        const e = elapsedAt(t, ms);
        expect(e).toBeCloseTo(Math.min(t.finishAt, (ms / 1000) * t.speed), 9);
      }),
    );
  });

  it('fills a phase linearly: half of its time fills half of it (property)', () => {
    fc.assert(
      fc.property(partsToday, fc.integer({ min: 0, max: 3 }), fc.double({ min: 0, max: 1, noNaN: true }), (b, k, x) => {
        const t = buildTimeline(viewOf([1, 1], b, 'today'));
        const seg = t.segments.filter((s) => s.side === 'today')[k]!;
        fc.pre(seg.to > seg.from);
        expect(fillOf(seg, seg.from + x * (seg.to - seg.from))).toBeCloseTo(x, 9);
        expect(fillOf(seg, seg.from - 1)).toBe(0);
        expect(fillOf(seg, seg.to + 1)).toBe(1);
      }),
    );
  });

  it('puts the vehicle\'s front at the filled end of its ride portion: still before and after the ride, linear during it (property)', () => {
    fc.assert(
      fc.property(
        partsToday,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 0.6, noNaN: true }),
        fc.double({ min: 0.05, max: 0.4, noNaN: true }),
        (b, x, from, length) => {
          const view = viewOf([1, 1], b, 'today');
          const t = buildTimeline(view);
          const ride = t.segments.find((s) => s.side === 'today' && s.kind === 'ride')!;
          const travel = { from, to: from + length };
          const at = (e: number) => laneFrame(view.laneToday!, t, e, travel);
          // Parked through the first walk and the wait, at the start of the ride portion.
          expect(at(0).vehicle).toBe(from);
          expect(at(ride.from).vehicle).toBe(from);
          expect(at(ride.from).moving).toBe(false);
          expect(at(ride.from + x * (ride.to - ride.from)).vehicle).toBeCloseTo(from + length * x, 9);
          // Parked at the end of its ride while the last walk completes.
          expect(at(ride.to).vehicle).toBeCloseTo(travel.to, 9);
          expect(at(t.finishAt).vehicle).toBeCloseTo(travel.to, 9);
          expect(at(t.finishAt).arrived).toBe(true);
          if (x > 1e-6 && x < 1 - 1e-6) expect(at(ride.from + x * (ride.to - ride.from)).moving).toBe(true);
        },
      ),
    );
  });

  it('counts the phase under way down in whole minutes from its shown part', () => {
    const view = realView(lead, '10:00');
    const t = buildTimeline(view);
    const wait = view.lane1938.phases[0]!;
    const start = laneFrame(view.lane1938, t, 0, HALF);
    expect([start.current, start.countdown, start.arrived]).toEqual([0, wait.shown, false]);
    // Just before the wait ends, one minute is left; at its end the ride is under way, from its own shown part.
    expect(laneFrame(view.lane1938, t, wait.stored - 1e-6, HALF).countdown).toBe(1);
    const riding = laneFrame(view.lane1938, t, wait.stored, HALF);
    expect([riding.current, riding.countdown]).toEqual([1, view.lane1938.phases[1]!.shown]);
    expect(laneFrame(view.lane1938, t, t.end1938, HALF).arrived).toBe(true);
  });

  it('dims only the phases not yet reached', () => {
    const view = realView(lead, '10:00');
    const t = buildTimeline(view);
    expect(laneFrame(view.laneToday!, t, 0, HALF).reached).toEqual([true, false, false, false]);
    expect(laneFrame(view.laneToday!, t, t.endToday!, HALF).reached).toEqual([true, true, true, true]);
  });
});

describe('pole sparks', () => {
  it('come at random gaps of 1.5 to 4 s and flash for 120 ms', () => {
    expect(sparkGapMs(0)).toBe(1500);
    expect(sparkGapMs(1)).toBe(4000);
    fc.assert(fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (r) => {
      const gap = sparkGapMs(r);
      expect(gap).toBeGreaterThanOrEqual(1500);
      expect(gap).toBeLessThanOrEqual(4000);
    }));
    expect(SPARK.flashMs).toBe(120);
  });
});
