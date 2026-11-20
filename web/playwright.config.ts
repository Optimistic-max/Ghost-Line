import { defineConfig } from '@playwright/test';

const PORT = 5179;
const BASE = `http://127.0.0.1:${PORT}/Ghost-Line/`;

// Playwright runs the browser checks against the Vite dev server. Artifacts go to
// test-results/ (git-ignored).
//   npm run test:e2e   the race on a phone and on a laptop (tests/e2e/race.spec.ts, task 20)
//   npm run screens    one picture per mockup state, each at its own size (tests/e2e/screens.spec.ts)
//   npm run perf       the first race on a throttled phone, timing (tests/e2e/perf.spec.ts, task 22)
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/playwright',
  reporter: 'list',
  fullyParallel: false,
  use: { baseURL: BASE, browserName: 'chromium' },
  projects: [
    // The design sizes of ui.md: a 375 x 667 phone (at 2x, like the phone mockups) and a 1280 x 800 laptop.
    { name: 'phone', testMatch: /race\.spec\.ts$/, use: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 } },
    { name: 'laptop', testMatch: /race\.spec\.ts$/, use: { viewport: { width: 1280, height: 800 } } },
    // Each picture sets its own size.
    { name: 'screens', testMatch: /screens\.spec\.ts$/ },
    // The first-race measurement of the deployed page: tagged timing, run alone, on a quiet machine (npm run perf).
    { name: 'perf', testMatch: /perf\.spec\.ts$/ },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
