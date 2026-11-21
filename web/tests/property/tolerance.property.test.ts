// Task 16.2, Property 12: the tolerance line shows the file's numbers.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { methodRideVerdicts } from '../../src/copy/copy';
import type { Summary } from '../../src/data/types';
import { verdictNumbers } from '../../src/state/specs';
import { fixtureData } from '../support/fixture';

const fixture = fixtureData().summary;

describe('Property 12: the tolerance line shows the file\'s numbers', () => {
  /**
   * **Validates: Requirements 13.2, 13.3**
   */
  it('puts summary.ride_same_rule, as plain text, in the method line of the three verdict counts', () => {
    const amount = fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true });
    fc.assert(
      fc.property(amount, amount, (minutes, pct) => {
        const summary: Summary = { ...fixture, ride_same_rule: { minutes, fraction_pct: pct } };
        const n = verdictNumbers(summary);
        const line = methodRideVerdicts(String(minutes), String(pct));
        expect(line).toContain(`within ${minutes} `);
        expect(line).toContain(`or ${pct}% of`);
        for (const count of [n.rideSame, n.pairs, n.rideFaster, n.rideSlower]) {
          expect(count.spec.method).toBe(line);
          expect(count.spec.method).not.toMatch(/<|button/);
        }
      }),
    );
  });
});
