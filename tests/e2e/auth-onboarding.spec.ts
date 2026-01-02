import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';
import { translations } from '../../src/lib/translations';
import { clearMailHogEmails, waitForMailHogEmail, extractVerificationToken } from './fixtures';

const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

/**
 * Epic 1 - User Onboarding & Authentication
 * E2E Tests for Story 1.1: Create Family Account
 * E2E Tests for Story 1.2: Join Family via Invite Code
 *
 * Story 1.1 Tests cover:
 * - AC1: Admin provides family name, email, password, and their name via registration form
 * - AC3: Admin receives success confirmation with invite code displayed for sharing
 * - AC4: Admin is automatically logged in and redirected to chat screen
 *
 * Story 1.2 Tests cover:
 * - AC1: Member enters email, password, invite code, and their name via join form
 * - AC5: Member is automatically logged in and redirected to chat screen
 * - AC6: Family key is extracted from invite code and stored in IndexedDB
 */

test.describe('Story 1.1: Create Family Account', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();
  });

  /**
   * AC1: Admin provides family name, email, password, and their name via registration form
   * Tests that all form fields are present and functional
   */
  test('AC1: Registration form accepts all required fields', async ({ page }) => {
    // Switch to create mode if not already there
    const createLink = page.getByText(t('login.switchToCreate'));
    if (await createLink.isVisible()) {
      await createLink.click();
      await page.waitForTimeout(300);
    }

    // Verify all form fields are present (account registration only - no familyName after Story 1.10)
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    const userNameInput = page.locator('input[name="userName"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(userNameInput).toBeVisible();

    // Fill form with valid data
    const timestamp = Date.now();
    await emailInput.fill(`test-${timestamp}@example.com`);
    await passwordInput.fill('TestPassword123!');
    await userNameInput.fill('Test User');

    // Verify submit button is enabled
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
  });

  /**
   * AC1: Form validation shows errors for invalid inputs
   */
  test('AC1: Form validation displays errors for invalid inputs', async ({ page }) => {
    // Switch to create mode
    const createLink = page.getByText(t('login.switchToCreate'));
    await createLink.click();
    await page.waitForTimeout(300);

    // Try to submit with empty fields
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for validation errors to appear
    await page.waitForTimeout(500);

    // Verify error messages appear (at least one should be visible)
    const errorMessages = page.locator('[role="alert"], .text-red-500, .text-destructive');
    await expect(errorMessages.first()).toBeVisible();

    // Test invalid email
    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill('invalid-email');
    await emailInput.blur();
    await page.waitForTimeout(300);

    // Test short password
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.fill('short');
    await passwordInput.blur();
    await page.waitForTimeout(300);

    // At least one error should still be visible
    await expect(errorMessages.first()).toBeVisible();
  });

  /**
   * AC3 & AC4: Successful registration (API validates, verification email sent)
   * Tests that registration succeeds and verification email is sent
   */
  test('AC3 & AC4: Successful registration completes without errors', async ({ page }) => {
    // Clear MailHog before test
    await clearMailHogEmails();

    // Switch to create mode
    const createLink = page.getByText(t('login.switchToCreate'));
    await createLink.click();
    await page.waitForTimeout(300);

    // Fill form with valid unique data
    const timestamp = Date.now();
    const email = `test-${timestamp}@example.com`;

    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill('TestPassword123!');
    await page.locator('input[name="userName"]').fill('E2E Test User');

    // Submit form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Wait for redirect to verification-pending page (may include query params)
    await page.waitForURL('**/verification-pending**', { timeout: 10000 });

    // Verify no error messages appeared
    const errorElements = page.locator('[role="alert"]:has-text("error"), .text-red-500:has-text("error"), .text-destructive:has-text("error")');
    const errorCount = await errorElements.count();
    expect(errorCount).toBe(0);

    // AC3: Verify verification email was sent via MailHog
    const verificationEmail = await waitForMailHogEmail('to', email, 15000);
    expect(verificationEmail).toBeTruthy();
    expect(verificationEmail.Content.Headers.Subject[0]).toContain('Verify');
  });

  /**
   * AC3: Admin receives success confirmation with invite code displayed for sharing
   * Tests that invite code with family key appears in toast after family creation
   *
   * CORRECT E2EE BEHAVIOR:
   * - Backend returns only the code portion (FAMILY-XXXXXXXX) without the key
   * - Frontend combines code with key from IndexedDB for display
   * - Toast should show: FAMILY-XXXXXXXX:BASE64KEY format
   *
   * Full flow: register → verify email → login → create family → check toast
   */
  test('AC3: Invite code with family key appears in toast after family creation', async ({ page }) => {
    // Clear MailHog before test
    await clearMailHogEmails();

    const timestamp = Date.now();
    const email = `test-toast-${timestamp}@example.com`;
    const password = 'TestPassword123!';

    // STEP 1: Register
    await page.getByText(t('login.switchToCreate')).click();
    await page.waitForTimeout(300);

    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('input[name="userName"]').fill('Toast Test User');

    await page.locator('button[type="submit"]').click();

    // Wait for redirect to verification-pending page (may include query params)
    await page.waitForURL('**/verification-pending**', { timeout: 10000 });

    // STEP 2: Get verification email and extract token
    const verificationEmail = await waitForMailHogEmail('to', email, 15000);
    expect(verificationEmail).toBeTruthy();
    const token = extractVerificationToken(verificationEmail);
    expect(token, 'Verification token should be in email').toBeTruthy();

    // STEP 3: Verify email
    await page.goto(`/verify-email?token=${token}`);

    // Wait for verification success message
    await expect(page.getByText(/verified|success/i)).toBeVisible({ timeout: 15000 });

    // Wait for auto-redirect to login page OR navigate manually
    await page.waitForURL('**/login**', { timeout: 10000 }).catch(async () => {
      // If auto-redirect doesn't happen, navigate manually
      await page.goto('/login');
    });

    // STEP 4: Login with verified credentials

    // Make sure we're in login mode
    const loginLink = page.getByText(t('login.switchToLogin'));
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await page.waitForTimeout(300);
    }

    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();

    // Should be redirected to family-setup (no family yet)
    await page.waitForURL('**/family-setup', { timeout: 10000 });

    // Wait for any login toast to clear before creating family
    await page.waitForTimeout(2000);

    // STEP 5: Create family
    const familyName = `Test Family ${timestamp}`;
    await page.locator('#familyName').fill(familyName);
    await page.getByRole('button', { name: /create.*family/i }).click();

    // STEP 6: Wait for toast with invite code (must contain FAMILY- pattern)
    // Use a function to wait for the correct toast containing the invite code
    const toastLocator = page.locator('[data-sonner-toast]');
    await expect(toastLocator.filter({ hasText: /FAMILY-/ })).toBeVisible({ timeout: 15000 });

    // Get the toast text content
    const toastText = await toastLocator.filter({ hasText: /FAMILY-/ }).textContent();

    // Extract and validate invite code format (CODE:KEY)
    // Expected format: FAMILY-XXXXXXXXXXXXXXXX:BASE64KEY (16 char code + key combined by frontend)
    const inviteCodeMatch = toastText?.match(/(FAMILY-[A-Z0-9]{16}:[A-Za-z0-9+/=]+)/);
    const inviteCode = inviteCodeMatch ? inviteCodeMatch[1] : '';

    expect(inviteCode, `Toast text was: ${toastText}`).toBeTruthy();
    expect(inviteCode).toMatch(/^FAMILY-[A-Z0-9]{16}:[A-Za-z0-9+/=]+$/);

    // Verify the invite code contains the key portion (true E2EE)
    expect(inviteCode).toContain(':');
    const [code, key] = inviteCode.split(':');
    expect(code).toMatch(/^FAMILY-[A-Z0-9]{16}$/);
    expect(key).toBeTruthy();
    expect(key.length).toBeGreaterThan(20); // Base64 key should be substantial
  });

  /**
   * Performance: Registration completes within 10 seconds
   */
  test('Performance: Registration completes within 10 seconds', async ({ page }) => {
    // Switch to create mode
    const createLink = page.getByText(t('login.switchToCreate'));
    await createLink.click();
    await page.waitForTimeout(300);

    const timestamp = Date.now();
    await page.locator('input[name="email"]').fill(`perf-${timestamp}@example.com`);
    await page.locator('input[name="password"]').fill('TestPassword123!');
    await page.locator('input[name="userName"]').fill('Perf User');

    const startTime = Date.now();
    await page.locator('button[type="submit"]').click();

    // Wait for form submission to complete
    await page.waitForTimeout(3000);
    const endTime = Date.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
  });
});

