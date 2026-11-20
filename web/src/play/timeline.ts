// Playback timing (design 9.1, R5.2). Allowed arithmetic: phase boundaries as
// cumulative stored parts on the scheduled-minute axis, the playback speed, and
// positions and countdowns for drawing. Nothing here produces a result, a total
// or a margin, and the shown (rounded) minutes never set a position.
import type { Lane, PhaseKind, RaceView, Side } from '../state/model';

/** Scheduled minutes per real second at normal speed (R5.2). */
export const BASE_SPEED = 4;
/** The longest race plays in at most this many real seconds (R5.2). */
export const MAX_SECONDS = 12;

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

export type Segment = { side: Side; kind: PhaseKind; index: number; from: number; to: number };

export type Timeline = {
  segments: Segment[];
  end1938: number;
  endToday: number | null;
  resultAt: number;
  /** When both sides are done (the 1938 side alone with no one-seat ride). */
  finishAt: number;
  /** Scheduled minutes per real second. */
  speed: number;
  /** Real milliseconds from start to finish. */
  durationMs: number;
};

function laneSegments(lane: Lane): Segment[] {
  let at = 0;
  return lane.phases.map((phase, index) => {
    const segment = { side: lane.side, kind: phase.kind, index, from: at, to: at + phase.stored };
    at = segment.to;
    return segment;
  });
}

/** The timeline of one race: 4 scheduled minutes a second, faster when the longer side would pass 12 s. */
export function buildTimeline(view: RaceView): Timeline {
  const { end1938, endToday } = ends(view);
  const finishAt = Math.max(end1938, endToday ?? 0);
  const speed = Math.max(BASE_SPEED, finishAt / MAX_SECONDS);
  return {
    segments: [...laneSegments(view.lane1938), ...(view.laneToday ? laneSegments(view.laneToday) : [])],
    end1938,
    endToday,
    resultAt: resultAt(view),
    finishAt,
    speed,
    durationMs: (finishAt / speed) * 1000,
  };
}

/** Scheduled minutes elapsed after `ms` real milliseconds, never past the finish. */
export function elapsedAt(timeline: Timeline, ms: number): number {
  return Math.min(timeline.finishAt, Math.max(0, (ms / 1000) * timeline.speed));
}

/**
 * A segment's share already filled at `elapsed`: 0 before it, 1 after it,
 * linear inside. A zero-length segment is filled as soon as the race moves past it.
 */
export function fillOf(segment: Segment, elapsed: number): number {
  if (segment.to <= segment.from) return elapsed > 0 && elapsed >= segment.to ? 1 : 0;
  return Math.min(1, Math.max(0, (elapsed - segment.from) / (segment.to - segment.from)));
}

export type LaneFrame = {
  /** Each phase's filled share. */
  fills: number[];
  /** True for phases already reached (not dimmed). */
  reached: boolean[];
  /** The phase under way, or the last one once the lane has arrived. */
  current: number;
  /** Whole minutes left of the current phase, counting down from its shown part (R5.4). */
  countdown: number;
  /**
   * The filled end of the ride portion, as a share of the scale: the ride's
   * start before it, linear in time during it, its end after it. The vehicle's
   * front edge sits there, never nearer the lane start than its own width
   * (card.css), so it moves during the ride only (Emmanuel, Nov 19).
   */
  vehicle: number;
  /** True while the ride phase is under way: the vehicle is moving. */
  moving: boolean;
  arrived: boolean;
};

/** Where a lane's ride portion starts and ends, as shares of the scale (layout.ts). */
export type Travel = { from: number; to: number };

/** One lane at `elapsed`. */
export function laneFrame(lane: Lane, timeline: Timeline, elapsed: number, travel: Travel): LaneFrame {
  const segments = timeline.segments.filter((s) => s.side === lane.side);
  const fills = segments.map((s) => fillOf(s, elapsed));
  // The first phase is under way from the start; a later one once the race has moved past its start.
  const reached = segments.map((s) => s.index === 0 || elapsed > s.from);
  const end = segments.at(-1)?.to ?? 0;
  const arrived = elapsed >= end && end > 0;
  // The phase under way: the first not yet over, skipping zero-length ones; the last once arrived.
  let current = segments.findIndex((s) => elapsed < s.to);
  if (current === -1) current = segments.length - 1;
  const phase = lane.phases[current];
  const fill = fills[current] ?? 0;
  const countdown = phase ? Math.max(0, Math.ceil(phase.shown * (1 - fill) - 1e-9)) : 0;
  const ride = segments.find((s) => s.kind === 'ride');
  const rideFill = ride ? fillOf(ride, elapsed) : 0;
  const vehicle = travel.from + (travel.to - travel.from) * rideFill;
  const moving = rideFill > 0 && rideFill < 1;
  return { fills, reached, current, countdown, vehicle, moving, arrived };
}

/** A side's ride filled at `elapsed`, 0 to 1: the map marker's progress along the route (R5.9). */
export function rideShare(timeline: Timeline, side: Side, elapsed: number): number {
  const ride = timeline.segments.find((s) => s.side === side && s.kind === 'ride');
  return ride ? fillOf(ride, elapsed) : 0;
}

/** Real milliseconds between pole sparks: a random gap of 1.5 to 4 s (screen-brief 3A.6). */
export const SPARK = { minGapMs: 1500, maxGapMs: 4000, flashMs: 120 } as const;

export function sparkGapMs(random: number): number {
  return SPARK.minGapMs + random * (SPARK.maxGapMs - SPARK.minGapMs);
}
