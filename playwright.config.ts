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

  // Web servers for E2E tests - both backend and frontend
  // Backend starts docker-compose with test profile (port 4001 + MailHog)
  // Frontend starts Next.js dev server on port 3003
  webServer: [
    {
      // Backend services (docker-compose with test profile)
      // Includes: backend (4001), postgres (5433), MailHog (8025/1025)
      command: 'docker-compose --profile test up',
      url: 'http://localhost:4001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000, // 2 min for docker startup
      cwd: './apps/backend',
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      // Frontend dev server on port 3003
      command: 'E2E_TEST=true NEXT_PUBLIC_GRAPHQL_HTTP_URL=http://localhost:4001/graphql NEXT_PUBLIC_GRAPHQL_WS_URL=ws://localhost:4001/graphql pnpm next dev --port 3003',
      url: 'http://localhost:3003',
      reuseExistingServer: !process.env.CI,
      timeout: 120000, // 2 min for first-time compilation
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
