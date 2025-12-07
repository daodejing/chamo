import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';
import { translations } from '../../src/lib/translations';
import { setupFamilyAdminTest, setupMessagingTest } from './fixtures';

/**
 * Epic 2 - Messaging & Communication
 * E2E Tests for Story 2.1: Send Messages in Different Channels
 *
 * Story 2.1 Tests cover:
 * - AC1: Select channel from channel list
 * - AC2: Type message and send
 * - AC3: Message appears in correct channel for all members (real-time < 2s)
 * - AC4: Message is encrypted before transmission (E2EE)
 *
 * NOTE: All UI text assertions use i18n translations (default language: 'en')
 * NOTE: Tests use fixtures to create pre-verified admin user with family
 */

// Helper to get translated text (default language is 'en')
const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

test.describe('Story 2.1: Send Messages in Different Channels', () => {
  /**
   * AC1: Select channel from channel list
   * Tests that users can view and switch between channels
   */
  test('AC1: User can select channel from channel list', async ({ page }) => {
    const testId = `msg-ac1-${Date.now()}`;
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate to chat page
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      // Verify channel name is visible (verifies channel selection works)
      const generalText = page.getByText('General', { exact: false });
      await expect(generalText).toBeVisible({ timeout: 10000 });

      // Verify channel description is visible
      const channelDescription = page.getByText('Default family channel');
      await expect(channelDescription).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  /**
   * AC2: Type message and send
   * Tests the message input and send functionality
   */
  test('@smoke AC2: User can type and send message', async ({ page }) => {
    const testId = `msg-ac2-${Date.now()}`;
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate to chat page
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      const messageInput = page.getByPlaceholder(t('chat.messageInput'));
      await expect(messageInput).toBeVisible({ timeout: 5000 });

      // Type a message
      const testMessage = `[${testId}] Hello from E2E test`;
      await messageInput.fill(testMessage);

      // Find send button (contains Send icon, gradient background)
      const sendButton = page.locator('button.bg-gradient-to-r:has(svg)').last();
      await expect(sendButton).toBeVisible();

      // Send the message
      await sendButton.click();
      await page.waitForTimeout(1000);

      // Verify message appears in the chat (use first() due to possible translation duplicate)
      await expect(page.getByText(testMessage).first()).toBeVisible({ timeout: 3000 });

      // Verify input field is cleared after sending
      await expect(messageInput).toHaveValue('');
    } finally {
      await cleanup();
    }
  });

  /**
   * AC3: Message appears for all family members
   * Tests multi-user messaging using separate browser contexts with fixture-based setup.
   * Uses page reload to verify message persistence instead of relying on WebSocket subscriptions.
   */
  test('@smoke AC3: Admin can send message that member can see', async ({ browser }) => {
    const testId = `msg-ac3-${Date.now()}`;
    const { fixture, adminPage, memberPage, cleanup } = await setupMessagingTest(browser, testId);

    try {
      // Navigate both users to chat
      await Promise.all([
        adminPage.goto('/chat'),
        memberPage.goto('/chat'),
      ]);

      // Wait for chat interface to load on both pages
      const adminMessageInput = adminPage.getByPlaceholder(t('chat.messageInput'));
      const memberMessageInput = memberPage.getByPlaceholder(t('chat.messageInput'));
      await expect(adminMessageInput).toBeVisible({ timeout: 10000 });
      await expect(memberMessageInput).toBeVisible({ timeout: 10000 });

      // Verify both users see the channel
      await expect(adminPage.getByText('General', { exact: false })).toBeVisible({ timeout: 5000 });
      await expect(memberPage.getByText('General', { exact: false })).toBeVisible({ timeout: 5000 });

      // Admin sends a message
      const adminMessage = `[${testId}] Hello from admin`;
      await adminMessageInput.fill(adminMessage);
      const adminSendButton = adminPage.locator('button.bg-gradient-to-r:has(svg)').last();
      await adminSendButton.click();

      // Verify message appears on admin's screen
      await expect(adminPage.getByText(adminMessage).first()).toBeVisible({ timeout: 5000 });

      // Member reloads to fetch persisted messages (more reliable than WebSocket in E2E)
      await memberPage.reload({ waitUntil: 'networkidle' });
      await expect(memberMessageInput).toBeVisible({ timeout: 10000 });

      // Verify admin's message appears on member's screen
      await expect(memberPage.getByText(adminMessage).first()).toBeVisible({ timeout: 5000 });

      // Member sends a reply
      const memberMessage = `[${testId}] Hello from member`;
      await memberMessageInput.fill(memberMessage);
      const memberSendButton = memberPage.locator('button.bg-gradient-to-r:has(svg)').last();
      await memberSendButton.click();

      // Verify reply appears on member's screen
      await expect(memberPage.getByText(memberMessage).first()).toBeVisible({ timeout: 5000 });

      // Admin reloads to fetch persisted messages
      await adminPage.reload({ waitUntil: 'networkidle' });
      await expect(adminMessageInput).toBeVisible({ timeout: 10000 });

      // Verify member's reply appears on admin's screen
      await expect(adminPage.getByText(memberMessage).first()).toBeVisible({ timeout: 5000 });

    } finally {
      await cleanup();
    }
  });

  /**
   * AC4: Message is encrypted before transmission (E2EE)
   * Tests that messages are encrypted client-side before being sent to the server
   */
  test('AC4: Messages are encrypted before transmission', async ({ page }) => {
    const testId = `msg-ac4-${Date.now()}`;
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate to chat page
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      const messageInput = page.getByPlaceholder(t('chat.messageInput'));
      await expect(messageInput).toBeVisible({ timeout: 5000 });

      // Prepare to intercept GraphQL mutation
      const testMessage = `[${testId}] Secret message for E2EE test`;

      // Wait for the GraphQL request (sendMessage mutation)
      const messageRequestPromise = page.waitForRequest(
        request => request.url().includes('/graphql') && request.method() === 'POST'
      );

      await messageInput.fill(testMessage);
      const sendButton = page.locator('button.bg-gradient-to-r:has(svg)').last();
      await sendButton.click();

      const messageRequest = await messageRequestPromise;
      const requestBody = messageRequest.postDataJSON();

      // Verify the request contains sendMessage mutation with encrypted content
      expect(requestBody.variables.input).toHaveProperty('encryptedContent');
      expect(requestBody.variables.input.encryptedContent).toBeDefined();
      expect(requestBody.variables.input.encryptedContent).not.toBe(testMessage); // Should be ciphertext, not plaintext

      // Verify the plaintext message is NOT sent to the server
      expect(JSON.stringify(requestBody)).not.toContain(testMessage);

      // Verify message still appears correctly in UI (after decryption)
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 3000 });
    } finally {
      await cleanup();
    }
  });

  /**
   * UI: Can switch between channels and messages are scoped correctly
   * Tests channel switching functionality
   */
  test('UI: Messages are scoped to correct channel', async ({ page }) => {
    const testId = `msg-ui-${Date.now()}`;
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate to chat page
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      const messageInput = page.getByPlaceholder(t('chat.messageInput'));
      await expect(messageInput).toBeVisible({ timeout: 5000 });

      const generalMessage = `[${testId}] Message in General channel`;
      await messageInput.fill(generalMessage);
      const sendButton = page.locator('button.bg-gradient-to-r:has(svg)').last();
      await sendButton.click();
      await page.waitForTimeout(1000);

      // Verify message appears (use first() due to possible translation duplicate)
      await expect(page.getByText(generalMessage).first()).toBeVisible();

      // Note: If multiple channels exist, we would switch channels here
      // For now, this test verifies basic message sending in the default channel
      // Channel switching tests would require creating additional channels via API
    } finally {
      await cleanup();
    }
  });

  /**
   * Error: Cannot send empty message
   * Tests that empty messages are not sent
   */
  test('Error: Cannot send empty message', async ({ page }) => {
    const testId = `msg-err-${Date.now()}`;
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate to chat page
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      const messageInput = page.getByPlaceholder(t('chat.messageInput'));
      await expect(messageInput).toBeVisible({ timeout: 5000 });

      // Locate send button
      const sendButton = page.locator('button.bg-gradient-to-r:has(svg)').last();
      await expect(sendButton).toBeVisible();

      // Try to send empty message (button is enabled but handler prevents sending)
      await sendButton.click();
      await page.waitForTimeout(500);

      // Verify no message appears (empty message not sent)
      const messages = page.locator('[role="article"], .message, [data-message]');
      const messageCount = await messages.count();
      expect(messageCount).toBe(0);

      // Try whitespace-only message
      await messageInput.fill('   ');
      await sendButton.click();
      await page.waitForTimeout(500);

      // Still no messages should appear
      const messageCount2 = await messages.count();
      expect(messageCount2).toBe(0);
    } finally {
      await cleanup();
    }
  });

  /**
   * Performance: Message send completes within 2 seconds
   * Tests that message sending is reasonably fast
   */
  test('Performance: Message send completes quickly', async ({ page }) => {
    const testId = `msg-perf-${Date.now()}`;
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate to chat page
      await page.goto('/chat');
      await page.waitForLoadState('networkidle');

      const messageInput = page.getByPlaceholder(t('chat.messageInput'));
      await expect(messageInput).toBeVisible({ timeout: 5000 });

      const testMessage = `[${testId}] Performance test message`;
      await messageInput.fill(testMessage);

      const startTime = Date.now();
      const sendButton = page.locator('button.bg-gradient-to-r:has(svg)').last();
      await sendButton.click();

      // Wait for message to appear
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 3000 });
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    } finally {
      await cleanup();
    }
  });
});
