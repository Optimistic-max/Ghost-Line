// The departures board (R8.1 to R8.4, screen-brief 3A.5). It lists the next four
// 1938 cars and the next three buses from row.start, picked by position in the
// race file's lists; the next one on each side is a filled chip. Every time is a
// number button, and so are the 1938 spacing and the bus gaps, whose Sources
// rows carry the frequency sentence (Emmanuel, Nov 19). The header's time is the
// start time, shown like the slider's.
import { BOARD_1938, LANE_TITLE_TODAY, boardHeader } from '../copy/copy';
import { shortClock } from '../format/time';
import type { RaceView, Side } from '../state/model';
import type { Num } from '../state/specs';
import { h } from './dom';
import { type SourceRegistry, numberButton } from './numbers';

export type BoardNumbers = { cars: Num[]; buses: Num[]; spacing: Num; gaps: Num | null };

function boardRow(registry: SourceRegistry, side: Side, label: string, times: Num[], spacing: Num): HTMLElement {
  const chips = times.map((time, k) => {
    const chip = numberButton(registry, time);
    chip.classList.add('chip');
    if (k === 0) chip.classList.add('chip-next');
    return chip;
  });
  const words = numberButton(registry, spacing);
  words.classList.add('board-gaps', 'display');
  return h(
    'div',
    { class: `board-row board-row-${side}` },
    h('span', { class: 'board-label display' }, label),
    h('span', { class: 'board-times' }, ...chips),
    words,
  );
}

export function boardView(registry: SourceRegistry, view: RaceView, nums: BoardNumbers): HTMLElement {
  return h(
    'div',
    { class: 'board' },
    h('p', { class: 'board-head' }, boardHeader(shortClock(view.board.after))),
    boardRow(registry, '1938', BOARD_1938, nums.cars, nums.spacing),
    nums.buses.length > 0 && nums.gaps ? boardRow(registry, 'today', LANE_TITLE_TODAY, nums.buses, nums.gaps) : null,
  );
}
