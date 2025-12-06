import { test, expect } from '@playwright/test';
import { translations } from '../../src/lib/translations';
import { clearMailHogEmails, waitForMailHogEmail, extractVerificationToken, cleanupTestData } from './fixtures';

/**
 * Epic 1 - User Onboarding & Authentication
 * E2E Tests for Story 1.1: Create Family Account
 *
 * Story 1.1 Tests cover the modern registration flow:
 * - AC1: Admin provides email, password, and their name via registration form
 * - AC2: Admin verifies email via verification link
 * - AC3: Admin logs in and is redirected to family-setup
 * - AC4: Admin creates family with name, system generates invite code with encryption key
 * - AC5: Admin receives success confirmation with invite code displayed
 * - AC6: Admin is redirected to chat screen with family created
 *
 * Architecture: NestJS + GraphQL + PostgreSQL + Prisma
 * - Registration is separate from family creation (Story 1.10 change)
 * - Email verification required before login
 * - Family creation happens on /family-setup page after login
 *
 * NOTE: All UI text assertions use i18n translations (default language: 'en')
 */

// Helper to get translated text (default language is 'en')
const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

test.describe('Story 1.1: Create Family Account', () => {
  test.beforeEach(async () => {
    // Clear MailHog before each test
    await clearMailHogEmails();
  });

  /**
   * AC1-AC6: Complete registration + family creation flow
   * Tests the full story: register → verify email → login → create family
   */
  test('Create family account - full end-to-end flow', async ({ page }) => {
    const testId = `e2e-story-1-1-${Date.now()}`;
    const email = `${testId}@example.com`;
    const password = 'TestPassword123!';
    const familyName = `[${testId}] E2E Test Family`;
    const userName = `[${testId}] E2E Admin`;

    try {
      // STEP 1: Navigate to login and switch to create mode
      await page.goto('/login');
      await expect(page.getByText(t('login.title'))).toBeVisible();

      await page.getByText(t('login.switchToCreate')).click();
      await page.waitForTimeout(300);

      // AC1: Fill registration form (no familyName - that's on family-setup)
      await page.locator('#userName').fill(userName);
      await page.locator('#email').fill(email);
      await page.locator('#password').fill(password);

      // Submit registration
      await page.locator('button[type="submit"]').click();

      // Should redirect to verification-pending
      await page.waitForURL('**/verification-pending**', { timeout: 10000 });

      // STEP 2: AC2 - Verify email via MailHog
      const verificationEmail = await waitForMailHogEmail('to', email, 15000);
      expect(verificationEmail).toBeTruthy();

      const token = extractVerificationToken(verificationEmail);
      expect(token, 'Verification token should be in email').toBeTruthy();

      await page.goto(`/verify-email?token=${token}`);
      await expect(page.getByText(/verified|success/i)).toBeVisible({ timeout: 15000 });

      // STEP 3: AC3 - Login with verified credentials
      await page.waitForURL('**/login**', { timeout: 10000 }).catch(async () => {
        await page.goto('/login');
      });

      const loginLink = page.getByText(t('login.switchToLogin'));
      if (await loginLink.isVisible()) {
        await loginLink.click();
        await page.waitForTimeout(300);
      }

      await page.locator('input[name="email"]').fill(email);
      await page.locator('input[name="password"]').fill(password);
      await page.locator('button[type="submit"]').click();

      // Should redirect to family-setup (no family yet)
      await page.waitForURL('**/family-setup', { timeout: 10000 });

      // STEP 4: AC4 - Create family
      await page.locator('#familyName').fill(familyName);
      await page.getByRole('button', { name: /create.*family/i }).click();

      // AC5: Verify invite code toast appears with correct format
      const toastLocator = page.locator('[data-sonner-toast]').filter({ hasText: /FAMILY-/ });
      await expect(toastLocator).toBeVisible({ timeout: 15000 });

      const toastText = await toastLocator.textContent();
      // Invite code format: FAMILY-XXXXXXXXXXXXXXXX:BASE64KEY
      expect(toastText).toMatch(/FAMILY-[A-Z0-9]{16}:[A-Za-z0-9+/=]+/);

      // AC6: Should redirect to chat after family creation
      await page.waitForURL('**/chat**', { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      // Verify we're on chat page - look for message input or family name
      await expect(page.getByPlaceholder('Type a message...').or(page.locator('input[type="text"]')).first()).toBeVisible({ timeout: 15000 });
    } finally {
      // Cleanup test data
      await cleanupTestData({ emailPatterns: [testId] });
    }
  });

  /**
   * Error handling: Duplicate email registration
   * Tests that system prevents duplicate email registrations
   */
  test('Cannot register with duplicate email', async ({ page }) => {
    const testId = `e2e-story-1-1-dup-${Date.now()}`;
    const email = `${testId}@example.com`;

    try {
      // Register first user
      await page.goto('/login');
      await page.getByText(t('login.switchToCreate')).click();
      await page.waitForTimeout(300);

      await page.locator('#userName').fill(`${testId} First`);
      await page.locator('#email').fill(email);
      await page.locator('#password').fill('FirstPassword123!');
      await page.locator('button[type="submit"]').click();

      // Wait for first registration to complete
      await page.waitForURL('**/verification-pending**', { timeout: 10000 });

      // Try to register again with same email
      await page.goto('/login');
      await page.getByText(t('login.switchToCreate')).click();
      await page.waitForTimeout(300);

      await page.locator('#userName').fill(`${testId} Second`);
      await page.locator('#email').fill(email);
      await page.locator('#password').fill('SecondPassword123!');
      await page.locator('button[type="submit"]').click();

      // Should show error about duplicate email
      await expect(page.getByText(/already|exists|registered/i)).toBeVisible({ timeout: 10000 });

      // Should NOT navigate away from login page
      expect(page.url()).toContain('/login');
    } finally {
      await cleanupTestData({ emailPatterns: [testId] });
    }
  });

  /**
   * Validation: Required fields
   * Tests that form validation prevents submission without required fields
   */
  test('Cannot submit registration without required fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByText(t('login.switchToCreate')).click();
    await page.waitForTimeout(300);

    // Try to submit empty form
    await page.locator('button[type="submit"]').click();

    // Should show validation errors or stay on page
    expect(page.url()).toContain('/login');

    // HTML5 validation should prevent submission
    const emailInput = page.locator('#email');
    const isEmailInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isEmailInvalid).toBe(true);
  });

  /**
   * Password strength validation
   * Tests that weak passwords are rejected
   */
  test('Password must meet strength requirements', async ({ page }) => {
    const testId = `e2e-story-1-1-pwd-${Date.now()}`;

    await page.goto('/login');
    await page.getByText(t('login.switchToCreate')).click();
    await page.waitForTimeout(300);

    await page.locator('#userName').fill(`${testId} User`);
    await page.locator('#email').fill(`${testId}@example.com`);
    await page.locator('#password').fill('weak'); // Too short/weak

    await page.locator('button[type="submit"]').click();

    // Should show password strength error or stay on page
    // Either HTML5 validation or custom validation should prevent submission
    await page.waitForTimeout(500);
    expect(page.url()).toContain('/login');
  });
});
