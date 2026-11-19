// The vehicles, as inline SVG markup (screen-brief 3A.2, design 14). Original
// drawings made for this site, not traced from a photograph or a scan.
//
// - The 1938 trackless trolley: side view facing right, 240 x 104 proportions.
//   A tall, rounded body lit from inside, bright windows with dark passenger
//   silhouettes, two separate trolley poles reaching two overhead wires, each
//   ending in a shoe, with two retriever ropes to the rear. Rubber tyres with
//   concentric hub rings, and no rails. Its glow is two blurred copies of the
//   drawing, each a separate element, so motion can change their opacity alone.
//   It is drawn in --ghost and --lit only; its dark parts are left unpainted.
// - The map marker: a separate simplified trolley for small sizes.
// - Today's bus: flat and plain, no poles, wires or glow.
//
// The drawings are decoration: the lane titles carry the words, so every SVG is
// aria-hidden. Sizes are style, not data (ui.md); they come from config.ts.
import { ROUTE_NUMBER_MIN_WIDTH, VEHICLE_SIZES } from '../config';

export type Layout = 'phone' | 'desktop';

export type VehicleWidths = { trolleyRacing: number; trolleyFinished: number; bus: number; marker: number };

/** Vehicle widths in CSS pixels for a layout (ui.md, screen-brief 3A.2). */
export function vehicleWidths(layout: Layout): VehicleWidths {
  if (layout === 'phone') {
    const s = VEHICLE_SIZES.phone;
    return { trolleyRacing: s.trolleyRacing, trolleyFinished: s.trolleyFinished, bus: s.bus, marker: s.mapMarker };
  }
  const s = VEHICLE_SIZES.desktop;
  return { trolleyRacing: s.trolley, trolleyFinished: s.trolley, bus: s.bus, marker: s.mapMarker };
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escape = (s: string): string => s.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);

function svg(className: string, viewBox: string, width: number, parts: string[]): string {
  return `<svg class="${className}" viewBox="${viewBox}" width="${width}" aria-hidden="true" focusable="false">${parts.join('')}</svg>`;
}

// ---- The 1938 trackless trolley -------------------------------------------------

// Geometry, in units of the 240 x 104 view box. The box keeps the proportions of
// screen-brief 3A.2, so a drawing's height follows from its width alone. Every
// coordinate is written out here; nothing is computed.
const TROLLEY_VIEWBOX = '0 0 240 104';

/**
 * The body: a tall 1930s car (mockup 18). Rounded rear, a gently crowned roof,
 * a front that curves down to the bumper, and wheel arches over both wheels.
 */
const BODY = [
  'M14 25.5 Q100 23.5 188 25.5', // roof
  'C208 26 222 34 228 48 C233 60 236 72 236 82 Q236 87.5 230.5 87.5', // front
  'L207 87.5 A17 17 0 0 0 173 87.5 L73 87.5 A17 17 0 0 0 39 87.5 L8 87.5', // floor and wheel arches
  'Q2.5 87.5 2.5 82 L2.5 36 Q2.5 25.5 14 25.5 Z', // rear
].join(' ');

/** The two overhead wires. */
const WIRE_HEIGHTS = [2.5, 11];

/**
 * The two trolley poles, from the shoe on each wire forward to the pole base
 * on the roof. They are parallel and about 7 units apart along their whole
 * length, so they stay two separate lines at the smallest size (104 px).
 */
const POLES: [shoeX: number, shoeY: number, baseX: number, baseY: number][] = [
  [6.5, 2.5, 98, 17.5],
  [14.5, 11, 106, 26],
];

/** The shoes, centred on the pole tips: top-left corner of each. */
const SHOES: [x: number, y: number][] = [
  [3, 1.3],
  [11, 9.8],
];

/** The retriever ropes, from each pole tip down to the rear of the car. */
const ROPES = ['M7 4 C3 12 2 22 2.6 32.5', 'M15 12.5 C10.5 17 8.5 21.5 8.4 26.3'];

/** Five side windows: three before the centre door, two between the doors. Left edges. */
const WINDOW_XS = [15, 38, 61, 109, 131];

/** The passengers sit in the second, fourth and fifth windows: each window's left edge and centre. */
const PASSENGER_WINDOWS: [windowX: number, cx: number][] = [
  [38, 46.5],
  [109, 117.5],
  [131, 139.5],
];

/** The cab window, following the curve of the front. */
const CAB = 'M179 34 L204 34 Q217 35 222.5 53 L179 53 Z';

/** The two double-leaf doors, centre and front: left edge and the line between the leaves. */
const DOORS: [x: number, split: number][] = [
  [83, 93],
  [152, 162],
];

