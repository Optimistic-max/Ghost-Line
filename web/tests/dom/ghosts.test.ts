// Ghost cars on the page (ghost-cars spec, tasks 3.2 and 4.2), on a fake clock: the counter changes at the
// cars' pass times and is finished from the bus departure; its number opens the 1938 timetable Sources row;
// reduced motion and skip give the finished sentence; ghost cars on the route drawing come and go with their
// rides and the map line shows only while they can. The card's height is checked in the browser (screens.spec.ts).
import { afterEach, describe, expect, it } from 'vitest';
import { LEAD_PAIR, TIMINGS } from '../../src/config';
import * as C from '../../src/copy/copy';
import { buildTimeline } from '../../src/play/timeline';
import { buildView } from '../../src/state/derive';
import { bootPage } from '../support/page';
import { realData } from '../support/realdata';
import { text } from '../support/render';
import { fakeTime } from '../support/time';

const real = realData();
const race = real.races.get(`${LEAD_PAIR.origin}__${LEAD_PAIR.dest}`)!;
const timeline = buildTimeline(buildView(real.index, real.summary, race, '10:00'));
const g = timeline.ghosts!;
const FRAME_MS = 16;
/** Real milliseconds from the race start for a scheduled minute of the lead race. */
const msAt = (minute: number): number => (minute / timeline.speed) * 1000;

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
  window.history.replaceState(null, '', '/');
});

const counter = (): HTMLElement | null => document.querySelector<HTMLElement>('.ghost-counter');
const visibleGhosts = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.drawing-marker.ghost-car')].filter((el) => !el.hidden);
const ghostLine = (): HTMLElement => document.querySelector<HTMLElement>('.map-ghosts')!;

/** The guided lead race, booted and taken through the orientation pause to the race start. */
async function racing() {
  const time = fakeTime({ frameMs: FRAME_MS });
  const app = await bootPage({ time });
  time.advance(TIMINGS.orientationMs);
  expect(app.store.get().race.phase).toBe('running');
  return { app, time };
}

describe('the counter (Req 4)', () => {
  it('sits in the today lane, empty before the own car, then counts each car at its pass time and finishes at the bus departure', async () => {
    const { app, time } = await racing();
    const el = counter()!;
    expect(el).not.toBeNull();
    expect(el.closest('.lane-today')).not.toBeNull();
    const changes: { ms: number; text: string }[] = [{ ms: 0, text: text(el) }];
    let ms = 0;
    for (let step = 0; step < 2000 && app.store.get().race.phase !== 'finished'; step += 1) {
      time.advance(FRAME_MS);
      ms += FRAME_MS;
      const now = text(counter());
      if (now !== changes.at(-1)!.text) changes.push({ ms, text: now });
    }
    const want = [
      '',
      ...g.at.map((_, k) => C.ghostCounting(k + 1)),
      C.ghostFinished(g.at.length),
    ];
    expect(changes.map((c) => c.text)).toEqual(want);
    // Each change lands within two frames after its scheduled moment.
    const moments = [...g.at.map(msAt), msAt(g.busAt)];
    changes.slice(1).forEach((c, k) => {
      expect(c.ms, c.text).toBeGreaterThanOrEqual(moments[k]! - FRAME_MS);
      expect(c.ms, c.text).toBeLessThanOrEqual(moments[k]! + 2 * FRAME_MS);
    });
  });

  it('opens the Sources sheet at the 1938 timetable row, with the race file\'s page and the method line', async () => {
    const { time } = await racing();
    time.advance(msAt(g.at[1]!) + 2 * FRAME_MS);
    const button = counter()!.querySelector<HTMLButtonElement>('button.num')!;
    expect(text(button)).toBe('2');
    button.click();
    const row = document.querySelector<HTMLElement>('.sheet.is-open .source-row[data-source="ghost-count"]')!;
    expect(row).not.toBeNull();
    expect(row.classList.contains('is-target')).toBe(true);
    expect(text(row)).toContain(C.METHOD_GHOST_COUNT);
    expect(row.querySelector<HTMLAnchorElement>('.source-from a')!.href).toBe(race.y1938.sources.passes);
  });

  it('shows the finished sentence at once under reduced motion, with its number a button', async () => {
    await bootPage({ motion: 'reduced' });
    expect(text(counter())).toBe(C.ghostFinished(4));
    expect(counter()!.querySelector('button.num[data-source="ghost-count"]')).not.toBeNull();
    expect(visibleGhosts()).toEqual([]);
    expect(ghostLine().hidden).toBe(true);
  });

  it('shows the finished sentence after Skip to result, with no ghost car left', async () => {
    const { time } = await racing();
    time.advance(msAt(g.at[1]! + 1));
    document.querySelector<HTMLButtonElement>('[data-action="skip"]')!.click();
    time.advance(FRAME_MS);
    expect(text(counter())).toBe(C.ghostFinished(4));
    expect(visibleGhosts()).toEqual([]);
    expect(ghostLine().hidden).toBe(true);
  });

  it('is not on the card for a row with fewer than two cars', async () => {
    const pair = real.index.pairs.find((p) => p.origin === 'dolphin-myrtle' && p.dest === 'westwood-carey')!;
    await bootPage({ motion: 'reduced', query: `?from=${pair.origin}&to=${pair.dest}`, now: new Date('2026-11-04T10:00:00-05:00') });
    expect(counter()).toBeNull();
  });
});

describe('ghost cars on the route drawing (Req 3, 6)', () => {
  it('none on the phone strip, nor its map line, through the whole race (Req 3.4)', async () => {
    const { app, time } = await racing();
    for (let step = 0; step < 2000 && app.store.get().race.phase !== 'finished'; step += 1) {
      time.advance(FRAME_MS);
      expect(visibleGhosts()).toEqual([]);
      expect(ghostLine().hidden).toBe(true);
    }
  });

  it('desktop: none at rest; each from its pass to its arrival; the map line only while the race runs', async () => {
    const time = fakeTime({ frameMs: FRAME_MS });
    await bootPage({ time, layout: 'desktop' });
    // Let the route drawing come in.
    await new Promise((r) => setTimeout(r, 0));
    time.advance(FRAME_MS);
    expect(visibleGhosts()).toEqual([]);
    time.advance(TIMINGS.orientationMs - FRAME_MS);
    // Before the first ghost's pass: none.
    time.advance(msAt(g.at[1]!) - 2 * FRAME_MS);
    expect(visibleGhosts()).toEqual([]);
    expect(ghostLine().hidden).toBe(false);
    expect(text(ghostLine())).toBe(C.MAP_GHOSTS);
    // Just after it: one.
    time.advance(4 * FRAME_MS);
    expect(visibleGhosts()).toHaveLength(1);
    const ghost = visibleGhosts()[0]!;
    expect(ghost.style.getPropertyValue('--mx')).not.toBe('');
    // After its arrival and before the next pass: none.
    time.advance(msAt(g.ride) + 2 * FRAME_MS);
    const between = g.at[1]! + g.ride + 0.5 < g.at[2]!;
    if (between) expect(visibleGhosts()).toEqual([]);
    // To the finish: all gone, and the line with them.
    for (let step = 0; step < 2000 && document.documentElement.dataset['race'] !== 'finished'; step += 1) time.advance(FRAME_MS);
    time.advance(FRAME_MS);
    expect(visibleGhosts()).toEqual([]);
    expect(ghostLine().hidden).toBe(true);
  });
});
