import { expect, test } from '@playwright/test';
import type { Locator, Page, Request, Response } from '@playwright/test';

import { translations } from '../../src/lib/translations';
import { E2E_CONFIG } from './config';

const tEn = (key: keyof typeof translations.en): string => translations.en[key];
const CRYPTO_DB_NAME = 'chamo_encryption';
const USER_KEY_STORE = 'userKeys';

type RegistrationFormData = {
  email: string;
  password: string;
  userName: string;
};

type RegistrationFlow = {
  submitButton: Locator;
  requestPromise: Promise<Request>;
  responsePromise: Promise<Response>;
};

test.describe('Story 1.9: Per-user keypair generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('auth-screen-container')).toBeVisible();
    await expect(page.getByTestId('auth-screen-title')).toHaveText(tEn('login.title'));
    await resetEncryptionDatabase(page);
    await clearLostKeyFlag(page);
  });

  test.afterEach(async ({ page }) => {
    await page.unroute(E2E_CONFIG.GRAPHQL_URL).catch(() => {});
  });

  test('Registration flow shows encryption key generation state before calling backend', async ({ page }) => {
    await fillRegistrationForm(page);
    await mockRegisterMutation(page);
    const flow = await startRegistrationSubmission(page);
    await expect(flow.submitButton).toContainText(tEn('login.generatingKeys'));
    const { request, response } = await finalizeRegistration(flow);

    expect(response.ok()).toBeTruthy();

    const requestBody = request.postDataJSON();
    expect(requestBody?.variables?.input?.publicKey).toBeTruthy();
  });

  test('Private key is stored in encrypted IndexedDB after registration', async ({ page }) => {
    await fillRegistrationForm(page);
    await mockRegisterMutation(page);
    const { userId } = await finalizeRegistration(await startRegistrationSubmission(page));

    await expect.poll(() => hasPrivateKeyStored(page, userId)).toBe(true);
  });

  test('Register mutation sends generated public key to the backend', async ({ page }) => {
    await fillRegistrationForm(page);
    await mockRegisterMutation(page);
    const flow = await startRegistrationSubmission(page);
    const { request } = await finalizeRegistration(flow);

    const requestBody = request.postDataJSON();
    const submittedKey = requestBody?.variables?.input?.publicKey;

    expect(typeof submittedKey).toBe('string');
    expect(submittedKey).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(submittedKey).toHaveLength(44);
  });

  test('Private key persists across page refresh', async ({ page }) => {
    await fillRegistrationForm(page);
    await mockRegisterMutation(page);
    const { userId } = await finalizeRegistration(await startRegistrationSubmission(page));

    // Verify key is stored
    await expect.poll(() => hasPrivateKeyStored(page, userId)).toBe(true);

    // Reload the page (simulates browser refresh)
    await page.reload();

    // Verify key still exists after refresh
    await expect.poll(() => hasPrivateKeyStored(page, userId)).toBe(true);
  });

  test('Lost key modal appears when private key missing', async ({ page }) => {
    const userId = `test-user-${Date.now()}`;
    const userEmail = `lostkey-${Date.now()}@example.com`;

    // Set up mock for authenticated ME query
    await mockAuthenticatedMeQuery(page, userId, userEmail);

    // Clear the encryption database (simulates new device or cleared storage)
    await resetEncryptionDatabase(page);

    // Navigate to app (triggers lost key detection since user is authenticated but has no key)
    await page.goto('/');

    // Verify lost key modal is shown
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify modal has the expected content (title)
    await expect(page.getByText(/Encryption Keys Not Found/i)).toBeVisible();

    // Verify Continue button exists and works
    const continueButton = page.getByTestId('lost-key-modal-continue');
    await expect(continueButton).toBeVisible();
    await continueButton.click();
    await expect(dialog).not.toBeVisible();
  });
});

async function resetEncryptionDatabase(page: Page): Promise<void> {
  await page.evaluate(
    (dbName) =>
      new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase(dbName);
        deleteRequest.onerror = () => resolve();
        deleteRequest.onblocked = () => resolve();
        deleteRequest.onsuccess = () => resolve();
      }),
    CRYPTO_DB_NAME
  );
}

async function fillRegistrationForm(page: Page): Promise<RegistrationFormData> {
  const data = generateRegistrationData();

  await page.getByRole('button', { name: tEn('login.switchToCreate') }).click();
  // Wait for form to switch to create mode
  await page.waitForTimeout(300);

  await page.locator('#userName').fill(data.userName);
  await page.locator('#email').fill(data.email);
  await page.locator('#password').fill(data.password);

  return data;
}

