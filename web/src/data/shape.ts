// Hand-written shape checks for the four generated files (design 3.2). No schema
// library: it would cost first-screen budget. Each check throws ShapeError naming
// the file and the field; the message is for logs and tests, never shown.
//
// The checks only compare and look up. They never re-derive a stored number.
import { minuteAfter } from '../format/time';
import { INDEX_FILE, ROUTE_FILE, SUMMARY_FILE, raceFileName } from './files';
import type { Index, Pair, RaceFile, Route, SourceId, SourceMap, Summary } from './types';

export class ShapeError extends Error {
  readonly file: string;
  readonly field: string;
  constructor(file: string, field: string, problem: string) {
    super(`${file}: ${field}: ${problem}`);
    this.name = 'ShapeError';
    this.file = file;
    this.field = field;
  }
}

/** What the other files are checked against: the catalog IDs and corner slugs of index.json. */
export type Catalog = { sources: ReadonlySet<string>; slugs: ReadonlySet<string> };

type Ctx = { file: string; catalog: Catalog };
type Check<T> = ((value: unknown, at: string, ctx: Ctx) => T) & { optional?: true };
type Shape = Record<string, Check<unknown>>;
type Out<S extends Shape> = { [K in keyof S]: S[K] extends Check<infer T> ? T : never };

function fail(ctx: Ctx, at: string, problem: string): never {
  throw new ShapeError(ctx.file, at === '' ? '(top level)' : at, problem);
}

const join = (at: string, key: string): string => (at === '' ? key : `${at}.${key}`);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---- Leaf checks -------------------------------------------------------------

const str: Check<string> = (v, at, ctx) => (typeof v === 'string' ? v : fail(ctx, at, 'expected a string'));

const text: Check<string> = (v, at, ctx) =>
  str(v, at, ctx) !== '' ? (v as string) : fail(ctx, at, 'expected a non-empty string');

function matching(re: RegExp, what: string): Check<string> {
  return (v, at, ctx) => (re.test(str(v, at, ctx)) ? (v as string) : fail(ctx, at, `expected ${what}`));
}

const clock = matching(/^\d{2}:[0-5]\d$/, 'an hh:mm time');
const clockSeconds = matching(/^\d{2}:[0-5]\d:[0-5]\d$/, 'an hh:mm:ss time');
const isoDate = matching(/^\d{4}-\d{2}-\d{2}$/, 'a yyyy-mm-dd date');
const sha256 = matching(/^[0-9a-f]{64}$/, 'a SHA-256 hex digest');
const httpsUrl = matching(/^https:\/\/\S+$/, 'an https URL');
const slugText = matching(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'a corner slug');

const finite: Check<number> = (v, at, ctx) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fail(ctx, at, 'expected a finite number');

const nonNegative: Check<number> = (v, at, ctx) =>
  finite(v, at, ctx) >= 0 ? (v as number) : fail(ctx, at, 'expected a number at or above 0');

const positive: Check<number> = (v, at, ctx) =>
  finite(v, at, ctx) > 0 ? (v as number) : fail(ctx, at, 'expected a number above 0');

const count: Check<number> = (v, at, ctx) =>
  Number.isInteger(nonNegative(v, at, ctx)) ? (v as number) : fail(ctx, at, 'expected a whole number');

const bool: Check<boolean> = (v, at, ctx) => (typeof v === 'boolean' ? v : fail(ctx, at, 'expected true or false'));

const slug: Check<string> = (v, at, ctx) =>
  ctx.catalog.slugs.has(slugText(v, at, ctx)) ? (v as string) : fail(ctx, at, `unknown corner slug ${JSON.stringify(v)}`);

const lonLat: Check<[number, number]> = (v, at, ctx) => {
  if (!Array.isArray(v) || v.length !== 2) return fail(ctx, at, 'expected [lon, lat]');
  finite(v[0], `${at}[0]`, ctx);
  finite(v[1], `${at}[1]`, ctx);
  return v as [number, number];
};

function exactly<T extends string>(value: T): Check<T> {
  return (v, at, ctx) => (v === value ? value : fail(ctx, at, `expected ${JSON.stringify(value)}`));
}

function oneOf<T extends string>(values: readonly T[]): Check<T> {
  return (v, at, ctx) =>
    (values as readonly unknown[]).includes(v) ? (v as T) : fail(ctx, at, `expected one of ${values.join(', ')}`);
}

function nullable<T>(check: Check<T>): Check<T | null> {
  return (v, at, ctx) => (v === null ? null : check(v, at, ctx));
}

