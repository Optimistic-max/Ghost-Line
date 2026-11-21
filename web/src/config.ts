// The site's one constants block. Design constants only: no race number,
// count, time or minute value lives here. Those are read from public/data.

/** The lead pair (product.md): Preston & Caroline to Aliceanna & Bond. Checked against index.json at boot. */
export const LEAD_PAIR = { origin: 'preston-caroline', dest: 'aliceanna-bond' } as const;

/**
 * Default start time when the New York clock is outside the slider range
 * (product.md, race-brief 5.9). A product rule, not a data value.
 */
export const FALLBACK_START = '10:00';

/**
 * The start time of a guided first visit (product.md, "the labelled example
 * start"): shown with the example label until the first Visitor_Input. A
 * product rule, not a data value.
 */
export const EXAMPLE_START = '10:00';

/** Wall-clock durations in milliseconds (screen-brief 3A.6, requirements R2 to R4). */
export const TIMINGS = {
  /** Pause before a race starts, and after the last slider input (R2.5, R3.5). */
  racePauseMs: 300,
  /** "Link copied" stays on the share button this long (R4.8). */
  linkCopiedMs: 2000,
  /** The share banner holds this long between its slide in and slide out (R4.5). */
  bannerHoldMs: 5000,
  /** The share banner's slide in and out; the same as --banner-slide in tokens.css (R4.5). */
  bannerSlideMs: 200,
  /** Without valid data after this long, the data-error state shows (R2.2). */
  dataTimeoutMs: 3000,
  /** The map chunk loads when the page is idle, or after this long at the latest (design 12.2). */
  mapIdleMs: 1000,
  /** Without a first map frame this long after the map is created, the map is unavailable (design 12.3). */
  mapTimeoutMs: 8000,
  /** On a guided first visit the race waits this long, orientation line showing, before it starts (story-layer Req 4.1). */
  orientationMs: 2000,
} as const;

/**
 * The made-up test line's `line` in index.json (tests/fixtures/fake). When the page
 * shows it, the fixture tag says so (R6.8). The shipped data never has it.
 */
export const FIXTURE_LINE = 'fake';

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
  phone: { trolley: 104, bus: 84, barMarker: 28, mapMarker: 28 },
  desktop: { trolley: 150, bus: 104, barMarker: 28, mapMarker: 58 },
} as const;

/**
 * The trolley's route number is drawn only from this width up: narrower, it
 * renders as specks (Emmanuel, Nov 19). In CSS pixels.
 */
export const ROUTE_NUMBER_MIN_WIDTH = 150;

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
    /** The pair names shrink from cornerNames as far as this to stay on one line (Emmanuel, Nov 19). */
    cornerNamesMin: 16,
    resultLine: 38,
  },
} as const;

/**
 * The map area (design 12.1, 12.2, screen-brief 3A.3): the route drawing's design
 * size and the room kept around the route, shared with the map's fit. Phone: the
 * 150 px strip, with the card's rounded top over its lower edge and the map's
 * line of text at its foot, as on desktop (Emmanuel, Nov 20). Desktop: the area
 * left of the race column, with the headline top left and the credit line at the
 * foot. Type sizes and dot radii in CSS pixels. Style, not data.
 */
