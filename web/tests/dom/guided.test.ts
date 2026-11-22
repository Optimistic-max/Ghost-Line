// Task 5.3: the guided first visit and the orientation pause (story-layer Req 3, Req 4, Req 16.2, 16.3).
// Real files, the page's own fake time source. Captions proper are task 7: here only the caption element
// and the orientation line are asserted. Departures and route toggles do not exist yet (tasks 13, 15).
import { afterEach, describe, expect, it } from 'vitest';
import { EXAMPLE_START, LEAD_PAIR, TIMINGS } from '../../src/config';
import * as C from '../../src/copy/copy';
import { cornerName } from '../../src/data/lookup';
import type { Pair } from '../../src/data/types';
import { label12, minutesOf } from '../../src/format/time';
import { type PageOptions, bootPage } from '../support/page';
import { realData } from '../support/realdata';
import { text } from '../support/render';
import { type FakeTime, fakeTime } from '../support/time';

const { index } = realData();
const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
const other = index.pairs.find((p) => p.origin !== lead.origin || p.dest !== lead.dest)!;
const name = (slug: string): string => cornerName(index, slug)!;
const query = (p: Pair): string => `?from=${p.origin}&to=${p.dest}`;
const newYork = (hhmm: string): Date => new Date(`${index.service_date}T${hhmm}:00-05:00`);
const exampleStart = minutesOf(EXAMPLE_START);

const caption = (): HTMLElement | null => document.getElementById('race-caption');
const exampleLabel = (): HTMLElement | null => document.querySelector<HTMLElement>('.example-label');
const prompt = (): HTMLElement | null => document.querySelector<HTMLElement>('.chart-prompt');
const banner = (): HTMLElement | null => document.querySelector<HTMLElement>('#banner-root .banner');
const click = (selector: string): void => document.querySelector<HTMLElement>(selector)!.click();
const settle = async (): Promise<void> => {
  for (let k = 0; k < 5; k += 1) await new Promise((done) => setTimeout(done, 0));
};

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
  window.history.replaceState(null, '', '/');
});

async function open(options: PageOptions = {}) {
  const time: FakeTime = options.time ?? fakeTime();
  const app = await bootPage({ ...options, time });
  return { app, time };
}

const guidedPartsShown = (): boolean => exampleLabel() !== null || prompt() !== null || text(caption()) === C.ORIENTATION_LINE;

describe('the three ways in (16.2)', () => {
  it('no query: the lead pair at the example start, the example label, the prompt heading, no banner', async () => {
    const { app } = await open();
    const state = app.store.get();
    expect(state.pair).toEqual(lead);
    expect(state.guided).toBe(true);
    expect(state.minute).toBe(exampleStart);
    expect(state.minuteFromClock).toBe(false);
    expect(text(exampleLabel())).toBe(C.exampleLabel(label12(EXAMPLE_START)));
    expect(exampleLabel()!.querySelector('button')).toBeNull();
    expect(text(prompt())).toBe(C.CHART_PROMPT_HEADING);
    expect(banner()).toBeNull();
    expect(text(document.querySelector('.schedule'))).not.toContain(C.START_IS_NOW);
  });

  it('bad link: the lead pair at the example start with the example label and the bad-link banner', async () => {
    const { app } = await open({ query: '?from=nowhere&to=preston-caroline', now: newYork('11:23') });
    const state = app.store.get();
    expect(state.pair).toEqual(lead);
    expect(state.guided).toBe(true);
    expect(state.minute).toBe(exampleStart);
    expect(text(exampleLabel())).toBe(C.exampleLabel(label12(EXAMPLE_START)));
    expect(text(prompt())).toBe(C.CHART_PROMPT_HEADING);
    expect(text(banner())).toBe(C.badLink(name(lead.origin), name(lead.dest)));
  });

  it('valid link with a fixed clock: that pair at the clock time, no example label, no orientation line', async () => {
    const { app, time } = await open({ query: query(other), now: newYork('11:23') });
    const state = app.store.get();
    expect(state.pair).toEqual(other);
    expect(state.guided).toBe(false);
    expect(state.minute).toBe(minutesOf('11:23'));
    expect(state.minuteFromClock).toBe(true);
    expect(guidedPartsShown()).toBe(false);
    expect(caption()).not.toBeNull();
    expect(text(document.querySelector('.schedule'))).toContain(C.START_IS_NOW);
    // The ordinary 300 ms start pause, not the orientation pause.
    time.advance(TIMINGS.racePauseMs);
    expect(app.store.get().race.phase).toBe('running');
  });
});

