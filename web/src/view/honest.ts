// The honest line under every result (R6.4, screen-brief 2.5). Its counts are
// read from summary.json. "When today wins" opens the list (task 13).
import { ACROSS_THIS_LINE, PHOTO_FINISH, SAME_RIDE, TODAY_WINS_THIS_RACE, WHEN_TODAY_WINS, trolleyFirst } from '../copy/copy';
import type { Honest } from '../state/model';
import type { Num } from '../state/specs';
import { h } from './dom';
import { type SourceRegistry, sentence } from './numbers';

export type HonestNumbers = { wins1938: Num; races: Num; pairs: Num };

export function honestLine(registry: SourceRegistry, honest: Honest, nums: HonestNumbers): HTMLElement {
  // A today win and a photo finish name the result, then the line-wide takeaway (product.md rule 6).
  const lead =
    honest.form === 'today-wins'
      ? [h('strong', {}, TODAY_WINS_THIS_RACE), ` ${ACROSS_THIS_LINE} `]
      : honest.form === 'photo-finish'
        ? [h('strong', {}, PHOTO_FINISH), ` ${ACROSS_THIS_LINE} `]
        : [h('strong', {}, SAME_RIDE), ' '];
  return h(
    'p',
    { class: 'honest', 'data-form': honest.form },
    ...lead,
    sentence(registry, trolleyFirst, nums.wins1938, nums.races, nums.pairs),
    ' ',
    h('button', { type: 'button', class: 'link', 'data-action': 'whentoday' }, WHEN_TODAY_WINS),
  );
}
