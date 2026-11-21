// The Req 1.2 predicate on shown values, for tests only (story-layer Req 1.8).
// The site never computes it: it reads the stored `wait_most`.

/**
 * True for a 1938 or today win exactly when the loser's shown wait minus the
 * winner's shown wait is more than half the shown margin. Integers throughout:
 * 2 * d > margin. False for a photo finish and for no one-seat ride.
 */
export function waitMostPredicate(
  result: string,
  shownWait1938: number,
  shownTotal1938: number,
  shownWaitToday: number,
  shownTotalToday: number,
): boolean {
  if (result !== '1938' && result !== 'today') return false;
  const margin = Math.abs(shownTotal1938 - shownTotalToday);
  const d = result === '1938' ? shownWaitToday - shownWait1938 : shownWait1938 - shownWaitToday;
  return 2 * d > margin;
}
