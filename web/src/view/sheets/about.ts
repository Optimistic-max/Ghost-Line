// About and credits (R10): a plain list, one line each. Catalog-backed lines
// use the catalog's label and link; the rest are copy-table lines. The
// checked-by-hand clause follows index.json's one flag. No 1933 line.
import { LICENCE_PATH, SOURCE_URLS } from '../../config';
import {
  BASE_MAP_CREDIT,
  FONT_CREDIT,
  INFERRED_CAUTION,
  MIT_LICENCE,
  NOT_ENDORSED,
  NOT_LIVE,
  SOURCES_AND_CREDITS,
  SOURCE_CODE,
  VEHICLE_CREDIT,
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
    ...catalog,
    line(BASE_MAP_CREDIT),
    line(FONT_CREDIT),
    line(VEHICLE_CREDIT),
    line(photoFinishMeaning(index.photo_finish_min)),
    line(howItWasMade(index.street_order_checked)),
    line(INFERRED_CAUTION),
    line(NOT_LIVE),
    line(sourceLink(MIT_LICENCE, `${SOURCE_URLS.repository}${LICENCE_PATH}`)),
    line(sourceLink(SOURCE_CODE, SOURCE_URLS.repository)),
  ];
  return { name: 'about', title: SOURCES_AND_CREDITS, body: [h('ul', { class: 'credits' }, ...items)] };
}
