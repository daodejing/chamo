import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/tests/e2e/**',
      '**/dist/**',
      '**/apps/backend/**', // NestJS backend tests run with Jest
      '**/src/tests/integration/chat/multi-user-messaging*.test.ts', // TODO: rewrite for NestJS GraphQL
    ],
    testTimeout: 10000, // 10 seconds for integration tests
    // Load test environment variables (uses same Supabase instance as dev)
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3002', // Integration tests use dev server port
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.ts',
        '**/*.config.js',
        '**/types/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      qrcode: path.resolve(__dirname, './src/vendor/qrcode'),
    },
  },
});
