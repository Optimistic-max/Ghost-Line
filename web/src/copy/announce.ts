// The four spoken result summaries (copy table, R13.2). Every number is a shown
// number: totals and margin as on screen, and the walking total as the sum of the
// shown walk parts (R7.5). Corner names and the start time come from the data.
import { minuteWord, minutes } from './copy';

export type AnnounceRace = {
  origin: string;
  dest: string;
  /** The start as a 12-hour label, for example "10:00 AM". */
  time: string;
  trolley: number;
};

export type AnnounceBus = AnnounceRace & { bus: number; walk: number };

function opening(r: AnnounceRace): string {
  return `Race result. ${r.origin} to ${r.dest}, starting ${r.time}. 1938 trackless trolley: ${minutes(r.trolley)}.`;
}

function busLine(r: AnnounceBus): string {
  return `Today's bus: ${minutes(r.bus)}, including ${r.walk} ${minuteWord(r.walk)} of walking, estimated.`;
}

export function announce1938Wins(r: AnnounceBus & { margin: number }): string {
  return `${opening(r)} ${busLine(r)} 1938 was faster by ${minutes(r.margin)}. All times are scheduled.`;
}

export function announceTodayWins(r: AnnounceBus & { margin: number }): string {
  return `${opening(r)} ${busLine(r)} Today was faster by ${minutes(r.margin)}. All times are scheduled.`;
}

export function announcePhotoFinish(r: AnnounceBus): string {
  return `${opening(r)} ${busLine(r)} Photo finish. No winner is called. All times are scheduled.`;
}

export function announceNoOneSeatRide(r: AnnounceRace): string {
  return `${opening(r)} No one-seat ride today: no single scheduled bus links these corners. No winner is called. All times are scheduled.`;
}
