// Task 9.2: the vehicle drawings.
import { describe, expect, it } from 'vitest';
import { VEHICLE_SIZES } from '../../src/config';
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
const routeNumber = routeNumberOf(realData().index.line);

describe('the 1938 trackless trolley', () => {
  const markup = trolleySvg({ routeNumber, width: VEHICLE_SIZES.phone.trolleyRacing });
  const host = mount(markup);

  it('has exactly two poles, two shoes, two wires and two retriever ropes', () => {
    expect(count(host, 'pole')).toBe(2);
    expect(count(host, 'shoe')).toBe(2);
    expect(count(host, 'wire')).toBe(2);
    expect(count(host, 'rope')).toBe(2);
  });

  it('runs on tyres with hub rings, and has no rails', () => {
    expect(count(host, 'tyre')).toBe(2);
    expect(count(host, 'hub')).toBe(2);
    expect(markup).not.toMatch(/rail/i);
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

  it('draws its glow as two separate layers under the drawing, with no named parts', () => {
    const layers = [...host.querySelectorAll('svg')].map((s) => s.getAttribute('class'));
    expect(layers).toEqual(['trolley-glow trolley-glow-wide', 'trolley-glow trolley-glow-tight', 'trolley-art']);
    for (const glow of host.querySelectorAll('.trolley-glow')) expect(glow.querySelectorAll('[data-part]')).toHaveLength(0);
  });

  it('shows the route number from index.json, and leaves it out when there is none', () => {
    expect(routeNumber).not.toBeNull();
    expect(host.querySelector('[data-part="route-number"]')?.textContent).toBe(routeNumber);
    expect(mount(trolleySvg({ routeNumber: null, width: 104 })).querySelector('[data-part="route-number"]')).toBeNull();
    expect(mount(trolleySvg({ routeNumber: null, width: 104 })).textContent).toBe('');
  });

  it('escapes the route number', () => {
    const odd = mount(trolleySvg({ routeNumber: '<b>&', width: 104 }));
    expect(odd.querySelector('b')).toBeNull();
    expect(odd.querySelector('[data-part="route-number"]')?.textContent).toBe('<b>&');
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

  it('uses the trolley colours for the trolley and the bus colour for the bus', () => {
    const css = readRepoText('web/src/styles/vehicles.css');
    const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)];
    for (const [, selector, body] of rules) {
      const sel = selector!.trim();
      if (/\.b-/.test(sel)) expect(body, sel).not.toMatch(/--ghost|--lit/);
      if (/\.(v|m)-|trolley/.test(sel)) expect(body, sel).not.toMatch(/--today/);
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
