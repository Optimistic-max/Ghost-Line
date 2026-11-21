// The map area (design 12): the route drawing once route.geojson arrives, then
// the map chunk; the line of text (the credit, or the notice when the map is
// unavailable); the desktop hint strip while a pair is picked on the map; and
// the trolley marker, moved along the route during the 1938 ride (R5.9).
// Positions come from layout.ts; nothing here does arithmetic.
//
// Desktop loads the map chunk when the page is idle. On a phone the area is
// first the 100 px strip of the route drawing with a View route button: no map
// code is imported and no tile is asked for until the button is pressed
// (story-layer Req 12.3, 12.8 to 12.10). Hide route removes the map and draws
// the strip again. The race never waits for any of it, and no map failure
// touches the data state.
import { FIXTURE_LINE, TIMINGS } from '../config';
import {
  HIDE_ROUTE,
  MAP_CREDIT,
  MAP_UNAVAILABLE,
  MAP_UNAVAILABLE_NO_DRAWING,
  PICKER_STEP_END,
  PICKER_STEP_START,
  VIEW_ROUTE,
} from '../copy/copy';
import { pairKey } from '../data/files';
import type { Loader } from '../data/load';
import type { Index, Pair, RaceFile, Route } from '../data/types';
import type { MapHandle, MapStart } from '../map/map';
import { type DrawingPlan, routeDrawing } from '../map/routedrawing';
import type { Action } from '../state/actions';
import type { AppState } from '../state/model';
import { h, setVar } from './dom';
import { trackPoint } from './layout';
import { type Layout, markerSvg, vehicleWidths } from './vehicles';

type Direction = RaceFile['direction'];

/** What the lazy map chunk offers (map/map.ts). */
export type MapModule = { startMap(start: MapStart): MapHandle };

export type MapViewDeps = {
  doc: Document;
  area: HTMLElement;
  loader: Loader;
  layout: () => Layout;
  state: () => AppState;
  dispatch: (action: Action) => void;
  /** Loads the map chunk; without it the drawing stays as it is (tests). */
  loadMap: (() => Promise<MapModule>) | null;
  /** Runs once the page is idle, or after `timeoutMs` at the latest. */
  whenIdle: (run: () => void, timeoutMs: number) => void;
  /** The app's shell is still on the page. */
  onPage: () => boolean;
};

export type MapView = {
  /** Every store change: the drawing for the pair and layout, the lines, the hint, the marker at rest. */
  sync(state: AppState): void;
  /** The race card is on screen: load the route, then the map when the page is idle (R2.4). */
  painted(): void;
  /** The 1938 ride's progress, 0 to 1, from the race clock. */
  ride(progress: number): void;
};

/** The made-up line has no map: its area shows only the fixture tag (mockups 21 and 25). */
function hasMap(state: AppState): state is AppState & { data: { status: 'ready'; index: Index } } {
  return state.data.status === 'ready' && state.data.index.line !== FIXTURE_LINE;
}

function samePair(a: Pair, b: Pair): boolean {
  return a.origin === b.origin && a.dest === b.dest;
}

