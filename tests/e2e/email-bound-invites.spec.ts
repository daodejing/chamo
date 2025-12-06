import { test, expect } from '@playwright/test';
import { translations } from '../../src/lib/translations';
import { setupFamilyAdminTest, clearMailHogEmails, waitForMailHogEmail, extractVerificationToken } from './fixtures';

/**
 * EMAIL-BOUND INVITES E2E TESTS (Story 1.5)
 *
 * Tests the email-bound invite system where admins can create invite codes
 * tied to specific email addresses. The system validates that the registering
 * user's email matches the email bound to the invite code.
 *
 * Coverage:
 * - Subtask 10.9: Admin creates invite → member joins with correct email
 * - Subtask 10.10: Member tries wrong email → sees error
 *
 * Uses fixtures to create pre-verified admin with family
 */

const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

test.describe('Email-Bound Invites (Story 1.5)', () => {
  test('Subtask 10.9: Admin creates invite and member joins with correct email', async ({ page, browser }) => {
    const testId = `email-invite-${Date.now()}`;

    // Use fixture to create pre-verified admin with family
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // STEP 1: Navigate to family settings (admin already authenticated)
      await page.goto('/family/settings');
      await page.waitForLoadState('networkidle');

      // STEP 2: Create email-bound invite
      const inviteeEmail = `${testId}-member@example.com`;

      // Click the "Email-Bound Invite" button
      const emailInviteButton = page.getByRole('button', { name: /Email-Bound Invite/i });
      await expect(emailInviteButton).toBeVisible({ timeout: 10000 });
      await emailInviteButton.click();

      // Wait for dialog to open
      await page.waitForTimeout(500);

      // Fill in the invitee email
      const emailInput = page.locator('input[type="email"], #email').first();
      await expect(emailInput).toBeVisible();
      await emailInput.fill(inviteeEmail);

      // Click generate code button
      const generateButton = page.getByRole('button', { name: /generate/i });
      await generateButton.click();

      // Wait for invite code to be generated and displayed
      await page.waitForTimeout(2000);

      // Extract the invite code from the dialog
      const inviteCodeElement = page.locator('code');
      await expect(inviteCodeElement).toBeVisible({ timeout: 10000 });
      const inviteCode = await inviteCodeElement.textContent();

      console.log('Generated invite code:', inviteCode);
      expect(inviteCode).toBeTruthy();
      expect(inviteCode!.length).toBeGreaterThan(10);

      // Close the dialog - use exact match for "Done" button
      const doneButton = page.getByRole('button', { name: 'Done', exact: true });
      await doneButton.click();
      await page.waitForTimeout(500);

      // STEP 3: Member joins with the correct email
      // Clear MailHog for member's verification email
      await clearMailHogEmails();

      // Create a new browser context for the member (no shared auth state)
      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      await memberPage.goto('/login');
      await expect(memberPage.getByText(t('login.title'))).toBeVisible();

      // Switch to join mode
      await memberPage.getByText(t('login.switchToJoin')).click();
      await memberPage.waitForTimeout(300);

      // Fill out the join form with CORRECT email (matches invite)
      const memberName = `${testId} Member`;
      const memberPassword = 'MemberPassword123!';

      await memberPage.locator('#userName').fill(memberName);
      await memberPage.locator('#email').fill(inviteeEmail); // Correct email - matches invite!
      await memberPage.locator('#password').fill(memberPassword);
      await memberPage.locator('#inviteCode').fill(inviteCode!);

      // Submit the form
      await memberPage.locator('button[type="submit"]').click();

      // Wait for processing
      await memberPage.waitForTimeout(3000);

      // Should see email verification message or redirect to verification-pending
      const currentUrl = memberPage.url();
      const successMessage = memberPage.getByText(/check your email|verify|verification|successful/i);

      if (currentUrl.includes('verification-pending')) {
        // Email verification required - wait for email via MailHog
        const verificationEmail = await waitForMailHogEmail('to', inviteeEmail, 15000);
        expect(verificationEmail, 'Member should receive verification email').toBeTruthy();
        console.log('✅ Member verification email received');
      } else {
        await expect(successMessage).toBeVisible({ timeout: 10000 });
      }

      console.log('✅ Member successfully joined with correct email');

      await memberContext.close();
    } finally {
      await cleanup();
    }
  });

  test('Subtask 10.10: Member tries wrong email and sees error', async ({ page, browser }) => {
    const testId = `email-wrong-${Date.now()}`;

    // Use fixture to create pre-verified admin with family
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // STEP 1: Navigate to family settings (admin already authenticated)
      await page.goto('/family/settings');
      await page.waitForLoadState('networkidle');

      // STEP 2: Create email-bound invite for specific email
      const inviteeEmail = `${testId}-member@example.com`;
      const wrongEmail = `${testId}-wrong@example.com`;

      // Click the "Email-Bound Invite" button
      const emailInviteButton = page.getByRole('button', { name: /Email-Bound Invite/i });
      await expect(emailInviteButton).toBeVisible({ timeout: 10000 });
      await emailInviteButton.click();

      // Wait for dialog to open
      await page.waitForTimeout(500);

      // Fill in the invitee email
      const emailInput = page.locator('input[type="email"], #email').first();
      await expect(emailInput).toBeVisible();
      await emailInput.fill(inviteeEmail);

      // Click generate code button
      const generateButton = page.getByRole('button', { name: /generate/i });
      await generateButton.click();

      // Wait for invite code to be generated and displayed
      await page.waitForTimeout(2000);

      // Extract the invite code from the dialog
      const inviteCodeElement = page.locator('code');
      await expect(inviteCodeElement).toBeVisible({ timeout: 10000 });
      const inviteCode = await inviteCodeElement.textContent();

      console.log('Generated invite code:', inviteCode);
      expect(inviteCode).toBeTruthy();

      // Close the dialog - use exact match for "Done" button
      const doneButton = page.getByRole('button', { name: 'Done', exact: true });
      await doneButton.click();
      await page.waitForTimeout(500);

      // STEP 3: Member tries to join with WRONG email
      // Create a new browser context for the member (no shared auth state)
      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();
      await memberPage.goto('/login');
      await expect(memberPage.getByText(t('login.title'))).toBeVisible();

      // Switch to join mode
      await memberPage.getByText(t('login.switchToJoin')).click();
      await memberPage.waitForTimeout(300);

      // Fill out the join form with WRONG email (does NOT match invite)
      const memberName = `${testId} Wrong Member`;
      const memberPassword = 'MemberPassword123!';

      await memberPage.locator('#userName').fill(memberName);
      await memberPage.locator('#email').fill(wrongEmail); // Wrong email! Does not match invite
      await memberPage.locator('#password').fill(memberPassword);
      await memberPage.locator('#inviteCode').fill(inviteCode!);

      // Submit the form
      await memberPage.locator('button[type="submit"]').click();

      // Wait for response
      await memberPage.waitForTimeout(3000);

      // ASSERTION: Should see error message about email mismatch
      // The error may appear as toast, form error, or inline message
      // Check for any of these patterns: "invite code is only valid", "email mismatch", etc.
      // Also check toasts which might show the error
      const errorPatterns = /invite code is only valid|email.*mismatch|wrong email|specific email|not.*valid|does not match|bound to.*email/i;

      // Check in page content first
      const pageContent = await memberPage.textContent('body');
      const hasErrorInPage = errorPatterns.test(pageContent || '');

      // Also check for toast notifications
      const toastError = memberPage.locator('[data-sonner-toast]').filter({ hasText: errorPatterns });
      const hasToastError = await toastError.isVisible().catch(() => false);

      // Also check for form validation errors
      const formError = memberPage.locator('[role="alert"], .text-destructive, .text-red-500').filter({ hasText: errorPatterns });
      const hasFormError = await formError.isVisible().catch(() => false);

      expect(hasErrorInPage || hasToastError || hasFormError, 'Expected error message about email mismatch').toBe(true);

      console.log('✅ Member correctly blocked from using wrong email');

      await memberContext.close();
    } finally {
      await cleanup();
    }
  });
});
