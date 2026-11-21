// Task 13: the sheets. 13.1 the dialog (focus, Escape, scrim, Close, focus
// return); 13.2 the Sources rows; 13.3 About and credits; 13.4 When today wins;
// 13.5 P3 (every number button on the card, in each state, has a row in the
// sheet, found by crawling the DOM), P5 (other counts in summary.json show on
// screen), the credits with the flag true and false, and the today_wins list.
// Expected values are read from the files.
import { afterEach, describe, expect, it } from 'vitest';
import { LEAD_PAIR, LICENCE_PATH, SOURCE_URLS } from '../../src/config';
import * as C from '../../src/copy/copy';
import { cornerName, rowAt, tripAt } from '../../src/data/lookup';
import type { Index, Pair, SourceId, Summary } from '../../src/data/types';
import { formatCount } from '../../src/format/count';
import { dropSeconds, longDateLabel, minutesOf, shortClock, weekdayDateLabel } from '../../src/format/time';
import { buildView } from '../../src/state/derive';
import { FIXTURE_DIR, fixtureData } from '../support/fixture';
import { type PageOptions, bootPage } from '../support/page';
import { raceOf, readData, realData, slugNamed } from '../support/realdata';
import { text } from '../support/render';
import { fakeTime } from '../support/time';

const data = realData();
const { index, summary } = data;
const lead: Pair = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };
const westToPreston: Pair = { origin: slugNamed('Westwood & Carey'), dest: slugNamed('Preston & Caroline') };
const newYork = (hhmm: string): Date => new Date(`${index.service_date}T${hhmm}:00-05:00`);
const query = (p: Pair): string => `?from=${p.origin}&to=${p.dest}`;

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
});

/** The finished card at once: reduced motion draws the end of the race with no clock. */
const finished = (options: PageOptions = {}) => bootPage({ motion: 'reduced', ...options });
const sheet = (): HTMLElement | null => document.querySelector<HTMLElement>('.sheet:not([aria-hidden])');
const click = (selector: string): void => document.querySelector<HTMLElement>(selector)!.click();
const rowFor = (id: string): HTMLElement => sheet()!.querySelector<HTMLElement>(`.source-row[data-source="${id}"]`)!;
const press = (el: Element, key: string, shiftKey = false): void => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
};
const cardIds = (): string[] => [...document.querySelectorAll<HTMLElement>('#card-scroll button.num')].map((b) => b.dataset['source']!);
/** Let the loader's promises settle (a pair's race file arriving). */
const settle = async (): Promise<void> => {
  for (let k = 0; k < 5; k += 1) await new Promise((done) => setTimeout(done, 0));
};

describe('the sheet dialog (13.1)', () => {
  it('opens as a modal dialog with the focus inside, over the scrim', async () => {
    await finished();
    click('[data-action="sources"]');
    const el = sheet()!;
    expect(el.getAttribute('role')).toBe('dialog');
    expect(el.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent).toBe(C.SOURCES_TITLE);
    expect(el.classList.contains('is-open')).toBe(true);
    expect(document.getElementById('scrim')!.classList.contains('is-open')).toBe(true);
    expect(el.contains(document.activeElement)).toBe(true);
  });

  it('keeps Tab and Shift+Tab inside the sheet', async () => {
    await finished();
    click('[data-action="sources"]');
    const el = sheet()!;
    const items = [...el.querySelectorAll<HTMLElement>('a[href], button')];
    const [first, last] = [items[0]!, items.at(-1)!];
    expect(text(last)).toBe(C.CLOSE);
    last.focus();
    press(last, 'Tab');
    expect(document.activeElement).toBe(first);
    press(first, 'Tab', true);
    expect(document.activeElement).toBe(last);
  });

  for (const [how, shut] of [
    ['Escape', () => press(document.activeElement!, 'Escape')],
    ['the scrim', () => document.getElementById('scrim')!.click()],
    ['Close', () => click('.sheet:not([aria-hidden]) [data-action="close-sheet"]')],
  ] as const) {
    it(`closes with ${how} and gives the focus back to the control that opened it`, async () => {
      const app = await finished();
      const opener = document.querySelector<HTMLElement>('[data-action="sources"]')!;
      opener.focus();
      opener.click();
      shut();
      expect(app.store.get().sheet).toBeNull();
      expect(document.querySelector('.sheet.is-open')).toBeNull();
      expect(document.getElementById('scrim')!.classList.contains('is-open')).toBe(false);
      expect(document.activeElement).toBe(opener);
    });
  }

  it('opens the Sources sheet at a tapped number\'s row and returns the focus to that number', async () => {
    await finished();
    const number = document.querySelector<HTMLElement>('#card-scroll button.num[data-source="ride-1938"]')!;
    number.focus();
    number.click();
    expect(sheet()!.dataset['sheet']).toBe('sources');
    expect([...sheet()!.querySelectorAll<HTMLElement>('.is-target')].map((r) => r.dataset['source'])).toEqual(['ride-1938']);
    press(document.activeElement!, 'Escape');
    expect(document.activeElement).toBe(number);
  });
});

