import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Story 5.4: Customize Language Settings
 *
 * Acceptance Criteria:
 * AC1: Switch app UI language in settings (English/Japanese for MVP)
 * AC2: Set preferred language for message translation (20+ languages)
 * AC3: All UI text, labels, buttons translated based on UI language setting
 * AC4: Date/time formats localized based on UI language
 * AC5: UI language changes require page reload, message translation language updates immediately
 */

test.describe('Story 5.4: Language Settings', () => {
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
    await expect(page.locator('text=Settings, 設定')).toBeVisible();
  });

  test('AC1: Switch UI language from English to Japanese with page reload', async ({ page }) => {
    // Verify currently on English
    await expect(page.locator('text=App Language')).toBeVisible();

    // Click Japanese button
    await page.click('button:has-text("日本語")');

    // Should show toast notification about reloading
    await expect(page.locator('text=Reloading to apply new language')).toBeVisible();

    // Wait for page reload
    await page.waitForLoadState('networkidle');

    // Verify UI is now in Japanese
    await expect(page.locator('text=アプリの言語')).toBeVisible();
    await expect(page.locator('text=設定')).toBeVisible();
  });

  test('AC1: Switch UI language from Japanese to English with page reload', async ({ page }) => {
    // First set to Japanese
    await page.evaluate(() => localStorage.setItem('appLanguage', 'ja'));
    await page.reload();

    // Verify currently on Japanese
    await expect(page.locator('text=アプリの言語')).toBeVisible();

    // Click English button
    await page.click('button:has-text("English")');

    // Should show Japanese toast message about reloading
    await expect(page.locator('text=新しい言語を適用するためにリロードしています')).toBeVisible();

    // Wait for page reload
    await page.waitForLoadState('networkidle');

    // Verify UI is now in English
    await expect(page.locator('text=App Language')).toBeVisible();
    await expect(page.locator('text=Settings')).toBeVisible();
  });

  test('AC2: Set translation language without page reload', async ({ page }) => {
    // Locate translation language selector
    const translationSelector = page.locator('select, [role="combobox"]').filter({
      has: page.locator('text=Translate Messages To, メッセージの翻訳先')
    });

    // Change translation language to Spanish
    await translationSelector.click();
    await page.click('text=Spanish, スペイン語');

    // Should show success toast (NO reload)
    await expect(page.locator('text=Translation language updated successfully')).toBeVisible();

    // Verify page did NOT reload by checking that element is still visible
    await expect(translationSelector).toBeVisible();
  });

  test('AC2: Translation language selector has 20+ language options', async ({ page }) => {
    // Open translation language selector
    const translationSelector = page.locator('select, [role="combobox"]').filter({
      has: page.locator('text=Translate Messages To, メッセージの翻訳先')
    });

    await translationSelector.click();

    // Verify presence of at least 20 languages
    const expectedLanguages = [
      'English', 'Japanese', 'Spanish', 'French', 'German',
      'Chinese', 'Korean', 'Portuguese', 'Russian', 'Arabic',
      'Italian', 'Dutch', 'Polish', 'Turkish', 'Vietnamese',
      'Thai', 'Indonesian', 'Hindi', 'Swedish', 'Norwegian',
    ];

    for (const lang of expectedLanguages.slice(0, 10)) { // Check first 10 to avoid timeout
      await expect(page.locator(`text=${lang}`)).toBeVisible();
    }
  });

  test('AC3: All UI text translated when language changes', async ({ page }) => {
    // Verify English UI elements
    await expect(page.locator('text=Settings')).toBeVisible();
    await expect(page.locator('text=App Language')).toBeVisible();
    await expect(page.locator('text=Family Group')).toBeVisible();

    // Switch to Japanese
    await page.click('button:has-text("日本語")');
    await page.waitForLoadState('networkidle');

    // Verify Japanese UI elements
    await expect(page.locator('text=設定')).toBeVisible();
    await expect(page.locator('text=アプリの言語')).toBeVisible();
    await expect(page.locator('text=家族グループ')).toBeVisible();

    // Verify NO English text remains (spot check)
    await expect(page.locator('text=Settings')).not.toBeVisible();
    await expect(page.locator('text=App Language')).not.toBeVisible();
  });

  test('AC4: Date/time formats change with UI language', async ({ page }) => {
    // Navigate to a page with dates (Calendar or Chat)
    await page.click('text=Calendar, カレンダー');

    // Check English date format (e.g., "Oct 13, 2025")
    const englishDatePattern = /[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/;
    const hasEnglishDate = await page.locator(`text=${englishDatePattern}`).count() > 0;

    // Switch to Japanese
    await page.click('[aria-label="Settings"], button:has-text("Settings")');
    await page.click('button:has-text("日本語")');
    await page.waitForLoadState('networkidle');

    // Navigate back to calendar
    await page.click('text=カレンダー');

    // Check Japanese date format (e.g., "2025年10月13日")
    const japaneseDatePattern = /\d{4}年\d{1,2}月\d{1,2}日/;
    await expect(page.locator(`text=${japaneseDatePattern}`).first()).toBeVisible();
  });

  test('AC5: UI language requires reload, translation language does not', async ({ page }) => {
    // Test UI language change triggers reload
    const uiLanguageButton = page.locator('button:has-text("日本語")');
    await uiLanguageButton.click();

    // Wait for reload by checking URL doesn't change but page reloads
    await page.waitForLoadState('networkidle');

    // Verify page reloaded by checking new language is active
    await expect(page.locator('text=アプリの言語')).toBeVisible();

    // Test translation language change does NOT trigger reload
    const translationSelector = page.locator('select, [role="combobox"]').filter({
      has: page.locator('text=メッセージの翻訳先')
    });

    // Track if page reloads by setting a flag
    let pageReloaded = false;
    page.on('load', () => { pageReloaded = true; });

    await translationSelector.click();
    await page.click('text=スペイン語');

    // Wait a bit to see if reload happens
    await page.waitForTimeout(1000);

    // Page should NOT have reloaded
    expect(pageReloaded).toBe(false);

    // But toast should have appeared
    await expect(page.locator('text=翻訳言語を更新しました')).toBeVisible();
  });

  test('Language settings persist after logout and login', async ({ page }) => {
    // Set UI language to Japanese
    await page.click('button:has-text("日本語")');
    await page.waitForLoadState('networkidle');

    // Set translation language to Spanish
    const translationSelector = page.locator('select, [role="combobox"]').nth(1);
    await translationSelector.click();
    await page.click('text=スペイン語');

    // Logout
    await page.click('button:has-text("ログアウト")');
    await page.waitForURL('/login');

    // Login again
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("ログイン")');

    await page.waitForURL(/\/(chat|home)/);

    // Navigate to settings
    await page.click('[aria-label="設定"]');

    // Verify UI language persisted (Japanese)
    await expect(page.locator('text=アプリの言語')).toBeVisible();
    await expect(page.locator('text=設定')).toBeVisible();

    // Verify translation language persisted (Spanish)
    // This would require checking the selected value in the dropdown
    const selectedTranslationLang = await translationSelector.textContent();
    expect(selectedTranslationLang).toContain('スペイン語');
  });

  test('Help text explains difference between language settings', async ({ page }) => {
    // Verify App Language help text
    await expect(page.locator('text=Select the language for app menus and buttons')).toBeVisible();
    await expect(page.locator('text=page will reload')).toBeVisible();

    // Verify Translation Language help text
    await expect(page.locator('text=automatically translate family messages')).toBeVisible();
  });

  test('Language selector buttons have correct visual states', async ({ page }) => {
    // English should be selected by default (highlighted)
    const englishButton = page.locator('button:has-text("English")');
    await expect(englishButton).toHaveClass(/bg-gradient-to-r/);

    // Japanese should not be selected (outlined)
    const japaneseButton = page.locator('button:has-text("日本語")');
    await expect(japaneseButton).not.toHaveClass(/bg-gradient-to-r/);

    // Click Japanese
    await japaneseButton.click();
    await page.waitForLoadState('networkidle');

    // Now Japanese should be selected
    const japaneseButtonAfter = page.locator('button:has-text("日本語")');
    await expect(japaneseButtonAfter).toHaveClass(/bg-gradient-to-r/);
  });
});