async function startRegistrationSubmission(page: Page): Promise<RegistrationFlow> {
  const submitButton = page.locator('button[type="submit"]');

  const requestPromise = page.waitForRequest(isRegisterRequest);
  const responsePromise = page.waitForResponse(isRegisterResponse);

  await submitButton.click();

  return { submitButton, requestPromise, responsePromise };
}

async function finalizeRegistration(flow: RegistrationFlow) {
  const request = await flow.requestPromise;
  const response = await flow.responsePromise;
  const responseBody = await response.json();
  const userId = responseBody?.data?.register?.userId;

  expect(userId, 'register mutation should resolve with userId').toBeTruthy();

  return { request, response, responseBody, userId };
}

function isRegisterRequest(request: Request): boolean {
  if (!request.url().includes(E2E_CONFIG.GRAPHQL_URL)) {
    return false;
  }
  if (request.method() !== 'POST') {
    return false;
  }
  const payload = request.postDataJSON();
  return payload?.operationName === 'Register';
}

function isRegisterResponse(response: Response): boolean {
  if (!response.url().includes(E2E_CONFIG.GRAPHQL_URL)) {
    return false;
  }
  if (response.request().method() !== 'POST') {
    return false;
  }
  const payload = response.request().postDataJSON?.();
  return payload?.operationName === 'Register';
}

async function hasPrivateKeyStored(page: Page, userId: string): Promise<boolean> {
  return page.evaluate(
    ({ dbName, storeName, key }) =>
      new Promise<boolean>((resolve) => {
        const openRequest = indexedDB.open(dbName);
        openRequest.onerror = () => resolve(false);
        openRequest.onupgradeneeded = () => {
          openRequest.result.close();
          resolve(false);
        };
        openRequest.onsuccess = () => {
          const db = openRequest.result;
          const transaction = db.transaction(storeName, 'readonly');
          const store = transaction.objectStore(storeName);
          const getRequest = store.get(key);

          getRequest.onsuccess = () => {
            resolve(Boolean(getRequest.result));
            db.close();
          };
          getRequest.onerror = () => {
            resolve(false);
            db.close();
          };
        };
      }),
    { dbName: CRYPTO_DB_NAME, storeName: USER_KEY_STORE, key: userId }
  );
}

function generateRegistrationData(): RegistrationFormData {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1000)}`;
  return {
    email: `story19+${unique}@example.com`,
    password: `KeyTest!${unique}`,
    userName: `Story19 Tester ${unique}`,
  };
}

async function mockRegisterMutation(
  page: Page,
  userId: string = `user-${Date.now()}-${Math.round(Math.random() * 1000)}`
): Promise<{ userId: string }> {
  await page.route(E2E_CONFIG.GRAPHQL_URL, async (route) => {
    const request = route.request();
    let payload: any = null;
    try {
      payload = request.postDataJSON();
    } catch {
      // ignore parse errors, continue request
    }

    if (payload?.operationName !== 'Register') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          register: {
            message: 'Registration successful',
            requiresEmailVerification: true,
            userId,
          },
        },
      }),
    });
  });

  return { userId };
}

async function clearLostKeyFlag(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      localStorage.removeItem('lost_key_modal_seen');
    } catch {
      // ignore
    }
  });
}

async function mockAuthenticatedMeQuery(
  page: Page,
  userId: string,
  userEmail: string
): Promise<void> {
  // Set auth token in localStorage to trigger ME query
  await page.evaluate(
    ({ accessToken, refreshToken }) => {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
    },
    {
      accessToken: 'mock-access-token-for-testing',
      refreshToken: 'mock-refresh-token-for-testing',
    }
  );

  // Mock the ME GraphQL query to return authenticated user
  await page.route(E2E_CONFIG.GRAPHQL_URL, async (route) => {
    const request = route.request();
    let payload: any = null;
    try {
      payload = request.postDataJSON();
    } catch {
      // ignore parse errors
    }

    if (payload?.operationName === 'Me') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            me: {
              id: userId,
              email: userEmail,
              name: 'Test User',
              avatar: null,
              role: 'MEMBER',
              emailVerified: true,
              preferences: {},
              activeFamily: {
                id: 'test-family',
                name: 'Test Family',
                inviteCode: 'TEST123',
              },
            },
          },
        }),
      });
    } else {
      await route.continue();
    }
  });
}
