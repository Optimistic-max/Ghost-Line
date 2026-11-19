// Every user-visible string of the race screen, as templates (design 16). This is
// the only module with visible wording, with announce.ts for the spoken result.
// Each template is one quoted string of the copy table in
// .kiro/specs/race-screen/requirements.md; tests/unit/copy-table.test.ts holds
// this file to that table in both directions.
//
// Minute words follow R15.5: "minute" after the number 1, "minutes" otherwise.
// "min" is an abbreviation and does not change.
import { SOURCE_URLS } from '../config';

// ---- Minute words (R15.5) -----------------------------------------------------

/**
 * "minute" for 1, "minutes" for any other number. Number() lets a number-button
 * token stand in for the number it carries (view/numbers.ts).
 */
export function minuteWord(n: number): string {
  return Number(n) === 1 ? 'minute' : 'minutes';
}

/** "1 minute", "15 minutes". */
export function minutes(n: number): string {
  return `${n} ${minuteWord(n)}`;
}

// ---- Loading, top bar, ready --------------------------------------------------

export const LOADING = 'Loading the 1938 timetable…';
export const WORDMARK = 'Ghost Line';

/** "No. {n}, {year}", built from index.json's line and effective date. */
export function lineLabel(n: string, year: string): string {
  return `No. ${n}, ${year}`;
}

/** The schedule line; `date` is service_date as "Nov 4, 2026". */
export function ready(date: string): string {
  return `Weekday schedule as of ${date}. Scheduled, not live.`;
}

export const START_IS_NOW = 'Start time is the time now.';

// ---- Racing status lines --------------------------------------------------------

export function waiting1938(n: number, hhmm: string): string {
  return `Waiting ${n} min · next car ${hhmm} (scheduled)`;
}

export function riding(n: number): string {
  return `Riding ${n} min (scheduled)`;
}

export function walkingToStop(n: number): string {
  return `Walking to the stop ${n} min (estimate)`;
}

export function waitingBus(n: number, hhmm: string): string {
  return `Waiting ${n} min · next bus ${hhmm} (scheduled)`;
}

export function walkingFromStop(n: number): string {
  return `Walking from the stop ${n} min (estimate)`;
}

// ---- Legend after the finish ----------------------------------------------------

export function legendWalk(n: number): string {
  return `Walk ${n} min · estimate`;
}

export function legendWait(n: number): string {
  return `Wait ${n} min`;
}

export function legendRide(n: number): string {
  return `Ride ${n} min`;
}

// ---- Results ---------------------------------------------------------------------

export function wins1938(margin: number): string {
  return `1938 wins by ${margin} ${minuteWord(margin)}.`;
}

export function totals1938Wins(trolley: number, bus: number): string {
  return `Trolley ${trolley} min. Today's bus ${bus} min, walking included (estimated).`;
}

export function winsToday(margin: number): string {
  return `Today wins by ${margin} ${minuteWord(margin)}.`;
}

export function totalsTodayWins(bus: number, trolley: number): string {
  return `Today's bus ${bus} min, walking included (estimated). Trolley ${trolley} min.`;
}

export const PHOTO_FINISH = 'Photo finish.';

/** Photo finish with equal shown totals. */
export function bothAbout(n: number): string {
  return `Both about ${n} ${minuteWord(n)}.`;
}

/** Photo finish with shown totals one apart. The unit follows {m}. */
export function aboutAnd(n: number, m: number): string {
  return `About ${n} and ${m} ${minuteWord(m)}.`;
}

/** Before the midday table; `start` is row.start as printed. */
export function beforeTable(start: string): string {
  return `The 1938 midday timetable reaches this corner at ${start}. Both sides race from ${start}.`;
}

export const NO_ONE_SEAT_RIDE = 'No one-seat ride today.';
export const NO_SINGLE_BUS = 'No single scheduled bus links these corners on this weekday schedule.';

export function trolleyNoWinner(trolley: number): string {
  return `Trolley ${trolley} min. No winner is called.`;
}

// ---- Inferred corner ------------------------------------------------------------

export const INFERRED_CHIP = 'Inferred corner';
export const INFERRED_CAUTION =
  "Brevard Street is gone. This corner's position is our best reading of the 1938 diagram, so times to and from it are less certain.";

// ---- Honest line and the "When today wins" list -----------------------------------

