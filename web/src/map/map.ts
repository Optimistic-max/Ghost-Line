// The map chunk (design 12.2 to 12.4): MapLibre GL JS with the OpenFreeMap dark
// style, recoloured to palette B by style.ts, loaded by a lazy import after the
// race card is on screen. Corners are DOM markers placed like the route
// drawing's (routedrawing.ts plans both), so their names, dashed outline and
// 44 px targets match it; a tap or click on one feeds the corner picker. The
// simplified trolley is a DOM marker moved with setLngLat, which MapLibre
// applies as a transform. Any failure before the first frame (no WebGL, the
// style or a tile failing, nothing drawn within the timeout) removes the map
// and reports it; the race never waits for any of this.
import { AttributionControl, type GeoJSONSource, Map as MapLibre, Marker, setWorkerUrl } from 'maplibre-gl';
// MapLibre's own stylesheet travels in this chunk as text and is added when the map loads, so the
// first screen keeps its one stylesheet.
import mapLibreCss from 'maplibre-gl/dist/maplibre-gl.css?inline';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { MAP_LAYOUT, SOURCE_URLS, TIMINGS } from '../config';
import type { Index, Route } from '../data/types';
import { lonLatBounds } from '../view/layout';
import { markerSvg, type Layout, vehicleWidths } from '../view/vehicles';
import { type DrawingPlan, drawingPoints } from './routedrawing';
import { NAMES_SOURCE, PALETTE_TOKENS, type Palette, mapStyle, namesData } from './style';

export type MapStart = {
  container: HTMLElement;
  index: Index;
  route: Route;
  layout: Layout;
  /** The route drawing's plan for the pair on screen: where the names go, which streets are named. */
  plan: DrawingPlan;
  /** No label fade-ins under reduced motion. */
  reduced: boolean;
  /** The first frame is drawn: the route drawing can fade out. */
  ready(): void;
  /** The map cannot be shown; the drawing stays (R11.4). */
  failed(cause: string): void;
};

export type MapHandle = {
  /** The corners for another pair (the plan of its drawing). */
  corners(plan: DrawingPlan): void;
  /** Where the trolley marker is, or null to hide it. */
  marker(point: [number, number] | null): void;
  remove(): void;
};

/** The palette-B colours from the page's tokens (tokens.css), so the map and the page cannot differ. */
function paletteOf(root: Element): Palette {
  const css = getComputedStyle(root);
  const entries = Object.entries(PALETTE_TOKENS).map(([key, token]) => [key, css.getPropertyValue(token).trim()]);
  return Object.fromEntries(entries) as Palette;
}

/** The display font's file: the one the page already preloads (index.html), so the map asks for nothing new. */
function displayFontUrl(doc: Document): string | null {
  return doc.querySelector<HTMLLinkElement>('link[rel="preload"][as="font"]')?.href ?? null;
}

/** MapLibre's stylesheet, added once. */
function addMapLibreCss(doc: Document): void {
  if (doc.getElementById('maplibre-css')) return;
  const style = doc.createElement('style');
  style.id = 'maplibre-css';
  style.textContent = mapLibreCss;
  doc.head.append(style);
}

