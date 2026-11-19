// Tasks 11.4 to 11.6: playback on the page, on a fake clock. The order of events
// for each result, the result and the announcement once, stop and restart, skip
// before and after the result, reduced motion and the lite fallback. Pairs and
// times are the real cases of R17.4; expected times come from the files through
// the timeline, and expected text from the copy table with the shown numbers.
import { afterEach, describe, expect, it } from 'vitest';
import { LEAD_PAIR, TIMINGS, VEHICLE_SIZES } from '../../src/config';
import * as A from '../../src/copy/announce';
import * as C from '../../src/copy/copy';
import { cornerName, rowAt } from '../../src/data/lookup';
import { clockOf, label12, shortClock } from '../../src/format/time';
import { SPARK, buildTimeline, sparkGapMs } from '../../src/play/timeline';
import { buildView } from '../../src/state/derive';
import type { RaceView, Side } from '../../src/state/model';
import type { App } from '../../src/view/app';
import { ANNOUNCE_DELAY_MS } from '../../src/view/a11y';
import { FIXTURE_DIR, fixtureData } from '../support/fixture';
import { type PageOptions, bootPage } from '../support/page';
import { realData, slugNamed } from '../support/realdata';
import { renderAt, text, value } from '../support/render';
import { type FakeTime, fakeTime } from '../support/time';

const data = realData();
const lead = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
const westToPreston = { origin: slugNamed('Westwood & Carey'), dest: slugNamed('Preston & Caroline') };
const STEP = 16;

/** A New York wall time on the service date, so the page starts at that minute. */
const newYork = (hhmm: string): Date => new Date(`${data.index.service_date}T${hhmm}:00-05:00`);
const query = (p: { origin: string; dest: string }): string => `?from=${p.origin}&to=${p.dest}`;

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
});

type Page = { app: App; time: FakeTime };

async function open(options: PageOptions = {}): Promise<Page> {
  const time = options.time ?? fakeTime();
  const app = await bootPage({ ...options, time });
  return { app, time };
}

function viewOn(app: App): RaceView {
  const state = app.store.get();
  if (state.data.status !== 'ready' || state.minute === null) throw new Error('no data');
  const race = state.data.races.get(`${state.pair.origin}__${state.pair.dest}`)!;
  return buildView(state.data.index, state.data.summary, race, clockOf(state.minute));
}

const lane = (side: Side): HTMLElement | null => document.querySelector<HTMLElement>(`.lane-${side}`);
const said = (): string => text(document.getElementById('result-status'));
const click = (selector: string): void => document.querySelector<HTMLButtonElement>(selector)!.click();

type Snap = {
  ms: number;
  phase: string;
  result: boolean;
  arrived: Record<Side, boolean>;
  arriving: Record<Side, boolean>;
  said: string;
};

function snap(app: App, time: FakeTime): Snap {
  return {
    ms: time.current(),
    phase: app.store.get().race.phase,
    result: document.querySelector('.result') !== null,
    arrived: { '1938': lane('1938')?.hasAttribute('data-arrived') ?? false, today: lane('today')?.hasAttribute('data-arrived') ?? false },
    arriving: {
      '1938': lane('1938')?.classList.contains('is-arriving') ?? false,
      today: lane('today')?.classList.contains('is-arriving') ?? false,
    },
    said: said(),
  };
}

/** Advance in display frames and record the page after each. */
function play(page: Page, ms: number): Snap[] {
  const out = [snap(page.app, page.time)];
  for (let t = 0; t < ms; t += STEP) {
    page.time.advance(STEP);
    out.push(snap(page.app, page.time));
  }
  return out;
}

const firstAt = (snaps: Snap[], test: (s: Snap) => boolean): number | null => snaps.find(test)?.ms ?? null;

/** The real time, in page milliseconds, at which the clock reaches `minutes` scheduled minutes. */
function realMs(view: RaceView, minutes: number): number {
  const t = buildTimeline(view);
  return TIMINGS.racePauseMs + (minutes / t.speed) * 1000;
}

