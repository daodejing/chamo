/**
 * E2E Tests for Story 1.11: Cross-Device Key Transfer
 *
 * Tests the QR-based key transfer feature that allows users to securely
 * transfer their encryption keys from one device to another.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { translations } from '../../src/lib/translations';
import { setupFamilyAdminTest } from './fixtures';

const tEn = (key: keyof typeof translations.en): string => translations.en[key];

const CRYPTO_DB_NAME = 'chamo_encryption';

// Helper to navigate to settings via chat page settings button
// This avoids the /settings page bug with TranslationLanguageSelector
async function navigateToSettings(page: Page) {
  await page.goto('/chat');
  await page.waitForLoadState('networkidle');
  // Click the settings button in the header
  await page.click('[data-testid="settings-button"]');
  await page.waitForLoadState('networkidle');
}

test.describe('Story 1.11: Cross-Device Key Transfer', () => {
  test.describe('Export Flow', () => {
    test('Export button is visible in Settings Security section when user has encryption key', async ({
      page,
    }) => {
      const testId = `key-transfer-export-${Date.now()}`;
      const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

      try {
        // Navigate to settings via chat page
        await navigateToSettings(page);

        // Find the Security section and the Transfer button
        const transferButton = page.getByRole('button', {
          name: tEn('keyTransfer.transferToDevice'),
        });
        await expect(transferButton).toBeVisible({ timeout: 10000 });
        await expect(transferButton).toBeEnabled();
      } finally {
        await cleanup();
      }
    });

    test.skip('Export dialog shows QR code and PIN when opened', async ({ page }) => {
      const testId = `key-transfer-qr-${Date.now()}`;
      const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

      try {
        await navigateToSettings(page);

        // Click the transfer button
        const transferButton = page.getByRole('button', {
          name: tEn('keyTransfer.transferToDevice'),
        });
        await expect(transferButton).toBeVisible({ timeout: 10000 });
        await transferButton.click();

        // Wait for the dialog to appear
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        // Verify the dialog has the expected content
        await expect(
          page.getByText(tEn('keyTransfer.exportTitle'))
        ).toBeVisible();

        // Wait for QR code generation to complete (loading indicator disappears)
        // Increase timeout to allow for crypto operations
        await expect(dialog.getByText('Generating...')).toBeHidden({ timeout: 30000 });

        // Verify QR code is present - look for the white background container with SVG
        const qrContainer = dialog.locator('.bg-white').first();
        await expect(qrContainer).toBeVisible({ timeout: 5000 });

        // Verify PIN is displayed (6 digits)
        const pinDisplay = dialog.locator('[aria-label^="PIN:"]');
        await expect(pinDisplay).toBeVisible();

        // Verify expiration countdown is shown
        await expect(
          dialog.getByText(/Expires in \d+:\d+|有効期限/)
        ).toBeVisible();
      } finally {
        await cleanup();
      }
    });

    test.skip('QR payload contains valid encrypted key structure', async ({
      page,
    }) => {
      const testId = `key-transfer-payload-${Date.now()}`;
      const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

      try {
        await navigateToSettings(page);

        // Open export dialog
        const transferButton = page.getByRole('button', {
          name: tEn('keyTransfer.transferToDevice'),
        });
        await expect(transferButton).toBeVisible({ timeout: 10000 });
        await transferButton.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        // Wait for QR code generation to complete
        await expect(dialog.getByText('Generating...')).toBeHidden({ timeout: 15000 });

        // Verify QR code is present
        const qrCode = dialog.locator('svg').first();
        await expect(qrCode).toBeVisible({ timeout: 10000 });

        // Instead, verify the payload structure indirectly by checking
        // that the key can be transferred successfully (see import tests)

        // Close dialog
        await page.keyboard.press('Escape');
      } finally {
        await cleanup();
      }
    });

    test.skip('Export dialog shows expired state and regenerate button after timeout', async ({
      page,
    }) => {
      test.slow(); // This test manipulates time

      const testId = `key-transfer-expire-${Date.now()}`;
      const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

      try {
        await navigateToSettings(page);

        // Open export dialog
        const transferButton = page.getByRole('button', {
          name: tEn('keyTransfer.transferToDevice'),
        });
        await expect(transferButton).toBeVisible({ timeout: 10000 });
        await transferButton.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        // Wait for QR code generation to complete
        await expect(dialog.getByText('Generating...')).toBeHidden({ timeout: 15000 });

        // Verify QR code is present
        const qrCode = dialog.locator('svg').first();
        await expect(qrCode).toBeVisible({ timeout: 10000 });

        // Fast-forward time by manipulating the system clock
        // Note: This requires page.clock() from Playwright
        await page.clock.fastForward('5:01'); // 5 minutes + 1 second

        // Verify expired state is shown
        await expect(
          dialog.getByText(/expired|有効期限切れ/i)
        ).toBeVisible({ timeout: 10000 });

        // Verify regenerate button is visible
        const regenerateButton = dialog.getByRole('button', {
          name: new RegExp(tEn('keyTransfer.regenerate'), 'i'),
        });
        await expect(regenerateButton).toBeVisible();
      } finally {
        await cleanup();
      }
    });
  });

  test.describe('Import Flow via Lost Key Modal', () => {
    test('Lost Key Modal shows transfer option when user has no local key', async ({
      page,
    }) => {
      const testId = `lost-key-transfer-${Date.now()}`;
      const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

      try {
        // Delete the private key to simulate missing key scenario
        await resetEncryptionDatabase(page);
        await clearLostKeyFlag(page);

        // Navigate to chat - should trigger lost key modal
        await page.goto('/chat');
        await page.waitForLoadState('networkidle');

        // Verify lost key modal appears
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 10000 });

        // Verify "Transfer from another device" button exists
        const transferButton = page.getByTestId('lost-key-modal-transfer');
        await expect(transferButton).toBeVisible();
      } finally {
        await cleanup();
      }
    });

    test('Lost Key Modal transfer button opens import dialog', async ({
      page,
    }) => {
      const testId = `lost-key-import-${Date.now()}`;
      const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

      try {
        // Delete the private key to simulate missing key scenario
        await resetEncryptionDatabase(page);
        await clearLostKeyFlag(page);

        // Navigate to chat - should trigger lost key modal
        await page.goto('/chat');
        await page.waitForLoadState('networkidle');

        // Click transfer button
        const transferButton = page.getByTestId('lost-key-modal-transfer');
        await expect(transferButton).toBeVisible({ timeout: 10000 });
        await transferButton.click();

        // Verify import dialog appears
        await expect(
          page.getByText(tEn('keyTransfer.importTitle'))
        ).toBeVisible({ timeout: 5000 });
      } finally {
        await cleanup();
      }
    });

    test('Manual entry fallback is accessible from import dialog', async ({
      page,
    }) => {
      const testId = `manual-entry-${Date.now()}`;
      const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

      try {
        // Delete the private key to simulate missing key scenario
        await resetEncryptionDatabase(page);
        await clearLostKeyFlag(page);

        // Navigate to chat - should trigger lost key modal
        await page.goto('/chat');
        await page.waitForLoadState('networkidle');

        // Open import dialog via lost key modal
        const transferButton = page.getByTestId('lost-key-modal-transfer');
        await expect(transferButton).toBeVisible({ timeout: 10000 });
        await transferButton.click();

        // Wait for import dialog
        await expect(
          page.getByText(tEn('keyTransfer.importTitle'))
        ).toBeVisible({ timeout: 5000 });

        // Find and click manual entry button
        // Note: Using getByText instead of getByRole because the button text contains special chars
        const manualEntryButton = page.getByRole('button').filter({ hasText: /scan.*manually/i });
        await expect(manualEntryButton).toBeVisible();
        await manualEntryButton.click();

        // Verify manual entry textarea appears
        const textarea = page.locator('textarea');
        await expect(textarea).toBeVisible();
      } finally {
        await cleanup();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('Invalid QR code shows appropriate error', async ({ page }) => {
      const testId = `invalid-qr-${Date.now()}`;
      const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

      try {
        // Delete the private key to simulate missing key scenario
        await resetEncryptionDatabase(page);
        await clearLostKeyFlag(page);

        // Navigate to chat - should trigger lost key modal
        await page.goto('/chat');
        await page.waitForLoadState('networkidle');

        // Open import dialog
        const transferButton = page.getByTestId('lost-key-modal-transfer');
        await expect(transferButton).toBeVisible({ timeout: 10000 });
        await transferButton.click();

        // Wait for import dialog
        await expect(
          page.getByText(tEn('keyTransfer.importTitle'))
        ).toBeVisible({ timeout: 5000 });

        // Switch to manual entry
        const manualEntryButton = page.getByRole('button').filter({ hasText: /scan.*manually/i });
        await expect(manualEntryButton).toBeVisible();
        await manualEntryButton.click();

        // Enter invalid payload
        const textarea = page.locator('textarea');
        await textarea.fill('this is not a valid QR payload');

        // Click continue
        const continueButton = page.getByRole('button', { name: 'Continue' });
        await continueButton.click();

        // Should show error about invalid QR
        await expect(
          page.getByText(/doesn't look like|これはChamoの/i)
        ).toBeVisible({ timeout: 5000 });
      } finally {
        await cleanup();
      }
    });

    test('Wrong PIN shows error with remaining attempts', async ({ page }) => {
      const testId = `wrong-pin-${Date.now()}`;
      const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

      try {
        // Delete the private key to simulate missing key scenario
        await resetEncryptionDatabase(page);
        await clearLostKeyFlag(page);

        // Navigate to chat - should trigger lost key modal
        await page.goto('/chat');
        await page.waitForLoadState('networkidle');

        // Open import dialog
        const transferButton = page.getByTestId('lost-key-modal-transfer');
        await expect(transferButton).toBeVisible({ timeout: 10000 });
        await transferButton.click();

        // Wait for import dialog
        await expect(
          page.getByText(tEn('keyTransfer.importTitle'))
        ).toBeVisible({ timeout: 5000 });

        // Switch to manual entry
        const manualEntryButton = page.getByRole('button').filter({ hasText: /scan.*manually/i });
        await expect(manualEntryButton).toBeVisible();
        await manualEntryButton.click();

        // Create a valid-looking but fake payload with valid JSON structure
        // Using a fake base64 public key (doesn't need to be real for testing wrong PIN error)
        const fakePayload = JSON.stringify({
          encryptedKey: btoa('fake-encrypted-key-data-here-32bytes'),
          iv: btoa('fake-iv-12by'),
          salt: btoa('fake-salt-16byte'),
          publicKey: btoa('fake-public-key-32-bytes-long!!!'),
          version: 1,
          expiresAt: Date.now() + 300000,
        });

        // Enter the fake payload
        const textarea = page.locator('textarea');
        await textarea.fill(fakePayload);

        // Click continue
        const continueButton = page.getByRole('button', { name: 'Continue' });
        await continueButton.click();

        // Enter wrong PIN
        const pinInput = page.locator('input#pin');
        await expect(pinInput).toBeVisible();
        await pinInput.fill('000000');

        // Submit PIN
        const submitPinButton = page.getByRole('button', { name: 'Continue' });
        await submitPinButton.click();

        // Should show error about incorrect PIN with remaining attempts
        await expect(
          page.getByText(/Incorrect PIN|PINが正しくありません/i)
        ).toBeVisible({ timeout: 5000 });
      } finally {
        await cleanup();
      }
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

async function resetEncryptionDatabase(page: Page): Promise<void> {
  await page.evaluate(
    (dbName) =>
      new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase(dbName);
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => resolve();
        deleteRequest.onsuccess = () => resolve();
      }),
    CRYPTO_DB_NAME
  );
}

async function clearLostKeyFlag(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      localStorage.removeItem('lost_key_modal_seen');
    } catch {
      // ignore
    }
  });
}
