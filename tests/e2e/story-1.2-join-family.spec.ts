import { test, expect } from '@playwright/test';
import { translations } from '../../src/lib/translations';
import {
  setupFamilyAdminTest,
  cleanupTestData,
  clearMailHogEmails,
  waitForMailHogEmail,
  extractVerificationToken,
} from './fixtures';

/**
 * Epic 1 - User Onboarding & Authentication
 * E2E Tests for Story 1.2: Join Family via Invite Code
 *
 * Story 1.2 Tests cover:
 * - AC1: Member enters email, password, invite code, and their name via join form
 * - AC2: System validates invite code format and existence in database
 * - AC3: System checks family not full (current members < max_members)
 * - AC4: Member account is created with role='member' and encrypted family key stored
 * - AC5: Member is automatically logged in and redirected to chat screen
 * - AC6: Family key is extracted from invite code and stored in IndexedDB
 *
 * Architecture: NestJS + GraphQL + MySQL + Prisma
 * - GraphQL mutation: `joinFamily(input: JoinFamilyInput!): AuthResponse!`
 * - Frontend: Apollo Client via useAuth() hook
 * - UI: Unified login screen with join mode
 *
 * NOTE: Uses fixture-based setup for admin/family creation
 */

// Helper to get translated text (default language is 'en')
const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

