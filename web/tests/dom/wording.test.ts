// Task 19: the wording rules across the whole screen (R15, P5, P6, P13). Every
// state a test can reach (tests/support/states.ts), on both layouts, is scanned:
// its text, its accessible names and values, and its two status messages.
// 19.1: no banned word, apart from "Scheduled, not live." 19.2: every time
// carries "scheduled" in its line, label or accessible name; every walk says
// estimate; "citywide" never appears. 19.3: every count on screen is the one
// summary.json gives, and none of the real counts is typed into src/. 19.4:
// every minute string takes the singular for 1.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TIMINGS } from '../../src/config';
import { pairKey } from '../../src/data/files';
import type { Summary } from '../../src/data/types';
import { formatCount } from '../../src/format/count';
import { clockOf } from '../../src/format/time';
import { buildView } from '../../src/state/derive';
import { bannedTerms } from '../support/banned';
import { listRepoFiles, readRepoText } from '../support/files';
import { bootPage } from '../support/page';
import { readData, realData } from '../support/realdata';
import { renderAt, text, value } from '../support/render';
import { STATES, click, settle, westToPreston } from '../support/states';
import { fakeTime } from '../support/time';
import { minuteWordProblems } from '../support/words';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.documentElement.className = '';
  window.history.replaceState(null, '', '/');
});

/** The attributes that hold words a visitor hears or reads. */
const SPOKEN = ['aria-label', 'aria-valuetext', 'aria-description', 'title', 'alt', 'placeholder'] as const;

/** One thing the page says: a run of text with the element it sits in, or an attribute's words. */
type Said = { text: string; el: Element; attribute: string | null };

/** Everything the page says: each element's own text, each spoken attribute, and the page title. */
function everythingSaid(root: ParentNode = document.body): Said[] {
  const out: Said[] = [];
  const all = root instanceof Element ? [root, ...root.querySelectorAll('*')] : [...root.querySelectorAll('*')];
  for (const el of all) {
    if (el.closest('script, style')) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
    if (own.length > 0) out.push({ text: (el.textContent ?? '').replace(/\s+/g, ' '), el, attribute: null });
    for (const name of SPOKEN) {
      const words = el.getAttribute(name);
      if (words) out.push({ text: words, el, attribute: name });
    }
  }
  if (root === document.body) out.push({ text: document.title, el: document.documentElement, attribute: 'title' });
  return out;
}

const CLOCK = /\b\d{1,2}:\d{2}\b/;
const WALK_TIME = /\bwalk\w*\b[^.]*?\b\d+ ?(min|minutes?)\b|\b\d+ ?(min|minutes?)\b[^.]*?\bwalk/i;

/** The line a run of text belongs to, for the time rule: a list row, the slider or a board row, else its own block. */
function lineOf(el: Element): Element {
  return el.closest('li, .slider-row, .start-row, .board-row, [role="status"], .banner') ?? el.closest('p, h1, h2, h3, button, output, div') ?? el;
}

/** The phrase a walk word belongs to: a legend item, a list row, else its own block. */
function phraseOf(el: Element): Element {
  return el.closest('.legend-item') ?? el.closest('li') ?? el.closest('p, h1, h2, h3, button, div') ?? el;
}

/** Whether `unit` says `word`: in its text, in a spoken attribute inside it, or in the label of the button around `el`. */
function says(unit: Element, el: Element, word: RegExp): boolean {
  if (word.test(unit.textContent ?? '')) return true;
  const labelled = [unit, ...unit.querySelectorAll('*')].some((e) => SPOKEN.some((name) => word.test(e.getAttribute(name) ?? '')));
  return labelled || word.test(el.closest('button')?.getAttribute('aria-label') ?? '');
}

/**
 * Label in name (WCAG 2.5.3, Emmanuel, Nov 20): a button or link that prints
 * text has an accessible name that holds it, and a number button's name starts
 * with it ("6 min, scheduled 1938 wait. Show source.").
 */
