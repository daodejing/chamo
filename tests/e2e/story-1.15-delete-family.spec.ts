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
} from './fixtures';

/**
 * Story 1.15: Delete Family E2E Tests
 *
 * Tests for Part C: Delete Family (AC9-AC13)
 * - AC9: Delete Family Option
 * - AC10: Delete Confirmation
 * - AC11: Family Soft Delete
 * - AC12: Cascade Effects (remove memberships, clear activeFamilyId)
 * - AC13: After Family Delete, admin can delete their account
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

test.describe('Story 1.15: Delete Family', () => {
  // ============================================================================
  // AC9, AC10, AC11: Delete Family Mutation
  // ============================================================================
  test.describe('Delete Family via GraphQL API', () => {
    /**
     * AC9, AC10, AC11: Admin can delete a family
     * Tests the deleteFamily backend mutation via GraphQL API
     */
    test('AC9-11: Admin can delete a family via GraphQL mutation', async ({ browser }) => {
      const testId = `del-fam-${Date.now()}`;
      const { fixture, cleanup } = await setupMessagingTest(browser, testId);

      try {
        // Verify family exists and has members before deletion
        const meQuery = `
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

        const adminBefore = await graphqlRequest<{
          me: {
            id: string;
            activeFamily: { id: string; name: string } | null;
            memberships: Array<{ familyId: string; role: string }>;
          };
        }>(meQuery, {}, fixture.admin.accessToken);

        expect(adminBefore.me.activeFamily?.id).toBe(fixture.family.id);
        expect(adminBefore.me.memberships.some((m) => m.familyId === fixture.family.id)).toBe(true);

        // AC11: Delete the family via GraphQL mutation
        const deleteFamilyMutation = `
          mutation DeleteFamily($input: DeleteFamilyInput!) {
            deleteFamily(input: $input) {
              success
              message
            }
          }
        `;

        const deleteResult = await graphqlRequest<{
          deleteFamily: { success: boolean; message: string };
        }>(
          deleteFamilyMutation,
          { input: { familyId: fixture.family.id } },
          fixture.admin.accessToken,
        );

        expect(deleteResult.deleteFamily.success).toBe(true);
        expect(deleteResult.deleteFamily.message).toContain(fixture.family.name);

        // Verify admin no longer has the family in their memberships
        const adminAfter = await graphqlRequest<{
          me: {
            id: string;
            activeFamily: { id: string; name: string } | null;
            memberships: Array<{ familyId: string; role: string }>;
          };
        }>(meQuery, {}, fixture.admin.accessToken);

        expect(adminAfter.me.activeFamily).toBeNull();
        expect(adminAfter.me.memberships.some((m) => m.familyId === fixture.family.id)).toBe(false);
      } finally {
        // Cleanup - family may be soft-deleted but test data cleanup handles it
        await cleanup();
      }
    });

    /**
     * AC11: Non-admin cannot delete a family
     * Tests that only admins can delete a family
     */
    test('AC11: Non-admin cannot delete a family', async ({ browser }) => {
      const testId = `del-fam-nonadmin-${Date.now()}`;
      const { fixture, cleanup } = await setupMessagingTest(browser, testId);

      try {
        // Member tries to delete the family
        const deleteFamilyMutation = `
          mutation DeleteFamily($input: DeleteFamilyInput!) {
            deleteFamily(input: $input) {
              success
              message
            }
          }
        `;

        // Should throw an error - member is not admin
        await expect(
          graphqlRequest(
            deleteFamilyMutation,
            { input: { familyId: fixture.family.id } },
            fixture.member.accessToken,
          ),
        ).rejects.toThrow(/admin/i);
      } finally {
        await cleanup();
      }
    });

    /**
     * AC11: Cannot delete an already deleted family
     * Tests idempotency protection
     * Note: After deletion, admin loses membership so they get "not admin" error
     */
    test('AC11: Cannot delete an already deleted family', async ({ browser }) => {
      const testId = `del-fam-twice-${Date.now()}`;
      const { fixture, cleanup } = await setupMessagingTest(browser, testId);

      try {
        const deleteFamilyMutation = `
          mutation DeleteFamily($input: DeleteFamilyInput!) {
            deleteFamily(input: $input) {
              success
              message
            }
          }
        `;

        // First deletion should succeed
        const firstDelete = await graphqlRequest<{
          deleteFamily: { success: boolean; message: string };
        }>(
          deleteFamilyMutation,
          { input: { familyId: fixture.family.id } },
          fixture.admin.accessToken,
        );
        expect(firstDelete.deleteFamily.success).toBe(true);

        // Second deletion should fail
        // After family is deleted, admin loses membership, so they get "not admin" error
        // This is correct behavior - they can no longer act on a deleted family
        await expect(
          graphqlRequest(
            deleteFamilyMutation,
            { input: { familyId: fixture.family.id } },
            fixture.admin.accessToken,
          ),
        ).rejects.toThrow(/admin|not found|forbidden/i);
      } finally {
        await cleanup();
      }
    });
  });

  // ============================================================================
  // AC12: Cascade Effects
  // ============================================================================
  test.describe('AC12: Cascade Effects', () => {
    /**
     * AC12: Member's activeFamilyId is cleared when family is deleted
     */
    test('AC12: Member activeFamilyId is cleared when family is deleted', async ({ browser }) => {
      const testId = `del-fam-cascade-${Date.now()}`;
      const { fixture, cleanup } = await setupMessagingTest(browser, testId);

      try {
        // Verify member has activeFamilyId set
        const meQuery = `
          query Me {
            me {
              id
              activeFamilyId
              memberships {
                familyId
                role
              }
            }
          }
        `;

        const memberBefore = await graphqlRequest<{
          me: { id: string; activeFamilyId: string | null; memberships: Array<{ familyId: string }> };
        }>(meQuery, {}, fixture.member.accessToken);

        expect(memberBefore.me.activeFamilyId).toBe(fixture.family.id);
        expect(memberBefore.me.memberships.some((m) => m.familyId === fixture.family.id)).toBe(true);

        // Admin deletes the family
        const deleteFamilyMutation = `
          mutation DeleteFamily($input: DeleteFamilyInput!) {
            deleteFamily(input: $input) {
              success
              message
            }
          }
        `;

        const deleteResult = await graphqlRequest<{
          deleteFamily: { success: boolean; message: string };
        }>(
          deleteFamilyMutation,
          { input: { familyId: fixture.family.id } },
          fixture.admin.accessToken,
        );
        expect(deleteResult.deleteFamily.success).toBe(true);

        // Verify member's activeFamilyId is now null and membership removed
        const memberAfter = await graphqlRequest<{
          me: { id: string; activeFamilyId: string | null; memberships: Array<{ familyId: string }> };
        }>(meQuery, {}, fixture.member.accessToken);

        expect(memberAfter.me.activeFamilyId).toBeNull();
        expect(memberAfter.me.memberships.some((m) => m.familyId === fixture.family.id)).toBe(false);
      } finally {
        await cleanup();
      }
    });

    /**
     * AC12: Admin's activeFamilyId is cleared when family is deleted
     */
    test('AC12: Admin activeFamilyId is cleared when they delete the family', async ({ browser }) => {
      const testId = `del-fam-admin-${Date.now()}`;
      const { fixture, cleanup } = await setupMessagingTest(browser, testId);

      try {
        // Verify admin has activeFamilyId set
        const meQuery = `
          query Me {
            me {
              id
              activeFamilyId
              memberships {
                familyId
                role
              }
            }
          }
        `;

        const adminBefore = await graphqlRequest<{
          me: { id: string; activeFamilyId: string | null; memberships: Array<{ familyId: string }> };
        }>(meQuery, {}, fixture.admin.accessToken);

        expect(adminBefore.me.activeFamilyId).toBe(fixture.family.id);

        // Admin deletes the family
        const deleteFamilyMutation = `
          mutation DeleteFamily($input: DeleteFamilyInput!) {
            deleteFamily(input: $input) {
              success
              message
            }
          }
        `;

        await graphqlRequest(
          deleteFamilyMutation,
          { input: { familyId: fixture.family.id } },
          fixture.admin.accessToken,
        );

        // Verify admin's activeFamilyId is now null
        const adminAfter = await graphqlRequest<{
          me: { id: string; activeFamilyId: string | null; memberships: Array<{ familyId: string }> };
        }>(meQuery, {}, fixture.admin.accessToken);

        expect(adminAfter.me.activeFamilyId).toBeNull();
        expect(adminAfter.me.memberships.some((m) => m.familyId === fixture.family.id)).toBe(false);
      } finally {
        await cleanup();
      }
    });

    /**
     * AC12: Pending invites are revoked when family is deleted
     */
    test('AC12: Pending invites are revoked when family is deleted', async ({ browser }) => {
      const testId = `del-fam-invites-${Date.now()}`;
      const { fixture, cleanup } = await setupMessagingTest(browser, testId);

      try {
        // Create a pending invite
        const createInviteMutation = `
          mutation CreateInvite($input: CreateInviteInput!) {
            createInvite(input: $input) {
              inviteCode
              inviteeEmail
            }
          }
        `;

        const inviteResult = await graphqlRequest<{
          createInvite: { inviteCode: string; inviteeEmail: string };
        }>(
          createInviteMutation,
          { input: { inviteeEmail: `${testId}-pending@example.com` } },
          fixture.admin.accessToken,
        );

        const inviteCode = inviteResult.createInvite.inviteCode;
        expect(inviteCode).toBeDefined();

        // Delete the family
        const deleteFamilyMutation = `
          mutation DeleteFamily($input: DeleteFamilyInput!) {
            deleteFamily(input: $input) {
              success
              message
            }
          }
        `;

        await graphqlRequest(
          deleteFamilyMutation,
          { input: { familyId: fixture.family.id } },
          fixture.admin.accessToken,
        );

        // Verify invite code is no longer valid by trying to accept it
        // This should fail since the invite was revoked when family was deleted
        const acceptInviteMutation = `
          mutation AcceptInvite($input: AcceptInviteInput!) {
            acceptInvite(input: $input) {
              success
              familyId
            }
          }
        `;

        await expect(
          graphqlRequest(
            acceptInviteMutation,
            { input: { inviteCode } },
            fixture.member.accessToken,
          ),
        ).rejects.toThrow(/revoked|invalid|expired|not found/i);
      } finally {
        await cleanup();
      }
    });
  });

  // ============================================================================
  // AC13: After Family Delete - Admin Can Delete Account
  // ============================================================================
  test.describe('AC13: After Family Delete', () => {
    /**
     * AC13: After deleting family, admin can delete their account
     */
    test('AC13: Admin can delete account after deleting their family', async () => {
      const testId = `del-fam-then-acct-${Date.now()}`;

      // Create a single admin fixture (no other members)
      const { publicKey, secretKeyBase64 } = generateRealKeypair();
      const admin: TestUser = {
        email: `${testId}-admin@example.com`,
        password: 'TestPassword123!',
        name: `${testId} Admin`,
        publicKey,
      };

      const fixture = await createFamilyAdminFixture(admin, `${testId} Family`);

      try {
        // Step 1: Delete the family
        const deleteFamilyMutation = `
          mutation DeleteFamily($input: DeleteFamilyInput!) {
            deleteFamily(input: $input) {
              success
              message
            }
          }
        `;

        const deleteResult = await graphqlRequest<{
          deleteFamily: { success: boolean; message: string };
        }>(
          deleteFamilyMutation,
          { input: { familyId: fixture.family.id } },
          fixture.admin.accessToken,
        );
        expect(deleteResult.deleteFamily.success).toBe(true);

        // Step 2: Verify admin can now delete their account
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

        // Step 3: Verify user cannot login anymore
        const loginMutation = `
          mutation Login($input: LoginInput!) {
            login(input: $input) {
              accessToken
            }
          }
        `;

        await expect(
          graphqlRequest(loginMutation, {
            input: { email: admin.email, password: admin.password },
          }),
        ).rejects.toThrow(/Invalid credentials/);
      } finally {
        // Cleanup any remaining data
        await cleanupTestData({
          userIds: [fixture.admin.user.id],
          familyIds: [fixture.family.id],
        });
      }
    });
  });

  // ============================================================================
  // UI Tests
  // ============================================================================
  test.describe('Delete Family UI', () => {
    /**
     * Delete family via LastAdminModal in settings
     * Tests the UI flow for deleting a family
     */
    test.skip('Admin can delete family via LastAdminModal', async ({ page }) => {
      // Note: This test is skipped until the LastAdminModal UI is fully implemented
      // The modal is triggered when the last admin tries to delete their account
      const testId = `del-fam-ui-${Date.now()}`;

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

        // Find Delete Account section and click delete button
        const deleteAccountCard = page.locator('.border-destructive\\/50').filter({
          hasText: t('settings.deleteAccount'),
        });
        await deleteAccountCard.scrollIntoViewIfNeeded();

        const deleteButton = deleteAccountCard.locator('button', {
          hasText: t('settings.deleteAccountButton'),
        });

        // This should trigger LastAdminModal since user is the only admin
        await deleteButton.click();

        // Verify LastAdminModal appears
        const modal = page.locator('[role="dialog"]');
        await expect(modal).toBeVisible({ timeout: 5000 });
        await expect(modal.getByText(fixture.family.name)).toBeVisible();

        // Click delete family option
        const deleteFamilyButton = modal.locator('button').filter({
          hasText: /delete.*family/i,
        });
        await deleteFamilyButton.click();

        // Confirm deletion
        page.once('dialog', async (dialog) => {
          await dialog.accept();
        });

        // Verify redirect to login after family and account deletion
        await expect(page).toHaveURL(/\/(login|$)/, { timeout: 10000 });
      } finally {
        await cleanupTestData({
          userIds: [fixture.admin.user.id],
          familyIds: [fixture.family.id],
        });
      }
    });
  });
});
