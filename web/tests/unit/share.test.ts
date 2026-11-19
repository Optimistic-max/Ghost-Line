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

  it('rejects repeated, missing or empty pair parameters', () => {
    for (const query of [
      '?from=westwood-carey&to=aliceanna-bond&from=dolphin-myrtle',
      '?from=westwood-carey',
      '?to=aliceanna-bond',
      '?from=&to=',
      '?from=Westwood-Carey&to=aliceanna-bond',
    ]) {
      expect(decode(query, known), query).toEqual({ pair: lead, bad: true });
    }
  });
});

describe('decode: other parameters are ignored', () => {
  const pair = { origin: 'westwood-carey', dest: 'aliceanna-bond' };

  it('opens the right pair when a link carries an extra parameter', () => {
    for (const query of [
      '?from=westwood-carey&to=aliceanna-bond&fbclid=IwAR0abc',
      '?utm_source=social&from=westwood-carey&utm_medium=post&to=aliceanna-bond',
      '?from=westwood-carey&to=aliceanna-bond&t=10:00',
      '?from=westwood-carey&to=aliceanna-bond&from_x=1&=&&',
    ]) {
      expect(decode(query, known), query).toEqual({ pair, bad: false });
    }
  });

  it('still gives the bad-link state for a missing or invalid pair beside an extra parameter', () => {
    for (const query of [
      '?from=westwood-carey&fbclid=IwAR0abc',
      '?to=aliceanna-bond&utm_source=social',
      '?from=nowhere&to=aliceanna-bond&fbclid=IwAR0abc',
      '?from=westwood-carey&to=westwood-carey&utm_source=social',
      '?from=westwood-carey&to=aliceanna-bond&to=dolphin-myrtle&fbclid=IwAR0abc',
    ]) {
      expect(decode(query, known), query).toEqual({ pair: lead, bad: true });
    }
  });

  it('treats a link with only other parameters as no share link at all', () => {
    expect(decode('?fbclid=IwAR0abc', known)).toEqual({ pair: lead, bad: false });
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
