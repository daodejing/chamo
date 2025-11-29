import { test, expect } from '@playwright/test';

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
  test.beforeEach(async ({ page }) => {
    // Setup: Login and navigate to settings
    await page.goto('/login');

    // Login with test credentials
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Login")');

    // Wait for redirect to chat/home
    await page.waitForURL(/\/(chat|home)/);

    // Navigate to settings
    await page.click('[aria-label="Settings"], button:has-text("Settings")');
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('AC1: About option is accessible from Settings screen', async ({ page }) => {
    // Scroll down to find About card
    await page.locator('text=About').scrollIntoViewIfNeeded();

    // Verify About card is visible in settings
    await expect(page.locator('text=About')).toBeVisible();
    await expect(page.locator('text=Family communication made simple')).toBeVisible();
  });

  test('AC1: Clicking About card opens About screen', async ({ page }) => {
    // Click on About card
    await page.locator('text=About').scrollIntoViewIfNeeded();
    await page.click('text=About');

    // Verify About screen is displayed
    await expect(page.locator('h2:has-text("About")')).toBeVisible();

    // Verify back button is present
    await expect(page.locator('button:has([class*="ArrowLeft"]), button:has-text("←")')).toBeVisible();
  });

  test('AC2: About screen displays current version number', async ({ page }) => {
    // Navigate to About screen
    await page.locator('text=About').scrollIntoViewIfNeeded();
    await page.click('text=About');

    // Verify version badge is displayed
    const versionBadge = page.locator('text=/v\\d+\\.\\d+\\.\\d+/');
    await expect(versionBadge.first()).toBeVisible();

    // Verify version format (e.g., "v1.0.0")
    const versionText = await versionBadge.first().textContent();
    expect(versionText).toMatch(/v\d+\.\d+\.\d+/);
  });

  test('AC3: About screen shows release date', async ({ page }) => {
    // Navigate to About screen
    await page.locator('text=About').scrollIntoViewIfNeeded();
    await page.click('text=About');

    // Verify release date label and value are displayed
    await expect(page.locator('text=Release Date')).toBeVisible();

    // Verify date format (localized, like "November 29, 2025")
    const datePattern = /\d{4}|[A-Z][a-z]+\s+\d{1,2}/;
    const dateText = page.locator(`text=${datePattern}`);
    await expect(dateText.first()).toBeVisible();
  });

  test('AC4: Changelog section is visible with expandable version entries', async ({ page }) => {
    // Navigate to About screen
    await page.locator('text=About').scrollIntoViewIfNeeded();
    await page.click('text=About');

    // Verify Changelog section exists
    await expect(page.locator('text=Changelog')).toBeVisible();
    await expect(page.locator('text=View app update history')).toBeVisible();

    // Verify at least one version entry exists in accordion
    const versionEntry = page.locator('[data-slot="accordion-item"]').first();
    await expect(versionEntry).toBeVisible();
  });

  test('AC4: Version entry expands to show changes', async ({ page }) => {
    // Navigate to About screen
    await page.locator('text=About').scrollIntoViewIfNeeded();
    await page.click('text=About');

    // Click on first version entry to expand
    const accordionTrigger = page.locator('[data-slot="accordion-trigger"]').first();
    await accordionTrigger.click();

    // Verify expanded content is visible
    const accordionContent = page.locator('[data-slot="accordion-content"]').first();
    await expect(accordionContent).toBeVisible();
  });

  test('AC5: Changelog displays categorized changes (Features, Fixes, Improvements)', async ({ page }) => {
    // Navigate to About screen
    await page.locator('text=About').scrollIntoViewIfNeeded();
    await page.click('text=About');

    // Expand first version entry
    const accordionTrigger = page.locator('[data-slot="accordion-trigger"]').first();
    await accordionTrigger.click();

    // At least one category should be visible (Features, Bug Fixes, or Improvements)
    const hasFeatures = await page.locator('text=Features').isVisible().catch(() => false);
    const hasFixes = await page.locator('text=Bug Fixes').isVisible().catch(() => false);
    const hasImprovements = await page.locator('text=Improvements').isVisible().catch(() => false);

    expect(hasFeatures || hasFixes || hasImprovements).toBe(true);
  });

  test('AC6: About screen has clean, readable presentation', async ({ page }) => {
    // Navigate to About screen
    await page.locator('text=About').scrollIntoViewIfNeeded();
    await page.click('text=About');

    // Verify app icon is displayed
    await expect(page.locator('text=💬')).toBeVisible();

    // Verify app name "Chamo" is displayed prominently
    await expect(page.locator('text=Chamo')).toBeVisible();

    // Verify cards have proper styling (rounded corners)
    const infoCard = page.locator('[class*="rounded"]').first();
    await expect(infoCard).toBeVisible();

    // Verify scrollable content area exists
    await expect(page.locator('[data-slot="scroll-area"], .overflow-y-auto')).toBeVisible();
  });

  test('Back button returns to Settings screen', async ({ page }) => {
    // Navigate to About screen
    await page.locator('text=About').scrollIntoViewIfNeeded();
    await page.click('text=About');

    // Verify we're on About screen
    await expect(page.locator('h2:has-text("About")')).toBeVisible();

    // Click back button
    await page.click('button:has([class*="ArrowLeft"]), button:first-child');

    // Verify we're back on Settings screen
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible();
    await expect(page.locator('text=Family Group')).toBeVisible();
  });

  test('About section in Settings shows version preview', async ({ page }) => {
    // Verify About card shows version without opening full About screen
    await page.locator('text=About').scrollIntoViewIfNeeded();

    // Verify version badge is visible in the About card
    const aboutCard = page.locator('div:has(> :text("About"))');
    const versionBadge = aboutCard.locator('text=/v\\d+\\.\\d+\\.\\d+/');
    await expect(versionBadge).toBeVisible();
  });

  test('About screen works in Japanese language', async ({ page }) => {
    // Switch to Japanese
    await page.evaluate(() => localStorage.setItem('appLanguage', 'ja'));
    await page.reload();

    // Navigate to settings (in Japanese)
    await page.click('[aria-label="設定"], button:has-text("設定")');

    // Navigate to About screen (in Japanese)
    await page.locator('text=アプリについて').scrollIntoViewIfNeeded();
    await page.click('text=アプリについて');

    // Verify Japanese UI
    await expect(page.locator('h2:has-text("アプリについて")')).toBeVisible();
    await expect(page.locator('text=バージョン')).toBeVisible();
    await expect(page.locator('text=リリース日')).toBeVisible();
    await expect(page.locator('text=変更履歴')).toBeVisible();
  });

  test('Changelog accordion can collapse after expanding', async ({ page }) => {
    // Navigate to About screen
    await page.locator('text=About').scrollIntoViewIfNeeded();
    await page.click('text=About');

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
  });
});