function labelBreaks(root: ParentNode): string[] {
  const found: string[] = [];
  const norm = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();
  for (const el of root.querySelectorAll('button[aria-label], a[aria-label]')) {
    const shown = norm(el.textContent ?? '');
    const name = norm(el.getAttribute('aria-label') ?? '');
    // Symbols and single characters used as icons (plus, minus, swap, the italic "i") are not text, as in axe's own rule.
    if (shown.length < 2 || !/[\p{L}\p{N}]/u.test(shown)) continue;
    // Whole words, as speech and axe match them: "6 min" is not in "6 minutes".
    const escaped = shown.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const asWords = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u');
    if (!asWords.test(name)) found.push(`a name without its visible text: "${el.textContent}" named "${el.getAttribute('aria-label')}"`);
    else if (el.matches('button.num') && !name.startsWith(`${shown},`)) {
      found.push(`a number button whose name does not start with its text: "${el.textContent}" named "${el.getAttribute('aria-label')}"`);
    }
  }
  return found;
}

/** The rule breaks on the page as it stands, one line each. */
function breaks(root: ParentNode = document.body): string[] {
  const found: string[] = labelBreaks(root);
  const where = (s: Said): string => `${s.attribute ? `[${s.attribute}] ` : ''}"${s.text.trim()}"`;
  for (const s of everythingSaid(root)) {
    for (const term of bannedTerms(s.text)) found.push(`banned word "${term}": ${where(s)}`);
    if (/citywide/i.test(s.text)) found.push(`"citywide": ${where(s)}`);
    for (const problem of minuteWordProblems(s.text)) found.push(`minute word ${problem}: ${where(s)}`);
    // Times and walks: an attribute must say it itself; text, in its line or phrase.
    if (CLOCK.test(s.text)) {
      const ok = s.attribute ? /scheduled/i.test(s.text) : says(lineOf(s.el), s.el, /scheduled/i);
      if (!ok) found.push(`a time without "scheduled": ${where(s)}`);
    }
    // A walk time is a walk word and a number of minutes in one sentence ("Walk 2 min", "45 min, walking
    // included"); a sentence that names the walk and gives no time ("arriving after the walk") states none.
    if (WALK_TIME.test(s.text)) {
      const ok = s.attribute ? /estimat/i.test(s.text) : says(phraseOf(s.el), s.el, /estimat/i);
      if (!ok) found.push(`a walk without "estimate": ${where(s)}`);
    }
  }
  return [...new Set(found)];
}

describe('the wording rules on every state (19.1, 19.2, 19.4)', () => {
  for (const layout of ['phone', 'desktop'] as const) {
    for (const [name, reach] of STATES) {
      it(`${name} (${layout})`, async () => {
        const time = await reach(layout);
        // Let a pending announcement land, so the status message is scanned too.
        time?.advance(TIMINGS.racePauseMs + 100);
        expect(everythingSaid().length).toBeGreaterThan(5);
        expect(breaks()).toEqual([]);
      });
    }
  }

  it('scans the status messages: the race announcement and "Link copied"', async () => {
    const time = fakeTime();
    await bootPage({ motion: 'reduced', time, share: { writeText: async () => {} } });
    time.advance(TIMINGS.racePauseMs + 100);
    click('[data-action="share"]');
    await settle();
    const regions = everythingSaid().filter((s) => s.el.closest('[role="status"]'));
    expect(regions.map((s) => s.el.closest('[role="status"]')!.id).sort()).toEqual(['result-status', 'share-status']);
    expect(breaks()).toEqual([]);
  });

  it('would catch each kind of break', async () => {
    await bootPage({ motion: 'reduced' });
    const scroll = document.getElementById('card-scroll')!;
    const add = (html: string): void => scroll.insertAdjacentHTML('beforeend', html);
    add('<p>Arriving now at the corner</p>');
    add('<p>Next car 10:06</p>');
    add('<p><span class="legend-item">Walk 2 min</span></p>');
    add('<p>Faster citywide</p>');
    add('<p>Wins by 1 minutes</p>');
    add('<button aria-label="10:06, 1938 car. Show source.">10:06</button>');
    add('<button class="num" aria-label="6 minutes, scheduled 1938 wait. Show source.">6 min</button>');
    add('<button class="num" aria-label="Scheduled 1938 wait, 6 min. Show source.">6 min</button>');
    const found = breaks();
    for (const kind of [
      'banned word "Arriving now"',
      'a time without "scheduled": "Next car 10:06"',
      'a walk without "estimate"',
      '"citywide"',
      'minute word',
      '[aria-label] "10:06, 1938 car. Show source."',
      'a name without its visible text: "6 min" named "6 minutes, scheduled',
      'a number button whose name does not start with its text: "6 min" named "Scheduled 1938 wait',
    ]) {
      expect(found.some((f) => f.includes(kind)), kind).toBe(true);
    }
  });
});

