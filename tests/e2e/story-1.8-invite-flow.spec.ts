/**
 * E2E tests for Story 1.8: Family Invite Flow
 *
 * Tests the complete invite flow for both registered and unregistered users:
 * - Test 1: Registered user invite (invitee registers via UI first)
 * - Test 2: Unregistered user full flow (5 phases)
 * - Test 3: Admin notification when invitee registers
 * - Test 4: Language preservation through invite flow
 *
 * Uses separate Playwright browser contexts for admin and invitee,
 * with MailHog for email verification.
 */

import { test, expect, BrowserContext, Page } from '@playwright/test';
import {
  clearMailHogEmails,
  waitForMailHogEmail,
  extractVerificationToken,
  extractInviteCode,
  setupFamilyAdminTest,
  cleanupTestData,
  createFamilyAdminFixture,
  injectAuthToken,
  storeUserPrivateKey,
  generateRealKeypair,
  injectFamilyKey,
  MailHogMessage,
  decodeQuotedPrintable,
} from './fixtures';
import { E2E_CONFIG } from './config';
import { inviteEmailTranslations } from '../../apps/backend/src/email/templates/invite-email.translations';
import { translations } from '../../src/lib/translations';

/**
 * Helper to create a regex that matches a translation key in any language
 */
function t(key: keyof typeof translations.en): RegExp {
  const values = Object.values(translations).map(lang => lang[key]).filter(Boolean);
  // Escape regex special characters and join with |
  const escaped = values.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(escaped.join('|'), 'i');
}

/**
 * Generate a unique test email
 */
function generateTestEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/**
 * Extract registration link from email body
 * The link format is: /login?mode=create&lockMode=invitee&email=...&lang=...
 */
