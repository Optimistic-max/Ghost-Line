// Read repository files from tests. Paths are relative to the repository root
// (the folder above web/), so a test can read .kiro/, pipeline/ and web/ alike.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// This file is web/tests/support/files.ts.
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');

/** Absolute path of a repository-relative path. */
export function repoPath(relative: string): string {
  return resolve(REPO_ROOT, relative);
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
export function listRepoFiles(relative: string, options: { skipFolders?: readonly string[] } = {}): string[] {
  const out: string[] = [];
  const skip = new Set(options.skipFolders ?? []);
  const walk = (rel: string): void => {
    for (const name of readdirSync(repoPath(rel))) {
      const child = `${rel}/${name}`;
      if (skip.has(name)) continue;
      if (statSync(repoPath(child)).isDirectory()) walk(child);
      else out.push(child);
    }
  };
  walk(relative.replace(/\/$/, ''));
  return out.sort();
}
