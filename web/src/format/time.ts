// Clock strings and the default start time. Allowed arithmetic (design section 1):
// converting "hh:mm" clock strings to and from minutes after midnight.

const HHMM = /^(\d{2}):([0-5]\d)$/;

/** Minutes after midnight of an "hh:mm" string (hours may pass 24). Throws on any other text. */
export function minutesOf(hhmm: string): number {
  const m = HHMM.exec(hhmm);
  if (!m) throw new Error(`not an hh:mm clock string: ${hhmm}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** The "hh:mm" string of a whole number of minutes after midnight. */
export function clockOf(minute: number): string {
  if (!Number.isInteger(minute) || minute < 0) throw new Error(`not a whole minute: ${minute}`);
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** The "hh:mm" one minute after the given one. */
export function minuteAfter(hhmm: string): string {
  return clockOf(minutesOf(hhmm) + 1);
}
