import { describe, expect, it } from 'vitest';
import { CAPTION_BOTH_ARRIVED, ORIENTATION_LINE, captionText } from '../../src/copy/copy';
import { captionFor } from '../../src/state/captions';

describe('captionFor', () => {
  it('names the orientation line before anything else', () => {
    const key = captionFor({ p1938: 'arrived', today: 'arrived', orientation: true });
    expect(captionText(key)).toBe(ORIENTATION_LINE);
  });

  it('says both arrived when both have', () => {
    expect(captionText(captionFor({ p1938: 'arrived', today: 'arrived', orientation: false }))).toBe(CAPTION_BOTH_ARRIVED);
  });

  it('puts "still" only on the side that has not arrived while the other has', () => {
    const key = captionFor({ p1938: 'arrived', today: 'riding', orientation: false });
    expect(key).toEqual({
      kind: 'clauses',
      p1938: { phase: 'arrived', still: false },
      today: { phase: 'riding', still: true },
    });
    const running = captionFor({ p1938: 'riding', today: 'waiting', orientation: false });
    expect(JSON.stringify(running)).not.toContain('"still":true');
  });

  it('gives the 1938 clause alone, never "still", when there is no bus side', () => {
    expect(captionFor({ p1938: 'riding', today: null, orientation: false })).toEqual({
      kind: 'clauses',
      p1938: { phase: 'riding', still: false },
      today: null,
    });
  });
});