export const SAME_RIDE = 'Same ride, longer wait.';
export const TODAY_WINS_THIS_RACE = 'Today wins this race.';
export const ACROSS_THIS_LINE = 'Across this line: same ride, longer wait.';
export const WHEN_TODAY_WINS = 'When today wins';

/** Counts from summary.json: wins_1938 and races, already formatted. */
export function trolleyFirst(wins1938: string, races: string): string {
  return `Trolley first in ${wins1938} of ${races} races.`;
}

/** The honest line for a 1938 win, a photo finish and no one-seat ride. */
export function honestLine(wins1938: string, races: string): string {
  return `${SAME_RIDE} ${trolleyFirst(wins1938, races)} ${WHEN_TODAY_WINS}`;
}

/** The honest line when today wins the race on screen. */
export function honestLineTodayWins(wins1938: string, races: string): string {
  return `${TODAY_WINS_THIS_RACE} ${ACROSS_THIS_LINE} ${trolleyFirst(wins1938, races)} ${WHEN_TODAY_WINS}`;
}

export function rideVerdicts(rideSame: string, pairs: string, rideFasterToday: string): string {
  return `On ${rideSame} of ${pairs} corner pairs today's scheduled ride is about as long as in 1938; on ${rideFasterToday} it is faster`;
}

export function rideSlowerClause(rideSlowerToday: string): string {
  return `; on ${rideSlowerToday} it is slower`;
}

export const SENTENCE_END = '.';

/** The list's opening sentence (R6.5): the slower clause only when ride_slower_today is above zero. */
export function whenTodayWinsSentence(
  rideSame: string,
  pairs: string,
  rideFasterToday: string,
  rideSlowerToday: string,
  slowerAboveZero: boolean,
): string {
  const slower = slowerAboveZero ? rideSlowerClause(rideSlowerToday) : '';
  return `${rideVerdicts(rideSame, pairs, rideFasterToday)}${slower}${SENTENCE_END}`;
}

// ---- Frequency sentence (R8.5) ------------------------------------------------

/** Gap part when the lower bus gap rounds to 0. */
export function gapUpTo(max: number): string {
  return `up to ${max} ${minuteWord(max)} apart`;
}

/** Gap part when the two rounded bus gaps differ. The unit follows {max}. */
export function gapRange(min: number, max: number): string {
  return `${min} to ${max} ${minuteWord(max)} apart`;
}

/** Gap part when the two rounded bus gaps are equal. */
export function gapEqual(n: number): string {
  return `${n} ${minuteWord(n)} apart`;
}

/** 1938 spacing when the two rounded gaps are equal. */
export function everyMinutes(n: number): string {
  return `every ${n} ${minuteWord(n)}`;
}

/** 1938 spacing when the two rounded gaps differ. The unit follows {b}. */
export function everyMinutesOr(a: number, b: number): string {
  return `every ${a} or ${b} ${minuteWord(b)}`;
}

/** The full sentence. `spacing1938` is everyMinutes or everyMinutesOr. */
export function frequency(
  gapPart: string,
  windowFrom: string,
  windowTo: string,
  routeNames: string,
  date: string,
  spacing1938: string,
): string {
  return `Scheduled one-seat buses on this stretch leave ${gapPart} between ${windowFrom} and ${windowTo} (${routeNames}, weekday schedule as of ${date}). In 1938 a trolley was scheduled ${spacing1938}.`;
}

// ---- Share, banners, errors, map --------------------------------------------------

export const LINK_COPIED = 'Link copied';

export function sharedRace(origin: string, dest: string): string {
  return `Shared race: ${origin} → ${dest}.`;
}

/** Bad link; the names are the lead pair's, from index.json. */
export function badLink(origin: string, dest: string): string {
  return `That link's corners weren't recognized. Showing ${origin} → ${dest}.`;
}

export const DATA_ERROR = "The timetable data didn't load. Check your connection and try again.";
export const DATA_INCOMPLETE = 'No numbers are shown until the data is complete.';
export const TRY_AGAIN = 'Try again';
export const MAP_UNAVAILABLE = 'Map unavailable. Showing the route diagram.';
export const MAP_CREDIT = 'Streets © OpenStreetMap contributors. Dashed stretch of the route is inferred.';

// ---- Corner picker ------------------------------------------------------------

