// The generated files in web/public/data, read from disk for the real-data tests.
// Expected values in those tests come from these files, never from the briefs.
import { INDEX_FILE, ROUTE_FILE, SUMMARY_FILE, pairKey, raceFileName } from '../../src/data/files';
import { catalogOf, checkIndex, checkRace, checkRoute, checkSummary } from '../../src/data/shape';
import type { Index, Pair, RaceFile, Route, Summary } from '../../src/data/types';
import { listRepoFiles, readRepoJson } from './files';

export const DATA_DIR = 'web/public/data';

export function readData<T = unknown>(name: string): T {
  return readRepoJson<T>(`${DATA_DIR}/${name}`);
}

/** Every file under web/public/data, as names relative to that folder. */
export function dataFileNames(): string[] {
  return listRepoFiles(DATA_DIR).map((p) => p.slice(DATA_DIR.length + 1));
}

export type RealData = { index: Index; summary: Summary; route: Route; races: Map<string, RaceFile> };

let cached: RealData | null = null;

/** All real files, shape-checked. */
export function realData(): RealData {
  if (cached) return cached;
  const index = checkIndex(readData(INDEX_FILE));
  const catalog = catalogOf(index);
  const races = new Map<string, RaceFile>();
  for (const pair of index.pairs) races.set(pairKey(pair), checkRace(readData(raceFileName(pair)), catalog, pair));
  cached = {
    index,
    summary: checkSummary(readData(SUMMARY_FILE), catalog),
    route: checkRoute(readData(ROUTE_FILE), catalog),
    races,
  };
  return cached;
}

export function raceOf(pair: Pair): RaceFile {
  const race = realData().races.get(pairKey(pair));
  if (!race) throw new Error(`no race file for ${pairKey(pair)}`);
  return race;
}

/** A corner slug by its name in index.json. */
export function slugNamed(name: string): string {
  const corner = realData().index.corners.find((c) => c.name === name);
  if (!corner) throw new Error(`no corner named ${name}`);
  return corner.slug;
}