export function createMapView(deps: MapViewDeps): MapView {
  const { doc, area, loader } = deps;
  const notice = h('p', { class: 'map-notice', hidden: true }, MAP_UNAVAILABLE);
  const credit = h('p', { class: 'map-credit', hidden: true }, MAP_CREDIT);
  const hint = h('p', { class: 'map-hint', hidden: true });
  const trolley = h('div', { class: 'drawing-marker', 'aria-hidden': 'true', hidden: true });
  // The phone's View route / Hide route button (Req 12.8); never shown on desktop.
  const toggle = h(
    'button',
    { type: 'button', class: 'route-toggle', 'aria-expanded': 'false', 'aria-controls': area.id || null, hidden: true },
    VIEW_ROUTE,
  );
  area.append(h('div', { class: 'map-lines' }, notice, credit), hint, trolley, toggle);
  toggle.addEventListener('click', () => deps.dispatch({ type: 'route/toggle' }));

  let route: Route | null = null;
  let routeLoading = false;
  /** painted() asks once; only View route asks again after a failure. */
  let routeAsked = false;
  let drawing: {
    svg: SVGSVGElement;
    plan: DrawingPlan;
    pair: Pair;
    layout: Layout;
    direction: Direction | null;
    preview: boolean;
  } | null = null;
  let progress = 0;
  let map: MapHandle | null = null;
  let mapLayout: Layout | null = null;
  let mapCanvas: HTMLElement | null = null;
  /** Counts map starts and stops, so a chunk that arrives after Hide route does nothing. */
  let attempt: object = {};
  /** The idle callback has run: a desktop map may start whenever the route is in. */
  let idleDone = false;
  let lastRouteOpen = false;
  let markerLayout: Layout | null = null;
  let hovering = false;

  function areaSize(): { width: number; height: number } | undefined {
    const { clientWidth: width, clientHeight: height } = area;
    return width > 0 && height > 0 ? { width, height } : undefined;
  }

  /**
   * The drawing for the pair and layout on screen. It is drawn again once the pair's race file is in: its
   * direction gives the trolley marker's track, which the street names keep clear of where the marker stands.
   * On a phone with the route closed it is the 100 px strip (Req 12.3).
   */
  function drawFor(state: AppState & { data: { status: 'ready'; index: Index } }, layout: Layout): void {
    if (!route) return;
    const preview = layout === 'phone' && !state.routeOpen;
    const direction = state.data.races.get(pairKey(state.pair))?.direction ?? null;
    if (
      drawing &&
      samePair(drawing.pair, state.pair) &&
      drawing.layout === layout &&
      drawing.direction === direction &&
      drawing.preview === preview
    ) {
      return;
    }
    const made = routeDrawing(doc, { index: state.data.index, route, pair: state.pair, layout, size: areaSize(), direction, preview });
    if (drawing) drawing.svg.replaceWith(made.svg);
    else if (mapCanvas) mapCanvas.after(made.svg);
    else area.prepend(made.svg);
    drawing = { svg: made.svg, plan: made.plan, pair: state.pair, layout, direction, preview };
    map?.corners(made.plan);
  }

  /** The trolley marker at the current progress: on the map once it is drawn, on the drawing until then. */
  function placeMarker(state: AppState, layout: Layout): void {
    const track = drawing?.plan.track ?? null;
    const point = track ? trackPoint(track, progress) : null;
    const onMap = state.mapStatus === 'ready' && map !== null;
    map?.marker(onMap ? point : null);
    trolley.hidden = onMap || !point || !drawing;
    if (trolley.hidden || !point || !drawing) return;
    if (markerLayout !== layout) {
      markerLayout = layout;
      trolley.innerHTML = markerSvg({ width: vehicleWidths(layout).marker });
    }
    const at = drawing.plan.project(point);
    setVar(trolley, '--mx', `${at.x}px`);
    setVar(trolley, '--my', `${at.y}px`);
  }

  /** The desktop hint strip: the picker's step line while a pair is picked on the map, or on a corner under the pointer. */
  function syncHint(state: AppState, layout: Layout): void {
    const picking = state.picker !== null && state.sheet === null;
    const text = picking ? (state.picker?.step === 'end' ? PICKER_STEP_END : PICKER_STEP_START) : hovering ? PICKER_STEP_START : '';
    hint.hidden = layout !== 'desktop' || text === '' || !drawing;
    if (hint.textContent !== text) hint.textContent = text;
  }

  /** No map instance and no further tiles: the map, its canvas and any chunk still arriving are dropped. */
  function stopMap(): void {
    attempt = {};
    map?.remove();
    map = null;
    mapLayout = null;
    mapCanvas?.remove();
    mapCanvas = null;
  }

  function startMap(): void {
    const loadMap = deps.loadMap;
    const state = deps.state();
    if (!loadMap || !route || !drawing || !hasMap(state) || !deps.onPage() || state.mapStatus === 'unavailable') return;
    const layout = deps.layout();
    // On a phone nothing of the map starts until View route is pressed (Req 12.3).
    if (layout === 'phone' && !state.routeOpen) return;
    if (map || mapLayout !== null) return;
    const mine = {};
    attempt = mine;
    const { index } = state.data;
    const plan = drawing.plan;
    mapLayout = layout;
    loadMap().then(
      (chunk) => {
        if (attempt !== mine) return;
        if (!deps.onPage() || mapLayout !== layout || !route) {
          mapLayout = null;
          return;
        }
        const canvas = h('div', { class: 'map-canvas' });
        mapCanvas = canvas;
        area.prepend(canvas);
        map = chunk.startMap({
          container: canvas,
          index,
          route,
          layout,
          plan,
          reduced: deps.state().motion === 'reduced',
          ready: () => deps.dispatch({ type: 'map/status', status: 'ready' }),
          failed: (cause) => {
            if (mapCanvas === canvas) stopMap();
            // Kept on the element for the browser checks; never shown.
            area.dataset['mapFailed'] = cause;
            deps.dispatch({ type: 'map/status', status: 'unavailable' });
          },
        });
        // The drawing may have been redrawn for another pair while the chunk loaded.
        if (drawing) map.corners(drawing.plan);
      },
      () => {
        if (attempt !== mine) return;
        mapLayout = null;
        area.dataset['mapFailed'] = 'import';
        deps.dispatch({ type: 'map/status', status: 'unavailable' });
      },
    );
  }

  /** View route or Hide route was pressed on a phone (Req 12.8, 12.9). */
  function routeToggled(open: boolean): void {
    delete area.dataset['mapFailed'];
    if (open) {
      // A failed map or route is tried again.
      if (deps.state().mapStatus === 'unavailable') deps.dispatch({ type: 'map/status', status: 'pending' });
      if (!route) askRoute();
      return;
    }
    stopMap();
    if (deps.state().mapStatus !== 'pending') deps.dispatch({ type: 'map/status', status: 'pending' });
  }

  function sync(first: AppState): void {
    const layout = deps.layout();
    if (first.routeOpen !== lastRouteOpen) {
      lastRouteOpen = first.routeOpen;
      if (layout === 'phone') routeToggled(first.routeOpen);
    }
    const state = deps.state();
    if (hasMap(state)) drawFor(state, layout);
    // A change of layout draws the map again for the new one, or drops it on a phone with the route closed.
    if (map && mapLayout !== null && mapLayout !== layout && state.mapStatus !== 'unavailable') {
      stopMap();
      queueMicrotask(() => {
        deps.dispatch({ type: 'map/status', status: 'pending' });
        startMap();
      });
    } else if (route && !map && mapLayout === null && hasMap(state) && state.mapStatus !== 'unavailable') {
      // The map starts here when the visitor asked for it (phone) or the idle load has already run (desktop).
      if (layout === 'phone' ? state.routeOpen : idleDone) startMap();
    }
    // The phone's map area is the 100 px strip unless the route is open (or the made-up line has no map to preview).
    const expanded = layout !== 'phone' || state.routeOpen || (state.data.status === 'ready' && !hasMap(state));
    doc.documentElement.dataset['route'] = expanded ? 'open' : 'strip';
    const unavailable = state.mapStatus === 'unavailable';
    const preview = drawing?.preview === true;
    // "Showing the route diagram" only while the drawing is on screen; without route.geojson there is none.
    const noticeText = drawing?.svg.isConnected ? MAP_UNAVAILABLE : MAP_UNAVAILABLE_NO_DRAWING;
    if (notice.textContent !== noticeText) notice.textContent = noticeText;
    notice.hidden = !unavailable;
    // The strip has no map, so it has no map credit.
    credit.hidden = unavailable || drawing === null || preview;
    drawing?.svg.classList.toggle('is-faded', state.mapStatus === 'ready');
    toggle.hidden = layout !== 'phone' || !hasMap(state);
    const label = state.routeOpen ? HIDE_ROUTE : VIEW_ROUTE;
    if (toggle.textContent !== label) toggle.textContent = label;
    toggle.setAttribute('aria-expanded', String(state.routeOpen));
    // At rest the trolley waits at the origin; after the finish it stands short of the destination.
    if (state.race.phase !== 'running') progress = state.race.phase === 'finished' ? 1 : 0;
    placeMarker(state, layout);
    syncHint(state, layout);
  }

  /** Fetch route.geojson once the card is on screen; the map follows when the page is idle (desktop) or on View route (phone). */
  function askRoute(): void {
    if (routeLoading || route) return;
    routeLoading = true;
    void loader.route().then((loaded) => {
      routeLoading = false;
      if (!deps.onPage()) return;
      if (!loaded) {
        deps.dispatch({ type: 'map/status', status: 'unavailable' });
        return;
      }
      route = loaded;
      sync(deps.state());
      if (deps.loadMap) {
        deps.whenIdle(() => {
          idleDone = true;
          startMap();
        }, TIMINGS.mapIdleMs);
      }
    });
  }

  const hover = (over: boolean): void => {
    if (over === hovering) return;
    hovering = over;
    syncHint(deps.state(), deps.layout());
  };
  area.addEventListener('mouseover', (event) => hover((event.target as Element | null)?.closest('[data-action="map-corner"]') != null));
  area.addEventListener('mouseleave', () => hover(false));

  return {
    sync,
    painted() {
      if (routeAsked || !hasMap(deps.state())) return;
      routeAsked = true;
      askRoute();
    },
    ride(next) {
      progress = next;
      placeMarker(deps.state(), deps.layout());
    },
  };
}