function optional<T>(check: Check<T>): Check<T | undefined> {
  const f: Check<T | undefined> = (v, at, ctx) => (v === undefined ? undefined : check(v, at, ctx));
  f.optional = true;
  return f;
}

function arrayOf<T>(item: Check<T>, minLength = 0): Check<T[]> {
  return (v, at, ctx) => {
    if (!Array.isArray(v)) return fail(ctx, at, 'expected a list');
    if (v.length < minLength) return fail(ctx, at, `expected at least ${minLength} item(s)`);
    v.forEach((x, k) => item(x, `${at}[${k}]`, ctx));
    return v as T[];
  };
}

function object<S extends Shape>(shape: S): Check<Out<S>> {
  return (v, at, ctx) => {
    if (!isRecord(v)) return fail(ctx, at, 'expected an object');
    for (const [key, check] of Object.entries(shape)) {
      const where = join(at, key);
      if (!(key in v) && !check.optional) fail(ctx, where, 'missing');
      check(v[key], where, ctx);
    }
    return v as Out<S>;
  };
}

/** A block-to-source-IDs map: the required keys are present and every ID is in the catalog. */
function sourceMap(required: readonly string[]): Check<SourceMap> {
  return (v, at, ctx) => {
    if (!isRecord(v)) return fail(ctx, at, 'expected an object');
    for (const key of required) if (!(key in v)) fail(ctx, join(at, key), 'missing');
    for (const [key, ids] of Object.entries(v)) {
      const where = join(at, key);
      if (!Array.isArray(ids) || ids.length === 0) fail(ctx, where, 'expected a non-empty list of source IDs');
      ids.forEach((id, k) => {
        if (typeof id !== 'string' || !ctx.catalog.sources.has(id)) {
          fail(ctx, `${where}[${k}]`, `unknown source ID ${JSON.stringify(id)}`);
        }
      });
    }
    return v as SourceMap;
  };
}

// ---- index.json ----------------------------------------------------------------

const INDEX_SOURCE_IDS: readonly SourceId[] = [
  'guide1938_diagram',
  'guide1938_timetable',
  'guide1938_route',
  'mta_gtfs',
  'osm',
  'method',
];

const sourceEntryShape = { label: text, what: text, year: count, where: text, url: httpsUrl };
// Only the method entry may have no year and no link.
const methodEntryShape = { label: text, what: text, year: nullable(count), where: text, url: nullable(httpsUrl) };
const indexSourcesShape = {
  guide1938_diagram: object(sourceEntryShape),
  guide1938_timetable: object(sourceEntryShape),
  guide1938_route: object(sourceEntryShape),
  mta_gtfs: object(sourceEntryShape),
  osm: object(sourceEntryShape),
  method: object(methodEntryShape),
};
const cornerShape = { slug: slugText, name: text, lonlat: lonLat, inferred: bool, note: nullable(str) };
const pairShape = { origin: slug, dest: slug };
const indexShape = {
  schema: exactly('ghostline.index.v1'),
  line: text,
  mode: text,
  effective: isoDate,
  corners: arrayOf(object(cornerShape), 1),
  pairs: arrayOf(object(pairShape), 1),
  service_date: isoDate,
  feed_version: text,
  feed_sha256: sha256,
  street_order_checked: bool,
  sources: object(indexSourcesShape),
};

export function checkIndex(raw: unknown): Index {
  const empty: Ctx = { file: INDEX_FILE, catalog: { sources: new Set(), slugs: new Set() } };
  // Corners first: the pairs refer to their slugs.
  const { corners } = object({ corners: arrayOf(object(cornerShape), 1) })(raw, '', empty);
  const slugs = new Set<string>();
  corners.forEach((corner, k) => {
    if (slugs.has(corner.slug)) fail(empty, `corners[${k}].slug`, 'duplicate slug');
    slugs.add(corner.slug);
  });
  const ctx: Ctx = { file: INDEX_FILE, catalog: { sources: new Set(INDEX_SOURCE_IDS), slugs } };
  const index: Index = object(indexShape)(raw, '', ctx);
  index.pairs.forEach((pair, k) => {
    if (pair.origin === pair.dest) fail(ctx, `pairs[${k}]`, 'origin equals destination');
  });
  return index;
}

/** The catalog IDs and corner slugs of a checked index.json. */
export function catalogOf(index: Index): Catalog {
  return { sources: new Set(Object.keys(index.sources)), slugs: new Set(index.corners.map((c) => c.slug)) };
}

// ---- summary.json --------------------------------------------------------------

