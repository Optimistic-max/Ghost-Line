// Task 22: the deploy workflow (22.1) and the first-race measurement (22.2). The workflow is
// read as text (the site has no YAML library): what runs, when, with which permissions, and
// what it must never do (run the pipeline, install Python, read raw/). The measurement's
// settings are the ones R16.2 gives: five runs, a median under 5,000 ms, slow 4G, a slowed
// processor.
import { describe, expect, it } from 'vitest';
import config from '../../vite.config';
import { SOURCE_URLS } from '../../src/config';
import { PERF, median, pagesUrl } from '../e2e/perf-config';
import { listRepoFiles, readRepoJson, readRepoText } from '../support/files';

const workflow = readRepoText('.github/workflows/pages.yml');
/** The workflow without its comment lines, so a comment cannot satisfy or break a check. */
const code = workflow
  .split(/\r?\n/)
  .filter((l) => !l.trim().startsWith('#'))
  .join('\n');

describe('the Pages workflow (22.1)', () => {
  it('is the only workflow, and runs on a push to main and nothing else', () => {
    expect(listRepoFiles('.github').filter((f) => f.startsWith('.github/workflows/'))).toEqual(['.github/workflows/pages.yml']);
    const on = /^on:\n((?:[ ]+.*\n?)+)/m.exec(code)![1]!;
    expect(on.replace(/\s+/g, ' ').trim()).toBe('push: branches: [main]');
    expect(code).not.toMatch(/pull_request|schedule|workflow_dispatch|workflow_run/);
  });

  it('builds web/ with npm ci and npm run build, and publishes web/dist', () => {
    expect(code).toMatch(/working-directory:\s*web\b/);
    expect(code).toMatch(/- run: npm ci\b/);
    expect(code).toMatch(/- run: npm run build\b/);
    expect(code).toMatch(/uses: actions\/upload-pages-artifact@v\d+\s+with:\s+path: web\/dist\b/);
    expect(code).toMatch(/uses: actions\/deploy-pages@v\d+/);
    // The lockfile is the one the build is made from.
    expect(code).toMatch(/cache-dependency-path:\s*web\/package-lock\.json/);
  });

  it('never runs the pipeline, never installs Python and never reads raw/ (tech.md)', () => {
    expect(code).not.toMatch(/\bpython\b|\bpip\b|pytest|pipeline|check_sources|raw\//i);
    expect(code).not.toMatch(/npm (test|run (test|screens|perf|check:size))/);
  });

  it('asks for the least it needs: read the code, write the Pages deployment, and the token Pages checks', () => {
    const block = /^permissions:\n((?:[ ]+.*\n?)+)/m.exec(code)![1]!;
    expect(block.split('\n').filter(Boolean).map((l) => l.trim()).sort()).toEqual(['contents: read', 'id-token: write', 'pages: write']);
  });

  it('deploys after the build, to the github-pages environment, one deployment at a time', () => {
    expect(code).toMatch(/deploy:\s+needs: build\b/);
    expect(code).toMatch(/environment:\s+name: github-pages\b/);
    expect(code).toMatch(/concurrency:\s+group: pages\s+cancel-in-progress: false/);
  });

  it('uses a Node the build supports, the one the site is built and tested on', () => {
    const node = Number(/node-version:\s*(\d+)/.exec(code)![1]);
    const range = readRepoJson<{ engines: { node: string } }>('web/node_modules/vite/package.json').engines.node;
    // Vite's own range, for instance "^20.19.0 || >=22.12.0": a clause allows a major that it names
    // with ^, or that is at or above the one it names with >=.
    const allowed = range.split('||').some((clause) => {
      const c = clause.trim();
      const major = Number(/(\d+)\./.exec(c)![1]);
      return c.startsWith('>=') ? node >= major : node === major;
    });
    expect(allowed, `Node ${node} against Vite's "${range}"`).toBe(true);
    // And the one this machine builds and tests with.
    expect(Number(process.versions.node.split('.')[0])).toBe(node);
  });

  it('builds for the repository\'s Pages address: the base path is the repository name', () => {
    const name = new URL(SOURCE_URLS.repository).pathname.split('/').filter(Boolean)[1]!;
    expect(config.base).toBe(`/${name}/`);
    expect(pagesUrl(SOURCE_URLS.repository)).toBe(`https://optimistic-max.github.io/${name}/`);
    expect(workflow).toContain(pagesUrl(SOURCE_URLS.repository));
  });

  it('serves committed data: the files the first race loads are in the repository, and raw/ is not', () => {
    const tracked = listRepoFiles('web/public/data');
    expect(tracked.length).toBe(23);
    expect(readRepoText('.gitignore')).toMatch(/^raw\/$/m);
    expect(listRepoFiles('.').filter((f) => f.startsWith('raw/'))).toEqual([]);
  });
});

describe('the first-race measurement (22.2, R16.2)', () => {
  it('runs five loads and holds the median to under 5,000 ms, on slow 4G with a slowed processor', () => {
    expect(PERF.runs).toBe(5);
    expect(PERF.limitMs).toBe(5000);
    expect(PERF.cpuSlowdown).toBeGreaterThan(1);
    expect(PERF.network.latencyMs).toBeGreaterThanOrEqual(100);
    // Slow 4G is about 1.5 Mbit/s: a few hundred KB per second at most.
    expect(PERF.network.downloadBytesPerSecond).toBeGreaterThan(100_000);
    expect(PERF.network.downloadBytesPerSecond).toBeLessThan(400_000);
    expect(PERF.viewport.width).toBeLessThan(900);
  });

  it('takes the median of any count, the mean of the middle two for an even one', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
    expect(median([100, 4000, 4100, 4200, 9000])).toBe(4100);
    expect(() => median([])).toThrow();
  });

  it('is one npm script of one command, and a project the default runs do not include', () => {
    const { scripts } = readRepoJson<{ scripts: Record<string, string> }>('web/package.json');
    expect(scripts['perf']).toBe('playwright test --project=perf');
    expect(scripts['perf']).not.toMatch(/&&|\|\||[|;]/);
    expect(scripts['test:e2e']).not.toMatch(/perf/);
    expect(scripts['screens']).not.toMatch(/perf/);
    expect(scripts['test']).toBe('vitest run');
    const spec = readRepoText('web/tests/e2e/perf.spec.ts');
    expect(spec).toMatch(/@timing/);
    expect(spec).toContain("'race-start'");
    expect(spec).toMatch(/Emulation\.setCPUThrottlingRate/);
    expect(spec).toMatch(/Network\.emulateNetworkConditions/);
    // The default address is derived from the one repository link, not typed again (comments aside).
    const specCode = spec
      .split(/\r?\n/)
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect(specCode).not.toMatch(/https?:\/\//);
    expect(specCode).toContain('pagesUrl(SOURCE_URLS.repository)');
  });

  it('names the deployed page\'s address from the repository link, lower-cased as Pages serves it', () => {
    expect(pagesUrl('https://github.com/Optimistic-max/Ghost-Line')).toBe('https://optimistic-max.github.io/Ghost-Line/');
    expect(() => pagesUrl('https://github.com/')).toThrow();
  });

  it('is documented with its two timing commands, and the race-start mark the page makes', () => {
    const readme = readRepoText('web/README.md');
    expect(readme).toContain('python -m pipeline check --timing');
    expect(readme).toContain('npm run perf');
    expect(readme).toContain('race-start');
    expect(readme).toContain('.github/workflows/pages.yml');
    expect(readRepoText('web/src/view/app.ts')).toContain("timers.mark('race-start')");
  });
});
