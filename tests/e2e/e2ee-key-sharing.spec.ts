import { test, expect } from '@playwright/test';
import { translations } from '../../src/lib/translations';
import { clearMailHogEmails, waitForMailHogEmail, extractVerificationToken, cleanupTestData } from './fixtures';

/**
 * E2EE KEY SHARING TEST
 *
 * Tests the end-to-end encryption key sharing mechanism via invite codes.
 * Verifies that:
 * 1. Admin creates family and encryption key is stored in their IndexedDB
 * 2. Invite code displays in correct format: FAMILY-XXXXXXXX:BASE64KEY
 * 3. Member joins using the invite code
 * 4. Encryption key is automatically stored in member's IndexedDB
 * 5. Both admin and member have the same encryption key (critical for E2EE)
 *
 * This ensures the key sharing is completely transparent to users while
 * maintaining end-to-end encryption security.
 *
 * Flow: register → verify email → login → create family → get invite code → member joins
 */

const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

test.describe('E2EE Key Sharing via Invite Codes', () => {
  test('Admin and member both receive encryption key transparently', async ({ page }) => {
    const testId = `e2ee-key-${Date.now()}`;

    // Clear MailHog before test
    await clearMailHogEmails();

    // STEP 1: Register admin account
    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();

    await page.getByText(t('login.switchToCreate')).click();
    await page.waitForTimeout(300);

    const adminEmail = `${testId}-admin@example.com`;
    const adminPassword = 'TestPassword123!';
    const adminName = `${testId} Admin`;
    const familyName = `${testId} Test Family`;

    await page.locator('#userName').fill(adminName);
    await page.locator('#email').fill(adminEmail);
    await page.locator('#password').fill(adminPassword);
    // Note: familyName field no longer exists on registration - family created separately

    await page.locator('button[type="submit"]').click();

    // Wait for redirect to verification-pending page (may include query params)
    await page.waitForURL('**/verification-pending**', { timeout: 10000 });

    // STEP 2: Get verification email and verify
    const adminVerificationEmail = await waitForMailHogEmail('to', adminEmail, 15000);
    expect(adminVerificationEmail).toBeTruthy();
    const adminToken = extractVerificationToken(adminVerificationEmail);
    expect(adminToken, 'Admin verification token should be in email').toBeTruthy();

    await page.goto(`/verify-email?token=${adminToken}`);

    // Wait for verification success message
    await expect(page.getByText(/verified|success/i)).toBeVisible({ timeout: 15000 });

    // Wait for auto-redirect to login OR navigate manually
    await page.waitForURL('**/login**', { timeout: 10000 }).catch(async () => {
      await page.goto('/login');
    });

    // STEP 3: Login with verified admin credentials
    const loginLink = page.getByText(t('login.switchToLogin'));
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await page.waitForTimeout(300);
    }

    await page.locator('input[name="email"]').fill(adminEmail);
    await page.locator('input[name="password"]').fill(adminPassword);
    await page.locator('button[type="submit"]').click();

    // Should be redirected to family-setup (no family yet)
    await page.waitForURL('**/family-setup', { timeout: 10000 });

    // STEP 4: Create family
    await page.locator('#familyName').fill(familyName);
    await page.getByRole('button', { name: /create.*family/i }).click();

    // Wait for toast with invite code (filter for FAMILY- pattern to avoid "Logged in!" toast)
    const toastLocator = page.locator('[data-sonner-toast]');
    await expect(toastLocator.filter({ hasText: /FAMILY-/ })).toBeVisible({ timeout: 15000 });

    const allToastText = await toastLocator.filter({ hasText: /FAMILY-/ }).textContent();
    console.log('All toast text (what user would copy):', allToastText);

    const displayedInviteCode = allToastText!.trim();
    console.log('Displayed invite code:', displayedInviteCode);

    // ASSERTION 1: The toast should display the FULL invite code (code + key)
    expect(displayedInviteCode, 'Toast should display full invite code with encryption key').toMatch(/^FAMILY-[A-Z0-9]{16}:[A-Za-z0-9+/=]+$/);

    // ASSERTION 2: Verify the ADMIN's encryption key was stored in IndexedDB
    const [_, adminKeyFromInviteCode] = displayedInviteCode.split(':');
    const adminStoredKey = await page.evaluate(async () => {
      const dbName = 'ourchat-keys';
      const storeName = 'keys';

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          // Get all keys and find the one starting with 'familyKey:'
          const getAllKeysRequest = store.getAllKeys();

          getAllKeysRequest.onsuccess = async () => {
            const keys = getAllKeysRequest.result as string[];
            const familyKeyName = keys.find(k => k.startsWith('familyKey:'));
            if (!familyKeyName) {
              resolve(null);
              return;
            }
            const getRequest = store.get(familyKeyName);
            getRequest.onsuccess = async () => {
              const cryptoKey = getRequest.result;
              if (cryptoKey) {
                const rawKey = await crypto.subtle.exportKey('raw', cryptoKey);
                const base64Key = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
                resolve(base64Key);
              } else {
                resolve(null);
              }
            };
            getRequest.onerror = () => reject(getRequest.error);
          };
          getAllKeysRequest.onerror = () => reject(getAllKeysRequest.error);
        };

        request.onerror = () => reject(request.error);
      });
    });

    expect(adminStoredKey, 'Admin encryption key should be stored in IndexedDB').toBeTruthy();
    expect(adminStoredKey, 'Admin stored key should match invite code key').toBe(adminKeyFromInviteCode);
    console.log('Admin encryption key verified in IndexedDB');

    // STEP 5: Member joins with the invite code
    // Clear authentication state for member
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Clear MailHog again for member's email
    await clearMailHogEmails();

    // Navigate to join page with invite code in query param
    // The join page cleans the URL after reading the code
    const encodedInvite = encodeURIComponent(displayedInviteCode);
    await page.goto(`/join?code=${encodedInvite}`);
    await page.waitForLoadState('networkidle');

    // The join page should have processed the invite code

    // Fill out join form
    const memberEmail = `${testId}-member@example.com`;
    const memberPassword = 'MemberPassword123!';
    const memberName = `${testId} Member`;

    await page.locator('#userName').fill(memberName);
    await page.locator('#email').fill(memberEmail);
    await page.locator('#password').fill(memberPassword);
    await page.locator('#inviteCode').fill(displayedInviteCode);

    // Intercept the GraphQL join mutation
    const joinResponsePromise = page.waitForResponse(
      response =>
        response.url().includes('/graphql') &&
        response.request().method() === 'POST',
      { timeout: 10000 }
    );

    await page.locator('button[type="submit"]').click();

    const joinResponse = await joinResponsePromise;
    const requestPayload = joinResponse.request().postDataJSON();
    const responseData = await joinResponse.json();

    // ASSERTION: verify only the code portion travelled over the network
    expect(requestPayload?.variables?.input?.inviteCode).toBe(displayedInviteCode.split(':')[0]);

    console.log('Join response:', JSON.stringify(responseData, null, 2));

    // Join should succeed or require email verification
    if (responseData.data?.joinFamily?.requiresEmailVerification) {
      // Member needs to verify email
      const memberVerificationEmail = await waitForMailHogEmail('to', memberEmail, 15000);
      expect(memberVerificationEmail).toBeTruthy();
      const memberToken = extractVerificationToken(memberVerificationEmail);
      expect(memberToken, 'Member verification token should be in email').toBeTruthy();

      await page.goto(`/verify-email?token=${memberToken}`);
      await page.waitForTimeout(2000);

      // Login as member
      await page.goto('/login');
      const memberLoginLink = page.getByText(t('login.switchToLogin'));
      if (await memberLoginLink.isVisible()) {
        await memberLoginLink.click();
        await page.waitForTimeout(300);
      }

      await page.locator('input[name="email"]').fill(memberEmail);
      await page.locator('input[name="password"]').fill(memberPassword);
      await page.locator('button[type="submit"]').click();

      await page.waitForTimeout(2000);
    } else {
      expect(responseData.errors, 'Join should succeed').toBeUndefined();
      expect(responseData.data?.joinFamily?.user?.email).toBe(memberEmail);
    }

    // ASSERTION: Verify the MEMBER's encryption key was stored in IndexedDB
    const memberStoredKey = await page.evaluate(async () => {
      const dbName = 'ourchat-keys';
      const storeName = 'keys';

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          // Get all keys and find the one starting with 'familyKey:'
          const getAllKeysRequest = store.getAllKeys();

          getAllKeysRequest.onsuccess = async () => {
            const keys = getAllKeysRequest.result as string[];
            const familyKeyName = keys.find(k => k.startsWith('familyKey:'));
            if (!familyKeyName) {
              resolve(null);
              return;
            }
            const getRequest = store.get(familyKeyName);
            getRequest.onsuccess = async () => {
              const cryptoKey = getRequest.result;
              if (cryptoKey) {
                const rawKey = await crypto.subtle.exportKey('raw', cryptoKey);
                const base64Key = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
                resolve(base64Key);
              } else {
                resolve(null);
              }
            };
            getRequest.onerror = () => reject(getRequest.error);
          };
          getAllKeysRequest.onerror = () => reject(getAllKeysRequest.error);
        };

        request.onerror = () => reject(request.error);
      });
    });

    expect(memberStoredKey, 'Member encryption key should be stored in IndexedDB').toBeTruthy();
    console.log('Member encryption key verified in IndexedDB');

    // Verify the stored key matches the key from the invite code
    const memberKeyFromInviteCode = displayedInviteCode.split(':')[1];
    expect(memberStoredKey, 'Member stored key should match invite code key').toBe(memberKeyFromInviteCode);

    // CRITICAL: Admin and member have the SAME encryption key
    expect(memberStoredKey, 'Admin and member must have identical encryption keys for E2EE').toBe(adminStoredKey);
    console.log('✓ E2EE key sharing successful: Admin and member have identical keys');
  });

  test('Invite code format includes encryption key', async ({ page }) => {
    const testId = `e2ee-format-${Date.now()}`;

    // Clear MailHog before test
    await clearMailHogEmails();

    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();

    // STEP 1: Register admin
    await page.getByText(t('login.switchToCreate')).click();
    await page.waitForTimeout(300);

    const adminEmail = `${testId}-format@example.com`;
    const adminPassword = 'FormatTest123!';

    await page.locator('#userName').fill(`${testId} Format Test Admin`);
    await page.locator('#email').fill(adminEmail);
    await page.locator('#password').fill(adminPassword);
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to verification-pending page (may include query params)
    await page.waitForURL('**/verification-pending**', { timeout: 10000 });

    // STEP 2: Verify email
    const verificationEmail = await waitForMailHogEmail('to', adminEmail, 15000);
    const token = extractVerificationToken(verificationEmail);
    expect(token).toBeTruthy();

    await page.goto(`/verify-email?token=${token}`);
    await page.waitForTimeout(2000);

    // STEP 3: Login
    await page.goto('/login');
    const loginLink = page.getByText(t('login.switchToLogin'));
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await page.waitForTimeout(300);
    }

    await page.locator('input[name="email"]').fill(adminEmail);
    await page.locator('input[name="password"]').fill(adminPassword);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL('**/family-setup', { timeout: 10000 });

    // STEP 4: Create family
    await page.locator('#familyName').fill(`${testId} Format Test Family`);
    await page.getByRole('button', { name: /create.*family/i }).click();

    // Wait for toast and get the invite code (filter for FAMILY- pattern)
    const toastLocator = page.locator('[data-sonner-toast]');
    await expect(toastLocator.filter({ hasText: /FAMILY-/ })).toBeVisible({ timeout: 15000 });

    const displayedCode = (await toastLocator.filter({ hasText: /FAMILY-/ }).textContent())!.trim();

    // Log for debugging
    console.log('Format test - Displayed code:', displayedCode);
    console.log('Code length:', displayedCode.length);
    console.log('Has FAMILY- prefix:', displayedCode.startsWith('FAMILY-'));
    console.log('Has colon separator:', displayedCode.includes(':'));

    // Split the code to analyze parts
    if (displayedCode.includes(':')) {
      const [codePart, keyPart] = displayedCode.split(':');
      console.log('Code part:', codePart);
      console.log('Code part matches FAMILY-XXXXXXXX:', /^FAMILY-[A-Z0-9]{16}$/.test(codePart));
      console.log('Key part (first 20 chars):', keyPart.substring(0, 20));
      console.log('Key part is base64:', /^[A-Za-z0-9+/=]+$/.test(keyPart));
    }

    // Verify the invite code has the correct format: FAMILY-XXXXXXXX:BASE64KEY
    expect(displayedCode, 'Invite code should match FAMILY-CODE:KEY format')
      .toMatch(/^FAMILY-[A-Z0-9]{16}:[A-Za-z0-9+/=]+$/);
  });
});
