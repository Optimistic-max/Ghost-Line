// Task 16: the route drawing and the map area (R11.1, R11.2, R11.4, design 12.1).
// The drawing is built from the fixture's route and from the real one; the page
// draws it once route.geojson arrives after the first race card, keeps the plain
// background before that, and shows "Map unavailable" only on failure.
import { afterEach, describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import { MAP_CREDIT, MAP_INFERRED, MAP_UNAVAILABLE } from '../../src/copy/copy';
import type { Index, Pair, Route } from '../../src/data/types';
import { mapName, routeDrawing } from '../../src/map/routedrawing';
import type { Layout } from '../../src/view/vehicles';
import { stylesheets } from '../support/css';
import { FIXTURE_DIR, fixtureData } from '../support/fixture';
import { bootPage, mountPage } from '../support/page';
import { realData, slugNamed } from '../support/realdata';

afterEach(() => {
  document.body.innerHTML = '';
  window.history.replaceState(null, '', '/');
});

/** Let the loader's promises and the route request settle. */
async function settle(): Promise<void> {
  for (let k = 0; k < 5; k += 1) await new Promise((done) => setTimeout(done, 0));
}

const draw = (index: Index, route: Route, pair: Pair, layout: Layout): SVGSVGElement =>
  routeDrawing(document, { index, route, pair, layout }).svg;
const names = (svg: Element): string[] => [...svg.querySelectorAll('.corner-name')].map((t) => t.textContent ?? '');
const streetLabels = (svg: Element): string[] => [...svg.querySelectorAll('.street-label')].map((t) => t.textContent ?? '');
const dot = (svg: Element, slug: string): Element => svg.querySelector(`.corner[data-slug="${slug}"] .corner-dot`)!;

describe('the drawing from the fixture route (16.3)', () => {
  const { index, route } = fixtureData();
  const pair: Pair = index.pairs[0]!;

  it('draws one leg per feature of the file, in the drawing and nowhere else', () => {
    for (const layout of ['phone', 'desktop'] as const) {
      const svg = draw(index, route, pair, layout);
      expect(svg.querySelectorAll('.route-legs .leg')).toHaveLength(route.features.length);
      expect([...svg.querySelectorAll('.leg')].map((l) => l.getAttribute('data-street'))).toEqual(
        route.features.map((f) => f.properties.street),
      );
    }
  });

  it('dashes exactly the inferred legs, and gives them no blurred copy', () => {
    const svg = draw(index, route, pair, 'desktop');
    const inferred = route.features.filter((f) => f.properties.method === 'inferred').length;
    expect(inferred).toBeGreaterThan(0);
    const dashed = [...svg.querySelectorAll('.leg-inferred')];
    expect(dashed).toHaveLength(inferred);
    for (const leg of dashed) expect(leg.getAttribute('data-method')).toBe('inferred');
    expect(svg.querySelectorAll('.leg-glow')).toHaveLength(route.features.length - inferred);
  });

  it('names all five corners on desktop and only the chosen two on a phone', () => {
    const desktop = draw(index, route, pair, 'desktop');
    expect(names(desktop).sort()).toEqual(index.corners.map(mapName).sort());
    const phone = draw(index, route, pair, 'phone');
    expect(names(phone)).toEqual([pair.origin, pair.dest].map((slug) => mapName(index.corners.find((c) => c.slug === slug)!)));
    // Every corner keeps its dot on both layouts.
    for (const svg of [desktop, phone]) expect(svg.querySelectorAll('.corner-dot')).toHaveLength(index.corners.length);
  });

  it('fills the origin, rings the destination, dashes the inferred corner and adds "(inferred)" to its name', () => {
    const svg = draw(index, route, pair, 'desktop');
    expect(dot(svg, pair.origin).classList.contains('is-origin')).toBe(true);
    expect(dot(svg, pair.dest).classList.contains('is-dest')).toBe(true);
    const inferred = index.corners.find((c) => c.inferred)!;
    expect(dot(svg, inferred.slug).classList.contains('is-inferred')).toBe(true);
    expect(names(svg)).toContain(`${inferred.name} ${MAP_INFERRED}`);
    for (const c of index.corners.filter((c) => !c.inferred)) expect(dot(svg, c.slug).classList.contains('is-inferred')).toBe(false);
  });

  it('sets street names only from the features, along a line of their own', () => {
    const svg = draw(index, route, pair, 'desktop');
    const streets = new Set(route.features.map((f) => f.properties.street));
    for (const label of streetLabels(svg)) expect(streets.has(label), label).toBe(true);
    for (const path of svg.querySelectorAll('.street-label textPath')) {
      expect(svg.querySelector(path.getAttribute('href')!)).not.toBeNull();
    }
  });

  it('is decorative: hidden from screen readers and holds nothing to focus', () => {
    const svg = draw(index, route, pair, 'phone');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelectorAll('a, button, [tabindex]')).toHaveLength(0);
  });
});

