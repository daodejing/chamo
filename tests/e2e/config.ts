/**
 * E2E Test Configuration
 *
 * E2E tests use isolated infrastructure:
 * - Frontend: port 3003 (via Playwright webServer)
 * - Backend: port 4001 (backend-test service)
 * - Database: postgres-test on port 5433
 *
 * Start test backend with: docker-compose --profile test up -d
 */

export const E2E_CONFIG = {
  BASE_URL: 'http://localhost:3003', // Playwright uses port 3003 for E2E tests
  GRAPHQL_URL: 'http://localhost:4001/graphql', // Test backend on port 4001
  TIMEOUT: 30000,
};
