// The first-screen budget and the map chunk (task 21, R16.1, tech.md).
//
//   npm run check:size   builds the site, then adds up what the page downloads before the first
//                        race can start, as it is served (gzip), prints each file, and fails
//                        when the total is over the budget or the map is part of that set.
//
// The first-load set is everything the page needs for the first race, with the map left out:
// the HTML; the scripts, stylesheets and fonts it names, and every script they import
// statically; the font files its stylesheet asks for (the one WOFF2: a browser takes the first
// format it supports and never fetches the WOFF beside it); and the three data files the
// first race loads, for the lead pair (index.json, summary.json and its race file). The map
// chunk, MapLibre's worker and route.geojson load after the race card is on screen.
//
// Run by node directly (types are stripped), so imports carry their extensions. Its checks are
// exported for tests/build/budget.test.ts, which runs them on an in-memory build and on
// broken ones; the build and the report run only when this file is the entry.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { type Rollup, build, resolveConfig } from 'vite';
import { LEAD_PAIR } from '../src/config.ts';
import { INDEX_FILE, SUMMARY_FILE, raceFileName } from '../src/data/files.ts';

/** 100 KB, counted as 100,000 bytes: the stricter of the two readings. */
export const BUDGET_BYTES = 100_000;

export type Output = (Rollup.OutputChunk | Rollup.OutputAsset)[];

const isChunk = (o: Output[number]): o is Rollup.OutputChunk => o.type === 'chunk';
const text = (o: Rollup.OutputAsset): string => (typeof o.source === 'string' ? o.source : new TextDecoder().decode(o.source));

/** What marks a module as part of the map: MapLibre, and the two modules written only for it. */
const MAP_MODULE = /node_modules[\\/]maplibre-gl[\\/]|[\\/]src[\\/]map[\\/](map|style)\.ts$/;

/** The chunks that hold map modules. */
export function mapChunks(output: Output): Rollup.OutputChunk[] {
  return output.filter(isChunk).filter((c) => c.moduleIds.some((id) => MAP_MODULE.test(id)));
}

/** The tags of an HTML page that fetch something, with their attributes. */
function fetchTags(html: string): { tag: string; attrs: Record<string, string> }[] {
  const tags: { tag: string; attrs: Record<string, string> }[] = [];
  for (const m of html.matchAll(/<(script|link)\b([^>]*)>/g)) {
    const attrs: Record<string, string> = {};
    for (const a of m[2]!.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]!] = a[2]!;
    tags.push({ tag: m[1]!, attrs });
  }
  return tags;
}

/** A file's name in the output folder from an address in the page, or null for one outside the site. */
function fileOf(address: string, base: string): string | null {
  const path = new URL(address, 'http://page.test/').pathname;
  return path.startsWith(base) ? decodeURIComponent(path.slice(base.length)) : null;
}

/** The chunk files a chunk needs before it can run: itself and its static imports, all the way down. */
function staticClosure(start: Rollup.OutputChunk[], output: Output): Set<string> {
  const byName = new Map(output.filter(isChunk).map((c) => [c.fileName, c]));
  const seen = new Set<string>();
  const queue = [...start];
  for (let c = queue.pop(); c; c = queue.pop()) {
    if (seen.has(c.fileName)) continue;
    seen.add(c.fileName);
    for (const name of c.imports) {
      const next = byName.get(name);
      if (next) queue.push(next);
    }
  }
  return seen;
}

/**
 * The files of the output folder the page loads before the first race, without the data
 * files (those are named by the lead pair, not by the build).
 */
