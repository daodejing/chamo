import { test, expect, Page } from '@playwright/test';

const GRAPHQL_ROUTE = '**/graphql';

async function mockGraphql(page: Page, handlers: Record<string, (body: any) => any>) {
  await page.route(GRAPHQL_ROUTE, async (route, request) => {
    const body = request.postDataJSON();
    let operationName = body?.operationName ?? null;

    if (!operationName && typeof body?.query === 'string') {
      if (body.query.includes('mutation Login')) {
        operationName = 'Login';
      } else if (body.query.includes('mutation VerifyEmail')) {
        operationName = 'VerifyEmail';
      } else if (body.query.includes('mutation Register')) {
        operationName = 'Register';
      } else if (body.query.includes('mutation JoinFamily')) {
        operationName = 'JoinFamily';
      } else if (body.query.includes('query Me')) {
        operationName = 'Me';
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    });
  });
}

test.describe('Email verification UX', () => {
  test('redirects unverified login attempts to the verification pending screen', async ({ page }) => {
    page.on('console', msg => console.log('[BROWSER]', msg.type(), msg.text()));

    await mockGraphql(page, {
      Me: () => ({ data: { me: null } }),
      Login: (body) => ({
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
    await expect(page.getByTestId('auth-screen-container')).toBeVisible();
    await expect(page.getByTestId('auth-screen-title')).toHaveText(/family chat/i);
    await expect(page.getByTestId('auth-screen-mode')).toBeVisible();
    await page.fill('input[name="email"]', 'pending@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
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

    await expect(page).toHaveURL(/login\?verified=success/, { timeout: 10000 });

    const pendingKey = await page.evaluate(() => sessionStorage.getItem('pending_family_key'));
    expect(pendingKey).toBeNull();
  });
});
