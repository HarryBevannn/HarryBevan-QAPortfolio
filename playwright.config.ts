import { defineConfig, devices } from '@playwright/test';
import { PORT } from './tests/support/port';

const isCI = !!process.env.CI;

/**
 * E2E tests run against the production build in dist/, served the way GitHub
 * Pages serves it (tests/support/static-server.ts), so the CSP meta tag and
 * bundling match production. Locally the global setup builds first; in CI the
 * build is its own step. Set SKIP_BUILD=1 to reuse an existing dist/.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 45_000,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    // dist/test-results.json: shown on the site's Telemetry section.
    ['./tests/support/results-reporter.ts'],
  ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
