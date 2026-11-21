// The phone's 100 px route strip (story-layer Req 12.3, checkpoint 18): the View route button has its own
// column on the strip's right, which the drawing never enters, and the corner names keep clear of the trolley
// marker where it stands (at the origin, and short of the destination), the rule the map's street names follow.
// Checked for every pair, with the button's column read from config.ts and its CSS width read from map.css.
import { describe, expect, it } from 'vitest';
import { MAP_LAYOUT } from '../../src/config';
import { pairKey } from '../../src/data/files';
import { planDrawing } from '../../src/map/routedrawing';
import { besideOwnDot, distanceToBox } from '../../src/view/layout';
import { readRepoText } from '../support/files';
import { realData } from '../support/realdata';

type Rect = { x: number; y: number; width: number; height: number };

const { index, route, races } = realData();
const strip = MAP_LAYOUT.phonePreview;
const button = strip.button;
/** Everything the drawing shows stays left of this x. */
const columnLeft = strip.size.width - button.right - button.width;

const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const pairs = index.pairs.map((p) => ({ origin: p.origin, dest: p.dest }));

describe('the phone route strip', () => {
  it('map.css draws the button at the size and place config.ts keeps free', () => {
    const css = readRepoText('web/src/styles/map.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = /\.route-toggle\s*\{([^}]*)\}/.exec(css)![1]!;
    expect(rule).toMatch(new RegExp(`width:\\s*${button.width}px`));
    expect(rule).toMatch(new RegExp(`right:\\s*${button.right}px`));
    expect(rule).toMatch(new RegExp(`top:\\s*${button.top}px`));
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(button.top + button.height).toBeLessThanOrEqual(strip.size.height);
  });

  it('keeps the route, the corner dots and the corner names out of the button column, for every pair', () => {
    expect(pairs.length).toBeGreaterThan(0);
    for (const pair of pairs) {
      const direction = races.get(pairKey(pair))?.direction ?? null;
      const plan = planDrawing({ index, route, pair, layout: 'phone', preview: true, direction });
      const where = `${pair.origin} to ${pair.dest}`;
      for (const leg of plan.legs) for (const p of leg) expect(p.x, where).toBeLessThan(columnLeft);
      for (const d of plan.dots) expect(d.box.x + d.box.width, where).toBeLessThan(columnLeft);
      for (const n of plan.names) {
        expect(n.place.box.x + n.place.box.width, `${where}: ${n.text}`).toBeLessThanOrEqual(columnLeft);
        // Above the part of the strip the card's rounded top covers.
        expect(n.place.box.y + n.place.box.height, `${where}: ${n.text}`).toBeLessThanOrEqual(strip.size.height - strip.cardOverlap);
        expect(n.place.box.x, `${where}: ${n.text}`).toBeGreaterThanOrEqual(0);
        expect(n.place.box.y, `${where}: ${n.text}`).toBeGreaterThanOrEqual(0);
      }
      expect(plan.labels, where).toEqual([]);
    }
  });

  it('keeps each corner name off the standing trolley marker, for every pair', () => {
    for (const pair of pairs) {
      const direction = races.get(pairKey(pair))?.direction ?? null;
      const plan = planDrawing({ index, route, pair, layout: 'phone', preview: true, direction });
      expect(plan.markerBoxes, `${pair.origin} to ${pair.dest}`).toHaveLength(2);
      for (const n of plan.names) {
        // The browser's glyph box (config.ts glyphBox) from the name's baseline, which is taller than its ink.
        const g = MAP_LAYOUT.glyphBox;
        const glyphs = { x: n.place.box.x, y: n.place.y - g.above * n.font, width: n.place.box.width, height: (g.above + g.below) * n.font };
        expect(glyphs.y, `${pair.origin} to ${pair.dest}: ${n.text} top`).toBeGreaterThanOrEqual(0);
        expect(glyphs.y + glyphs.height, `${pair.origin} to ${pair.dest}: ${n.text} foot`).toBeLessThanOrEqual(strip.size.height - strip.cardOverlap);
        for (const m of plan.markerBoxes) expect(overlap(glyphs, m), `${pair.origin} to ${pair.dest}: ${n.text}`).toBe(false);
      }
    }
  });

  it('shows a corner name only next to its own dot, and keeps every dot, for every pair', () => {
    let hidden = 0;
    for (const pair of pairs) {
      const direction = races.get(pairKey(pair))?.direction ?? null;
      const plan = planDrawing({ index, route, pair, layout: 'phone', preview: true, direction });
      const where = `${pair.origin} to ${pair.dest}`;
      // Hiding a name never hides a dot.
      expect(plan.dots, where).toHaveLength(index.corners.length);
      expect(plan.names.length, where).toBeLessThanOrEqual(2);
      hidden += 2 - plan.names.length;
      for (const n of plan.names) {
        const own = n.dot.at;
        const mine = distanceToBox(own, n.place.box);
        // Within the fixed reach of its own dot's centre, and nearer to it than to any other dot.
        expect(mine, `${where}: ${n.text} reach`).toBeLessThanOrEqual(strip.nameReach);
        for (const other of plan.dots) {
          if (other === n.dot) continue;
          expect(mine, `${where}: ${n.text} against ${other.corner.name}`).toBeLessThan(distanceToBox(other.at, n.place.box));
        }
        // Clear of every dot's box.
        for (const d of plan.dots) expect(overlap(n.place.box, d.box), `${where}: ${n.text} on a dot`).toBe(false);
      }
    }
    console.log(`phone strip: ${hidden} of ${pairs.length * 2} chosen-corner names hidden across ${pairs.length} pairs`);
  });

  it('measures "next to its own dot": near and nearest passes, far or nearer another dot fails', () => {
    const box = { x: 10, y: 0, width: 30, height: 10 };
    const own = { x: 0, y: 5 };
    expect(besideOwnDot(box, own, [{ x: 100, y: 5 }], 26)).toBe(true);
    expect(besideOwnDot(box, own, [{ x: 100, y: 5 }], 8)).toBe(false);
    expect(besideOwnDot(box, own, [{ x: 45, y: 5 }], 26)).toBe(false);
    expect(distanceToBox({ x: 20, y: 5 }, box)).toBe(0);
  });
});
