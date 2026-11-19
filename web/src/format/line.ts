// The line's route number and year, from index.json (R2.2, R12.3): the digits
// after "no" and before the hyphen of `line`, and the year of `effective`.
// When `line` does not have that form, there is no route number and the label
// is left out.

const LINE = /^no(\d+)-/;
const DATE = /^(\d{4})-\d{2}-\d{2}$/;

/** "21" from "no21-1938"; null for any other form. */
export function routeNumberOf(line: string): string | null {
  return LINE.exec(line)?.[1] ?? null;
}

/** "1938" from "1938-03-06"; null for any other form. */
export function yearOf(effective: string): string | null {
  return DATE.exec(effective)?.[1] ?? null;
}
