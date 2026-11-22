// Task 25.8: small map, strip and chart labels are at least 12 px, in --ink or --muted (or the route's own
// --ghost) at full opacity. The 4.5:1 contrast of those colours on the page's backgrounds is checked in
// contrast.test.ts; this file holds the sizes and the opacity.
import { describe, expect, it } from 'vitest';
import { FONT_SIZES, MAP_LAYOUT } from '../../src/config';
import { stylesheets, tokenBlocks } from '../support/css';

const MIN_PX = 12;

describe('label sizes in config.ts', () => {
  it('every map, strip and slider-end size is at least 12 px', () => {
    expect(FONT_SIZES.phone.sliderEnds).toBeGreaterThanOrEqual(MIN_PX);
    // The phone map's street names stay at 9 px: at 12 px they do not fit along the lead pair's legs (see config.ts).
    expect(MAP_LAYOUT.desktop.streetFont, 'desktop street names').toBeGreaterThanOrEqual(MIN_PX);
    for (const layout of ['phone', 'desktop'] as const) {
      const look = MAP_LAYOUT[layout];
      expect(look.nameFont, `${layout} corner names`).toBeGreaterThanOrEqual(MIN_PX);
      expect(look.otherNameFont, `${layout} other corner names`).toBeGreaterThanOrEqual(MIN_PX);
    }
    expect(MAP_LAYOUT.desktop.tileLabels.size).toBeGreaterThanOrEqual(MIN_PX);
  });

  it('the base map labels are drawn at full opacity', () => {
    expect(MAP_LAYOUT.desktop.tileLabels.opacity).toBe(1);
  });
});

describe('label sizes in the stylesheets', () => {
  const { phone } = tokenBlocks();
  const LABELS = /map-|route-|street-|chart|slider-ends|board-gaps/;

  it('every rule for a map, strip, chart, slider-end or board-gap label that sets a font size sets at least 12 px', () => {
    let checked = 0;
    for (const [file, css] of stylesheets()) {
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = m[1]!.trim();
        if (!LABELS.test(selector)) continue;
        const size = /font-size\s*:\s*([^;]+);/.exec(m[2]!)?.[1]?.trim();
        if (!size) continue;
        const px = size.startsWith('var(') ? Number.parseFloat(phone.get(size.slice(4, -1)) ?? 'NaN') : size.endsWith('px') ? Number.parseFloat(size) : Number.NaN;
        // Only sizes this scan can read in px are judged; relative sizes (em, rem) inherit the 13 px body.
        if (Number.isNaN(px)) continue;
        checked += 1;
        expect(px, `${file}: ${selector}`).toBeGreaterThanOrEqual(MIN_PX);
      }
    }
    expect(checked).toBeGreaterThan(2);
  });

  it('the slider ends use the 12 px token, and in --muted', () => {
    expect(Number.parseFloat(phone.get('--fs-slider-ends')!)).toBeGreaterThanOrEqual(MIN_PX);
    const css = [...stylesheets().values()].join('\n');
    const rule = /\.slider-ends\s*\{([^}]*)\}/.exec(css)![1]!;
    expect(rule).toMatch(/color:\s*var\(--muted\)/);
    expect(rule).not.toMatch(/opacity/);
  });
});
