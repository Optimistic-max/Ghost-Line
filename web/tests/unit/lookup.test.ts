import { describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import { cornerName, hasPair, nextAfter, rowAt, sliderRange, sourcesOf, tripAt } from '../../src/data/lookup';
import { raceOf, realData } from '../support/realdata';

describe('rowAt', () => {
  it('finds every row of every real race file by its slider time', () => {
    for (const race of realData().races.values()) {
      for (const row of race.races) expect(rowAt(race, row.t)).toBe(row);
    }
  });

  it('gives undefined for a time with no row', () => {
    const race = raceOf(LEAD_PAIR);
    expect(rowAt(race, '00:00')).toBeUndefined();
    expect(rowAt(race, 'not a time')).toBeUndefined();
  });
});

describe('tripAt', () => {
  it('gives the trip each real row points at', () => {
    for (const race of realData().races.values()) {
      for (const row of race.races) {
        if (row.today) expect(tripAt(race, row.today.trip)?.i).toBe(row.today.trip);
      }
    }
  });

  it('gives undefined outside the list', () => {
    const race = raceOf(LEAD_PAIR);
    expect(tripAt(race, race.today.trips.length)).toBeUndefined();
  });
});

describe('nextAfter', () => {
  const list = ['a', 'b', 'c', 'd', 'e'];

  it('gives the current entry and the ones after it, by position', () => {
    expect(nextAfter(list, 'b', 3)).toEqual(['b', 'c', 'd']);
    expect(nextAfter(list, 'a', 1)).toEqual(['a']);
  });

  it('gives fewer at the end of the list', () => {
    expect(nextAfter(list, 'd', 4)).toEqual(['d', 'e']);
    expect(nextAfter(list, 'e', 4)).toEqual(['e']);
  });

  it('gives fewer when the list is shorter than the count', () => {
    expect(nextAfter(['x'], 'x', 3)).toEqual(['x']);
  });

  it('gives nothing when the current entry is not listed, or for a count of 0', () => {
    expect(nextAfter(list, 'z', 3)).toEqual([]);
    expect(nextAfter([], 'a', 3)).toEqual([]);
    expect(nextAfter(list, 'a', 0)).toEqual([]);
  });

  it('matches objects by identity', () => {
    const race = raceOf(LEAD_PAIR);
    const trips = race.today.trips;
    expect(nextAfter(trips, trips[0]!, 3)).toEqual(trips.slice(0, 3));
    expect(nextAfter(trips, { ...trips[0]! }, 3)).toEqual([]);
  });
});

describe('index and catalog lookups', () => {
  it('reads the slider range from the first and last rows', () => {
    const race = raceOf(LEAD_PAIR);
    expect(sliderRange(race)).toEqual({ first: race.races[0]!.t, last: race.races.at(-1)!.t });
  });

  it('knows the pairs and corner names of index.json', () => {
    const { index } = realData();
    for (const pair of index.pairs) expect(hasPair(index, pair)).toBe(true);
    expect(hasPair(index, { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.origin })).toBe(false);
    for (const corner of index.corners) expect(cornerName(index, corner.slug)).toBe(corner.name);
    expect(cornerName(index, 'nowhere')).toBeUndefined();
  });

  it('gives the catalog entries that cover a block, in order', () => {
    const { index, summary } = realData();
    const found = sourcesOf(index, summary.sources, 'races');
    expect(found.map((s) => s.id)).toEqual(summary.sources.races);
    for (const { id, entry } of found) expect(entry).toBe(index.sources[id]);
    expect(sourcesOf(index, summary.sources, 'no_such_block')).toEqual([]);
  });
});
