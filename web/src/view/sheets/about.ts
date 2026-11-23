// About and credits (R10): a plain list, one line each. Catalog-backed lines
// use the catalog's label and link; the rest are copy-table lines. The
// checked-by-hand clause follows index.json's one flag. No 1933 line.
import { AUDIT_LOG_PATH, LICENCE_PATH, SOURCE_URLS } from '../../config';
import {
  AUDIT_LINE,
  BASE_MAP_CREDIT,
  FONT_CREDIT,
  HEADLINE_LINE,
  INFERRED_CAUTION,
  MIT_LICENCE,
  NOT_ENDORSED,
  NOT_LIVE,
  SOURCES_AND_CREDITS,
  SOURCE_CODE,
  VEHICLE_CREDIT,
  honestLimits,
  howItWasMade,
  photoFinishMeaning,
} from '../../copy/copy';
import type { Index, SourceId } from '../../data/types';
import { h } from '../dom';
import type { SheetParts } from './sheet';
import { sourceLink } from './sources';

/** The catalog entries the credits name: the 1938 guides, today's feed, the street geometry. */
const CREDITED: SourceId[] = ['guide1938_diagram', 'guide1938_timetable', 'guide1938_route', 'mta_gtfs', 'osm'];

const line = (...children: (Node | string)[]): HTMLElement => h('li', { class: 'credit' }, ...children);

export function aboutSheet(index: Index): SheetParts {
  const catalog = CREDITED.map((id) => {
    const entry = index.sources[id];
    const link = sourceLink(entry.label, entry.url);
    return id === 'mta_gtfs' ? line(link, ' ', NOT_ENDORSED) : line(link);
  });
  const items = [
    // What a trackless trolley is, in the desktop headline line's words: the phone shows no intro line
    // (polish brief P4, Emmanuel, Nov 23). It names the year; the sheet opens only once the data is in.
    line(HEADLINE_LINE),
    ...catalog,
    line(BASE_MAP_CREDIT),
    line(FONT_CREDIT),
    line(VEHICLE_CREDIT),
    line(photoFinishMeaning(index.photo_finish_min)),
    line(honestLimits(index.stop_radius_m)),
    line(howItWasMade(index.street_order_checked)),
    line(INFERRED_CAUTION),
    line(NOT_LIVE),
    line(sourceLink(MIT_LICENCE, `${SOURCE_URLS.repository}${LICENCE_PATH}`)),
    line(sourceLink(SOURCE_CODE, SOURCE_URLS.repository)),
    line(sourceLink(AUDIT_LINE, `${SOURCE_URLS.repository}${AUDIT_LOG_PATH}`)),
  ];
  return { name: 'about', title: SOURCES_AND_CREDITS, body: [h('ul', { class: 'credits' }, ...items)] };
}