describe('every number has its row (P3, 13.5)', () => {
  const fixture = fixtureData();
  const noRide = fixture.index.pairs.find((p) => fixture.races.get(`${p.origin}__${p.dest}`)!.today.trips.length === 0)!;
  const states: [string, PageOptions][] = [
    ['a 1938 win (the lead pair at 10:00)', {}],
    ['a today win (Westwood & Carey to Preston & Caroline at 11:23)', { query: query(westToPreston), now: newYork('11:23') }],
    ['a photo finish (the lead pair at 10:30)', { query: query(lead), now: newYork('10:30') }],
    ['the desktop card, with the board', { layout: 'desktop' }],
    ['no one-seat ride (the fixture)', { folder: FIXTURE_DIR, query: query(noRide), leadPair: noRide }],
  ];
  for (const [name, options] of states) {
    it(name, async () => {
      const app = await finished(options);
      const ids = cardIds();
      expect(ids.length).toBeGreaterThan(5);
      click('[data-action="sources"]');
      for (const id of ids) expect(rowFor(id), id).not.toBeNull();
      // One row per number, and the credits row last.
      const rows = [...sheet()!.querySelectorAll<HTMLElement>('.source-row')];
      expect(rows.slice(0, -1).map((r) => r.dataset['source']).sort()).toEqual([...new Set(ids)].sort());
      expect(text(rows.at(-1))).toBe(C.SOURCES_AND_CREDITS);
      expect(app.registry.list().map((s) => s.id).sort()).toEqual([...new Set(ids)].sort());
    });
  }

  it('during the race, with the status lines and the board', async () => {
    const time = fakeTime();
    const app = await bootPage({ time });
    time.advance(1500);
    expect(app.store.get().race.phase).toBe('running');
    const ids = cardIds();
    expect(ids).toContain('next-1938');
    expect(ids).toContain('board-1938-spacing');
    click('[data-action="sources"]');
    for (const id of ids) expect(rowFor(id), id).not.toBeNull();
  });
});

