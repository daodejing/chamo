/**
 * E2E Test Fixtures
 *
 * Provides utilities for setting up and tearing down test data via the GraphQL API.
 * Uses the test-support module mutations to create users, families, and inject auth state.
 */

import { Page, Browser, BrowserContext } from '@playwright/test';
import nacl from 'tweetnacl';
import { E2E_CONFIG } from './config';

// ============================================================================
// MailHog Types and Helpers
// ============================================================================

/**
 * MailHog message structure (simplified)
 */
export interface MailHogMessage {
  ID: string;
  From: { Relays: null; Mailbox: string; Domain: string; Params: string };
  To: Array<{ Relays: null; Mailbox: string; Domain: string; Params: string }>;
  Content: {
    Headers: {
      Subject: string[];
      From: string[];
      To: string[];
      'Content-Type': string[];
    };
    Body: string;
    Size: number;
    MIME: null;
  };
  Created: string;
  Raw: { From: string; To: string[]; Data: string; Helo: string };
}

export interface MailHogSearchResponse {
  total: number;
  count: number;
  start: number;
  items: MailHogMessage[];
}

/**
 * Search MailHog for emails matching criteria
 * @param kind - Search type: 'from', 'to', or 'containing' (subject/body)
 * @param query - Search query string
 */
export async function searchMailHogEmails(
  kind: 'from' | 'to' | 'containing',
  query: string,
): Promise<MailHogMessage[]> {
  const response = await fetch(
    `${E2E_CONFIG.MAILHOG_API_URL}/search?kind=${kind}&query=${encodeURIComponent(query)}`,
  );

  if (!response.ok) {
    throw new Error(`MailHog search failed: ${response.status} ${response.statusText}`);
  }

  const data: MailHogSearchResponse = await response.json();
  return data.items;
}

/**
 * Get all emails from MailHog
 */
export async function getAllMailHogEmails(): Promise<MailHogMessage[]> {
  const response = await fetch(`${E2E_CONFIG.MAILHOG_API_URL}/messages`);

  if (!response.ok) {
    throw new Error(`MailHog get messages failed: ${response.status} ${response.statusText}`);
  }

  const data: MailHogSearchResponse = await response.json();
  return data.items;
}

/**
 * Delete all emails from MailHog (useful for test isolation)
 */
export async function clearMailHogEmails(): Promise<void> {
  const response = await fetch(`${E2E_CONFIG.MAILHOG_API_URL.replace('/v2', '/v1')}/messages`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`MailHog clear failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Wait for an email to arrive in MailHog matching criteria
 * Polls every 500ms until timeout
 */
export async function waitForMailHogEmail(
  kind: 'from' | 'to' | 'containing',
  query: string,
  timeoutMs: number = 10000,
): Promise<MailHogMessage> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const emails = await searchMailHogEmails(kind, query);
    if (emails.length > 0) {
      return emails[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timeout waiting for email matching ${kind}="${query}" after ${timeoutMs}ms`);
}

/**
 * Decode quoted-printable encoded string
 * Handles =XX hex codes and soft line breaks (=\n)
 * Properly decodes UTF-8 multi-byte characters (like Japanese)
 */
export function decodeQuotedPrintable(str: string): string {
  // Remove soft line breaks (= at end of line)
  let decoded = str.replace(/=\r?\n/g, '');

  // Collect all bytes (both encoded =XX and literal characters)
  const bytes: number[] = [];
  let i = 0;
  while (i < decoded.length) {
    if (decoded[i] === '=' && i + 2 < decoded.length) {
      const hex = decoded.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 3;
        continue;
      }
    }
    // Literal character - get its UTF-8 bytes
    bytes.push(decoded.charCodeAt(i));
    i++;
  }

  // Decode bytes as UTF-8
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
}

/**
 * Extract verification token from email body
 */
