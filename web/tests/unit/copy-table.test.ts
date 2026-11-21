// Task 5.2: copy.ts and announce.ts hold exactly the copy table of
// requirements.md. Templates are rendered with the table's own placeholders
// (for example '{n}') so each must equal its quoted string exactly.
import { describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import * as A from '../../src/copy/announce';
import * as C from '../../src/copy/copy';
import { cornerName } from '../../src/data/lookup';
import { ALLOWED_PHRASE, bannedTerms } from '../support/banned';
import { copyTable, effectiveCopyTable, storyCopyTable, stringLiterals } from '../support/copytable';
import { listRepoFiles, readRepoText } from '../support/files';
import { realData } from '../support/realdata';
import { minuteWordProblems } from '../support/words';

/** A table placeholder where a template takes a number. */
const n = (placeholder: string): number => placeholder as unknown as number;
const N = n('{n}');

const { index } = realData();
const leadOrigin = cornerName(index, LEAD_PAIR.origin)!;
const leadDest = cornerName(index, LEAD_PAIR.dest)!;
const inferredName = index.corners.find((c) => c.inferred)!.name;

const announceBus = { origin: '{origin}', dest: '{dest}', time: '{time}', trolley: N, bus: N, walk: N, margin: N };

/** Each export that is a table string, with what it renders. */
const RENDERED: Record<string, string> = {
  LOADING: C.LOADING,
  WORDMARK: C.WORDMARK,
  lineLabel: C.lineLabel('{n}', '{year}'),
  ready: C.ready('{service_date as Nov 4, 2026}'),
  START_IS_NOW: C.START_IS_NOW,
  waiting1938: C.waiting1938(N, '{hh:mm}'),
  riding: C.riding(N),
  walkingToStop: C.walkingToStop(N),
  waitingForBus: C.waitingForBus('{h:mm}'),
  walkingFromStop: C.walkingFromStop(N),
  legendWalk: C.legendWalk(N),
  legendWait: C.legendWait(N),
  legendRide: C.legendRide(N),
  wins1938: C.wins1938(N),
  totals1938Wins: C.totals1938Wins(N, N),
  winsToday: C.winsToday(N),
  totalsTodayWins: C.totalsTodayWins(N, N),
  PHOTO_FINISH: C.PHOTO_FINISH,
  bothAbout: C.bothAbout(N),
  aboutAnd: C.aboutAnd(N, n('{m}')),
  beforeTable: C.beforeTable('{start}'),
  NO_ONE_SEAT_RIDE: C.NO_ONE_SEAT_RIDE,
  NO_SINGLE_BUS: C.NO_SINGLE_BUS,
  trolleyNoWinner: C.trolleyNoWinner(N),
  INFERRED_CHIP: C.INFERRED_CHIP,
  INFERRED_CAUTION: C.INFERRED_CAUTION,
  honestLine: C.honestLine('{wins_1938}', '{races}'),
  honestLineTodayWins: C.honestLineTodayWins('{wins_1938}', '{races}'),
  rideVerdicts: C.rideVerdicts('{ride_same}', '{pairs}', '{ride_faster_today}'),
  rideSlowerClause: C.rideSlowerClause('{ride_slower_today}'),
  SENTENCE_END: C.SENTENCE_END,
  frequency: C.frequency(
    '{gap part}',
    '{window_from}',
    '{window_to}',
    '{route_names}',
    '{service_date}',
    C.everyMinutesOr(n('{a}'), n('{b}')),
  ),
  gapUpTo: C.gapUpTo(n('{max}')),
  gapRange: C.gapRange(n('{min}'), n('{max}')),
  gapEqual: C.gapEqual(N),
  everyMinutes: C.everyMinutes(N),
  LINK_COPIED: C.LINK_COPIED,
  sharedRace: C.sharedRace('{origin}', '{dest}'),
  badLink: C.badLink(leadOrigin, leadDest),
  DATA_ERROR: C.DATA_ERROR,
  MAP_UNAVAILABLE: C.MAP_UNAVAILABLE,
  MAP_UNAVAILABLE_NO_DRAWING: C.MAP_UNAVAILABLE_NO_DRAWING,
  MAP_CREDIT: C.MAP_CREDIT,
  PICKER_TITLE: C.PICKER_TITLE,
  PICKER_STEP_START: C.PICKER_STEP_START,
  PICKER_STEP_END: C.PICKER_STEP_END,
  pickerNote: C.pickerNote(inferredName),
  PICKER_START_TAG: C.PICKER_START_TAG,
  INFERRED_TAG: C.INFERRED_TAG,
  CANCEL: C.CANCEL,
  BASE_MAP_CREDIT: C.BASE_MAP_CREDIT,
  NOT_ENDORSED: C.NOT_ENDORSED,
  FONT_CREDIT: C.FONT_CREDIT,
  VEHICLE_CREDIT: C.VEHICLE_CREDIT,
  howItWasMade: C.howItWasMade(false),
  CHECKED_BY_HAND: C.CHECKED_BY_HAND,
  MIT_LICENCE: C.MIT_LICENCE,
  SOURCE_CODE: C.SOURCE_CODE,
  FIXTURE_TAG: C.FIXTURE_TAG,
  SOURCES: C.SOURCES,
  SHARE_THIS_RACE: C.SHARE_THIS_RACE,
  SKIP_TO_RESULT: C.SKIP_TO_RESULT,
  ABOUT_AND_CREDITS: C.ABOUT_AND_CREDITS,
  FOOTER_LINE: C.FOOTER_LINE,
  clockReadout: C.clockReadout('{n}:{nn}'),
  announce1938Wins: A.announce1938Wins(announceBus),
  announceTodayWins: A.announceTodayWins(announceBus),
  announcePhotoFinish: A.announcePhotoFinish(announceBus),
  announceNoOneSeatRide: A.announceNoOneSeatRide(announceBus),
  TRY_AGAIN: C.TRY_AGAIN,
  // Draft rows (Nov 19).
  LANE_TITLE_1938: C.LANE_TITLE_1938,
  LANE_TITLE_TODAY: C.LANE_TITLE_TODAY,
  minShort: C.minShort(N),
  boardHeader: C.boardHeader('{h:mm}'),
  BOARD_1938: C.BOARD_1938,
  BOARD_TODAY: C.BOARD_TODAY,
  boardEveryOr: C.boardEveryOr(n('{a}'), n('{b}')),
  boardEvery: C.boardEvery(N),
  boardGapUpTo: C.boardGapUpTo(n('{max}')),
  boardGapRange: C.boardGapRange(n('{min}'), n('{max}')),
  boardGapEqual: C.boardGapEqual(N),
  numberLabel: C.numberLabel('{value}', '{what}'),
  minutes: C.minutes(N),
  whatBetween: C.whatBetween('{what}', '{origin}', '{dest}'),
  whatFrom: C.whatFrom('{what}', '{h:mm}'),
  whatAt: C.whatAt('{what}', '{corner}'),
  whatBusGaps: C.whatBusGaps('{window_from}', '{window_to}'),
  SOURCES_TITLE: C.SOURCES_TITLE,
  NEW_TAB: C.NEW_TAB,
  SOURCES_AND_CREDITS: C.SOURCES_AND_CREDITS,
  CLOSE: C.CLOSE,
  METHOD_RIDE_1938: C.METHOD_RIDE_1938,
  methodNextCar: C.methodNextCar('{h:mm}'),
  METHOD_CAR_1938: C.METHOD_CAR_1938,
  METHOD_TOTAL_1938: C.METHOD_TOTAL_1938,
  methodWalk: C.methodWalk(N),
  METHOD_WAIT_BUS: C.METHOD_WAIT_BUS,
  DATA_INCOMPLETE: C.DATA_INCOMPLETE,
  photoFinishMeaning: C.photoFinishMeaning(n('{photo_finish_min}')),
  METHOD_RIDE_BUS: C.METHOD_RIDE_BUS,
  methodBusTrip: C.methodBusTrip('{route}', '{headsign}', '{stop_id}', '{h:mm}'),
  methodTotalToday: C.methodTotalToday('{h:mm}'),
  METHOD_MARGIN: C.METHOD_MARGIN,
  METHOD_RACE_COUNTS: C.METHOD_RACE_COUNTS,
  dateEffective: C.dateEffective('{date}'),
  dateFeed: C.dateFeed('{feed_version}', '{date}'),
  exactValue: C.exactValue('{x}', N),
  sliderValueText: C.sliderValueText('{hh:mm AM/PM}'),
  ONE_MINUTE_EARLIER: C.ONE_MINUTE_EARLIER,
  ONE_MINUTE_LATER: C.ONE_MINUTE_LATER,
  SWAP_DIRECTION: C.SWAP_DIRECTION,
  HEADLINE_LINE: C.HEADLINE_LINE,
  todayWinEntry: C.todayWinEntry('{origin}', '{dest}', '{h:mm}'),
  MAP_INFERRED: C.MAP_INFERRED,
  // Story-layer rows.
  exampleLabel: C.exampleLabel('{h:mm AM/PM}'),
  PHONE_INTRO: C.PHONE_INTRO,
  STILL: C.STILL,
  ORIENTATION_LINE: C.ORIENTATION_LINE,
  caption1938Waiting: C.caption1938Waiting(false),
  'caption1938Waiting.still': C.caption1938Waiting(true),
  caption1938Riding: C.caption1938Riding(false),
  'caption1938Riding.still': C.caption1938Riding(true),
  CAPTION_1938_ARRIVED: C.CAPTION_1938_ARRIVED,
  captionTodayWalkingToStop: C.captionTodayWalkingToStop(false),
  'captionTodayWalkingToStop.still': C.captionTodayWalkingToStop(true),
  captionTodayWaiting: C.captionTodayWaiting(false),
  'captionTodayWaiting.still': C.captionTodayWaiting(true),
  captionTodayRiding: C.captionTodayRiding(false),
  'captionTodayRiding.still': C.captionTodayRiding(true),
  captionTodayWalkingToDestination: C.captionTodayWalkingToDestination(false),
  'captionTodayWalkingToDestination.still': C.captionTodayWalkingToDestination(true),
  CAPTION_TODAY_ARRIVED: C.CAPTION_TODAY_ARRIVED,
  CAPTION_BOTH_ARRIVED: C.CAPTION_BOTH_ARRIVED,
  TAKEAWAY_HEADING: C.TAKEAWAY_HEADING,
  takeawayWaiting: C.takeawayWaiting(n('{a}'), n('{b}')),
  takeawayWalking: C.takeawayWalking(n('{w}')),
  takeawayRiding: C.takeawayRiding(n('{c}'), n('{d}')),
  takeawayWaitingTrolley: C.takeawayWaitingTrolley(n('{a}')),
  takeawayRidingTrolley: C.takeawayRidingTrolley(n('{c}')),
  TAKEAWAY_MOST: C.TAKEAWAY_MOST,
  METHOD_WALK_SUM: C.METHOD_WALK_SUM,
  NEXT_TRY_TIME: C.NEXT_TRY_TIME,
  NEXT_TRY_CORNERS: C.NEXT_TRY_CORNERS,
  NEXT_SHOW_TODAY_WIN: C.NEXT_SHOW_TODAY_WIN,
  todayWinNotice: C.todayWinNotice('{origin}', '{dest}', '{h:mm AM/PM}'),
  SLIDER_LABEL: C.SLIDER_LABEL,
  CHART_HEADING: C.CHART_HEADING,
  CHART_PROMPT_HEADING: C.CHART_PROMPT_HEADING,
  CHART_SUBHEADING: C.CHART_SUBHEADING,
  CHART_LEGEND_1938: C.CHART_LEGEND_1938,
  CHART_LEGEND_TODAY: C.CHART_LEGEND_TODAY,
  chartReadout: C.chartReadout('{h:mm AM/PM}', N, n('{m}')),
  chartReadoutTrolley: C.chartReadoutTrolley('{h:mm AM/PM}', N),
  CHART_HATCH_LABEL: C.CHART_HATCH_LABEL,
  CHART_ACCESSIBLE_NAME: C.CHART_ACCESSIBLE_NAME,
  VIEW_ROUTE: C.VIEW_ROUTE,
  HIDE_ROUTE: C.HIDE_ROUTE,
  DEPARTURES_BUTTON: C.DEPARTURES_BUTTON,
  whenTodayWinsHeading: C.whenTodayWinsHeading('{wins_today}'),
  methodRideVerdicts: C.methodRideVerdicts('{ride_same_rule.minutes}', '{ride_same_rule.fraction_pct}'),
};

/**
 * Race-screen strings that story-layer rows replace (story-layer Requirement 13.8,
 * decisions 22 and 23). They leave the effective table, so a template still printing
 * one fails the tests below. Each is replaced in copy.ts, in place.
 */
const REPLACED = [
  'Start time',
  'Scheduled departures from this corner after {h:mm}',
  'Same ride, longer wait. Trolley first in {wins_1938} of {races} races. When today wins',
  'Today wins this race. Across this line: same ride, longer wait. Trolley first in {wins_1938} of {races} races. When today wins',
  'Scheduled one-seat buses on this stretch leave {gap part} between {window_from} and {window_to} ({route_names}, weekday schedule as of {service_date}). In 1938 a trolley was scheduled every {y1938.gap_min} or {y1938.gap_max} minutes.',
  'races where the 1938 trolley arrives first',
  'races on this line',
  'Counted over every race on this line, one per corner pair and slider minute.',
  "Counted over this line's corner pairs, comparing each 1938 ride with the median of today's scheduled rides.",
];


/** The phrases of WHAT ("What a number is"), each a table string. */
for (const [key, phrase] of Object.entries(C.WHAT)) RENDERED[`WHAT.${key}`] = phrase;

/** Exports that are not a table string on their own; each is checked below. */
const HELPERS = [
  'minuteWord',
  'clock12',
  'LIST_AND',
  'WHAT',
  'everyMinutesOr',
  'trolleyFirst',
  'captionText',
  'whenTodayWinsSentence',
  'SAME_RIDE',
  'TODAY_WINS_THIS_RACE',
  'ACROSS_THIS_LINE',
  'WHEN_TODAY_WINS',
  'NOT_LIVE',
];

// Both copy tables, the story-layer row winning where it replaces a race-screen row.
const table = effectiveCopyTable(REPLACED);

/** A caption row's "{still }" stands for "still " or nothing: both forms are table strings. */
const quotedForms = table.quoted.flatMap((q) =>
  q.includes('{still }') ? [q.replace('{still }', 'still '), q.replace('{still }', '')] : [q],
);

/** Slider ends: "{hh:mm AM/PM}" (race-screen) and "{h:mm AM/PM}" (story-layer), both built by clock12. */
/**
 * The identifiers of design 3.1's CaptionKey ("kind" and phase names). They select a
 * caption and are never shown. The three phase names that are also table words
 * (waiting, riding, arrived) need no entry. Exact matches only: nothing else is exempt.
 */
const CAPTION_KEY_IDS = ['orientation', 'both-arrived', 'clauses', 'walking-to-stop', 'walking-to-destination'];

const CLOCK_FORMS = ['{hh:mm AM/PM}', '{h:mm AM/PM}'];

describe('copy.ts and announce.ts hold the copy table', () => {
  it('reads both copy tables', () => {
    expect(table.quoted.length).toBeGreaterThan(100);
    expect(table.quoted).toContain('Where the time goes');
  });

  it('has a template for every quoted string of the table', () => {
    const rendered = new Set(Object.values(RENDERED));
    const missing = quotedForms.filter((q) => !CLOCK_FORMS.includes(q) && !rendered.has(q));
    expect(missing).toEqual([]);
  });

  it('renders nothing that is not a quoted string of the table', () => {
    const quoted = new Set(quotedForms);
    const extra = Object.entries(RENDERED).filter(([, text]) => !quoted.has(text));
    expect(extra).toEqual([]);
  });

  it('exports nothing that is neither a table string nor a checked helper', () => {
    const exported = [...Object.keys(C), ...Object.keys(A)];
    const unknown = exported.filter((name) => !(name in RENDERED) && !HELPERS.includes(name));
    expect(unknown).toEqual([]);
  });

  it('holds no literal wording that is not in the table', () => {
    for (const file of ['web/src/copy/copy.ts', 'web/src/copy/announce.ts']) {
      const strange = stringLiterals(readRepoText(file)).filter(
        (s) => /[A-Za-z]/.test(s) && !table.raw.includes(s) && !CAPTION_KEY_IDS.includes(s),
      );
      expect(strange, file).toEqual([]);
    }
  });
});

describe('the literal scan', () => {
  it('reads quoted strings and template parts, and skips comments and imports', () => {
    const source = [
      "import { x } from './x';",
      "const a = 'one'; // 'not this'",
      '/* "nor this" */ const b = "two";',
      'const c = `three ${f(\'four\')} five`;',
    ].join('\n');
    expect(stringLiterals(source)).toEqual(['one', 'two', 'three ', 'four', ' five']);
  });

  it('would catch a word that is not in the table', () => {
    const strange = stringLiterals("const s = 'Arriving soon';").filter((s) => !table.raw.includes(s));
    expect(strange).toEqual(['Arriving soon']);
  });
});

describe('helpers', () => {
  it('clock12 gives the slider label form "{hh:mm AM/PM}"', () => {
    expect(table.quoted).toContain('{hh:mm AM/PM}');
    expect(table.quoted).toContain('{h:mm AM/PM}');
    expect(C.clock12('10:00', false)).toBe('10:00 AM');
    expect(C.clock12('2:00', true)).toBe('2:00 PM');
  });

  it('the data-error button reads "Try again"', () => {
    expect(table.raw).toMatch(/\| Data error \|.*the button "Try again" \|/);
    expect(C.TRY_AGAIN).toBe('Try again');
  });

  it('WHAT holds every phrase of the "What a number is" rows: the race-screen phrases in order with the story-layer replacements in place, then the story-layer additions', () => {
    const lines = copyTable().raw.split('\n');
    const phrasesOf = (line: string): string[] => [...line.matchAll(/"([^"]*)"/g)].map((m) => m[1]!);
    const raceRow = phrasesOf(lines.find((l) => l.startsWith('| What a number is |'))!);
    const replacements: Record<string, string> = {
      'races where the 1938 trolley arrives first': 'covered starts where the 1938 trolley arrives first',
      'races on this line': 'covered starts on this line',
    };
    const additions = ["walks to and from the stop, together (estimate)", "covered starts where today's bus arrives first"];
    // Every replacement and addition is a quoted string of the story-layer row.
    const storyRow = storyCopyTable().raw.split('\n').find((l) => l.startsWith('| What a number is (Req 8, Req 13)'))!;
    for (const phrase of [...Object.keys(replacements), ...Object.values(replacements), ...additions]) {
      expect(phrasesOf(storyRow), phrase).toContain(phrase);
    }
    expect(Object.values(C.WHAT)).toEqual([...raceRow.map((p) => replacements[p] ?? p), ...additions]);
  });

  it('the replaced race-screen strings are gone from the effective table and from copy.ts', () => {
    const source = readRepoText('web/src/copy/copy.ts');
    for (const old of REPLACED) {
      expect(table.quoted, old).not.toContain(old);
      expect(Object.values(RENDERED), old).not.toContain(old);
    }
    for (const old of ['Scheduled departures from this corner after', 'In 1938 a trolley was scheduled', ' races.`', 'races on this line']) {
      expect(source, old).not.toContain(old);
    }
  });

  it('the race-screen ride-same line is gone from copy.ts', () => {
    expect((C as Record<string, unknown>).METHOD_RIDE_VERDICTS).toBeUndefined();
  });

  it('board row labels and header follow the story-layer departures row', () => {
    expect(C.BOARD_1938).toBe('1938 trolley, at this corner');
    expect(C.BOARD_TODAY).toBe("Today's bus, from the boarding stop");
    expect(C.LANE_TITLE_TODAY).toBe("Today's bus");
    expect(C.boardHeader('{h:mm}')).toBe('Scheduled departures after {h:mm}');
  });

  it('captionText joins the clauses with a space and uses the {still } rule', () => {
    const both = C.captionText({
      kind: 'clauses',
      p1938: { phase: 'arrived', still: false },
      today: { phase: 'riding', still: true },
    });
    expect(both).toBe(`${C.CAPTION_1938_ARRIVED} ${C.captionTodayRiding(true)}`);
    expect(both).toBe("The trolley passenger has arrived. Today's passenger is still riding.");
    expect(C.captionText({ kind: 'clauses', p1938: { phase: 'waiting', still: false }, today: null })).toBe(
      C.caption1938Waiting(false),
    );
    expect(C.captionText({ kind: 'both-arrived' })).toBe(C.CAPTION_BOTH_ARRIVED);
    expect(C.captionText({ kind: 'orientation' })).toBe(C.ORIENTATION_LINE);
  });

  it('methodRideVerdicts reads a one-minute tolerance in the singular', () => {
    expect(C.methodRideVerdicts('1', '15')).toContain('within 1 minute or 15% of');
    expect(C.methodRideVerdicts('1.5', '15')).toContain('within 1.5 minutes or 15% of');
  });

  it('reads the photo-finish meaning with the real band as approved', () => {
    expect(C.photoFinishMeaning(1)).toBe(
      'Photo finish: the two totals are less than 1 minute apart. Walks are estimates, so neither side counts as a win.',
    );
  });

  it('builds a number\'s name from its visible text and the approved phrases (Emmanuel, Nov 20)', () => {
    expect(C.numberLabel(C.minShort(6), C.WHAT.wait1938)).toBe('6 min, scheduled 1938 wait. Show source.');
    expect(C.numberLabel(C.boardEveryOr(n('7'), n('8')), C.WHAT.spacing1938)).toBe(
      'every 7 or 8 min, scheduled spacing of 1938 cars at this corner. Show source.',
    );
    expect(C.numberLabel('10:06', C.WHAT.car1938)).toBe('10:06, scheduled 1938 car. Show source.');
    // Where a sentence prints the long unit, the name starts with the long unit.
    expect(C.numberLabel(C.minutes(30), C.WHAT.margin)).toBe('30 minutes, difference of the two scheduled totals. Show source.');
    expect(C.numberLabel(C.minutes(1), C.WHAT.margin)).toBe('1 minute, difference of the two scheduled totals. Show source.');
  });

  it('the honest-line parts are exactly the two honest lines, in order', () => {
    const counts = C.trolleyFirst('{wins_1938}', '{races}');
    expect([C.SAME_RIDE, counts, C.WHEN_TODAY_WINS].join(' ')).toBe(RENDERED.honestLine);
    expect([C.TODAY_WINS_THIS_RACE, C.ACROSS_THIS_LINE, counts, C.WHEN_TODAY_WINS].join(' ')).toBe(
      RENDERED.honestLineTodayWins,
    );
  });

  it('NOT_LIVE is the fixed phrase that ends the Ready line', () => {
    expect(C.NOT_LIVE).toBe(ALLOWED_PHRASE);
    expect(RENDERED.ready.endsWith(` ${C.NOT_LIVE}`)).toBe(true);
  });

  it('everyMinutesOr is the 1938 spacing inside the frequency sentence', () => {
    expect(RENDERED.frequency).toContain(C.everyMinutesOr(n('{a}'), n('{b}')));
  });

  it('whenTodayWinsSentence adds the slower clause only when it is above zero, then the full stop', () => {
    const args = ['{ride_same}', '{pairs}', '{ride_faster_today}', '{ride_slower_today}'] as const;
    expect(C.whenTodayWinsSentence(...args, false)).toBe(`${RENDERED.rideVerdicts}${C.SENTENCE_END}`);
    expect(C.whenTodayWinsSentence(...args, true)).toBe(
      `${RENDERED.rideVerdicts}${RENDERED.rideSlowerClause}${C.SENTENCE_END}`,
    );
  });

  it('howItWasMade adds the checked-by-hand clause only when the flag is true', () => {
    expect(C.howItWasMade(false)).not.toContain(C.CHECKED_BY_HAND);
    expect(C.howItWasMade(true)).toContain(C.CHECKED_BY_HAND);
    expect(C.howItWasMade(true).replace(C.CHECKED_BY_HAND, '')).toBe(C.howItWasMade(false));
  });

  it('LIST_AND and minuteWord are words of the table', () => {
    for (const word of [C.LIST_AND, C.minuteWord(1), C.minuteWord(2)]) expect(table.raw).toContain(word);
    expect(C.minutes(1)).toBe('1 minute');
  });
});

describe('minute words (R15.5)', () => {
  const bus = { origin: 'A', dest: 'B', time: '10:00 AM', trolley: 1, bus: 1, walk: 1, margin: 1 };
  const renderAll = (k: number): string[] => [
    C.wins1938(k),
    C.winsToday(k),
    C.bothAbout(k),
    C.aboutAnd(k, k),
    C.gapUpTo(k),
    C.gapRange(k, k),
    C.gapEqual(k),
    C.everyMinutes(k),
    C.everyMinutesOr(k, k),
    C.numberLabel(C.minutes(k), C.WHAT.ride1938),
    C.photoFinishMeaning(k),
    A.announce1938Wins({ ...bus, trolley: k, bus: k, walk: k, margin: k }),
    A.announceTodayWins({ ...bus, trolley: k, bus: k, walk: k, margin: k }),
    A.announcePhotoFinish({ ...bus, trolley: k, bus: k, walk: k }),
    A.announceNoOneSeatRide({ ...bus, trolley: k }),
  ];

  for (const k of [0, 1, 2, 11, 21]) {
    it(`every template with a minute count reads correctly for ${k}`, () => {
      for (const text of renderAll(k)) expect(minuteWordProblems(text), text).toEqual([]);
    });
  }

  it('says "1 minute" in each template for 1', () => {
    for (const text of renderAll(1)) expect(text).toMatch(/\b1 minute\b/);
  });

  it('puts the unit after the second number in "About {n} and {m} minutes"', () => {
    expect(C.aboutAnd(1, 2)).toBe('About 1 and 2 minutes.');
    expect(C.aboutAnd(0, 1)).toBe('About 0 and 1 minute.');
  });
});

describe('the fixed phrase "Scheduled, not live."', () => {
  it('is the only place the word live appears in src/', () => {
    for (const file of listRepoFiles('web/src')) {
      expect(bannedTerms(readRepoText(file)), file).toEqual([]);
    }
    expect(readRepoText('web/src/copy/copy.ts')).toContain(ALLOWED_PHRASE);
  });

  it('is the only place the word live appears in any template', () => {
    for (const text of Object.values(RENDERED)) expect(bannedTerms(text), text).toEqual([]);
    expect(RENDERED.ready).toContain(ALLOWED_PHRASE);
  });
});
