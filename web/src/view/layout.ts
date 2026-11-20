// Layout (design 13.3, P-B 2): bar widths on one shared time scale, so the longer
// trip is visibly longer. Allowed arithmetic: fractions of the longer stored
// total. Nothing here decides a result.
import type { Lane, RaceView } from '../state/model';

export type LaneLayout = {
  /** Each phase's share of the shared scale, in phase order. */
  widths: number[];
  /** Where the lane's bar ends, as a share of the scale. */
  end: number;
  /** Where the ride phase starts, as a share of the scale. */
  rideFrom: number;
  /** Where the ride phase ends, as a share of the scale: the vehicle's front edge after the ride. */
  park: number;
  /** The gaps between phases drawn before the ride, which also shift its start (card.css --seg-gap). */
  gapsBefore: number;
};

export type RaceLayout = { lane1938: LaneLayout; laneToday: LaneLayout | null };

function laneLayout(lane: Lane, longest: number): LaneLayout {
  const widths = lane.phases.map((p) => (longest > 0 ? p.stored / longest : 0));
  const rideIndex = Math.max(0, lane.phases.findIndex((p) => p.kind === 'ride'));
  const rideFrom = widths.slice(0, rideIndex).reduce((a, b) => a + b, 0);
  const park = rideFrom + (widths[rideIndex] ?? 0);
  const end = widths.reduce((a, b) => a + b, 0);
  return { widths, end, rideFrom, park, gapsBefore: rideIndex };
}

/**
 * Shrink an element's font until its one line of text fits its width, in half
 * pixels and never below `minPx` (the desktop pair names, R1.3). Without a
 * layout (jsdom) nothing is measured and nothing changes.
 */
export function fitOneLine(el: HTMLElement, minPx: number): void {
  el.style.removeProperty('font-size');
  for (let tries = 0; tries < 4 && el.scrollWidth > el.clientWidth && el.clientWidth > 0; tries += 1) {
    const size = Number.parseFloat(getComputedStyle(el).fontSize);
    const next = Math.max(minPx, Math.floor(((size * el.clientWidth) / el.scrollWidth) * 2) / 2);
    const smaller = next < size ? next : Math.max(minPx, size - 0.5);
    if (smaller >= size) return;
    el.style.fontSize = `${smaller}px`;
  }
}

/** The bars of both lanes on one scale: the longer stored total fills the track. */
export function raceLayout(view: RaceView): RaceLayout {
  const sum = (lane: Lane): number => lane.phases.reduce((a, p) => a + p.stored, 0);
  const longest = Math.max(sum(view.lane1938), view.laneToday ? sum(view.laneToday) : 0);
  return {
    lane1938: laneLayout(view.lane1938, longest),
    laneToday: view.laneToday ? laneLayout(view.laneToday, longest) : null,
  };
}
