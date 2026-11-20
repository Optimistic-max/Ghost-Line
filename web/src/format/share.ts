// The share link (R4.4, race-brief 5.9): ?from=<slug>&to=<slug> and nothing else.
// No time and no number ever goes into the URL.
import { LEAD_PAIR } from '../config';
import type { Pair } from '../data/types';

export function encode(pair: Pair): string {
  return `?from=${encodeURIComponent(pair.origin)}&to=${encodeURIComponent(pair.dest)}`;
}

export type Decoded = { pair: Pair; bad: boolean };

/** True when a query carries a `from` or a `to`: a shared link, good or bad. Never throws. */
export function namesAPair(query: unknown): boolean {
  if (typeof query !== 'string') return false;
  try {
    const params = new URLSearchParams(query);
    return params.has('from') || params.has('to');
  } catch {
    return false;
  }
}

/**
 * The pair a query names. Only `from` and `to` are read; any other parameter
 * (such as a tracking tag a social app adds) is ignored. `from` and `to`, once
 * each, with two different known slugs, select a pair; a missing, repeated,
 * unknown or equal pair gives the lead pair with `bad: true`. No query at all,
 * or a query with neither parameter, gives the lead pair with `bad: false`.
 * Never throws.
 */
export function decode(query: unknown, known: ReadonlySet<string>): Decoded {
  const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
  const bad: Decoded = { pair: lead, bad: true };
  if (typeof query !== 'string') return bad;
  try {
    const params = new URLSearchParams(query);
    const from = params.getAll('from');
    const to = params.getAll('to');
    if (from.length === 0 && to.length === 0) return { pair: lead, bad: false };
    if (from.length !== 1 || to.length !== 1) return bad;
    const origin = from[0];
    const dest = to[0];
    if (origin === undefined || dest === undefined || origin === dest) return bad;
    if (!known.has(origin) || !known.has(dest)) return bad;
    return { pair: { origin, dest }, bad: false };
  } catch {
    return bad;
  }
}
