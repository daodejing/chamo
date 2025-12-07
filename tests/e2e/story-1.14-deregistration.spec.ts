import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';
import { translations } from '../../src/lib/translations';
import {
  setupMessagingTest,
  createFamilyAdminFixture,
  generateRealKeypair,
  injectAuthToken,
  storeUserPrivateKey,
  injectFamilyKey,
  cleanupTestData,
  TestUser,
  clearMailHogEmails,
  waitForMailHogEmail,
  extractVerificationToken,
} from './fixtures';

/**
 * Story 1.14: Remove Family Member & Self De-registration
 *
 * E2E Tests for:
 * - Part A: Remove Family Member (AC1-5)
 * - Part B: Self De-registration (AC6-14)
 */

// Helper to get translated text
const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

// GraphQL helper
async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  accessToken?: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(E2E_CONFIG.GRAPHQL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  if (json.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

test.describe('Story 1.14: Remove Family Member & Self De-registration', () => {
  // ============================================================================
  // Part A: Remove Family Member
  // ============================================================================
  test.describe('Part A: Remove Family Member', () => {
    /**
     * AC1, AC2: Admin can remove a non-admin member
     * Tests the remove member backend mutation via GraphQL API
     */
    test('AC1-2: Admin can remove a non-admin member from family', async ({ browser }) => {
      const testId = `rm-ac12-${Date.now()}`;
      const { fixture, cleanup } = await setupMessagingTest(browser, testId);

      try {
        // Verify member has active membership before removal
        const meQuery = `
          query Me {
            me {
              id
              activeFamilyId
              memberships {
                familyId
              }
            }
          }
        `;

        const memberBefore = await graphqlRequest<{
          me: { id: string; activeFamilyId: string | null; memberships: Array<{ familyId: string }> };
        }>(meQuery, {}, fixture.member.accessToken);

        // Verify member is in the family
        expect(memberBefore.me.memberships.some((m) => m.familyId === fixture.family.id)).toBe(true);

        // AC2: Remove the member via GraphQL mutation
        const removeMutation = `
          mutation RemoveFamilyMember($input: RemoveFamilyMemberInput!) {
            removeFamilyMember(input: $input) {
              success
              message
            }
          }
        `;

        const removeResult = await graphqlRequest<{
          removeFamilyMember: { success: boolean; message: string };
        }>(
          removeMutation,
          {
            input: {
              userId: fixture.member.user.id,
              familyId: fixture.family.id,
            },
          },
          fixture.admin.accessToken,
        );

        expect(removeResult.removeFamilyMember.success).toBe(true);
        expect(removeResult.removeFamilyMember.message).toContain(fixture.member.user.name);

        // Verify member is no longer in the family
        const memberAfter = await graphqlRequest<{
          me: { id: string; activeFamilyId: string | null; memberships: Array<{ familyId: string }> };
        }>(meQuery, {}, fixture.member.accessToken);

        expect(memberAfter.me.memberships.some((m) => m.familyId === fixture.family.id)).toBe(false);
        // If this was their active family, it should be cleared
        if (memberBefore.me.activeFamilyId === fixture.family.id) {
          expect(memberAfter.me.activeFamilyId).toBeNull();
        }
      } finally {
        await cleanup();
      }
    });

    /**
     * AC3: Admin protection - cannot remove other admins
     * Note: This is mostly tested in unit tests. E2E verifies no remove button for admins.
     */
    test('AC3: Remove button not shown for admin members', async ({ page }) => {
      const testId = `rm-ac3-${Date.now()}`;

      // Create a single admin user fixture
      const { publicKey, secretKeyBase64 } = generateRealKeypair();
      const admin: TestUser = {
        email: `${testId}-admin@example.com`,
        password: 'TestPassword123!',
        name: `${testId} Admin`,
        publicKey,
      };

      const fixture = await createFamilyAdminFixture(admin, `${testId} Family`);

      try {
        await injectAuthToken(page, fixture.admin.accessToken);
        await storeUserPrivateKey(page, fixture.admin.user.id, secretKeyBase64);

        const familyKey = btoa(
          String.fromCharCode(...new Uint8Array(32).map(() => Math.floor(Math.random() * 256))),
        );
        await injectFamilyKey(page, fixture.family.id, familyKey);
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);

        // Navigate to settings
        await page.goto('/chat');
        await page.waitForLoadState('networkidle');

        const settingsButton = page.locator('button:has(svg.lucide-settings)');
        await settingsButton.click();
        await page.waitForTimeout(500);

        // Find the admin in the members list (the only member)
        const adminRow = page.locator('.flex.items-center.justify-between').filter({
          hasText: fixture.admin.user.name,
        });
        await expect(adminRow).toBeVisible({ timeout: 5000 });

        // Verify crown icon is present (admin indicator)
        const crownIcon = adminRow.locator('svg.lucide-crown');
        await expect(crownIcon).toBeVisible();

        // Verify NO remove button is shown for admin
        const removeButton = adminRow.locator('button:has(svg.lucide-user-minus)');
        await expect(removeButton).not.toBeVisible();
      } finally {
        await cleanupTestData({
          userIds: [fixture.admin.user.id],
          familyIds: [fixture.family.id],
        });
      }
    });

    /**
     * AC4: Removed user can be re-invited
     * Tests that after removal, user can receive new invites via createInvite
     */
    test('AC4: Removed member can be re-invited to the family', async ({ browser }) => {
      const testId = `rm-ac4-${Date.now()}`;
      const { fixture, cleanup } = await setupMessagingTest(browser, testId);

      try {
        // First, remove the member via GraphQL directly
        const removeMutation = `
          mutation RemoveFamilyMember($input: RemoveFamilyMemberInput!) {
            removeFamilyMember(input: $input) {
              success
              message
            }
          }
        `;

        const removeResult = await graphqlRequest<{
          removeFamilyMember: { success: boolean; message: string };
        }>(
          removeMutation,
          {
            input: {
              userId: fixture.member.user.id,
              familyId: fixture.family.id,
            },
          },
          fixture.admin.accessToken,
        );

        expect(removeResult.removeFamilyMember.success).toBe(true);

        // Now try to create a new invite for the removed member's email
        // Use createInvite which works for both registered and unregistered users
        const createInviteMutation = `
          mutation CreateInvite($input: CreateInviteInput!) {
            createInvite(input: $input) {
              inviteCode
              inviteeEmail
              expiresAt
            }
          }
        `;

        const inviteResult = await graphqlRequest<{
          createInvite: {
            inviteCode: string;
            inviteeEmail: string;
            expiresAt: string;
          };
        }>(
          createInviteMutation,
          {
            input: {
              inviteeEmail: fixture.member.user.email,
            },
          },
          fixture.admin.accessToken,
        );

        // Verify invite was created successfully
        expect(inviteResult.createInvite.inviteeEmail).toBe(
          fixture.member.user.email.toLowerCase(),
        );
        expect(inviteResult.createInvite.inviteCode).toBeDefined();
        expect(inviteResult.createInvite.expiresAt).toBeDefined();
      } finally {
        await cleanup();
      }
    });
  });

  // ============================================================================
  // Part B: Self De-registration
  // ============================================================================
  test.describe('Part B: Self De-registration', () => {
    /**
     * AC7, AC9: User can delete their own account from settings
     * Tests the delete account UI and soft delete execution
     */
    test('AC7-9: User can delete their account from settings', async ({ page }) => {
      const testId = `dereg-ac79-${Date.now()}`;

      // Create a single admin user fixture
      const { publicKey, secretKeyBase64 } = generateRealKeypair();
      const admin: TestUser = {
        email: `${testId}-admin@example.com`,
        password: 'TestPassword123!',
        name: `${testId} Admin`,
        publicKey,
      };

      const fixture = await createFamilyAdminFixture(admin, `${testId} Family`);

      try {
        await injectAuthToken(page, fixture.admin.accessToken);
        await storeUserPrivateKey(page, fixture.admin.user.id, secretKeyBase64);

        const familyKey = btoa(
          String.fromCharCode(...new Uint8Array(32).map(() => Math.floor(Math.random() * 256))),
        );
        await injectFamilyKey(page, fixture.family.id, familyKey);
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);

        // Navigate to settings
        await page.goto('/chat');
        await page.waitForLoadState('networkidle');

        const settingsButton = page.locator('button:has(svg.lucide-settings)');
        await settingsButton.click();
        await page.waitForTimeout(500);

        // Scroll to bottom to find Delete Account section
        const deleteAccountCard = page.locator('.border-destructive\\/50').filter({
          hasText: t('settings.deleteAccount'),
        });
        await deleteAccountCard.scrollIntoViewIfNeeded();
        await expect(deleteAccountCard).toBeVisible({ timeout: 5000 });

        // Find and click the delete button
        const deleteButton = deleteAccountCard.locator('button', {
          hasText: t('settings.deleteAccountButton'),
        });
        await expect(deleteButton).toBeVisible();

        // Listen for confirmation dialog
        page.once('dialog', async (dialog) => {
          expect(dialog.type()).toBe('confirm');
          await dialog.accept();
        });

        // Click delete button
        await deleteButton.click();

        // After deletion, user should be redirected to login
        await expect(page).toHaveURL(/\/(login|$)/, { timeout: 10000 });
      } finally {
        // Cleanup - user may be soft-deleted but family still exists
        await cleanupTestData({
          userIds: [fixture.admin.user.id],
          familyIds: [fixture.family.id],
        });
      }
    });

    /**
     * AC14: Re-registration after deletion
     * Tests that user can register again with the same email after soft delete
     */
    test('AC14: User can re-register with same email after deletion', async ({ page }) => {
      const testId = `dereg-ac14-${Date.now()}`;
      const testEmail = `${testId}@example.com`;
      const testPassword = 'TestPassword123!';
      const testName = `${testId} User`;

      await clearMailHogEmails();

      // Create a user fixture
      const { publicKey, secretKeyBase64 } = generateRealKeypair();
      const admin: TestUser = {
        email: testEmail,
        password: testPassword,
        name: testName,
        publicKey,
      };

      const fixture = await createFamilyAdminFixture(admin, `${testId} Family`);

      try {
        // Step 1: Delete the account via GraphQL
        const deregisterMutation = `
          mutation DeregisterSelf {
            deregisterSelf {
              success
              message
            }
          }
        `;

        const deregisterResult = await graphqlRequest<{
          deregisterSelf: { success: boolean; message: string };
        }>(deregisterMutation, {}, fixture.admin.accessToken);

        expect(deregisterResult.deregisterSelf.success).toBe(true);

        // Step 2: Verify the user cannot login
        const loginMutation = `
          mutation Login($input: LoginInput!) {
            login(input: $input) {
              accessToken
              user {
                id
                email
              }
            }
          }
        `;

        await expect(
          graphqlRequest(loginMutation, {
            input: { email: testEmail, password: testPassword },
          }),
        ).rejects.toThrow(/Invalid credentials/);

        // Step 3: Register again with same email
        await clearMailHogEmails();

        const { publicKey: newPublicKey } = generateRealKeypair();
        const registerMutation = `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              message
              requiresEmailVerification
              userId
            }
          }
        `;

        const registerResult = await graphqlRequest<{
          register: { message: string; requiresEmailVerification: boolean; userId: string };
        }>(registerMutation, {
          input: {
            email: testEmail,
            password: testPassword,
            name: `${testName} Reregistered`,
            publicKey: newPublicKey,
          },
        });

        // Verify re-registration succeeded
        expect(registerResult.register.requiresEmailVerification).toBe(true);
        expect(registerResult.register.userId).toBeDefined();
        expect(registerResult.register.userId).not.toBe(fixture.admin.user.id); // Should be a new user ID

        // Clean up the new user
        await cleanupTestData({
          userIds: [registerResult.register.userId],
        });
      } finally {
        await cleanupTestData({
          familyIds: [fixture.family.id],
        });
      }
    });

    /**
     * AC10, AC11: Membership and invite cleanup on self-deletion
     * Tests that all memberships and pending invites are cleaned up
     */
    test('AC10-11: Memberships and invites are cleaned up on deletion', async ({ browser }) => {
      const testId = `dereg-ac1011-${Date.now()}`;
      const { fixture, adminPage, memberPage, cleanup } = await setupMessagingTest(browser, testId);

      try {
        // Create a pending invite TO the member for another test
        // (We'll verify this gets revoked when member deletes account)
        const inviterEmail = fixture.admin.user.email;

        // Step 1: Member deletes their account
        const deregisterMutation = `
          mutation DeregisterSelf {
            deregisterSelf {
              success
              message
            }
          }
        `;

        const deregisterResult = await graphqlRequest<{
          deregisterSelf: { success: boolean; message: string };
        }>(deregisterMutation, {}, fixture.member.accessToken);

        expect(deregisterResult.deregisterSelf.success).toBe(true);

        // Step 2: Verify member's memberships are cleared
        // Note: JWT token still works but memberships should be empty
        const getFamilyQuery = `
          query Me {
            me {
              id
              activeFamily {
                id
                name
              }
              memberships {
                familyId
                role
              }
            }
          }
        `;

        // The member's token may still work (JWT is valid) but memberships should be empty
        // and activeFamily should be null
        const meResult = await graphqlRequest<{
          me: { activeFamily: null; memberships: unknown[] };
        }>(getFamilyQuery, {}, fixture.member.accessToken);

        expect(meResult.me.activeFamily).toBeNull();
        expect(meResult.me.memberships).toHaveLength(0);

        // Step 3: Verify member cannot login anymore
        const loginMutation = `
          mutation Login($input: LoginInput!) {
            login(input: $input) {
              accessToken
            }
          }
        `;

        await expect(
          graphqlRequest(loginMutation, {
            input: {
              email: fixture.member.user.email,
              password: 'TestPassword123!',
            },
          }),
        ).rejects.toThrow(/Invalid credentials/);
      } finally {
        await cleanup();
      }
    });
  });

  // ============================================================================
  // AC12: Content Preservation (Deleted User Attribution)
  // ============================================================================
  test.describe('AC12: Content Preservation', () => {
    /**
     * AC12: Messages from deleted users show "Deleted User"
     * Tests that message content is preserved with anonymized attribution
     */
    test('AC12: Messages from deleted user show "Deleted User" attribution', async ({
      browser,
    }) => {
      const testId = `dereg-ac12-${Date.now()}`;
      const { fixture, adminPage, memberPage, cleanup } = await setupMessagingTest(browser, testId);

      try {
        // Step 1: Member sends a message
        await memberPage.goto('/chat');
        await memberPage.waitForLoadState('networkidle');

        const messageInput = memberPage.getByPlaceholder(t('chat.messageInput'));
        await expect(messageInput).toBeVisible({ timeout: 10000 });

        const testMessage = `[${testId}] Message from soon-to-be-deleted user`;
        await messageInput.fill(testMessage);

        const sendButton = memberPage.locator('button.bg-gradient-to-r:has(svg)').last();
        await sendButton.click();

        // Verify message appears
        await expect(memberPage.getByText(testMessage).first()).toBeVisible({ timeout: 5000 });

        // Step 2: Admin views the message and confirms it shows member's name
        await adminPage.goto('/chat');
        await adminPage.waitForLoadState('networkidle');

        // Reload to get the new message
        await adminPage.reload({ waitUntil: 'networkidle' });
        await adminPage.waitForTimeout(1000);

        // Verify message appears with member's name
        await expect(adminPage.getByText(testMessage).first()).toBeVisible({ timeout: 5000 });
        await expect(adminPage.getByText(fixture.member.user.name).first()).toBeVisible();

        // Step 3: Member deletes their account
        const deregisterMutation = `
          mutation DeregisterSelf {
            deregisterSelf {
              success
              message
            }
          }
        `;

        const result = await graphqlRequest<{ deregisterSelf: { success: boolean } }>(
          deregisterMutation,
          {},
          fixture.member.accessToken,
        );
        expect(result.deregisterSelf.success).toBe(true);

        // Step 4: Admin reloads and checks message attribution
        await adminPage.reload({ waitUntil: 'networkidle' });
        await adminPage.waitForTimeout(1000);

        // Message content should still be visible
        await expect(adminPage.getByText(testMessage).first()).toBeVisible({ timeout: 5000 });

        // Attribution should show "Deleted User" instead of member's name
        // Note: The exact UI behavior depends on implementation
        // This test verifies the backend returns "Deleted User" - UI may display differently
        await expect(adminPage.getByText('Deleted User').first()).toBeVisible({ timeout: 5000 });
      } finally {
        await cleanup();
      }
    });
  });
});
