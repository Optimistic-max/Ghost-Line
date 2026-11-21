// Types of the four generated files in public/data (race-brief section 4, with
// race-engine task 35). Field names are exactly as the pipeline writes them.
// shape.ts checks each file against these types when it arrives.

export type SourceId =
  | 'guide1938_diagram'
  | 'guide1938_timetable'
  | 'guide1938_route'
  | 'mta_gtfs'
  | 'osm'
  | 'method';

/** A catalog entry. Only the method entry may have a null year and url. */
export type SourceEntry = {
  label: string;
  what: string;
  year: number | null;
  where: string;
  url: string | null;
};

export type Corner = {
  slug: string;
  name: string;
  lonlat: [number, number];
  inferred: boolean;
  note: string | null;
};

export type Pair = { origin: string; dest: string };

export type Index = {
  schema: string;
  line: string;
  mode: string;
  effective: string;
  corners: Corner[];
  pairs: Pair[];
  service_date: string;
  feed_version: string;
  feed_sha256: string;
  street_order_checked: boolean;
  /** The photo-finish band in minutes (race-engine task 36). */
  photo_finish_min: number;
  sources: Record<SourceId, SourceEntry>;
};

/** Maps a block of a file to the catalog IDs that cover it. */
export type SourceMap = Record<string, SourceId[]>;

export type StopRef = { stop_id: string; name: string; walk_m: number; walk_min: number };

export type Trip = {
  i: number;
  trip_id: string;
  route: string;
  route_display: string;
  headsign: string;
  /** The headsign in title case, for the Sources sheet (race-engine task 36). */
  headsign_display: string;
  board: StopRef;
  alight: StopRef;
  /** hh:mm:ss; hours may pass 24. */
  dep: string;
  arr: string;
  ride_min: number;
};

export type RaceResult = '1938' | 'today' | 'photo_finish' | 'no_one_seat_ride';

export type RaceRow = {
  /** Slider time, hh:mm. */
  t: string;
  /** The time both sides race from, hh:mm. */
  start: string;
  before_table: boolean;
  y1938: { dep: string; wait: number; total: number };
  today: { trip: number; wait: number; total: number } | null;
  result: RaceResult;
  /** Present for every result except no_one_seat_ride. */
  margin?: number;
  /** Stored by the pipeline: the wait is most of the difference. The site only reads it. */
  wait_most: boolean;
};

export type RaceFile = {
  schema: string;
  line: string;
  origin: string;
  dest: string;
  direction: 'eastbound' | 'westbound';
  inferred: boolean;
  service_date: string;
  feed_version: string;
  feed_sha256: string;
  radius_m: number;
  y1938: {
    ride_min: number;
    covered_from: string;
    passes: string[];
    gap_min: number;
    gap_max: number;
    sources: { ride_min: string; passes: string };
  };
  today: {
    gap_min: number | null;
    gap_max: number | null;
    window_from: string;
    window_to: string;
    route_names: string[];
    trips: Trip[];
  };
  races: RaceRow[];
  sources: SourceMap;
};

export type TodayWin = { origin: string; dest: string; t: string; margin: number };

export type RideVerdict = 'same' | 'faster today' | 'slower today';

export type PairVerdict = {
  origin: string;
  dest: string;
  races: number;
  wins_1938: number;
  wins_today: number;
  photo_finishes: number;
  ride_1938: number;
  ride_today_median: number | null;
  delta: number | null;
  ride_verdict: RideVerdict | null;
};

/** The rule that counts two ride times as the same, as the pipeline applied it. */
export type RideSameRule = { minutes: number; fraction_pct: number };

export type Summary = {
  schema: string;
  definition: string;
  races: number;
  wins_1938: number;
  wins_today: number;
  photo_finishes: number;
  ride_same: number;
  ride_faster_today: number;
  ride_slower_today: number;
  ride_same_rule: RideSameRule;
  pairs_without_one_seat_ride: number;
  today_wins: TodayWin[];
  pairs: PairVerdict[];
  sources: SourceMap;
};

export type RouteLeg = {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: number[][] };
  properties: {
    direction: 'eastbound' | 'westbound';
    street: string;
    method: 'osm' | 'osm+gap' | 'inferred';
    note: string | null;
    length_m: number;
  };
};

export type Route = { type: 'FeatureCollection'; features: RouteLeg[]; sources: SourceMap };
