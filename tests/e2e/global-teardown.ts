/**
 * Global teardown for Playwright E2E tests
 * Ensures the test server is properly stopped after all tests complete
 */

async function globalTeardown() {
  console.log('Global teardown: Cleaning up test server...');

  // The webServer in playwright.config.ts will automatically be stopped
  // when Playwright exits, but we can add additional cleanup here if needed

  // Wait a moment to ensure all processes are cleaned up
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('Global teardown: Complete');
}

export default globalTeardown;
