// Contract test (task 2.3, design 3.2): every field a pipeline schema requires is
// checked by the site's hand-written validators. A schema change that adds a
// required field fails here until shape.ts follows.
import { describe, expect, it } from 'vitest';
import { CHECKED_FIELDS } from '../../src/data/shape';
import { readRepoJson } from '../support/files';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Every `required` list in a schema, keyed by its path ('' is the top level). */
function requiredLists(node: Json, path = ''): Map<string, string[]> {
  const found = new Map<string, string[]>();
  if (node === null || typeof node !== 'object') return found;
  if (Array.isArray(node)) {
    node.forEach((child, k) => requiredLists(child, `${path}[${k}]`).forEach((v, p) => found.set(p, v)));
    return found;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key === 'required' && Array.isArray(child)) found.set(path, child as string[]);
    else requiredLists(child, path === '' ? key : `${path}.${key}`).forEach((v, p) => found.set(p, v));
  }
  return found;
}

const F = CHECKED_FIELDS;

/** Which validator field list answers each schema object. */
const MAPPING: Record<string, Record<string, readonly string[]>> = {
  index: {
    '': F.index,
    'properties.sources': F.indexSources,
    '$defs.Corner': F.corner,
    '$defs.Pair': F.pair,
    '$defs.SourceEntry': F.sourceEntry,
    '$defs.MethodEntry': F.methodEntry,
  },
  summary: {
    '': F.summary,
    'properties.sources': F.summarySources,
    '$defs.TodayWin': F.todayWin,
    '$defs.PairVerdict': F.pairVerdict,
  },
  race: {
    '': F.race,
    'properties.sources': F.raceSources,
    '$defs.Clock1938': F.clock1938,
    '$defs.Clock1938.properties.sources': F.clock1938Sources,
    '$defs.TodayTrips': F.todayTrips,
    '$defs.Trip': F.trip,
    '$defs.StopRef': F.stopRef,
    '$defs.RaceRow': F.raceRow,
    '$defs.Race1938Side': F.race1938Side,
    '$defs.RaceTodaySide': F.raceTodaySide,
  },
  route: {
    '': F.route,
    'properties.sources': F.routeSources,
    '$defs.RouteLegFeature': F.routeLeg,
    '$defs.LineStringGeometry': F.lineString,
    '$defs.LegProperties': F.legProperties,
  },
};

describe('shape validators cover the pipeline schemas', () => {
  for (const [name, mapping] of Object.entries(MAPPING)) {
    describe(`${name}.schema.json`, () => {
      const schema = readRepoJson<Json>(`pipeline/schemas/${name}.schema.json`);
      const lists = requiredLists(schema);

      it('has a required list for every object the site maps', () => {
        for (const path of Object.keys(mapping)) expect(lists.has(path), path).toBe(true);
      });

      for (const [path, required] of lists) {
        it(`checks every required field of ${path === '' ? 'the top level' : path}`, () => {
          const checked = mapping[path];
          expect(checked, `no validator mapped to schema path "${path}": update shape.ts and this mapping`).toBeDefined();
          const missing = required.filter((field) => !checked!.includes(field));
          expect(missing, `required by the schema but not checked by shape.ts`).toEqual([]);
        });
      }
    });
  }
});
