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

/** The fixed phrase (product rule 1): the end of the schedule line, and a line of its own in About (R10.5). */
export const NOT_LIVE = 'Scheduled, not live.';

/** The schedule line; `date` is service_date as "Nov 4, 2026". */
export function ready(date: string): string {
  return `Weekday schedule as of ${date}. ${NOT_LIVE}`;
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

/** The bus wait has no countdown (Emmanuel, Nov 19); `hm` is the trip's departure. */
export function waitingForBus(hm: string): string {
  return `Waiting for the ${hm} bus (scheduled).`;
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

/** What a race is, in brackets; `pairs` is summary.pairs.length, already formatted (task 25.6). */
export function racesMeaning(pairs: string): string {
  return `(every start time the 1938 timetable covers, at all ${pairs} pairs of corners)`;
}

/** Counts from summary.json: wins_1938, races and the number of corner pairs, already formatted. */
export function trolleyFirst(wins1938: string, races: string, pairs: string): string {
  return `Trolley first in ${wins1938} of ${races} races ${racesMeaning(pairs)}.`;
}

/** The honest line for a 1938 win and no one-seat ride. */
export function honestLine(wins1938: string, races: string, pairs: string): string {
  return `${SAME_RIDE} ${trolleyFirst(wins1938, races, pairs)} ${WHEN_TODAY_WINS}`;
}

/** The honest line under a photo finish (product.md rule 6, polish brief P3). */
export function honestLinePhotoFinish(wins1938: string, races: string, pairs: string): string {
  return `${PHOTO_FINISH} ${ACROSS_THIS_LINE} ${trolleyFirst(wins1938, races, pairs)} ${WHEN_TODAY_WINS}`;
}

/** The honest line when today wins the race on screen. */
export function honestLineTodayWins(wins1938: string, races: string, pairs: string): string {
  return `${TODAY_WINS_THIS_RACE} ${ACROSS_THIS_LINE} ${trolleyFirst(wins1938, races, pairs)} ${WHEN_TODAY_WINS}`;
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
  return `For these corners and this direction, scheduled one-seat buses leave ${gapPart} between ${windowFrom} and ${windowTo} (${routeNames}, weekday schedule as of ${date}). In the covered 1938 midday timetable, a trolley was scheduled at this corner ${spacing1938}.`;
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
/** When route.geojson itself fails, there is no route drawing to show (Emmanuel, Nov 20). */
export const MAP_UNAVAILABLE_NO_DRAWING = 'Map unavailable.';
export const MAP_CREDIT = 'Streets © OpenStreetMap contributors. Dashed stretch of the route is inferred.';

// ---- Corner picker ------------------------------------------------------------

export const PICKER_TITLE = 'Choose two corners';
export const PICKER_STEP_START = 'Choose where the ride starts';
export const PICKER_STEP_END = 'Now tap where the ride ends.';

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
/** What today's side leaves out; `radius` is index.json's stop_radius_m (polish brief P3, About sheet). */
export function honestLimits(radius: number): string {
  return `Today's side counts only trips with no transfer, from a stop within ${radius} m of each corner. A rider who changes buses, or rides part way and walks, may do better; Ghost Line does not model that.`;
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

// ---- Lanes and the departures board ------------------------------------------

export const LANE_TITLE_1938 = '1938 trackless trolley';
/** Today's lane title (the board's bus row label is BOARD_TODAY, story-layer copy table). */
export const LANE_TITLE_TODAY = "Today's bus";

/** A shown duration: a lane total, or a value in the Sources sheet. */
export function minShort(n: number): string {
  return `${n} min`;
}

export function boardHeader(hm: string): string {
  return `Scheduled departures after ${hm}`;
}

export const BOARD_1938 = '1938 trolley, at this corner';
export const BOARD_TODAY = "Today's bus, from the boarding stop";

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

// ---- Number buttons and the Sources sheet -----------------------------------

/** A number button's accessible name, which starts with its visible text: "9 min, scheduled 1938 ride. Show source." */
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
  rideSame: 'corner pairs with about the same scheduled ride',
  pairs: 'corner pairs on this line',
  rideFasterToday: "corner pairs where today's scheduled ride is faster",
  rideSlowerToday: "corner pairs where today's scheduled ride is slower",
  spacing1938: 'scheduled spacing of 1938 cars at this corner',
  // Story-layer rows, after the race-screen phrases.
  walkSum: 'walks to and from the stop, together (estimate)',
  photoBand: 'photo-finish limit',
} as const;

/**
 * What the three race counts are (task 25.6): "races", with the brackets that say what a race is. `pairs` is
 * summary.pairs.length, already formatted; none of these holds a count of its own.
 */
export function whatWins1938(pairs: string): string {
  return `races ${racesMeaning(pairs)} where the 1938 trolley arrives first`;
}

export function whatRaces(pairs: string): string {
  return `races ${racesMeaning(pairs)} on this line`;
}

export function whatWinsToday(pairs: string): string {
  return `races ${racesMeaning(pairs)} where today's bus arrives first`;
}

/** What the board's bus gaps are; the window is the race file's, in 12-hour form. */
export function whatBusGaps(windowFrom: string, windowTo: string): string {
  return `scheduled gaps between one-seat buses, ${windowFrom} to ${windowTo}`;
}

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

/** The walk estimate; `detour` and `speed` are index.json's walk_detour_factor and walk_speed_m_s (polish brief P3). */
export function methodWalk(metres: number, detour: number, speed: number): string {
  return `Estimate: straight-line ${metres} m from the corner to the stop, times ${detour} for street detours, at ${speed} m/s.`;
}

export const METHOD_WAIT_BUS = 'Time at the stop, from arriving after the walk to the scheduled departure.';

export const METHOD_RIDE_BUS = "From the trip's scheduled departure to its scheduled arrival.";

export function methodBusTrip(route: string, headsign: string, stopId: string, hm: string): string {
  return `${route} toward ${headsign} leaves stop ${stopId} at ${hm}.`;
}

export function methodTotalToday(hm: string): string {
  return `Walks, wait and ride, from ${hm} to the destination corner.`;
}

/** How the photo-finish limit was set (task 25.6). */
export const METHOD_PHOTO_BAND = 'A race whose two totals are less than this apart is a photo finish.';
export const METHOD_MARGIN = 'The difference of the two totals as shown.';
export const METHOD_RACE_COUNTS =
  'Counted over every corner pair and every start minute that the 1938 midday timetable covers at the start corner. Earlier minutes, which race from the first listed car, are not counted.';

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

// ---- Controls, the desktop headline, the today-wins list, the map ------------

/** The slider's aria-valuetext; `label` is the 12-hour start time. */
export function sliderValueText(label: string): string {
  return `${label}, scheduled weekday time`;
}

export const ONE_MINUTE_EARLIER = 'One minute earlier';
export const ONE_MINUTE_LATER = 'One minute later';
export const SWAP_DIRECTION = 'Swap direction';

export const HEADLINE_LINE =
  "Baltimore's 1938 trackless trolley, an electric bus that ran on overhead wires, raced against today's scheduled bus between the same two corners.";

export function todayWinEntry(origin: string, dest: string, hm: string): string {
  return `${origin} → ${dest}, ${hm} (scheduled)`;
}

/** After the inferred corner's name on the map (R11.2). */
export const MAP_INFERRED = '(inferred)';

// =================================================================================
// Story-layer rows (Story copy table, .kiro/specs/story-layer/requirements.md).
// Where a row replaces a race-screen row, the constant above changed in place and
// the story row wins (Requirement 13.8).
// =================================================================================

// ---- Guided visit (Req 3, 4, 12) ---------------------------------------------

/** `time` is the start in 12-hour form, plain text. */
export function exampleLabel(time: string): string {
  return `Example start: ${time} scheduled.`;
}

// ---- Ghost cars (ghost-cars spec copy table) -----------------------------------

/** The counter while it counts; `k` is the number of 1938 cars past the corner so far. */
export function ghostCounting(k: number | string): string {
  return `1938 trolleys scheduled past this corner: ${k}`;
}

/** The counter once today's bus has left, and on every finished card. */
export function ghostFinished(n: number | string): string {
  return `${n} 1938 trolleys were scheduled here before today's bus.`;
}

export const METHOD_GHOST_COUNT =
  "Counted from the 1938 timetable's scheduled departures at the origin corner, from the start time until today's bus is scheduled to leave.";

export const MAP_GHOSTS = 'Fainter cars: other scheduled 1938 departures.';

export const ORIENTATION_LINE = 'Same two corners. Walking included for today; walks are estimates.';

// ---- Captions (Req 7). No template takes a number. -----------------------------

export type Caption1938Phase = 'waiting' | 'riding' | 'arrived';
export type CaptionTodayPhase = 'walking-to-stop' | 'waiting' | 'riding' | 'walking-to-destination' | 'arrived';
/** The shape state/captions.ts produces (design 3.1). */
export type CaptionKey =
  | { kind: 'orientation' }
  | { kind: 'both-arrived' }
  | {
      kind: 'clauses';
      p1938: { phase: Caption1938Phase; still: boolean };
      today: { phase: CaptionTodayPhase; still: boolean } | null;
    };

/** The {still } rule: "still " only while the other side has arrived. */
export const STILL = 'still ';

function stillWord(still: boolean): string {
  return still ? STILL : '';
}

export function caption1938Waiting(still: boolean): string {
  return `The trolley passenger is ${stillWord(still)}waiting for the car.`;
}

export function caption1938Riding(still: boolean): string {
  return `The trolley passenger is ${stillWord(still)}riding.`;
}

export const CAPTION_1938_ARRIVED = 'The trolley passenger has arrived.';

export function captionTodayWalkingToStop(still: boolean): string {
  return `Today's passenger is ${stillWord(still)}walking to the stop (estimate).`;
}

export function captionTodayWaiting(still: boolean): string {
  return `Today's passenger is ${stillWord(still)}waiting to board.`;
}

export function captionTodayRiding(still: boolean): string {
  return `Today's passenger is ${stillWord(still)}riding.`;
}

export function captionTodayWalkingToDestination(still: boolean): string {
  return `Today's passenger is ${stillWord(still)}walking to the destination (estimate).`;
}

export const CAPTION_TODAY_ARRIVED = "Today's passenger has arrived.";
export const CAPTION_BOTH_ARRIVED = 'Both passengers have arrived.';

function clause1938(phase: Caption1938Phase, still: boolean): string {
  if (phase === 'waiting') return caption1938Waiting(still);
  if (phase === 'riding') return caption1938Riding(still);
  return CAPTION_1938_ARRIVED;
}

function clauseToday(phase: CaptionTodayPhase, still: boolean): string {
  if (phase === 'walking-to-stop') return captionTodayWalkingToStop(still);
  if (phase === 'waiting') return captionTodayWaiting(still);
  if (phase === 'riding') return captionTodayRiding(still);
  if (phase === 'walking-to-destination') return captionTodayWalkingToDestination(still);
  return CAPTION_TODAY_ARRIVED;
}

/** The caption for a key: the clauses joined with a space. */
export function captionText(key: CaptionKey): string {
  if (key.kind === 'orientation') return ORIENTATION_LINE;
  if (key.kind === 'both-arrived') return CAPTION_BOTH_ARRIVED;
  const first = clause1938(key.p1938.phase, key.p1938.still);
  return key.today ? `${first} ${clauseToday(key.today.phase, key.today.still)}` : first;
}

// ---- Takeaway (Req 8) -----------------------------------------------------------

export const TAKEAWAY_HEADING = 'Where the time goes';

export function takeawayWaiting(a: number, b: number): string {
  return `Waiting: trolley ${a} min, today's bus ${b} min.`;
}

/** {w} is the sum of the shown walk parts. */
export function takeawayWalking(w: number): string {
  return `Walking (estimate): today's bus ${w} min.`;
}

export function takeawayRiding(c: number, d: number): string {
  return `Riding: trolley ${c} min, today's bus ${d} min.`;
}

/** With no one-seat ride. */
export function takeawayWaitingTrolley(a: number): string {
  return `Waiting: trolley ${a} min.`;
}

/** With no one-seat ride. */
export function takeawayRidingTrolley(c: number): string {
  return `Riding: trolley ${c} min.`;
}

export const TAKEAWAY_MOST = 'Waiting accounts for most of the difference in this race.';
/** Whose wait it is (task 25.5): the loser's. When today wins, the trolley passenger waited longer; when 1938 wins, today's passenger did. */
export const TAKEAWAY_MOST_TROLLEY = "The trolley passenger's wait accounts for most of the difference.";
export const TAKEAWAY_MOST_TODAY = "Today's passenger's wait accounts for most of the difference.";
export const METHOD_WALK_SUM = 'Sum of the two walks as shown, to and from the stop.';

// ---- Next steps and the today-win notice (Req 10) ----------------------------------

export const NEXT_TRY_TIME = 'Try another time';
export const NEXT_TRY_CORNERS = 'Try other corners';
export const NEXT_SHOW_TODAY_WIN = 'Show a race today wins';
/** After the finish: plays the same race again (task 25.3). */
export const REPLAY_RACE = 'Replay this race';

/** `time` is the entry's start in 12-hour form, plain text. */
export function todayWinNotice(origin: string, dest: string, time: string): string {
  return `Showing a race today wins: ${origin} → ${dest}, starting ${time} (scheduled).`;
}

// ---- Slider and chart (Req 9) ------------------------------------------------------
// The slider's two ends are "{h:mm AM/PM}" from the race file: clock12, through label12.

export const SLIDER_LABEL = 'Choose a scheduled start time';
export const CHART_HEADING = 'How much does the start time matter?';
export const CHART_PROMPT_HEADING = 'How much does your start time matter?';
export const CHART_SUBHEADING = 'Scheduled journey minutes for each start time, for these corners and this direction.';
/** How to read the chart, directly under its heading (task 25.7). */
export const CHART_READING = 'Each point is a different start time. Lower is faster.';
export const CHART_LEGEND_1938 = '1938 trolley';
export const CHART_LEGEND_TODAY = "Today's bus, walking included (estimated)";

/** `time` is "{h:mm AM/PM}". */
export function chartReadout(time: string, n: number, m: number): string {
  return `At ${time}: trolley ${n} min, today's bus ${m} min.`;
}

/** With no one-seat ride. */
export function chartReadoutTrolley(time: string, n: number): string {
  return `At ${time}: trolley ${n} min.`;
}

export const CHART_HATCH_LABEL = 'Before the 1938 midday timetable reaches this corner';
export const CHART_ACCESSIBLE_NAME =
  "Chart of scheduled journey minutes for each start time, 1938 trolley and today's bus. Move the start time slider to read a minute.";

// ---- Route preview and departures (Req 11, 12) ---------------------------------

export const VIEW_ROUTE = 'View route';
export const HIDE_ROUTE = 'Hide route';
export const DEPARTURES_BUTTON = 'Scheduled departures';

// ---- Counts and Sources (Req 2, 13) ----------------------------------------------

/** The "When today wins" sheet heading; `winsToday` is summary.wins_today, already formatted. */
export function whenTodayWinsHeading(winsToday: string): string {
  return `The ${winsToday} races today wins`;
}

/** `minutes` and `fractionPct` are summary.ride_same_rule, as plain text. */
export function methodRideVerdicts(minutes: string, fractionPct: string): string {
  return `Counted over this line's corner pairs, comparing each 1938 ride with the median of today's scheduled rides. About as long means within ${minutes} ${minuteWord(Number(minutes))} or ${fractionPct}% of the 1938 ride, whichever is larger.`;
}
