// Checks on the source and on one in-memory build (nothing is written to dist/).
// Task 8.2: one font, Barlow Condensed 600 Latin, from the @fontsource package,
// with its licence; the built CSS names one WOFF2 and the page preloads it.
// Task 9.3: the dev-only vehicle sheet is not part of the build.
import { resolve } from 'node:path';
import { build } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';
import { listRepoFiles, readRepoJson, readRepoText, repoFileExists, repoPath } from '../support/files';

const PACKAGE = 'web/node_modules/@fontsource/barlow-condensed';
const ONLY_IMPORT = '@fontsource/barlow-condensed/latin-600.css';
const FONT_FILE = 'barlow-condensed-latin-600-normal.woff2';

type Asset = { fileName: string; source?: string | Uint8Array; code?: string };

let assets: Asset[] = [];

beforeAll(async () => {
  const out = await build({
    root: repoPath('web'),
    configFile: resolve(repoPath('web'), 'vite.config.ts'),
    logLevel: 'silent',
    build: { write: false },
  });
  const outputs = Array.isArray(out) ? out : [out];
  assets = outputs.flatMap((o) => ('output' in o ? (o.output as unknown as Asset[]) : []));
}, 120_000);

const text = (a: Asset): string =>
  typeof a.source === 'string' ? a.source : a.source ? new TextDecoder().decode(a.source) : (a.code ?? '');

const shipped = (): string[] => [...listRepoFiles('web/src'), 'web/index.html'];

describe('the font', () => {
  it('is imported once, as the latin-600 stylesheet of the package, and from nowhere else', () => {
    const imports = shipped().flatMap((f) => [...readRepoText(f).matchAll(/@fontsource\/[^'")\s]+/g)].map((m) => `${f}: ${m[0]}`));
    expect(imports.filter((i) => i.endsWith('.css'))).toEqual([`web/src/styles/index.css: ${ONLY_IMPORT}`]);
    for (const i of imports) expect(i, i).toMatch(/latin-600(-normal\.woff2|\.css)$/);
  });

  it('has no other font rule, font file or font host in src/ or index.html', () => {
    for (const file of shipped()) {
      const src = readRepoText(file);
      expect(src, file).not.toMatch(/@font-face/);
      expect(src, file).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
      expect(src.match(/[\w-]+\.(woff2?|ttf|otf)\b/g) ?? [], file).toEqual(file === 'web/index.html' ? [FONT_FILE] : []);
    }
    expect(repoFileExists('web/public/fonts')).toBe(false);
  });

  it('ships with its OFL licence in the package', () => {
    expect(readRepoText(`${PACKAGE}/LICENSE`)).toContain('SIL Open Font License, Version 1.1');
    expect(readRepoJson<{ license: string }>(`${PACKAGE}/package.json`).license).toBe('OFL-1.1');
  });

  it('is listed in the Source URLs of tech.md and credited in the copy table', () => {
    expect(readRepoText('.kiro/steering/tech.md')).toMatch(/- font: npm package @fontsource\/barlow-condensed, weight 600, Latin subset only\./);
    expect(readRepoText('.kiro/specs/race-screen/requirements.md')).toContain('"Font: Barlow Condensed, SIL Open Font Licence 1.1."');
  });

  it('builds to CSS that names one WOFF2, with font-display swap, and a page that preloads it first', () => {
    const css = assets.filter((a) => a.fileName.endsWith('.css'));
    expect(css).toHaveLength(1);
    const cssText = text(css[0]!);
    const woff2 = [...cssText.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => m[1]!);
    expect(woff2).toHaveLength(1);
    expect(woff2[0]).toMatch(/^\/Ghost-Line\/assets\/barlow-condensed-latin-600-normal-[\w-]+\.woff2$/);
    expect(cssText.match(/@font-face/g)).toHaveLength(1);
    expect(cssText).toMatch(/font-display:\s*swap/);
    expect(cssText).toMatch(/font-weight:\s*600/);

    const html = text(assets.find((a) => a.fileName === 'index.html')!);
    const preload = /<link\s+rel="preload"\s+href="([^"]+)"\s+as="font"\s+type="font\/woff2"\s+crossorigin\s*\/?>/.exec(html);
    expect(preload?.[1]).toBe(woff2[0]);
    expect(html.indexOf('rel="preload"')).toBeLessThan(html.indexOf('rel="stylesheet"'));
  });
});

describe('the dev-only vehicle sheet', () => {
  it('exists for the dev server', () => {
    expect(repoFileExists('web/dev/vehicles.html')).toBe(true);
  });

  it('is not part of the build', () => {
    expect(assets.length).toBeGreaterThan(0);
    expect(assets.filter((a) => a.fileName.endsWith('.html')).map((a) => a.fileName)).toEqual(['index.html']);
    for (const a of assets) expect(text(a), a.fileName).not.toMatch(/dev only|DETAIL_WIDTH/);
  });
});