/** Whether the browser can give the map a WebGL context. */
function hasWebGL(doc: Document): boolean {
  try {
    const canvas = doc.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** A corner's marker element: its dot (origin filled, destination a ring, the inferred one dashed) in a 44 px target. */
function cornerElement(doc: Document, plan: DrawingPlan, slug: string): HTMLElement {
  const dot = plan.dots.find((d) => d.corner.slug === slug);
  const el = doc.createElement('div');
  el.className = 'map-corner';
  el.dataset['action'] = 'map-corner';
  el.dataset['slug'] = slug;
  el.setAttribute('aria-hidden', 'true');
  if (!dot) return el;
  const ring = doc.createElement('span');
  ring.className = ['map-dot', `is-${dot.role}`, dot.corner.inferred ? 'is-inferred' : ''].filter(Boolean).join(' ');
  ring.style.setProperty('--r', `${dot.radius}px`);
  el.append(ring);
  return el;
}

export function startMap(start: MapStart): MapHandle {
  const { container, index, route, layout } = start;
  const doc = container.ownerDocument;
  const palette = paletteOf(doc.documentElement);
  let map: MapLibre | null = null;
  let ready = false;
  let over = false;
  let timer: number | null = null;
  let cornerMarkers: Marker[] = [];
  let trolley: Marker | null = null;
  /** The plan the map shows; a newer pair's arrives through corners(). */
  let current = start.plan;

  function remove(): void {
    over = true;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    cornerMarkers.forEach((m) => m.remove());
    cornerMarkers = [];
    trolley?.remove();
    trolley = null;
    map?.remove();
    map = null;
    container.replaceChildren();
  }

  function fail(cause: string): void {
    if (over || ready) return;
    remove();
    start.failed(cause);
  }

  /** The corners and the names for the pair on screen, as its route drawing places them. */
  function corners(plan: DrawingPlan): void {
    current = plan;
    if (!map || !ready) return;
    cornerMarkers.forEach((m) => m.remove());
    cornerMarkers = index.corners.map((c) =>
      new Marker({ element: cornerElement(doc, plan, c.slug), anchor: 'center' }).setLngLat([c.lonlat[0], c.lonlat[1]]).addTo(map!),
    );
    map.getSource<GeoJSONSource>(NAMES_SOURCE)?.setData(namesData(plan));
  }

  if (!hasWebGL(doc)) {
    // Reported after this returns, as every other failure is.
    queueMicrotask(() => fail('no WebGL'));
    return { corners() {}, marker() {}, remove };
  }

  try {
    addMapLibreCss(doc);
    setWorkerUrl(new URL(workerUrl, doc.baseURI).href);
    const look = MAP_LAYOUT[layout];
    const fontUrl = displayFontUrl(doc);
    map = new MapLibre({
      container,
      style: SOURCE_URLS.baseMapStyle,
      transformStyle: (_previous, next) => mapStyle(next, { palette, layout, route, names: current, fontUrl }),
      bounds: lonLatBounds(drawingPoints(index, route)),
      fitBoundsOptions: { padding: { ...look.padding } },
      interactive: false,
      attributionControl: false,
      fadeDuration: start.reduced ? 0 : 300,
    });
  } catch (error) {
    queueMicrotask(() => fail(error instanceof Error ? error.message : String(error)));
    return { corners() {}, marker() {}, remove };
  }

  // MapLibre adds the style's own attribution, bottom right beside the credit line. On a phone it is its compact
  // button, lifted clear of the card's rounded top (map.css); on desktop it is written out.
  map.addControl(new AttributionControl({ compact: layout === 'phone' }), 'bottom-right');
  // The style failing is final at once; a tile failing is covered by the timeout, since others may still arrive (design 12.3).
  map.on('error', (event) => {
    if (!('sourceId' in event) && !('tile' in event)) fail(event.error?.message ?? 'style error');
  });
  map.on('webglcontextlost', () => fail('WebGL context lost'));
  map.once('load', () => {
    if (over) return;
    ready = true;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    corners(current);
    // The compact attribution opens itself; on a map that never moves it would stay open over the route.
    container.querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show');
    start.ready();
  });
  timer = window.setTimeout(() => fail('timeout'), TIMINGS.mapTimeoutMs);

  const markerEl = doc.createElement('div');
  markerEl.className = 'map-trolley';
  markerEl.setAttribute('aria-hidden', 'true');
  markerEl.innerHTML = markerSvg({ width: vehicleWidths(layout).marker });

  return {
    corners,
    marker(point) {
      if (!map || !ready) return;
      if (!point) {
        trolley?.remove();
        trolley = null;
        return;
      }
      if (!trolley) trolley = new Marker({ element: markerEl, anchor: 'bottom' }).setLngLat(point).addTo(map);
      else trolley.setLngLat(point);
    },
    remove,
  };
}
