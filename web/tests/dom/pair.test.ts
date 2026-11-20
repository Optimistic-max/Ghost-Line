// Task 14: the corner picker, swap, the share link and the address bar (R4).
// 14.4: all 20 pairs by three taps; the picker by keyboard; swap; each share
// path; the address bar after every change; a shared link; each bad link of
// race-brief 5.9. Names and pairs are read from index.json.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEAD_PAIR, TIMINGS } from '../../src/config';
import * as C from '../../src/copy/copy';
import { cornerName } from '../../src/data/lookup';
import type { Pair } from '../../src/data/types';
import { encode } from '../../src/format/share';
import { type PageOptions, bootPage } from '../support/page';
import { realData, slugNamed } from '../support/realdata';
import { text } from '../support/render';
import { type FakeTime, fakeTime } from '../support/time';

const { index, summary } = realData();
const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
const name = (slug: string): string => cornerName(index, slug)!;
const sheet = (): HTMLElement | null => document.querySelector<HTMLElement>('.sheet:not([aria-hidden])');
const click = (selector: string): void => document.querySelector<HTMLElement>(selector)!.click();
const choices = (): HTMLButtonElement[] => [...sheet()!.querySelectorAll<HTMLButtonElement>('.corner-choice')];
const choose = (slug: string): void => click(`.sheet:not([aria-hidden]) .corner-choice[data-slug="${slug}"]`);
const settle = async (): Promise<void> => {
  for (let k = 0; k < 5; k += 1) await new Promise((done) => setTimeout(done, 0));
};
const banner = (): HTMLElement | null => document.querySelector<HTMLElement>('#banner-root .banner');

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
  window.history.replaceState(null, '', '/');
});

async function open(options: PageOptions = {}) {
  const time = options.time ?? fakeTime();
  const app = await bootPage({ motion: 'reduced', ...options, time });
  return { app, time };
}

describe('the corner picker (14.1)', () => {
  it('lists the five corners west to east, the inferred chip, the step line, the note and Cancel', async () => {
    await open();
    const pick = document.querySelector<HTMLElement>('[data-action="picker"]')!;
    expect(pick.getAttribute('aria-label')).toBe(C.PICKER_TITLE);
    pick.click();
    expect(sheet()!.dataset['sheet']).toBe('corners');
    expect(text(sheet()!.querySelector('.sheet-title'))).toBe(C.PICKER_TITLE);
    expect(text(sheet()!.querySelector('.picker-step'))).toBe(C.PICKER_STEP_START);
    expect(choices().map((b) => b.dataset['slug'])).toEqual(index.corners.map((c) => c.slug));
    // index.json lists the corners west to east: longitude grows along the list.
    const lons = index.corners.map((c) => c.lonlat[0]);
    expect([...lons].sort((a, b) => a - b)).toEqual(lons);
    const inferred = index.corners.find((c) => c.inferred)!;
    expect(choices().filter((b) => b.querySelector('.chip-inferred')).map((b) => b.dataset['slug'])).toEqual([inferred.slug]);
    expect(text(sheet()!.querySelector('.chip-inferred'))).toBe(C.INFERRED_TAG);
    expect(text(sheet()!.querySelector('.picker-note'))).toBe(C.pickerNote(inferred.name));
    expect(text(sheet()!.querySelector('[data-action="close-sheet"]'))).toBe(C.CANCEL);
    expect(choices().every((b) => !b.disabled)).toBe(true);
  });

  it('marks and disables the start in the second step, then sets the pair and closes', async () => {
    const { app } = await open();
    click('[data-action="picker"]');
    const [origin, dest] = [index.corners[0]!.slug, index.corners[1]!.slug];
    choose(origin);
    expect(text(sheet()!.querySelector('.picker-step'))).toBe(C.PICKER_STEP_END);
    const start = choices().find((b) => b.dataset['slug'] === origin)!;
    expect(start.disabled).toBe(true);
    expect(start.getAttribute('aria-pressed')).toBe('true');
    expect(start.classList.contains('is-start')).toBe(true);
    expect(text(start.querySelector('.start-tag'))).toBe(C.PICKER_START_TAG);
    expect(choices().filter((b) => b.disabled)).toHaveLength(1);
    // Focus moves to the first corner that can be chosen.
    expect(document.activeElement).toBe(choices().find((b) => !b.disabled));
    // Choosing the start again is not possible.
    start.click();
    expect(app.store.get().picker).toEqual({ step: 'end', start: origin });
    choose(dest);
    expect(app.store.get().sheet).toBeNull();
    expect(app.store.get().pair).toEqual({ origin, dest });
  });

  it('selects each of the 20 pairs in three taps', async () => {
    const { app } = await open();
    expect(index.pairs).toHaveLength(20);
    for (const pair of index.pairs) {
      let taps = 0;
      const tap = (selector: string): void => {
        taps += 1;
        click(selector);
      };
      tap('[data-action="picker"]');
      tap(`.sheet:not([aria-hidden]) .corner-choice[data-slug="${pair.origin}"]`);
      tap(`.sheet:not([aria-hidden]) .corner-choice[data-slug="${pair.dest}"]`);
      expect(taps).toBe(3);
      expect(app.store.get().pair, `${pair.origin} → ${pair.dest}`).toEqual(pair);
      await settle();
      expect(text(document.getElementById('origin-name'))).toBe(name(pair.origin));
      expect(text(document.getElementById('dest-name'))).toBe(name(pair.dest));
    }
  });

  it('works by keyboard: native buttons, the start out of the Tab order in step two, Escape cancels', async () => {
    const { app } = await open();
    const pick = document.querySelector<HTMLElement>('[data-action="picker"]')!;
    pick.focus();
    pick.click();
    expect(choices().every((b) => b.tagName === 'BUTTON' && b.type === 'button')).toBe(true);
    choose(index.corners[2]!.slug);
    // The disabled start cannot take focus; every other corner and Cancel can.
    const focusable = [...sheet()!.querySelectorAll<HTMLElement>('button:not([disabled])')];
    expect(focusable.map((b) => b.dataset['slug'] ?? b.dataset['action'])).toEqual([
      ...index.corners.filter((_, k) => k !== 2).map((c) => c.slug),
      'close-sheet',
    ]);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(app.store.get().sheet).toBeNull();
    expect(app.store.get().picker).toBeNull();
    expect(app.store.get().pair).toEqual(lead);
    expect(document.activeElement?.getAttribute('data-action')).toBe('picker');
  });

  it('Cancel leaves the pair as it was', async () => {
    const { app } = await open();
    click('[data-action="picker"]');
    choose(index.corners[0]!.slug);
    click('.sheet:not([aria-hidden]) [data-action="close-sheet"]');
    expect(app.store.get().pair).toEqual(lead);
    expect(window.location.search).toBe('');
  });
});