function expectNear(actual: number | null, expected: number): void {
  expect(actual).not.toBeNull();
  expect(actual!).toBeGreaterThanOrEqual(expected - 1e-6);
  expect(actual!).toBeLessThanOrEqual(expected + 2 * STEP);
}

/** Every number button's source id on the card, sorted. */
const buttonIds = (root: ParentNode): string[] =>
  [...root.querySelectorAll<HTMLElement>('button.num')].map((b) => b.dataset['source']!).sort();

const walkSum = (): number =>
  [...document.querySelectorAll('.lane-today .legend-item[data-phase^="walk"] button.num')].map(value).reduce((a, b) => a + b, 0);

describe('the first race starts by itself (R2.1, R2.5)', () => {
  it('draws the start of the race at once and starts the clock after the fixed pause', async () => {
    const page = await open();
    const view = viewOn(page.app);
    expect(page.app.store.get().race.phase).toBe('idle');
    expect(document.querySelector('.result')).toBeNull();
    expect(text(document.querySelector('.clock-readout'))).toBe(C.clockReadout(shortClock(view.start)));
    const [wait] = view.lane1938.phases;
    expect(text(lane('1938')!.querySelector('.status'))).toBe(C.waiting1938(wait!.shown, shortClock(view.row.y1938.dep)));
    expect(text(lane('today')!.querySelector('.status'))).toBe(C.walkingToStop(view.laneToday!.phases[0]!.shown));
    // Totals and legends wait for each lane's arrival; the trolley fades in once.
    for (const side of ['1938', 'today'] as const) {
      expect(lane(side)!.dataset['stage']).toBe('racing');
      expect(lane(side)!.hasAttribute('data-arrived')).toBe(false);
      expect(lane(side)!.querySelector<HTMLElement>('.legend')!.hidden).toBe(true);
    }
    expect(lane('1938')!.querySelector('.vehicle.first-paint')).not.toBeNull();
    expect(page.time.marks).toEqual([]);
    page.time.advance(TIMINGS.racePauseMs - 1);
    expect(page.app.store.get().race.phase).toBe('idle');
    page.time.advance(1);
    expect(page.app.store.get().race.phase).toBe('running');
    expect(page.time.marks).toEqual(['race-start']);
  });

  it('draws the racing trolley at its racing size and gives it its finished size at the finish', async () => {
    const page = await open();
    const width = (): string | null => lane('1938')!.querySelector('.trolley-art')!.getAttribute('width');
    expect(width()).toBe(String(VEHICLE_SIZES.phone.trolleyRacing));
    play(page, 13000);
    expect(width()).toBe(String(VEHICLE_SIZES.phone.trolleyFinished));
  });

  it('marks race-start once, for the first race only', async () => {
    const page = await open();
    play(page, 13000);
    click('[data-action="plus"]');
    play(page, 13000);
    expect(page.time.marks).toEqual(['race-start']);
    expect(lane('1938')!.querySelector('.first-paint')).toBeNull();
  });
});

