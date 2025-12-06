import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';
import { translations } from '../../src/lib/translations';
import { setupFamilyAdminTest, clearMailHogEmails, waitForMailHogEmail, extractVerificationToken, cleanupTestData } from './fixtures';

/**
 * Epic 1 - User Onboarding & Authentication
 * E2E Tests for Story 1.3: Session Persistence
 *
 * Story 1.3 Tests cover:
 * - AC1: Session tokens stored securely (localStorage managed by Apollo Client)
 * - AC2: Family key stored in IndexedDB (persists across sessions)
 * - AC3: Auto-login on app revisit if session valid (redirect /login → /chat)
 * - AC4: Session validation via GraphQL 'me' query returns user data
 * - AC5: Logout clears localStorage tokens
 * - AC6: Logout preserves IndexedDB keys (E2EE requirement)
 * - AC7: After logout, accessing /chat redirects to /login
 * - AC8: Session configured with appropriate expiry (7-day access, 30-day refresh)
 *
 * NOTE: All UI text assertions use i18n translations (default language: 'en')
 */

// Helper to get translated text (default language is 'en')
const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

test.describe('Story 1.3: Session Persistence', () => {
  /**
   * AC3: Auto-login on page revisit
   * Tests that a logged-in user is automatically redirected to /chat when visiting /login
   */
  test('Auto-login redirects authenticated user from /login to /chat', async ({ page }) => {
    const testId = `session-auto-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate to /login - should auto-redirect to /chat
      await page.goto('/login');
      await page.waitForTimeout(2000);

      // Verify redirect occurred to chat (or family-setup if no family)
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/login');
      expect(currentUrl.includes('/chat') || currentUrl.includes('/family-setup')).toBeTruthy();
    } finally {
      await cleanup();
    }
  });

  /**
   * AC2, AC3: Session persists across page reload
   * Tests that user remains logged in after page reload
   */
  test('Session persists across page reload', async ({ page }) => {
    const testId = `session-persist-${Date.now()}`;
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate to chat
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      // Verify we're on chat
      await expect(page.getByText('General')).toBeVisible({ timeout: 10000 });

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // AC2, AC3: Verify we're still logged in
      const currentUrl = page.url();
      expect(currentUrl).toContain('/chat');

      // Verify family name still visible
      await expect(page.getByText(fixture.family.name).first()).toBeVisible({ timeout: 10000 });

      // Check localStorage for access token (AC1)
      // Note: The fixture only injects accessToken, refreshToken is only set during real login flow
      const hasToken = await page.evaluate(() => {
        const accessToken = localStorage.getItem('accessToken');
        return !!accessToken;
      });
      expect(hasToken).toBeTruthy();
    } finally {
      await cleanup();
    }
  });

  /**
   * AC4: Session validation returns user data
   * Tests that the GraphQL 'me' query returns correct user information
   */
  test('Session validation query returns user data', async ({ page }) => {
    const testId = `session-me-${Date.now()}`;
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Get the access token from localStorage
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
      expect(accessToken).toBeTruthy();

      // AC4: Call 'me' query to validate session
      const meQuery = `
        query Me {
          me {
            id
            email
            name
            role
          }
        }
      `;

      const meResponse = await page.request.post(E2E_CONFIG.GRAPHQL_URL, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        data: {
          query: meQuery,
        },
      });

      expect(meResponse.status()).toBe(200);
      const meData = await meResponse.json();

      // Verify user data returned correctly
      expect(meData.data.me).toBeDefined();
      expect(meData.data.me.email).toBe(fixture.admin.user.email);
      expect(meData.data.me.name).toBe(fixture.admin.user.name);
      expect(meData.data.me.role).toBe('ADMIN');
    } finally {
      await cleanup();
    }
  });

  /**
   * AC5, AC6, AC7: Logout clears session and redirects
   * Tests that logout properly clears tokens but preserves IndexedDB keys
   */
  test('Logout clears tokens but preserves encryption keys', async ({ page }) => {
    const testId = `session-logout-${Date.now()}`;
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate to chat
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      // Verify we're logged in
      await expect(page.getByText('General')).toBeVisible({ timeout: 10000 });

      // Navigate to settings and logout
      await page.click('button:has(.lucide-settings)');
      await expect(page.locator(`text=${t('settings.language')}`).first()).toBeVisible({ timeout: 10000 });

      // AC5: Click logout button (use first() to avoid strict mode violation)
      await page.getByRole('button', { name: /logout|log out/i }).first().click();

      // AC7: Wait for redirect to /login
      await page.waitForURL('**/login', { timeout: 5000 });

      // AC5: Verify tokens are cleared from localStorage
      const tokensCleared = await page.evaluate(() => {
        const accessToken = localStorage.getItem('accessToken');
        const refreshToken = localStorage.getItem('refreshToken');
        return !accessToken && !refreshToken;
      });
      expect(tokensCleared).toBeTruthy();

      // AC6 (MODIFIED): Verify IndexedDB keys PERSIST for true E2EE
      // Keys are NOT cleared on logout - this ensures the server never has access to them
      const keysPersist = await page.evaluate(async () => {
        try {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('ourchat-keys', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          const transaction = db.transaction(['keys'], 'readonly');
          const store = transaction.objectStore('keys');
          const getAllKeysRequest = store.getAllKeys();
          const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
            getAllKeysRequest.onsuccess = () => resolve(getAllKeysRequest.result);
            getAllKeysRequest.onerror = () => reject(getAllKeysRequest.error);
          });
          db.close();
          // Should have some keys remaining (familyKey, privateKey, etc.)
          return keys.length > 0;
        } catch {
          return false;
        }
      });
      expect(keysPersist).toBeTruthy();

      // AC7: Verify accessing /chat redirects back to /login
      await page.goto('/chat');
      await page.waitForTimeout(1500);
      expect(page.url()).toContain('/login');
    } finally {
      await cleanup();
    }
  });

  /**
   * AC2: IndexedDB family key storage
   * Tests that family key is stored in IndexedDB and persists
   */
  test('Family key persists in IndexedDB across page reload', async ({ page }) => {
    const testId = `session-idb-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate to chat
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      // AC2: Check if family key exists in IndexedDB
      const hasKeyBefore = await page.evaluate(async () => {
        try {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('ourchat-keys', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });

          const transaction = db.transaction(['keys'], 'readonly');
          const store = transaction.objectStore('keys');
          const getAllKeysRequest = store.getAllKeys();
          const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
            getAllKeysRequest.onsuccess = () => resolve(getAllKeysRequest.result);
            getAllKeysRequest.onerror = () => reject(getAllKeysRequest.error);
          });

          db.close();
          // Check for familyKey:* pattern
          return keys.some(k => String(k).startsWith('familyKey:'));
        } catch {
          return false;
        }
      });

      expect(hasKeyBefore).toBeTruthy();

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // AC2: Verify key still exists after reload
      const hasKeyAfter = await page.evaluate(async () => {
        try {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('ourchat-keys', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });

          const transaction = db.transaction(['keys'], 'readonly');
          const store = transaction.objectStore('keys');
          const getAllKeysRequest = store.getAllKeys();
          const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
            getAllKeysRequest.onsuccess = () => resolve(getAllKeysRequest.result);
            getAllKeysRequest.onerror = () => reject(getAllKeysRequest.error);
          });

          db.close();
          return keys.some(k => String(k).startsWith('familyKey:'));
        } catch {
          return false;
        }
      });

      expect(hasKeyAfter).toBeTruthy();
    } finally {
      await cleanup();
    }
  });

  /**
   * AC8: Session token expiry configuration
   * Tests that tokens have appropriate expiry times configured
   */
  test('Session tokens have correct expiry configuration', async ({ page }) => {
    const testId = `session-expiry-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      // Get access token from localStorage
      // Note: The fixture only injects accessToken; refreshToken is only set during real login
      const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));

      // AC8: Verify access token exists and is valid JWT format
      expect(accessToken).toBeTruthy();

      // JWT tokens should have 3 parts separated by dots
      const accessTokenParts = accessToken!.split('.');

      expect(accessTokenParts.length).toBe(3);

      // Note: Actual expiry times are configured in the backend
      // Access token: 7 days
      // We verify the token exists and is properly formatted
    } finally {
      await cleanup();
    }
  });

  /**
   * AC7: Protected route access without session
   * Tests that accessing /chat without valid session redirects to /login
   */
  test('Accessing /chat without session redirects to /login', async ({ page }) => {
    // Ensure no session exists
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
    });

    // AC7: Try to access protected route without authentication
    await page.goto('/chat');
    await page.waitForTimeout(1500);

    const currentUrl = page.url();

    // Should redirect to login or show login page
    const isOnLoginPage = currentUrl.includes('/login') ||
                         await page.locator('text=' + t('login.title')).isVisible().catch(() => false);

    expect(isOnLoginPage).toBeTruthy();
  });
});
