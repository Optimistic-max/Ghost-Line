// The route number and year from index.json (R2.2, R12.3), with made-up lines.
import { describe, expect, it } from 'vitest';
import { routeNumberOf, yearOf } from '../../src/format/line';
import { readFixture } from '../support/fixture';

describe('routeNumberOf', () => {
  it('takes the digits after "no" and before the hyphen', () => {
    expect(routeNumberOf('no7-1950')).toBe('7');
    expect(routeNumberOf('no123-2000')).toBe('123');
  });

  it('gives null for any other form, so the label is left out', () => {
    for (const line of ['fake', 'no-1938', 'NO7-1950', 'no7', 'route7-1950', '']) {
      expect(routeNumberOf(line), line).toBeNull();
    }
    expect(routeNumberOf(readFixture<{ line: string }>('index.json').line)).toBeNull();
  });
});

describe('yearOf', () => {
  it('takes the year of an ISO date', () => {
    expect(yearOf('1950-01-02')).toBe('1950');
    expect(yearOf('January 1950')).toBeNull();
  });
});
