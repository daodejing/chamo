import { test, expect } from '@playwright/test';

/**
 * Epic 7 - End-to-End Encryption Infrastructure
 * E2E Tests for all user stories
 */

test.describe('Epic 7: E2EE Infrastructure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-e2ee');
    await expect(page.locator('h1')).toContainText('E2EE Test Harness');
  });

  /**
   * US-7.1: As a privacy-conscious user, I want all messages encrypted
   * AC1: Messages encrypted before leaving device
   * AC2: Server stores only ciphertext
   * AC3: Decryption happens only on recipient devices
   * AC4: No manual key management required
   */
  test('@smoke US-7.1: Message encryption works end-to-end', async ({ page }) => {
    // Click test button
    await page.click('[data-testid="test-message-encryption"]');

    // Wait for test to complete
    await expect(page.locator('[data-testid="test-status"]')).toContainText(
      '✅ Message encryption test passed',
      { timeout: 10000 }
    );

    // Verify result shows encryption worked
    const result = await page.locator('[data-testid="test-result"]').textContent();
    expect(result).toBeTruthy();

    const resultData = JSON.parse(result!);
    expect(resultData.plaintext).toBe('Hello, E2EE World!');
    expect(resultData.decrypted).toBe('Hello, E2EE World!');
    expect(resultData.encrypted).toMatch(/^[A-Za-z0-9+/]/); // Base64 ciphertext
  });

  /**
   * US-7.2: As a privacy-conscious user, I want all photos encrypted
   * AC1: Photos encrypted before upload
   * AC2: Object storage contains only ciphertext
   * AC3: Decryption happens in browser
   * AC4: Thumbnails also encrypted
   */
  test('US-7.2: File encryption works end-to-end', async ({ page }) => {
    // Click test button
    await page.click('[data-testid="test-file-encryption"]');

    // Wait for test to complete
    await expect(page.locator('[data-testid="test-status"]')).toContainText(
      '✅ File encryption test passed',
      { timeout: 10000 }
    );

    // Verify result shows encryption worked
    const result = await page.locator('[data-testid="test-result"]').textContent();
    expect(result).toBeTruthy();

    const resultData = JSON.parse(result!);
    expect(resultData.originalType).toBe('image/jpeg');
    expect(resultData.encryptedType).toBe('application/octet-stream'); // Opaque binary
    expect(resultData.decryptedType).toBe('image/jpeg'); // MIME type detected
    expect(resultData.bytesMatch).toBe(true);
  });

  /**
   * US-7.3: As a developer, I want encryption to be transparent
   * AC1: No loading delays from encryption/decryption
   * AC2: No UI indicators of encryption process
   * AC3: Error messages don't expose crypto details
   * AC4: Backup/sync works seamlessly
   */
  test('US-7.3: Encryption performance meets < 20ms target', async ({ page }) => {
    // Click test button
    await page.click('[data-testid="test-performance"]');

    // Wait for test to complete (may take a few seconds for 100 iterations)
    await expect(page.locator('[data-testid="test-status"]')).toContainText(
      'Performance test',
      { timeout: 15000 }
    );

    // Check if performance target met
    const status = await page.locator('[data-testid="test-status"]').textContent();
    expect(status).toContain('✅'); // Should pass performance target

    // Verify average time is under 20ms
    const result = await page.locator('[data-testid="test-result"]').textContent();
    const resultData = JSON.parse(result!);
    expect(resultData.avgTime).toBeLessThan(20);
  });

  /**
   * Key Storage Test
   * Verifies keys persist in IndexedDB (Phase 1 requirement)
   */
  test('Key storage: Keys persist in IndexedDB', async ({ page }) => {
    // Click test button
    await page.click('[data-testid="test-key-storage"]');

    // Wait for test to complete
    await expect(page.locator('[data-testid="test-status"]')).toContainText(
      '✅ Key storage test passed',
      { timeout: 10000 }
    );

    // Verify IndexedDB contains the key
    const hasKey = await page.evaluate(async () => {
      const dbName = 'ourchat-keys';
      const request = indexedDB.open(dbName);

      return new Promise<boolean>((resolve) => {
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('keys')) {
            resolve(false);
            return;
          }

          const transaction = db.transaction(['keys'], 'readonly');
          const store = transaction.objectStore('keys');
          const getRequest = store.get('familyKey');

          getRequest.onsuccess = () => {
            resolve(!!getRequest.result);
          };
          getRequest.onerror = () => {
            resolve(false);
          };
        };
        request.onerror = () => {
          resolve(false);
        };
      });
    });

    expect(hasKey).toBe(true);
  });

  /**
   * Invite Code Test
   * Verifies key distribution via invite codes (Epic 1 integration)
   */
  test('Invite code: Key distribution works correctly', async ({ page }) => {
    // Click test button
    await page.click('[data-testid="test-invite-code"]');

    // Wait for test to complete
    await expect(page.locator('[data-testid="test-status"]')).toContainText(
      '✅ Invite code test passed',
      { timeout: 10000 }
    );

    // Verify result shows invite code format
    const result = await page.locator('[data-testid="test-result"]').textContent();
    const resultData = JSON.parse(result!);

    expect(resultData.inviteCode).toMatch(/^FAMILY-TEST123:/); // CODE:KEY format
    expect(resultData.parsed.code).toBe('FAMILY-TEST123');
    expect(resultData.parsed.base64Key).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  /**
   * Web Crypto API Support Test
   * Verifies browser supports required cryptographic APIs
   */
  test('Browser supports Web Crypto API', async ({ page }) => {
    const cryptoSupported = await page.evaluate(() => {
      return !!(window.crypto && window.crypto.subtle);
    });

    expect(cryptoSupported).toBe(true);
  });

  /**
   * Zero-Knowledge Verification
   * Verifies server cannot decrypt messages (ciphertext only)
   */
  test('Zero-knowledge: Ciphertext is not plaintext', async ({ page }) => {
    // Use the message encryption test which already validates this
    await page.click('[data-testid="test-message-encryption"]');

    // Wait for test to complete
    await expect(page.locator('[data-testid="test-status"]')).toContainText(
      '✅ Message encryption test passed',
      { timeout: 10000 }
    );

    // Get the test result which contains both plaintext and encrypted data
    const result = await page.locator('[data-testid="test-result"]').textContent();
    expect(result).toBeTruthy();

    const resultData = JSON.parse(result!);
    const plaintext = resultData.plaintext;
    const ciphertext = resultData.encrypted;

    // Verify ciphertext does not contain plaintext
    expect(ciphertext).not.toContain(plaintext);
    expect(ciphertext).not.toContain('E2EE');

    // Verify ciphertext is base64 (allowing for possible truncation in display with ...)
    // Remove any ellipsis or truncation markers for validation
    const cleanCiphertext = ciphertext.replace(/\.\.\./g, '');
    expect(cleanCiphertext).toMatch(/^[A-Za-z0-9+/=]+$/);

    // Verify ciphertext is longer than plaintext (includes IV + auth tag)
    // Use the cleaned version for length comparison
    expect(cleanCiphertext.length).toBeGreaterThan(plaintext.length);

    // Verify decryption works correctly
    expect(resultData.decrypted).toBe(plaintext);
  });
});
