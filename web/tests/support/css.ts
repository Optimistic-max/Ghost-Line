// Small readers for the site's CSS in tests.
import { listRepoFiles, readRepoText } from './files';

/** CSS without comments. */
export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The custom properties declared in a block of CSS, by name. */
export function customProperties(css: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of stripComments(css).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) found.set(m[1]!, m[2]!.trim());
  return found;
}

/** tokens.css split into the phone block (before the media query) and the desktop block (inside it). */
export function tokenBlocks(): { phone: Map<string, string>; desktop: Map<string, string>; desktopQuery: string } {
  const css = stripComments(readRepoText('web/src/styles/tokens.css'));
  const at = css.indexOf('@media');
  if (at === -1) throw new Error('tokens.css has no desktop media query');
  const query = /@media\s*([^{]+)\{/.exec(css.slice(at));
  return {
    phone: customProperties(css.slice(0, at)),
    desktop: customProperties(css.slice(at)),
    desktopQuery: query?.[1]?.trim() ?? '',
  };
}

/** Every stylesheet under web/src, without comments, by path. */
export function stylesheets(): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of listRepoFiles('web/src').filter((f) => f.endsWith('.css'))) {
    out.set(file, stripComments(readRepoText(file)));
  }
  return out;
}

/** "#rrggbb" to [r, g, b] in 0..255. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
}

/** WCAG 2 relative luminance. */
export function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2 contrast ratio of two opaque colours. */
export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `fg` at `alpha` over `bg`, as an opaque colour. */
export function over(fg: [number, number, number], alpha: number, bg: [number, number, number]): [number, number, number] {
  return [0, 1, 2].map((i) => fg[i]! * alpha + bg[i]! * (1 - alpha)) as [number, number, number];
}