describe('the Sources rows (13.2): the lead pair at 10:00', () => {
  const race = raceOf(lead);
  const row = rowAt(race, '10:00')!;
  const trip = tripAt(race, row.today!.trip)!;
  const view = buildView(index, summary, race, '10:00');
  const feedLine = C.dateFeed(index.feed_version, weekdayDateLabel(index.service_date));
  const effectiveLine = C.dateEffective(longDateLabel(index.effective));
  const from = (r: HTMLElement): string[] => [...r.querySelectorAll('.source-from')].map(text);
  const label = (id: SourceId): string => index.sources[id].label;
  const linked = (id: SourceId): string => (index.sources[id].url ? `${label(id)} ${C.NEW_TAB}` : label(id));

  it('gives a 1938 number its value, what it is, the race file\'s own page, the method and the effective date', async () => {
    await finished();
    click('#card-scroll button.num[data-source="wait-1938"]');
    const r = rowFor('wait-1938');
    expect(text(r.querySelector('.source-value'))).toBe(text(document.querySelector('#card-scroll [data-source="wait-1938"]')));
    expect(text(r.querySelector('.source-what'))).toBe(C.whatFrom(C.WHAT.wait1938, shortClock(view.start)));
    const link = r.querySelector<HTMLAnchorElement>('.source-from a')!;
    expect(link.href).toBe(race.y1938.sources.passes);
    expect([link.target, link.rel]).toEqual(['_blank', 'noopener']);
    expect(from(r)).toEqual([linked('guide1938_timetable')]);
    expect(text(r.querySelector('.source-method'))).toBe(C.methodNextCar(shortClock(row.y1938.dep)));
    expect([...r.querySelectorAll('.source-date')].map(text)).toEqual([effectiveLine]);
  });

  it('adds the method entry\'s own formula text to walks, which say estimate', async () => {
    await finished();
    click('[data-action="sources"]');
    for (const id of ['walk-to-stop', 'walk-from-stop']) {
      const r = rowFor(id);
      expect(text(r.querySelector('.source-what'))).toContain('estimate');
      expect(text(r.querySelector('[data-part="formula"]'))).toBe(index.sources.method.what);
      expect(from(r)).toEqual([linked('mta_gtfs'), linked('method')]);
      expect([...r.querySelectorAll('.source-date')].map(text)).toEqual([feedLine]);
    }
  });

  it('names the trip, its route and its title-case headsign, on the bus wait, ride and total', async () => {
    await finished();
    click('[data-action="sources"]');
    const line = C.methodBusTrip(trip.route_display, trip.headsign_display, trip.board.stop_id, shortClock(dropSeconds(trip.dep)));
    for (const id of ['wait-today', 'ride-today', 'total-today']) {
      expect(text(rowFor(id).querySelector('.source-trip')), id).toBe(line);
      expect([...rowFor(id).querySelectorAll('.source-date')].map(text), id).toEqual([feedLine]);
    }
    expect(line).toContain(trip.headsign_display);
  });

  it('gives the exact stored value of each part that is not its plain rounding (R7.7)', async () => {
    await finished();
    click('[data-action="sources"]');
    const ids = ['walk-to-stop', 'wait-today', 'ride-today', 'walk-from-stop'];
    let exact = 0;
    view.laneToday!.phases.forEach((phase, k) => {
      const line = rowFor(ids[k]!).querySelector('.source-exact');
      if (phase.shown === Math.floor(phase.stored + 0.5)) expect(line, ids[k]).toBeNull();
      else {
        exact += 1;
        expect(text(line), ids[k]).toBe(C.exactValue(phase.stored.toFixed(3), view.laneToday!.shownTotal));
      }
    });
    expect(exact).toBeGreaterThan(0);
  });

  it('dates the counts with both lines, and ends with "Sources and credits", which opens the credits', async () => {
    const app = await finished();
    click('[data-action="sources"]');
    expect([...rowFor('count-races').querySelectorAll('.source-date')].map(text)).toEqual([effectiveLine, feedLine]);
    click('.sheet:not([aria-hidden]) [data-action="credits"]');
    expect(app.store.get().sheet).toBe('about');
    expect(sheet()!.dataset['sheet']).toBe('about');
  });
});

describe('About and credits (13.3)', () => {
  const CREDITED: SourceId[] = ['guide1938_diagram', 'guide1938_timetable', 'guide1938_route', 'mta_gtfs', 'osm'];
  const lines = (): string[] => [...sheet()!.querySelectorAll('.credit')].map(text);

  it('opens from the info button and from the footer link', async () => {
    await finished();
    const info = document.querySelector<HTMLElement>('#app > button.info')!;
    expect(info.hidden).toBe(false);
    expect(info.getAttribute('aria-label')).toBe(C.ABOUT_AND_CREDITS);
    info.click();
    expect(sheet()!.dataset['sheet']).toBe('about');
    expect(text(sheet()!.querySelector('.sheet-title'))).toBe(C.SOURCES_AND_CREDITS);
    press(document.activeElement!, 'Escape');
    click('#card-footer [data-action="about"]');
    expect(sheet()!.dataset['sheet']).toBe('about');
  });

  it('lists the catalog\'s labels and links, the copy-table credits and the two statements, with no 1933 line', async () => {
    await finished();
    click('#app > button.info');
    const all = lines();
    for (const id of CREDITED) {
      const link = [...sheet()!.querySelectorAll<HTMLAnchorElement>('.credit a')].find((a) => text(a) === index.sources[id].label);
      expect(link?.href, id).toBe(index.sources[id].url);
    }
    expect(all.find((l) => l.startsWith(index.sources.mta_gtfs.label))).toContain(C.NOT_ENDORSED);
    for (const expected of [
      C.BASE_MAP_CREDIT,
      C.FONT_CREDIT,
      C.VEHICLE_CREDIT,
      C.photoFinishMeaning(index.photo_finish_min),
      C.howItWasMade(index.street_order_checked),
      C.INFERRED_CAUTION,
      C.NOT_LIVE,
    ]) {
      expect(all, expected).toContain(expected);
    }
    const href = (name: string): string | undefined =>
      [...sheet()!.querySelectorAll<HTMLAnchorElement>('.credit a')].find((a) => text(a) === name)?.href;
    expect(href(C.MIT_LICENCE)).toBe(`${SOURCE_URLS.repository}${LICENCE_PATH}`);
    expect(href(C.SOURCE_CODE)).toBe(SOURCE_URLS.repository);
    expect(text(sheet())).not.toContain('1933');
  });

  it('adds "checked by hand" only when street_order_checked is true', async () => {
    expect(index.street_order_checked).toBe(false);
    await finished();
    click('#app > button.info');
    expect(text(sheet())).not.toContain(C.CHECKED_BY_HAND.trim());
    const checked = { ...readData<Index>('index.json'), street_order_checked: true };
    await finished({ override: { 'index.json': checked } });
    click('#app > button.info');
    expect(lines()).toContain(C.howItWasMade(true));
  });

  it('is not offered until the data is in', async () => {
    await finished({ fail: new Set(['summary.json']) });
    expect(document.querySelector<HTMLElement>('#app > button.info')!.hidden).toBe(true);
  });
});

