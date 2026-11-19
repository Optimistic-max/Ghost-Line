// Display rounding (screen-brief 2.10, design 6, R7). Allowed arithmetic: it
// rounds stored minutes for display and never changes them or decides a result.

export class RoundingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoundingError';
  }
}

/** Round at six decimals, so floating-point noise never decides a tie. */
function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

/** A stored total shown to the nearest whole minute, halves up (R7.2). */
export function roundTotal(stored: number): number {
  return Math.floor(round6(stored) + 0.5);
}

/** The same rule for any single stored value, such as a gap. */
export const roundMinutes = roundTotal;

export type Rounded = { shownTotal: number; shown: number[] };

/**
 * Parts by the largest-remainder method (R7.3): round every part down, then give
 * one minute each to the parts with the largest fractions, largest first, ties
 * to the earlier phase, until the parts add up to the shown total. Throws
 * RoundingError when that cannot hold with each part within one minute.
 */
export function roundParts(parts: readonly number[], storedTotal: number): Rounded {
  if (!Number.isFinite(storedTotal) || storedTotal < 0) throw new RoundingError(`bad total ${storedTotal}`);
  const exact = parts.map((p) => {
    if (!Number.isFinite(p) || p < 0) throw new RoundingError(`bad part ${p}`);
    return round6(p);
  });
  const shownTotal = roundTotal(storedTotal);
  const shown = exact.map((p) => Math.floor(p));
  const missing = shownTotal - shown.reduce((sum, p) => sum + p, 0);
  const byFraction = exact
    .map((p, i) => ({ i, fraction: round6(p - Math.floor(p)) }))
    .filter((x) => x.fraction > 0)
    .sort((x, y) => y.fraction - x.fraction || x.i - y.i);
  if (missing < 0 || missing > byFraction.length) {
    throw new RoundingError(`parts ${parts.join(', ')} cannot add up to a shown total of ${shownTotal}`);
  }
  for (const { i } of byFraction.slice(0, missing)) shown[i] = (shown[i] ?? 0) + 1;
  return { shownTotal, shown };
}

/** The shown margin: the difference of the two shown totals (R7.4). */
export function shownMargin(shownTotalA: number, shownTotalB: number): number {
  return Math.abs(shownTotalA - shownTotalB);
}

export type PhotoTotals = { form: 'both'; n: number } | { form: 'about'; n: number; m: number };

/**
 * Photo-finish copy (R7.6): "Both about N minutes" when the two shown totals
 * are equal, otherwise "About N and M minutes" with the smaller first.
 */
export function photoTotals(shownA: number, shownB: number): PhotoTotals {
  return shownA === shownB
    ? { form: 'both', n: shownA }
    : { form: 'about', n: Math.min(shownA, shownB), m: Math.max(shownA, shownB) };
}

/** The sum of shown parts, such as the spoken walking total (R7.5). */
export function sumShown(shown: readonly number[]): number {
  return shown.reduce((sum, p) => sum + p, 0);
}

/** False when a shown part is not the plain rounding of its stored value, so the Sources row adds "Exact value" (R7.7). */
export function isPlainRounding(shown: number, stored: number): boolean {
  return shown === roundTotal(stored);
}
