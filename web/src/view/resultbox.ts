// The result box (R6.1 to R6.3, design 13.4): a dark sign-like box with the
// result line in the winner's colour and the two shown totals. The result is
// row.result; the box, its size, weight and position are the same for every
// result, and only data-result (the colour) differs.
import {
  NO_ONE_SEAT_RIDE,
  PHOTO_FINISH,
  aboutAnd,
  bothAbout,
  totals1938Wins,
  totalsTodayWins,
  trolleyNoWinner,
  wins1938,
  winsToday,
} from '../copy/copy';
import type { RaceView } from '../state/model';
import type { Num } from '../state/specs';
import { h } from './dom';
import { type SourceRegistry, sentence } from './numbers';

export type ResultNumbers = { total1938: Num; totalToday: Num | null; margin: Num | null };

function lines(registry: SourceRegistry, view: RaceView, nums: ResultNumbers): [DocumentFragment, DocumentFragment] {
  const rv = view.resultView;
  const { total1938, totalToday, margin } = nums;
  switch (rv.kind) {
    case '1938':
      return [sentence(registry, wins1938, margin!), sentence(registry, totals1938Wins, total1938, totalToday!)];
    case 'today':
      return [sentence(registry, winsToday, margin!), sentence(registry, totalsTodayWins, totalToday!, total1938)];
    case 'photo_finish': {
      const head = sentence(registry, () => PHOTO_FINISH);
      if (rv.totals.form === 'both') return [head, sentence(registry, bothAbout, total1938)];
      // The smaller shown total first, each the button of its own lane.
      const [low, high] = total1938.n === rv.totals.n ? [total1938, totalToday!] : [totalToday!, total1938];
      return [head, sentence(registry, aboutAnd, low, high)];
    }
    case 'no_one_seat_ride':
      return [sentence(registry, () => NO_ONE_SEAT_RIDE), sentence(registry, trolleyNoWinner, total1938)];
  }
}

export function resultBox(registry: SourceRegistry, view: RaceView, nums: ResultNumbers): HTMLElement {
  const [line, totals] = lines(registry, view, nums);
  return h(
    'div',
    { class: 'result', 'data-result': view.result },
    h('p', { class: 'result-line display' }, line),
    h('p', { class: 'result-totals' }, totals),
  );
}