describe('swap and the address bar (14.2)', () => {
  it('reverses the pair, keeps the minute, loads the race file and updates the address bar', async () => {
    const { app } = await open();
    const minute = app.store.get().minute;
    click('[data-action="swap"]');
    const swapped = { origin: lead.dest, dest: lead.origin };
    expect(app.store.get().pair).toEqual(swapped);
    expect(app.store.get().minute).toBe(minute);
    expect(window.location.search).toBe(encode(swapped));
    await settle();
    expect(text(document.getElementById('origin-name'))).toBe(name(lead.dest));
    const state = app.store.get();
    expect(state.data.status === 'ready' && state.data.races.has(`${lead.dest}__${lead.origin}`)).toBe(true);
  });

  it('follows every pair change, query only, with no history entry, and never a time', async () => {
    const { app } = await open();
    const length = window.history.length;
    const steps: [string, () => void][] = [
      ['picker', () => {
        click('[data-action="picker"]');
        choose(index.corners[0]!.slug);
        choose(index.corners[3]!.slug);
      }],
      ['swap', () => click('[data-action="swap"]')],
      ['today wins entry', () => {
        click('#card-scroll [data-action="whentoday"]');
        click('.sheet:not([aria-hidden]) [data-action="today-win"][data-index="0"]');
      }],
    ];
    for (const [how, step] of steps) {
      step();
      await settle();
      expect(window.location.search, how).toBe(encode(app.store.get().pair));
      expect(window.location.search, how).not.toMatch(/\d/);
    }
    expect(app.store.get().pair).toEqual({ origin: summary.today_wins[0]!.origin, dest: summary.today_wins[0]!.dest });
    // Moving the slider never touches the address.
    const before = window.location.search;
    click('[data-action="plus"]');
    expect(window.location.search).toBe(before);
    expect(window.history.length).toBe(length);
  });
});

