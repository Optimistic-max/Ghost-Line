// The copy table of .kiro/specs/race-screen/requirements.md ("## Copy strings").
import { readRepoText } from './files';

export type CopyTable = {
  /** The section's text, as written. */
  raw: string;
  /** Every "quoted" string of the String column, in order. */
  quoted: string[];
};

export function copyTable(): CopyTable {
  const text = readRepoText('.kiro/specs/race-screen/requirements.md').replace(/\r\n/g, '\n');
  const start = text.indexOf('## Copy strings');
  if (start === -1) throw new Error('requirements.md has no "## Copy strings" section');
  const end = text.indexOf('\n## ', start + 1);
  const raw = text.slice(start, end === -1 ? undefined : end);
  const quoted: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line) || line.startsWith('| Where |')) continue;
    const cell = line.split('|')[2] ?? '';
    for (const m of cell.matchAll(/"([^"]*)"/g)) quoted.push(m[1]!);
  }
  return { raw, quoted };
}

/**
 * The static text of every string literal in TypeScript source: quoted strings
 * and the parts of template literals outside ${...}. Comments and import lines
 * are skipped.
 */
export function stringLiterals(source: string): string[] {
  const out: string[] = [];
  const src = source.replace(/^import .*$/gm, '');
  let i = 0;
  const readTemplate = (): void => {
    // At the opening backtick.
    i += 1;
    let piece = '';
    while (i < src.length) {
      const ch = src[i]!;
      if (ch === '\\') {
        piece += src[i + 1] ?? '';
        i += 2;
      } else if (ch === '`') {
        out.push(piece);
        i += 1;
        return;
      } else if (ch === '$' && src[i + 1] === '{') {
        out.push(piece);
        piece = '';
        i += 2;
        let depth = 1;
        while (i < src.length && depth > 0) {
          const c = src[i]!;
          if (c === '`') {
            readTemplate();
            continue;
          }
          if (c === "'" || c === '"') {
            readQuoted(c);
            continue;
          }
          if (c === '{') depth += 1;
          if (c === '}') depth -= 1;
          i += 1;
        }
      } else {
        piece += ch;
        i += 1;
      }
    }
  };
  const readQuoted = (quote: string): void => {
    i += 1;
    let piece = '';
    while (i < src.length && src[i] !== quote) {
      if (src[i] === '\\') {
        piece += src[i + 1] ?? '';
        i += 2;
      } else {
        piece += src[i];
        i += 1;
      }
    }
    i += 1;
    out.push(piece);
  };
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
    } else if (ch === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      i = close === -1 ? src.length : close + 2;
    } else if (ch === "'" || ch === '"') {
      readQuoted(ch);
    } else if (ch === '`') {
      readTemplate();
    } else {
      i += 1;
    }
  }
  return out;
}
