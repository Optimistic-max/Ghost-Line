// Task 9.2: the vehicle drawings.
import { describe, expect, it } from 'vitest';
import { ROUTE_NUMBER_MIN_WIDTH, VEHICLE_SIZES } from '../../src/config';
import { routeNumberOf } from '../../src/format/line';
import { busSvg, markerSvg, trolleySvg, vehicleWidths } from '../../src/view/vehicles';
import { readRepoText } from '../support/files';
import { realData } from '../support/realdata';

function mount(markup: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = markup;
  return host;
}

const count = (host: HTMLElement, part: string): number => host.querySelectorAll(`[data-part="${part}"]`).length;
const num = (el: Element | null, name: string): number => Number(el?.getAttribute(name));
const routeNumber = routeNumberOf(realData().index.line);

/** The CSS rules of vehicles.css: selector and declarations. */
function cssRules(): { selector: string; body: string }[] {
  const css = readRepoText('web/src/styles/vehicles.css').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ selector: m[1]!.trim(), body: m[2]! }));
}

/** A declared value in the rule for `selector`. */
function cssValue(selector: string, property: string): string | undefined {
  const rule = cssRules().find((r) => r.selector === selector);
  return new RegExp(`(?:^|;|\\s)${property}\\s*:\\s*([^;]+)`).exec(rule?.body ?? '')?.[1]?.trim();
}

type Point = [number, number];

/** Shortest distance between two segments that do not cross. */
function segmentDistance([a, b]: [Point, Point], [c, d]: [Point, Point]): number {
  const toSegment = ([px, py]: Point, [x1, y1]: Point, [x2, y2]: Point): number => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };
  return Math.min(toSegment(a, c, d), toSegment(b, c, d), toSegment(c, a, b), toSegment(d, a, b));
}