describe('the order of events', () => {
  it('a 1938 win (the lead pair at 10:00): the result at the trolley arrival, the bus runs on to the finish', async () => {
    const page = await open();
    const view = viewOn(page.app);
    expect(view.result).toBe('1938');
    const t = buildTimeline(view);
    const snaps = play(page, 13000);
    const result = firstAt(snaps, (s) => s.result);
    expectNear(result, realMs(view, t.end1938));
    expect(firstAt(snaps, (s) => s.arrived['1938'])).toBe(result);
    expectNear(firstAt(snaps, (s) => s.arrived.today), realMs(view, t.endToday!));
    expect(firstAt(snaps, (s) => s.phase === 'finished')).toBe(firstAt(snaps, (s) => s.arrived.today));
    // The emphasis is the first arrival's only.
    expect(firstAt(snaps, (s) => s.arriving['1938'])).toBe(result);
    expect(snaps.some((s) => s.arriving.today)).toBe(false);
  });

  it('a today win (Westwood & Carey to Preston & Caroline at 11:23): the result at the bus arrival', async () => {
    const page = await open({ query: query(westToPreston), now: newYork('11:23') });
    const view = viewOn(page.app);
    expect(view.result).toBe('today');
    const t = buildTimeline(view);
    const snaps = play(page, 13000);
    const result = firstAt(snaps, (s) => s.result);
    expectNear(result, realMs(view, t.endToday!));
    expect(firstAt(snaps, (s) => s.arrived.today)).toBe(result);
    expectNear(firstAt(snaps, (s) => s.arrived['1938']), realMs(view, t.end1938));
    expect(firstAt(snaps, (s) => s.arriving.today)).toBe(result);
    expect(snaps.some((s) => s.arriving['1938'])).toBe(false);
  });

  it('a photo finish (the lead pair at 10:30): the result once both have arrived, both ends emphasised together', async () => {
    const page = await open({ now: newYork('10:30') });
    const view = viewOn(page.app);
    expect(view.result).toBe('photo_finish');
    const t = buildTimeline(view);
    const snaps = play(page, 13000);
    const result = firstAt(snaps, (s) => s.result);
    expectNear(result, realMs(view, Math.max(t.end1938, t.endToday!)));
    expect(firstAt(snaps, (s) => s.arrived['1938'] && s.arrived.today)).toBe(result);
    expect(firstAt(snaps, (s) => s.arriving['1938'])).toBe(result);
    expect(firstAt(snaps, (s) => s.arriving.today)).toBe(result);
    expect(firstAt(snaps, (s) => s.phase === 'finished')).toBe(result);
  });

  it('no one-seat ride (the made-up fixture line): one lane, the result and the finish at the 1938 arrival', async () => {
    const fixture = fixtureData();
    const pair = fixture.index.pairs.find((p) => fixture.races.get(`${p.origin}__${p.dest}`)!.today.trips.length === 0)!;
    const page = await open({ folder: FIXTURE_DIR, query: query(pair), leadPair: pair });
    const view = viewOn(page.app);
    expect(view.result).toBe('no_one_seat_ride');
    expect(lane('today')).toBeNull();
    const t = buildTimeline(view);
    const snaps = play(page, 13000);
    const result = firstAt(snaps, (s) => s.result);
    expectNear(result, realMs(view, t.end1938));
    expect(firstAt(snaps, (s) => s.arrived['1938'])).toBe(result);
    expect(firstAt(snaps, (s) => s.phase === 'finished')).toBe(result);
    expect(said()).toBe(
      A.announceNoOneSeatRide({
        origin: view.originName,
        dest: view.destName,
        time: label12(view.start),
        trolley: value(document.querySelector('button.num[data-source="total-1938"]')!),
      }),
    );
  });
});

