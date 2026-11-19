import { describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import { readRepoJson, readRepoText } from '../support/files';

describe('scaffold', () => {
  it('runs vitest in the node environment', () => {
    expect(typeof document).toBe('undefined');
  });

  it('exports the lead pair from config', () => {
    expect(LEAD_PAIR.origin).not.toBe(LEAD_PAIR.dest);
  });

  it('sets the GitHub Pages base path to the repository name', () => {
    expect(readRepoText('web/vite.config.ts')).toContain("base: '/Ghost-Line/'");
  });

  it('keeps every npm script to one command, with no && or pipes', () => {
    const pkg = readRepoJson<{ scripts: Record<string, string> }>('web/package.json');
    for (const [name, command] of Object.entries(pkg.scripts)) {
      expect(command, name).not.toMatch(/&&|\|\||[|;]/);
    }
    expect(pkg.scripts).toMatchObject({ dev: 'vite', build: 'vite build', test: 'vitest run' });
  });

  it('ignores web/node_modules and web/dist but never .kiro or web/public/data', () => {
    const lines = readRepoText('.gitignore').split(/\r?\n/).map((l) => l.trim());
    expect(lines).toContain('web/node_modules/');
    expect(lines).toContain('web/dist/');
    for (const line of lines) {
      expect(line).not.toMatch(/^\/?\.kiro/);
      expect(line).not.toMatch(/public\/data|^\/?web\/public\/?$|^\/?web\/?$/);
    }
  });
});
