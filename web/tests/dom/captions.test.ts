// Task 7.3: the caption sequence on the page, on a fake clock (story-layer Req 7.2 to 7.13, 16.4, 16.5, 16.18).
// The expected sequence is worked out here from the race file's stored phase boundaries: the lanes' phases
// are cut at every boundary, each stretch gets its caption, and runs of the same text are joined.
import { afterEach, describe, expect, it } from 'vitest';
import { LEAD_PAIR, TIMINGS } from '../../src/config';
import * as C from '../../src/copy/copy';
import type { Pair, RaceFile, RaceRow } from '../../src/data/types';
import { minutesOf } from '../../src/format/time';
import { FIXTURE_DIR, fixtureData } from '../support/fixture';
import { type PageOptions, bootPage } from '../support/page';
import { realData } from '../support/realdata';
import { text } from '../support/render';
import { type FakeTime, fakeTime } from '../support/time';

const real = realData();
const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
const newYork = (hhmm: string): Date => new Date(`${real.index.service_date}T${hhmm}:00-05:00`);
const query = (p: Pair): string => `?from=${p.origin}&to=${p.dest}`;
const FRAME_MS = 16;

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
  window.history.replaceState(null, '', '/');
});

type Kind = 'walk-to-stop' | 'wait' | 'ride' | 'walk-from-stop';
type Parts = [Kind, number][];