export function firstLoadFiles(output: Output, base: string): { files: string[]; problems: string[] } {
  const problems: string[] = [];
  const page = output.find((o) => o.fileName === 'index.html');
  if (!page || page.type !== 'asset') return { files: [], problems: ['the build has no index.html'] };
  const html = text(page);
  const files = new Set<string>(['index.html']);
  const chunks = new Map(output.filter(isChunk).map((c) => [c.fileName, c]));
  const scripts: Rollup.OutputChunk[] = [];
  for (const { tag, attrs } of fetchTags(html)) {
    const address = tag === 'script' ? attrs['src'] : attrs['href'];
    if (!address) continue;
    const file = fileOf(address, base);
    if (file === null) {
      problems.push(`the page reaches outside the site: ${address}`);
      continue;
    }
    files.add(file);
    const chunk = chunks.get(file);
    if (chunk) scripts.push(chunk);
  }
  for (const name of staticClosure(scripts, output)) files.add(name);
  // The stylesheet asks for fonts: the WOFF2 is the one fetched.
  for (const file of [...files].filter((f) => f.endsWith('.css'))) {
    const css = output.find((o) => o.fileName === file);
    if (!css || css.type !== 'asset') continue;
    for (const m of text(css).matchAll(/url\(([^)]+\.woff2)\)/g)) {
      const font = fileOf(m[1]!.replace(/["']/g, ''), base);
      if (font === null) problems.push(`the stylesheet reaches outside the site: ${m[1]}`);
      else files.add(font);
    }
  }
  return { files: [...files], problems };
}

/**
 * What would make the map part of the first screen (21.2): a map chunk in the first-load set,
 * a static import of one from the page's scripts, MapLibre's worker named by them, or the map
 * not reached by exactly one dynamic import.
 */
export function mapProblems(output: Output, base: string): string[] {
  const problems: string[] = [];
  const maps = mapChunks(output);
  if (maps.length === 0) return ['no chunk holds the map: the map is not split out, or the build changed shape'];
  const { files } = firstLoadFiles(output, base);
  const mapNames = new Set(maps.map((c) => c.fileName));
  for (const name of files) if (mapNames.has(name)) problems.push(`${name} (the map) is in the first-load set`);
  const first = output.filter(isChunk).filter((c) => files.includes(c.fileName));
  for (const c of first) {
    for (const id of c.moduleIds) if (MAP_MODULE.test(id)) problems.push(`${c.fileName} holds a map module: ${id}`);
  }
  // The only way in to the map from what loads first is one dynamic import(): the bundler's own
  // record of the chunks each chunk imports, statically and dynamically. (Vite also lists a dynamic
  // import's dependencies in the importing script, to preload them when it runs; those are not loaded
  // until then, so the code text is not searched for chunk names.)
  const dynamic = first.flatMap((c) => c.dynamicImports.filter((name) => mapNames.has(name)).map((name) => `${c.fileName} -> ${name}`));
  if (dynamic.length !== 1) {
    problems.push(`the first-load scripts reach the map by ${dynamic.length} dynamic imports (${dynamic.join('; ') || 'none'}), not one`);
  }
  for (const c of first) {
    for (const name of c.imports.filter((n) => mapNames.has(n))) problems.push(`${c.fileName} imports ${name} statically`);
  }
  // MapLibre's worker file loads with the map, by the map chunk's own address of it.
  const workers = output.filter((o) => /maplibre-gl-worker/.test(o.fileName)).map((o) => o.fileName.split('/').pop()!);
  for (const c of first) for (const w of workers) if (c.code.includes(w)) problems.push(`${c.fileName} names MapLibre's worker ${w}`);
  return problems;
}

export type Measured = { file: string; bytes: number; sent: number };

/**
 * A file as served. Text is gzipped (GitHub Pages compresses it); a WOFF2 is already compressed and
 * is counted as it is. Level 9, so the figure is about the most a server would send for the text.
 */
export function sentBytes(file: string, data: Uint8Array): number {
  return file.endsWith('.woff2') ? data.length : gzipSync(data, { level: 9 }).length;
}

export function measure(file: string, data: string | Uint8Array): Measured {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return { file, bytes: bytes.length, sent: sentBytes(file, bytes) };
}

/** The measured first-load files of an output, with the data files read through `readData`. */
export function measureFirstLoad(output: Output, base: string, readData: (file: string) => string): { rows: Measured[]; problems: string[] } {
  const { files, problems } = firstLoadFiles(output, base);
  const byName = new Map(output.map((o) => [o.fileName, o]));
  const rows = files.map((file) => {
    const o = byName.get(file);
    if (!o) {
      problems.push(`${file} is named by the page but is not in the build`);
      return { file, bytes: 0, sent: 0 };
    }
    return measure(file, o.type === 'chunk' ? o.code : o.source);
  });
  for (const file of [INDEX_FILE, SUMMARY_FILE, raceFileName(LEAD_PAIR)]) rows.push(measure(`data/${file}`, readData(file)));
  return { rows, problems };
}

const kb = (n: number): string => `${(n / 1000).toFixed(1).padStart(7)} KB`;

/** The report: each file, the total against the budget, and what is wrong. Exit status 1 when anything is. */
export function report(rows: Measured[], problems: string[], extra: string[] = []): { lines: string[]; ok: boolean } {
  const total = rows.reduce((sum, r) => sum + r.sent, 0);
  const width = Math.max(...rows.map((r) => r.file.length));
  const lines = [
    'First-load files (as served; the map is not part of them):',
    ...rows.map((r) => `  ${r.file.padEnd(width)}  ${kb(r.bytes)}  ${kb(r.sent)} sent`),
    `  ${'total'.padEnd(width)}  ${kb(rows.reduce((s, r) => s + r.bytes, 0))}  ${kb(total)} sent`,
    `Budget ${kb(BUDGET_BYTES).trim()}: ${total <= BUDGET_BYTES ? `${((total / BUDGET_BYTES) * 100).toFixed(0)}% used` : `over by ${kb(total - BUDGET_BYTES).trim()}`}`,
    ...extra,
    ...problems.map((p) => `PROBLEM: ${p}`),
  ];
  return { lines, ok: total <= BUDGET_BYTES && problems.length === 0 };
}

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, '..');
  const config = await resolveConfig({ root }, 'build');
  // The build writes web/dist; the output it returns is what is measured.
  const built = await build({ root, logLevel: 'error' });
  const output = (Array.isArray(built) ? built : [built]).flatMap((b) => ('output' in b ? b.output : []));
  const { rows, problems } = measureFirstLoad(output, config.base, (file) => readFileSync(resolve(root, 'dist', 'data', file), 'utf8'));
  const maps = mapChunks(output);
  const extra = maps.map((c) => `Not counted, loaded after the card is on screen: ${c.fileName} (${kb(sentBytes(c.fileName, new TextEncoder().encode(c.code))).trim()} sent)`);
  const { lines, ok } = report(rows, [...problems, ...mapProblems(output, config.base)], extra);
  console.log(lines.join('\n'));
  if (!ok) process.exitCode = 1;
}

if (import.meta.main) await main();
