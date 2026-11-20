// Task 7.4: WCAG contrast of every text and background pair the screen uses,
// computed from the tokens. Text needs 4.5:1 (ui.md, R12.1).
import { describe, expect, it } from 'vitest';
import { contrast, hexToRgb, over, stylesheets, tokenBlocks } from '../support/css';

const { phone } = tokenBlocks();
const colour = (name: string): [number, number, number] => {
  const value = phone.get(name);
  if (!value) throw new Error(`no token ${name}`);
  return hexToRgb(value);
};

/** Text on background, as token names. The chips and sheet rows follow in TINTED. */
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

/**
 * A tinted background as the stylesheet writes it, `color-mix(in srgb, var(--a) N%, var(--b))`
 * or `... N%, transparent)` over the colour under it, read from the rule for `selector`.
 */
function tint(file: string, selector: string, under: string): [number, number, number] {
  const css = stylesheets().get(file)!;
  const at = css.indexOf(`${selector} {`);
  expect(at, `${file} ${selector}`).toBeGreaterThanOrEqual(0);
  const rule = css.slice(at, css.indexOf('}', at));
  const m = /background:\s*color-mix\(in srgb,\s*var\((--[\w-]+)\)\s*([\d.]+)%,\s*(?:var\((--[\w-]+)\)|transparent)\)/.exec(rule);
  expect(m, `${selector}: a color-mix background`).not.toBeNull();
  return over(colour(m![1]!), Number(m![2]) / 100, colour(m![3] ?? under));
}

/** Chips and sheet rows (task 18.2): text, its background as an opaque colour, and where. */
const TINTED: [text: string, background: () => [number, number, number], where: string][] = [
  ['--ink', () => tint('web/src/styles/card.css', '.notice', '--panel'), 'notices: before the table, the inferred corner'],
  ['--ink', () => tint('web/src/styles/sheets.css', '.source-row.is-target', '--panel'), "the tapped number's Sources row: its value and links"],
  ['--muted', () => tint('web/src/styles/sheets.css', '.source-row.is-target', '--panel'), "the tapped number's Sources row: its other lines"],
  ['--ghost', () => colour('--panel'), 'the "Inferred corner" chip and the picker\'s "inferred" chip and "Start" tag'],
  ['--ink', () => colour('--panel'), 'plain board time chips, corner choices, Sources rows and the today-wins list'],
  ['--muted', () => colour('--panel'), 'Sources row lines, credits, the picker\'s step line and note, the board spacing'],
  ['--night', () => colour('--ink'), 'the banner and the fixture tag'],
];

describe('text contrast', () => {
  for (const [text, background, where] of PAIRS) {
    it(`${text} on ${background} (${where}) is at least ${MIN}:1`, () => {
      expect(contrast(colour(text), colour(background))).toBeGreaterThanOrEqual(MIN);
    });
  }

  for (const [text, background, where] of TINTED) {
    it(`${text} on ${where} is at least ${MIN}:1`, () => {
      expect(contrast(colour(text), background())).toBeGreaterThanOrEqual(MIN);
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
