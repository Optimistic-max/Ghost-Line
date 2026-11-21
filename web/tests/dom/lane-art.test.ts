// Task 8.3: the lane illustrations keep one size through a race (story-layer Req 5.3, 5.5, 5.6, 6.5).
import { afterEach, describe, expect, it } from 'vitest';
import { ROUTE_NUMBER_MIN_WIDTH, VEHICLE_SIZES } from '../../src/config';
import { bootPage } from '../support/page';
import { fakeTime } from '../support/time';

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
});

/** Every drawn svg in a lane's title row: its size attributes, and the size variable on the lane. */
function boxes(): string[] {
  return ['1938', 'today'].flatMap((side) => {
    const lane = document.querySelector<HTMLElement>(`.lane-${side}`)!;
    const svgs = [...lane.querySelectorAll('.lane-art svg')].map(
      (s) => `${side} ${s.getAttribute('class')} ${s.getAttribute('width')} ${s.getAttribute('height')} ${s.getAttribute('viewBox')}`,
    );
    return [...svgs, `${side} --veh-w ${lane.style.getPropertyValue('--veh-w')}`, `${side} art ${lane.querySelectorAll('.lane-art').length}`];
  });
}

describe('lane illustrations', () => {
  it('keep the same box before, during and after a race', async () => {
    const time = fakeTime();
    await bootPage({ time });
    const before = boxes();
    expect(before.length).toBeGreaterThan(4);
    time.advance(2000 + 4000);
    expect(document.querySelector('.lane-1938')!.getAttribute('data-stage')).toBe('racing');
    const during = boxes();
    time.advance(13000);
    expect(document.querySelector('.lane-1938')!.getAttribute('data-stage')).toBe('finished');
    const after = boxes();
    expect(during).toEqual(before);
    expect(after).toEqual(before);
    expect(before.join('\n')).toContain(`--veh-w ${VEHICLE_SIZES.phone.trolley}px`);
    expect(before.join('\n')).toContain(`--veh-w ${VEHICLE_SIZES.phone.bus}px`);
  });

  it('show the trolley route number only at the 150 px width', async () => {
    expect(VEHICLE_SIZES.phone.trolley).toBeLessThan(ROUTE_NUMBER_MIN_WIDTH);
    expect(VEHICLE_SIZES.desktop.trolley).toBeGreaterThanOrEqual(ROUTE_NUMBER_MIN_WIDTH);
    for (const [layout, shown] of [['phone', false], ['desktop', true]] as const) {
      document.body.innerHTML = '';
      await bootPage({ layout, time: fakeTime() });
      const art = document.querySelector('.lane-1938 .lane-art');
      expect(art?.querySelector('svg')?.getAttribute('width'), layout).not.toBeNull();
      expect(art!.querySelector('[data-part="route-number"]') !== null, layout).toBe(shown);
      expect(document.querySelector('.lane-today [data-part="route-number"]')).toBeNull();
    }
  });

  it('draw today\'s bus and bus marker with no pole, wire or glow', async () => {
    await bootPage({ time: fakeTime() });
    const today = document.querySelector('.lane-today')!;
    for (const part of ['pole', 'wire', 'shoe', 'rope']) expect(today.querySelectorAll(`[data-part="${part}"]`).length, part).toBe(0);
    expect(today.querySelector('.trolley-glow')).toBeNull();
    expect(today.innerHTML).not.toMatch(/glow/i);
    // The 1938 lane has the trolley's two poles and two wires.
    const old = document.querySelector('.lane-1938')!;
    expect(old.querySelectorAll('.lane-art [data-part="pole"]').length).toBe(2);
    expect(old.querySelectorAll('.lane-art [data-part="wire"]').length).toBe(2);
  });

  it('hold one marker per lane, which does not move the illustration', async () => {
    const time = fakeTime();
    await bootPage({ time });
    for (const side of ['1938', 'today']) expect(document.querySelectorAll(`.lane-${side} .bar-marker`).length).toBe(1);
    const art = document.querySelector('.lane-1938 .lane-art')!;
    const parent = art.parentElement;
    time.advance(8000);
    expect(art.parentElement).toBe(parent);
    expect(art.querySelector('.vehicle')!.getAttribute('style')).toBeNull();
  });
});
