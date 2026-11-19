// Whole-minute gaps and the frequency sentence's gap part (R8.5, design 6).
// Allowed arithmetic: rounding stored gaps for display. The words are in copy.ts.
import { everyMinutes, everyMinutesOr, gapEqual, gapRange, gapUpTo, minuteWord, minutes } from '../copy/copy';
import { roundMinutes } from './rounding';

export { minuteWord, minutes, roundMinutes };

export type GapForm =
  | { kind: 'up-to'; max: number }
  | { kind: 'equal'; n: number }
  | { kind: 'range'; min: number; max: number };

/** Which form the bus gap part takes. The "up to" rule is checked first. */
export function gapForm(gapMin: number, gapMax: number): GapForm {
  const a = roundMinutes(gapMin);
  const b = roundMinutes(gapMax);
  if (a === 0) return { kind: 'up-to', max: b };
  if (a === b) return { kind: 'equal', n: a };
  return { kind: 'range', min: a, max: b };
}

/** The {gap part} text: "up to 9 minutes apart", "34 to 39 minutes apart" or "7 minutes apart". */
export function gapPart(gapMin: number, gapMax: number): string {
  const form = gapForm(gapMin, gapMax);
  switch (form.kind) {
    case 'up-to':
      return gapUpTo(form.max);
    case 'equal':
      return gapEqual(form.n);
    case 'range':
      return gapRange(form.min, form.max);
  }
}

/** The 1938 spacing: "every 7 or 8 minutes", or "every 7 minutes" when the rounded gaps are equal. */
export function spacing1938(gapMin: number, gapMax: number): string {
  const a = roundMinutes(gapMin);
  const b = roundMinutes(gapMax);
  return a === b ? everyMinutes(a) : everyMinutesOr(a, b);
}