describe('When today wins (13.4)', () => {
  const sentenceOf = (s: Summary): string =>
    C.whenTodayWinsSentence(
      formatCount(s.ride_same),
      formatCount(s.pairs.length),
      formatCount(s.ride_faster_today),
      formatCount(s.ride_slower_today),
      s.ride_slower_today > 0,
    );

  it('opens from the honest line with the verdict sentence, its counts as number buttons, then every entry of today_wins', async () => {
    await finished();
    click('#card-scroll [data-action="whentoday"]');
    expect(sheet()!.dataset['sheet']).toBe('whentoday');
    expect(text(sheet()!.querySelector('.whentoday-sentence'))).toBe(sentenceOf(summary));
    expect([...sheet()!.querySelectorAll<HTMLElement>('.whentoday-sentence button.num')].map((b) => b.dataset['source'])).toEqual(
      ['count-ride-same', 'count-pairs', 'count-ride-faster', ...(summary.ride_slower_today > 0 ? ['count-ride-slower'] : [])],
    );
    const entries = [...sheet()!.querySelectorAll('.today-win')].map(text);
    expect(entries).toHaveLength(summary.today_wins.length);
    expect(entries).toEqual(
      summary.today_wins.map((w) => C.todayWinEntry(cornerName(index, w.origin)!, cornerName(index, w.dest)!, shortClock(w.t))),
    );
  });

  it('opens the Sources sheet at a count\'s row', async () => {
    await finished();
    click('#card-scroll [data-action="whentoday"]');
    click('.sheet:not([aria-hidden]) button.num[data-source="count-ride-same"]');
    expect(sheet()!.dataset['sheet']).toBe('sources');
    expect(rowFor('count-ride-same').classList.contains('is-target')).toBe(true);
  });

  it('selects an entry\'s pair and time, and races it', async () => {
    const app = await finished();
    click('#card-scroll [data-action="whentoday"]');
    const k = summary.today_wins.findIndex((w) => w.origin !== lead.origin || w.dest !== lead.dest);
    const win = summary.today_wins[k]!;
    click(`.sheet:not([aria-hidden]) [data-action="today-win"][data-index="${k}"]`);
    expect(app.store.get().sheet).toBeNull();
    expect(app.store.get().pair).toEqual({ origin: win.origin, dest: win.dest });
    expect(app.store.get().minute).toBe(minutesOf(win.t));
    await settle();
    expect(text(document.getElementById('origin-name'))).toBe(cornerName(index, win.origin));
    expect(text(document.querySelector('.slider-time'))).not.toBe('');
    // The race on screen is today's win at that time, from the file.
    expect(document.querySelector('.result')?.getAttribute('data-result')).toBe('today');
  });

  it('shows the counts of whatever summary.json says (P5), with the slower clause only above zero', async () => {
    const real = readData<Summary>('summary.json');
    for (const slower of [0, 2]) {
      const other: Summary = {
        ...real,
        races: 4321,
        wins_1938: 1234,
        ride_same: 7,
        ride_faster_today: 5,
        ride_slower_today: slower,
        today_wins: real.today_wins.slice(0, 3),
      };
      await finished({ override: { 'summary.json': other } });
      expect(text(document.querySelector('.honest'))).toBe(C.honestLine(formatCount(1234), formatCount(4321)));
      click('#card-scroll [data-action="whentoday"]');
      expect(text(sheet()!.querySelector('.whentoday-sentence'))).toBe(sentenceOf(other));
      expect(text(sheet()!.querySelector('.whentoday-sentence')).includes(C.rideSlowerClause(formatCount(2)))).toBe(slower > 0);
      expect(sheet()!.querySelectorAll('.today-win')).toHaveLength(3);
    }
  });
});
