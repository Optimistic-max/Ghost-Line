// The map area (design 12): the route drawing once route.geojson arrives, then
// the map chunk when the page is idle; the line of text (the credit, or the
// notice when the map is unavailable); the desktop hint strip while a pair is
// picked on the map; and the trolley marker, moved along the route during the
// 1938 ride (R5.9). Positions come from layout.ts; nothing here does arithmetic.
// The race never waits for any of it, and no map failure touches the data state.
import { FIXTURE_LINE, MAP_LAYOUT, TIMINGS } from '../config';
import { MAP_CREDIT, MAP_UNAVAILABLE, PICKER_STEP_END, PICKER_STEP_START } from '../copy/copy';
import { pairKey } from '../data/files';
import type { Loader } from '../data/load';
import type { Index, Pair, RaceFile, Route } from '../data/types';
import type { MapHandle, MapStart } from '../map/map';
import { type DrawingPlan, routeDrawing } from '../map/routedrawing';
import type { Action } from '../state/actions';
import type { AppState } from '../state/model';
import { h, setVar } from './dom';
import { type Track, markerTrack, trackPoint } from './layout';
import { type Layout, markerSvg, vehicleWidths } from './vehicles';

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

/** The legs of the race's direction, in travel order, as [lon, lat] lines. */
function legsOf(route: Route, race: RaceFile): number[][][] {
  return route.features.filter((f) => f.properties.direction === race.direction).map((f) => f.geometry.coordinates);
}

export function createMapView(deps: MapViewDeps): MapView {
  const { doc, area, loader } = deps;
  const notice = h('p', { class: 'map-notice', hidden: true }, MAP_UNAVAILABLE);
  const credit = h('p', { class: 'map-credit', hidden: true }, MAP_CREDIT);
  const hint = h('p', { class: 'map-hint', hidden: true });
  const trolley = h('div', { class: 'drawing-marker', 'aria-hidden': 'true', hidden: true });
  area.append(h('div', { class: 'map-lines' }, notice, credit), hint, trolley);

  let route: Route | null = null;
  let routeAsked = false;
  let drawing: { svg: SVGSVGElement; plan: DrawingPlan; pair: Pair; layout: Layout } | null = null;
  let track: { key: string; track: Track } | null = null;
  let progress = 0;
  let map: MapHandle | null = null;
  let mapLayout: Layout | null = null;
  let mapCanvas: HTMLElement | null = null;
  let markerLayout: Layout | null = null;
  let hovering = false;

  function areaSize(): { width: number; height: number } | undefined {
    const { clientWidth: width, clientHeight: height } = area;
    return width > 0 && height > 0 ? { width, height } : undefined;
  }

  function drawFor(state: AppState & { data: { status: 'ready'; index: Index } }, layout: Layout): void {
    if (!route) return;
    if (drawing && samePair(drawing.pair, state.pair) && drawing.layout === layout) return;
    const made = routeDrawing(doc, { index: state.data.index, route, pair: state.pair, layout, size: areaSize() });
    if (drawing) drawing.svg.replaceWith(made.svg);
    else if (mapCanvas) mapCanvas.after(made.svg);
    else area.prepend(made.svg);
    drawing = { svg: made.svg, plan: made.plan, pair: state.pair, layout };
    map?.corners(made.plan);
  }

  /** The marker's track for the pair on screen, once its race file is in. */
  function trackFor(state: AppState, layout: Layout): void {
    if (!route || !drawing || state.data.status !== 'ready') return;
    const race = state.data.races.get(pairKey(state.pair));
    const key = `${pairKey(state.pair)} ${layout} ${drawing.plan.size.width} ${drawing.plan.size.height}`;
    if (!race) {
      track = null;
      return;
    }
    if (track?.key === key) return;
    const corner = (slug: string): readonly number[] | undefined => state.data.status === 'ready'
      ? state.data.index.corners.find((c) => c.slug === slug)?.lonlat
      : undefined;
    const origin = corner(state.pair.origin);
    const dest = corner(state.pair.dest);
    if (!origin || !dest) return;
    track = { key, track: markerTrack(legsOf(route, race), origin, dest, MAP_LAYOUT[layout].markerStop, drawing.plan.pxPerMetre) };
  }

  /** The trolley marker at the current progress: on the map once it is drawn, on the drawing until then. */
  function placeMarker(state: AppState, layout: Layout): void {
    const point = track ? trackPoint(track.track, progress) : null;
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

  function stopMap(): void {
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
    const { index } = state.data;
    const plan = drawing.plan;
    mapLayout = layout;
    loadMap().then(
      (chunk) => {
        if (!deps.onPage() || mapLayout !== layout || !route) return;
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
        area.dataset['mapFailed'] = 'import';
        deps.dispatch({ type: 'map/status', status: 'unavailable' });
      },
    );
  }

  function sync(state: AppState): void {
    const layout = deps.layout();
    if (hasMap(state)) {
      drawFor(state, layout);
      trackFor(state, layout);
    }
    // A change of layout draws the map again for the new one.
    if (map && mapLayout !== null && mapLayout !== layout && state.mapStatus !== 'unavailable') {
      stopMap();
      queueMicrotask(() => {
        deps.dispatch({ type: 'map/status', status: 'pending' });
        startMap();
      });
    }
    const unavailable = state.mapStatus === 'unavailable';
    notice.hidden = !unavailable;
    credit.hidden = unavailable || drawing === null;
    drawing?.svg.classList.toggle('is-faded', state.mapStatus === 'ready');
    // At rest the trolley waits at the origin; after the finish it stands short of the destination.
    if (state.race.phase !== 'running') progress = state.race.phase === 'finished' ? 1 : 0;
    placeMarker(state, layout);
    syncHint(state, layout);
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
      const state = deps.state();
      if (routeAsked || !hasMap(state)) return;
      routeAsked = true;
      void loader.route().then((loaded) => {
        if (!deps.onPage()) return;
        if (!loaded) {
          deps.dispatch({ type: 'map/status', status: 'unavailable' });
          return;
        }
        route = loaded;
        sync(deps.state());
        if (deps.loadMap) deps.whenIdle(startMap, TIMINGS.mapIdleMs);
      });
    },
    ride(next) {
      progress = next;
      placeMarker(deps.state(), deps.layout());
    },
  };
}