describe('the drawing from the real route', () => {
  const { index, route } = realData();
  const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
  const inferredPair: Pair = { origin: slugNamed('Brevard & Preston'), dest: slugNamed('Aliceanna & Bond') };

  it('draws every leg of route.geojson and dashes its inferred stretch', () => {
    const svg = draw(index, route, lead, 'desktop');
    expect(svg.querySelectorAll('.route-legs .leg')).toHaveLength(route.features.length);
    expect(svg.querySelectorAll('.leg-inferred')).toHaveLength(route.features.filter((f) => f.properties.method === 'inferred').length);
  });

  it('names the route streets that fit along their legs, and never a street twice', () => {
    for (const layout of ['phone', 'desktop'] as const) {
      const labels = streetLabels(draw(index, route, lead, layout));
      expect(labels.length, layout).toBeGreaterThan(0);
      expect(new Set(labels).size, layout).toBe(labels.length);
    }
  });

  it('on a phone, hides the names of the streets that meet the inferred stretch when the inferred corner is chosen (R11.2)', () => {
    const phoneLead = streetLabels(draw(index, route, lead, 'phone'));
    const phoneInferred = streetLabels(draw(index, route, inferredPair, 'phone'));
    const desktopInferred = streetLabels(draw(index, route, inferredPair, 'desktop'));
    // The brief names Dolphin St and Preston St: the two streets either side of the inferred stretch.
    for (const street of ['Dolphin Street', 'Preston Street']) {
      expect(phoneInferred).not.toContain(street);
      expect(desktopInferred).toContain(street);
    }
    expect(phoneLead).toContain('Preston Street');
    expect(names(draw(index, route, inferredPair, 'phone'))).toContain(`Brevard & Preston ${MAP_INFERRED}`);
  });

  it('keeps every corner name inside the drawing', () => {
    for (const layout of ['phone', 'desktop'] as const) {
      for (const pair of [lead, inferredPair]) {
        const svg = draw(index, route, pair, layout);
        const [, , width, height] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
        for (const t of svg.querySelectorAll('.corner-name')) {
          const x = Number(t.getAttribute('x'));
          const y = Number(t.getAttribute('y'));
          expect(x, `${layout} ${t.textContent}`).toBeGreaterThan(0);
          expect(x, `${layout} ${t.textContent}`).toBeLessThan(width!);
          expect(y, `${layout} ${t.textContent}`).toBeGreaterThan(0);
          expect(y, `${layout} ${t.textContent}`).toBeLessThan(height!);
        }
      }
    }
  });
});

