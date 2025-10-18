/**
 * Shared E2E test configuration
 * All E2E tests should use these constants for consistency
 */

export const E2E_CONFIG = {
  // Test server port (must match playwright.config.ts webServer port)
  TEST_PORT: 3003,

  // Base URL for test server
  get BASE_URL() {
    return `http://localhost:${this.TEST_PORT}`;
  },

  // Supabase configuration
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz',
};
