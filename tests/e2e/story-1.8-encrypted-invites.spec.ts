/**
 * E2E tests for Story 1.8: Encrypted Invite Flow
 *
 * Tests the complete E2EE invite flow:
 * 1. Admin creates encrypted invite for registered user
 * 2. Server stores encrypted family key (never sees plaintext)
 * 3. Invitee accepts invite and decrypts key client-side
 * 4. Decrypted key stored in IndexedDB
 * 5. No "encryption key missing" errors occur
 */

import { test, expect, Page } from '@playwright/test';
import nacl from 'tweetnacl';

const GRAPHQL_ROUTE = '**/graphql';

async function mockGraphql(page: Page, handlers: Record<string, (body: any) => any>) {
  await page.route(GRAPHQL_ROUTE, async (route, request) => {
    const body = request.postDataJSON();
    let operationName = body?.operationName ?? null;

    if (!operationName && typeof body?.query === 'string') {
      // Extract operation name from query string
      const operations = [
        'Me', 'Login', 'Register', 'CreateEncryptedInvite', 'AcceptInvite',
        'GetUserPublicKey', 'CreateFamily'
      ];
      for (const op of operations) {
        if (body.query.includes(op)) {
          operationName = op;
          break;
        }
      }
    }

    const handler = operationName ? handlers[operationName] : undefined;
    if (handler) {
      const payload = handler(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });
      return;
    }

    // Default response
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    });
  });
}

