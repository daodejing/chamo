import { test, expect, Page } from '@playwright/test';

const GRAPHQL_ROUTE = '**/graphql';

async function mockGraphql(page: Page, handlers: Record<string, (body: any) => any>) {
  await page.route(GRAPHQL_ROUTE, async (route, request) => {
    const body = request.postDataJSON();
    const operationName = body?.operationName ?? 'unknown';
    const handler = handlers[operationName];
    if (handler) {
      const payload = handler(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    });
  });
}

test.describe('Email verification UX', () => {
  test('redirects unverified login attempts to the verification pending screen', async ({ page }) => {
    await mockGraphql(page, {
      Me: () => ({ data: { me: null } }),
      Login: (body) => ({
        data: null,
        errors: [
          {
            message: 'Email not verified',
            extensions: {
              response: {
                statusCode: 403,
                requiresEmailVerification: true,
                email: body.variables.input.email,
              },
            },
          },
        ],
      }),
    });

    await page.goto('/login');
    await page.fill('input[name="email"]', 'pending@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/verification-pending**');
    await expect(page).toHaveURL(/verification-pending/);
    await expect(page.getByText('pending@example.com')).toBeVisible();
  });

  test('persists pending family keys on verification and redirects back to login', async ({ page }) => {
    await page.addInitScript(
      ([key, invite]) => {
        sessionStorage.setItem('pending_family_key', key);
        sessionStorage.setItem('pending_family_invite', invite);
      },
      [
        'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=',
        'FAMILY-ABCD1234',
      ],
    );

    await mockGraphql(page, {
      VerifyEmail: () => ({
        data: {
          verifyEmail: {
            user: { id: 'user-1', email: 'member@example.com', name: 'Member One' },
            family: { id: 'family-1', name: 'Doe Family', inviteCode: 'FAMILY-ABCD1234' },
          },
        },
      }),
      Me: () => ({ data: { me: null } }),
    });

    await page.goto('/verify-email?token=test-token');
    await expect(page.getByText('Email verified!', { exact: false })).toBeVisible();

    await page.waitForURL('**/login?verified=success**', { timeout: 10000 });

    const pendingKey = await page.evaluate(() => sessionStorage.getItem('pending_family_key'));
    expect(pendingKey).toBeNull();
  });
});
