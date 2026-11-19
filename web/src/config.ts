// The site's one constants block. Design constants only: no race number,
// count, time or minute value lives here. Those are read from public/data.

/** The lead pair (product.md): Preston & Caroline to Aliceanna & Bond. Checked against index.json at boot. */
export const LEAD_PAIR = { origin: 'preston-caroline', dest: 'aliceanna-bond' } as const;

/**
 * Default start time when the New York clock is outside the slider range
 * (product.md, race-brief 5.9). A product rule, not a data value.
 */
export const FALLBACK_START = '10:00';

/** Wall-clock durations in milliseconds (screen-brief 3A.6, requirements R2 to R4). */
export const TIMINGS = {
  /** Pause before a race starts, and after the last slider input (R2.5, R3.5). */
  racePauseMs: 300,
  /** "Link copied" stays on the share button this long (R4.8). */
  linkCopiedMs: 2000,
  /** The share banner holds this long between its slide in and slide out (R4.5). */
  bannerHoldMs: 5000,
  /** Without valid data after this long, the data-error state shows (R2.2). */
  dataTimeoutMs: 3000,
} as const;

/** How many departures the board lists on each side (screen-brief 3A.5, R8.2). */
export const BOARD = { cars1938: 4, buses: 3 } as const;

/** Layout breakpoints in CSS pixels (R1.1, R1.3). */
export const BREAKPOINTS = {
  /** Phone layout below this width; desktop layout from it up. */
  desktopMinWidth: 900,
  /** Below this height the desktop race column scrolls inside itself. */
  desktopScrollBelowHeight: 720,
} as const;

/** Vehicle widths in CSS pixels (ui.md, screen-brief 3A.2). Style, not data. */
export const VEHICLE_SIZES = {
  phone: { trolleyRacing: 150, trolleyFinished: 104, bus: 84, mapMarker: 28 },
  desktop: { trolley: 200, bus: 104, mapMarker: 58 },
} as const;

/** Type sizes in CSS pixels (screen-brief 3.3 for the phone, 3A.1 for desktop). */
export const FONT_SIZES = {
  phone: {
    wordmark: 24,
    cornerNames: 21,
    cornerNamesWithChip: 17,
    sliderTime: 24,
    sliderEnds: 9.5,
    laneTitle: 17,
    laneTotal: 22,
    resultLine: 29,
    bodySmall: 12,
    body: 13,
  },
  desktop: {
    wordmark: 30,
    headline: 54,
    headlineLine: 14,
    cornerNames: 25,
    resultLine: 38,
  },
} as const;

/**
 * Links and credit text from the "Source URLs" list in .kiro/steering/tech.md.
 * Do not add a URL anywhere else in src/; a test checks both rules.
 */
export const SOURCE_URLS = {
  /** repository: the project's git remote (origin). Link only, for the credits. */
  repository: 'https://github.com/Optimistic-max/Ghost-Line',
  /** base map style: requested by the map at run time and recoloured to palette B. */
  baseMapStyle: 'https://tiles.openfreemap.org/styles/dark',
  /** base map credit text: shown in the credits sheet. */
  baseMapCredit: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
} as const;
