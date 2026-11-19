// Task 4.4 property P1: round trip for every pair; decode never throws; the URL
// never holds a time or a number.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import { hasPair } from '../../src/data/lookup';
import { decode, encode } from '../../src/format/share';
import { realData } from '../support/realdata';

const { index } = realData();
const known = new Set(index.corners.map((c) => c.slug));

/** decode's result is either the lead pair or a pair of two different known corners. */
function wellFormed(query: unknown): void {
  const { pair, bad } = decode(query, known);
  expect(known.has(pair.origin) && known.has(pair.dest)).toBe(true);
  expect(pair.origin).not.toBe(pair.dest);
  if (bad) expect(pair).toEqual({ origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest });
}

describe('share link (P1)', () => {
  it('decode(encode(p)) is p for every pair in index.json', () => {
    for (const pair of index.pairs) {
      expect(decode(encode(pair), known)).toEqual({ pair, bad: false });
    }
  });

  it('never puts a time or a number in the URL', () => {
    for (const pair of index.pairs) {
      const query = encode(pair);
      expect(query).not.toMatch(/\d|:/);
      expect([...new URLSearchParams(query).keys()]).toEqual(['from', 'to']);
    }
  });

  it('never throws on any string', () => {
    fc.assert(fc.property(fc.string({ unit: 'binary' }), (s) => wellFormed(s)));
    fc.assert(fc.property(fc.webQueryParameters(), (s) => wellFormed(`?${s}`)));
  });

  it('never throws on odd percent-encodings', () => {
    const piece = fc.constantFrom('%', '%2', '%2D', '%E0%A4%A', '%FF', '%00', '=', '&', '+', 'from', 'to', '-', 'a');
    fc.assert(fc.property(fc.array(piece, { maxLength: 12 }), (pieces) => wellFormed(`?${pieces.join('')}`)));
  });

  it('treats repeated parameters as a bad link', () => {
    const slug = fc.constantFrom(...known);
    const param = fc.tuple(fc.constantFrom('from', 'to'), slug).map(([k, v]) => `${k}=${v}`);
    fc.assert(
      fc.property(fc.array(param, { minLength: 3, maxLength: 6 }), (params) => {
        expect(decode(`?${params.join('&')}`, known).bad).toBe(true);
      }),
    );
  });

  it('never throws on any value at all', () => {
    fc.assert(fc.property(fc.anything(), (v) => wellFormed(v)));
  });

  it('only ever selects a pair that index.json lists', () => {
    fc.assert(
      fc.property(fc.constantFrom(...known), fc.constantFrom(...known), (a, b) => {
        const { pair } = decode(`?from=${a}&to=${b}`, known);
        expect(hasPair(index, pair)).toBe(true);
      }),
    );
  });
});
