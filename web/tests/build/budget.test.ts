// Task 21: the first-screen budget and the map chunk (R16.1, tech.md). The checks of
// scripts/check-size.ts (npm run check:size) run here on in-memory builds: the real
// one must pass; the build as it was before task 21 found a fault must fail the map
// checks; and the checks must fail for an over-budget total and for pages that reach
// the map or the outside, so a pass means something.
import { resolve } from 'node:path';
import { build } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';
import config from '../../vite.config';
import {
  BUDGET_BYTES,
  type Output,
  firstLoadFiles,
  mapChunks,
  mapProblems,
  measure,
  measureFirstLoad,
  report,
  sentBytes,
} from '../../scripts/check-size';
import { LEAD_PAIR } from '../../src/config';
import { raceFileName } from '../../src/data/files';
import { listRepoFiles, readRepoJson, readRepoText, repoPath } from '../support/files';

const BASE = '/Ghost-Line/';
const readData = (file: string): string => readRepoText(`web/public/data/${file}`);

/** The site built in memory; `groupDependencies` is the code-splitting option task 21 turned off. */
async function built(groupDependencies: boolean): Promise<Output> {
  const root = repoPath('web');
  const base = structuredClone(config) as unknown as {
    build: { rolldownOptions: { output: { codeSplitting: { groups: { includeDependenciesRecursively?: boolean }[] } } } };
  };
  const [group] = base.build.rolldownOptions.output.codeSplitting.groups;
  if (groupDependencies) delete group!.includeDependenciesRecursively;
  const out = await build({ ...(base as object), root, configFile: false, logLevel: 'silent', build: { ...(base.build as object), write: false } });
  const outputs = Array.isArray(out) ? out : [out];
  return outputs.flatMap((o) => ('output' in o ? (o.output as unknown as Output) : []));
}

let real: Output = [];
let before: Output = [];

beforeAll(async () => {
  real = await built(false);
  before = await built(true);
}, 120_000);

