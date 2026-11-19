// Task 4.5: route names joined for the frequency sentence.
import { describe, expect, it } from 'vitest';
import { joinNames } from '../../src/format/list';
import { realData } from '../support/realdata';

describe('joinNames', () => {
  it('gives one name alone', () => {
    expect(joinNames(['Route One'])).toBe('Route One');
  });

  it('joins two with " and "', () => {
    expect(joinNames(['Route One', 'Route Two'])).toBe('Route One and Route Two');
  });

  it('joins more with commas and "and"', () => {
    expect(joinNames(['Route One', 'Route Two', 'Route Three'])).toBe('Route One, Route Two and Route Three');
  });

  it('gives an empty string for no names', () => {
    expect(joinNames([])).toBe('');
  });

  it('shows every real route name as given', () => {
    for (const race of realData().races.values()) {
      const joined = joinNames(race.today.route_names);
      for (const name of race.today.route_names) expect(joined).toContain(name);
    }
  });
});
