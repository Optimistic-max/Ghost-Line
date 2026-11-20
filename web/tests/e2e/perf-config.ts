// What the first-race measurement runs with and holds the page to (R16.2, R17.7). Shared by
// the Playwright run (perf.spec.ts, `npm run perf`) and the unit test of its settings.

/** The address of the deployed page: the repository's owner and name under github.io, from the one repository link. */
export function pagesUrl(repository: string): string {
  const [owner, name] = new URL(repository).pathname.split('/').filter(Boolean);
  if (!owner || !name) throw new Error(`not a repository link: ${repository}`);
  return `https://${owner.toLowerCase()}.github.io/${name}/`;
}

/** Five cold loads; the median must be under the limit. */
export const PERF = {
  runs: 5,
  /** The `race-start` mark, in milliseconds after the page started loading (R16.2). */
  limitMs: 5000,
  /** A phone: the design size of ui.md, with touch. */
  viewport: { width: 375, height: 667 },
  /**
   * "Slow 4G" as Lighthouse's mobile preset has it: 150 ms round trip, 1.6 Mbit/s down (taken as the
   * 0.9 of it a connection reaches, as Lighthouse does) and 750 kbit/s up, with the processor slowed
   * four times. Bytes per second for the browser's own emulation.
   */
  network: {
    latencyMs: 150,
    downloadBytesPerSecond: Math.round(((1.6 * 1024 * 1024) / 8) * 0.9),
    uploadBytesPerSecond: Math.round(((750 * 1024) / 8) * 0.9),
  },
  cpuSlowdown: 4,
  /** A page that has not started its race after this long has failed; the test says so rather than waiting. */
  waitMs: 60_000,
} as const;

/** The middle of a list of numbers; the mean of the two middle ones for an even count. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('no values');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