export const PICKER_TITLE = 'Choose two corners';
export const PICKER_STEP_START = 'Choose where the ride starts';
export const PICKER_STEP_END = 'Start is set. Now choose where the ride ends.';

/** The picker note; `inferredName` is the inferred corner's name from index.json. */
export function pickerNote(inferredName: string): string {
  return `Corners are listed west to east along the 1938 line. ${inferredName}'s position is inferred.`;
}

export const PICKER_START_TAG = 'Start';
export const INFERRED_TAG = 'inferred';
export const CANCEL = 'Cancel';

// ---- Slider ---------------------------------------------------------------------

/** The slider label form "{hh:mm AM/PM}", for example "10:00 AM". */
export function clock12(hm: string, pm: boolean): string {
  return `${hm} ${pm ? 'PM' : 'AM'}`;
}

/** The word that joins the last two route names (R8.5). */
export const LIST_AND = 'and';

// ---- Credits --------------------------------------------------------------------

/** From the Source URLs list in tech.md, through the config constants block. */
export const BASE_MAP_CREDIT = SOURCE_URLS.baseMapCredit;
export const NOT_ENDORSED = 'Not endorsed by MDOT MTA.';
export const FONT_CREDIT = 'Font: Barlow Condensed, SIL Open Font Licence 1.1.';
export const VEHICLE_CREDIT = 'Vehicle drawings: original illustrations.';

/** What a photo finish means; `band` is index.json's photo_finish_min. */
export function photoFinishMeaning(band: number): string {
  return `Photo finish: the two totals are less than ${band} ${minuteWord(band)} apart. Walks are estimates, so neither side counts as a win.`;
}
export const CHECKED_BY_HAND = ' and checked by hand against the scans';

/** "How it was made"; the checked-by-hand clause only when index.json's street_order_checked is true (R10.4). */
export function howItWasMade(streetOrderChecked: boolean): string {
  const checked = streetOrderChecked ? CHECKED_BY_HAND : '';
  return `How it was made: Facts files and expected test values were prepared during planning with Claude Code and Codex${checked}; the pipeline and app were built in Kiro.`;
}

export const MIT_LICENCE = 'MIT licence';
export const SOURCE_CODE = 'Source code';

// ---- Test fixture ----------------------------------------------------------------

export const FIXTURE_TAG = 'Test fixture: a made-up line and made-up numbers. Not Baltimore data.';

// ---- Buttons and bars -----------------------------------------------------------

export const SOURCES = 'Sources';
export const SHARE_THIS_RACE = 'Share this race';
export const SKIP_TO_RESULT = 'Skip to result';
export const ABOUT_AND_CREDITS = 'About and credits';
export const FOOTER_LINE = 'Open source. Built in Kiro.';

/** The race clock readout, "10:08 scheduled". */
export function clockReadout(hm: string): string {
  return `${hm} scheduled`;
}

// =================================================================================
// Rows drafted on Nov 19 from the mockups and the brief, approved by Emmanuel with
// his changes the same day.
// =================================================================================

// ---- Lanes and the departures board (draft) ----------------------------------

export const LANE_TITLE_1938 = '1938 trackless trolley';
/** Today's lane title, and the bus row label of the departures board. */
export const LANE_TITLE_TODAY = "Today's bus";

/** A shown duration: a lane total, or a value in the Sources sheet. */
export function minShort(n: number): string {
  return `${n} min`;
}

export function boardHeader(hm: string): string {
  return `Scheduled departures from this corner after ${hm}`;
}

export const BOARD_1938 = '1938 trolley';

export function boardEveryOr(a: number, b: number): string {
  return `every ${a} or ${b} min`;
}

export function boardEvery(n: number): string {
  return `every ${n} min`;
}

export function boardGapUpTo(max: number): string {
  return `up to ${max} min apart`;
}

export function boardGapRange(min: number, max: number): string {
  return `${min} to ${max} min apart`;
}

export function boardGapEqual(n: number): string {
  return `${n} min apart`;
}

// ---- Number buttons and the Sources sheet (draft) ---------------------------

/** A number button's accessible name: "9 minutes, scheduled 1938 ride. Show source." */
export function numberLabel(value: string, what: string): string {
  return `${value}, ${what}. Show source.`;
}

