import { describe, expect, it } from 'vitest';
import { SOURCE_URLS } from '../../src/config';
import { listRepoFiles, readRepoText } from '../support/files';

/** The "- name: value" entries of the "## Source URLs" section of tech.md. */
function techSourceUrls(): Map<string, string> {
  const text = readRepoText('.kiro/steering/tech.md');
  const start = text.indexOf('## Source URLs');
  expect(start, 'tech.md has a Source URLs section').toBeGreaterThanOrEqual(0);
  const rest = text.slice(start + 1);
  const end = rest.indexOf('\n## ');
  const section = end === -1 ? rest : rest.slice(0, end);
  const entries = new Map<string, string>();
  for (const line of section.split(/\r?\n/)) {
    const m = /^- ([^:]+): (.+)$/.exec(line.trim());
    if (m) entries.set(m[1]!.trim(), m[2]!.trim());
  }
  return entries;
}

const URL_RE = /https?:\/\/[^\s'"`)<>]+/g;

describe('config Source URLs come from tech.md', () => {
  const entries = techSourceUrls();
  const listed = new Set(entries.values());

  it('reads the entries the site needs', () => {
    for (const name of ['repository', 'base map style', 'base map credit text']) {
      expect(entries.has(name), name).toBe(true);
    }
  });

  it('holds exactly the listed repository link, style URL and credit text', () => {
    expect(SOURCE_URLS.repository).toBe(entries.get('repository'));
    expect(SOURCE_URLS.baseMapStyle).toBe(entries.get('base map style'));
    expect(SOURCE_URLS.baseMapCredit).toBe(entries.get('base map credit text'));
  });

  it('has no URL or credit text in config.ts that is not in the list', () => {
    for (const value of Object.values(SOURCE_URLS)) {
      expect(listed.has(value), value).toBe(true);
    }
    const urls = readRepoText('web/src/config.ts').match(URL_RE) ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(listed.has(url), url).toBe(true);
  });

  it('has no URL anywhere in src/ that is not in the list', () => {
    for (const file of listRepoFiles('web/src')) {
      for (const url of readRepoText(file).match(URL_RE) ?? []) {
        expect(listed.has(url), `${file}: ${url}`).toBe(true);
      }
    }
  });
});
