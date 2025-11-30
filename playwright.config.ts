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

  // Start dev server on unique port 3003 for E2E tests
  // Uses E2E_TEST env variable to trigger custom distDir in next.config.js
  // Points to test backend on port 4001 (start with: docker-compose --profile test up -d)
  webServer: {
    command: 'E2E_TEST=true NEXT_PUBLIC_GRAPHQL_HTTP_URL=http://localhost:4001/graphql NEXT_PUBLIC_GRAPHQL_WS_URL=ws://localhost:4001/graphql pnpm next dev --port 3003',
    url: 'http://localhost:3003',
    reuseExistingServer: !process.env.CI, // Reuse if already running (local dev only)
    timeout: 120000, // 2 minutes for first-time compilation
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
