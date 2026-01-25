/**
 * Global teardown for Playwright E2E tests
 *
 * Note: Docker services are stopped by scripts/run-e2e.sh via trap on exit.
 * This file is kept for any additional test-specific cleanup if needed.
 */

async function globalTeardown() {
  // Docker cleanup is handled by run-e2e.sh trap
  // Add any test-specific cleanup here if needed
}

export default globalTeardown;
