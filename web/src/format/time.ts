// Clock strings, the default start time and dates (design 7). Allowed arithmetic:
// converting clock strings to and from minutes after midnight, and reading the
// time of day in America/New_York. The device's own time zone is never used.
import { FALLBACK_START } from '../config';
import { clock12 } from '../copy/copy';

const HHMM = /^(\d{2}):([0-5]\d)$/;
const HHMMSS = /^(\d{2}:[0-5]\d):[0-5]\d$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

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

/** The slider minute after a minus (-1) or plus (+1) press, kept inside [first, last]. */
export function stepMinute(minute: number, step: -1 | 1, first: string, last: string): number {
  return Math.min(minutesOf(last), Math.max(minutesOf(first), minute + step));
}

/** "hh:mm" from a GTFS "hh:mm:ss": the seconds are dropped, not rounded. */
export function dropSeconds(hhmmss: string): string {
  const m = HHMMSS.exec(hhmmss);
  if (!m || m[1] === undefined) throw new Error(`not an hh:mm:ss clock string: ${hhmmss}`);
  return m[1];
}

/** A clock string as the screen prints it: no leading zero on the hour ("9:21", "13:52"). */
export function shortClock(hhmm: string): string {
  minutesOf(hhmm);
  return hhmm.startsWith('0') ? hhmm.slice(1) : hhmm;
}

/** The 12-hour label of an "hh:mm" string: "10:00 AM", "2:00 PM", "12:00 PM". */
export function label12(hhmm: string): string {
  const total = minutesOf(hhmm);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return clock12(`${h12}:${String(m).padStart(2, '0')}`, h >= 12);
}

/** The race clock readout's time: start plus whole elapsed scheduled minutes ("10:08"). */
export function clockLabel(startHHMM: string, elapsedMinutes: number): string {
  const whole = Number.isFinite(elapsedMinutes) && elapsedMinutes > 0 ? Math.floor(elapsedMinutes) : 0;
  return shortClock(clockOf(minutesOf(startHHMM) + whole));
}

const NEW_YORK_CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
});

/** Minutes after midnight in America/New_York at `now`, seconds dropped. */
export function newYorkMinute(now: Date): number {
  const parts = NEW_YORK_CLOCK.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  return hour * 60 + minute;
}

export type DefaultStart = { minute: number; fromClock: boolean };

/**
 * The default start minute (R3.4, race-brief 5.9): the New York time of day if
 * it lies in [first, last], both inclusive, and `fromClock` is true; otherwise
 * the fallback (10:00). If the fallback were outside the range, the first
 * minute would be used, so the result is always inside the slider range.
 */
export function defaultStart(now: Date, first: string, last: string): DefaultStart {
  const lo = minutesOf(first);
  const hi = minutesOf(last);
  if (!Number.isNaN(now.getTime())) {
    const m = newYorkMinute(now);
    if (Number.isInteger(m) && m >= lo && m <= hi) return { minute: m, fromClock: true };
  }
  const fallback = minutesOf(FALLBACK_START);
  return { minute: fallback >= lo && fallback <= hi ? fallback : lo, fromClock: false };
}

export function defaultMinute(now: Date, first: string, last: string): number {
  return defaultStart(now, first, last).minute;
}

const DATE_LABEL = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

/** "Nov 4, 2026" from "2026-11-04". Read as a UTC date, so it never shifts a day. */
export function serviceDateLabel(iso: string): string {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new Error(`not a yyyy-mm-dd date: ${iso}`);
  return DATE_LABEL.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
}