describe('the minute-word check itself', () => {
  it('takes "minute" exactly for one, a decimal one included, and never "1 minutes"', () => {
    for (const ok of ['1 minute', '2 minutes', '0 minutes', 'under 1.0 minute', '1.5 minutes', 'Trolley 1 min', 'every 7 or 8 min']) {
      expect(minuteWordProblems(ok), ok).toEqual([]);
    }
    for (const bad of ['1 minutes', '2 minute', '0 minute', '1.5 minute', '2.0 minute']) expect(minuteWordProblems(bad), bad).not.toEqual([]);
  });
});

describe('the singular for 1 with the real data (19.4, P13)', () => {
  const data = realData();

  /** Real rows whose shown numbers include a 1: a margin, a total or a part. */
  function rowsWithOne(): { pair: { origin: string; dest: string }; t: string }[] {
    const picked = new Map<string, { pair: { origin: string; dest: string }; t: string }>();
    for (const pair of data.index.pairs) {
      const race = data.races.get(pairKey(pair))!;
      for (const row of race.races) {
        const view = buildView(data.index, data.summary, race, row.t);
        const lanes = [view.lane1938, ...(view.laneToday ? [view.laneToday] : [])];
        const rv = view.resultView;
        const margin = rv.kind === '1938' || rv.kind === 'today' ? rv.shownMargin : null;
        const kinds = [
          margin === 1 ? `margin ${rv.kind}` : null,
          ...lanes.flatMap((l) => l.phases.filter((p) => p.shown === 1).map((p) => `${l.side} ${p.kind}`)),
        ].filter((k): k is string => k !== null);
        for (const kind of kinds) if (!picked.has(kind)) picked.set(kind, { pair, t: row.t });
      }
    }
    return [...picked.values()];
  }

  it('reads "1 minute" wherever a shown 1 meets the word, on the card and in its Sources rows', async () => {
    const rows = rowsWithOne();
    expect(rows.length).toBeGreaterThan(0);
    let ones = 0;
    for (const { pair, t } of rows) {
      for (const layout of ['phone', 'desktop'] as const) {
        const card = renderAt(data, pair, t, layout).root;
        expect(breaks(card), `${pairKey(pair)} ${t} ${layout}`).toEqual([]);
        ones += everythingSaid(card).filter((s) => /\b1 minute\b/.test(s.text)).length;
      }
      // The same row on the page, with every number's Sources row open.
      await bootPage({ motion: 'reduced', query: `?from=${pair.origin}&to=${pair.dest}`, now: new Date(`${data.index.service_date}T${t}:00-05:00`) });
      expect(clockOf(Number(document.querySelector<HTMLInputElement>('#start-time')!.value))).toBe(t);
      click('[data-action="sources"]');
      expect(breaks(), `${pairKey(pair)} ${t} Sources`).toEqual([]);
      ones += everythingSaid().filter((s) => /\b1 minute\b/.test(s.text)).length;
      document.body.innerHTML = '';
    }
    // The singular is really there to be read.
    expect(ones).toBeGreaterThan(0);
  });
});

// ---- 19.3: counts ------------------------------------------------------------------

const real = readData<Summary>('summary.json');

/** The count number buttons and the summary.json value each one shows (state/specs.ts names them). */
const COUNTS: Record<string, (s: Summary) => number> = {
  'count-wins-1938': (s) => s.wins_1938,
  'count-wins-today': (s) => s.wins_today,
  'count-races': (s) => s.races,
  'count-ride-same': (s) => s.ride_same,
  'count-pairs': (s) => s.pairs.length,
  'count-ride-faster': (s) => s.ride_faster_today,
  'count-ride-slower': (s) => s.ride_slower_today,
};

