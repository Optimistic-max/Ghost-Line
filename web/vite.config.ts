import { configDefaults, defineConfig } from 'vitest/config';

// One config for the site build (Vite) and the tests (vitest).
export default defineConfig({
  // GitHub Pages serves a project site under /<repo-name>/ (tech.md).
  base: '/Ghost-Line/',
  // public/ holds data/, written only by `python -m pipeline build`. The dev
  // server serves it as /Ghost-Line/data/... and the build copies it to dist/.
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          // MapLibre and the map module form their own chunk, loaded by a lazy
          // import after the race card is on screen (tech.md, design 12.2).
          // Only those modules: by default a group also captures what they import,
          // which pulled the layout, vehicle and drawing code the first screen needs
          // into the map chunk, so the page loaded the map before the first race
          // (found by task 21's size check, Nov 20).
          groups: [
            {
              name: 'map',
              test: /node_modules[\\/]maplibre-gl[\\/]|[\\/]src[\\/]map[\\/]map\.ts$/,
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          exclude: [...configDefaults.exclude, 'tests/dom/**', 'tests/e2e/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['tests/dom/**/*.test.ts'],
          // The playback tests step whole races frame by frame on a fake clock; a busy machine needs the room.
          testTimeout: 30000,
        },
      },
    ],
  },
});
