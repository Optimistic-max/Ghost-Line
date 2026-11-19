// Task 4.4 examples: rows 5 to 8 of race-brief 5.9, and the stricter cases.
import { describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import { decode, encode } from '../../src/format/share';
import { realData } from '../support/realdata';

const known = new Set(realData().index.corners.map((c) => c.slug));
const lead = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };

describe('decode: race-brief 5.9 rows 5 to 8', () => {
  it('row 5: a valid link selects that pair', () => {
    expect(decode('?from=preston-caroline&to=aliceanna-bond', known)).toEqual({
      pair: { origin: 'preston-caroline', dest: 'aliceanna-bond' },
      bad: false,
    });
  });

  it('row 6: origin equal to destination gives the lead pair, bad link', () => {
    expect(decode('?from=preston-caroline&to=preston-caroline', known)).toEqual({ pair: lead, bad: true });
  });

  it('row 7: an unknown corner gives the lead pair, bad link', () => {
    expect(decode('?from=nowhere&to=aliceanna-bond', known)).toEqual({ pair: lead, bad: true });
  });

  it('row 8: no query gives the lead pair, not a bad link', () => {
    expect(decode('', known)).toEqual({ pair: lead, bad: false });
    expect(decode('?', known)).toEqual({ pair: lead, bad: false });
  });
});

describe('decode: only from and to, once each', () => {
  it('accepts the two parameters in either order and percent-encoded slugs', () => {
    expect(decode('?to=aliceanna-bond&from=westwood-carey', known).pair).toEqual({
      origin: 'westwood-carey',
      dest: 'aliceanna-bond',
    });
    expect(decode('?from=westwood%2Dcarey&to=aliceanna-bond', known).bad).toBe(false);
  });

  it('rejects repeated, missing, extra or empty parameters', () => {
    for (const query of [
      '?from=westwood-carey&to=aliceanna-bond&from=dolphin-myrtle',
      '?from=westwood-carey',
      '?to=aliceanna-bond',
      '?from=westwood-carey&to=aliceanna-bond&t=10:00',
      '?from=&to=',
      '?from=Westwood-Carey&to=aliceanna-bond',
    ]) {
      expect(decode(query, known), query).toEqual({ pair: lead, bad: true });
    }
  });

  it('rejects input that is not a string', () => {
    for (const input of [undefined, null, 21, {}, ['?from=a&to=b']]) {
      expect(decode(input, known)).toEqual({ pair: lead, bad: true });
    }
  });
});

describe('encode', () => {
  it('writes the two slugs and nothing else', () => {
    expect(encode(lead)).toBe('?from=preston-caroline&to=aliceanna-bond');
  });
});
