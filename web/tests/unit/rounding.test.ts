// Task 4.1 examples: the six rows of screen-brief 2.10, and the edge rules.
import { describe, expect, it } from 'vitest';
import {
  RoundingError,
  isPlainRounding,
  roundParts,
  roundTotal,
  shownMargin,
  storedText,
  sumShown,
} from '../../src/format/rounding';

describe('roundParts: the six rows of screen-brief 2.10', () => {
  const rows: [parts: number[], total: number, shown: number[], shownTotal: number][] = [
    [[2.258, 30.458, 8.283, 4.156], 45.155, [2, 31, 8, 4], 45],
    [[1.93, 0.07, 19.717, 2.258], 23.975, [2, 0, 20, 2], 24],
    [[2.258, 0.458, 8.283, 4.156], 15.155, [2, 1, 8, 4], 15],
    [[2.258, 33.459, 8.283, 4.156], 48.156, [2, 34, 8, 4], 48],
    [[4.204, 20.796, 16.0, 4.156], 45.156, [4, 21, 16, 4], 45],
    [[6, 9], 15, [6, 9], 15],
  ];
  for (const [parts, total, shown, shownTotal] of rows) {
    it(`${parts.join(', ')} with total ${total} shows ${shown.join(', ')} = ${shownTotal}`, () => {
      expect(roundParts(parts, total)).toEqual({ shown, shownTotal });
    });
  }
});

describe('roundParts edge rules', () => {
  it('gives a tie to the earlier phase', () => {
    expect(roundParts([1.5, 1.5], 3)).toEqual({ shown: [2, 1], shownTotal: 3 });
    expect(roundParts([0.25, 0.25, 0.25, 0.25], 1)).toEqual({ shown: [1, 0, 0, 0], shownTotal: 1 });
  });

  it('rounds a half-minute total up', () => {
    expect(roundTotal(14.5)).toBe(15);
    expect(roundTotal(14.499)).toBe(14);
    expect(roundParts([0.5], 0.5)).toEqual({ shown: [1], shownTotal: 1 });
  });

  it('throws RoundingError when the parts cannot add up to the shown total', () => {
    expect(() => roundParts([10], 20)).toThrow(RoundingError);
    expect(() => roundParts([10, 10], 5)).toThrow(RoundingError);
  });

  it('throws RoundingError on a negative or non-finite value', () => {
    expect(() => roundParts([-1, 2], 1)).toThrow(RoundingError);
    expect(() => roundParts([Number.NaN], 1)).toThrow(RoundingError);
    expect(() => roundParts([1], Number.POSITIVE_INFINITY)).toThrow(RoundingError);
  });
});

describe('margin, sums and the exact-value rule', () => {
  it('takes the shown margin as the difference of the shown totals', () => {
    expect(shownMargin(45, 15)).toBe(30);
    expect(shownMargin(24, 28)).toBe(4);
  });

  it('sums shown parts', () => {
    expect(sumShown([2, 4])).toBe(6);
    expect(sumShown([])).toBe(0);
  });

  it('shows a stored value with three decimals for the exact-value line', () => {
    expect(storedText(30.458)).toBe('30.458');
    expect(storedText(2.25)).toBe('2.250');
    expect(storedText(6)).toBe('6.000');
    expect(storedText(0.0005)).toBe('0.001');
  });

  it('flags a part that is not the plain rounding of its stored value', () => {
    const { shown } = roundParts([2.258, 30.458, 8.283, 4.156], 45.155);
    expect(isPlainRounding(shown[1]!, 30.458)).toBe(false);
    expect(isPlainRounding(shown[2]!, 8.283)).toBe(true);
  });
});
