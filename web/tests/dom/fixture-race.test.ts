// Task 19.3 (story-layer Req 16.8): the made-up race file (web/tests/fixtures/fake, never written to web/public)
// drives the page. Chart columns equal its stored totals, its before-table minutes are hatched, and the readout,
// the takeaway, the "most of the difference" sentence and the caption follow its rows. Expected values come from
// the stored rows and from rounding written out here.
import { afterEach, describe, expect, it } from 'vitest';
import * as C from '../../src/copy/copy';
import { pairKey } from '../../src/data/files';
import { clockOf, label12, minutesOf } from '../../src/format/time';
import { FIXTURE_DIR, fixtureData } from '../support/fixture';
import { bootPage } from '../support/page';
import { text, value } from '../support/render';

const fake = fixtureData();
const pair = fake.index.pairs[0]!;
const race = fake.races.get(pairKey(pair))!;
const rows = race.races;
const shown = (stored: number): number => Math.floor(stored + 0.5);

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
  window.history.replaceState(null, '', '/');
});

const at = (hhmm: string) => bootPage({
  motion: 'reduced',
  folder: FIXTURE_DIR,
  leadPair: pair,
  query: `?from=${pair.origin}&to=${pair.dest}`,
  now: new Date(`${fake.index.service_date}T${hhmm}:00-05:00`),
});

/** The one-seat total column heights of a step path, read back into minutes. */
const columns = (d: string, max: number, height: number): number[] =>
  d.split(' ').filter((tk) => !tk.startsWith('H') && !tk.startsWith('M')).map((tk) => max * (1 - Number(tk.replace('V', '')) / height));

describe('the made-up race file on the page (Req 16.8)', () => {
  it('has the rows these tests need: a before-table run, wait_most true and wait_most false on a win', () => {
    expect(rows.some((r) => r.before_table)).toBe(true);
    expect(rows.some((r) => r.today && r.wait_most)).toBe(true);
    expect(rows.some((r) => r.today && !r.wait_most && (r.result === '1938' || r.result === 'today'))).toBe(true);
  });

  it('draws one column per row at the stored totals and hatches exactly the before-table minutes', async () => {
    await at('10:00');
    const svg = document.querySelector('.chart-svg')!;
    const max = Math.max(...rows.map((r) => r.y1938.total), ...rows.map((r) => r.today?.total ?? 0));
    const height = Number(svg.getAttribute('viewBox')!.split(' ')[3]);
    const old = columns(svg.querySelector('.chart-line-1938')!.getAttribute('d')!, max, height);
    expect(old).toHaveLength(rows.length);
    old.forEach((v, k) => expect(v).toBeCloseTo(rows[k]!.y1938.total, 1));
    const bus = columns(svg.querySelector('.chart-line-today')!.getAttribute('d')!, max, height);
    expect(bus).toHaveLength(rows.length);
    bus.forEach((v, k) => expect(v).toBeCloseTo(rows[k]!.today!.total, 1));

    const hatched = rows.map((r, k) => (r.before_table ? k : -1)).filter((k) => k >= 0);
    const rect = svg.querySelector('.chart-hatch')!;
    expect(Number(rect.getAttribute('x'))).toBe(hatched[0]! - 0.5);
    expect(Number(rect.getAttribute('width'))).toBe(hatched.length);
    expect(hatched).toEqual(hatched.map((_, k) => hatched[0]! + k));
    expect(text(document.querySelector('.chart-hatch-label'))).toBe(C.CHART_HATCH_LABEL);
  });

  it('shows the readout, the caption and no "most of the difference" sentence on a win with the stored flag false', async () => {
    const row = rows.find((r) => r.today && !r.wait_most && (r.result === '1938' || r.result === 'today'))!;
    await at(row.t);
    const readout = document.querySelector('.chart-readout')!;
    const n = shown(row.y1938.total);
    const m = shown(row.today!.total);
    expect(value(readout.querySelector('button.num[data-source="readout-1938"]')!)).toBe(n);
    expect(value(readout.querySelector('button.num[data-source="readout-today"]')!)).toBe(m);
    expect(text(readout)).toBe(`At ${label12(row.t)}: trolley ${n} min, today's bus ${m} min.`);
    expect(document.querySelector('.takeaway')).not.toBeNull();
    expect(document.querySelector('.takeaway .takeaway-most')).toBeNull();
    expect(document.querySelectorAll('.takeaway .takeaway-row')).toHaveLength(3);
    expect(text(document.getElementById('race-caption'))).toBe(C.captionText({ kind: 'both-arrived' }));
  });

  it('shows the sentence on a row with the stored flag true, and a readout inside the before-table run follows its row', async () => {
    const row = rows.find((r) => r.before_table && r.today && r.wait_most)!;
    expect(row).toBeDefined();
    await at(row.t);
    expect(clockOf(minutesOf(row.t))).toBe(row.t);
    expect(text(document.querySelector('.takeaway .takeaway-most'))).toBe(C.TAKEAWAY_MOST);
    const readout = document.querySelector('.chart-readout')!;
    expect(value(readout.querySelector('button.num[data-source="readout-1938"]')!)).toBe(shown(row.y1938.total));
    expect(value(readout.querySelector('button.num[data-source="readout-today"]')!)).toBe(shown(row.today!.total));
  });
});
