// Task 4.2 examples, with made-up gaps.
import { describe, expect, it } from 'vitest';
import { gapForm, gapPart, minuteWord, minutes, roundMinutes, spacing1938 } from '../../src/format/gaps';

describe('minute words', () => {
  it('uses the singular for 1 only', () => {
    expect(minutes(1)).toBe('1 minute');
    expect(minutes(0)).toBe('0 minutes');
    expect(minutes(2)).toBe('2 minutes');
    expect(minutes(11)).toBe('11 minutes');
    expect(minuteWord(1)).toBe('minute');
    expect(minuteWord(21)).toBe('minutes');
  });
});

describe('roundMinutes', () => {
  it('rounds halves up', () => {
    expect(roundMinutes(0.499)).toBe(0);
    expect(roundMinutes(0.5)).toBe(1);
    expect(roundMinutes(12.5)).toBe(13);
  });
});

describe('gapPart', () => {
  it('uses "up to" when the lower gap rounds to 0, checked first', () => {
    expect(gapForm(0.3, 9.2)).toEqual({ kind: 'up-to', max: 9 });
    expect(gapPart(0.3, 9.2)).toBe('up to 9 minutes apart');
    expect(gapPart(0.2, 0.4)).toBe('up to 0 minutes apart');
    expect(gapPart(0.4, 1.2)).toBe('up to 1 minute apart');
  });

  it('gives one number when the rounded gaps are equal', () => {
    expect(gapPart(12, 12.4)).toBe('12 minutes apart');
    expect(gapPart(0.5, 1.4)).toBe('1 minute apart');
  });

  it('gives a range otherwise, with the unit after the larger gap', () => {
    expect(gapPart(12, 17)).toBe('12 to 17 minutes apart');
    expect(gapPart(1, 2)).toBe('1 to 2 minutes apart');
  });
});

describe('spacing1938', () => {
  it('gives two numbers, or one when the rounded gaps are equal', () => {
    expect(spacing1938(5, 6)).toBe('every 5 or 6 minutes');
    expect(spacing1938(5, 5.2)).toBe('every 5 minutes');
    expect(spacing1938(0.6, 1.2)).toBe('every 1 minute');
  });
});
