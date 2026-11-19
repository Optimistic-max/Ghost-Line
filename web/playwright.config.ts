import { defineConfig } from '@playwright/test';

const PORT = 5179;
const BASE = `http://127.0.0.1:${PORT}/Ghost-Line/`;

// Playwright runs the browser checks against the Vite dev server. Artifacts go to
// test-results/ (git-ignored).
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/playwright',
  reporter: 'list',
  fullyParallel: false,
  use: { baseURL: BASE, browserName: 'chromium' },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