const SUMMARY_SOURCE_KEYS = [
  'races',
  'wins_1938',
  'wins_today',
  'photo_finishes',
  'ride_same',
  'ride_faster_today',
  'ride_slower_today',
  'pairs_without_one_seat_ride',
  'today_wins',
  'pairs',
] as const;

const todayWinShape = { origin: slug, dest: slug, t: clock, margin: nonNegative };
const pairVerdictShape = {
  origin: slug,
  dest: slug,
  races: count,
  wins_1938: count,
  wins_today: count,
  photo_finishes: count,
  ride_1938: positive,
  ride_today_median: nullable(nonNegative),
  delta: nullable(finite),
  ride_verdict: nullable(oneOf(['same', 'faster today', 'slower today'] as const)),
};
const summaryShape = {
  schema: exactly('ghostline.summary.v1'),
  definition: str,
  races: count,
  wins_1938: count,
  wins_today: count,
  photo_finishes: count,
  ride_same: count,
  ride_faster_today: count,
  ride_slower_today: count,
  pairs_without_one_seat_ride: count,
  today_wins: arrayOf(object(todayWinShape)),
  pairs: arrayOf(object(pairVerdictShape)),
  sources: sourceMap(SUMMARY_SOURCE_KEYS),
};

export function checkSummary(raw: unknown, catalog: Catalog): Summary {
  return object(summaryShape)(raw, '', { file: SUMMARY_FILE, catalog });
}

// ---- race/<origin>__<dest>.json ------------------------------------------------

const RACE_SOURCE_KEYS = ['y1938', 'today', 'races', 'radius_m'] as const;
const RESULTS = ['1938', 'today', 'photo_finish', 'no_one_seat_ride'] as const;
const DIRECTIONS = ['eastbound', 'westbound'] as const;

const stopRefShape = { stop_id: text, name: text, walk_m: nonNegative, walk_min: nonNegative };
const tripShape = {
  i: count,
  trip_id: text,
  route: text,
  route_display: text,
  headsign: str,
  board: object(stopRefShape),
  alight: object(stopRefShape),
  dep: clockSeconds,
  arr: clockSeconds,
  ride_min: nonNegative,
};
const clock1938SourcesShape = { ride_min: httpsUrl, passes: httpsUrl };
const clock1938Shape = {
  ride_min: positive,
  covered_from: clock,
  passes: arrayOf(clock, 1),
  gap_min: nonNegative,
  gap_max: nonNegative,
  sources: object(clock1938SourcesShape),
};
const todayTripsShape = {
  gap_min: nullable(nonNegative),
  gap_max: nullable(nonNegative),
  window_from: clock,
  window_to: clock,
  route_names: arrayOf(text),
  trips: arrayOf(object(tripShape)),
};
const race1938SideShape = { dep: clock, wait: nonNegative, total: positive };
const raceTodaySideShape = { trip: count, wait: nonNegative, total: positive };
const raceRowShape = {
  t: clock,
  start: clock,
  before_table: bool,
  y1938: object(race1938SideShape),
  today: nullable(object(raceTodaySideShape)),
  result: oneOf(RESULTS),
  margin: optional(nonNegative),
};
const raceShape = {
  schema: exactly('ghostline.race.v1'),
  line: text,
  origin: slug,
  dest: slug,
  direction: oneOf(DIRECTIONS),
  inferred: bool,
  service_date: isoDate,
  feed_version: text,
  feed_sha256: sha256,
  radius_m: positive,
  y1938: object(clock1938Shape),
  today: object(todayTripsShape),
  races: arrayOf(object(raceRowShape), 1),
  sources: sourceMap(RACE_SOURCE_KEYS),
};

/**
 * Check a race file. With `pair`, the file must be that pair's file. Beyond the
 * field types it checks: 1938 passes strictly increasing; trip `i` equal to its
 * position; one row per whole minute; `start` equal to `t`, or to `covered_from`
 * before the table; every row's 1938 car a listed pass; every trip index inside
 * `today.trips`; `today`, `result` and `margin` agreeing on whether a bus exists.
 */
