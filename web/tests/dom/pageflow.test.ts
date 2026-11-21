// Task 14.2: the phone reading order and page flow (story-layer Req 12.1, 12.2, 12.4, 16.12).
// The order is read from the real DOM the app builds from index.html; the fixed and sticky scan reads
// the real stylesheets. Pixel geometry runs in task 20.
import { afterEach, describe, expect, it } from 'vitest';
import { PHONE_INTRO } from '../../src/copy/copy';
import type { Layout } from '../../src/view/vehicles';
import { listRepoFiles, readRepoText } from '../support/files';
import { bootPage } from '../support/page';
import { text } from '../support/render';

const settle = async (): Promise<void> => {
  for (let k = 0; k < 5; k += 1) await new Promise((done) => setTimeout(done, 0));
};

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
});

/** Race column content, in Req 12.2 order, from the pair names down. */
const FROM_PAIR_DOWN: [name: string, selector: string][] = [
  ['pair names', '#pair-names'],
  ['swap button', '[data-action="swap"]'],
  ['example label', '.example-label'],
  ['start time', '.slider-time'],
  ['slider', '.slider-row'],
  ['schedule line', '.schedule'],
  ['notices', '.notices'],
  ['lanes', '.lanes'],
  ['caption area', '#race-caption'],
  ['result box', '.result'],
  ['honest line', '.honest'],
  ['takeaway', '.takeaway'],
  ['next-step actions', '.next-steps'],
  ['start-time chart', '.chart'],
  ['departures section', '.departures'],
  ['Sources', '[data-action="sources"]'],
  ['Share this race', '[data-action="share"]'],
  ['About and credits', '[data-action="about"]'],
];

const PHONE_ONLY_ABOVE: [name: string, selector: string][] = [
  ['top bar', '#topbar'],
  ['intro line', '#intro-line'],
  ['route area', '#map-area'],
];

function find(selector: string): Element {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`nothing matches ${selector}`);
  return el;
}

