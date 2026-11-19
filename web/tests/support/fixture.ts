// The made-up "fake" line in tests/fixtures/fake (written by make-fake.mjs).
import { INDEX_FILE, ROUTE_FILE, SUMMARY_FILE, pairKey, raceFileName } from '../../src/data/files';
import { catalogOf, checkIndex, checkRace, checkRoute, checkSummary } from '../../src/data/shape';
import type { Index, Pair, RaceFile, Route, Summary } from '../../src/data/types';
import { listRepoFiles, readRepoJson } from './files';

export const FIXTURE_DIR = 'web/tests/fixtures/fake';

export function readFixture<T = unknown>(name: string): T {
  return readRepoJson<T>(`${FIXTURE_DIR}/${name}`);
}

export function fixtureFileNames(): string[] {
  return listRepoFiles(FIXTURE_DIR).map((p) => p.slice(FIXTURE_DIR.length + 1));
}

export type FixtureData = { index: Index; summary: Summary; route: Route; races: Map<string, RaceFile> };

/** Every fixture file, shape-checked by the site's own checks. */
export function fixtureData(): FixtureData {
  const index = checkIndex(readFixture(INDEX_FILE));
  const catalog = catalogOf(index);
  const races = new Map<string, RaceFile>();
  for (const pair of index.pairs) races.set(pairKey(pair), checkRace(readFixture(raceFileName(pair)), catalog, pair));
  return {
    index,
    summary: checkSummary(readFixture(SUMMARY_FILE), catalog),
    route: checkRoute(readFixture(ROUTE_FILE), catalog),
    races,
  };
}

export function fixtureRace(pair: Pair): RaceFile {
  const race = fixtureData().races.get(pairKey(pair));
  if (!race) throw new Error(`no fixture race for ${pairKey(pair)}`);
  return race;
}
