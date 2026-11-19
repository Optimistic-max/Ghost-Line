// The walk rows of the Sources sheet show the catalog method entry's `what` as
// written, and nothing else about the formula (R9.5). This confirms that text
// carries the walk formula of tech.md, and the photo-finish band of index.json.
import { describe, expect, it } from 'vitest';
import { readRepoText } from '../support/files';
import { realData } from '../support/realdata';

describe("the method entry's what", () => {
  const { index } = realData();
  const what = index.sources.method.what;

  it('contains the walk formula of tech.md', () => {
    const formula = /Walk minutes = (metres x [\d.]+ \/ [\d.]+ \/ 60)/.exec(readRepoText('.kiro/steering/tech.md'))?.[1];
    expect(formula, 'tech.md states the walk formula').toBeDefined();
    expect(what).toContain(`walk minutes = ${formula}`);
  });

  it('names the stop radius and the photo-finish band of the data', () => {
    expect(what).toContain(`photo finish under ${index.photo_finish_min.toFixed(1)} minute`);
    expect(what).toMatch(/\b\d+ m stop radius\b/);
  });
});