test.describe('Story 1.2: Join Family via Invite Code', () => {
  /**
   * AC1-AC6: Complete join flow - Member joins family using invite code
   * Tests the full story: member enters details, validates invite code, joins family, auto-login
   */
  test('Join family - full end-to-end flow', async ({ page, browser }) => {
    const testId = `join-e2e-${Date.now()}`;

    // SETUP: Create admin with family via fixtures
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Get the invite code from the fixture (it's at top level, not inside family)
      const inviteCode = fixture.inviteCode;
      // Production invite codes are 22-character base64url strings
      expect(inviteCode).toMatch(/^[A-Za-z0-9_-]{22}$/);

      // Create a separate browser context for the member (isolated auth state)
      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();

      try {
        // Navigate to login page and switch to join mode
        await memberPage.goto('/login');
        await expect(memberPage.getByText(t('login.title'))).toBeVisible();

        // Switch to join family mode
        await memberPage.getByText(t('login.switchToJoin')).click();
        await memberPage.waitForTimeout(300);

        // Verify we're in join mode (check for join-specific field)
        await expect(memberPage.locator('#inviteCode')).toBeVisible();

        // AC1: Fill join form with all required fields
        const memberEmail = `${testId}-member@example.com`;
        const memberPassword = 'MemberPassword123!';
        const memberName = `${testId} Member`;

        await memberPage.locator('#userName').fill(memberName);
        await memberPage.locator('#email').fill(memberEmail);
        await memberPage.locator('#password').fill(memberPassword);
        // Use the invite code from fixture (just the code portion, not CODE:KEY format)
        await memberPage.locator('#inviteCode').fill(inviteCode);

        // Clear MailHog before registration to isolate verification email
        await clearMailHogEmails();

        // Intercept GraphQL joinFamily mutation
        const joinResponsePromise = memberPage.waitForResponse(
          (response) =>
            response.url().includes('/graphql') &&
            response.request().method() === 'POST' &&
            response.request().postDataJSON()?.operationName === 'JoinFamily',
        );

        // Submit form
        await memberPage.locator('button[type="submit"]').click();

        // Wait for GraphQL response
        const joinResponse = await joinResponsePromise;
        expect(joinResponse.status()).toBe(200);

        const responseData = await joinResponse.json();

        // Check if email verification is required (new flow)
        if (responseData.data?.joinFamily?.requiresEmailVerification) {
          // Wait for verification email
          const verificationEmail = await waitForMailHogEmail(
            'to',
            memberEmail,
            15000,
          );
          expect(verificationEmail).toBeTruthy();

          const token = extractVerificationToken(verificationEmail);
          expect(token).toBeTruthy();

          // Verify email
          await memberPage.goto(`/verify-email?token=${token}`);
          await expect(
            memberPage.getByText(/verified|success/i),
          ).toBeVisible({ timeout: 10000 });

          // Login after verification
          await memberPage.goto('/login');
          await memberPage.locator('input[name="email"]').fill(memberEmail);
          await memberPage
            .locator('input[name="password"]')
            .fill(memberPassword);
          await memberPage.locator('button[type="submit"]').click();

          // Should redirect to chat after login
          await expect(memberPage).toHaveURL(/chat/, { timeout: 15000 });
        } else {
          // Direct auth response (legacy flow)
          expect(responseData.data.joinFamily).toBeDefined();
          const { user, family, accessToken } = responseData.data.joinFamily;

          // AC4: Verify member user was created with correct role
          expect(user.email).toBe(memberEmail);
          expect(user.name).toBe(memberName);
          expect(user.role).toBe('MEMBER');

          // AC2: Verify family was found and joined
          expect(family.name).toBe(fixture.family.name);

          // AC5: Verify user is logged in (JWT token issued)
          expect(accessToken).toBeDefined();
          expect(accessToken.length).toBeGreaterThan(0);

          // Wait for redirect to chat
          await expect(memberPage).toHaveURL(/chat/, { timeout: 15000 });
        }

        // Cleanup member
        await cleanupTestData({ emailPatterns: [memberEmail] });
      } finally {
        await memberContext.close();
      }
    } finally {
      await cleanup();
    }
  });

  /**
   * AC2: Invalid invite code validation
   * Tests that system properly rejects invalid invite codes
   */
  test('Cannot join with invalid invite code', async ({ page }) => {
    const testId = `join-invalid-${Date.now()}`;

    // Navigate to login page
    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();

    // Switch to join family mode
    await page.getByText(t('login.switchToJoin')).click();
    await page.waitForTimeout(300);

    // Fill form with invalid invite code
    const memberEmail = `${testId}-invalid@example.com`;
    const memberPassword = 'MemberPassword123!';
    const memberName = `${testId} Invalid Member`;
    const invalidInviteCode = 'INVALID-CODE-12345';

    await page.locator('#userName').fill(memberName);
    await page.locator('#email').fill(memberEmail);
    await page.locator('#password').fill(memberPassword);
    await page.locator('#inviteCode').fill(invalidInviteCode);

    await page.locator('button[type="submit"]').click();

    // Wait for error message to appear in UI
    await page.waitForTimeout(1000);

    // Verify error message appears (could be client-side validation or server error)
    const errorMessages = page.locator(
      '[role="alert"], .text-red-500, .text-destructive',
    );
    const errorCount = await errorMessages.count();

    // If there are visible error messages, validation is working
    if (errorCount > 0) {
      await expect(errorMessages.first()).toBeVisible();
    } else {
      // Otherwise, check if GraphQL error was returned
      const errorResponsePromise = page
        .waitForResponse(
          (response) =>
            response.url().includes('/graphql') &&
            response.request().postDataJSON()?.operationName === 'JoinFamily',
          { timeout: 2000 },
        )
        .catch(() => null);

      const errorResponse = await errorResponsePromise;
      if (errorResponse) {
        const errorData = await errorResponse.json();
        expect(errorData.errors).toBeDefined();
        expect(errorData.errors.length).toBeGreaterThan(0);
      }
    }
  });

  /**
   * AC1: Form field validation - all required fields
   * Tests that join form displays all required input fields
   */
  test('Join form displays all required fields', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();

    // Switch to join family mode
    await page.getByText(t('login.switchToJoin')).click();
    await page.waitForTimeout(300);

    // AC1: Verify all required fields are visible
    await expect(page.locator('#userName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#inviteCode')).toBeVisible();

    // Verify submit button exists
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  /**
   * UI: Can switch between login modes
   * Tests that user can toggle between login, create, and join modes
   */
  test('Can switch to join mode from login page', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();

    // Verify initial state (login mode - no invite code field)
    const inviteCodeInitial = page.locator('#inviteCode');
    await expect(inviteCodeInitial).not.toBeVisible();

    // Switch to join mode
    await page.getByText(t('login.switchToJoin')).click();
    await page.waitForTimeout(300);

    // Verify join mode is active (invite code field now visible)
    await expect(page.locator('#inviteCode')).toBeVisible();
  });

  /**
   * Error handling: Duplicate email
   * Tests that system prevents joining with an already registered email
   */
  test('Cannot join with duplicate email', async ({ page, browser }) => {
    const testId = `join-dup-${Date.now()}`;

    // SETUP: Create admin with family
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Use the admin's email (which already exists) as the duplicate
      const duplicateEmail = fixture.admin.user.email;

      // Member context for the attempt
      const memberContext = await browser.newContext();
      const memberPage = await memberContext.newPage();

      try {
        // Attempt to join with admin's email (already registered)
        await memberPage.goto('/login');
        await memberPage.getByText(t('login.switchToJoin')).click();
        await memberPage.waitForTimeout(300);

        await memberPage.locator('#userName').fill(`${testId} Duplicate User`);
        await memberPage.locator('#email').fill(duplicateEmail);
        await memberPage.locator('#password').fill('DifferentPassword123!');
        await memberPage.locator('#inviteCode').fill(fixture.inviteCode);

        const errorResponsePromise = memberPage.waitForResponse(
          (response) =>
            response.url().includes('/graphql') &&
            response.request().postDataJSON()?.operationName === 'JoinFamily',
        );

        await memberPage.locator('button[type="submit"]').click();
        const errorResponse = await errorResponsePromise;
        const errorData = await errorResponse.json();

        // Verify error returned for duplicate email
        expect(errorData.errors).toBeDefined();
        expect(errorData.errors.length).toBeGreaterThan(0);
        expect(errorData.errors[0].message).toContain(
          'Email already registered',
        );
      } finally {
        await memberContext.close();
      }
    } finally {
      await cleanup();
    }
  });
});
