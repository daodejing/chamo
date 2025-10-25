import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';
import { translations } from '../../src/lib/translations';

/**
 * Epic 1 - User Onboarding & Authentication
 * E2E Tests for Story 1.1: Create Family Account
 *
 * Story 1.1 Tests cover:
 * - AC1: Admin provides family name, email, password, and their name via registration form
 * - AC2: System generates unique invite code with embedded family encryption key (format: `FAMILY-XXXX:BASE64KEY`)
 * - AC3: Admin receives success confirmation with invite code displayed for sharing
 * - AC4: Admin is automatically logged in and redirected to chat screen
 * - AC5: Family record is created in database with generated invite code
 * - AC6: Admin user record is created with role='admin' and encrypted family key stored
 *
 * Architecture: NestJS + GraphQL + MySQL + Prisma
 * - GraphQL mutation: `register(input: RegisterInput!): AuthResponse!`
 * - Frontend: Apollo Client via useAuth() hook
 * - UI: Unified login screen with create mode
 *
 * NOTE: All UI text assertions use i18n translations (default language: 'en')
 */

// Helper to get translated text (default language is 'en')
const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

test.describe('Story 1.1: Create Family Account', () => {
  let testId: string;
  let createdFamilyIds: string[] = [];
  let createdUserIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Generate unique test identifier for this test run
    testId = `e2e-story-1-1-${Date.now()}`;
    createdFamilyIds = [];
    createdUserIds = [];

    // Navigate to login page
    await page.goto('/login');
    // Wait for the page title to be visible
    await expect(page.getByText(t('login.title'))).toBeVisible();

    // Switch to create family mode
    await page.getByText(t('login.switchToCreate')).click();
    await page.waitForTimeout(300);
    // Verify we're in create mode
    await expect(page.locator('[data-slot="card-description"]', { hasText: t('login.createFamily') })).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: Delete test data created during the test
    // Note: In a real implementation, you would call GraphQL mutations to delete test data
    // For now, we rely on database cleanup scripts or manual cleanup
    // TODO: Implement GraphQL deleteFamily and deleteUser mutations for cleanup
  });


  /**
   * AC1-AC6: Complete registration flow - Create family account end-to-end
   * Tests the full story: admin creates family, system generates invite code, user is logged in
   */
  test('Create family account - full end-to-end flow', async ({ page }) => {
    // AC1: Fill registration form with all required fields
    const email = `${testId}@example.com`;
    const password = 'TestPassword123!';
    const familyName = `[${testId}] E2E Test Family`;
    const userName = `[${testId}] E2E Admin`;

    await page.locator('#userName').fill(userName);
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('#familyName').fill(familyName);

    // Intercept GraphQL register mutation
    const registerResponsePromise = page.waitForResponse(
      response =>
        response.url().includes(E2E_CONFIG.GRAPHQL_URL) &&
        response.request().method() === 'POST' &&
        response.request().postDataJSON()?.operationName === 'Register'
    );

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Wait for GraphQL response
    const registerResponse = await registerResponsePromise;
    expect(registerResponse.status()).toBe(200);

    const responseData = await registerResponse.json();
    expect(responseData.data.register).toBeDefined();
    const { user, family, accessToken } = responseData.data.register;

    // AC6: Verify admin user was created with correct role
    expect(user.email).toBe(email);
    expect(user.name).toBe(userName);
    expect(user.role).toBe('ADMIN');
    createdUserIds.push(user.id);

    // AC5: Verify family record was created
    expect(family.name).toBe(familyName);
    expect(family.inviteCode).toBeDefined();
    createdFamilyIds.push(family.id);

    // AC2: Verify invite code format includes encryption key
    expect(family.inviteCode).toMatch(/^FAMILY-[A-Z0-9]{8}:[A-Za-z0-9+/=]+$/);

    // AC3: Verify user is logged in (JWT token issued)
    expect(accessToken).toBeDefined();
    expect(accessToken.length).toBeGreaterThan(0);

    // AC4: Verify redirect occurred (navigation away from login page)
    await page.waitForTimeout(1500);
    expect(page.url()).not.toContain('/login');
  });


  /**
   * Error handling: Duplicate email registration
   * Tests that system prevents duplicate email registrations
   */
  test('Cannot register with duplicate email', async ({ page }) => {
    const email = `${testId}-duplicate@example.com`;
    const familyKeyBase64 = Buffer.from('test-duplicate-key-123').toString('base64');

    // Create first user via GraphQL
    const registerMutation = `
      mutation Register($input: RegisterInput!) {
        register(input: $input) {
          user { id }
          family { id }
        }
      }
    `;

    const firstResponse = await page.request.post(E2E_CONFIG.GRAPHQL_URL, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        query: registerMutation,
        variables: {
          input: {
            email,
            password: 'FirstPassword123!',
            familyName: `[${testId}] First Family`,
            name: `[${testId}] First User`,
            familyKeyBase64,
          },
        },
      },
    });

    expect(firstResponse.ok()).toBeTruthy();
    const firstData = await firstResponse.json();
    createdUserIds.push(firstData.data.register.user.id);
    createdFamilyIds.push(firstData.data.register.family.id);

    // Attempt second registration with same email
    await page.locator('#userName').fill(`[${testId}] Second User`);
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('SecondPassword123!');
    await page.locator('#familyName').fill(`[${testId}] Second Family`);

    const errorResponsePromise = page.waitForResponse(
      response =>
        response.url().includes(E2E_CONFIG.GRAPHQL_URL) &&
        response.request().postDataJSON()?.operationName === 'Register'
    );

    await page.locator('button[type="submit"]').click();
    const errorResponse = await errorResponsePromise;
    const errorData = await errorResponse.json();

    // Verify error returned
    expect(errorData.errors).toBeDefined();
    expect(errorData.errors.length).toBeGreaterThan(0);
  });

});