describe('the result and the announcement', () => {
  it('happen once, at the result moment, from the shown numbers; the box is not rebuilt at the finish', async () => {
    const page = await open();
    const view = viewOn(page.app);
    const snaps = play(page, 5000);
    const result = firstAt(snaps, (s) => s.result)!;
    const box = document.querySelector('.result')!;
    expect(box.classList.contains('entering')).toBe(true);
    expect(document.querySelector('.honest')!.classList.contains('entering')).toBe(true);
    const rest = play(page, 9000);
    const all = [...snaps, ...rest];
    // One write, after the region was cleared and the short delay.
    const writes = all.filter((s, k) => s.said !== '' && all[k - 1]?.said === '');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.ms - result).toBeGreaterThanOrEqual(ANNOUNCE_DELAY_MS);
    expect(writes[0]!.ms - result).toBeLessThanOrEqual(ANNOUNCE_DELAY_MS + 2 * STEP);
    expect(all.filter((s) => s.ms < result).every((s) => s.said === '')).toBe(true);
    expect(document.querySelectorAll('.result')).toHaveLength(1);
    expect(document.querySelector('.result')).toBe(box);
    const total = (id: string): number => value(document.querySelector(`button.num[data-source="${id}"]`)!);
    expect(said()).toBe(
      A.announce1938Wins({
        origin: cornerName(data.index, lead.origin)!,
        dest: cornerName(data.index, lead.dest)!,
        time: label12(view.start),
        trolley: total('total-1938'),
        bus: total('total-today'),
        walk: walkSum(),
        margin: total('margin'),
      }),
    );
  });

  it('lets the slower side run on after the result, with "Skip to result" still offered (R5.7, R5.8)', async () => {
    const page = await open();
    const view = viewOn(page.app);
    const t = buildTimeline(view);
    page.time.advance(realMs(view, t.end1938) + 100);
    expect(page.app.store.get().race).toEqual({ phase: 'running', resultShown: true });
    const status = text(lane('today')!.querySelector('.status'));
    const p = (): number => Number(lane('today')!.querySelector<HTMLElement>('.runner')!.style.getPropertyValue('--p'));
    const before = p();
    // A minute before the bus side's own finish: its ride is done and it walks on.
    page.time.advance(realMs(view, t.endToday! - 1) - page.time.current());
    expect(text(lane('today')!.querySelector('.status'))).not.toBe(status);
    expect(p()).toBeGreaterThan(before);
    expect(document.querySelector('button.skip')).not.toBeNull();
    expect(lane('1938')!.querySelector<HTMLElement>('.status')!.hidden).toBe(true);
    expect(lane('1938')!.querySelector<HTMLElement>('.legend')!.hidden).toBe(false);
  });

  it('leaves the same finished card as the finished drawing: legends, totals, result, no clock row', async () => {
    const page = await open();
    play(page, 13000);
    const scroll = document.getElementById('card-scroll')!;
    const still = renderAt(data, lead, '10:00').root;
    expect(text(scroll)).toBe(text(still));
    expect(buttonIds(scroll)).toEqual(buttonIds(still));
    expect(document.querySelector('.clock-row, .status')).toBeNull();
    for (const side of ['1938', 'today'] as const) expect(lane(side)!.dataset['stage']).toBe('finished');
    // Nothing loops once the race is over (R5.10).
    expect(page.time.pendingTimeouts()).toBe(0);
  });
});

describe('a change of layout during the race', () => {
  it('redraws the card at the clock time and carries on: no second emphasis, result or announcement', async () => {
    let layout: 'phone' | 'desktop' = 'phone';
    const page = await open({ layout: () => layout });
    const view = viewOn(page.app);
    const t = buildTimeline(view);
    const before = play(page, realMs(view, t.end1938) + 200);
    expect(page.app.store.get().race).toEqual({ phase: 'running', resultShown: true });
    layout = 'desktop';
    page.app.render();
    expect(lane('1938')!.querySelector('.trolley-art')!.getAttribute('width')).toBe(String(VEHICLE_SIZES.desktop.trolley));
    expect(lane('1938')!.hasAttribute('data-arrived')).toBe(true);
    expect(document.querySelectorAll('.result')).toHaveLength(1);
    const after = play(page, 13000);
    expect(page.app.store.get().race.phase).toBe('finished');
    expect(after.some((s) => s.arriving.today)).toBe(false);
    const all = [...before, ...after];
    expect(all.filter((s, k) => s.said !== '' && all[k - 1]?.said === '')).toHaveLength(1);
  });
});

describe('the clock readout and status lines', () => {
  it('read the scheduled time and count down in whole minutes', async () => {
    const page = await open();
    const view = viewOn(page.app);
    // 2 s into the race is 8 scheduled minutes: "10:08 scheduled".
    page.time.advance(TIMINGS.racePauseMs + 2000 + STEP);
    expect(text(document.querySelector('.clock-readout'))).toBe(C.clockReadout(shortClock(clockOf(600 + 8))));
    const [wait, ride] = view.lane1938.phases;
    expect(wait!.stored).toBeLessThan(8);
    const left = text(lane('1938')!.querySelector('.status'));
    expect(left).toMatch(/^Riding \d+ min \(scheduled\)$/);
    const n = Number(/\d+/.exec(left)![0]);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(ride!.shown);
    expect(lane('1938')!.classList.contains('is-moving')).toBe(true);
    expect(lane('today')!.classList.contains('is-moving')).toBe(false);
  });
});

