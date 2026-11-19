// Task 7.4: WCAG contrast of every text and background pair the screen uses,
// computed from the tokens. Text needs 4.5:1 (ui.md, R12.1).
import { describe, expect, it } from 'vitest';
import { contrast, hexToRgb, over, tokenBlocks } from '../support/css';

const { phone } = tokenBlocks();
const colour = (name: string): [number, number, number] => {
  const value = phone.get(name);
  if (!value) throw new Error(`no token ${name}`);
  return hexToRgb(value);
};

/** Text on background, as token names. Tasks 13 and 18 add sheet rows and chips as they are built. */
const PAIRS: [text: string, background: string, where: string][] = [
  ['--ink', '--panel', 'main text on the card and sheets'],
  ['--ink', '--night', 'top bar and map text'],
  ['--ink', '--sign', 'photo-finish result line'],
  ['--muted', '--panel', 'labels and secondary text on the card'],
  ['--muted', '--night', 'secondary text on the page'],
  ['--muted', '--sign', 'secondary text in the result box'],
  ['--ghost', '--panel', '1938 lane title and totals'],
  ['--ghost', '--night', '1938 route names on the map'],
  ['--ghost', '--sign', '1938 result line'],
  ['--today', '--panel', "today's lane title and totals"],
  ['--today', '--night', "today's text on the page"],
  ['--today', '--sign', 'today result line'],
  ['--night', '--ghost', 'next 1938 car chip'],
  ['--night', '--today', 'next bus chip'],
  ['--night', '--ink', 'the filled Share this race button'],
  ['--alert', '--panel', 'data-error text on the card'],
  ['--alert', '--night', 'data-error text on the page'],
];

const MIN = 4.5;

describe('text contrast', () => {
  for (const [text, background, where] of PAIRS) {
    it(`${text} on ${background} (${where}) is at least ${MIN}:1`, () => {
      expect(contrast(colour(text), colour(background))).toBeGreaterThanOrEqual(MIN);
    });
  }

  it('faint map text, --muted at 80% opacity on --night, is at least 4.5:1', () => {
    const faint = over(colour('--muted'), 0.8, colour('--night'));
    expect(contrast(faint, colour('--night'))).toBeGreaterThanOrEqual(MIN);
  });

  it('computes the WCAG ratio correctly', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.48, 2);
  });
});
