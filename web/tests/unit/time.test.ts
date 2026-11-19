// Task 4.3 examples: rows 1 to 4 of race-brief 5.9, labels and dates.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clockLabel,
  clockOf,
  defaultMinute,
  defaultStart,
  dropSeconds,
  label12,
  minuteAfter,
  minutesOf,
  serviceDateLabel,
  shortClock,
} from '../../src/format/time';

/** A Date for a New York wall time on Wednesday 2026-11-04 (Eastern Standard Time, UTC-5). */
const newYork = (hhmmss: string): Date => new Date(`2026-11-04T${hhmmss}-05:00`);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('defaultMinute: race-brief 5.9 rows 1 to 4', () => {
  const [first, last] = ['09:00', '13:52'];
  const rows: [now: string, expected: string][] = [
    ['08:59:00', '10:00'],
    ['09:00:30', '09:00'],
    ['13:52:59', '13:52'],
    ['13:53:00', '10:00'],
  ];
  for (const [now, expected] of rows) {
    it(`now = ${now} gives ${expected}`, () => {
      expect(defaultMinute(newYork(now), first, last)).toBe(minutesOf(expected));
    });
  }

  it('says whether the time came from the clock', () => {
    expect(defaultStart(newYork('11:15:00'), first, last)).toEqual({ minute: minutesOf('11:15'), fromClock: true });
    expect(defaultStart(newYork('20:00:00'), first, last).fromClock).toBe(false);
    expect(defaultStart(new Date(Number.NaN), first, last)).toEqual({ minute: minutesOf('10:00'), fromClock: false });
  });

  it('never reads the device time zone', () => {
    for (const method of ['getHours', 'getMinutes', 'getTimezoneOffset', 'getDate', 'getDay'] as const) {
      vi.spyOn(Date.prototype, method).mockImplementation(() => {
        throw new Error(`device clock read: ${method}`);
      });
    }
    expect(defaultMinute(newYork('09:30:00'), first, last)).toBe(minutesOf('09:30'));
  });

  it('keeps the result inside a range that does not contain the fallback', () => {
    expect(defaultStart(newYork('08:00:00'), '11:00', '12:00')).toEqual({ minute: minutesOf('11:00'), fromClock: false });
  });
});

describe('clock strings', () => {
  it('converts between hh:mm and minutes after midnight, hours past 24 included', () => {
    expect(minutesOf('00:00')).toBe(0);
    expect(minutesOf('25:10')).toBe(1510);
    expect(clockOf(1510)).toBe('25:10');
    expect(minuteAfter('09:59')).toBe('10:00');
    expect(() => minutesOf('9:00')).toThrow();
    expect(() => minutesOf('09:60')).toThrow();
    expect(() => clockOf(1.5)).toThrow();
  });

  it('drops seconds without rounding', () => {
    expect(dropSeconds('10:32:59')).toBe('10:32');
    expect(() => dropSeconds('10:32')).toThrow();
  });

  it('prints clock times without a leading zero', () => {
    expect(shortClock('09:21')).toBe('9:21');
    expect(shortClock('13:52')).toBe('13:52');
  });

  it('gives 12-hour labels', () => {
    expect(label12('10:00')).toBe('10:00 AM');
    expect(label12('09:00')).toBe('9:00 AM');
    expect(label12('12:00')).toBe('12:00 PM');
    expect(label12('13:52')).toBe('1:52 PM');
    expect(label12('14:00')).toBe('2:00 PM');
    expect(label12('00:05')).toBe('12:05 AM');
  });

  it('gives the race clock readout in whole minutes', () => {
    expect(clockLabel('10:00', 8.99)).toBe('10:08');
    expect(clockLabel('09:21', 0)).toBe('9:21');
    expect(clockLabel('10:00', -1)).toBe('10:00');
  });
});

describe('serviceDateLabel', () => {
  it('formats an ISO date without shifting a day', () => {
    expect(serviceDateLabel('2026-11-04')).toBe('Nov 4, 2026');
    expect(serviceDateLabel('2026-01-01')).toBe('Jan 1, 2026');
    expect(serviceDateLabel('2026-12-31')).toBe('Dec 31, 2026');
    expect(() => serviceDateLabel('Nov 4')).toThrow();
  });
});
