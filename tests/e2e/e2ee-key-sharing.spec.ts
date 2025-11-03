import { test, expect } from '@playwright/test';
import { translations } from '../../src/lib/translations';

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
 */

const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

test.describe('E2EE Key Sharing via Invite Codes', () => {
  const testId = `e2ee-key-${Date.now()}`;

  test('Admin and member both receive encryption key transparently', async ({ page }) => {
    // STEP 1: Create a family via the UI
    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();

    // Switch to create family mode
    await page.getByText(t('login.switchToCreate')).click();
    await page.waitForTimeout(300);

    // Fill out the create family form
    const adminEmail = `${testId}-admin@example.com`;
    const adminPassword = 'TestPassword123!';
    const adminName = `${testId} Admin`;
    const familyName = `${testId} Test Family`;

    await page.locator('#userName').fill(adminName);
    await page.locator('#email').fill(adminEmail);
    await page.locator('#password').fill(adminPassword);
    await page.locator('#familyName').fill(familyName);

    // Submit the form
    await page.locator('button[type="submit"]').click();

    // STEP 2: Get the invite code as a user would see it
    // Wait for the invite code toast to appear
    await page.waitForTimeout(2000); // Give time for toast to render

    // Select the toast by its specific className
    const toastLocator = page.locator('.invite-code-toast');
    await expect(toastLocator).toBeVisible({ timeout: 10000 });

    // Simulate what a user would see when they try to copy the toast content
    // Get ALL text content that would be selected if user clicks the toast
    const allToastText = await toastLocator.textContent();
    console.log('All toast text (what user would copy):', allToastText);

    // The invite code should be the ONLY thing displayed (no extra text)
    // If there's extra text, users will copy garbage along with the code
    const displayedInviteCode = allToastText!.trim();
    console.log('Displayed invite code:', displayedInviteCode);

    // ASSERTION 1: The toast should display the FULL invite code (code + key)
    // Format: FAMILY-XXXXXXXXXXXXXXXX:BASE64KEY
    // This is critical - members need the key to decrypt messages
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
          const getRequest = store.get('familyKey');

          getRequest.onsuccess = async () => {
            const cryptoKey = getRequest.result;
            if (cryptoKey) {
              // Export the CryptoKey to base64 for comparison
              const rawKey = await crypto.subtle.exportKey('raw', cryptoKey);
              const base64Key = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
              resolve(base64Key);
            } else {
              resolve(null);
            }
          };
          getRequest.onerror = () => reject(getRequest.error);
        };

        request.onerror = () => reject(request.error);
      });
    });

    expect(adminStoredKey, 'Admin encryption key should be stored in IndexedDB').toBeTruthy();
    expect(adminStoredKey, 'Admin stored key should match invite code key').toBe(adminKeyFromInviteCode);
    console.log('Admin encryption key verified in IndexedDB');

    // STEP 3: Attempt to join with the displayed invite code
    // Clear authentication state to simulate a new user logging in
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    const encodedInvite = encodeURIComponent(displayedInviteCode);

    // Use the dedicated invite link route that sanitizes URL and preserves key client-side only
    await page.goto(`/join/${encodedInvite}`);
    await page.waitForURL('**/join');

    // URL must no longer expose the full invite string
    expect(new URL(page.url()).pathname.endsWith('/join')).toBe(true);

    // Join form should be prefilled with the original invite string (including key)
    await expect(page.locator('#inviteCode')).toHaveValue(displayedInviteCode);

    // Switch to join mode explicitly (route sets initial mode but ensure UI state)
    await page.getByText(t('login.switchToJoin')).click();
    await page.waitForTimeout(300);

    // Ensure invite code remains intact after toggling modes
    await expect(page.locator('#inviteCode')).toHaveValue(displayedInviteCode);

    // Fill out join form with the EXACT invite code from the toast
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

    // Submit join form
    await page.locator('button[type="submit"]').click();

    // Wait for response
    const joinResponse = await joinResponsePromise;
    const requestPayload = joinResponse.request().postDataJSON();
    const responseData = await joinResponse.json();

    // ASSERTION: verify only the code portion travelled over the network
    expect(requestPayload?.variables?.input?.inviteCode).toBe(displayedInviteCode.split(':')[0]);

    console.log('Join response:', JSON.stringify(responseData, null, 2));

    // ASSERTION 4: Join should succeed (not return errors)
    expect(responseData.errors, 'Join should succeed with the displayed invite code').toBeUndefined();
    expect(responseData.data?.joinFamily, 'Join mutation should return user data').toBeDefined();

    // ASSERTION 5: Verify the member was created successfully
    const joinData = responseData.data.joinFamily;
    expect(joinData.user.email).toBe(memberEmail);
    expect(joinData.user.role).toBe('MEMBER');
    expect(joinData.family.name).toBe(familyName);

    // ASSERTION 6: Verify the MEMBER's encryption key was stored in IndexedDB
    // This is critical for E2EE - the key must be transparently saved
    const memberStoredKey = await page.evaluate(async () => {
      const dbName = 'ourchat-keys';
      const storeName = 'keys';

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const getRequest = store.get('familyKey');

          getRequest.onsuccess = async () => {
            const cryptoKey = getRequest.result;
            if (cryptoKey) {
              // Export the CryptoKey to base64 for comparison
              const rawKey = await crypto.subtle.exportKey('raw', cryptoKey);
              const base64Key = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
              resolve(base64Key);
            } else {
              resolve(null);
            }
          };
          getRequest.onerror = () => reject(getRequest.error);
        };

        request.onerror = () => reject(request.error);
      });
    });

    expect(memberStoredKey, 'Member encryption key should be stored in IndexedDB').toBeTruthy();
    console.log('Member encryption key verified in IndexedDB');

    // ASSERTION 3: Verify the stored key matches the key from the invite code
    const memberKeyFromInviteCode = displayedInviteCode.split(':')[1];
    expect(memberStoredKey, 'Member stored key should match invite code key').toBe(memberKeyFromInviteCode);

    // ASSERTION 4: Verify admin and member have the SAME encryption key (critical for E2EE)
    expect(memberStoredKey, 'Admin and member must have identical encryption keys for E2EE').toBe(adminStoredKey);
    console.log('✓ E2EE key sharing successful: Admin and member have identical keys');
  });

  test('Invite code format includes encryption key', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();

    // Switch to create mode
    await page.getByText(t('login.switchToCreate')).click();
    await page.waitForTimeout(300);

    // Create a family
    await page.locator('#userName').fill(`${testId} Format Test Admin`);
    await page.locator('#email').fill(`${testId}-format@example.com`);
    await page.locator('#password').fill('FormatTest123!');
    await page.locator('#familyName').fill(`${testId} Format Test Family`);
    await page.locator('button[type="submit"]').click();

    // Wait for toast and get the invite code
    await page.waitForTimeout(2000);
    const toastLocator = page.locator('.invite-code-toast');
    await expect(toastLocator).toBeVisible({ timeout: 10000 });

    const displayedCode = (await toastLocator.textContent())!.trim();

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