/** A summary.json with every count changed, each to a number the real file does not hold. */
function otherSummary(): Summary {
  return {
    ...real,
    races: 4321,
    wins_1938: 1234,
    wins_today: 77,
    photo_finishes: 66,
    ride_same: 8,
    ride_faster_today: 6,
    ride_slower_today: 4,
    pairs_without_one_seat_ride: 2,
    today_wins: real.today_wins.slice(0, 5),
    pairs: real.pairs.slice(0, 18),
  };
}

/** Every count button on the page, by source id, with the number it shows. */
function countsShown(): Map<string, number[]> {
  const shown = new Map<string, number[]>();
  for (const b of document.querySelectorAll<HTMLElement>('button.num[data-source^="count-"]')) {
    const id = b.dataset['source']!;
    shown.set(id, [...(shown.get(id) ?? []), value(b)]);
  }
  return shown;
}

describe('every count on screen comes from summary.json (19.3, P5, R15.4)', () => {
  for (const [name, options] of [
    ['a 1938 win', {}],
    ['a today win', { query: `?from=${westToPreston.origin}&to=${westToPreston.dest}`, now: new Date(`${realData().index.service_date}T11:23:00-05:00`) }],
  ] as const) {
    it(`shows the other file's counts, everywhere they appear, and none of the real ones (${name})`, async () => {
      const other = otherSummary();
      await bootPage({ motion: 'reduced', override: { 'summary.json': other }, ...options });
      const seen = new Map<string, number[]>();
      const look = (): void => countsShown().forEach((v, id) => seen.set(id, [...(seen.get(id) ?? []), ...v]));
      look();
      click('#card-scroll [data-action="whentoday"]');
      look();
      expect(document.querySelectorAll('.sheet.is-open .today-win')).toHaveLength(other.today_wins.length);
      // Each count's Sources row opens with the same number.
      for (const id of Object.keys(COUNTS)) {
        const b = document.querySelector<HTMLElement>(`.sheet.is-open button.num[data-source="${id}"], #card-scroll button.num[data-source="${id}"]`);
        if (!b) continue;
        b.click();
        const row = document.querySelector(`.sheet.is-open .source-row[data-source="${id}"] .source-value`);
        expect(text(row), id).toBe(formatCount(COUNTS[id]!(other)));
        document.body.innerHTML = '';
        await bootPage({ motion: 'reduced', override: { 'summary.json': other }, ...options });
        click('#card-scroll [data-action="whentoday"]');
      }
      // Every count the screen can show was seen, each with the other file's number.
      expect([...seen.keys()].sort()).toEqual(Object.keys(COUNTS).sort());
      for (const [id, values] of seen) for (const v of values) expect(v, id).toBe(COUNTS[id]!(other));
      // None of the real file's large counts is anywhere on the page.
      const page = everythingSaid().map((s) => s.text).join(' ');
      for (const n of [real.races, real.wins_1938]) {
        expect(page).not.toContain(formatCount(n));
        expect(page).not.toMatch(new RegExp(`\\b${n}\\b`));
      }
    });
  }

  it('types none of the real counts into src/: no count of 100 or more, written plainly or with its comma', () => {
    // Smaller counts collide with layout and drawing constants (a 20 px gap, a 25 in a path), so they are
    // proven read at run time by the swap above instead.
    const counts = [real.races, real.wins_1938, real.wins_today, real.photo_finishes, real.ride_same, real.ride_faster_today, real.ride_slower_today, real.pairs_without_one_seat_ride, real.today_wins.length, real.pairs.length];
    const large = [...new Set(counts.filter((n) => n >= 100))];
    expect(large.length).toBeGreaterThan(0);
    const files = listRepoFiles('web/src');
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const source = readRepoText(file);
      for (const n of large) {
        const forms = [String(n), formatCount(n)].map((f) => f.replace(',', '\\,'));
        const hit = new RegExp(`(?<![\\d.,])(${forms.join('|')})(?![\\d.,]*\\d)`).exec(source);
        expect(hit?.[0] ?? null, `${file} holds the count ${n}`).toBeNull();
      }
    }
  });
});
