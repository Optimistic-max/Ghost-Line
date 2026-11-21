// Task 7.3 properties 6 and 7: what the captions say and what they never say (story-layer Req 7).
// The expected phase of each side is worked out here from the race file's stored parts, not by phaseOf.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import * as C from '../../src/copy/copy';
import type { Index, RaceFile, RaceRow, Summary } from '../../src/data/types';
import { buildTimeline, laneFrame } from '../../src/play/timeline';
import { buildView } from '../../src/state/derive';
import { captionFor, phaseOf } from '../../src/state/captions';
import type { Side38, SideToday } from '../../src/state/captions';
import { fixtureData } from '../support/fixture';
import { realData } from '../support/realdata';

type Source = { index: Index; summary: Summary; race: RaceFile };

const real = realData();
const fixture = fixtureData();
const sources: Source[] = [
  ...[...real.races.values()].map((race) => ({ index: real.index, summary: real.summary, race })),
  ...[...fixture.races.values()].map((race) => ({ index: fixture.index, summary: fixture.summary, race })),
];

type Kind = 'walk-to-stop' | 'wait' | 'ride' | 'walk-from-stop';

/** The stored parts of each side for a row, straight from the race file. */
function storedParts(race: RaceFile, row: RaceRow): { old: [Kind, number][]; today: [Kind, number][] | null } {
  const old: [Kind, number][] = [
    ['wait', row.y1938.wait],
    ['ride', race.y1938.ride_min],
  ];
  if (!row.today) return { old, today: null };
  const trip = race.today.trips.find((t) => t.i === row.today!.trip)!;
  return {
    old,
    today: [
      ['walk-to-stop', trip.board.walk_min],
      ['wait', row.today.wait],
      ['ride', trip.ride_min],
      ['walk-from-stop', trip.alight.walk_min],
    ],
  };
}

/** Boundaries as running sums; the phase at x is the first part whose end is after x, or 'arrived'. */
function phaseAt(parts: [Kind, number][], x: number): Kind | 'arrived' {
  let end = 0;
  for (const [kind, minutes] of parts) {
    end += minutes;
    if (x < end) return kind;
  }
  return 'arrived';
}

const names38 = (k: Kind | 'arrived'): Side38 => (k === 'ride' ? 'riding' : k === 'arrived' ? 'arrived' : 'waiting');
const namesToday = (k: Kind | 'arrived'): SideToday =>
  k === 'walk-to-stop' ? 'walking-to-stop' : k === 'wait' ? 'waiting' : k === 'ride' ? 'riding' : k === 'walk-from-stop' ? 'walking-to-destination' : 'arrived';

const sum = (parts: [Kind, number][]): number => parts.reduce((s, [, m]) => s + m, 0);

describe('Property 6: Captions name the phases the lanes show', () => {
  // Feature: story-layer, Property 6: Captions name the phases the lanes show
  it('holds for rows from all 20 files and the fixtures at random elapsed times', () => {
    const pick = fc.record({
      source: fc.constantFrom(...sources),
      at: fc.nat(),
      share: fc.oneof(fc.double({ min: 0, max: 1.2, noNaN: true }), fc.constantFrom(0, 1)),
      onBoundary: fc.option(fc.nat({ max: 5 }), { nil: undefined }),
    });
    fc.assert(
      fc.property(pick, ({ source, at, share, onBoundary }) => {
        const { race } = source;
        const row = race.races[at % race.races.length]!;
        const stored = storedParts(race, row);
        const end1938 = sum(stored.old);
        const endToday = stored.today ? sum(stored.today) : 0;
        let elapsed = share * Math.max(end1938, endToday);
        if (onBoundary !== undefined) {
          const cuts: number[] = [];
          for (const parts of [stored.old, stored.today ?? []]) {
            let run = 0;
            for (const [, m] of parts) cuts.push((run += m));
          }
          elapsed = cuts[onBoundary % cuts.length]!;
        }

        const view = buildView(source.index, source.summary, race, row.t);
        const timeline = buildTimeline(view);
        const travel = { from: 0, to: 1 };
        const p1938 = phaseOf(view.lane1938, laneFrame(view.lane1938, timeline, elapsed, travel)) as Side38;
        const today = view.laneToday
          ? (phaseOf(view.laneToday, laneFrame(view.laneToday, timeline, elapsed, travel)) as SideToday)
          : null;
        const key = captionFor({ p1938, today, orientation: false });

        const want1938 = names38(phaseAt(stored.old, elapsed));
        const wantToday = stored.today ? namesToday(phaseAt(stored.today, elapsed)) : null;
        expect(p1938).toBe(want1938);
        expect(today).toBe(wantToday);

        const text = C.captionText(key);
        if (wantToday === null) {
          expect(key).toEqual({ kind: 'clauses', p1938: { phase: want1938, still: false }, today: null });
          expect(text).not.toContain('still ');
        } else if (want1938 === 'arrived' && wantToday === 'arrived') {
          expect(key).toEqual({ kind: 'both-arrived' });
          expect(text).toBe(C.CAPTION_BOTH_ARRIVED);
        } else {
          expect(key).toEqual({
            kind: 'clauses',
            p1938: { phase: want1938, still: want1938 !== 'arrived' && wantToday === 'arrived' },
            today: { phase: wantToday, still: wantToday !== 'arrived' && want1938 === 'arrived' },
          });
          const stills = text.split('still ').length - 1;
          const expected = (want1938 !== 'arrived' && wantToday === 'arrived' ? 1 : 0) + (wantToday !== 'arrived' && want1938 === 'arrived' ? 1 : 0);
          expect(stills).toBe(expected);
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe('Property 7: Caption text carries no number, no present-tense marker and no place', () => {
  // Feature: story-layer, Property 7: Caption text carries no number, no present-tense marker and no place
  const places = new Set<string>();
  for (const index of [real.index, fixture.index]) {
    for (const corner of index.corners) {
      places.add(corner.name.toLowerCase());
      for (const street of corner.name.split('&')) places.add(street.trim().toLowerCase());
    }
  }

  const input = fc.record({
    p1938: fc.constantFrom<Side38>('waiting', 'riding', 'arrived'),
    today: fc.constantFrom<SideToday | null>(null, 'walking-to-stop', 'waiting', 'riding', 'walking-to-destination', 'arrived'),
    orientation: fc.boolean(),
  });

  it('holds for every key the caption function can return, including the orientation line', () => {
    fc.assert(
      fc.property(input, (i) => {
        const text = C.captionText(captionFor(i));
        const lower = text.toLowerCase();
        expect(text).not.toMatch(/\d/);
        expect(text).not.toMatch(/\b(now|currently)\b/i);
        expect(lower).not.toContain('at the stop');
        for (const place of places) expect(lower).not.toContain(place);
      }),
      { numRuns: 200 },
    );
    expect(C.captionText({ kind: 'orientation' })).toBe(C.ORIENTATION_LINE);
  });
});
