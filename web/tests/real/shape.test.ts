// Task 2.4: every real file passes its shape check, and mutated copies fail,
// each at the field the mutation broke.
import { describe, expect, it } from 'vitest';
import { INDEX_FILE, ROUTE_FILE, SUMMARY_FILE, raceFileName } from '../../src/data/files';
import { CHECKED_FIELDS, ShapeError, catalogOf, checkIndex, checkRace, checkRoute, checkSummary } from '../../src/data/shape';
import type { Pair } from '../../src/data/types';
import { dataFileNames, readData, realData } from '../support/realdata';

// Mutations reach into the raw JSON freely.
type Obj = Record<string, any>;
type Case = [name: string, field: string, mutate: (d: Obj) => void];

const index0 = readData<Obj>(INDEX_FILE);
const summary0 = readData<Obj>(SUMMARY_FILE);
const route0 = readData<Obj>(ROUTE_FILE);
const pair0: Pair = { origin: index0.pairs[0].origin, dest: index0.pairs[0].dest };
const race0 = readData<Obj>(raceFileName(pair0));
const catalog = catalogOf(checkIndex(index0));

function copy<T>(value: T): T {
  return structuredClone(value);
}

function shapeErrorOf(run: () => unknown): ShapeError {
  try {
    run();
  } catch (e) {
    expect(e).toBeInstanceOf(ShapeError);
    return e as ShapeError;
  }
  throw new Error('expected a ShapeError, but the check passed');
}

function mutationSuite(file: string, base: Obj, fields: readonly string[], cases: Case[], check: (d: Obj) => unknown): void {
  for (const field of fields) {
    it(`fails without ${field}`, () => {
      const bad = copy(base);
      delete bad[field];
      const error = shapeErrorOf(() => check(bad));
      expect(error.file).toBe(file);
      expect(error.field).toBe(field);
    });
  }
  for (const [name, field, mutate] of cases) {
    it(`fails with ${name}, at ${field}`, () => {
      const bad = copy(base);
      mutate(bad);
      const error = shapeErrorOf(() => check(bad));
      expect(error.file).toBe(file);
      expect(error.field).toBe(field);
    });
  }
}

describe('the real files pass their shape checks', () => {
  it('validates every file in web/public/data: index, summary, route and one race file per pair', () => {
    const { index, races } = realData();
    const expected = [INDEX_FILE, SUMMARY_FILE, ROUTE_FILE, ...index.pairs.map(raceFileName)].sort();
    expect(dataFileNames().sort()).toEqual(expected);
    expect(races.size).toBe(index.pairs.length);
  });

  it('gives every race file the same slider range', () => {
    const ranges = new Set([...realData().races.values()].map((r) => `${r.races[0]!.t}-${r.races.at(-1)!.t}`));
    expect(ranges.size).toBe(1);
  });

  it('checks a race file against the pair it was asked for', () => {
    const other = realData().index.pairs[1]!;
    const error = shapeErrorOf(() => checkRace(copy(race0), catalog, other));
    expect(error.file).toBe(raceFileName(other));
    expect(error.field).toBe('origin');
  });
});

