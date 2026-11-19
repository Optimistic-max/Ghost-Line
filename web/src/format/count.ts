// Counts as the screen prints them, with thousands separators ("5,582").
// Display formatting only: the counts are read from summary.json.

const COUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatCount(n: number): string {
  return COUNT.format(n);
}
