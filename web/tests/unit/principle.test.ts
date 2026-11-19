// Task 6.4 principle test (P-A, design 1): only the modules allowed to do
// arithmetic contain any. Everything else reads, looks up and formats.
import { describe, expect, it } from 'vitest';
import { arithmeticLines, codeOnly } from '../support/arithmetic';
import { listRepoFiles, readRepoText } from '../support/files';

/**
 * The modules design section 1 allows to do arithmetic, each for one reason:
 * display rounding (rounding, gaps), clock strings (time), playback timing
 * (timeline, clock), layout (layout) and lookups by position (lookup).
 */
const ALLOWED = new Set([
  'web/src/format/rounding.ts',
  'web/src/format/gaps.ts',
  'web/src/format/time.ts',
  'web/src/play/timeline.ts',
  'web/src/play/clock.ts',
  'web/src/view/layout.ts',
  'web/src/data/lookup.ts',
]);

/** Documented exceptions in other modules: file, the exact line, and why it is not arithmetic on stored minutes. */
const EXCEPTIONS: { file: string; line: string; why: string }[] = [];

describe('arithmetic stays in the allowed modules', () => {
  const files = listRepoFiles('web/src').filter((f) => f.endsWith('.ts') && !ALLOWED.has(f));

  it('scans the other modules', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    it(`${file} does no arithmetic`, () => {
      const found = arithmeticLines(readRepoText(file)).filter(
        ({ text }) => !EXCEPTIONS.some((e) => e.file === file && e.line === text),
      );
      expect(found).toEqual([]);
    });
  }
});

describe('the scan itself', () => {
  const flagged = (code: string): boolean => arithmeticLines(code).length > 0;

  it('finds arithmetic in code and in template expressions', () => {
    for (const code of [
      'const x = a - b;',
      'const x = row.today.total + 1;',
      'const x = list.length - 1;',
      'total += part;',
      'i++;',
      'const s = `${a * 2} min`;',
      'const m = Math.floor(x);',
      'const half = x / 2;',
    ]) {
      expect(flagged(code), code).toBe(true);
    }
  });

  it('ignores strings, comments, regex literals, unary minus and types', () => {
    for (const code of [
      "const s = 'no21-1938';",
      'const s = "a + b";',
      '// a - b',
      '/* x * y */',
      'const re = /^\\d{2}:[0-5]\\d$/;',
      'f(/a-b/, x);',
      'return /a-b/.test(s);',
      'list.slice(0, -1);',
      'if (k === -1) return;',
      'type Step = -1 | 1;',
      'const f = (x: number): number => x;',
      'const s = `${at}[${k}]`;',
      'const o = { ...rest };',
    ]) {
      expect(flagged(code), code).toBe(false);
    }
  });

  it('keeps line numbers', () => {
    expect(codeOnly("a\n'b\nc'\nd").split('\n')).toHaveLength(4);
  });

  it('finds an operator whose operands are on different lines, and names its line', () => {
    expect(arithmeticLines('const a =\n  b +\n  c;')).toEqual([{ line: 2, text: 'b +' }]);
    expect(arithmeticLines("const s =\n  'x' +\n  'y';")).toEqual([{ line: 2, text: "'x' +" }]);
  });
});