describe('the 1938 trackless trolley', () => {
  const markup = trolleySvg({ routeNumber, width: VEHICLE_SIZES.phone.trolleyRacing });
  const host = mount(markup);
  const art = host.querySelector('.trolley-art')!;

  it('has exactly two poles, two shoes, two wires and two retriever ropes', () => {
    expect(count(host, 'pole')).toBe(2);
    expect(count(host, 'shoe')).toBe(2);
    expect(count(host, 'wire')).toBe(2);
    expect(count(host, 'rope')).toBe(2);
  });

  it('takes each pole to its own wire', () => {
    const wires = [...art.querySelectorAll('[data-part="wire"]')].map((w) => num(w, 'y1')).sort((a, b) => a - b);
    const tips = [...art.querySelectorAll('[data-part="pole"]')].map((p) => num(p, 'y1')).sort((a, b) => a - b);
    expect(tips).toEqual(wires);
    expect(new Set(tips).size).toBe(2);
  });

  it('keeps the two poles clearly apart at every trolley size, never one merged pole', () => {
    const [p, q] = [...art.querySelectorAll('[data-part="pole"]')].map(
      (l) => [[num(l, 'x1'), num(l, 'y1')], [num(l, 'x2'), num(l, 'y2')]] as [Point, Point],
    );
    const stroke = Number.parseFloat(cssValue('.v-pole', 'stroke-width') ?? 'NaN');
    const units = Number(art.getAttribute('viewBox')!.split(' ')[2]);
    const widths = [vehicleWidths('phone'), vehicleWidths('desktop')].flatMap((w) => [w.trolleyRacing, w.trolleyFinished]);
    for (const width of widths) {
      // The dark gap between the two strokes, in CSS pixels.
      const gap = ((segmentDistance(p!, q!) - stroke) * width) / units;
      expect(gap, `${width} px`).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('runs on tyres with concentric hub rings, and has no rails', () => {
    expect(count(host, 'tyre')).toBe(2);
    expect(count(host, 'rim')).toBe(2);
    expect(count(host, 'hub')).toBe(2);
    expect(markup).not.toMatch(/rail/i);
    for (const wheel of art.querySelectorAll('[data-part="wheel"]')) {
      const radii = [...wheel.querySelectorAll('circle')].map((c) => num(c, 'r'));
      expect(new Set([...wheel.querySelectorAll('circle')].map((c) => `${c.getAttribute('cx')},${c.getAttribute('cy')}`)).size).toBe(1);
      expect(radii).toEqual([...radii].sort((a, b) => b - a));
    }
  });

  it('keeps at most one faint mark on each hub, so turning still shows', () => {
    for (const hub of art.querySelectorAll('[data-part="hub"]')) expect(hub.querySelectorAll('.v-hub-mark')).toHaveLength(1);
    expect(Number(cssValue('.v-hub-mark', 'stroke-opacity'))).toBeLessThanOrEqual(0.5);
  });

  it('has the body of screen-brief 3A.2', () => {
    expect(count(host, 'body')).toBe(1);
    expect(count(host, 'window')).toBe(5);
    expect(count(host, 'cab-window')).toBe(1);
    expect(count(host, 'door')).toBe(2);
    expect(count(host, 'passenger')).toBe(3);
    expect(count(host, 'belt')).toBe(2);
    expect(count(host, 'trim')).toBe(1);
    expect(count(host, 'destination-sign')).toBe(1);
    expect(count(host, 'headlamp')).toBe(1);
    expect(count(host, 'bumper')).toBe(2);
    expect(count(host, 'pole-base')).toBe(1);
  });

  it('is lit from inside: a warm body fill with the glass cut out', () => {
    const fill = art.querySelector('.v-body-fill')!;
    expect(fill.getAttribute('fill-rule')).toBe('evenodd');
    for (const frame of art.querySelectorAll('[data-part="window"] .v-frame')) {
      expect(fill.getAttribute('d')).toContain(frame.getAttribute('d'));
    }
    expect(Number(cssValue('.v-body-fill', 'fill-opacity'))).toBeGreaterThan(0.15);
  });

  it('shows each passenger as a dark gap in a bright pane', () => {
    for (const passenger of art.querySelectorAll('[data-part="passenger"]')) {
      const glass = passenger.parentElement!.querySelector('.v-glass')!;
      expect(glass.getAttribute('fill-rule')).toBe('evenodd');
      expect(glass.getAttribute('d')).toContain(passenger.getAttribute('d'));
    }
    expect(Number(cssValue('.v-passenger', 'fill-opacity'))).toBeLessThan(Number(cssValue('.v-glass', 'fill-opacity')));
  });

  it('draws its glow as two separate layers under the drawing, with no named parts', () => {
    const layers = [...host.querySelectorAll('svg')].map((s) => s.getAttribute('class'));
    expect(layers).toEqual(['trolley-glow trolley-glow-wide', 'trolley-glow trolley-glow-tight', 'trolley-art']);
    for (const glow of host.querySelectorAll('.trolley-glow')) expect(glow.querySelectorAll('[data-part]')).toHaveLength(0);
  });

  it('keeps the poles out of the tight glow, so the gap between them stays dark', () => {
    expect(host.querySelector('.trolley-glow-tight line')).toBeNull();
  });

  it('shows the route number from index.json on the rear panel, and leaves it out when there is none', () => {
    expect(routeNumber).not.toBeNull();
    const number = art.querySelector('[data-part="route-number"]');
    expect(number?.textContent).toBe(routeNumber);
    for (const width of [ROUTE_NUMBER_MIN_WIDTH, 200, 360]) {
      expect(mount(trolleySvg({ routeNumber: null, width })).querySelector('[data-part="route-number"]'), `${width}`).toBeNull();
      expect(mount(trolleySvg({ routeNumber: null, width })).textContent, `${width}`).toBe('');
    }
  });

  it('hides the route number on trolleys narrower than the cut-off, and shows it from there up', () => {
    const shown = (width: number): boolean =>
      mount(trolleySvg({ routeNumber, width })).querySelector('[data-part="route-number"]') !== null;
    const sizes = [vehicleWidths('phone'), vehicleWidths('desktop')].flatMap((w) => [w.trolleyRacing, w.trolleyFinished]);
    for (const width of [...sizes, 360]) expect(shown(width), `${width} px`).toBe(width >= ROUTE_NUMBER_MIN_WIDTH);
    expect(shown(ROUTE_NUMBER_MIN_WIDTH - 1)).toBe(false);
    expect(shown(ROUTE_NUMBER_MIN_WIDTH)).toBe(true);
    // The phone's finished trolley (104 px) carries no number; racing (150 px) and desktop (200 px) do.
    expect(shown(vehicleWidths('phone').trolleyFinished)).toBe(false);
    expect(shown(vehicleWidths('phone').trolleyRacing)).toBe(true);
    expect(shown(vehicleWidths('desktop').trolleyRacing)).toBe(true);
  });

  it('places the number as in mockup 18: under the first window, between the belt rails and the lower trim', () => {
    const number = art.querySelector('[data-part="route-number"]')!;
    const firstWindow = /^M([\d.]+) /.exec(art.querySelector('[data-part="window"] .v-frame')!.getAttribute('d')!)!;
    const left = Number(firstWindow[1]);
    const ys = (part: string): number[] =>
      [...art.querySelectorAll(`[data-part="${part}"]`)].flatMap((p) => [...p.getAttribute('d')!.matchAll(/M[\d.]+ ([\d.]+)/g)].map((m) => Number(m[1])));
    expect(num(number, 'x')).toBeGreaterThanOrEqual(left);
    expect(num(number, 'x')).toBeLessThan(left + 17);
    expect(num(number, 'y')).toBeGreaterThan(Math.max(...ys('belt')));
    expect(num(number, 'y')).toBeLessThan(Math.min(...ys('trim')));
  });

  it('escapes the route number', () => {
    const odd = mount(trolleySvg({ routeNumber: '<b>&', width: ROUTE_NUMBER_MIN_WIDTH }));
    expect(odd.querySelector('b')).toBeNull();
    expect(odd.querySelector('[data-part="route-number"]')?.textContent).toBe('<b>&');
  });

  it('keeps the 240 x 104 view box, so its height at each width is as before', () => {
    for (const svg of host.querySelectorAll('svg')) expect(svg.getAttribute('viewBox')).toBe('0 0 240 104');
  });
});

describe('the map marker', () => {
  const host = mount(markerSvg({ width: VEHICLE_SIZES.phone.mapMarker }));

  it('is the simplified drawing: body, window strip, two wheels and two poles, no wires', () => {
    expect(count(host, 'body')).toBe(1);
    expect(count(host, 'window-strip')).toBe(1);
    expect(count(host, 'wheel')).toBe(2);
    expect(count(host, 'pole')).toBe(2);
    expect(count(host, 'wire')).toBe(0);
    expect(host.querySelector('[data-part="route-number"]')).toBeNull();
  });
});

describe("today's bus", () => {
  const markup = busSvg({ width: VEHICLE_SIZES.phone.bus });
  const host = mount(markup);

  it('is flat and plain: no pole, wire, shoe, rope or glow', () => {
    for (const part of ['pole', 'wire', 'shoe', 'rope']) expect(count(host, part), part).toBe(0);
    expect(markup).not.toMatch(/glow/);
    expect(count(host, 'wheel')).toBe(2);
  });
});

describe('every drawing', () => {
  const drawings = [
    trolleySvg({ routeNumber, width: 150 }),
    trolleySvg({ routeNumber: null, width: 104 }),
    markerSvg({ width: 28 }),
    busSvg({ width: 84 }),
  ];

  it('is hidden from screen readers and never takes focus', () => {
    for (const markup of drawings) {
      for (const svg of mount(markup).querySelectorAll('svg')) {
        expect(svg.getAttribute('aria-hidden')).toBe('true');
        expect(svg.getAttribute('focusable')).toBe('false');
      }
    }
  });

  it('is drawn at the width it is given', () => {
    for (const [markup, width] of [
      [trolleySvg({ routeNumber, width: 150 }), '150'],
      [markerSvg({ width: 58 }), '58'],
      [busSvg({ width: 104 }), '104'],
    ] as const) {
      for (const svg of mount(markup).querySelectorAll('svg')) expect(svg.getAttribute('width')).toBe(width);
    }
  });

  it('carries no colour in its markup: colours come from vehicles.css', () => {
    for (const markup of drawings) expect(markup).not.toMatch(/\s(fill|stroke|color)="|#[0-9a-f]{3,8}\b|rgb\(/i);
  });

  it('paints the trolley in --ghost and --lit only, and the bus never in them', () => {
    const colour = /(?:^|;|\s)(fill|stroke|color|background(?:-color)?|stop-color|flood-color)\s*:\s*([^;]+)/g;
    for (const { selector, body } of cssRules()) {
      const values = [...body.matchAll(colour)].map((m) => m[2]!.trim());
      if (/\.(v-|trolley)/.test(selector)) {
        for (const value of values) expect(['var(--ghost)', 'var(--lit)', 'none'], `${selector}: ${value}`).toContain(value);
      }
      if (/\.b-/.test(selector)) expect(body, selector).not.toMatch(/--ghost|--lit/);
      if (/\.(v|m)-|trolley/.test(selector)) expect(body, selector).not.toMatch(/--today/);
    }
  });
});

describe('vehicle sizes', () => {
  const ui = readRepoText('.kiro/steering/ui.md').replace(/\s+/g, ' ');
  const brief = readRepoText('docs/planning/screen-brief.md');

  it('come from config.ts, which matches ui.md and screen-brief 3A.2', () => {
    const trolley = /Phone: (\d+) px wide while racing, (\d+) px after the finish\. Desktop: (\d+) px\./.exec(ui)!;
    const bus = /Today's bus is flat and plain, (\d+) px on a phone and (\d+) px on desktop/.exec(ui)!;
    const marker = /(\d+) px wide on a phone map and (\d+) px on desktop/.exec(brief)!;
    expect(vehicleWidths('phone')).toEqual({
      trolleyRacing: Number(trolley[1]),
      trolleyFinished: Number(trolley[2]),
      bus: Number(bus[1]),
      marker: Number(marker[1]),
    });
    expect(vehicleWidths('desktop')).toEqual({
      trolleyRacing: Number(trolley[3]),
      trolleyFinished: Number(trolley[3]),
      bus: Number(bus[2]),
      marker: Number(marker[2]),
    });
  });
});
