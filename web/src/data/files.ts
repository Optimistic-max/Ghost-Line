// Names of the generated files under public/data/ (race-brief 4.4).
import type { Pair } from './types';

export const INDEX_FILE = 'index.json';
export const SUMMARY_FILE = 'summary.json';
export const ROUTE_FILE = 'route.geojson';

/** The race file of a directed pair: race/<origin>__<dest>.json. */
export function raceFileName(pair: Pair): string {
  return `race/${pair.origin}__${pair.dest}.json`;
}

/** The key the loader caches a pair's race file under. */
export function pairKey(pair: Pair): string {
  return `${pair.origin}__${pair.dest}`;
}
