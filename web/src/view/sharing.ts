// "Share this race" (R4.8, design 11): the system share sheet with the link
// only; if the visitor cancels, nothing else happens; if it is missing or fails
// otherwise, the link is copied (the clipboard, then a hidden text area).

export type ShareDeps = {
  /** navigator.share, when the browser has it. */
  share?: (data: { url: string }) => Promise<void>;
  /** navigator.clipboard.writeText, when the browser has it. */
  writeText?: (text: string) => Promise<void>;
  /** The old way: a hidden text area and the copy command. True when it worked. */
  copyByCommand?: (text: string) => boolean;
};

export type ShareOutcome = 'shared' | 'cancelled' | 'copied' | 'failed';

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && (error as { name: unknown }).name === 'AbortError';
}

export async function shareLink(url: string, deps: ShareDeps): Promise<ShareOutcome> {
  if (deps.share) {
    try {
      await deps.share({ url });
      return 'shared';
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
    }
  }
  if (deps.writeText) {
    try {
      await deps.writeText(url);
      return 'copied';
    } catch {
      // On to the text area.
    }
  }
  try {
    if (deps.copyByCommand?.(url)) return 'copied';
  } catch {
    // Nothing else to try; the address bar already holds the link (R4.7).
  }
  return 'failed';
}

/** The browser's share sheet and clipboard, as far as it has them. */
export function browserShareDeps(win: Window): ShareDeps {
  const nav = win.navigator;
  return {
    share: typeof nav.share === 'function' ? (data) => nav.share(data) : undefined,
    writeText: nav.clipboard ? (text) => nav.clipboard.writeText(text) : undefined,
    copyByCommand: (text) => {
      const doc = win.document;
      const area = doc.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.className = 'visually-hidden';
      doc.body.append(area);
      area.select();
      const done = doc.execCommand('copy');
      area.remove();
      return done;
    },
  };
}