describe('the build as it is', () => {
  it('is split: MapLibre and the map module are in their own chunks, apart from the main script', () => {
    const maps = mapChunks(real).map((c) => c.fileName);
    expect(maps.length).toBeGreaterThan(0);
    const main = real.filter((o) => o.type === 'chunk' && o.isEntry);
    expect(main).toHaveLength(1);
    expect(maps).not.toContain(main[0]!.fileName);
  });

  it('keeps the map out of the first-load set, reaching it by one dynamic import and no static one (21.2)', () => {
    expect(mapProblems(real, BASE)).toEqual([]);
    const { files } = firstLoadFiles(real, BASE);
    for (const name of mapChunks(real).map((c) => c.fileName)) expect(files).not.toContain(name);
    expect(files.filter((f) => /maplibre/.test(f))).toEqual([]);
    // The built page asks for nothing of the map: no preload, no script.
    const html = (real.find((o) => o.fileName === 'index.html') as { source: string }).source;
    for (const name of mapChunks(real).map((c) => c.fileName)) expect(html).not.toContain(name);
  });

  it('holds the first-load set to the HTML, the main script, the stylesheet and the one WOFF2, and no source map', () => {
    const { files, problems } = firstLoadFiles(real, BASE);
    expect(problems).toEqual([]);
    // The bundler's file names end in an 8-character hash before the extension.
    const kinds = files.map((f) => f.replace(/^assets\//, '').replace(/-[\w-]{8}(\.\w+)$/, '$1')).sort();
    expect(kinds).toEqual(['barlow-condensed-latin-600-normal.woff2', 'index.css', 'index.html', 'index.js']);
    expect(files.filter((f) => f.endsWith('.map'))).toEqual([]);
  });

  it(`is under the budget of ${BUDGET_BYTES} bytes as served, with the lead pair's three data files counted`, () => {
    const { rows, problems } = measureFirstLoad(real, BASE, readData);
    expect(problems).toEqual([]);
    expect(rows.map((r) => r.file).filter((f) => f.startsWith('data/'))).toEqual([
      'data/index.json',
      'data/summary.json',
      `data/${raceFileName(LEAD_PAIR)}`,
    ]);
    const total = rows.reduce((sum, r) => sum + r.sent, 0);
    expect(total).toBeGreaterThan(20_000);
    expect(total).toBeLessThanOrEqual(BUDGET_BYTES);
    const { ok, lines } = report(rows, []);
    expect(ok).toBe(true);
    // Every file is printed with its size.
    for (const r of rows) expect(lines.join('\n')).toContain(r.file);
  });

  it('counts the data files from the files the page loads, which the build copies unchanged', () => {
    const copied = real.filter((o) => o.fileName.startsWith('data/'));
    // Static files in public/ are copied after the bundle, so they are not in the in-memory output.
    expect(copied).toEqual([]);
    for (const file of ['index.json', 'summary.json', raceFileName(LEAD_PAIR)]) {
      expect(() => JSON.parse(readData(file))).not.toThrow();
    }
  });
});

describe('the build before task 21 found the fault (a code-splitting group that also takes what its modules import)', () => {
  it('had the main script import the map chunk, and the page preload it', () => {
    const problems = mapProblems(before, BASE);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(/statically|first-load set|holds a map module/);
    const html = (before.find((o) => o.fileName === 'index.html') as { source: string }).source;
    expect(mapChunks(before).some((c) => html.includes(c.fileName))).toBe(true);
  });

  it('would have been over the budget with the map in the first load', () => {
    // Counting the map chunk too, as the page loaded it: over 100 KB by itself.
    const total = mapChunks(before).reduce((sum, c) => sum + sentBytes(c.fileName, new TextEncoder().encode(c.code)), 0);
    expect(total).toBeGreaterThan(BUDGET_BYTES);
  });
});

// ---- The checks on made-up outputs ------------------------------------------------------------

type Piece = { fileName: string; type: 'chunk' | 'asset'; [key: string]: unknown };

const chunk = (fileName: string, extra: Record<string, unknown> = {}): Piece => ({
  type: 'chunk',
  fileName,
  code: '',
  imports: [],
  dynamicImports: [],
  moduleIds: [],
  isEntry: false,
  ...extra,
});
const asset = (fileName: string, source: string): Piece => ({ type: 'asset', fileName, source });
const out = (...pieces: Piece[]): Output => pieces as unknown as Output;

const PAGE = (extra = ''): string =>
  `<html><head><link rel="stylesheet" href="${BASE}assets/a.css">${extra}</head><body><script type="module" src="${BASE}assets/main.js"></script></body></html>`;
const MAP_MODULE_ID = 'C:/site/web/src/map/map.ts';

describe('the checks fail when they should', () => {
  const sound = (): Piece[] => [
    asset('index.html', PAGE()),
    asset('assets/a.css', '@font-face{src:url(/Ghost-Line/assets/f.woff2) format("woff2"),url(/Ghost-Line/assets/f.woff) format("woff")}'),
    asset('assets/f.woff2', 'font'),
    asset('assets/f.woff', 'font'),
    chunk('assets/main.js', { isEntry: true, dynamicImports: ['assets/map.js'], moduleIds: ['C:/site/web/src/main.ts'] }),
    chunk('assets/map.js', { moduleIds: [MAP_MODULE_ID, 'C:/site/web/node_modules/maplibre-gl/dist/x.js'] }),
  ];

  it('passes a sound page, and counts the WOFF2 but not the WOFF beside it', () => {
    expect(mapProblems(out(...sound()), BASE)).toEqual([]);
    const { files, problems } = firstLoadFiles(out(...sound()), BASE);
    expect(problems).toEqual([]);
    expect(files.sort()).toEqual(['assets/a.css', 'assets/f.woff2', 'assets/main.js', 'index.html']);
  });

  it('fails a map chunk the main script imports statically', () => {
    const pieces = sound().map((p) => (p.fileName === 'assets/main.js' ? { ...p, imports: ['assets/map.js'] } : p));
    expect(mapProblems(out(...pieces), BASE).join('\n')).toMatch(/first-load set|statically/);
  });

  it('fails a map chunk the page preloads or loads as a script', () => {
    const pieces = sound().map((p) => (p.fileName === 'index.html' ? asset('index.html', PAGE(`<link rel="modulepreload" href="${BASE}assets/map.js">`)) : p));
    expect(mapProblems(out(...pieces), BASE).join('\n')).toMatch(/first-load set/);
  });

  it('fails map modules inside a first-load chunk, and a build with no map chunk at all', () => {
    const inMain = sound().map((p) => (p.fileName === 'assets/main.js' ? { ...p, moduleIds: [MAP_MODULE_ID] } : p));
    expect(mapProblems(out(...inMain), BASE).join('\n')).toMatch(/holds a map module/);
    const none = sound().filter((p) => p.fileName !== 'assets/map.js').map((p) => (p.fileName === 'assets/main.js' ? { ...p, dynamicImports: [] } : p));
    expect(mapProblems(out(...none), BASE).join('\n')).toMatch(/no chunk holds the map/);
  });

  it('fails when the map is reached by no dynamic import, or by two', () => {
    const zero = sound().map((p) => (p.fileName === 'assets/main.js' ? { ...p, dynamicImports: [] } : p));
    expect(mapProblems(out(...zero), BASE).join('\n')).toMatch(/0 dynamic imports/);
    const two = [...sound().map((p) => (p.fileName === 'assets/main.js' ? { ...p, dynamicImports: ['assets/map.js', 'assets/map.js'] } : p))];
    expect(mapProblems(out(...two), BASE).join('\n')).toMatch(/2 dynamic imports|dynamic imports/);
  });

  it('fails a first-load script that names MapLibre\'s worker', () => {
    const pieces = [
      ...sound().map((p) => (p.fileName === 'assets/main.js' ? { ...p, code: 'new Worker("assets/maplibre-gl-worker-AB12.mjs")' } : p)),
      asset('assets/maplibre-gl-worker-AB12.mjs', 'worker'),
    ];
    expect(mapProblems(out(...pieces), BASE).join('\n')).toMatch(/worker/);
  });

  it('flags a page that reaches outside the site, and a file it names that the build lacks', () => {
    const outside = sound().map((p) => (p.fileName === 'index.html' ? asset('index.html', PAGE('<script src="https://cdn.example/x.js"></script>')) : p));
    expect(firstLoadFiles(out(...outside), BASE).problems.join('\n')).toMatch(/outside the site/);
    const missing = sound().filter((p) => p.fileName !== 'assets/f.woff2');
    expect(measureFirstLoad(out(...missing), BASE, readData).problems.join('\n')).toMatch(/not in the build/);
  });

  it('counts an inline data: icon as part of the page, fetching nothing, and still flags an outside icon (task 25.10)', () => {
    const inline = sound().map((p) => (p.fileName === 'index.html' ? asset('index.html', PAGE('<link rel="icon" href="data:," />')) : p));
    const found = firstLoadFiles(out(...inline), BASE);
    expect(found.problems).toEqual([]);
    expect(found.files.some((f) => f.startsWith('data:'))).toBe(false);
    const outside = sound().map((p) => (p.fileName === 'index.html' ? asset('index.html', PAGE('<link rel="icon" href="https://cdn.example/i.png" />')) : p));
    expect(firstLoadFiles(out(...outside), BASE).problems.join('\n')).toMatch(/outside the site/);
  });

  it('fails the report over the budget, names the excess, and passes at the budget exactly', () => {
    const rows = [{ file: 'a.js', bytes: 500_000, sent: BUDGET_BYTES + 1 }];
    const over = report(rows, []);
    expect(over.ok).toBe(false);
    expect(over.lines.join('\n')).toMatch(/over by 0\.0 KB|over by/);
    expect(report([{ file: 'a.js', bytes: 1, sent: BUDGET_BYTES }], []).ok).toBe(true);
    // A problem alone fails it.
    expect(report([{ file: 'a.js', bytes: 1, sent: 1 }], ['the map is in the first load']).ok).toBe(false);
  });

  it('counts a WOFF2 as it is and text as gzip, and the measure keeps the raw size', () => {
    const bytes = new TextEncoder().encode('x'.repeat(10_000));
    expect(sentBytes('f.woff2', bytes)).toBe(10_000);
    expect(sentBytes('a.js', bytes)).toBeLessThan(200);
    expect(measure('a.js', 'x'.repeat(10_000))).toMatchObject({ bytes: 10_000 });
  });
});

describe('the source reaches the map in one place (21.2)', () => {
  const files = listRepoFiles('web/src').filter((f) => f.endsWith('.ts'));
  /** The lines of each file that import something, with their file. Type-only imports are erased by the build. */
  const imports = files.flatMap((f) =>
    [...readRepoText(f).matchAll(/^\s*import\s+(type\s+)?[^;]*?from\s+['"]([^'"]+)['"]/gms)].map((m) => ({ file: f, type: m[1] !== undefined, from: m[2]! })),
  );
  const dynamic = files.flatMap((f) => [...readRepoText(f).matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => ({ file: f, from: m[1]! })));

  it('has `import(\'../map/map\')` as the only value reference to the map module', () => {
    const toMap = (from: string): boolean => /(^|\/)map\/map$/.test(from);
    expect(imports.filter((i) => toMap(i.from) && !i.type)).toEqual([]);
    expect(dynamic.filter((d) => toMap(d.from))).toEqual([{ file: 'web/src/view/app.ts', from: '../map/map' }]);
  });

  it('imports MapLibre as a value from the map module only', () => {
    const value = imports.filter((i) => /^maplibre-gl(\/|$)/.test(i.from) && !i.type);
    expect([...new Set(value.map((i) => i.file))]).toEqual(['web/src/map/map.ts']);
    expect(dynamic.filter((d) => /maplibre/.test(d.from))).toEqual([]);
  });

  it('keeps the modules the map and the first screen share out of the map\'s chunk group', () => {
    // The fault of the first build: the group took the map module's dependencies along with it.
    expect(config.build?.rolldownOptions?.output).toBeDefined();
    const groups = (config.build!.rolldownOptions!.output as { codeSplitting: { groups: { name: string; includeDependenciesRecursively?: boolean }[] } })
      .codeSplitting.groups;
    expect(groups.map((g) => g.name)).toEqual(['map']);
    expect(groups[0]!.includeDependenciesRecursively).toBe(false);
  });
});

describe('the script and its command', () => {
  it('is one npm script of one command, with no && or pipe, and runs the file that does the build', () => {
    const { scripts } = readRepoJson<{ scripts: Record<string, string> }>('web/package.json');
    expect(scripts['check:size']).toBe('node scripts/check-size.ts');
    expect(scripts['check:size']).not.toMatch(/&&|\|\||[|;]/);
    expect(readRepoText('web/scripts/check-size.ts')).toMatch(/await build\(/);
  });

  it('takes its budget from tech.md\'s 100 KB, and the lead pair from config', () => {
    expect(readRepoText('.kiro/steering/tech.md')).toContain('First-screen budget: 100 KB compressed, map excluded.');
    expect(BUDGET_BYTES).toBe(100_000);
    expect(resolve(repoPath('web'), 'scripts', 'check-size.ts')).toContain('check-size.ts');
  });
});
