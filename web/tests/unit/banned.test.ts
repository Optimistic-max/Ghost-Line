// Task 5.3: the banned-word helper on its own.
import { describe, expect, it } from 'vitest';
import { bannedTerms } from '../support/banned';

describe('bannedTerms', () => {
  it('finds each banned term as a whole word, in any case', () => {
    expect(bannedTerms('Buses live here')).toEqual(['live']);
    expect(bannedTerms('LIVE times')).toEqual(['LIVE']);
    expect(bannedTerms('a real-time feed')).toEqual(['real-time']);
    expect(bannedTerms('Realtime arrivals')).toEqual(['Realtime']);
    expect(bannedTerms('The bus is arriving now.')).toEqual(['arriving now']);
    expect(bannedTerms('Right now it is late.')).toEqual(['Right now']);
  });

  it('ignores words that only contain a banned term', () => {
    expect(bannedTerms('deliver')).toEqual([]);
    expect(bannedTerms('olive')).toEqual([]);
    expect(bannedTerms('lives')).toEqual([]);
    expect(bannedTerms('alive, delivered, liveried')).toEqual([]);
  });

  it('allows only the exact phrase "Scheduled, not live."', () => {
    expect(bannedTerms('Weekday schedule as of Nov 4, 2026. Scheduled, not live.')).toEqual([]);
    expect(bannedTerms('scheduled, not live')).toEqual(['live']);
    expect(bannedTerms('Scheduled, not live. But live!')).toEqual(['live']);
  });

  it('does not count the aria-live attribute name', () => {
    expect(bannedTerms('<div role="status" aria-live="polite"></div>')).toEqual([]);
    expect(bannedTerms('<div aria-live="polite">live</div>')).toEqual(['live']);
  });

  it('finds nothing in clean text', () => {
    expect(bannedTerms('Waiting 6 min · next car 10:06 (scheduled)')).toEqual([]);
  });
});