describe('stop and restart (R3.5)', () => {
  it('stops the race at the first slider movement, follows it with the time label only, and starts 300 ms after the last input', async () => {
    const page = await open();
    page.time.advance(TIMINGS.racePauseMs + 2000);
    const input = document.querySelector<HTMLInputElement>('#start-time')!;
    const readout = text(document.querySelector('.clock-readout'));
    const status = text(lane('1938')!.querySelector('.status'));
    const move = (minute: number): void => {
      input.value = String(minute);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    move(720);
    expect(page.app.store.get().race.phase).toBe('idle');
    page.time.advance(200);
    move(721);
    page.time.advance(200);
    // Stopped: the lanes and the readout stay as they were; the time label follows the thumb.
    expect(text(document.querySelector('.clock-readout'))).toBe(readout);
    expect(text(lane('1938')!.querySelector('.status'))).toBe(status);
    expect(text(document.querySelector('.slider-time'))).toBe(label12('12:01'));
    expect(input.getAttribute('aria-valuetext')).toBe(C.sliderValueText(label12('12:01')));
    page.time.advance(TIMINGS.racePauseMs - 200 - 1);
    expect(page.app.store.get().race.phase).toBe('idle');
    page.time.advance(1);
    expect(page.app.store.get().race.phase).toBe('running');
    const view = viewOn(page.app);
    expect(view.start).toBe(rowAt(data.races.get(`${lead.origin}__${lead.dest}`)!, '12:01')!.start);
    expect(text(document.querySelector('.clock-readout'))).toBe(C.clockReadout(shortClock(view.start)));
  });

  it('starts no race while the thumb is held down, and starts 300 ms after it is released', async () => {
    const page = await open();
    const input = document.querySelector<HTMLInputElement>('#start-time')!;
    input.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    input.value = '700';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    page.time.advance(2000);
    expect(page.app.store.get().race.phase).toBe('idle');
    document.dispatchEvent(new Event('pointerup', { bubbles: true }));
    page.time.advance(TIMINGS.racePauseMs);
    expect(page.app.store.get().race.phase).toBe('running');
  });

  it('stops at a minus or plus press and starts 300 ms after the last one; each race announces once', async () => {
    const page = await open();
    play(page, 13000);
    expect(page.app.store.get().race.phase).toBe('finished');
    click('[data-action="minus"]');
    expect(page.app.store.get().race.phase).toBe('idle');
    page.time.advance(100);
    click('[data-action="minus"]');
    page.time.advance(TIMINGS.racePauseMs - 1);
    expect(page.app.store.get().race.phase).toBe('idle');
    expect(text(document.querySelector('.slider-time'))).toBe(label12('09:58'));
    const snaps = play(page, 13000);
    expect(page.app.store.get().race.phase).toBe('finished');
    expect(viewOn(page.app).row.t).toBe('09:58');
    expect(snaps.filter((s, k) => s.said !== '' && snaps[k - 1]?.said === '')).toHaveLength(1);
  });
});

describe('Skip to result (R5.8)', () => {
  it('before the result: jumps both lanes to finished and gives the result its entrance, announced once', async () => {
    const page = await open();
    page.time.advance(TIMINGS.racePauseMs + 1000);
    expect(document.querySelector('.result')).toBeNull();
    const skip = document.querySelector<HTMLButtonElement>('button.skip')!;
    expect(skip.type).toBe('button');
    expect(text(skip)).toBe(C.SKIP_TO_RESULT);
    skip.click();
    expect(page.app.store.get().race).toEqual({ phase: 'finished', resultShown: true });
    expect(document.querySelector('.result')!.classList.contains('entering')).toBe(true);
    expect(lane('1938')!.classList.contains('is-arriving')).toBe(true);
    expect(document.querySelector('.clock-row')).toBeNull();
    const snaps = play(page, 2000);
    expect(snaps.filter((s, k) => s.said !== '' && snaps[k - 1]?.said === '')).toHaveLength(1);
  });

  it('after the result: finishes the slower side; the result is neither rebuilt nor announced again', async () => {
    const page = await open();
    const snaps = play(page, 6000);
    const box = document.querySelector('.result');
    expect(box).not.toBeNull();
    expect(page.app.store.get().race.phase).toBe('running');
    click('button.skip');
    expect(page.app.store.get().race.phase).toBe('finished');
    expect(document.querySelector('.result')).toBe(box);
    const after = [...snaps, ...play(page, 2000)];
    expect(after.filter((s, k) => s.said !== '' && after[k - 1]?.said === '')).toHaveLength(1);
  });
});

describe('reduced motion (R5.11)', () => {
  it('draws the finished state at once, with no clock, no skip and no entrance, and announces once per race', async () => {
    const page = await open({ motion: 'reduced' });
    expect(page.app.store.get().race.phase).toBe('finished');
    expect(document.documentElement.classList.contains('motion-reduced')).toBe(true);
    expect(document.querySelector('.clock-row, button.skip, .status, .first-paint, .entering')).toBeNull();
    expect(document.querySelector('.result')).not.toBeNull();
    expect(lane('1938')!.querySelector('.trolley-art')!.getAttribute('width')).toBe(String(VEHICLE_SIZES.phone.trolleyFinished));
    const first = play(page, 1000);
    expect(first.filter((s, k) => s.said !== '' && first[k - 1]?.said === '')).toHaveLength(1);
    // After a slider change: the new minute, finished, announced once more; no frame ever runs.
    click('[data-action="plus"]');
    const second = play(page, 1000);
    expect(viewOn(page.app).row.t).toBe('10:01');
    expect(document.querySelector('.result')).not.toBeNull();
    expect(second.filter((s, k) => s.said !== '' && second[k - 1]?.said === '')).toHaveLength(1);
    expect(page.time.frameCount()).toBe(0);
  });

  it('finishes a running race at once when the device asks for reduced motion', async () => {
    const page = await open();
    page.time.advance(TIMINGS.racePauseMs + 1000);
    page.app.setMotion('reduced');
    expect(page.app.store.get().race.phase).toBe('finished');
    expect(document.querySelector('.clock-row')).toBeNull();
    expect(document.querySelector('.result')).not.toBeNull();
    const frames = page.time.frameCount();
    page.time.advance(2000);
    expect(page.time.frameCount()).toBe(frames);
    expect(said()).not.toBe('');
  });
});

describe('the lite fallback (R5.10)', () => {
  it('drops the extra motion after a slow first second and keeps the race moving to its finish', async () => {
    const page = await open({ time: fakeTime({ frameMs: 50 }) });
    expect(document.documentElement.classList.contains('motion-full')).toBe(true);
    page.time.advance(TIMINGS.racePauseMs + 1100);
    expect(page.app.store.get().motion).toBe('lite');
    expect(document.documentElement.classList.contains('motion-lite')).toBe(true);
    expect(document.documentElement.classList.contains('motion-full')).toBe(false);
    page.time.advance(13000);
    expect(page.app.store.get().race.phase).toBe('finished');
    // The session stays lite even if the device reports full motion again.
    page.app.setMotion('full');
    expect(page.app.store.get().motion).toBe('lite');
  });

  it('keeps full motion on a 60 Hz display, with pole sparks only while the trolley rides', async () => {
    const page = await open();
    const sparking = (): boolean => lane('1938')!.classList.contains('is-sparking');
    // The first spark comes one random gap after the race starts, and lasts 120 ms.
    const at = TIMINGS.racePauseMs + sparkGapMs(0.5);
    page.time.advance(at - 1);
    expect(sparking()).toBe(false);
    page.time.advance(1);
    expect(sparking()).toBe(true);
    expect(lane('1938')!.classList.contains('is-moving')).toBe(true);
    page.time.advance(SPARK.flashMs);
    expect(sparking()).toBe(false);
    page.time.advance(13000);
    expect(page.app.store.get().motion).toBe('full');
    expect(sparking()).toBe(false);
  });
});
