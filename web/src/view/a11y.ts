// The race announcement (R13.2, design 15): one write to the polite result
// region per race, at the result moment, built from the shown numbers. Task 18.1
// adds the rest of the screen-reader wiring.
import { announce1938Wins, announceNoOneSeatRide, announcePhotoFinish, announceTodayWins } from '../copy/announce';
import { label12 } from '../format/time';
import type { RaceView } from '../state/model';

/** The spoken summary of the race on screen. The walking total is the sum of the shown walk parts (R7.5). */
export function announcement(view: RaceView): string {
  const race = { origin: view.originName, dest: view.destName, time: label12(view.start), trolley: view.lane1938.shownTotal };
  const rv = view.resultView;
  if (rv.kind === 'no_one_seat_ride' || !view.laneToday || view.walkShown === null) return announceNoOneSeatRide(race);
  const bus = { ...race, bus: view.laneToday.shownTotal, walk: view.walkShown };
  switch (rv.kind) {
    case '1938':
      return announce1938Wins({ ...bus, margin: rv.shownMargin });
    case 'today':
      return announceTodayWins({ ...bus, margin: rv.shownMargin });
    case 'photo_finish':
      return announcePhotoFinish(bus);
  }
}

/** Delay between clearing the region and writing it, so assistive technology hears the new text. */
export const ANNOUNCE_DELAY_MS = 50;

export type Announcer = {
  /** Clear the region, then write the text after a short delay. */
  say(text: string): void;
  /** Drop a write not yet made. */
  cancel(): void;
};

export function createAnnouncer(
  region: HTMLElement | null,
  later: (callback: () => void, ms: number) => number,
  cancel: (handle: number) => void,
): Announcer {
  let pending: number | null = null;
  const drop = (): void => {
    if (pending !== null) cancel(pending);
    pending = null;
  };
  return {
    say(text) {
      if (!region) return;
      drop();
      region.textContent = '';
      pending = later(() => {
        pending = null;
        region.textContent = text;
      }, ANNOUNCE_DELAY_MS);
    },
    cancel: drop,
  };
}