/** The two belt rails, broken by the doors: height and where each ends at the front. */
const BELTS: [y: number, frontEnd: number][] = [
  [58.5, 229.5],
  [64.5, 231],
];

/** The lower trim line, broken by the wheel arches and the doors. */
const TRIM = 'M3 80 H38.5 M73.5 80 H83 M103 80 H152 M207.5 80 H233';

/** Wheel centres, under the arches. */
const WHEELS: [cx: number, cy: number][] = [
  [56, 88.5],
  [190, 88.5],
];

/** A window's outline: 17 x 19 units with rounded corners, from its left edge. */
function windowOutline(x: number): string {
  return `M${x} 36.5 a2.5 2.5 0 0 1 2.5 -2.5 h12 a2.5 2.5 0 0 1 2.5 2.5 v14 a2.5 2.5 0 0 1 -2.5 2.5 h-12 a2.5 2.5 0 0 1 -2.5 -2.5 Z`;
}

/** A passenger seen through a window: a head and shoulders, standing on the sill. */
function passenger(cx: number): string {
  return `M${cx} 42.8 m-3.2 0 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0 Z M${cx} 53 m-6 0 c0 -7.5 12 -7.5 12 0 Z`;
}

/** The body with the window glass cut out, so the light inside shows through the windows. */
const BODY_WITH_GLASS = [BODY, ...WINDOW_XS.map(windowOutline), CAB].join(' ');

/**
 * The drawing again, blurred, under the trolley, with no parts named (mockup 18).
 * The wide layer is the light inside the car (the body, with the glass cut out
 * so the passengers stay dark) and a soft halo round the outline, poles and
 * tyres. The tight layer keeps the outline and tyres crisp; it leaves out the
 * poles, so the gap between them stays dark.
 */
function trolleyGlow(wide: boolean): string[] {
  const inside = wide
    ? [
        `<path class="v-glow-body" fill-rule="evenodd" d="${BODY_WITH_GLASS}"/>`,
        '<g class="v-glow-poles">',
        ...POLES.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`),
        '</g>',
      ]
    : [];
  return [
    ...inside,
    '<g class="v-glow-lines">',
    `<path d="${BODY}"/>`,
    ...WHEELS.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="13"/>`),
    '</g>',
  ];
}

function trolleyArt(routeNumber: string | null): string[] {
  return [
    ...WIRE_HEIGHTS.map((y) => `<line class="v-wire" data-part="wire" x1="0" y1="${y}" x2="240" y2="${y}"/>`),
    ...ROPES.map((d) => `<path class="v-rope" data-part="rope" d="${d}"/>`),
    ...POLES.map(([x1, y1, x2, y2]) => `<line class="v-pole" data-part="pole" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`),
    ...SHOES.map(([x, y]) => `<rect class="v-shoe" data-part="shoe" x="${x}" y="${y}" width="7" height="2.4" rx="1"/>`),
    // The body is lit from inside: a warm fill with the glass cut out, then its outline.
    `<path class="v-body-fill" fill-rule="evenodd" d="${BODY_WITH_GLASS}"/>`,
    `<path class="v-body" data-part="body" d="${BODY}"/>`,
    '<rect class="v-pole-base" data-part="pole-base" x="92" y="17.5" width="30" height="8.5" rx="2"/>',
    // Bright panes. A passenger is a gap in the pane, so the dimmer car interior shows as a dark silhouette.
    ...WINDOW_XS.map((x) => {
      const seated = PASSENGER_WINDOWS.find(([wx]) => wx === x);
      const glass = seated ? `${windowOutline(x)} ${passenger(seated[1])}` : windowOutline(x);
      return [
        '<g data-part="window">',
        `<path class="v-glass" fill-rule="evenodd" d="${glass}"/>`,
        seated ? `<path class="v-passenger" data-part="passenger" d="${passenger(seated[1])}"/>` : '',
        `<path class="v-frame" d="${windowOutline(x)}"/>`,
        '</g>',
      ].join('');
    }),
    `<g data-part="cab-window"><path class="v-glass" d="${CAB}"/><path class="v-frame" d="${CAB}"/></g>`,
    // Two double-leaf doors, centre and front, nearly to the floor; the line between the leaves.
    ...DOORS.map(([x, split]) =>
      [
        '<g data-part="door">',
        `<rect class="v-door" x="${x}" y="33.5" width="20" height="50.5" rx="1.5"/>`,
        `<line class="v-door-split" x1="${split}" y1="33.5" x2="${split}" y2="84"/>`,
        '</g>',
      ].join(''),
    ),
    ...BELTS.map(
      ([y, end]) => `<path class="v-trim" data-part="belt" d="M3 ${y} H83 M103 ${y} H152 M172 ${y} H${end}"/>`,
    ),
    `<path class="v-trim" data-part="trim" d="${TRIM}"/>`,
    '<rect class="v-sign" data-part="destination-sign" x="181" y="29.5" width="20" height="3" rx="1"/>',
    '<circle class="v-lamp" data-part="headlamp" cx="231" cy="73" r="2.6"/>',
    '<rect class="v-bumper" data-part="bumper" x="229" y="85" width="10" height="3" rx="1.5"/>',
    '<rect class="v-bumper" data-part="bumper" x="0.5" y="85" width="10" height="3" rx="1.5"/>',
    // The route number on the rear panel, under the belt rails (mockup 18).
    routeNumber === null ? '' : `<text class="v-number" data-part="route-number" x="15" y="76.5">${escape(routeNumber)}</text>`,
    // Wheels: tyre, rim and hub as concentric rings; the hub carries one faint mark so turning shows (task 11).
    ...WHEELS.map(([cx, cy]) =>
      [
        '<g data-part="wheel">',
        `<circle class="v-tyre" data-part="tyre" cx="${cx}" cy="${cy}" r="13"/>`,
        `<circle class="v-rim" data-part="rim" cx="${cx}" cy="${cy}" r="9"/>`,
        `<g class="v-hub" data-part="hub" style="transform-origin: ${cx}px ${cy}px">`,
        `<circle cx="${cx}" cy="${cy}" r="4.2"/><path class="v-hub-mark" d="M${cx} ${cy} m0 -4.2 v-3.6"/>`,
        '</g>',
        `<circle class="v-hub-dot" cx="${cx}" cy="${cy}" r="1.6"/>`,
        '</g>',
      ].join(''),
    ),
  ];
}

