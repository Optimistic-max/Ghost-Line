// Playback timing (design 9.1). Allowed arithmetic: phase boundaries as
// cumulative stored parts, on the scheduled-minute axis. Nothing here produces a
// result, a total or a margin. Task 11 adds the segments and the speed.
import type { Lane, RaceView } from '../state/model';

/** Where a lane's last phase ends: the sum of its stored parts, in scheduled minutes from the start. */
export function laneEnd(lane: Lane): number {
  return lane.phases.reduce((sum, phase) => sum + phase.stored, 0);
}

export type Ends = { end1938: number; endToday: number | null };

export function ends(view: RaceView): Ends {
  return { end1938: laneEnd(view.lane1938), endToday: view.laneToday ? laneEnd(view.laneToday) : null };
}

/**
 * The moment the result is shown (R5.7), chosen from the stored result, never by
 * comparing the two ends to find a winner: a win shows at the winner's arrival;
 * a photo finish when both have arrived; no one-seat ride when the 1938 side
 * arrives.
 */
export function resultAt(view: RaceView): number {
  const { end1938, endToday } = ends(view);
  switch (view.result) {
    case '1938':
    case 'no_one_seat_ride':
      return end1938;
    case 'today':
      return endToday ?? end1938;
    case 'photo_finish':
      return Math.max(end1938, endToday ?? end1938);
  }
}