export function extractVerificationToken(email: MailHogMessage): string | null {
  const body = email.Content.Body;
  // Decode quoted-printable encoding first
  const decodedBody = decodeQuotedPrintable(body);
  const match = decodedBody.match(/[?&]token=([^&\s"'<>]+)/);
  return match ? match[1] : null;
}

/**
 * Extract invite code from email body
 */
export function extractInviteCode(email: MailHogMessage): string | null {
  const body = email.Content.Body;
  // Decode quoted-printable encoding first
  const decodedBody = decodeQuotedPrintable(body);
  const match = decodedBody.match(/[?&]code=([^&\s"'<>]+)/);
  return match ? match[1] : null;
}

// ============================================================================
// Crypto Helpers
// ============================================================================

/**
 * Generate a real NaCl box keypair for E2E tests.
 * Returns public key as base64 string (for backend) and secret key as base64 (for browser storage).
 */
export function generateRealKeypair(): {
  publicKey: string;
  secretKeyBase64: string;
} {
  const { publicKey, secretKey } = nacl.box.keyPair();

  // Encode to base64
  const publicKeyBase64 = Buffer.from(publicKey).toString('base64');
  const secretKeyBase64 = Buffer.from(secretKey).toString('base64');

  return {
    publicKey: publicKeyBase64,
    secretKeyBase64,
  };
}

// ============================================================================
// Types
// ============================================================================

export interface TestUser {
  email: string;
  password: string;
  name: string;
  publicKey?: string;
}

export interface FamilyAdminFixture {
  admin: {
    user: {
      id: string;
      email: string;
      name: string;
    };
    accessToken: string;
  };
  family: {
    id: string;
    name: string;
  };
  inviteCode: string;
}

export interface MessagingFixture {
  admin: {
    user: {
      id: string;
      email: string;
      name: string;
    };
    accessToken: string;
  };
  member: {
    user: {
      id: string;
      email: string;
      name: string;
    };
    accessToken: string;
  };
  family: {
    id: string;
    name: string;
  };
  channel: {
    id: string;
    name: string;
  };
  inviteCode: string;
}

export interface CleanupResult {
  success: boolean;
  message: string;
  deletedUsers: number;
  deletedFamilies: number;
}

// ============================================================================
// GraphQL Helpers
// ============================================================================

async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(E2E_CONFIG.GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  if (json.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

// ============================================================================
// Fixture Creation
// ============================================================================

/**
 * Create a messaging fixture via the test-support API.
 * Creates admin, member, family, and channel in one call.
 */
export async function createMessagingFixture(
  admin: TestUser,
  member: TestUser,
  familyName: string,
  channelName?: string,
): Promise<MessagingFixture> {
  const mutation = `
    mutation TestCreateMessagingFixture($input: TestCreateMessagingFixtureInput!) {
      testCreateMessagingFixture(input: $input) {
        admin {
          user {
            id
            email
            name
          }
          accessToken
        }
        member {
          user {
            id
            email
            name
          }
          accessToken
        }
        family {
          id
          name
        }
        channel {
          id
          name
        }
        inviteCode
      }
    }
  `;

  const data = await graphqlRequest<{
    testCreateMessagingFixture: MessagingFixture;
  }>(mutation, {
    input: {
      admin,
      member,
      familyName,
      ...(channelName && { channelName }),
    },
  });

  return data.testCreateMessagingFixture;
}

/**
 * Create a family admin fixture via the test-support API
 */
export async function createFamilyAdminFixture(
  admin: TestUser,
  familyName: string,
): Promise<FamilyAdminFixture> {
  const mutation = `
    mutation TestCreateFamilyAdminFixture($input: TestCreateFamilyAdminFixtureInput!) {
      testCreateFamilyAdminFixture(input: $input) {
        admin {
          user {
            id
            email
            name
          }
          accessToken
        }
        family {
          id
          name
        }
        inviteCode
      }
    }
  `;

  const data = await graphqlRequest<{
    testCreateFamilyAdminFixture: FamilyAdminFixture;
  }>(mutation, {
    input: {
      admin,
      familyName,
    },
  });

  return data.testCreateFamilyAdminFixture;
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up test data by user IDs, family IDs, or email patterns
 */
export async function cleanupTestData(options: {
  userIds?: string[];
  familyIds?: string[];
  emailPatterns?: string[];
}): Promise<CleanupResult> {
  const mutation = `
    mutation TestCleanup($input: TestCleanupInput!) {
      testCleanup(input: $input) {
        success
        message
        deletedUsers
        deletedFamilies
      }
    }
  `;

  const data = await graphqlRequest<{ testCleanup: CleanupResult }>(mutation, {
    input: options,
  });

  return data.testCleanup;
}

// ============================================================================
// Browser Storage Injection
// ============================================================================

/**
 * Inject auth token into browser localStorage
 * Note: Must navigate to the app origin first to avoid Firefox security errors
 */
export async function injectAuthToken(
  page: Page,
  accessToken: string,
): Promise<void> {
  // Ensure we're on the app origin before accessing localStorage
  // Firefox throws "The operation is insecure" if we try to access
  // localStorage without a valid origin context (e.g., about:blank)
  const currentUrl = page.url();
  const isAtAppOrigin =
    currentUrl.startsWith(E2E_CONFIG.BASE_URL) &&
    !currentUrl.includes('about:');

  if (!isAtAppOrigin) {
    // Navigate to the app and wait for the page to be fully loaded
    await page.goto(E2E_CONFIG.BASE_URL, { waitUntil: 'networkidle' });
    // Extra wait for Firefox to ensure the origin context is established
    await page.waitForLoadState('domcontentloaded');
  }

  await page.evaluate((token) => {
    localStorage.setItem('accessToken', token);
  }, accessToken);
}

/**
 * Store user's private key using the app's production storePrivateKey function.
 * This ensures keys are stored with the same Dexie encryption the app uses.
 *
 * The app exposes __e2e_storePrivateKey on window in non-production environments.
 *
 * @param page - Playwright page (must be at app origin with app loaded)
 * @param userId - User ID to store key for
 * @param secretKeyBase64 - Base64-encoded secret key (32 bytes for NaCl box)
 */
export async function storeUserPrivateKey(
  page: Page,
  userId: string,
  secretKeyBase64: string,
): Promise<void> {
  // Wait for the app to load and expose the test helper
  await page.waitForFunction(
    () => typeof (window as Window & { __e2e_storePrivateKey?: unknown }).__e2e_storePrivateKey === 'function',
    { timeout: 10000 },
  );

  await page.evaluate(
    async ({ userId, secretKeyBase64 }) => {
      // Use the production storePrivateKey exposed on window for E2E tests
      const storePrivateKey = (window as Window & {
        __e2e_storePrivateKey: (userId: string, secretKey: Uint8Array) => Promise<void>;
      }).__e2e_storePrivateKey;

      // Decode base64 to Uint8Array
      const binary = atob(secretKeyBase64);
      const secretKey = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        secretKey[i] = binary.charCodeAt(i);
      }

      // Store using production code
      await storePrivateKey(userId, secretKey);
    },
    { userId, secretKeyBase64 },
  );
}

/**
 * Inject family encryption key into IndexedDB as a CryptoKey object.
 * This mimics how the app stores the family key in production.
 *
 * The app uses:
 * - Database: 'ourchat-keys'
 * - Store: 'keys'
 * - Key name: 'familyKey:{familyId}' (note the prefix format!)
 * - Value: CryptoKey object (AES-GCM)
 */
export async function injectFamilyKey(
  page: Page,
  familyId: string,
  base64Key: string,
): Promise<void> {
  await page.evaluate(
    async ({ familyId, base64Key }) => {
      // Decode base64 to raw bytes
      const binaryString = atob(base64Key);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Import as CryptoKey for AES-GCM encryption
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        bytes,
        { name: 'AES-GCM', length: 256 },
        true, // extractable
        ['encrypt', 'decrypt'],
      );

      // Store in the correct IndexedDB location
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('ourchat-keys', 1);

        request.onerror = () => reject(request.error);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('keys')) {
            db.createObjectStore('keys');
          }
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction(['keys'], 'readwrite');
          const store = transaction.objectStore('keys');

          // Store with 'familyKey:{familyId}' format - this is what the app expects
          // See src/lib/e2ee/key-management.ts buildKeyStorageName()
          const keyName = `familyKey:${familyId}`;
          const putRequest = store.put(cryptoKey, keyName);

          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        };
      });
    },
    { familyId, base64Key },
  );
}

// ============================================================================
// Complete Setup Helper
// ============================================================================

/**
 * Complete setup for a family admin test:
 * 1. Generates a real NaCl keypair
 * 2. Creates user and family via API (with matching public key)
 * 3. Injects auth token into localStorage
 * 4. Stores private key using production code
 * 5. Returns fixture data and cleanup function
 */
export async function setupFamilyAdminTest(
  page: Page,
  testId: string,
): Promise<{
  fixture: FamilyAdminFixture;
  cleanup: () => Promise<void>;
}> {
  // Generate a real NaCl keypair - public key goes to backend, secret key stays in browser
  const { publicKey, secretKeyBase64 } = generateRealKeypair();

  const admin: TestUser = {
    email: `${testId}-admin@example.com`,
    password: 'TestPassword123!',
    name: `${testId} Admin`,
    publicKey, // Pass the real public key to backend
  };

  const familyName = `${testId} Test Family`;

  // Create fixture via API with the real public key
  const fixture = await createFamilyAdminFixture(admin, familyName);

  // Inject auth token into browser (this navigates to app origin first)
  await injectAuthToken(page, fixture.admin.accessToken);

  // Store the matching private key using the app's production storage
  // This uses the same Dexie encryption as the production app
  await storeUserPrivateKey(page, fixture.admin.user.id, secretKeyBase64);

  // Generate and inject family key
  const familyKey = btoa(
    String.fromCharCode(
      ...new Uint8Array(32).map(() => Math.floor(Math.random() * 256)),
    ),
  );
  await injectFamilyKey(page, fixture.family.id, familyKey);

  // Reload to ensure the app picks up the auth state from localStorage
  await page.reload({ waitUntil: 'networkidle' });

  // Wait for the auth state to be fully loaded
  // The app needs time to execute ME_QUERY and update auth context
  await page.waitForTimeout(1000);

  // Return cleanup function
  const cleanup = async () => {
    await cleanupTestData({
      userIds: [fixture.admin.user.id],
      familyIds: [fixture.family.id],
    });
  };

  return { fixture, cleanup };
}

/**
 * Complete setup for a messaging test with two users (admin and member):
 * 1. Generates real NaCl keypairs for both users
 * 2. Creates both users, family, and channel via API
 * 3. Sets up both browser contexts with auth tokens and keys
 * 4. Returns fixture data, pages, contexts, and cleanup function
 *
 * IMPORTANT: Uses separate browser contexts for proper auth isolation.
 * The caller must close the contexts when done (cleanup handles data only).
 */
export async function setupMessagingTest(
  browser: Browser,
  testId: string,
): Promise<{
  fixture: MessagingFixture;
  adminPage: Page;
  adminContext: BrowserContext;
  memberPage: Page;
  memberContext: BrowserContext;
  familyKeyBase64: string;
  cleanup: () => Promise<void>;
}> {
  // Generate real NaCl keypairs for both users
  const adminKeys = generateRealKeypair();
  const memberKeys = generateRealKeypair();

  const admin: TestUser = {
    email: `${testId}-admin@example.com`,
    password: 'TestPassword123!',
    name: `${testId} Admin`,
    publicKey: adminKeys.publicKey,
  };

  const member: TestUser = {
    email: `${testId}-member@example.com`,
    password: 'TestPassword123!',
    name: `${testId} Member`,
    publicKey: memberKeys.publicKey,
  };

  const familyName = `${testId} Test Family`;

  // Create fixture via API
  const fixture = await createMessagingFixture(admin, member, familyName);

  // Generate a shared family key (same key for both users)
  const familyKeyBase64 = btoa(
    String.fromCharCode(
      ...new Uint8Array(32).map(() => Math.floor(Math.random() * 256)),
    ),
  );

  // Create separate browser contexts for admin and member
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();

  // Set up admin's browser
  await injectAuthToken(adminPage, fixture.admin.accessToken);
  await storeUserPrivateKey(adminPage, fixture.admin.user.id, adminKeys.secretKeyBase64);
  await injectFamilyKey(adminPage, fixture.family.id, familyKeyBase64);

  // Set up member's browser
  await injectAuthToken(memberPage, fixture.member.accessToken);
  await storeUserPrivateKey(memberPage, fixture.member.user.id, memberKeys.secretKeyBase64);
  await injectFamilyKey(memberPage, fixture.family.id, familyKeyBase64);

  // Reload both pages to pick up auth state
  await Promise.all([
    adminPage.reload({ waitUntil: 'networkidle' }),
    memberPage.reload({ waitUntil: 'networkidle' }),
  ]);

  // Wait for auth state to be fully loaded
  await Promise.all([
    adminPage.waitForTimeout(1000),
    memberPage.waitForTimeout(1000),
  ]);

  // Cleanup function (data only - caller must close contexts)
  const cleanup = async () => {
    await adminContext.close();
    await memberContext.close();
    await cleanupTestData({
      userIds: [fixture.admin.user.id, fixture.member.user.id],
      familyIds: [fixture.family.id],
    });
  };

  return {
    fixture,
    adminPage,
    adminContext,
    memberPage,
    memberContext,
    familyKeyBase64,
    cleanup,
  };
}
