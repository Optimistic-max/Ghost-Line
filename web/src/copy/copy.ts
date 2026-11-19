// Every user-visible string of the race screen, as templates (design 16). This is
// the only module with visible wording; each template is a row, or one quoted
// string of a row, of the copy table in .kiro/specs/race-screen/requirements.md.
// tests/unit/copy-table.test.ts holds this file to that table.
//
// Minute words follow R15.5: "minute" after the number 1, "minutes" otherwise.

// ---- Minute words (R15.5) -----------------------------------------------------

/** "minute" for 1, "minutes" for any other number. */
export function minuteWord(n: number): string {
  return n === 1 ? 'minute' : 'minutes';
}

/** "1 minute", "15 minutes". */
export function minutes(n: number): string {
  return `${n} ${minuteWord(n)}`;
}

// ---- Frequency: the gap part and the 1938 spacing (R8.5) ------------------------

/** Gap part when the lower bus gap rounds to 0. */
export function gapUpTo(max: number): string {
  return `up to ${max} ${minuteWord(max)} apart`;
}

/** Gap part when the two rounded bus gaps differ. The unit follows {max}. */
export function gapRange(min: number, max: number): string {
  return `${min} to ${max} ${minuteWord(max)} apart`;
}

/** Gap part when the two rounded bus gaps are equal. */
export function gapEqual(n: number): string {
  return `${n} ${minuteWord(n)} apart`;
}

/** 1938 spacing when the two rounded gaps are equal. */
export function everyMinutes(n: number): string {
  return `every ${n} ${minuteWord(n)}`;
}

/** 1938 spacing when the two rounded gaps differ. The unit follows {b}. */
export function everyMinutesOr(a: number, b: number): string {
  return `every ${a} or ${b} ${minuteWord(b)}`;
}

// ---- Clock and list formats --------------------------------------------------

/** The slider label form "{hh:mm AM/PM}", for example "10:00 AM". */
export function clock12(hm: string, pm: boolean): string {
  return `${hm} ${pm ? 'PM' : 'AM'}`;
}

/** The word that joins the last two route names (R8.5). */
export const LIST_AND = 'and';
