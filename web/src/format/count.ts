// Counts as the screen prints them, with a comma between each group of three digits.
// Display formatting only: the counts are read from summary.json.

const COUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatCount(n: number): string {
  return COUNT.format(n);
}
