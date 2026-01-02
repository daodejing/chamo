import { test, expect } from '@playwright/test';
import { translations } from '../../src/lib/translations';
import { setupFamilyAdminTest, cleanupTestData } from './fixtures';

/**
 * Story 1.13: Invite Language Selection E2E Tests
 *
 * Tests the ability for family admins to select the language for
 * registration invite emails when inviting new members.
 *
 * Coverage:
 * - AC1: Language selector appears in invite dialog
 * - AC2: Limited language options available
 * - AC3: Default language matches inviter's UI language
 * - AC4: Language included in GraphQL mutation
 * - AC5/AC6: Invite created with selected language
 *
 * NOTE: These tests use the fixture-based setup pattern:
 * - Test data is created via the test-support GraphQL API
 * - Auth token and keys are injected into the browser
 * - Test data is cleaned up after each test
 */

const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

test.describe('Story 1.13: Invite Language Selection', () => {
  test('AC1-AC6: Language selector with full E2E flow', async ({ page }) => {
    const testId = `lang-sel-${Date.now()}`;

    // SETUP: Create family admin fixture via API and inject auth state
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate directly to family settings (user is already authenticated)
      await page.goto('/family/settings');
      await page.waitForLoadState('networkidle');

      // Verify we're on the family settings page (not redirected)
      // Use first() to avoid strict mode violation when family name appears multiple times
      await expect(page.getByText(fixture.family.name).first()).toBeVisible({
        timeout: 10000,
      });

      // STEP 1: Open email-bound invite dialog
      const emailInviteButton = page.getByRole('button', {
        name: /Email-Bound Invite/i,
      });
      await expect(emailInviteButton).toBeVisible({ timeout: 10000 });
      await emailInviteButton.click();
      await page.waitForTimeout(500);

      // AC1: Verify language selector is visible
      const languageLabel = page.getByText(t('emailInvite.languageLabel'));
      await expect(languageLabel).toBeVisible({ timeout: 5000 });
      console.log('✅ AC1: Language selector label is visible');

      // AC1: Verify help text is visible
      const helpText = page.getByText(t('emailInvite.languageHelp'));
      await expect(helpText).toBeVisible();
      console.log('✅ AC1: Language help text is visible');

      // AC3: Verify default language is English (since we're using English UI)
      const languageSelector = page.locator('button[role="combobox"]').first();
      await expect(languageSelector).toBeVisible();
      await expect(languageSelector).toContainText(/English/i);
      console.log('✅ AC3: Default language is English');

      // AC2: Open dropdown and verify limited language options are available
      await languageSelector.click();
      await page.waitForTimeout(300);

      // Count language options
      const languageOptions = page.locator('[role="option"]');
      const optionCount = await languageOptions.count();
      expect(optionCount).toBe(2);
      console.log(`✅ AC2: ${optionCount} language options available (en/ja)`);

      // AC2: Verify English and Japanese are present
      await expect(page.getByRole('option', { name: /English/i })).toBeVisible();
      await expect(
        page.getByRole('option', { name: /Japanese|日本語/i }),
      ).toBeVisible();
      console.log('✅ AC2: English and Japanese options available');

      // Select Japanese language
      await page.getByRole('option', { name: /Japanese|日本語/i }).click();
      await page.waitForTimeout(300);

      // Verify Japanese is now selected
      await expect(languageSelector).toContainText(/Japanese|日本語/i);
      console.log('✅ Language changed to Japanese');

      // STEP 2: Fill in email and create invite
      const inviteeEmail = `${testId}-invitee@example.com`;
      const emailInput = page.locator('#email');
      await expect(emailInput).toBeVisible();
      await emailInput.fill(inviteeEmail);

      // Intercept GraphQL request to verify language is included
      const requestPromise = page.waitForRequest(
        (req) =>
          req.url().includes('/graphql') &&
          req.method() === 'POST' &&
          req.postData()?.includes('createInvite'),
      );

      // Click generate code button
      const generateButton = page.getByRole('button', {
        name: t('emailInvite.generateCode'),
      });
      await generateButton.click();

      // AC4: Verify GraphQL mutation includes inviteeLanguage
      const request = await requestPromise;
      const postData = request.postData() || '';
      expect(postData).toContain('inviteeLanguage');
      expect(postData).toContain('ja');
      console.log('✅ AC4: GraphQL mutation includes inviteeLanguage: ja');

      // Wait for invite to be created
      await page.waitForTimeout(2000);

      // AC5/AC6: Verify invite was created successfully
      const inviteCodeElement = page.locator('code');
      await expect(inviteCodeElement).toBeVisible({ timeout: 10000 });
      const inviteCode = await inviteCodeElement.textContent();

      expect(inviteCode).toBeTruthy();
      expect(inviteCode!.length).toBeGreaterThan(10);
      console.log(`✅ AC5/AC6: Invite created with code: ${inviteCode}`);

      // Close the dialog
      const doneButton = page.getByRole('button', {
        name: t('emailInvite.done'),
      });
      await doneButton.click();

      console.log('✅ All acceptance criteria verified successfully');
    } finally {
      // TEARDOWN: Clean up test data
      await cleanup();
    }
  });

  test('Language selector allows changing languages', async ({ page }) => {
    const testId = `lang-change-${Date.now()}`;

    // SETUP: Create family admin fixture
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate directly to family settings
      await page.goto('/family/settings');
      await page.waitForLoadState('networkidle');

      // Verify we're on the correct page
      // Use first() to avoid strict mode violation when family name appears multiple times
      await expect(page.getByText(fixture.family.name).first()).toBeVisible({
        timeout: 10000,
      });

      // Open email-bound invite dialog
      const emailInviteButton = page.getByRole('button', {
        name: /Email-Bound Invite/i,
      });
      await expect(emailInviteButton).toBeVisible({ timeout: 10000 });
      await emailInviteButton.click();
      await page.waitForTimeout(500);

      // Test changing to different languages
      const languageSelector = page.locator('button[role="combobox"]').first();
      await expect(languageSelector).toBeVisible();

      const languagesToTest = [
        { code: 'ja', name: /Japanese|日本語/i },
        { code: 'en', name: /English/i },
      ];

      for (const lang of languagesToTest) {
        await languageSelector.click();
        await page.waitForTimeout(200);
        await page.getByRole('option', { name: lang.name }).click();
        await page.waitForTimeout(200);
        await expect(languageSelector).toContainText(lang.name);
        console.log(`✅ Successfully selected ${lang.code}`);
      }

      // Create invite with last selected language (English)
      const inviteeEmail = `${testId}-invitee@example.com`;
      await page.locator('#email').fill(inviteeEmail);

      const generateButton = page.getByRole('button', {
        name: t('emailInvite.generateCode'),
      });
      await generateButton.click();
      await page.waitForTimeout(2000);

      // Verify invite was created
      const inviteCodeElement = page.locator('code');
      await expect(inviteCodeElement).toBeVisible({ timeout: 10000 });

      console.log('✅ Invite created with English language selection');
    } finally {
      // TEARDOWN: Clean up test data
      await cleanup();
    }
  });
});
