// Polish brief P4: link previews. index.html carries a description and og and twitter tags; the text is
// copy strings with no counts and no banned words, and the absolute addresses are the Pages address of
// the one repository link.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCE_URLS } from '../../src/config';
import { HEADLINE_LINE, SAME_RIDE, WORDMARK } from '../../src/copy/copy';
import { pagesUrl } from '../e2e/perf-config';
import { bannedTerms } from '../support/banned';
import { readRepoText } from '../support/files';

const html = readRepoText('web/index.html');
const doc = new DOMParser().parseFromString(html, 'text/html');
const meta = (attr: 'name' | 'property', key: string): string | null =>
  doc.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? null;
const site = pagesUrl(SOURCE_URLS.repository);

describe('link previews (polish brief P4)', () => {
  it('describes the page with the desktop headline line, and titles it with the wordmark and headline', () => {
    for (const d of [meta('name', 'description'), meta('property', 'og:description'), meta('name', 'twitter:description')]) {
      expect(d).toBe(HEADLINE_LINE);
    }
    expect(meta('property', 'og:site_name')).toBe(WORDMARK);
    for (const t of [meta('property', 'og:title'), meta('name', 'twitter:title')]) expect(t).toBe(`${WORDMARK}: ${SAME_RIDE}`);
  });

  it('points at the Pages address of the repository link and an og.png the build ships', () => {
    expect(meta('property', 'og:url')).toBe(site);
    expect(meta('property', 'og:image')).toBe(`${site}og.png`);
    expect(meta('name', 'twitter:image')).toBe(`${site}og.png`);
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(existsSync(resolve(import.meta.dirname, '..', '..', 'public', 'og.png'))).toBe(true);
  });

  it('is a 1200 x 630 PNG, as its tags say', () => {
    const png = readFileSync(resolve(import.meta.dirname, '..', '..', 'public', 'og.png'));
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    expect([meta('property', 'og:image:width'), meta('property', 'og:image:height')]).toEqual(['1200', '630']);
  });

  it('holds no count and no banned word', () => {
    const preview = 'meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]';
    const texts = [...doc.querySelectorAll(preview)].map((m) => m.getAttribute('content')!).filter((c) => !c.startsWith('http'));
    expect(texts.length).toBeGreaterThan(5);
    for (const t of texts) {
      expect(bannedTerms(t), t).toEqual([]);
      // The only digits are the year of the guide and the image size.
      expect(t.replace(/\b1938\b/g, '').replace(/^(1200|630)$/, ''), t).not.toMatch(/\d/);
    }
  });
});
