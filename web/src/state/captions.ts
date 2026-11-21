// Caption selection (story-layer design 3.1, Req 7). Pure: it maps the phases the two lanes are in to a
// key; the words are kept in copy/copy.ts (captionText). Nothing here holds a number or a place name.
import type { Caption1938Phase, CaptionKey, CaptionTodayPhase } from '../copy/copy';
import type { LaneFrame } from '../play/timeline';
import type { Lane } from './model';

export type Side38 = Caption1938Phase;
export type SideToday = CaptionTodayPhase;

/**
 * The phase a lane is in, from the same frame that draws its bars, so a caption cannot name a phase the
 * lane is not in (Req 7.3). `laneFrame` already skips zero-length phases.
 */
export function phaseOf(lane: Lane, frame: LaneFrame): Side38 | SideToday {
  if (frame.arrived) return 'arrived';
  const kind = lane.phases[frame.current]?.kind;
  if (lane.side === '1938') return kind === 'ride' ? 'riding' : 'waiting';
  if (kind === 'walk-to-stop') return 'walking-to-stop';
  if (kind === 'wait') return 'waiting';
  if (kind === 'ride') return 'riding';
  if (kind === 'walk-from-stop') return 'walking-to-destination';
  return 'waiting';
}

/** The caption key for the two sides' phases; `today` is null when there is no one-seat ride (Req 7.6). */
export function captionFor(input: { p1938: Side38; today: SideToday | null; orientation: boolean }): CaptionKey {
  if (input.orientation) return { kind: 'orientation' };
  const done1938 = input.p1938 === 'arrived';
  if (input.today === null) return { kind: 'clauses', p1938: { phase: input.p1938, still: false }, today: null };
  const doneToday = input.today === 'arrived';
  if (done1938 && doneToday) return { kind: 'both-arrived' };
  return {
    kind: 'clauses',
    p1938: { phase: input.p1938, still: !done1938 && doneToday },
    today: { phase: input.today, still: !doneToday && done1938 },
  };
}