/** Each element comes strictly after the one before it in document order. */
function expectOrder(list: [string, string][]): void {
  let before: [string, Element] | null = null;
  for (const [name, selector] of list) {
    const el = find(selector);
    if (before) {
      const follows = Boolean(before[1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
      expect(follows, `${name} follows ${before[0]}`).toBe(true);
    }
    before = [name, el];
  }
}

/** A finished guided race with the today-win notice showing, so every part of the flow is on the page. */
async function bootFull(layout: Layout) {
  const app = await bootPage({ layout, motion: 'reduced' });
  app.store.dispatch({ type: 'todaywin/select' });
  await settle();
  return app;
}

describe('page order (Req 12.2, 12.4)', () => {
  it('phone: top bar, intro line, route area, then the race column down to About and credits', async () => {
    await bootFull('phone');
    expectOrder([...PHONE_ONLY_ABOVE, ...FROM_PAIR_DOWN]);
  });

  it('phone: the notices block is the schedule line\'s next sibling and the lanes follow it', async () => {
    await bootFull('phone');
    const schedule = find('.schedule');
    const notices = find('.notices');
    expect(schedule.nextElementSibling).toBe(notices);
    expect(notices.nextElementSibling).toBe(find('.lanes'));
    expect(notices.querySelector('[data-notice="today-win"]')).not.toBeNull();
  });

  it('desktop: the same order from the pair names down', async () => {
    await bootFull('desktop');
    expectOrder(FROM_PAIR_DOWN);
    expect(find('.schedule').nextElementSibling).toBe(find('.notices'));
  });

  it('desktop: the intro line is in the page but its stylesheet hides it from 900 px up', () => {
    const css = readRepoText('web/src/styles/layout-desktop.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(/@media \(min-width: 900px\)/.test(css)).toBe(true);
    expect(/\.intro-line\s*\{[^}]*display:\s*none/.test(css)).toBe(true);
  });
});

describe('the intro line (Req 12.2)', () => {
  it('holds the copy.ts constant, before and after the app boots, and sits in the main landmark', async () => {
    await bootPage({ layout: 'phone', motion: 'reduced' });
    const intro = find('#intro-line');
    expect(text(intro)).toBe(PHONE_INTRO);
    expect(intro.closest('main')).not.toBeNull();
  });

  it('index.html carries the same text', () => {
    const doc = new DOMParser().parseFromString(readRepoText('web/index.html'), 'text/html');
    expect(text(doc.getElementById('intro-line'))).toBe(PHONE_INTRO);
  });
});

/** The CSS rules in force on a phone: those outside any `@media (min-width: 900px)` block. */
function phoneRules(css: string): { selector: string; body: string }[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: { selector: string; body: string }[] = [];
  const walk = (from: number, to: number): void => {
    let at = from;
    while (at < to) {
      const open = src.indexOf('{', at);
      if (open === -1 || open >= to) return;
      let depth = 1;
      let close = open + 1;
      while (depth > 0 && close < to) {
        if (src[close] === '{') depth += 1;
        else if (src[close] === '}') depth -= 1;
        close += 1;
      }
      const head = src.slice(at, open).trim();
      if (head.startsWith('@')) {
        if (!/min-width:\s*900px/.test(head)) walk(open + 1, close - 1);
      } else {
        out.push({ selector: head, body: src.slice(open + 1, close - 1) });
      }
      at = close;
    }
  };
  walk(0, src.length);
  return out;
}

describe('no fixed or sticky element on a phone with no sheet and no banner (Req 12.1, 16.12)', () => {
  const OVERLAYS = ['.scrim', '.sheet', '.banner-root'];
  const files = listRepoFiles('web/src/styles').filter((f) => f.endsWith('.css'));
  const rules = files.flatMap((f) => phoneRules(readRepoText(f)).map((r) => ({ ...r, file: f })));
  const positioned = rules.filter((r) => /position:\s*(fixed|sticky)/.test(r.body));

  it('finds the stylesheets and the overlay rules it expects', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(positioned.length).toBeGreaterThan(0);
  });

  it('only the overlays are fixed, and nothing is sticky', () => {
    expect(positioned.map((r) => r.selector).sort()).toEqual([...OVERLAYS].sort());
    expect(rules.filter((r) => /position:\s*sticky/.test(r.body))).toEqual([]);
  });

  it('the scrim is display: none unless it is open', () => {
    const scrim = rules.filter((r) => r.selector === '.scrim');
    expect(scrim).toHaveLength(1);
    expect(/display:\s*none/.test(scrim[0]!.body)).toBe(true);
    const shown = rules.filter((r) => /(^|,)\s*\.scrim\b/.test(r.selector) && /display:\s*[a-z]/.test(r.body) && !/display:\s*none/.test(r.body));
    expect(shown.map((r) => r.selector)).toEqual(['.scrim.is-open']);
  });

  it('the page has no sheet, no banner and no open scrim, and the banner root is empty', async () => {
    await bootPage({ layout: 'phone', motion: 'reduced' });
    expect(document.querySelector('.sheet')).toBeNull();
    expect(document.querySelector('.banner')).toBeNull();
    expect(find('#banner-root').childElementCount).toBe(0);
    expect(find('#scrim').classList.contains('is-open')).toBe(false);
    expect(document.querySelector('#sheet-root')?.childElementCount).toBe(0);
  });

  it('the race card does not pin its buttons or scroll inside itself', () => {
    const phone = rules.filter((r) => ['.card', '.card-scroll', '.card-buttons', '.card-footer'].includes(r.selector));
    for (const r of phone) {
      expect(r.body, r.selector).not.toMatch(/overflow(-y)?:\s*(auto|scroll)/);
      expect(r.body, r.selector).not.toMatch(/position:\s*(fixed|sticky)/);
    }
  });
});
