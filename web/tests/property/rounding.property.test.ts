// Task 4.1 properties (R7.8, P4).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { roundParts, roundTotal, shownMargin, sumShown } from '../../src/format/rounding';

/** Stored minutes keep three decimals, so parts are generated as thousandths. */
const thousandths = fc.integer({ min: 0, max: 120_000 });

/** Parts plus a stored total that differs from their sum by at most 0.002, as three-decimal storage allows. */
const stored = fc
  .tuple(fc.array(thousandths, { minLength: 1, maxLength: 6 }), fc.integer({ min: -2, max: 2 }))
  .map(([ks, drift]) => {
    const sum = ks.reduce((a, b) => a + b, 0);
    return { parts: ks.map((k) => k / 1000), total: Math.max(0, sum + drift) / 1000 };
  });

describe('roundParts properties', () => {
  it('shown parts always add up to the shown total', () => {
    fc.assert(
      fc.property(stored, ({ parts, total }) => {
        const r = roundParts(parts, total);
        expect(sumShown(r.shown)).toBe(r.shownTotal);
        expect(r.shownTotal).toBe(roundTotal(total));
      }),
    );
  });

  it('every shown part is a whole number within one minute of its stored value', () => {
    fc.assert(
      fc.property(stored, ({ parts, total }) => {
        const { shown } = roundParts(parts, total);
        shown.forEach((s, i) => {
          expect(Number.isInteger(s)).toBe(true);
          expect(Math.abs(s - parts[i]!)).toBeLessThan(1);
        });
      }),
    );
  });

  it('whole-number inputs come back unchanged', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 120 }), { minLength: 1, maxLength: 6 }), (parts) => {
        const total = parts.reduce((a, b) => a + b, 0);
        expect(roundParts(parts, total)).toEqual({ shown: parts, shownTotal: total });
      }),
    );
  });

  it('the same input always gives the same output', () => {
    fc.assert(
      fc.property(stored, ({ parts, total }) => {
        expect(roundParts(parts, total)).toEqual(roundParts([...parts], total));
      }),
    );
  });
});

describe('margin properties', () => {
  it('a stored margin of one minute or more never shows under one minute', () => {
    fc.assert(
      fc.property(thousandths, fc.integer({ min: 1000, max: 120_000 }), (b, gap) => {
        const slower = (b + gap) / 1000;
        const faster = b / 1000;
        expect(shownMargin(roundTotal(slower), roundTotal(faster))).toBeGreaterThanOrEqual(1);
      }),
    );
  });

  it('the shown margin is the difference of the two shown totals', () => {
    fc.assert(
      fc.property(thousandths, thousandths, (a, b) => {
        const ta = roundTotal(a / 1000);
        const tb = roundTotal(b / 1000);
        expect(shownMargin(ta, tb)).toBe(Math.max(ta, tb) - Math.min(ta, tb));
      }),
    );
  });
});