/**
 * The detailed trolley at `width` CSS pixels: two blurred outline layers under
 * the drawing. `routeNumber` is null in the data-error state, and the number is
 * then left out (R12.3). It is also left out on trolleys narrower than
 * ROUTE_NUMBER_MIN_WIDTH, where it would render as specks.
 */
export function trolleySvg(options: { routeNumber: string | null; width: number }): string {
  const { width } = options;
  const routeNumber = width < ROUTE_NUMBER_MIN_WIDTH ? null : options.routeNumber;
  return [
    '<span class="trolley" data-vehicle="trolley">',
    svg('trolley-glow trolley-glow-wide', TROLLEY_VIEWBOX, width, trolleyGlow(true)),
    svg('trolley-glow trolley-glow-tight', TROLLEY_VIEWBOX, width, trolleyGlow(false)),
    svg('trolley-art', TROLLEY_VIEWBOX, width, trolleyArt(routeNumber)),
    '</span>',
  ].join('');
}

// ---- The map marker ------------------------------------------------------------

/** The simplified trolley for the map: solid body, dark window strip, two wheels, two poles. */
export function markerSvg(options: { width: number }): string {
  const parts = [
    '<line class="m-pole" data-part="pole" x1="34" y1="7" x2="12" y2="1"/>',
    '<line class="m-pole" data-part="pole" x1="31" y1="7" x2="16" y2="2.5"/>',
    '<path class="m-body" data-part="body" d="M3 22 L54 22 Q57 22 57 19 L56 14 Q54 8 47 7 L9 7 Q2 8 2 13 L2 20 Q2 22 3 22 Z"/>',
    '<rect class="m-window" data-part="window-strip" x="6" y="10" width="46" height="5" rx="1.5"/>',
    '<circle class="m-wheel" data-part="wheel" cx="14" cy="22" r="3.4"/>',
    '<circle class="m-wheel" data-part="wheel" cx="45" cy="22" r="3.4"/>',
  ];
  return `<span class="marker" data-vehicle="marker">${svg('marker-art', '0 0 58 26', options.width, parts)}</span>`;
}

// ---- Today's bus ---------------------------------------------------------------

/** Today's bus: a plain flat shape with dark windows and two wheels. */
export function busSvg(options: { width: number }): string {
  const parts = [
    '<rect class="b-body" data-part="body" x="1" y="3" width="102" height="28" rx="5"/>',
    ...[10, 28, 46, 64].map((x) => `<rect class="b-window" data-part="window" x="${x}" y="8" width="14" height="10" rx="1.5"/>`),
    '<rect class="b-window" data-part="windscreen" x="82" y="8" width="16" height="10" rx="1.5"/>',
    '<circle class="b-wheel" data-part="wheel" cx="24" cy="32" r="6"/>',
    '<circle class="b-wheel" data-part="wheel" cx="80" cy="32" r="6"/>',
  ];
  return `<span class="bus" data-vehicle="bus">${svg('bus-art', '0 0 104 40', options.width, parts)}</span>`;
}
