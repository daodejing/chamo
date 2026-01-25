import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/apps/backend/**', '**/node_modules/**'],
  fullyParallel: false, // Run tests serially to avoid database conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Force single worker to prevent database race conditions
  reporter: 'html',
  timeout: 30000, // 30 seconds per test
  expect: {
    timeout: 5000, // 5 seconds for expect assertions
  },
  globalTeardown: './tests/e2e/global-teardown.ts',
  use: {
    // Test server uses unique port to avoid conflicts
    baseURL: 'http://localhost:3003',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10000, // 10 seconds for actions like click, fill
    navigationTimeout: 10000, // 10 seconds for page.goto
  },

  projects: [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  // Test environment is managed by scripts/run-e2e.sh
  // which starts docker-compose --profile test before running tests
  // and stops it on exit (success or failure)
});