export const MAP_LAYOUT = {
  phone: {
    size: { width: 375, height: 150 },
    /**
     * The bottom keeps room above the card's edge for the map's line of text,
     * which takes two lines on a phone, and for the attribution button beside it
     * (map.css); the top needs only the names of the corners at the top.
     */
    padding: { top: 8, right: 16, bottom: 45, left: 16 },
    streetFont: 9,
    nameFont: 13,
    otherNameFont: 11,
    dot: { chosen: 5, other: 3.5 },
    /** The trolley marker stops this far before the destination dot: half its width and the dot. */
    markerStop: 20,
    /** Line widths on the map: the route, its blurred copy, the dashed stretch, minor and main streets. */
    lines: { route: 2.5, glow: 6, inferred: 2, street: 0.6, main: 1.2 },
  },
  /**
   * The collapsed route preview on a phone (story-layer design 8.3): the bundled route
   * drawing in a strip 100 px tall. A starting value; the padding is the phone padding
   * scaled to the strip.
   */
  phonePreview: {
    size: { width: 375, height: 100 },
    /**
     * The right padding is the button's column, so the drawing never runs under "View route"; the top padding
     * leaves a line for a corner name over its dot, where the trolley marker leaves it no other clear place
     * (checkpoint 18).
     */
    padding: { top: 20, right: 92, bottom: 30, left: 16 },
    /**
     * The View route / Hide route button's column, on the strip's right: its width, its distance from the
     * right edge (map.css `.route-toggle` uses the same numbers) and the gap kept between it and the drawing.
     * The drawing, its names and its marker stay left of `size.width - (width + right + gap)`.
     */
    button: { width: 80, height: 44, right: 8, top: 4, gap: 4 },
    /** The race card's rounded top covers the strip's lowest 9 px (layout-phone.css `--card-top`); names stay above it. */
    cardOverlap: 9,
    /**
     * "Next to its own dot" on the strip (Emmanuel, checkpoint 18 round 2): a corner name is shown only where the
     * distance from its own dot's centre to the nearest point of its box is at most `nameReach`, and that distance
     * is smaller than the same distance to any other corner's dot. Otherwise the name is hidden on the strip (the
     * pair row names both corners). A dot's radius is at most 7 and the usual gap 5, so 26 allows 14 px further out.
     */
    nameReach: 26,
  },
  desktop: {
    size: { width: 840, height: 800 },
    padding: { top: 200, right: 150, bottom: 110, left: 110 },
    streetFont: 11,
    nameFont: 16,
    otherNameFont: 13,
    dot: { chosen: 7, other: 4.5 },
    markerStop: 36,
    lines: { route: 3.5, glow: 9, inferred: 3, street: 0.8, main: 1.6 },
    /** Street and water names from the tiles (desktop only): size and opacity, never below 80% (R11.3). */
    tileLabels: { size: 11, opacity: 0.9 },
  },
  /** The display face's average glyph advance, in ems, for fitting names before they are drawn. */
  glyphEm: 0.38,
  /** Space between a dot and its name, and between a street name and its line. */
  gap: 5,
  /** Two legs meet when an end of one is this near an end of the other, in pixels. */
  meet: 3,
  /**
   * A street name the trolley marker would cover where it stands at a corner
   * moves along its leg in steps of this many pixels until it is clear, and is
   * left out when no place on the leg is (Emmanuel, Nov 20).
   */
  labelStep: 0.5,
  /** Room kept between the standing trolley marker and a street name, in pixels. */
  markerRoom: 1,
  /**
   * How far a browser's glyph boxes for the display face reach above and below the baseline, in ems
   * (measured in Chromium, Nov 20: 11.2 px above and 2 px below at 11 px). The marker is kept clear
   * of the whole glyph box, which is more than the ink.
   */
  glyphBox: { above: 1.02, below: 0.18 },
  /**
   * When no place along its leg is clear of the marker, a street name moves out from its
   * leg, a pixel at a time up to this far (the near edge of its letters from the line),
   * on either side, and is left out only if nothing fits (Emmanuel, Nov 20).
   */
  labelMaxOffset: 20,
  labelOffsetStep: 1,
  /** Along a leg, a name moved out looks for its place in steps of this many pixels. */
  labelOffsetAlongStep: 2,
  /** A name moved out keeps this far from the route's lines, and this far from the names already set, in pixels. */
  lineRoom: 2.5,
  labelRoom: 4,
  /** The radius of the target round each corner dot: a 44 px tap target (R1.4). */
  hit: 22,
} as const;

/** Where the licence file sits in the repository, for the "MIT licence" link (R10.3). */
export const LICENCE_PATH = '/blob/main/LICENSE';

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
