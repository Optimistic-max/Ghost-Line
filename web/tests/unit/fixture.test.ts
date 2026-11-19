// Task 6.3: the made-up fixture line is shaped like the generated files, holds
// the cases the real data lacks, carries the fixture tag and is never shipped.
import { describe, expect, it } from 'vitest';
import { FIXTURE_TAG } from '../../src/copy/copy';
import { INDEX_FILE } from '../../src/data/files';
import { buildView } from '../../src/state/derive';
import { listRepoFiles, readRepoText } from '../support/files';
import { FIXTURE_DIR, fixtureData, fixtureFileNames, readFixture } from '../support/fixture';

const data = fixtureData();
const races = [...data.races.values()];
const rows = races.flatMap((race) => race.races.map((row) => ({ race, row })));

describe('the fake fixture line', () => {
  it('passes the site shape checks, one race file per listed pair', () => {
    expect(fixtureFileNames().filter((n) => n.startsWith('race/'))).toHaveLength(data.index.pairs.length);
  });

  it('is named fake, with made-up corners', () => {
    expect(data.index.line).toBe('fake');
    for (const corner of data.index.corners) {
      expect(corner.slug.startsWith('fake-')).toBe(true);
      expect(corner.name).toMatch(/^Fake & /);
    }
  });

  it('carries the fixture tag of the copy table', () => {
    expect(readFixture<{ fixture_tag: string }>(INDEX_FILE).fixture_tag).toBe(FIXTURE_TAG);
  });

  it('lives outside public/, and nothing under public/ refers to it', () => {
    expect(FIXTURE_DIR.startsWith('web/public')).toBe(false);
    for (const file of listRepoFiles('web/public')) {
      expect(file).not.toMatch(/fake/);
      expect(readRepoText(file)).not.toMatch(/fake-first|Test fixture/);
    }
  });

  it('holds the cases the real files lack', () => {
    expect(rows.some(({ row }) => row.today === null)).toBe(true);
    expect(races.some((r) => r.today.trips.length === 0)).toBe(true);
    expect(races.some((r) => r.today.gap_min === null && r.today.gap_max === null)).toBe(true);
    expect(races.some((r) => r.races.every((row) => row.result === 'no_one_seat_ride'))).toBe(true);
    expect(rows.some(({ row }) => row.result === 'today')).toBe(true);
    expect(rows.some(({ row }) => row.result === 'photo_finish')).toBe(true);
    expect(rows.some(({ row }) => row.result === '1938')).toBe(true);
    expect(rows.some(({ row }) => row.before_table)).toBe(true);
    expect(races.some((r) => r.inferred)).toBe(true);
    expect(races.some((r) => r.today.route_names.length > 1)).toBe(true);
    expect(races.some((r) => r.today.gap_min !== null && r.today.gap_min < 0.5)).toBe(true);
    expect(data.summary.ride_slower_today).toBeGreaterThan(0);
    expect(data.index.street_order_checked).toBe(true);
  });

  it('gives a view for every row, with no bus lane, margin or board buses for no one-seat ride', () => {
    for (const { race, row } of rows) {
      const view = buildView(data.index, data.summary, race, row.t);
      if (row.result === 'no_one_seat_ride') {
        expect(view.laneToday).toBeNull();
        expect(view.resultView).toEqual({ kind: 'no_one_seat_ride' });
        expect(view.colour).toBe('ink');
        expect(view.walkShown).toBeNull();
        expect(view.board.buses).toEqual([]);
      } else {
        expect(view.laneToday).not.toBeNull();
      }
      if (race.today.gap_min === null) expect(view.frequency).toBeNull();
    }
  });
});
