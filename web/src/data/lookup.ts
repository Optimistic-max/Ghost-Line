// Lookups (design section 8). Allowed: finding a row by its minute, a trip by its
// index and the next entries of a list by position. No time is compared or
// subtracted to choose anything.
import type { Index, Pair, RaceFile, RaceRow, SourceEntry, SourceId, SourceMap, Trip } from './types';

const rowMaps = new WeakMap<RaceFile, Map<string, RaceRow>>();

/** The race row whose slider time is `hhmm`, through a Map built once per race file. */
export function rowAt(race: RaceFile, hhmm: string): RaceRow | undefined {
  let rows = rowMaps.get(race);
  if (!rows) {
    rows = new Map(race.races.map((row) => [row.t, row]));
    rowMaps.set(race, rows);
  }
  return rows.get(hhmm);
}

/** The trip a race row points at, by its index in today.trips. */
export function tripAt(race: RaceFile, i: number): Trip | undefined {
  return race.today.trips[i];
}

/**
 * `current` and the entries after it, by position in `list`, at most `count`
 * in all. Empty when `current` is not in the list. Fewer when the list ends.
 */
export function nextAfter<T>(list: readonly T[], current: T, count: number): T[] {
  const at = list.indexOf(current);
  if (at === -1) return [];
  return list.slice(at, at + count);
}

/** The first and last slider times of a race file. */
export function sliderRange(race: RaceFile): { first: string; last: string } {
  const first = race.races[0];
  const last = race.races.at(-1);
  if (!first || !last) throw new Error('race file has no rows');
  return { first: first.t, last: last.t };
}

/** True when `pair` is one of index.json's pairs. */
export function hasPair(index: Index, pair: Pair): boolean {
  return index.pairs.some((p) => p.origin === pair.origin && p.dest === pair.dest);
}

/** A corner's display name by slug. */
export function cornerName(index: Index, slug: string): string | undefined {
  return index.corners.find((c) => c.slug === slug)?.name;
}

/** The catalog entries that cover one block of a file, in the file's order. */
export function sourcesOf(index: Index, map: SourceMap, block: string): { id: SourceId; entry: SourceEntry }[] {
  return (map[block] ?? []).map((id) => ({ id, entry: index.sources[id] }));
}

/** The entry at position k mod n, and the next position. Lookup by position only. */
export function cycleAt<T>(list: readonly T[], k: number): { entry: T; next: number } {
  const n = list.length;
  if (n === 0) throw new Error('cycleAt: empty list');
  const at = ((k % n) + n) % n;
  return { entry: list[at] as T, next: (at + 1) % n };
}