function partsOf(race: RaceFile, row: RaceRow): { old: Parts; today: Parts | null } {
  const old: Parts = [
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

const phaseAt = (parts: Parts, x: number): Kind | 'arrived' => {
  let end = 0;
  for (const [kind, minutes] of parts) {
    end += minutes;
    if (x < end) return kind;
  }
  return 'arrived';
};

function captionAt(parts: ReturnType<typeof partsOf>, x: number): string {
  const k38 = phaseAt(parts.old, x);
  const kToday = parts.today ? phaseAt(parts.today, x) : null;
  const done38 = k38 === 'arrived';
  const doneToday = kToday === 'arrived';
  const p1938 = done38 ? 'arrived' : k38 === 'ride' ? 'riding' : 'waiting';
  if (kToday === null) return C.captionText({ kind: 'clauses', p1938: { phase: p1938, still: false }, today: null });
  if (done38 && doneToday) return C.captionText({ kind: 'both-arrived' });
  const pToday =
    kToday === 'walk-to-stop'
      ? 'walking-to-stop'
      : kToday === 'wait'
        ? 'waiting'
        : kToday === 'ride'
          ? 'riding'
          : kToday === 'walk-from-stop'
            ? 'walking-to-destination'
            : 'arrived';
  return C.captionText({
    kind: 'clauses',
    p1938: { phase: p1938, still: !done38 && doneToday },
    today: { phase: pToday, still: !doneToday && done38 },
  });
}

/** The captions in order, from the stored boundaries; plus the shortest stretch in real milliseconds. */
function expectedSequence(race: RaceFile, row: RaceRow): { sequence: string[]; shortestMs: number } {
  const parts = partsOf(race, row);
  const cuts = new Set<number>([0]);
  for (const list of [parts.old, parts.today ?? []]) {
    let run = 0;
    for (const [, m] of list) cuts.add((run += m));
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  const finish = sorted.at(-1)!;
  // One scheduled minute per quarter second, never longer than twelve seconds in all (screen-brief 3A.6).
  const speed = Math.max(4, finish / 12);
  const sequence: string[] = [];
  let shortest = Infinity;
  const push = (caption: string): void => {
    if (sequence.at(-1) !== caption) sequence.push(caption);
  };
  for (let k = 0; k + 1 < sorted.length; k += 1) {
    const from = sorted[k]!;
    const to = sorted[k + 1]!;
    if (to - from <= 0) continue;
    shortest = Math.min(shortest, ((to - from) / speed) * 1000);
    push(captionAt(parts, (from + to) / 2));
  }
  push(captionAt(parts, finish));
  return { sequence, shortestMs: shortest };
}

const caption = (): HTMLElement => document.getElementById('race-caption')!;
const live = '[aria-live], [role="status"], [role="alert"], [role="log"]';

function assertNotLiveAndScheduled(): void {
  const el = caption();
  expect(el.closest(live)).toBeNull();
  expect(el.querySelector(live)).toBeNull();
  const line = document.querySelector<HTMLElement>('.schedule');
  expect(line).not.toBeNull();
  expect(text(line)).toContain(C.NOT_LIVE);
  for (let node: HTMLElement | null = line; node; node = node.parentElement) {
    expect(node.hidden).toBe(false);
    expect(node.style.display).not.toBe('none');
  }
}

type Scenario = {
  name: string;
  race: RaceFile;
  hhmm: string;
  options: PageOptions;
  guided: boolean;
};

const firstWin = real.summary.today_wins[0]!;
const winPair: Pair = { origin: firstWin.origin, dest: firstWin.dest };
const inferredSlug = real.index.corners.find((c) => c.inferred)!.slug;
const brevardPair = real.index.pairs.find((p) => p.origin === inferredSlug || p.dest === inferredSlug)!;
const fixtureData1 = fixtureData();
const noRidePair = fixtureData1.index.pairs.find((p) => fixtureData1.races.get(`${p.origin}__${p.dest}`)!.today.trips.length === 0)!;
const raceOf = (pair: Pair): RaceFile => real.races.get(`${pair.origin}__${pair.dest}`)!;

const scenarios: Scenario[] = [
  { name: 'the lead race at 10:00 (guided)', race: raceOf(lead), hhmm: '10:00', options: {}, guided: true },
  {
    name: 'the first today-wins entry',
    race: raceOf(winPair),
    hhmm: firstWin.t,
    options: { query: query(winPair), now: newYork(firstWin.t) },
    guided: false,
  },
  { name: 'the lead pair at 10:30', race: raceOf(lead), hhmm: '10:30', options: { query: query(lead), now: newYork('10:30') }, guided: false },
  { name: 'the lead pair at 9:00', race: raceOf(lead), hhmm: '09:00', options: { query: query(lead), now: newYork('09:00') }, guided: false },
  {
    name: 'a Brevard pair at 10:00',
    race: raceOf(brevardPair),
    hhmm: '10:00',
    options: { query: query(brevardPair), now: newYork('10:00') },
    guided: false,
  },
  {
    name: 'the no-one-seat-ride fixture',
    race: fixtureData1.races.get(`${noRidePair.origin}__${noRidePair.dest}`)!,
    hhmm: '10:00',
    options: { folder: FIXTURE_DIR, query: query(noRidePair), leadPair: noRidePair, now: newYork('10:00') },
    guided: false,
  },
];

describe('the caption sequence on the page (16.4, 16.5)', () => {
  for (const s of scenarios) {
    it(`${s.name}: the captions follow the stored boundaries, outside any live region, with "Scheduled, not live." showing`, async () => {
      const row = s.race.races.find((r) => r.t === s.hhmm)!;
      expect(row).toBeDefined();
      const want = expectedSequence(s.race, row);
      // A stretch shorter than one frame may not be drawn; none of these races has one.
      expect(want.shortestMs).toBeGreaterThanOrEqual(FRAME_MS);
      expect(minutesOf(row.t)).toBeGreaterThan(0);

      const time: FakeTime = fakeTime({ frameMs: FRAME_MS });
      const app = await bootPage({ ...s.options, time });
      const seen: string[] = [];
      const note = (): void => {
        const now = text(caption());
        if (now !== '' && seen.at(-1) !== now) {
          seen.push(now);
          assertNotLiveAndScheduled();
        }
      };

      assertNotLiveAndScheduled();
      if (s.guided) {
        // The orientation line comes first and holds for the pause.
        expect(app.store.get().guided).toBe(true);
        note();
        expect(seen).toEqual([C.ORIENTATION_LINE]);
        time.advance(TIMINGS.orientationMs - FRAME_MS);
        expect(text(caption())).toBe(C.ORIENTATION_LINE);
        assertNotLiveAndScheduled();
        time.advance(FRAME_MS);
      } else {
        expect(app.store.get().guided).toBe(false);
        time.advance(TIMINGS.racePauseMs);
      }
      for (let step = 0; step < 2000 && app.store.get().race.phase !== 'finished'; step += 1) {
        time.advance(FRAME_MS);
        note();
      }
      time.advance(FRAME_MS);
      note();
      expect(app.store.get().race.phase).toBe('finished');

      const shown = s.guided ? seen.slice(1) : seen;
      expect(shown).toEqual(want.sequence);
      assertNotLiveAndScheduled();
      // The announcer's region carries the result, not the captions.
      const status = document.getElementById('result-status');
      for (const line of want.sequence) expect(text(status)).not.toBe(line);
    });
  }
});