describe('the orientation pause (Req 4)', () => {
  it('sets the race-start mark before the pause begins, with the orientation line in the caption area', async () => {
    const { app, time } = await open();
    expect(time.marks).toEqual(['race-start']);
    expect(time.current()).toBe(0);
    expect(app.store.get().race.phase).toBe('idle');
    expect(text(caption())).toBe(C.ORIENTATION_LINE);
    expect(document.querySelector('.clock-row')).not.toBeNull();
    expect(document.querySelector('.skip')).not.toBeNull();
  });

  it('waits 2,000 ms, then starts the clock and replaces the orientation line', async () => {
    const { app, time } = await open();
    time.advance(TIMINGS.orientationMs - 1);
    expect(app.store.get().race.phase).toBe('idle');
    expect(app.store.get().oriented).toBe(false);
    expect(text(caption())).toBe(C.ORIENTATION_LINE);
    expect(time.frameCount()).toBe(0);
    time.advance(1);
    expect(app.store.get().race.phase).toBe('running');
    expect(app.store.get().oriented).toBe(true);
    expect(text(caption())).not.toBe(C.ORIENTATION_LINE);
    time.advance(TIMINGS.racePauseMs);
    expect(time.frameCount()).toBeGreaterThan(0);
    // Starting the race is not a Visitor_Input: the label stays.
    expect(app.store.get().guided).toBe(true);
    expect(exampleLabel()).not.toBeNull();
    expect(time.marks).toEqual(['race-start']);
  });

  it('"Skip to result" during the pause ends it and shows the finished race', async () => {
    const { app, time } = await open();
    time.advance(500);
    click('[data-action="skip"]');
    const state = app.store.get();
    expect(state.race.phase).toBe('finished');
    expect(state.race.resultShown).toBe(true);
    expect(state.oriented).toBe(true);
    expect(document.querySelector('.result')).not.toBeNull();
    expect(document.querySelector('.clock-row')).toBeNull();
    // Skip is not a Visitor_Input.
    expect(state.guided).toBe(true);
    expect(time.pendingTimeouts()).toBeLessThanOrEqual(1);
    time.advance(TIMINGS.orientationMs);
    expect(app.store.get().race.phase).toBe('finished');
  });

  it('a Visitor_Input during the pause ends the pause; the next race starts after 300 ms', async () => {
    const { app, time } = await open();
    time.advance(500);
    const slider = document.querySelector<HTMLInputElement>('#start-time')!;
    slider.value = String(exampleStart + 7);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(app.store.get().guided).toBe(false);
    expect(app.store.get().minute).toBe(exampleStart + 7);
    expect(guidedPartsShown()).toBe(false);
    expect(app.store.get().race.phase).toBe('idle');
    time.advance(TIMINGS.racePauseMs - 1);
    expect(app.store.get().race.phase).toBe('idle');
    time.advance(1);
    expect(app.store.get().race.phase).toBe('running');
    // The old 2,000 ms start never fires a second race.
    time.advance(TIMINGS.orientationMs);
    expect(app.store.get().race.phase).not.toBe('idle');
  });

  it('reduced motion: no pause; the finished card keeps the orientation line while the visit is guided', async () => {
    const { app, time } = await open({ motion: 'reduced' });
    time.advance(TIMINGS.racePauseMs);
    const state = app.store.get();
    expect(state.race.phase).toBe('finished');
    expect(state.guided).toBe(true);
    expect(text(caption())).toBe(C.ORIENTATION_LINE);
    expect(exampleLabel()).not.toBeNull();
    expect(document.querySelector('.skip')).toBeNull();
    expect(time.frameCount()).toBe(0);
    expect(time.marks).toEqual(['race-start']);
    // No 2,000 ms start waits behind it (the one timer left is the map's idle load).
    time.advance(TIMINGS.orientationMs);
    expect(app.store.get().race.phase).toBe('finished');
    expect(text(caption())).toBe(C.ORIENTATION_LINE);
  });
});

describe('after a Visitor_Input the Guided_Parts are gone and stay gone (16.3)', () => {
  const inputs: [string, (app: Awaited<ReturnType<typeof open>>['app']) => Promise<void> | void][] = [
    [
      'slider',
      () => {
        const slider = document.querySelector<HTMLInputElement>('#start-time')!;
        slider.value = String(exampleStart + 3);
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      },
    ],
    ['minus', () => click('[data-action="minus"]')],
    ['plus', () => click('[data-action="plus"]')],
    ['swap', () => click('[data-action="swap"]')],
    [
      'picker completing a pair',
      () => {
        click('[data-action="picker"]');
        click(`.sheet:not([aria-hidden]) .corner-choice[data-slug="${other.origin}"]`);
        click(`.sheet:not([aria-hidden]) .corner-choice[data-slug="${other.dest}"]`);
      },
    ],
  ];

  for (const [kind, act] of inputs) {
    it(`${kind}: the label, prompt heading and orientation line leave, stay gone, and the next race runs`, async () => {
      const { app, time } = await open();
      time.advance(TIMINGS.orientationMs + 1000);
      expect(app.store.get().race.phase).toBe('running');
      expect(guidedPartsShown()).toBe(true);
      await act(app);
      expect(app.store.get().guided).toBe(false);
      expect(guidedPartsShown()).toBe(false);
      expect(caption()).not.toBeNull();
      // The next race (a pair change loads its file first) is an ordinary one: nothing comes back.
      await settle();
      time.advance(30_000);
      await settle();
      time.advance(30_000);
      const state = app.store.get();
      expect(state.guided).toBe(false);
      expect(state.race.phase).toBe('finished');
      expect(guidedPartsShown()).toBe(false);
      expect(caption()).not.toBeNull();
      expect(document.querySelector('.result')).not.toBeNull();
    });
  }
});

describe('what never ends the guided visit', () => {
  it('skip, and opening and closing the Sources and About sheets', async () => {
    const { app, time } = await open();
    time.advance(100);
    click('[data-action="sources"]');
    expect(app.store.get().sheet).toBe('sources');
    expect(app.store.get().guided).toBe(true);
    click('[data-action="close-sheet"]');
    click('[data-action="about"]');
    expect(app.store.get().sheet).toBe('about');
    expect(app.store.get().guided).toBe(true);
    click('[data-action="close-sheet"]');
    expect(app.store.get().sheet).toBeNull();
    click('[data-action="skip"]');
    expect(app.store.get().race.phase).toBe('finished');
    expect(app.store.get().guided).toBe(true);
    expect(exampleLabel()).not.toBeNull();
    expect(prompt()).not.toBeNull();
  });
});