describe('mutated copies fail', () => {
  describe('index.json', () => {
    mutationSuite(
      INDEX_FILE,
      index0,
      CHECKED_FIELDS.index,
      [
        ['a type changed', 'street_order_checked', (d) => (d.street_order_checked = 'false')],
        ['a null where a number is needed', 'corners[0].lonlat[0]', (d) => (d.corners[0].lonlat[0] = null)],
        ['an unknown corner in a pair', 'pairs[0].dest', (d) => (d.pairs[0].dest = 'nowhere')],
        ['a pair from a corner to itself', 'pairs[0]', (d) => (d.pairs[0].dest = d.pairs[0].origin)],
        ['a catalog entry without its label', 'sources.mta_gtfs.label', (d) => delete d.sources.mta_gtfs.label],
        ['a duplicate corner slug', 'corners[1].slug', (d) => (d.corners[1].slug = d.corners[0].slug)],
        ['a different schema version', 'schema', (d) => (d.schema = 'ghostline.index.v0')],
      ],
      (d) => checkIndex(d),
    );
  });

  describe('summary.json', () => {
    mutationSuite(
      SUMMARY_FILE,
      summary0,
      CHECKED_FIELDS.summary,
      [
        ['a type changed', 'wins_1938', (d) => (d.wins_1938 = String(d.wins_1938))],
        ['a null where a number is needed', 'races', (d) => (d.races = null)],
        ['a fractional count', 'ride_same', (d) => (d.ride_same = 0.5)],
        ['an unknown source ID', 'sources.races[0]', (d) => (d.sources.races = ['made_up_source'])],
        ['an unknown corner in today_wins', 'today_wins[0].origin', (d) => (d.today_wins[0].origin = 'nowhere')],
        ['a pair verdict without a count', 'pairs[0].wins_1938', (d) => delete d.pairs[0].wins_1938],
      ],
      (d) => checkSummary(d, catalog),
    );
  });

  describe('race file', () => {
    const rows = race0.races as Obj[];
    const middle = Math.floor(rows.length / 2);
    const last = rows.length - 1;
    const bus = rows.findIndex((r) => r.today !== null);
    mutationSuite(
      raceFileName(pair0),
      race0,
      CHECKED_FIELDS.race,
      [
        ['a type changed', 'y1938.ride_min', (d) => (d.y1938.ride_min = String(d.y1938.ride_min))],
        ['a row dropped', `races[${middle}].t`, (d) => d.races.splice(middle, 1)],
        ['a row repeated', `races[${middle + 1}].t`, (d) => d.races.splice(middle, 0, copy(d.races[middle]))],
        ['a trip index out of range', `races[${bus}].today.trip`, (d) => (d.races[bus].today.trip = d.today.trips.length)],
        ['an unknown source ID', 'sources.today[0]', (d) => (d.sources.today = ['made_up_source'])],
        ['a null where a number is needed', `races[${middle}].y1938.wait`, (d) => (d.races[middle].y1938.wait = null)],
        ['a non-finite number', `races[${middle}].y1938.total`, (d) => (d.races[middle].y1938.total = Infinity)],
        ['a missing margin', `races[${bus}].margin`, (d) => delete d.races[bus].margin],
        ['a bus row labelled no_one_seat_ride', `races[${bus}].today`, (d) => (d.races[bus].result = 'no_one_seat_ride')],
        ['an unknown result', `races[${middle}].result`, (d) => (d.races[middle].result = 'tie')],
        ['a 1938 car that is not a listed pass', `races[${middle}].y1938.dep`, (d) => (d.races[middle].y1938.dep = '00:01')],
        ['a start that does not match the slider time', `races[${last}].start`, (d) => (d.races[last].start = d.races[0].t)],
        ['a trip whose i is not its position', 'today.trips[0].i', (d) => (d.today.trips[0].i = 1)],
        ['passes out of order', 'y1938.passes[1]', (d) => d.y1938.passes.reverse()],
        ['a trip without its walk minutes', 'today.trips[0].board.walk_min', (d) => delete d.today.trips[0].board.walk_min],
        ['a malformed clock time', `races[${middle}].t`, (d) => (d.races[middle].t = '9:5')],
      ],
      (d) => checkRace(d, catalog, pair0),
    );
  });

  describe('route.geojson', () => {
    mutationSuite(
      ROUTE_FILE,
      route0,
      CHECKED_FIELDS.route,
      [
        ['no legs', 'features', (d) => (d.features = [])],
        ['a leg with one point', 'features[0].geometry.coordinates', (d) => d.features[0].geometry.coordinates.splice(1)],
        ['a null where a number is needed', 'features[0].properties.length_m', (d) => (d.features[0].properties.length_m = null)],
        ['an unknown source ID', 'sources.features[0]', (d) => (d.sources.features = ['made_up_source'])],
        ['an unknown leg method', 'features[0].properties.method', (d) => (d.features[0].properties.method = 'guess')],
      ],
      (d) => checkRoute(d, catalog),
    );
  });
});
