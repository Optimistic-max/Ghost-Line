// Ghost cars (ghost-cars spec, task 2.3): the golden lead race, the property of Req 7.2 over the made-up
// fixture line and the 20 real race files, and the real-data sweep for the task report (Req 7.4).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import type { RaceFile, RaceRow } from '../../src/data/types';
import { secondsOf } from '../../src/format/time';
import { buildTimeline, carsOf, counterAt, ghostPlanOf, ghostShares } from '../../src/play/timeline';
import { buildView } from '../../src/state/derive';
import { fixtureData } from '../support/fixture';
import { realData } from '../support/realdata';

const real = realData();
const fake = fixtureData();
const leadRace = real.races.get(`${LEAD_PAIR.origin}__${LEAD_PAIR.dest}`)!;

/** The test's own oracle: the passes in [start, bus departure), in seconds, written without the site's code. */
function oracle(race: RaceFile, row: RaceRow): string[] {
  const trip = row.today ? race.today.trips[row.today.trip] : undefined;
  if (!trip) return [];
  const [h, m, s] = trip.dep.split(':').map(Number);
  const bus = h! * 3600 + m! * 60 + s!;
  const [sh, sm] = row.start.split(':').map(Number);
  const start = sh! * 3600 + sm! * 60;
  return race.y1938.passes.filter((p) => {
    const [ph, pm] = p.split(':').map(Number);
    const at = ph! * 3600 + pm! * 60;
    return at >= start && at < bus;
  });
}

describe('secondsOf', () => {
  it('reads hh:mm and hh:mm:ss, hours past 24 included, and rejects anything else', () => {
    expect(secondsOf('10:32')).toBe(37920);
    expect(secondsOf('10:32:43')).toBe(37963);
    expect(secondsOf('25:01:02')).toBe(90062);
    for (const bad of ['10:3', '10:60', '1:00', '10:00:60', '']) expect(() => secondsOf(bad)).toThrow();
  });
});

describe('the golden lead race (Req 7.1)', () => {
  it('Preston & Caroline to Aliceanna & Bond at 10:00: four cars, at 10:06, 10:13, 10:21 and 10:28, before the bus at 10:32:43', () => {
    const row = leadRace.races.find((r) => r.t === '10:00')!;
    const trip = leadRace.today.trips[row.today!.trip]!;
    expect(trip.dep).toBe('10:32:43');
    const plan = ghostPlanOf(leadRace, row)!;
    expect(plan).not.toBeNull();
    expect(plan.n).toBe(4);
    expect(plan.passes).toEqual(['10:06', '10:13', '10:21', '10:28']);
  });
});

/** Every row of the fixture line and the real files. */
const RACES: RaceFile[] = [...fake.races.values(), ...real.races.values()];
const rows = RACES.flatMap((race) => race.races.map((row) => ({ race, row })));

describe('the cars and the ghosts follow the timetable (Req 7.2)', () => {
  it('n is the count of passes in [start, bus departure), on every row', () => {
    for (const { race, row } of rows) {
      const cars = carsOf(race, row);
      if (!row.today) {
        expect(cars).toBeNull();
        continue;
      }
      expect(cars!.passes, `${race.origin} ${race.dest} ${row.t}`).toEqual(oracle(race, row));
    }
  });

  it('no ghost shows before its pass or at or after its pass plus the ride, and none on a row that is not a Ghost_Row', () => {
    const index = (race: RaceFile) => (race.line === 'fake' ? fake : real);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: rows.length - 1 }), fc.double({ min: 0, max: 1, noNaN: true }), (k, share) => {
        const { race, row } = rows[k]!;
        const data = index(race);
        const view = buildView(data.index, data.summary, race, row.t);
        const timeline = buildTimeline(view);
        const elapsed = share * timeline.finishAt;
        const shares = ghostShares(timeline, elapsed);
        const plan = ghostPlanOf(race, row);
        const cars = carsOf(race, row);
        const ghostRow = !row.before_table && row.result !== 'no_one_seat_ride' && cars !== null && cars.covered && cars.passes.length >= 2;
        expect(plan !== null).toBe(ghostRow);
        if (!plan) {
          expect(shares).toEqual([]);
          expect(counterAt(timeline, elapsed)).toEqual({ kind: 'empty' });
          return;
        }
        const startS = secondsOf(row.start);
        plan.passes.slice(1).forEach((p, j) => {
          const at = (secondsOf(p) - startS) / 60;
          const s = shares[j];
          if (elapsed < at || elapsed >= at + race.y1938.ride_min) expect(s).toBeNull();
          else {
            expect(s).not.toBeNull();
            expect(s!).toBeGreaterThanOrEqual(0);
            expect(s!).toBeLessThan(1);
          }
        });
      }),
      { numRuns: 400 },
    );
  });

  it('the counter is empty before the own car, counts the cars passed, and is finished from the bus departure', () => {
    const row = leadRace.races.find((r) => r.t === '10:00')!;
    const view = buildView(real.index, real.summary, leadRace, '10:00');
    const t = buildTimeline(view);
    expect(counterAt(t, 5.9)).toEqual({ kind: 'empty' });
    expect(counterAt(t, 6)).toEqual({ kind: 'counting', k: 1 });
    expect(counterAt(t, 13)).toEqual({ kind: 'counting', k: 2 });
    expect(counterAt(t, 28)).toEqual({ kind: 'counting', k: 4 });
    const trip = leadRace.today.trips[row.today!.trip]!;
    const busAt = (secondsOf(trip.dep) - secondsOf(row.start)) / 60;
    expect(t.ghosts!.busAt).toBeCloseTo(busAt, 2);
    expect(counterAt(t, t.ghosts!.busAt)).toEqual({ kind: 'finished' });
  });
});

describe('the real-data sweep (Req 7.4)', () => {
  it('writes each pair\'s n at 10:00 and the rows the coverage rule hides to test-results/ghost-cars-sweep.md', () => {
    const lines: string[] = ['# Ghost cars: real-data sweep', '', '| Pair | n at 10:00 | Ghost_Row |', '| --- | --- | --- |'];
    const hidden: string[] = [];
    for (const race of real.races.values()) {
      const row = race.races.find((r) => r.t === '10:00');
      const cars = row ? carsOf(race, row) : null;
      lines.push(`| ${race.origin} to ${race.dest} | ${cars ? cars.passes.length : 'no bus'} | ${row && ghostPlanOf(race, row) ? 'yes' : 'no'} |`);
      for (const r of race.races) {
        const c = carsOf(race, r);
        if (c && !c.covered) hidden.push(`${race.origin} to ${race.dest} ${r.t}`);
      }
    }
    lines.push('', `Rows whose bus leaves after the last listed pass (no counter, no ghosts): ${hidden.length}`, ...hidden.map((h) => `- ${h}`));
    const out = resolve(import.meta.dirname, '..', '..', 'test-results');
    mkdirSync(out, { recursive: true });
    writeFileSync(resolve(out, 'ghost-cars-sweep.md'), lines.join('\n') + '\n');
    expect(real.races.size).toBe(20);
  });
});