describe('share this race (14.3)', () => {
  const link = (pair: Pair): string => `${window.location.origin}${window.location.pathname}${encode(pair)}`;
  const shareButton = (): HTMLElement => document.querySelector<HTMLElement>('[data-action="share"]')!;
  const status = (): string => text(document.getElementById('share-status'));

  it('uses the share sheet with the link only when the browser has one', async () => {
    const share = vi.fn(async () => {});
    const writeText = vi.fn(async () => {});
    await open({ share: { share, writeText } });
    shareButton().click();
    await settle();
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ url: link(lead) });
    expect(writeText).not.toHaveBeenCalled();
    expect(text(shareButton())).toBe(C.SHARE_THIS_RACE);
    expect(status()).toBe('');
  });

  it('does nothing more when the visitor cancels the share sheet', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('cancelled', 'AbortError');
    });
    const writeText = vi.fn(async () => {});
    await open({ share: { share, writeText } });
    shareButton().click();
    await settle();
    expect(writeText).not.toHaveBeenCalled();
    expect(text(shareButton())).toBe(C.SHARE_THIS_RACE);
  });

  it('copies the link when sharing fails, says "Link copied" for 2 s on the button and in its own region', async () => {
    const time = fakeTime();
    const share = vi.fn(async () => {
      throw new Error('not allowed');
    });
    const writeText = vi.fn(async () => {});
    await open({ time, share: { share, writeText } });
    shareButton().click();
    await settle();
    expect(writeText).toHaveBeenCalledWith(link(lead));
    expect(text(shareButton())).toBe(C.LINK_COPIED);
    expect(status()).toBe(C.LINK_COPIED);
    expect(text(document.getElementById('result-status'))).not.toContain(C.LINK_COPIED);
    time.advance(TIMINGS.linkCopiedMs - 1);
    expect(text(shareButton())).toBe(C.LINK_COPIED);
    time.advance(1);
    expect(text(shareButton())).toBe(C.SHARE_THIS_RACE);
    expect(status()).toBe('');
  });

  it('falls back to the text area when there is no clipboard', async () => {
    const byCommand = vi.fn(() => true);
    await open({ share: { copyByCommand: byCommand } });
    shareButton().click();
    await settle();
    expect(byCommand).toHaveBeenCalledWith(link(lead));
    expect(text(shareButton())).toBe(C.LINK_COPIED);
  });

  it('changes nothing when the clipboard and the text area both fail', async () => {
    const byCommand = vi.fn(() => false);
    await open({ share: { writeText: async () => Promise.reject(new Error('denied')), copyByCommand: byCommand } });
    shareButton().click();
    await settle();
    expect(byCommand).toHaveBeenCalled();
    expect(text(shareButton())).toBe(C.SHARE_THIS_RACE);
    expect(status()).toBe('');
  });
});

describe('links (14.2, race-brief 5.9)', () => {
  async function opened(query: string, time: FakeTime = fakeTime()) {
    const { app } = await open({ query, time });
    return { app, time };
  }

  it('opens a shared link\'s pair with the banner naming it, for 5 s', async () => {
    const pair = { origin: slugNamed('Westwood & Carey'), dest: slugNamed('Dolphin & Myrtle') };
    const { app, time } = await opened(encode(pair));
    expect(app.store.get().pair).toEqual(pair);
    expect(text(banner())).toBe(C.sharedRace(name(pair.origin), name(pair.dest)));
    expect(banner()!.getAttribute('role')).toBe('status');
    expect(banner()!.classList.contains('is-open')).toBe(true);
    time.advance(TIMINGS.bannerSlideMs + TIMINGS.bannerHoldMs - 1);
    expect(banner()!.classList.contains('is-open')).toBe(true);
    time.advance(1);
    expect(banner()!.classList.contains('is-open')).toBe(false);
    time.advance(TIMINGS.bannerSlideMs);
    expect(banner()).toBeNull();
  });

  it('opens the lead pair at 5.9 case 5 with the shared banner, and with no banner and no query (case 8)', async () => {
    const { app } = await opened(encode(lead));
    expect(app.store.get().pair).toEqual(lead);
    expect(text(banner())).toBe(C.sharedRace(name(lead.origin), name(lead.dest)));
    const plain = await opened('');
    expect(plain.app.store.get().pair).toEqual(lead);
    expect(banner()).toBeNull();
  });

  const bad: [string, string][] = [
    ['case 6: the same corner twice', `?from=${lead.origin}&to=${lead.origin}`],
    ['case 7: an unknown corner', `?from=nowhere&to=${lead.dest}`],
    ['a repeated parameter', `?from=${lead.origin}&from=${lead.dest}&to=${lead.dest}`],
    ['a missing destination', `?from=${slugNamed('Westwood & Carey')}`],
    ['a slug that is not slug-shaped', '?from=..%2Fsecret&to=aliceanna-bond'],
  ];
  for (const [label, query] of bad) {
    it(`falls back to the lead pair with the bad-link banner and races it: ${label}`, async () => {
      const { app } = await opened(query);
      expect(app.store.get().pair).toEqual(lead);
      expect(app.store.get().data.status).toBe('ready');
      expect(text(banner())).toBe(C.badLink(name(lead.origin), name(lead.dest)));
      expect(document.querySelector('.result')).not.toBeNull();
    });
  }

  it('ignores any other parameter, such as a tracking tag', async () => {
    const pair = { origin: slugNamed('Westwood & Carey'), dest: slugNamed('Dolphin & Myrtle') };
    const { app } = await opened(`${encode(pair)}&utm_source=social`);
    expect(app.store.get().pair).toEqual(pair);
    expect(text(banner())).toBe(C.sharedRace(name(pair.origin), name(pair.dest)));
  });
});
