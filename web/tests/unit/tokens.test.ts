// Task 7.1 and 7.3: tokens follow ui.md and the brief, sizes match config.ts,
// and the stylesheets keep the type and motion rules.
import { describe, expect, it } from 'vitest';
import { BREAKPOINTS, FONT_SIZES, VEHICLE_SIZES } from '../../src/config';
import { stylesheets, tokenBlocks } from '../support/css';
import { readRepoText } from '../support/files';

const { phone, desktop, desktopQuery } = tokenBlocks();
const ui = readRepoText('.kiro/steering/ui.md').replace(/\s+/g, ' ');
const brief = readRepoText('docs/planning/screen-brief.md');
const px = (n: number): string => `${n}px`;

describe('palette B', () => {
  it('has exactly the colours listed in ui.md', () => {
    const listed = [...ui.matchAll(/(--[a-z0-9]+) (#[0-9A-F]{6})/gi)].map((m) => [m[1]!, m[2]!] as const);
    expect(listed.length).toBeGreaterThanOrEqual(11);
    for (const [name, hex] of listed) expect(phone.get(name)?.toLowerCase(), name).toBe(hex.toLowerCase());
    const sign = /result box (#[0-9A-F]{6})/i.exec(ui)?.[1];
    expect(phone.get('--sign')?.toLowerCase()).toBe(sign?.toLowerCase());
  });

  it('has the main-road street colour of screen-brief 3A.3', () => {
    const street2 = /`--street2`, `(#[0-9A-Fa-f]{6})`/.exec(brief)?.[1];
    expect(phone.get('--street2')?.toLowerCase()).toBe(street2?.toLowerCase());
  });

  it('defines no colour on desktop that differs from the phone', () => {
    for (const name of desktop.keys()) expect(phone.has(name) && /^#/.test(desktop.get(name)!), name).toBe(false);
  });
});

describe('sizes', () => {
  it('uses the desktop breakpoint of config.ts', () => {
    expect(desktopQuery).toBe(`(min-width: ${px(BREAKPOINTS.desktopMinWidth)})`);
  });

  it('matches the phone type sizes of config.ts', () => {
    const p = FONT_SIZES.phone;
    expect(Object.fromEntries(['--fs-wordmark', '--fs-corner', '--fs-corner-chip', '--fs-slider-time', '--fs-slider-ends', '--fs-lane-title', '--fs-lane-total', '--fs-result', '--fs-body', '--fs-body-small'].map((k) => [k, phone.get(k)]))).toEqual({
      '--fs-wordmark': px(p.wordmark),
      '--fs-corner': px(p.cornerNames),
      '--fs-corner-chip': px(p.cornerNamesWithChip),
      '--fs-slider-time': px(p.sliderTime),
      '--fs-slider-ends': px(p.sliderEnds),
      '--fs-lane-title': px(p.laneTitle),
      '--fs-lane-total': px(p.laneTotal),
      '--fs-result': px(p.resultLine),
      '--fs-body': px(p.body),
      '--fs-body-small': px(p.bodySmall),
    });
  });

  it('matches the desktop type sizes of config.ts', () => {
    const d = FONT_SIZES.desktop;
    expect(desktop.get('--fs-wordmark')).toBe(px(d.wordmark));
    expect(desktop.get('--fs-headline')).toBe(px(d.headline));
    expect(desktop.get('--fs-headline-line')).toBe(px(d.headlineLine));
    expect(desktop.get('--fs-corner')).toBe(px(d.cornerNames));
    expect(desktop.get('--fs-result')).toBe(px(d.resultLine));
  });

  it('matches the vehicle sizes of config.ts', () => {
    expect(phone.get('--trolley-w')).toBe(px(VEHICLE_SIZES.phone.trolleyRacing));
    expect(phone.get('--trolley-w-finished')).toBe(px(VEHICLE_SIZES.phone.trolleyFinished));
    expect(phone.get('--bus-w')).toBe(px(VEHICLE_SIZES.phone.bus));
    expect(phone.get('--marker-w')).toBe(px(VEHICLE_SIZES.phone.mapMarker));
    expect(desktop.get('--trolley-w')).toBe(px(VEHICLE_SIZES.desktop.trolley));
    expect(desktop.get('--trolley-w-finished')).toBe(px(VEHICLE_SIZES.desktop.trolley));
    expect(desktop.get('--bus-w')).toBe(px(VEHICLE_SIZES.desktop.bus));
    expect(desktop.get('--marker-w')).toBe(px(VEHICLE_SIZES.desktop.mapMarker));
  });

  it('matches the phone zones of ui.md', () => {
    const m = /top bar (\d+) px, map (\d+) px, race card from (\d+) px down/.exec(ui);
    expect(m).not.toBeNull();
    expect([phone.get('--topbar-h'), phone.get('--map-h'), phone.get('--card-top')]).toEqual([
      px(Number(m![1])),
      px(Number(m![2])),
      px(Number(m![3])),
    ]);
    // Section 3A's value; the superseded 3.4 table said 8 px.
    expect(phone.get('--buttons-bottom')).toBe(px(Number(/buttons pinned (\d+) px above the bottom/.exec(brief)![1])));
  });

  it('matches the desktop zones of ui.md and screen-brief 3A.1', () => {
    expect(desktop.get('--column-w')).toBe(px(Number(/a fixed (\d+) px race column/.exec(ui)![1])));
    expect(desktop.get('--topbar-h')).toBe(px(Number(/over the map area, (\d+) px high/.exec(brief)![1])));
    expect(desktop.get('--column-pad')).toBe(px(Number(/(\d+) px side padding/.exec(brief)![1])));
  });

  it('keeps tap targets and bars at the sizes of ui.md', () => {
    expect(phone.get('--tap')).toBe(px(Number(/at least (\d+) x \d+ px/.exec(ui)![1])));
    expect(phone.get('--bar-h')).toBe(px(Number(/one (\d+) px bar per side/.exec(ui)![1])));
  });
});

describe('stylesheet rules', () => {
  const sheets = stylesheets();

  it('uses only the desktop breakpoint in media queries', () => {
    for (const [file, css] of sheets) {
      for (const m of css.matchAll(/\((min|max)-width:\s*([\d.]+)px\)/g)) {
        expect(`${m[1]} ${m[2]}`, file).toBe(`min ${BREAKPOINTS.desktopMinWidth}`);
      }
    }
  });

  it('never changes letter case (sentence case everywhere)', () => {
    for (const [file, css] of sheets) {
      for (const m of css.matchAll(/text-transform\s*:\s*([^;]+);/g)) expect(m[1]!.trim(), file).toBe('none');
    }
  });

  it('sets tabular figures and a visible focus ring', () => {
    const base = sheets.get('web/src/styles/base.css')!;
    expect(base).toMatch(/body\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
    expect(base).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ink\)/);
  });

  it('transitions and animates only transform and opacity', () => {
    for (const [file, css] of sheets) {
      for (const m of css.matchAll(/transition(-property)?\s*:\s*([^;]+);/g)) {
        for (const part of m[2]!.split(',')) {
          const property = part.trim().split(/\s+/)[0];
          expect(['transform', 'opacity', 'none'], `${file}: ${part.trim()}`).toContain(property);
        }
      }
      expect(css, file).not.toMatch(/transition\s*:\s*all\b/);
    }
  });

  it('turns every animation and transition off when the device asks for reduced motion', () => {
    const base = sheets.get('web/src/styles/base.css')!;
    expect(base).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important[\s\S]*transition: none !important/);
  });

  it('imports every stylesheet of the first screen from index.css', () => {
    const index = sheets.get('web/src/styles/index.css')!;
    for (const name of ['tokens', 'base', 'layout-phone', 'layout-desktop']) expect(index).toContain(`@import './${name}.css';`);
  });
});
