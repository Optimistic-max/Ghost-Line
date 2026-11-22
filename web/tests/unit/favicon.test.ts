// Task 25.13: the favicon is the trolley marker drawing, inline in index.html (no file request), in palette B.
import { describe, expect, it } from 'vitest';
import { MARKER_VIEWBOX, markerSvg } from '../../src/view/vehicles';
import { tokenBlocks } from '../support/css';
import { readRepoText } from '../support/files';

const html = readRepoText('web/index.html');
const links = [...html.matchAll(/<link\b[^>]*\brel="icon"[^>]*>/g)].map((m) => m[0]);
const href = /href="([^"]*)"/.exec(links[0] ?? '')?.[1] ?? '';
const svg = decodeURIComponent(href.replace(/^data:image\/svg\+xml,/, ''));

/** The geometry attributes of each shape, as "tag attr=value ...", without classes or colours. */
function shapes(markup: string): string[] {
  const keep = ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'width', 'height', 'd'];
  return [...markup.matchAll(/<(line|path|rect|circle)\b([^>]*)>/g)].map(([, tag, attrs]) => {
    const pairs = [...attrs!.matchAll(/([\w-]+)=["']([^"']*)["']/g)].filter(([, k]) => keep.includes(k!)).map(([, k, v]) => `${k}=${v}`);
    return `${tag} ${pairs.sort().join(' ')}`;
  });
}

describe('the favicon (task 25.13)', () => {
  it('is one inline SVG icon: a data: address, so the browser requests no file', () => {
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('type="image/svg+xml"');
    expect(href.startsWith('data:image/svg+xml,')).toBe(true);
    // Percent-encoded tags, so nothing in the attribute reads as markup to a simple tag scan.
    expect(href).not.toMatch(/[<>"]/);
    expect(svg.startsWith("<svg xmlns='http://www.w3.org/2000/svg'")).toBe(true);
  });

  it('draws the map marker: the same poles, body, window strip and wheels, in its own view box', () => {
    const marker = markerSvg({ width: 28 });
    // Every shape of the marker, in order, after the icon's one background square.
    expect(shapes(svg).slice(1)).toEqual(shapes(marker));
    const box = /viewBox='([^']*)'/.exec(svg)![1]!.split(' ').map(Number);
    // Square, as wide as the marker, with the marker centred top to bottom.
    expect(box[2]).toBe(MARKER_VIEWBOX.width);
    expect(box[3]).toBe(MARKER_VIEWBOX.width);
    expect(-box[1]! * 2 + MARKER_VIEWBOX.height).toBe(box[3]);
  });

  it('uses only palette B colours: --ghost for the trolley, --night for the ground, windows and wheels', () => {
    const { phone } = tokenBlocks();
    const colours = new Set([...svg.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0].toLowerCase()));
    expect(colours).toEqual(new Set([phone.get('--ghost')!.toLowerCase(), phone.get('--night')!.toLowerCase()]));
  });
});
