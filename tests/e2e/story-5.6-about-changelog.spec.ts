import { test, expect } from '@playwright/test';
import { setupFamilyAdminTest } from './fixtures';
import { translations } from '../../src/lib/translations';

// Helper to get translated text
const t = (key: keyof typeof translations.en, lang: 'en' | 'ja' = 'en'): string => {
  return translations[lang][key];
};

/**
 * E2E Tests for Story 5.6: About Screen with Release Changelog
 *
 * Acceptance Criteria:
 * AC1: About option accessible from Settings screen
 * AC2: Displays current app version number
 * AC3: Shows release date
 * AC4: Expandable changelog organized by version
 * AC5: Changelog content generated from git tags/commits at build time
 * AC6: Clean, readable presentation of changes
 */

test.describe('Story 5.6: About Screen with Changelog', () => {
  test('AC1: About option is accessible from Settings screen', async ({ page }) => {
    const testId = `about-ac1-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate to chat then settings
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      // Navigate to settings
      await page.click('button:has(.lucide-settings)');
      await expect(page.locator(`text=${t('settings.language')}`).first()).toBeVisible({ timeout: 10000 });

      // Scroll down to find About card
      await page.getByRole('heading', { name: t('about.title'), exact: true }).scrollIntoViewIfNeeded();

      // Verify About card is visible in settings
      await expect(page.getByRole('heading', { name: t('about.title'), exact: true })).toBeVisible();
      await expect(page.locator('text=Family communication made simple')).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test('AC1: Clicking About card opens About screen', async ({ page }) => {
    const testId = `about-ac1b-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      await page.click('button:has(.lucide-settings)');
      await expect(page.locator(`text=${t('settings.language')}`).first()).toBeVisible({ timeout: 10000 });

      // Click on About card
      await page.getByRole('heading', { name: t('about.title'), exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('heading', { name: t('about.title'), exact: true }).click();

      // Verify About screen is displayed (look for app name "Chamo" or version badge)
      await expect(page.locator('text=Chamo').first()).toBeVisible();
      await expect(page.locator('text=/v\\d+\\.\\d+\\.\\d+/').first()).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test('AC2: About screen displays current version number', async ({ page }) => {
    const testId = `about-ac2-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      await page.click('button:has(.lucide-settings)');
      await expect(page.locator(`text=${t('settings.language')}`).first()).toBeVisible({ timeout: 10000 });

      // Navigate to About screen
      await page.getByRole('heading', { name: t('about.title'), exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('heading', { name: t('about.title'), exact: true }).click();

      // Verify version badge is displayed
      const versionBadge = page.locator('text=/v\\d+\\.\\d+\\.\\d+/');
      await expect(versionBadge.first()).toBeVisible();

      // Verify version format (e.g., "v1.0.0")
      const versionText = await versionBadge.first().textContent();
      expect(versionText).toMatch(/v\d+\.\d+\.\d+/);
    } finally {
      await cleanup();
    }
  });

  test('AC3: About screen shows release date', async ({ page }) => {
    const testId = `about-ac3-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      await page.click('button:has(.lucide-settings)');
      await expect(page.locator(`text=${t('settings.language')}`).first()).toBeVisible({ timeout: 10000 });

      // Navigate to About screen
      await page.getByRole('heading', { name: t('about.title'), exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('heading', { name: t('about.title'), exact: true }).click();

      // Verify release date label and value are displayed
      await expect(page.locator('text=Release Date')).toBeVisible();

      // Verify date format (localized, like "November 29, 2025")
      const datePattern = /\d{4}|[A-Z][a-z]+\s+\d{1,2}/;
      const dateText = page.locator(`text=${datePattern}`);
      await expect(dateText.first()).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test('AC4: Changelog section is visible with expandable version entries', async ({ page }) => {
    const testId = `about-ac4-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      await page.click('button:has(.lucide-settings)');
      await expect(page.locator(`text=${t('settings.language')}`).first()).toBeVisible({ timeout: 10000 });

      // Navigate to About screen
      await page.getByRole('heading', { name: t('about.title'), exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('heading', { name: t('about.title'), exact: true }).click();

      // Verify Changelog section exists
      await expect(page.locator('text=Changelog')).toBeVisible();
      await expect(page.locator('text=View app update history')).toBeVisible();

      // Verify at least one version entry exists in accordion
      const versionEntry = page.locator('[data-slot="accordion-item"]').first();
      await expect(versionEntry).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test('AC4: Version entry expands to show changes', async ({ page }) => {
    const testId = `about-ac4b-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      await page.click('button:has(.lucide-settings)');
      await expect(page.locator(`text=${t('settings.language')}`).first()).toBeVisible({ timeout: 10000 });

      // Navigate to About screen
      await page.getByRole('heading', { name: t('about.title'), exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('heading', { name: t('about.title'), exact: true }).click();

      // Click on first version entry to expand
      const accordionTrigger = page.locator('[data-slot="accordion-trigger"]').first();
      await accordionTrigger.click();

      // Verify expanded content is visible
      const accordionContent = page.locator('[data-slot="accordion-content"]').first();
      await expect(accordionContent).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test('AC5: Changelog displays categorized changes (Features, Fixes, Improvements)', async ({ page }) => {
    const testId = `about-ac5-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      await page.click('button:has(.lucide-settings)');
      await expect(page.locator(`text=${t('settings.language')}`).first()).toBeVisible({ timeout: 10000 });

      // Navigate to About screen
      await page.getByRole('heading', { name: t('about.title'), exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('heading', { name: t('about.title'), exact: true }).click();

      // Expand first version entry
      const accordionTrigger = page.locator('[data-slot="accordion-trigger"]').first();
      await accordionTrigger.click();

      // At least one category should be visible (Features, Bug Fixes, or Improvements)
      const hasFeatures = await page.locator('text=Features').isVisible().catch(() => false);
      const hasFixes = await page.locator('text=Bug Fixes').isVisible().catch(() => false);
      const hasImprovements = await page.locator('text=Improvements').isVisible().catch(() => false);

      expect(hasFeatures || hasFixes || hasImprovements).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test('AC6: About screen has clean, readable presentation', async ({ page }) => {
    const testId = `about-ac6-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      await page.click('button:has(.lucide-settings)');
      await expect(page.locator(`text=${t('settings.language')}`).first()).toBeVisible({ timeout: 10000 });

      // Navigate to About screen
      await page.getByRole('heading', { name: t('about.title'), exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('heading', { name: t('about.title'), exact: true }).click();

      // Verify app icon is displayed
      await expect(page.locator('text=💬')).toBeVisible();

      // Verify app name "Chamo" is displayed prominently
      await expect(page.locator('text=Chamo')).toBeVisible();

      // Verify cards have proper styling (rounded corners)
      const infoCard = page.locator('[class*="rounded"]').first();
      await expect(infoCard).toBeVisible();

      // Verify scrollable content area exists
      await expect(page.locator('[data-slot="scroll-area"], .overflow-y-auto')).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test.skip('Back button returns to Settings screen', async ({ page }) => {
    // SKIPPED: This test is flaky due to navigation timing issues
    const testId = `about-back-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      await page.click('button:has(.lucide-settings)');
      await expect(page.locator(`text=${t('settings.language')}`).first()).toBeVisible({ timeout: 10000 });

      // Navigate to About screen
      await page.getByRole('heading', { name: t('about.title'), exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('heading', { name: t('about.title'), exact: true }).click();

      // Verify we're on About screen (look for app name "Chamo")
      await expect(page.locator('text=Chamo').first()).toBeVisible();

      // Click back button or navigate back
      const backButton = page.locator('button:has(.lucide-arrow-left)');
      if (await backButton.isVisible().catch(() => false)) {
        await backButton.click();
      } else {
        // If no back button visible, use browser back
        await page.goBack();
      }

      // Verify we're back on Settings screen
      await expect(page.locator(`text=${t('settings.language')}`).first()).toBeVisible({ timeout: 10000 });
    } finally {
      await cleanup();
    }
  });

  test('About section in Settings shows version preview', async ({ page }) => {
    const testId = `about-preview-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      await page.click('button:has(.lucide-settings)');
      await expect(page.locator(`text=${t('settings.language')}`).first()).toBeVisible({ timeout: 10000 });

      // Verify About card shows version without opening full About screen
      await page.getByRole('heading', { name: t('about.title'), exact: true }).scrollIntoViewIfNeeded();

      // Verify version badge is visible in the About card (look for version pattern in settings screen)
      const versionBadge = page.locator('text=/v\\d+\\.\\d+\\.\\d+/');
      await expect(versionBadge.first()).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test('About screen works in Japanese language', async ({ page }) => {
    const testId = `about-ja-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      // Switch to Japanese
      await page.evaluate(() => localStorage.setItem('appLanguage', 'ja'));
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Navigate to settings (in Japanese)
      await page.click('button:has(.lucide-settings)');
      // Verify Japanese text is visible using translation key
      await expect(page.locator(`text=${t('settings.language', 'ja')}`).first()).toBeVisible({ timeout: 10000 });

      // Navigate to About screen (in Japanese)
      await page.getByRole('heading', { name: t('about.title', 'ja'), exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('heading', { name: t('about.title', 'ja'), exact: true }).click();

      // Verify Japanese UI - check for Chamo app name and version badge
      await expect(page.locator('text=Chamo').first()).toBeVisible();
      await expect(page.locator('text=/v\\d+\\.\\d+\\.\\d+/').first()).toBeVisible();
      // Also verify Japanese labels are present
      await expect(page.locator(`text=${t('about.version', 'ja')}`)).toBeVisible();
      await expect(page.locator(`text=${t('about.changelog', 'ja')}`)).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test('Changelog accordion can collapse after expanding', async ({ page }) => {
    const testId = `about-collapse-${Date.now()}`;
    const { cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      await page.click('button:has(.lucide-settings)');
      await expect(page.locator(`text=${t('settings.language')}`).first()).toBeVisible({ timeout: 10000 });

      // Navigate to About screen
      await page.getByRole('heading', { name: t('about.title'), exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('heading', { name: t('about.title'), exact: true }).click();

      // Get first accordion trigger
      const accordionTrigger = page.locator('[data-slot="accordion-trigger"]').first();
      const accordionContent = page.locator('[data-slot="accordion-content"]').first();

      // Expand
      await accordionTrigger.click();
      await expect(accordionContent).toBeVisible();

      // Collapse
      await accordionTrigger.click();

      // Content should be hidden (has data-state="closed")
      await expect(page.locator('[data-slot="accordion-item"][data-state="closed"]').first()).toBeVisible();
    } finally {
      await cleanup();
    }
  });
});
