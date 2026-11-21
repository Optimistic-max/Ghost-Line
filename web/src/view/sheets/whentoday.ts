// The "When today wins" list (R6.5): the ride-verdict sentence, its counts read
// from summary.json as number buttons (the slower clause only when that count is
// above zero), then every entry of today_wins, each one tap from its race.
import { WHEN_TODAY_WINS, todayWinEntry, whenTodayWinsHeading, whenTodayWinsSentence } from '../../copy/copy';
import { cornerName } from '../../data/lookup';
import type { Index, Summary } from '../../data/types';
import { shortClock } from '../../format/time';
import { verdictNumbers } from '../../state/specs';
import { h } from '../dom';
import { type SourceRegistry, sentence } from '../numbers';
import type { SheetParts } from './sheet';

export function whenTodaySheet(registry: SourceRegistry, index: Index, summary: Summary): SheetParts {
  const n = verdictNumbers(summary);
  const heading = h('p', { class: 'whentoday-heading' }, sentence(registry, whenTodayWinsHeading, n.winsToday));
  const lead = h(
    'p',
    { class: 'whentoday-sentence' },
    sentence(registry, whenTodayWinsSentence, n.rideSame, n.pairs, n.rideFaster, n.rideSlower, summary.ride_slower_today > 0),
  );
  const entries = summary.today_wins.map((win, k) =>
    h(
      'li',
      {},
      h(
        'button',
        { type: 'button', class: 'today-win', 'data-action': 'today-win', 'data-index': String(k) },
        todayWinEntry(cornerName(index, win.origin) ?? win.origin, cornerName(index, win.dest) ?? win.dest, shortClock(win.t)),
      ),
    ),
  );
  return { name: 'whentoday', title: WHEN_TODAY_WINS, body: [heading, lead, h('ul', { class: 'today-wins' }, ...entries)] };
}
