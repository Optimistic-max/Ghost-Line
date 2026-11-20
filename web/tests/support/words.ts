// Checks on rendered minute strings (R15.5, P13), shared by the format and DOM tests.

/**
 * Problems with the minute words in `text`: each number followed by "minute" or
 * "minutes" must take "minute" exactly when it is 1, and "1 minutes" never appears.
 */
export function minuteWordProblems(text: string): string[] {
  const problems: string[] = [];
  // The whole number, decimals included: "1.0 minute" (the method entry's photo-finish band) is one minute.
  for (const m of text.matchAll(/(?<![\d.])(\d+(?:\.\d+)?) (minutes?)\b/g)) {
    const one = Number(m[1]) === 1;
    if (one !== (m[2] === 'minute')) problems.push(`"${m[0]}"`);
  }
  if (/\b1 minutes\b/.test(text)) problems.push('"1 minutes"');
  return problems;
}
