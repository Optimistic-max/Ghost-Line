// Task 7.2: the static page shell in index.html.
import { describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import { HEADLINE_LINE, LOADING, SAME_RIDE, WORDMARK } from '../../src/copy/copy';
import { cornerName } from '../../src/data/lookup';
import { bannedTerms } from '../support/banned';
import { readRepoText } from '../support/files';
import { realData } from '../support/realdata';

const html = readRepoText('web/index.html');
const doc = new DOMParser().parseFromString(html, 'text/html');
const { index } = realData();
const text = (selector: string): string => (doc.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('index.html shell', () => {
  it('holds the lead pair names of index.json, so the loading state shows them', () => {
    expect(text('#origin-name')).toBe(cornerName(index, LEAD_PAIR.origin));
    expect(text('#dest-name')).toBe(cornerName(index, LEAD_PAIR.dest));
  });

  it('shows only "Ghost Line" in the top bar until index.json is read', () => {
    expect(text('#topbar')).toBe(WORDMARK);
    const label = doc.querySelector('#line-label');
    expect(label?.textContent).toBe('');
    expect(label?.hasAttribute('hidden')).toBe(true);
  });

  it('shows the loading line under the pair names', () => {
    expect(text('#loading-line')).toBe(LOADING);
  });

  it('has the two polite status regions', () => {
    for (const id of ['result-status', 'share-status']) {
      const region = doc.getElementById(id);
      expect(region?.getAttribute('role'), id).toBe('status');
      expect(region?.getAttribute('aria-live'), id).toBe('polite');
      expect(region?.textContent, id).toBe('');
    }
  });

  it('has the landmarks and the roots the screen mounts into', () => {
    expect(doc.querySelector('header#topbar')).not.toBeNull();
    expect(doc.querySelector('main#main')).not.toBeNull();
    expect(doc.querySelector('section#race-card')?.getAttribute('aria-labelledby')).toBe('pair-names');
    for (const id of ['map-area', 'card-scroll', 'card-buttons', 'card-footer', 'scrim', 'sheet-root', 'banner-root']) {
      expect(doc.getElementById(id), id).not.toBeNull();
    }
  });

  it('writes no wording of its own: every text is a copy string, a corner name or the arrow', () => {
    const allowed = new Set([WORDMARK, LOADING, SAME_RIDE, HEADLINE_LINE, '→', ...index.corners.map((c) => c.name)]);
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const found: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const t = (node.textContent ?? '').trim();
      if (t) found.push(t);
    }
    expect(found.filter((t) => !allowed.has(t))).toEqual([]);
    expect(doc.title).toBe(WORDMARK);
  });

  it('has no banned word', () => {
    expect(bannedTerms(html)).toEqual([]);
  });

  it('loads one stylesheet and one module script', () => {
    expect([...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href'))).toEqual(['/src/styles/index.css']);
    expect([...doc.querySelectorAll('script')].map((s) => s.getAttribute('src'))).toEqual(['/src/main.ts']);
  });
});