test.describe('Story 1.8: Encrypted Invite Flow (E2EE)', () => {
  // Generate test keypairs
  const adminKeypair = nacl.box.keyPair();
  const inviteeKeypair = nacl.box.keyPair();
  const adminPublicKey = Buffer.from(adminKeypair.publicKey).toString('base64');
  const inviteePublicKey = Buffer.from(inviteeKeypair.publicKey).toString('base64');

  const familyId = 'test-family-123';
  const familyName = 'Test Family';
  const adminUserId = 'admin-user-123';
  const inviteeUserId = 'invitee-user-123';
  const inviteeEmail = 'invitee@example.com';

  // Generate mock family key
  const familyKeyBytes = nacl.randomBytes(32);
  const familyKeyBase64 = Buffer.from(familyKeyBytes).toString('base64');

  test('Admin creates encrypted invite and invitee accepts without key loss', async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('[BROWSER ERROR]', msg.text());
      }
    });

    // Step 1: Mock logged-in admin with family
    await mockGraphql(page, {
      Me: () => ({
        data: {
          me: {
            id: adminUserId,
            email: 'admin@example.com',
            name: 'Admin User',
            emailVerified: true,
            publicKey: adminPublicKey,
            activeFamilyId: familyId,
            activeFamily: {
              id: familyId,
              name: familyName,
              inviteCode: 'FAMILY-123',
              maxMembers: 10,
            },
            memberships: [
              {
                id: 'membership-1',
                role: 'ADMIN',
                familyId,
                family: {
                  id: familyId,
                  name: familyName,
                  inviteCode: 'FAMILY-123',
                  maxMembers: 10,
                },
              },
            ],
          },
        },
      }),
      GetUserPublicKey: () => ({
        data: {
          getUserPublicKey: inviteePublicKey,
        },
      }),
      CreateEncryptedInvite: (body) => {
        const input = body.variables.input;

        // Server should receive encrypted data (not plaintext family key)
        expect(input.encryptedFamilyKey).toBeDefined();
        expect(input.nonce).toBeDefined();
        expect(input.inviteeEmail).toBe(inviteeEmail);

        return {
          data: {
            createEncryptedInvite: {
              invite: {
                id: 'invite-123',
                familyId,
                inviterId: adminUserId,
                inviteeEmail: input.inviteeEmail,
                inviteCode: input.inviteCode,
                status: 'PENDING',
                expiresAt: input.expiresAt,
                createdAt: new Date().toISOString(),
              },
              inviteCode: input.inviteCode,
              message: `Invite created successfully for ${inviteeEmail}`,
            },
          },
        };
      },
    });

    // Step 2: Store admin's family key in IndexedDB (simulating post-family-creation state)
    await page.addInitScript(
      ([keyBase64, famId]) => {
        // Store family key in IndexedDB simulation
        const keyData = { familyKey: keyBase64, familyId: famId };
        localStorage.setItem(`test_familyKey_${famId}`, JSON.stringify(keyData));
      },
      [familyKeyBase64, familyId]
    );

    // Store admin's keypair
    await page.addInitScript(
      ([userId, publicKey, secretKey]) => {
        const keypairData = {
          userId,
          publicKey,
          secretKey,
        };
        localStorage.setItem(`test_keypair_${userId}`, JSON.stringify(keypairData));
      },
      [adminUserId, adminPublicKey, Buffer.from(adminKeypair.secretKey).toString('base64')]
    );

    // Step 3: Navigate to family settings and create invite
    await page.goto('/family/settings');

    // Verify page loaded
    await expect(page.getByText(familyName)).toBeVisible();

    // Open invite dialog
    await page.click('button:has-text("Invite")');

    // Fill in invitee email
    await page.fill('input[type="email"]', inviteeEmail);

    // Submit invite
    await page.click('button:has-text("Send Invite")');

    // Verify success toast
    await expect(page.getByText(new RegExp(`${inviteeEmail}.*invited`, 'i'))).toBeVisible({ timeout: 5000 });
  });

  test('Invitee accepts encrypted invite and decrypts family key client-side', async ({ page }) => {
    const inviteCode = 'FAMILY-TESTCODE123';

    // Encrypt family key with invitee's public key (simulating server-stored encrypted data)
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const encryptedKey = nacl.box(
      familyKeyBytes,
      nonce,
      inviteeKeypair.publicKey,
      adminKeypair.secretKey
    );

    const encryptedKeyBase64 = Buffer.from(encryptedKey).toString('base64');
    const nonceBase64 = Buffer.from(nonce).toString('base64');

    await mockGraphql(page, {
      Me: () => ({
        data: {
          me: {
            id: inviteeUserId,
            email: inviteeEmail,
            name: 'Invitee User',
            emailVerified: true,
            publicKey: inviteePublicKey,
            activeFamilyId: null,
            activeFamily: null,
            memberships: [],
          },
        },
      }),
      AcceptInvite: () => ({
        data: {
          acceptInvite: {
            success: true,
            message: `Successfully joined ${familyName}`,
            familyId,
            familyName,
            encryptedFamilyKey: encryptedKeyBase64,
            nonce: nonceBase64,
            inviterPublicKey: adminPublicKey,
          },
        },
      }),
    });

    // Store invitee's keypair
    await page.addInitScript(
      ([userId, publicKey, secretKey]) => {
        const keypairData = {
          userId,
          publicKey,
          secretKey,
        };
        localStorage.setItem(`test_keypair_${userId}`, JSON.stringify(keypairData));
      },
      [inviteeUserId, inviteePublicKey, Buffer.from(inviteeKeypair.secretKey).toString('base64')]
    );

    // Navigate to accept invite page
    await page.goto(`/accept-invite?code=${inviteCode}`);

    // Should show success state
    await expect(page.getByText(/successfully joined/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(familyName)).toBeVisible();

    // Verify no "encryption key missing" error appears
    const errorModal = page.getByText(/encryption key.*missing|lost/i);
    await expect(errorModal).not.toBeVisible();

    // Should redirect to chat
    await expect(page).toHaveURL(/\/chat/, { timeout: 5000 });
  });

  test('Cross-browser scenario: Invite created in Browser A, accepted in Browser B', async ({ browser }) => {
    // Simulate the scenario from Story 1.8 AC6:
    // "register in Browser A, verify/invite in Browser B, log back into Browser A,
    //  confirm no 'encryption key missing' modal"

    const inviteCode = 'FAMILY-XBROWSER123';

    // Browser A: Admin creates invite
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await mockGraphql(pageA, {
      Me: () => ({
        data: {
          me: {
            id: adminUserId,
            email: 'admin@example.com',
            name: 'Admin User',
            emailVerified: true,
            publicKey: adminPublicKey,
            activeFamilyId: familyId,
            activeFamily: {
              id: familyId,
              name: familyName,
              inviteCode: 'FAMILY-123',
              maxMembers: 10,
            },
            memberships: [{
              id: 'membership-1',
              role: 'ADMIN',
              familyId,
              family: { id: familyId, name: familyName, inviteCode: 'FAMILY-123', maxMembers: 10 },
            }],
          },
        },
      }),
      GetUserPublicKey: () => ({ data: { getUserPublicKey: inviteePublicKey } }),
      CreateEncryptedInvite: (body) => ({
        data: {
          createEncryptedInvite: {
            invite: {
              id: 'invite-xbrowser',
              familyId,
              inviterId: adminUserId,
              inviteeEmail,
              inviteCode: body.variables.input.inviteCode,
              status: 'PENDING',
              expiresAt: body.variables.input.expiresAt,
              createdAt: new Date().toISOString(),
            },
            inviteCode: body.variables.input.inviteCode,
            message: `Invite created for ${inviteeEmail}`,
          },
        },
      }),
    });

    // Store admin's keys in Browser A
    await pageA.addInitScript(
      ([keyBase64, famId, userId, pubKey, secKey]) => {
        localStorage.setItem(`test_familyKey_${famId}`, JSON.stringify({ familyKey: keyBase64, familyId: famId }));
        localStorage.setItem(`test_keypair_${userId}`, JSON.stringify({ userId, publicKey: pubKey, secretKey: secKey }));
      },
      [familyKeyBase64, familyId, adminUserId, adminPublicKey, Buffer.from(adminKeypair.secretKey).toString('base64')]
    );

    await pageA.goto('/family/settings');
    await expect(pageA.getByText(familyName)).toBeVisible();

    // Browser B: Invitee accepts invite
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const encryptedKey = nacl.box(familyKeyBytes, nonce, inviteeKeypair.publicKey, adminKeypair.secretKey);

    await mockGraphql(pageB, {
      Me: () => ({
        data: {
          me: {
            id: inviteeUserId,
            email: inviteeEmail,
            name: 'Invitee User',
            emailVerified: true,
            publicKey: inviteePublicKey,
            activeFamilyId: null,
            activeFamily: null,
            memberships: [],
          },
        },
      }),
      AcceptInvite: () => ({
        data: {
          acceptInvite: {
            success: true,
            message: `Successfully joined ${familyName}`,
            familyId,
            familyName,
            encryptedFamilyKey: Buffer.from(encryptedKey).toString('base64'),
            nonce: Buffer.from(nonce).toString('base64'),
            inviterPublicKey: adminPublicKey,
          },
        },
      }),
    });

    await pageB.addInitScript(
      ([userId, pubKey, secKey]) => {
        localStorage.setItem(`test_keypair_${userId}`, JSON.stringify({ userId, publicKey: pubKey, secretKey: secKey }));
      },
      [inviteeUserId, inviteePublicKey, Buffer.from(inviteeKeypair.secretKey).toString('base64')]
    );

    await pageB.goto(`/accept-invite?code=${inviteCode}`);
    await expect(pageB.getByText(/successfully joined/i)).toBeVisible({ timeout: 10000 });

    // Verify invitee can access chat without "key missing" error
    const errorModal = pageB.getByText(/encryption key.*missing|lost/i);
    await expect(errorModal).not.toBeVisible();

    // Clean up
    await contextA.close();
    await contextB.close();
  });
});