export function checkRace(raw: unknown, catalog: Catalog, pair?: Pair): RaceFile {
  const ctx: Ctx = { file: pair ? raceFileName(pair) : 'race file', catalog };
  const race: RaceFile = object(raceShape)(raw, '', ctx);
  if (pair && (race.origin !== pair.origin || race.dest !== pair.dest)) {
    fail(ctx, 'origin', `file is for ${race.origin} to ${race.dest}`);
  }
  if (race.origin === race.dest) fail(ctx, 'dest', 'origin equals destination');

  let previousPass: string | null = null;
  for (const [k, pass] of race.y1938.passes.entries()) {
    // Zero-padded hh:mm strings sort in time order.
    if (previousPass !== null && !(previousPass < pass)) fail(ctx, `y1938.passes[${k}]`, 'not strictly increasing');
    previousPass = pass;
  }

  const { trips } = race.today;
  for (const [k, trip] of trips.entries()) {
    if (trip.i !== k) fail(ctx, `today.trips[${k}].i`, 'does not match its position in the list');
  }
  if (trips.length > 0 && (race.today.gap_min === null || race.today.gap_max === null)) {
    fail(ctx, 'today.gap_min', 'null although trips are listed');
  }

  const passes = new Set(race.y1938.passes);
  let previousT: string | null = null;
  for (const [k, row] of race.races.entries()) {
    const at = `races[${k}]`;
    if (previousT !== null && row.t !== minuteAfter(previousT)) fail(ctx, `${at}.t`, 'rows are not one per whole minute');
    previousT = row.t;
    const expectedStart = row.before_table ? race.y1938.covered_from : row.t;
    if (row.start !== expectedStart) fail(ctx, `${at}.start`, `expected ${expectedStart}`);
    if (!passes.has(row.y1938.dep)) fail(ctx, `${at}.y1938.dep`, 'not a listed 1938 pass');
    if (row.today === null) {
      if (row.result !== 'no_one_seat_ride') fail(ctx, `${at}.result`, 'today is null, so expected no_one_seat_ride');
    } else {
      if (row.result === 'no_one_seat_ride') fail(ctx, `${at}.today`, 'expected null for no_one_seat_ride');
      if (!(row.today.trip < trips.length)) fail(ctx, `${at}.today.trip`, 'trip index outside today.trips');
    }
    const hasMargin = row.margin !== undefined;
    if (hasMargin === (row.result === 'no_one_seat_ride')) {
      fail(ctx, `${at}.margin`, hasMargin ? 'not expected for no_one_seat_ride' : 'missing');
    }
  }
  return race;
}

// ---- route.geojson -------------------------------------------------------------

const position: Check<number[]> = (v, at, ctx) => {
  arrayOf(finite, 2)(v, at, ctx);
  return v as number[];
};
const lineStringShape = { type: exactly('LineString'), coordinates: arrayOf(position, 2) };
const legPropertiesShape = {
  direction: oneOf(DIRECTIONS),
  street: str,
  method: oneOf(['osm', 'osm+gap', 'inferred'] as const),
  note: nullable(str),
  length_m: nonNegative,
};
const routeLegShape = { type: exactly('Feature'), geometry: object(lineStringShape), properties: object(legPropertiesShape) };
const ROUTE_SOURCE_KEYS = ['features'] as const;
const routeShape = {
  type: exactly('FeatureCollection'),
  features: arrayOf(object(routeLegShape), 1),
  sources: sourceMap(ROUTE_SOURCE_KEYS),
};

export function checkRoute(raw: unknown, catalog: Catalog): Route {
  return object(routeShape)(raw, '', { file: ROUTE_FILE, catalog });
}

// ---- Field lists, for the contract test against pipeline/schemas ---------------

const keys = (shape: Shape): readonly string[] => Object.keys(shape);

/** The fields each check requires, by object. tests/unit/shape-contract.test.ts compares them with the schemas. */
export const CHECKED_FIELDS = {
  index: keys(indexShape),
  indexSources: INDEX_SOURCE_IDS,
  corner: keys(cornerShape),
  pair: keys(pairShape),
  sourceEntry: keys(sourceEntryShape),
  methodEntry: keys(methodEntryShape),
  summary: keys(summaryShape),
  summarySources: SUMMARY_SOURCE_KEYS,
  todayWin: keys(todayWinShape),
  pairVerdict: keys(pairVerdictShape),
  race: keys(raceShape),
  raceSources: RACE_SOURCE_KEYS,
  clock1938: keys(clock1938Shape),
  clock1938Sources: keys(clock1938SourcesShape),
  todayTrips: keys(todayTripsShape),
  trip: keys(tripShape),
  stopRef: keys(stopRefShape),
  raceRow: keys(raceRowShape),
  race1938Side: keys(race1938SideShape),
  raceTodaySide: keys(raceTodaySideShape),
  route: keys(routeShape),
  routeSources: ROUTE_SOURCE_KEYS,
  routeLeg: keys(routeLegShape),
  lineString: keys(lineStringShape),
  legProperties: keys(legPropertiesShape),
} as const;
