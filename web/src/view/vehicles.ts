// The vehicles, as inline SVG markup (screen-brief 3A.2, design 14). Original
// drawings made for this site, not traced from a photograph or a scan.
//
// - The 1938 trackless trolley: side view facing right, 240 x 104 proportions.
//   Two trolley poles rise from the roof and trail back to two overhead wires,
//   each pole ending in a shoe, with two retriever ropes to the rear. Rubber
//   tyres with hub rings, and no rails. Its glow is two blurred copies of the
//   outline, each a separate element, so motion can change their opacity alone.
// - The map marker: a separate simplified trolley for small sizes.
// - Today's bus: flat and plain, no poles, wires or glow.
//
// The drawings are decoration: the lane titles carry the words, so every SVG is
// aria-hidden. Sizes are style, not data (ui.md); they come from config.ts.
import { VEHICLE_SIZES } from '../config';

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

const TROLLEY_VIEWBOX = '0 0 240 104';

/** The body: curved rear, crowned roof, sloping streamlined front. */
const BODY = 'M12 86 L224 86 Q234 86 234 76 L232 60 Q228 44 210 37 Q120 30 30 37 Q8 40 6 56 L6 80 Q6 86 12 86 Z';

/** The two poles, from their base on the roof back to the shoe on each wire. */
const POLES: [x1: number, y1: number, x2: number, y2: number][] = [
  [154, 31, 40, 5],
  [146, 31, 50, 10],
];

/** The two overhead wires, at the height of each shoe. */
const WIRE_HEIGHTS = [5, 10];

/** Wheel centres, and the top and bottom of the notch on each hub ring that shows it turning. */
const WHEELS: [cx: number, cy: number, notchTop: number, notchBottom: number][] = [
  [52, 87, 82, 85],
  [192, 87, 82, 85],
];

/** Five side windows: three before the centre door, two between the doors. */
const WINDOW_XS = [24, 46, 68, 110, 132];

/** Three faint passengers, the "ghosts", in the second, fourth and fifth windows. */
const PASSENGERS: [cx: number, cy: number][] = [
  [55, 50],
  [119, 50],
  [141, 50],
];

/** The outline drawn again, blurred, under the trolley: body, poles and tyres, with no parts named. */
function trolleyOutline(): string[] {
  return [
    '<g class="v-glow-lines">',
    `<path d="${BODY}"/>`,
    ...POLES.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`),
    ...WHEELS.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="12"/>`),
    '</g>',
  ];
}

function trolleyArt(routeNumber: string | null): string[] {
  return [
    ...WIRE_HEIGHTS.map((y) => `<line class="v-wire" data-part="wire" x1="0" y1="${y}" x2="240" y2="${y}"/>`),
    '<path class="v-rope" data-part="rope" d="M41 6 C 24 20, 13 34, 9 52"/>',
    '<path class="v-rope" data-part="rope" d="M51 11 C 32 25, 18 38, 13 54"/>',
    ...POLES.map(([x1, y1, x2, y2]) => `<line class="v-pole" data-part="pole" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`),
    ...POLES.map(([, , x, y]) => `<rect class="v-shoe" data-part="shoe" x="${x}" y="${y}" width="7" height="2.4" rx="1"/>`),
    `<path class="v-body" data-part="body" d="${BODY}"/>`,
    '<rect class="v-pole-base" data-part="pole-base" x="140" y="30" width="20" height="4" rx="1.5"/>',
    ...WINDOW_XS.map((x) => `<rect class="v-window" data-part="window" x="${x}" y="44" width="18" height="15" rx="2"/>`),
    '<path class="v-window" data-part="cab-window" d="M174 44 L210 44 Q223 46 228 59 L174 59 Z"/>',
    ...PASSENGERS.map(
      ([cx, cy]) =>
        `<g class="v-passenger" data-part="passenger"><circle cx="${cx}" cy="${cy}" r="3"/><path d="M${cx} ${cy} m-5 9 q5 -7 10 0 z"/></g>`,
    ),
    // Two double-leaf doors, centre and front, nearly to the floor.
    '<g data-part="door"><rect class="v-door" x="91" y="42" width="15" height="42" rx="1"/><line class="v-trim" x1="98.5" y1="42" x2="98.5" y2="84"/></g>',
    '<g data-part="door"><rect class="v-door" x="155" y="42" width="15" height="42" rx="1"/><line class="v-trim" x1="162.5" y1="42" x2="162.5" y2="84"/></g>',
    '<line class="v-trim" data-part="belt" x1="7" y1="64" x2="233" y2="64"/>',
    '<line class="v-trim" data-part="belt" x1="7" y1="67" x2="233" y2="67"/>',
    '<line class="v-trim" data-part="trim" x1="7" y1="79" x2="233" y2="79"/>',
    '<rect class="v-sign" data-part="destination-sign" x="182" y="38.5" width="30" height="3.5" rx="1"/>',
    '<circle class="v-lamp" data-part="headlamp" cx="230" cy="71" r="2.6"/>',
    '<rect class="v-bumper" data-part="bumper" x="226" y="83" width="11" height="3" rx="1.5"/>',
    '<rect class="v-bumper" data-part="bumper" x="3" y="83" width="11" height="3" rx="1.5"/>',
    routeNumber === null ? '' : `<text class="v-number" data-part="route-number" x="18" y="76">${escape(routeNumber)}</text>`,
    ...WHEELS.map(([cx, cy, top, bottom]) =>
      [
        '<g data-part="wheel">',
        `<circle class="v-tyre" data-part="tyre" cx="${cx}" cy="${cy}" r="12"/>`,
        `<g class="v-hub" data-part="hub" style="transform-origin: ${cx}px ${cy}px">`,
        `<circle cx="${cx}" cy="${cy}" r="5"/><line x1="${cx}" y1="${top}" x2="${cx}" y2="${bottom}"/>`,
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
 * then left out (R12.3).
 */
export function trolleySvg(options: { routeNumber: string | null; width: number }): string {
  const { routeNumber, width } = options;
  return [
    '<span class="trolley" data-vehicle="trolley">',
    svg('trolley-glow trolley-glow-wide', TROLLEY_VIEWBOX, width, trolleyOutline()),
    svg('trolley-glow trolley-glow-tight', TROLLEY_VIEWBOX, width, trolleyOutline()),
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
