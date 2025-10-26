import { test, expect } from '@playwright/test';
import { translations } from '../../src/lib/translations';

/**
 * REGRESSION TEST: Invite Code Display Bug
 *
 * This test replicates the bug where the UI displays an invite code
 * without the FAMILY- prefix, making it impossible for users to join.
 *
 * Bug Description:
 * - User creates a family via UI
 * - Toast displays invite code as: "ZJ7VXQ5NTUNV4BX8:xiNf08K7..."
 * - But correct format should be: "FAMILY-ZJ7VXQ5NTUNV4BX8:xiNf08K7..."
 * - When another user tries to join with the displayed code, it fails
 *
 * Expected Behavior:
 * - Toast should display the full invite code in format: FAMILY-XXXXXXXX:BASE64KEY
 * - Users should be able to copy the displayed code and successfully join
 */

const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

test.describe('Invite Code Display Bug Regression', () => {
  const testId = `bug-invite-${Date.now()}`;

  test('UI should display full invite code with FAMILY- prefix and key', async ({ page }) => {
    // STEP 1: Create a family via the UI
    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();

    // Switch to create family mode
    await page.getByText(t('login.switchToCreate')).click();
    await page.waitForTimeout(300);

    // Fill out the create family form
    const adminEmail = `${testId}-admin@example.com`;
    const adminPassword = 'TestPassword123!';
    const adminName = `${testId} Admin`;
    const familyName = `${testId} Test Family`;

    await page.locator('#userName').fill(adminName);
    await page.locator('#email').fill(adminEmail);
    await page.locator('#password').fill(adminPassword);
    await page.locator('#familyName').fill(familyName);

    // Submit the form
    await page.locator('button[type="submit"]').click();

    // STEP 2: Extract the invite code from the toast notification
    // Wait for the success toast to appear
    await page.waitForTimeout(2000); // Give time for toast to render

    // The toast should contain "Invite Code: FAMILY-XXXXXXXX:BASE64KEY"
    const toastLocator = page.locator('[data-sonner-toast]').filter({ hasText: 'Invite Code:' });
    await expect(toastLocator).toBeVisible({ timeout: 10000 });

    const toastText = await toastLocator.textContent();
    console.log('Toast text:', toastText);

    // Extract the invite code from the toast
    const inviteCodeMatch = toastText?.match(/Invite Code:\s*([^\n]+)/);
    expect(inviteCodeMatch, 'Toast should contain an invite code').toBeTruthy();

    const displayedInviteCode = inviteCodeMatch![1].trim();
    console.log('Displayed invite code:', displayedInviteCode);

    // ASSERTION 1: The displayed invite code should have the FAMILY- prefix
    expect(displayedInviteCode).toMatch(/^FAMILY-/);

    // ASSERTION 2: The displayed invite code should contain a colon (separating code and key)
    expect(displayedInviteCode).toContain(':');

    // ASSERTION 3: The full format should be FAMILY-XXXXXXXX:BASE64KEY
    expect(displayedInviteCode).toMatch(/^FAMILY-[A-Z0-9]{16}:[A-Za-z0-9+/=]+$/);

    // STEP 3: Attempt to join with the displayed invite code
    // Clear authentication state to simulate a new user
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navigate to login page
    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();

    // Switch to join mode
    await page.getByText(t('login.switchToJoin')).click();
    await page.waitForTimeout(300);

    // Fill out join form with the EXACT invite code from the toast
    const memberEmail = `${testId}-member@example.com`;
    const memberPassword = 'MemberPassword123!';
    const memberName = `${testId} Member`;

    await page.locator('#userName').fill(memberName);
    await page.locator('#email').fill(memberEmail);
    await page.locator('#password').fill(memberPassword);
    await page.locator('#inviteCode').fill(displayedInviteCode);

    // Intercept the GraphQL join mutation
    const joinResponsePromise = page.waitForResponse(
      response =>
        response.url().includes('/graphql') &&
        response.request().method() === 'POST',
      { timeout: 10000 }
    );

    // Submit join form
    await page.locator('button[type="submit"]').click();

    // Wait for response
    const joinResponse = await joinResponsePromise;
    const responseData = await joinResponse.json();

    console.log('Join response:', JSON.stringify(responseData, null, 2));

    // ASSERTION 4: Join should succeed (not return errors)
    expect(responseData.errors, 'Join should succeed with the displayed invite code').toBeUndefined();
    expect(responseData.data?.joinFamily, 'Join mutation should return user data').toBeDefined();

    // ASSERTION 5: Verify the member was created successfully
    const joinData = responseData.data.joinFamily;
    expect(joinData.user.email).toBe(memberEmail);
    expect(joinData.user.role).toBe('MEMBER');
    expect(joinData.family.name).toBe(familyName);
  });

  test('Displayed invite code format validation', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(t('login.title'))).toBeVisible();

    // Switch to create mode
    await page.getByText(t('login.switchToCreate')).click();
    await page.waitForTimeout(300);

    // Create a family
    await page.locator('#userName').fill(`${testId} Format Test Admin`);
    await page.locator('#email').fill(`${testId}-format@example.com`);
    await page.locator('#password').fill('FormatTest123!');
    await page.locator('#familyName').fill(`${testId} Format Test Family`);
    await page.locator('button[type="submit"]').click();

    // Wait for toast
    await page.waitForTimeout(2000);
    const toastLocator = page.locator('[data-sonner-toast]').filter({ hasText: 'Invite Code:' });
    await expect(toastLocator).toBeVisible({ timeout: 10000 });

    const toastText = await toastLocator.textContent();
    const inviteCodeMatch = toastText?.match(/Invite Code:\s*([^\n]+)/);
    const displayedCode = inviteCodeMatch![1].trim();

    // Log for debugging
    console.log('Format test - Displayed code:', displayedCode);
    console.log('Code length:', displayedCode.length);
    console.log('Has FAMILY- prefix:', displayedCode.startsWith('FAMILY-'));
    console.log('Has colon separator:', displayedCode.includes(':'));

    // Split the code to analyze parts
    if (displayedCode.includes(':')) {
      const [codePart, keyPart] = displayedCode.split(':');
      console.log('Code part:', codePart);
      console.log('Code part matches FAMILY-XXXXXXXX:', /^FAMILY-[A-Z0-9]{16}$/.test(codePart));
      console.log('Key part (first 20 chars):', keyPart.substring(0, 20));
      console.log('Key part is base64:', /^[A-Za-z0-9+/=]+$/.test(keyPart));
    }

    // These assertions will fail if the bug exists
    expect(displayedCode.startsWith('FAMILY-'),
      `Invite code should start with FAMILY- but got: ${displayedCode}`
    ).toBeTruthy();

    expect(displayedCode.includes(':'),
      `Invite code should contain : separator but got: ${displayedCode}`
    ).toBeTruthy();
  });
});
