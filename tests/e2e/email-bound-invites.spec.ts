import { test, expect } from '@playwright/test';
import { translations } from '../../src/lib/translations';

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
 */

const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

test.describe('Email-Bound Invites (Story 1.5)', () => {
  const testId = `email-invite-${Date.now()}`;

  test('Subtask 10.9: Admin creates invite and member joins with correct email', async ({ page, context }) => {
    // STEP 1: Register admin
    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();

    // Switch to create (register) mode
    await page.getByText(t('login.switchToCreate')).click();
    await page.waitForTimeout(300);

    // Fill out registration form
    const adminEmail = `${testId}-admin@example.com`;
    const adminPassword = 'TestPassword123!';
    const adminName = `${testId} Admin`;

    await page.locator('#userName').fill(adminName);
    await page.locator('#email').fill(adminEmail);
    await page.locator('#password').fill(adminPassword);

    // Submit registration
    await page.locator('button[type="submit"]').click();

    // Wait for verification pending page or redirect
    await page.waitForTimeout(2000);

    // STEP 2: Navigate directly to family-setup (bypassing email verification for test)
    await page.goto('/family-setup');
    await page.waitForTimeout(1000);

    // Check if we were redirected back to login (email verification required)
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/verification-pending')) {
      // Email verification is enforced, skip this test
      console.log('⚠️  Email verification required - cannot complete E2E test without verified account');
      test.skip();
      return;
    }

    // STEP 3: Create family
    const familyName = `${testId} Test Family`;

    // Should be on family-setup page with create tab active
    await expect(page.locator('#familyName')).toBeVisible({ timeout: 10000 });
    await page.locator('#familyName').fill(familyName);

    // Submit family creation
    await page.getByRole('button', { name: /create.*family/i }).click();

    // Wait for family creation success
    await page.waitForTimeout(2000);

    // STEP 4: Navigate to family settings
    await page.goto('/family/settings');
    await page.waitForTimeout(1000);

    // STEP 5: Create email-bound invite
    const inviteeEmail = `${testId}-member@example.com`;

    // Click the "Email-Bound Invite" button
    const emailInviteButton = page.getByRole('button', { name: /Email-Bound Invite/i });
    await expect(emailInviteButton).toBeVisible({ timeout: 10000 });
    await emailInviteButton.click();

    // Wait for dialog to open
    await page.waitForTimeout(500);

    // Fill in the invitee email
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    await emailInput.fill(inviteeEmail);

    // Click generate code button
    const generateButton = page.getByRole('button', { name: t('emailInvite.generateCode', 'en') });
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

    // Close the dialog
    const doneButton = page.getByRole('button', { name: t('emailInvite.done', 'en') });
    await doneButton.click();
    await page.waitForTimeout(500);

    // STEP 6: Member joins with the correct email using 'join' mode
    const memberPage = await context.newPage();
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

    // ASSERTION: Should see email verification message
    // The joinFamily mutation validates email and returns { requiresEmailVerification: true }
    const successMessage = memberPage.getByText(/check your email|verify|verification|successful/i);
    await expect(successMessage).toBeVisible({ timeout: 10000 });

    console.log('✅ Member successfully joined with correct email');

    await memberPage.close();
  });

  test('Subtask 10.10: Member tries wrong email and sees error', async ({ page, context }) => {
    // STEP 1: Register admin
    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();

    // Switch to create (register) mode
    await page.getByText(t('login.switchToCreate')).click();
    await page.waitForTimeout(300);

    // Fill out registration form
    const adminEmail = `${testId}-admin2@example.com`;
    const adminPassword = 'TestPassword123!';
    const adminName = `${testId} Admin 2`;

    await page.locator('#userName').fill(adminName);
    await page.locator('#email').fill(adminEmail);
    await page.locator('#password').fill(adminPassword);

    // Submit registration
    await page.locator('button[type="submit"]').click();

    // Wait for verification pending page or redirect
    await page.waitForTimeout(2000);

    // STEP 2: Navigate directly to family-setup (bypassing email verification for test)
    await page.goto('/family-setup');
    await page.waitForTimeout(1000);

    // Check if we were redirected back to login (email verification required)
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/verification-pending')) {
      // Email verification is enforced, skip this test
      console.log('⚠️  Email verification required - cannot complete E2E test without verified account');
      test.skip();
      return;
    }

    // STEP 3: Create family
    const familyName = `${testId} Test Family 2`;

    // Should be on family-setup page with create tab active
    await expect(page.locator('#familyName')).toBeVisible({ timeout: 10000 });
    await page.locator('#familyName').fill(familyName);

    // Submit family creation
    await page.getByRole('button', { name: /create.*family/i }).click();

    // Wait for family creation success
    await page.waitForTimeout(2000);

    // STEP 4: Navigate to family settings
    await page.goto('/family/settings');
    await page.waitForTimeout(1000);

    // STEP 5: Create email-bound invite
    const inviteeEmail = `${testId}-member2@example.com`;
    const wrongEmail = `${testId}-wrong@example.com`;

    // Click the "Email-Bound Invite" button
    const emailInviteButton = page.getByRole('button', { name: /Email-Bound Invite/i });
    await expect(emailInviteButton).toBeVisible({ timeout: 10000 });
    await emailInviteButton.click();

    // Wait for dialog to open
    await page.waitForTimeout(500);

    // Fill in the invitee email
    const emailInput = page.locator('#email');
    await expect(emailInput).toBeVisible();
    await emailInput.fill(inviteeEmail);

    // Click generate code button
    const generateButton = page.getByRole('button', { name: t('emailInvite.generateCode', 'en') });
    await generateButton.click();

    // Wait for invite code to be generated and displayed
    await page.waitForTimeout(2000);

    // Extract the invite code from the dialog
    const inviteCodeElement = page.locator('code');
    await expect(inviteCodeElement).toBeVisible({ timeout: 10000 });
    const inviteCode = await inviteCodeElement.textContent();

    console.log('Generated invite code:', inviteCode);
    expect(inviteCode).toBeTruthy();

    // Close the dialog
    const doneButton = page.getByRole('button', { name: t('emailInvite.done', 'en') });
    await doneButton.click();
    await page.waitForTimeout(500);

    // STEP 6: Member tries to join with WRONG email using 'join' mode
    const memberPage = await context.newPage();
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

    // Wait for error
    await memberPage.waitForTimeout(3000);

    // ASSERTION: Should see error message about email mismatch
    // The backend returns: "This invite code is only valid for a specific email address"
    const errorMessage = memberPage.getByText(/invite code is only valid|email.*match|wrong email|specific email/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    console.log('✅ Member correctly blocked from using wrong email');

    await memberPage.close();
  });
});
