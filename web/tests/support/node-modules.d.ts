// Types for the few Node built-ins the tests use. @types/node is not a project
// dependency (only the packages named in the race-screen spec are installed),
// so the signatures the tests rely on are declared here.

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
  export function existsSync(path: string): boolean;
  export function statSync(path: string): { isDirectory(): boolean; size: number };
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
