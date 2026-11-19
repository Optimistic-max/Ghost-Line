// Task 4.2 properties P11 and P13.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { gapPart, minutes, roundMinutes, spacing1938 } from '../../src/format/gaps';
import { minuteWordProblems } from '../support/words';

/** A pair of stored gaps in thousandths of a minute, smaller first. */
const gaps = fc
  .tuple(fc.integer({ min: 0, max: 90_000 }), fc.integer({ min: 0, max: 90_000 }))
  .map(([x, y]) => ({ min: Math.min(x, y) / 1000, max: Math.max(x, y) / 1000 }));

const numbersIn = (text: string): number[] => (text.match(/\d+/g) ?? []).map(Number);

describe('gap part (P11)', () => {
  it('uses the "up to" form exactly when the lower gap rounds to 0', () => {
    fc.assert(
      fc.property(gaps, ({ min, max }) => {
        expect(gapPart(min, max).startsWith('up to ')).toBe(roundMinutes(min) === 0);
      }),
    );
  });

  it('shows whole minutes: one number for "up to" and for equal gaps, two otherwise', () => {
    fc.assert(
      fc.property(gaps, ({ min, max }) => {
        const a = roundMinutes(min);
        const b = roundMinutes(max);
        const shown = numbersIn(gapPart(min, max));
        if (a === 0) expect(shown).toEqual([b]);
        else if (a === b) expect(shown).toEqual([a]);
        else expect(shown).toEqual([a, b]);
        expect(gapPart(min, max).endsWith(' apart')).toBe(true);
      }),
    );
  });

  it('reads "every {n} minutes" for 1938 exactly when the rounded gaps are equal', () => {
    fc.assert(
      fc.property(gaps, ({ min, max }) => {
        const a = roundMinutes(min);
        const b = roundMinutes(max);
        const text = spacing1938(min, max);
        expect(numbersIn(text)).toEqual(a === b ? [a] : [a, b]);
        expect(text.includes(' or ')).toBe(a !== b);
      }),
    );
  });
});

describe('minute words (P13)', () => {
  it('says "minute" exactly after 1, and never "1 minutes"', () => {
    fc.assert(
      fc.property(gaps, fc.integer({ min: 0, max: 200 }), ({ min, max }, n) => {
        for (const text of [gapPart(min, max), spacing1938(min, max), minutes(n)]) {
          expect(minuteWordProblems(text), text).toEqual([]);
        }
      }),
    );
  });
});