/** What each kind of number is, for its button's name and its Sources row. */
export const WHAT = {
  wait1938: 'scheduled 1938 wait',
  ride1938: 'scheduled 1938 ride',
  total1938: 'scheduled 1938 total',
  car1938: 'scheduled 1938 car',
  walkToStop: 'walk to the stop (estimate)',
  waitBus: 'scheduled wait today',
  rideBus: 'scheduled bus ride',
  walkFromStop: 'walk from the stop (estimate)',
  totalToday: "today's scheduled total, walking included (estimated)",
  busDeparture: 'scheduled bus departure',
  margin: 'difference of the two scheduled totals',
  wins1938: 'races where the 1938 trolley arrives first',
  races: 'races on this line',
  rideSame: 'corner pairs with about the same scheduled ride',
  pairs: 'corner pairs on this line',
  rideFasterToday: "corner pairs where today's scheduled ride is faster",
  rideSlowerToday: "corner pairs where today's scheduled ride is slower",
} as const;

export function whatBetween(what: string, origin: string, dest: string): string {
  return `${what}, ${origin} to ${dest}`;
}

export function whatFrom(what: string, hm: string): string {
  return `${what} from ${hm}`;
}

export function whatAt(what: string, corner: string): string {
  return `${what} at ${corner}`;
}

export const SOURCES_TITLE = 'Where these numbers come from';
export const NEW_TAB = '(opens in a new tab)';
export const SOURCES_AND_CREDITS = 'Sources and credits';
export const CLOSE = 'Close';

// How each number was worked out, one line each.
export const METHOD_RIDE_1938 = "Sum of the diagram's segment minutes between the two corners.";

export function methodNextCar(hm: string): string {
  return `Next listed car passes at ${hm}.`;
}

export const METHOD_CAR_1938 = 'Listed in the 1938 timetable at this corner.';
export const METHOD_TOTAL_1938 = 'Wait plus ride.';

export function methodWalk(metres: number): string {
  return `Straight-line ${metres} m from the corner to the stop.`;
}

export const METHOD_WAIT_BUS = 'Time at the stop, from arriving after the walk to the scheduled departure.';

export const METHOD_RIDE_BUS = "From the trip's scheduled departure to its scheduled arrival.";

export function methodBusTrip(route: string, headsign: string, stopId: string, hm: string): string {
  return `${route} toward ${headsign} leaves stop ${stopId} at ${hm}.`;
}

export function methodTotalToday(hm: string): string {
  return `Walks, wait and ride, from ${hm} to the destination corner.`;
}

export const METHOD_MARGIN = 'The difference of the two totals as shown.';
export const METHOD_RACE_COUNTS = 'Counted over every race on this line, one per corner pair and slider minute.';
export const METHOD_RIDE_VERDICTS =
  "Counted over this line's corner pairs, comparing each 1938 ride with the median of today's scheduled rides.";

/** The date line of 1938 numbers; `date` is effective in its long form. */
export function dateEffective(date: string): string {
  return `Effective ${date}`;
}

/** The date line of today's numbers; `date` is service_date with its weekday. */
export function dateFeed(feedVersion: string, date: string): string {
  return `MTA feed version ${feedVersion}, service date ${date}`;
}

/** R7.7: a shown part that is not the plain rounding of its stored value. `exact` is the stored value with three decimals. */
export function exactValue(exact: string, shownTotal: number): string {
  return `Exact value ${exact} min. Parts are rounded so they add up to the ${shownTotal} min total.`;
}

// ---- Controls, the desktop headline, the today-wins list, the map (draft) ----

export const START_TIME = 'Start time';

/** The slider's aria-valuetext; `label` is the 12-hour start time. */
export function sliderValueText(label: string): string {
  return `${label}, scheduled weekday time`;
}

export const ONE_MINUTE_EARLIER = 'One minute earlier';
export const ONE_MINUTE_LATER = 'One minute later';
export const SWAP_DIRECTION = 'Swap direction';

export const HEADLINE_LINE =
  "Baltimore's 1938 trackless trolley, raced against today's scheduled bus between the same two corners.";

export function todayWinEntry(origin: string, dest: string, hm: string): string {
  return `${origin} → ${dest}, ${hm} (scheduled)`;
}

/** After the inferred corner's name on the map (R11.2). */
export const MAP_INFERRED = '(inferred)';
