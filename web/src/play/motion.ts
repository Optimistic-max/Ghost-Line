// Motion levels (design 9.4, R5.10, R5.11): full; lite (movement only, after
// the frame-rate watchdog); reduced (the device asks for it: no clock, no
// movement, the finished state at once).
import type { MotionLevel } from '../state/model';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function initialMotion(win: Pick<Window, 'matchMedia'>): MotionLevel {
  return win.matchMedia(REDUCED_MOTION_QUERY).matches ? 'reduced' : 'full';
}

/** Calls back with the new level whenever the device's reduced-motion setting changes. */
export function watchMotion(win: Pick<Window, 'matchMedia'>, onChange: (level: MotionLevel) => void): void {
  const media = win.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener('change', () => onChange(media.matches ? 'reduced' : 'full'));
}

/** The root class for a level, so CSS can turn the extra motion off. */
export function motionClass(level: MotionLevel): string {
  return `motion-${level}`;
}
