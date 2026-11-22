// Task 25.6: plain words. The intro line explains the trolley once, the honest line and its number rows say
// what a race is with the number of corner pairs read from summary.json, and a photo finish shows what it means.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEAD_PAIR } from '../../src/config';
import * as C from '../../src/copy/copy';
import { formatCount } from '../../src/format/count';
import { fixtureData } from '../support/fixture';
import { realData } from '../support/realdata';
import { num, renderAt, text } from '../support/render';

const real = realData();
const fake = fixtureData();
const lead = { origin: LEAD_PAIR.origin, dest: LEAD_PAIR.dest };

describe('the intro line', () => {
  it('explains "trackless trolley" as an electric bus that ran on overhead wires, once, and the page shows the same text', () => {
    expect(C.PHONE_INTRO).toContain('trackless trolley, an electric bus that ran on overhead wires,');
    expect(C.PHONE_INTRO.split('electric bus').length - 1).toBe(1);
    const html = readFileSync(resolve(import.meta.dirname, '..', '..', 'index.html'), 'utf8');
    expect(html).toContain(C.PHONE_INTRO);
    expect(html).toContain(C.HEADLINE_LINE);
  });
});

describe('races, in plain words', () => {
  it('the honest line says races, with every start time the timetable covers and the pair count from summary.json', () => {
    for (const data of [real, fake]) {
      const pair = data === real ? lead : { origin: data.index.pairs[0]!.origin, dest: data.index.pairs[0]!.dest };
      const r = renderAt(data, pair, [...data.races.values()][0]!.races[0]!.t);
      const pairs = formatCount(data.summary.pairs.length);
      const honest = text(r.root.querySelector('.honest'));
      expect(honest).toContain(`races (every start time the 1938 timetable covers, at all ${pairs} pairs of corners)`);
      expect(honest).not.toContain('covered starts');
      expect(text(num(r.root, 'count-pairs'))).toBe(pairs);
    }
  });

  it('the "what a number is" rows for the three counts carry the same words', () => {
    const pairs = formatCount(real.summary.pairs.length);
    const r = renderAt(real, lead, '10:00');
    for (const [id, what] of [
      ['count-wins-1938', C.whatWins1938(pairs)],
      ['count-races', C.whatRaces(pairs)],
    ] as const) {
      expect(r.registry.get(id)!.what, id).toBe(what);
      expect(what).not.toContain('covered starts');
    }
    expect(C.whatWinsToday(pairs)).toBe(`races (every start time the 1938 timetable covers, at all ${pairs} pairs of corners) where today's bus arrives first`);
  });
});

describe('the photo-finish meaning', () => {
  const photo = [...real.races.values()].flatMap((race) => race.races.filter((row) => row.result === 'photo_finish').map((row) => ({ race, row })))[0]!;
  const win = lead;

  it('shows next to a photo-finish result, with the limit as a number with its source', () => {
    expect(photo).toBeDefined();
    const r = renderAt(real, { origin: photo.race.origin, dest: photo.race.dest }, photo.row.t);
    const note = r.root.querySelector('.result-note')!;
    expect(note).not.toBeNull();
    expect(text(note)).toBe(C.photoFinishMeaning(real.index.photo_finish_min));
    expect(r.root.querySelector('.result')!.nextElementSibling).toBe(note);
    expect(note.querySelectorAll('button.num')).toHaveLength(1);
    expect(r.registry.get('photo-band')!.method).toBe(C.METHOD_PHOTO_BAND);
  });

  it('is absent from a race that has a winner', () => {
    const r = renderAt(real, win, '10:00');
    expect(r.root.querySelector('.result-note')).toBeNull();
  });
});

describe('the chart reading line (task 25.7)', () => {
  it('sits directly under the chart heading, before the subheading', () => {
    const r = renderAt(real, lead, '10:00');
    const heading = r.root.querySelector('.chart-heading')!;
    const line = heading.nextElementSibling!;
    expect(line.className).toBe('chart-reading');
    expect(text(line)).toBe('Each point is a different start time. Lower is faster.');
    expect(line.nextElementSibling!.className).toBe('chart-sub');
  });
});