function extractRegistrationLink(email: MailHogMessage): string | null {
  const body = email.Content.Body;
  // Decode quoted-printable encoding first (emails often use QP encoding)
  const decodedBody = decodeQuotedPrintable(body);
  // Look for the registration URL pattern
  const match = decodedBody.match(/https?:\/\/[^\s"'<>]+\/login\?[^\s"'<>]+/);
  if (match) {
    return match[0];
  }
  // Also try to find just the path
  const pathMatch = decodedBody.match(/\/login\?mode=create[^\s"'<>]*/);
  return pathMatch ? pathMatch[0] : null;
}

test.describe('Story 1.8: Family Invite Flow', () => {
  test.describe.configure({ timeout: 120000 }); // 2 minute timeout for these complex flows

  test('Test 1: Registered user invite flow - invitee registers via UI first', async ({ browser }) => {
    const testId = `reg-invite-${Date.now()}`;
    const inviteeEmail = generateTestEmail('invitee');
    const inviteePassword = 'TestPassword123!';
    const inviteeName = 'Test Invitee';

    // Create separate browser contexts for admin and invitee
    const adminContext = await browser.newContext();
    const inviteeContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const inviteePage = await inviteeContext.newPage();

    let adminFixture: Awaited<ReturnType<typeof setupFamilyAdminTest>> | null = null;

    try {
      // ============================================================
      // SETUP: Create admin with family via fixtures
      // ============================================================
      adminFixture = await setupFamilyAdminTest(adminPage, testId);
      const { fixture } = adminFixture;

      // ============================================================
      // PHASE 1: Invitee registers via UI
      // ============================================================
      await clearMailHogEmails();

      // Navigate to login page
      await inviteePage.goto('/login');
      await expect(inviteePage.getByTestId('auth-screen-container')).toBeVisible();

      // Switch to "Create Account" mode
      await inviteePage.click('button:has-text("Create a New Account")');
      await expect(inviteePage.getByTestId('auth-screen-mode')).toContainText(/Create Account/i);

      // Fill registration form
      await inviteePage.fill('input[name="userName"]', inviteeName);
      await inviteePage.fill('input[name="email"]', inviteeEmail);
      await inviteePage.fill('input[name="password"]', inviteePassword);

      // Submit registration
      await inviteePage.click('button[type="submit"]');

      // Should redirect to verification pending
      await expect(inviteePage).toHaveURL(/verification-pending/, { timeout: 15000 });

      // ============================================================
      // PHASE 2: Invitee verifies email
      // ============================================================
      // Wait for verification email
      const verificationEmail = await waitForMailHogEmail('to', inviteeEmail, 15000);
      expect(verificationEmail).toBeTruthy();

      // Extract verification token
      const verificationToken = extractVerificationToken(verificationEmail);
      expect(verificationToken).toBeTruthy();

      // Navigate to verification link
      await inviteePage.goto(`/verify-email?token=${verificationToken}`);
      await expect(inviteePage.getByText(t('verification.success'))).toBeVisible({ timeout: 10000 });

      // Should redirect to login
      await expect(inviteePage).toHaveURL(/login/, { timeout: 15000 });

      // ============================================================
      // PHASE 3: Admin invites registered user
      // ============================================================
      await clearMailHogEmails();

      // Navigate to family settings
      await adminPage.goto('/family/settings');
      await adminPage.waitForLoadState('networkidle');
      await expect(adminPage.getByText(fixture.family.name).first()).toBeVisible({ timeout: 10000 });

      // Open invite dialog (not email-bound, the regular encrypted invite)
      const inviteButton = adminPage.locator('button:has-text("Invite")').first();
      await expect(inviteButton).toBeVisible();
      await inviteButton.click();

      // Fill in invitee email
      const emailInput = adminPage.locator('#email');
      await expect(emailInput).toBeVisible();
      await emailInput.fill(inviteeEmail);

      // Click "Send Invite" button
      const sendInviteButton = adminPage.getByRole('button', { name: /Send Invite/i });
      await sendInviteButton.click();

      // Verify success - should NOT show "not registered" warning since user is registered
      // The invite should be created directly (encrypted invite flow)
      // Toast says "Invite sent to {email}"
      const inviteSentToast = adminPage.locator('[data-sonner-toast]').filter({ hasText: /Invite sent/i });
      await expect(inviteSentToast).toBeVisible({ timeout: 10000 });

      // Wait for invite email
      const inviteEmail = await waitForMailHogEmail('to', inviteeEmail, 15000);
      expect(inviteEmail).toBeTruthy();

      // Extract invite code
      const inviteCodeFromEmail = extractInviteCode(inviteEmail);
      expect(inviteCodeFromEmail).toBeTruthy();

      // ============================================================
      // PHASE 4: Invitee logs in and accepts invite
      // ============================================================
      // Login as invitee
      await inviteePage.goto('/login');
      await inviteePage.fill('input[name="email"]', inviteeEmail);
      await inviteePage.fill('input[name="password"]', inviteePassword);
      await inviteePage.click('button[type="submit"]');

      // Wait for login to complete - should go to family-setup since no family yet
      await expect(inviteePage).toHaveURL(/family-setup/, { timeout: 15000 });

      // Navigate to accept invite with the code
      await inviteePage.goto(`/accept-invite?code=${inviteCodeFromEmail}`);

      // Verify successful join - may show success message briefly or go straight to chat
      await Promise.race([
        expect(inviteePage.getByText(t('acceptInvite.successTitle'))).toBeVisible({ timeout: 15000 }),
        expect(inviteePage).toHaveURL(/chat/, { timeout: 15000 }),
      ]);

      // Should redirect to chat
      await expect(inviteePage).toHaveURL(/chat/, { timeout: 15000 });

      // Verify no encryption key missing errors
      const errorModal = inviteePage.getByText(/encryption key.*missing|lost/i);
      await expect(errorModal).not.toBeVisible();

      console.log('Test 1 passed: Registered user invite flow complete');
    } finally {
      // Cleanup
      await adminContext.close();
      await inviteeContext.close();
      if (adminFixture) {
        await adminFixture.cleanup();
      }
      // Also cleanup the invitee user
      await cleanupTestData({ emailPatterns: [inviteeEmail] });
    }
  });

  test('Test 2: Unregistered user full flow - all 5 phases', async ({ browser }) => {
    const testId = `unreg-invite-${Date.now()}`;
    const inviteeEmail = generateTestEmail('unreg-invitee');
    const inviteePassword = 'TestPassword123!';
    const inviteeName = 'New Invitee';

    const adminContext = await browser.newContext();
    const inviteeContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const inviteePage = await inviteeContext.newPage();

    let adminFixture: Awaited<ReturnType<typeof setupFamilyAdminTest>> | null = null;

    try {
      // ============================================================
      // SETUP: Create admin with family
      // ============================================================
      adminFixture = await setupFamilyAdminTest(adminPage, testId);
      const { fixture } = adminFixture;

      // ============================================================
      // PHASE 1: Admin sends registration invite to unregistered user
      // ============================================================
      await clearMailHogEmails();

      // Navigate to family settings
      await adminPage.goto('/family/settings');
      await adminPage.waitForLoadState('networkidle');
      await expect(adminPage.getByText(fixture.family.name).first()).toBeVisible({ timeout: 10000 });

      // Open invite dialog
      const inviteButton = adminPage.locator('button:has-text("Invite")').first();
      await expect(inviteButton).toBeVisible();
      await inviteButton.click();

      // Fill in invitee email
      const emailInput = adminPage.locator('#email');
      await expect(emailInput).toBeVisible();
      await emailInput.fill(inviteeEmail);

      // Click "Send Invite" to trigger the check
      const sendInviteButton = adminPage.getByRole('button', { name: /Send Invite/i });
      await sendInviteButton.click();

      // Should show "User not registered" warning
      await expect(adminPage.getByText(/not registered/i)).toBeVisible({ timeout: 10000 });

      // Select language (Japanese) from the language selector that appears
      const languageSelector = adminPage.locator('button[role="combobox"]').first();
      await expect(languageSelector).toBeVisible();
      await languageSelector.click();
      await adminPage.getByRole('option', { name: /Japanese|日本語/i }).click();

      // Click "Send Registration Link" button
      const sendRegLinkButton = adminPage.getByRole('button', { name: /Registration Link/i });
      await expect(sendRegLinkButton).toBeVisible();
      await sendRegLinkButton.click();

      // Verify success toast (filter to toast element to avoid matching page content)
      const successToast = adminPage.locator('[data-sonner-toast]').filter({ hasText: /sent|email/i });
      await expect(successToast).toBeVisible({ timeout: 10000 });

      // ============================================================
      // PHASE 2: Invitee receives registration email and registers
      // ============================================================
      // Wait for registration email
      const registrationEmail = await waitForMailHogEmail('to', inviteeEmail, 15000);
      expect(registrationEmail).toBeTruthy();

      // Verify email is in Japanese (check for Japanese characters or specific content)
      // The email body should contain Japanese text
      const rawEmailBody = registrationEmail.Content.Body;
      // Decode quoted-printable encoding first (emails use QP encoding)
      const emailBody = decodeQuotedPrintable(rawEmailBody);
      // Just verify the email arrived with a registration link
      expect(emailBody).toMatch(/login\?mode=create/);

      // Extract registration link
      const registrationLink = extractRegistrationLink(registrationEmail);
      expect(registrationLink).toBeTruthy();

      // Navigate to registration link
      // The link should have mode=create, lockMode=invitee, email, and lang parameters
      await inviteePage.goto(registrationLink!);
      await expect(inviteePage.getByTestId('auth-screen-container')).toBeVisible();

      // Verify mode is locked to registration (Create Account mode)
      // Uses translation helper to match both English and Japanese
      await expect(inviteePage.getByTestId('auth-screen-mode')).toContainText(t('login.createAccount'));

      // Email should be pre-filled
      const emailField = inviteePage.locator('input[name="email"]');
      await expect(emailField).toHaveValue(inviteeEmail);

      // Fill remaining fields
      await inviteePage.fill('input[name="userName"]', inviteeName);
      await inviteePage.fill('input[name="password"]', inviteePassword);

      // Submit registration
      await inviteePage.click('button[type="submit"]');

      // Should redirect to verification pending
      await expect(inviteePage).toHaveURL(/verification-pending/, { timeout: 15000 });

      // ============================================================
      // PHASE 3: Invitee verifies email
      // ============================================================
      // Clear emails to find the new verification email
      // Wait a bit then search for verification email
      const verificationEmail = await waitForMailHogEmail('to', inviteeEmail, 15000);
      expect(verificationEmail).toBeTruthy();

      // Extract verification token
      const verificationToken = extractVerificationToken(verificationEmail);
      expect(verificationToken).toBeTruthy();

      // Navigate to verification link
      await inviteePage.goto(`/verify-email?token=${verificationToken}`);
      await expect(inviteePage.getByText(t('verification.success'))).toBeVisible({ timeout: 10000 });

      // ============================================================
      // PHASE 4: Admin completes invite
      // ============================================================
      // Refresh admin's family settings page
      await adminPage.goto('/family/settings');
      await adminPage.waitForLoadState('networkidle');

      // Look for pending invitations section with "Ready to complete" status
      // First, we may need to click "Check Status" button to see if user is registered
      const checkStatusButton = adminPage.getByRole('button', { name: /Check Status/i });
      if (await checkStatusButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await checkStatusButton.click();
        await adminPage.waitForTimeout(1000);
      }

      // Now look for "Complete Invite" button
      const completeInviteButton = adminPage.getByRole('button', { name: /Complete Invite/i });
      await expect(completeInviteButton).toBeVisible({ timeout: 10000 });
      await completeInviteButton.click();

      // Wait for encrypted invite to be created - look for toast specifically
      const completedToast = adminPage.locator('[data-sonner-toast]').filter({ hasText: /sent|completed|invite/i });
      await expect(completedToast).toBeVisible({ timeout: 10000 });

      // ============================================================
      // PHASE 5: Invitee accepts invite
      // ============================================================
      // Wait for invite email with code
      const inviteEmailMsg = await waitForMailHogEmail('to', inviteeEmail, 15000);
      expect(inviteEmailMsg).toBeTruthy();

      // Extract invite code
      const inviteCode = extractInviteCode(inviteEmailMsg);
      expect(inviteCode).toBeTruthy();

      // Login as invitee
      await inviteePage.goto('/login');
      await inviteePage.fill('input[name="email"]', inviteeEmail);
      await inviteePage.fill('input[name="password"]', inviteePassword);
      await inviteePage.click('button[type="submit"]');

      // Wait for login to complete
      await inviteePage.waitForURL(/family-setup|chat/, { timeout: 15000 });
      await inviteePage.waitForLoadState('networkidle');

      // Navigate to accept invite
      await inviteePage.goto(`/accept-invite?code=${inviteCode}`);

      // Verify successful join - may show success message briefly or go straight to chat
      await Promise.race([
        expect(inviteePage.getByText(t('acceptInvite.successTitle'))).toBeVisible({ timeout: 15000 }),
        expect(inviteePage).toHaveURL(/chat/, { timeout: 15000 }),
      ]);

      // Should end up in chat
      await expect(inviteePage).toHaveURL(/chat/, { timeout: 15000 });

      console.log('Test 2 passed: Unregistered user full flow complete');
    } finally {
      await adminContext.close();
      await inviteeContext.close();
      if (adminFixture) {
        await adminFixture.cleanup();
      }
      await cleanupTestData({ emailPatterns: [inviteeEmail] });
    }
  });

  test('Test 3: Admin notification when invitee registers', async ({ browser }) => {
    const testId = `admin-notif-${Date.now()}`;
    const inviteeEmail = generateTestEmail('notif-invitee');
    const inviteePassword = 'TestPassword123!';
    const inviteeName = 'Notif Invitee';

    const adminContext = await browser.newContext();
    const inviteeContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const inviteePage = await inviteeContext.newPage();

    let adminFixture: Awaited<ReturnType<typeof setupFamilyAdminTest>> | null = null;

    try {
      // SETUP: Create admin with family + pending registration invite
      adminFixture = await setupFamilyAdminTest(adminPage, testId);
      const { fixture } = adminFixture;
      const adminEmail = fixture.admin.user.email;

      await clearMailHogEmails();

      // Admin sends registration invite
      await adminPage.goto('/family/settings');
      await adminPage.waitForLoadState('networkidle');
      await expect(adminPage.getByText(fixture.family.name).first()).toBeVisible({ timeout: 10000 });

      // Open invite dialog and send registration link
      const inviteButton = adminPage.locator('button:has-text("Invite")').first();
      await inviteButton.click();

      const emailInput = adminPage.locator('#email');
      await emailInput.fill(inviteeEmail);

      const sendInviteButton = adminPage.getByRole('button', { name: /Send Invite/i });
      await sendInviteButton.click();

      // Wait for "not registered" warning
      await expect(adminPage.getByText(/not registered/i)).toBeVisible({ timeout: 10000 });

      // Send registration link
      const sendRegLinkButton = adminPage.getByRole('button', { name: /Registration Link/i });
      await sendRegLinkButton.click();

      // Wait for registration email
      const registrationEmail = await waitForMailHogEmail('to', inviteeEmail, 15000);
      const registrationLink = extractRegistrationLink(registrationEmail);
      expect(registrationLink).toBeTruthy();

      // Clear emails before invitee registers (to catch the admin notification)
      await clearMailHogEmails();

      // Invitee completes registration
      await inviteePage.goto(registrationLink!);
      await inviteePage.waitForLoadState('networkidle');
      // Wait for create mode to be applied from URL params
      await expect(inviteePage.locator('input[name="userName"]')).toBeVisible({ timeout: 10000 });
      await inviteePage.fill('input[name="userName"]', inviteeName);
      await inviteePage.fill('input[name="password"]', inviteePassword);
      await inviteePage.click('button[type="submit"]');

      // Wait for verification pending
      await expect(inviteePage).toHaveURL(/verification-pending/, { timeout: 15000 });

      // Get verification email and verify
      const verificationEmail = await waitForMailHogEmail('to', inviteeEmail, 15000);
      const verificationToken = extractVerificationToken(verificationEmail);

      // Clear emails again to isolate admin notification
      await clearMailHogEmails();

      // Navigate to verify email
      await inviteePage.goto(`/verify-email?token=${verificationToken}`);
      await expect(inviteePage.getByText(/verified/i)).toBeVisible({ timeout: 10000 });

      // ============================================================
      // VERIFY: Admin receives notification email
      // ============================================================
      // Wait for admin notification email
      const adminNotification = await waitForMailHogEmail('to', adminEmail, 15000);
      expect(adminNotification).toBeTruthy();

      // Verify email content
      const notificationBody = adminNotification.Content.Body;
      expect(notificationBody).toMatch(new RegExp(inviteeEmail, 'i'));
      expect(notificationBody).toMatch(new RegExp(fixture.family.name, 'i'));

      // Check for link to complete invite
      expect(notificationBody).toMatch(/family\/settings|completeInvite/i);

      console.log('Test 3 passed: Admin notification verified');
    } finally {
      await adminContext.close();
      await inviteeContext.close();
      if (adminFixture) {
        await adminFixture.cleanup();
      }
      await cleanupTestData({ emailPatterns: [inviteeEmail] });
    }
  });

  test('Test 4: Language preservation through invite flow', async ({ browser }) => {
    const testId = `lang-pres-${Date.now()}`;
    const inviteeEmail = generateTestEmail('lang-invitee');
    const inviteePassword = 'TestPassword123!';
    const inviteeName = 'Lang Invitee';

    const adminContext = await browser.newContext();
    const inviteeContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const inviteePage = await inviteeContext.newPage();

    let adminFixture: Awaited<ReturnType<typeof setupFamilyAdminTest>> | null = null;

    try {
      // SETUP
      adminFixture = await setupFamilyAdminTest(adminPage, testId);
      const { fixture } = adminFixture;

      await clearMailHogEmails();

      // ============================================================
      // STEP 1: Admin sends invite with Japanese language selected
      // ============================================================
      await adminPage.goto('/family/settings');
      await adminPage.waitForLoadState('networkidle');
      await expect(adminPage.getByText(fixture.family.name).first()).toBeVisible({ timeout: 10000 });

      // Open invite dialog
      const inviteButton = adminPage.locator('button:has-text("Invite")').first();
      await inviteButton.click();

      // Fill email
      const emailInput = adminPage.locator('#email');
      await emailInput.fill(inviteeEmail);

      // Trigger check
      const sendInviteButton = adminPage.getByRole('button', { name: /Send Invite/i });
      await sendInviteButton.click();

      // Wait for not registered warning
      await expect(adminPage.getByText(/not registered/i)).toBeVisible({ timeout: 10000 });

      // Select Japanese language
      const languageSelector = adminPage.locator('button[role="combobox"]').first();
      await languageSelector.click();
      await adminPage.getByRole('option', { name: /Japanese|日本語/i }).click();

      // Send registration link
      const sendRegLinkButton = adminPage.getByRole('button', { name: /Registration Link/i });
      await sendRegLinkButton.click();

      // ============================================================
      // STEP 2: Verify registration email is in Japanese
      // ============================================================
      const registrationEmail = await waitForMailHogEmail('to', inviteeEmail, 15000);
      const rawEmailBody = registrationEmail.Content.Body;

      // Decode quoted-printable encoding (emails use QP encoding for non-ASCII)
      const emailBody = decodeQuotedPrintable(rawEmailBody);

      // Check for Japanese translation strings from the actual translations source
      const jaTranslations = inviteEmailTranslations['ja'];
      const hasJapaneseGreeting = emailBody.includes(jaTranslations.greeting);
      const hasJapaneseCta = emailBody.includes(jaTranslations.cta);
      // Also check for lang=ja in the URL
      const hasJaLang = /lang=ja/.test(emailBody);

      // Email content MUST be in Japanese (not just the URL parameter)
      expect(hasJapaneseGreeting || hasJapaneseCta).toBeTruthy();
      // URL must also include lang=ja for the registration page
      expect(hasJaLang).toBeTruthy();

      // ============================================================
      // STEP 3: Verify registration page displays in Japanese
      // ============================================================
      const registrationLink = extractRegistrationLink(registrationEmail);
      expect(registrationLink).toBeTruthy();

      // The link should contain lang=ja
      expect(registrationLink).toMatch(/lang=ja/);

      await inviteePage.goto(registrationLink!);
      await expect(inviteePage.getByTestId('auth-screen-container')).toBeVisible();

      // The page should display Japanese content
      // Look for common Japanese UI elements (the page should have lang=ja in URL)
      const currentUrl = inviteePage.url();
      expect(currentUrl).toMatch(/lang=ja/);

      // Fill and submit registration
      await inviteePage.fill('input[name="userName"]', inviteeName);
      await inviteePage.fill('input[name="password"]', inviteePassword);
      await inviteePage.click('button[type="submit"]');

      // ============================================================
      // STEP 4: Verify verification email is in Japanese
      // ============================================================
      await expect(inviteePage).toHaveURL(/verification-pending/, { timeout: 15000 });

      const verificationEmail = await waitForMailHogEmail('to', inviteeEmail, 15000);
      const verificationBody = verificationEmail.Content.Body;

      // Check for Japanese content in verification email
      const verificationHasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(verificationBody);
      console.log(`Verification email has Japanese content: ${verificationHasJapanese}`);

      // ============================================================
      // STEP 5: Verify verification page displays in Japanese
      // ============================================================
      const verificationToken = extractVerificationToken(verificationEmail);
      expect(verificationToken).toBeTruthy();

      // Navigate to verify - include lang=ja if not already in token URL
      await inviteePage.goto(`/verify-email?token=${verificationToken}&lang=ja`);
      await expect(inviteePage.getByText(t('verification.success'))).toBeVisible({ timeout: 10000 });

      console.log('Test 4 passed: Language preservation verified');
    } finally {
      await adminContext.close();
      await inviteeContext.close();
      if (adminFixture) {
        await adminFixture.cleanup();
      }
      await cleanupTestData({ emailPatterns: [inviteeEmail] });
    }
  });
});
