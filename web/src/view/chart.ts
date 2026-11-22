// The start-time chart (story-layer Req 9, design 6.2): an inline SVG of the race file's stored
// totals, one column per slider minute, after the next-step actions, sharing the slider's range. Geometry comes from layout.ts;
// the readout under it prints the slider minute's two stored totals through display rounding.
// The drawing takes no pointer input and holds no listeners: the slider is the only time control.
import {
  CHART_ACCESSIBLE_NAME,
  CHART_HATCH_LABEL,
  CHART_HEADING,
  CHART_LEGEND_1938,
  CHART_LEGEND_TODAY,
  CHART_PROMPT_HEADING,
  CHART_READING,
  CHART_SUBHEADING,
  chartReadout,
  chartReadoutTrolley,
} from '../copy/copy';
import { rowAt } from '../data/lookup';
import type { RaceFile } from '../data/types';
import { clockOf, label12 } from '../format/time';
import { readoutNumbers } from '../state/specs';
import { fromMarkup, h } from './dom';
import { CHART_HEIGHT, type ChartPlan, chartGeometry, chartPath, chartPlan, cursorShift } from './layout';
import { type SourceRegistry, sentence } from './numbers';

export type ChartInput = {
  race: RaceFile;
  originName: string;
  destName: string;
  /** The slider's minute after midnight. */
  minute: number;
  /** A guided visit: the heading is the prompt heading (Req 3.4). */
  guided: boolean;
};

/**
 * The plan of a race file. A row with no one-seat ride inside a file that has some is a gap in the
 * bus line (the path breaks there); no value is substituted.
 */
export function safePlan(race: RaceFile): ChartPlan {
  return chartPlan(race);
}

const escapeAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The column of the row at slider minute `minute`, or -1. */
function columnOf(race: RaceFile, minute: number): number {
  const t = clockOf(minute);
  return race.races.findIndex((row) => row.t === t);
}

function drawing(plan: ChartPlan, column: number): DocumentFragment {
  const geometry = chartGeometry(plan);
  const hatch = geometry.hatch
    ? `<rect class="chart-hatch" x="${geometry.hatch.x}" y="0" width="${geometry.hatch.width}" height="${CHART_HEIGHT}" fill="url(#chart-hatch)"/>`
    : '';
  const today = plan.seriesToday
    ? `<path class="chart-line chart-line-today" d="${chartPath(plan.seriesToday, plan.max, CHART_HEIGHT)}"/>`
    : '';
  return fromMarkup(
    [
      `<svg class="chart-svg" role="img" aria-label="${escapeAttr(CHART_ACCESSIBLE_NAME)}" viewBox="0 0 ${geometry.width} ${CHART_HEIGHT}" preserveAspectRatio="none" focusable="false">`,
      `<defs><pattern id="chart-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="chart-hatch-line" x1="0" y1="0" x2="0" y2="4"/></pattern></defs>`,
      hatch,
      `<path class="chart-line chart-line-1938" d="${chartPath(plan.series1938, plan.max, CHART_HEIGHT)}"/>`,
      today,
      `<line class="chart-cursor" x1="0" y1="0" x2="0" y2="${CHART_HEIGHT}" style="transform: translateX(${cursorShift(column)}px)"${column < 0 ? ' visibility="hidden"' : ''}/>`,
      `</svg>`,
    ].join(''),
  );
}

/** The readout for the slider's minute, its two totals as number buttons (Req 9.7). */
function readout(registry: SourceRegistry, plan: ChartPlan, input: ChartInput): HTMLElement {
  const el = h('p', { class: 'chart-readout' });
  const row = rowAt(input.race, clockOf(input.minute));
  if (!row) return el;
  const { trolley, bus } = readoutNumbers(input.race, row, input.originName, input.destName);
  const time = label12(row.t);
  // The one-seat series is drawn only when the plan has it; the readout follows the plan.
  if (bus && plan.seriesToday) el.append(sentence(registry, chartReadout, time, trolley, bus));
  else el.append(sentence(registry, chartReadoutTrolley, time, trolley));
  return el;
}

export function chartView(registry: SourceRegistry, input: ChartInput): HTMLElement {
  const plan = safePlan(input.race);
  const column = columnOf(input.race, input.minute);
  const plot = h('div', { class: 'chart-plot' }, drawing(plan, column));
  if (plan.hatch) {
    plot.append(h('p', { class: 'chart-hatch-label', style: `--hatch-left: ${chartGeometry(plan).hatchLeftPct}%` }, CHART_HATCH_LABEL));
  }
  return h(
    'section',
    { class: 'chart' },
    h('h3', { class: input.guided ? 'chart-heading chart-prompt' : 'chart-heading' }, input.guided ? CHART_PROMPT_HEADING : CHART_HEADING),
    h('p', { class: 'chart-reading' }, CHART_READING),
    h('p', { class: 'chart-sub' }, CHART_SUBHEADING),
    h(
      'ul',
      { class: 'chart-key' },
      h('li', {}, h('span', { class: 'chart-swatch is-1938', 'aria-hidden': 'true' }), CHART_LEGEND_1938),
      plan.seriesToday ? h('li', {}, h('span', { class: 'chart-swatch is-today', 'aria-hidden': 'true' }), CHART_LEGEND_TODAY) : null,
    ),
    plot,
    readout(registry, plan, input),
  );
}

/**
 * The slider is held: move the cursor and rewrite the readout for the new minute. Nothing is fetched and
 * the drawing is not rebuilt (design 6.2). The old readout's sources leave the registry with it.
 */
export function updateChart(root: ParentNode, registry: SourceRegistry, input: ChartInput): void {
  const plan = safePlan(input.race);
  const cursor = root.querySelector<SVGElement>('.chart-cursor');
  if (cursor) {
    const column = columnOf(input.race, input.minute);
    cursor.style.transform = `translateX(${cursorShift(column)}px)`;
    if (column < 0) cursor.setAttribute('visibility', 'hidden');
    else cursor.removeAttribute('visibility');
  }
  const old = root.querySelector('.chart-readout');
  if (!old) return;
  old.querySelectorAll<HTMLElement>('button.num').forEach((b) => registry.delete(b.dataset['source'] ?? ''));
  old.replaceWith(readout(registry, plan, input));
}
