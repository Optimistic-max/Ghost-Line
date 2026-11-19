// A small source scan for the principle test (task 6.4): find arithmetic in
// TypeScript code once comments, strings, template text and regex literals are
// blanked out. Template ${...} expressions are kept, so arithmetic there counts.

/** The source with comments, string contents, template text and regex literals replaced by spaces. Lines are kept. */
export function codeOnly(source: string): string {
  const out: string[] = [];
  let i = 0;
  const blank = (s: string): string => s.replace(/[^\n]/g, ' ');
  /** The code just before the cursor, trailing blanks removed. */
  const lastSignificant = (): string => out.slice(-80).join('').trimEnd();
  const regexCanStart = (): boolean => {
    const before = lastSignificant();
    if (before === '') return true;
    if (/(^|[^\w$])(return|typeof|case|in|of)$/.test(before)) return true;
    return /[(,=:[!&|?{};+\-*%<>~^]$/.test(before);
  };
  const template = (): void => {
    out.push('`');
    i += 1;
    while (i < source.length) {
      const ch = source[i]!;
      if (ch === '\\') {
        out.push(blank(source.slice(i, i + 2)));
        i += 2;
      } else if (ch === '`') {
        out.push('`');
        i += 1;
        return;
      } else if (ch === '$' && source[i + 1] === '{') {
        out.push('${');
        i += 2;
        code('}');
        out.push('}');
        i += 1;
      } else {
        out.push(blank(ch));
        i += 1;
      }
    }
  };
  const code = (until: string | null): void => {
    let depth = 0;
    while (i < source.length) {
      const ch = source[i]!;
      const next = source[i + 1];
      if (until !== null && ch === until && depth === 0) return;
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      if (ch === '/' && next === '/') {
        const end = source.indexOf('\n', i);
        const stop = end === -1 ? source.length : end;
        out.push(blank(source.slice(i, stop)));
        i = stop;
      } else if (ch === '/' && next === '*') {
        const end = source.indexOf('*/', i + 2);
        const stop = end === -1 ? source.length : end + 2;
        out.push(blank(source.slice(i, stop)));
        i = stop;
      } else if (ch === "'" || ch === '"') {
        let k = i + 1;
        while (k < source.length && source[k] !== ch) k += source[k] === '\\' ? 2 : 1;
        out.push(ch, blank(source.slice(i + 1, k)), ch);
        i = k + 1;
      } else if (ch === '`') {
        template();
      } else if (ch === '/' && regexCanStart()) {
        let k = i + 1;
        let inClass = false;
        while (k < source.length && (inClass || source[k] !== '/')) {
          if (source[k] === '\\') k += 1;
          else if (source[k] === '[') inClass = true;
          else if (source[k] === ']') inClass = false;
          k += 1;
        }
        k += 1;
        while (k < source.length && /[a-z]/.test(source[k]!)) k += 1;
        out.push(blank(source.slice(i, k)));
        i = k;
      } else {
        out.push(ch);
        i += 1;
      }
    }
  };
  code(null);
  return out.join('');
}

const BINARY = /[\w$)\]]\s*[-+*/%](?![=+\-*/])\s*[\w$(\[.]/;
const COMPOUND = /[-+*/%]=/;
const STEP = /\+\+|--/;
const MATH = /\bMath\./;

/** The lines of `source` (1-based) with arithmetic in their code. Import lines are skipped. */
export function arithmeticLines(source: string): { line: number; text: string }[] {
  const code = codeOnly(source).split('\n');
  const lines = source.split('\n');
  const found: { line: number; text: string }[] = [];
  code.forEach((c, k) => {
    if (/^\s*import\b/.test(c)) return;
    if (BINARY.test(c) || COMPOUND.test(c) || STEP.test(c) || MATH.test(c)) found.push({ line: k + 1, text: lines[k]!.trim() });
  });
  return found;
}
