// Banned words in rendered text (product.md rule 1, R15.2, P6). The same rule as
// pipeline/check_sources.py: whole words, any case; the one allowed phrase is
// "Scheduled, not live.", and the HTML attribute name aria-live is not text.
// This helper lives under tests/ because check_sources scans web/src/.

export const BANNED_TERMS = ['live', 'real-time', 'realtime', 'arriving now', 'right now'] as const;
export const ALLOWED_PHRASE = 'Scheduled, not live.';

const BANNED_RE = new RegExp(`\\b(${BANNED_TERMS.map((t) => t.replace('-', '\\-')).join('|')})\\b`, 'gi');
const ARIA_LIVE_RE = /aria-live(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gi;

/** The banned terms found in `text`, as written, in order. */
export function bannedTerms(text: string): string[] {
  const cleaned = text.split(ALLOWED_PHRASE).join(' ').replace(ARIA_LIVE_RE, ' ');
  return [...cleaned.matchAll(BANNED_RE)].map((m) => m[0]);
}