describe('the map area on the page (16.1, 16.2)', () => {
  const area = (): HTMLElement => document.getElementById('map-area')!;
  const notice = (): HTMLElement => area().querySelector('.map-notice')!;
  const credit = (): HTMLElement => area().querySelector('.map-credit')!;

  it('is the plain background until route.geojson arrives, which waits for the first race card', async () => {
    const app = mountPage();
    expect(area().querySelector('.route-drawing')).toBeNull();
    expect(notice().hidden).toBe(true);
    expect(credit().hidden).toBe(true);
    await app.boot();
    expect(document.querySelector('#card-scroll .lanes')).not.toBeNull();
    await settle();
    expect(area().querySelectorAll('.route-drawing')).toHaveLength(1);
  });

  it('shows the credit line with the route, and the notice not at all while nothing has failed', async () => {
    const app = await bootPage();
    await settle();
    expect(credit().hidden).toBe(false);
    expect(credit().textContent).toBe(MAP_CREDIT);
    expect(notice().hidden).toBe(true);
    expect(notice().textContent).toBe(MAP_UNAVAILABLE);
    expect(app.store.get().mapStatus).toBe('pending');
  });

  it('shows "Map unavailable" when route.geojson fails, keeps the plain background, and races as usual', async () => {
    const app = await bootPage({ fail: new Set(['route.geojson']) });
    await settle();
    expect(app.store.get().mapStatus).toBe('unavailable');
    expect(app.store.get().data.status).toBe('ready');
    expect(notice().hidden).toBe(false);
    expect(credit().hidden).toBe(true);
    expect(area().querySelector('.route-drawing')).toBeNull();
    expect(document.querySelector('#card-scroll .lanes')).not.toBeNull();
  });

  it('keeps the drawing and shows the notice when the map is unavailable (R11.4)', async () => {
    const app = await bootPage();
    await settle();
    app.store.dispatch({ type: 'map/status', status: 'unavailable' });
    expect(area().querySelectorAll('.route-drawing')).toHaveLength(1);
    expect(notice().hidden).toBe(false);
    expect(credit().hidden).toBe(true);
  });

  it('draws the pair on screen: a swap moves the filled dot to the new origin', async () => {
    const app = await bootPage();
    await settle();
    const before = area().querySelector('.route-drawing')!;
    expect(dot(before, LEAD_PAIR.origin).classList.contains('is-origin')).toBe(true);
    document.querySelector<HTMLElement>('[data-action="swap"]')!.click();
    const after = area().querySelector('.route-drawing')!;
    expect(after).not.toBe(before);
    expect(area().querySelectorAll('.route-drawing')).toHaveLength(1);
    expect(dot(after, LEAD_PAIR.dest).classList.contains('is-origin')).toBe(true);
    expect(dot(after, LEAD_PAIR.origin).classList.contains('is-dest')).toBe(true);
    expect(app.store.get().pair.origin).toBe(LEAD_PAIR.dest);
  });

  it('draws again for the other layout', async () => {
    let layout: Layout = 'phone';
    const app = await bootPage({ layout: () => layout });
    await settle();
    expect(names(area().querySelector('.route-drawing')!)).toHaveLength(2);
    layout = 'desktop';
    app.render();
    expect(names(area().querySelector('.route-drawing')!)).toHaveLength(realData().index.corners.length);
  });

  it('shows nothing but the fixture tag for the made-up line, which has no map', async () => {
    const pair = fixtureData().index.pairs[0]!;
    await bootPage({ folder: FIXTURE_DIR, query: `?from=${pair.origin}&to=${pair.dest}`, leadPair: pair });
    await settle();
    expect(area().querySelector('.route-drawing')).toBeNull();
    expect(notice().hidden).toBe(true);
    expect(credit().hidden).toBe(true);
    expect(area().querySelector<HTMLElement>('.fixture-tag')!.hidden).toBe(false);
  });
});

describe('the drawing stylesheet', () => {
  const css = stylesheets().get('web/src/styles/map.css')!;

  it('dashes the inferred legs and outlines the inferred dot with dashes', () => {
    expect(css).toMatch(/\.leg-inferred\s*\{[^}]*stroke-dasharray/);
    expect(css).toMatch(/\.corner-dot\.is-inferred\s*\{[^}]*stroke-dasharray/);
  });

  it('is imported by the first screen', () => {
    expect(stylesheets().get('web/src/styles/index.css')).toContain("@import './map.css';");
  });
});
