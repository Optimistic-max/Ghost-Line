// Read repository files from tests. Paths are relative to the repository root
// (the folder above web/), so a test can read .kiro/, pipeline/ and web/ alike.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// From the path of this file, web/tests/support/files.ts, without the URL class:
// under jsdom the global URL is jsdom's, which Node's fileURLToPath rejects.
const THIS_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = THIS_FILE.replace(/[\\/]web[\\/]tests[\\/]support[\\/]files\.ts$/, '/');
if (REPO_ROOT === THIS_FILE) throw new Error(`cannot find the repository root from ${THIS_FILE}`);

/** Absolute path of a repository-relative path. */
export function repoPath(relative: string): string {
  return REPO_ROOT + relative;
}

export function readRepoText(relative: string): string {
  return readFileSync(repoPath(relative), 'utf8');
}

export function readRepoJson<T = unknown>(relative: string): T {
  return JSON.parse(readRepoText(relative)) as T;
}

export function repoFileExists(relative: string): boolean {
  return existsSync(repoPath(relative));
}

/** Files under a repository-relative folder, recursively, as repository-relative paths with forward slashes. */
export function listRepoFiles(relative: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const name of readdirSync(repoPath(rel))) {
      const child = `${rel}/${name}`;
      if (statSync(repoPath(child)).isDirectory()) walk(child);
      else out.push(child);
    }
  };
  walk(relative.replace(/\/$/, ''));
  return out.sort();
}
