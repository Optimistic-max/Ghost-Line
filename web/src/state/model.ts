// State and view types (design 4 and 5).
import type { Index, Pair, RaceFile, RaceResult, RaceRow, Summary, TodayWin, Trip } from '../data/types';
import type { PhotoTotals } from '../format/rounding';

export type MotionLevel = 'full' | 'lite' | 'reduced';
export type RacePhase = 'idle' | 'running' | 'finished';
export type SheetName = 'sources' | 'corners' | 'about' | 'whentoday';
export type MapStatus = 'pending' | 'ready' | 'unavailable';
export type Picker = { step: 'start' } | { step: 'end'; start: string };
/** The shared-link banner names the pair the link opened; the bad-link banner names the lead pair. */
export type Banner = { kind: 'shared'; pair: Pair } | { kind: 'bad' };

export type DataState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; index: Index; summary: Summary; races: ReadonlyMap<string, RaceFile> };

export type AppState = {
  data: DataState;
  pair: Pair;
  /** The slider value, minutes after midnight; null until the first race file gives the range. */
  minute: number | null;
  /** True when the minute came from the New York clock (R3.4). */
  minuteFromClock: boolean;
  /** The race lifecycle. The elapsed time lives in the clock, outside the store. */
  race: { phase: RacePhase; resultShown: boolean };
  motion: MotionLevel;
  sheet: SheetName | null;
  /** The number button whose Sources row the sheet opens at. */
  sourcesTarget: string | null;
  picker: Picker | null;
  banner: Banner | null;
  mapStatus: MapStatus;
  /** True from data ready on a visit without a valid share link, until the first Visitor_Input (Req 3). */
  guided: boolean;
  /** The orientation pause has run or been skipped in this visit (Req 4). */
  oriented: boolean;
  /** Index of the next summary.today_wins entry the shortcut selects (Req 10.4). */
  todayWinNext: number;
  /** The entry the shortcut selected, while its notice shows (Req 10.5). */
  todayWinNotice: TodayWin | null;
  /** The departures section is open (Req 11.2). */
  departuresOpen: boolean;
  /** The phone route preview is expanded (Req 12.8). */
  routeOpen: boolean;
};

// ---- The derived view -----------------------------------------------------------

export type Side = '1938' | 'today';
export type PhaseKind = 'walk-to-stop' | 'wait' | 'ride' | 'walk-from-stop';

/** One phase of a lane: its stored minutes and the minutes shown for it. */
export type Phase = { side: Side; kind: PhaseKind; stored: number; shown: number };

export type Lane = {
  side: Side;
  phases: Phase[];
  storedTotal: number;
  shownTotal: number;
  /** The next car or bus, "hh:mm" (a bus departure with its seconds dropped). */
  next: string;
};

export type ResultView =
  | { kind: '1938'; shownMargin: number }
  | { kind: 'today'; shownMargin: number }
  | { kind: 'photo_finish'; totals: PhotoTotals }
  | { kind: 'no_one_seat_ride' };

/** The colour token of the result line (R6.2, R6.8). */
export type ResultColour = 'ghost' | 'today' | 'ink';

export type Notice = 'before-table' | 'inferred';

export type Board = {
  /** The time the board lists departures after: row.start. */
  after: string;
  /** 1938 cars, "hh:mm"; the first is the next one. */
  cars: string[];
  /** Buses: the trips, the first being the next one. */
  buses: Trip[];
  /** The 1938 spacing in the board's short form ("every 7 or 8 min"). */
  spacing1938: string;
  /** The bus gaps in the board's short form ("34 to 39 min apart"); null when there are no bus gaps. */
  busGaps: string | null;
};

export type Frequency = {
  gapPart: string;
  windowFrom: string;
  windowTo: string;
  routeNames: string;
  date: string;
  spacing1938: string;
};

export type Honest = { form: 'plain' | 'photo-finish' | 'today-wins'; wins1938: number; races: number };

/** The "Where the time goes" values (Req 8): the lane legends' shown parts, and the stored wait_most flag. */
export type Takeaway = {
  wait1938: number;
  ride1938: number;
  /** Null for no one-seat ride. `walk` is the sum of the two shown walks. */
  today: { wait: number; walk: number; ride: number } | null;
  /** row.wait_most as stored; nothing in the site compares waits. */
  waitMost: boolean;
};

export type RaceView = {
  pair: Pair;
  originName: string;
  destName: string;
  /** The row on screen, for lookups by the number buttons. */
  row: RaceRow;
  trip: Trip | null;
  start: string;
  beforeTable: boolean;
  inferred: boolean;
  /** Always row.result. */
  result: RaceResult;
  resultView: ResultView;
  colour: ResultColour;
  lane1938: Lane;
  /** Null for no one-seat ride. */
  laneToday: Lane | null;
  /** The sum of the shown walk parts, for the spoken summary (R7.5); null without a bus. */
  walkShown: number | null;
  notices: Notice[];
  board: Board;
  /** Null when there are no bus gaps (no trips). */
  frequency: Frequency | null;
  honest: Honest;
  takeaway: Takeaway;
};

export type Derived = { status: 'loading' } | { status: 'error' } | { status: 'ready'; view: RaceView };