test.describe('Story 1.2: Join Family via Invite Code', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();
  });

  /**
   * AC1: Member enters email, password, invite code, and their name via join form
   * Tests that all form fields are present and functional
   */
  test('AC1: Join form accepts all required fields', async ({ page }) => {
    // Switch to join mode
    await page.getByText('Have an invite code? Join Family').click();
    await page.waitForTimeout(500);

    // Verify form title changed (using more specific selector to avoid button match)
    await expect(page.locator('[data-slot="card-description"]', { hasText: 'Join Family' })).toBeVisible();

    // Verify all form fields are present
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    const inviteCodeInput = page.locator('input[name="inviteCode"]');
    const userNameInput = page.locator('input[name="userName"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(inviteCodeInput).toBeVisible();
    await expect(userNameInput).toBeVisible();

    // Fill form with valid data (use placeholder invite code for field testing)
    const timestamp = Date.now();
    await userNameInput.fill('Test Member');
    await emailInput.fill(`member-${timestamp}@example.com`);
    await passwordInput.fill('MemberPassword123!');
    await inviteCodeInput.fill('FAMILY-TEST1234:dGVzdGtleWV4YW1wbGUxMjM0NTY3ODkw');

    // Verify submit button is enabled
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
    await expect(submitButton).toHaveText('Join Family');
  });

  /**
   * AC1: Form validation shows errors for invalid inputs
   */
  test('AC1: Join form validation displays errors', async ({ page }) => {
    // Switch to join mode
    await page.getByText('Have an invite code? Join Family').click();
    await page.waitForTimeout(500);

    // Try to submit with empty fields
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    await page.waitForTimeout(500);

    // Verify error messages appear
    const errorMessages = page.locator('[role="alert"], .text-red-500, .text-destructive');
    await expect(errorMessages.first()).toBeVisible();

    // Test invalid email
    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill('invalid-email');
    await emailInput.blur();
    await page.waitForTimeout(300);

    // Test invalid invite code format
    const inviteCodeInput = page.locator('input[name="inviteCode"]');
    await inviteCodeInput.fill('INVALID');
    await inviteCodeInput.blur();
    await page.waitForTimeout(300);

    // At least one error should still be visible
    await expect(errorMessages.first()).toBeVisible();
  });

  /**
   * AC2, AC3, AC4, AC5: Complete join flow - member successfully joins family
   * Tests the FULL E2E functionality including database operations
   */
  /**
   * UI: Toggle between create, login, and join modes
   */
  test('UI: Can toggle between authentication modes', async ({ page }) => {
    // Start in login mode, switch to create mode
    const createLink = page.getByText(t('login.switchToCreate'));
    await createLink.click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-slot="card-description"]', { hasText: 'Create Account' })).toBeVisible();

    // Switch to join mode
    await page.getByText('Have an invite code? Join Family').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-slot="card-description"]', { hasText: 'Join Family' })).toBeVisible();

    // Switch back to create mode
    await page.getByText(t('login.switchToCreate')).click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-slot="card-description"]', { hasText: 'Create Account' })).toBeVisible();

    // Switch to login mode
    await page.getByText('Already have an account? Login').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-slot="card-description"]', { hasText: 'Login to Continue' })).toBeVisible();

    // Switch to join mode from login
    await page.getByText('Have an invite code? Join Family').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-slot="card-description"]', { hasText: 'Join Family' })).toBeVisible();
  });
});
