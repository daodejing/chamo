# OurChat E2E Test Patterns

This document contains established testing patterns specific to the OurChat project.

## Test Data Isolation Pattern

All test data MUST be marked with unique identifiers for cleanup:

```typescript
// Generate unique test identifier
const testId = `e2e-story-x-x-${Date.now()}`;

// Prefix ALL name fields
const familyName = `[${testId}] Test Family`;
const userName = `[${testId}] Admin User`;
const memberName = `[${testId}] Member User`;

// Prefix ALL email fields
const adminEmail = `${testId}-admin@example.com`;
const memberEmail = `${testId}-member@example.com`;
```

## Cleanup Pattern

Track all created resources and delete them in `afterEach`:

```typescript
test.describe('Story X.X', () => {
  let testId: string;
  let createdUserIds: string[] = [];
  let createdFamilyIds: string[] = [];
  let createdMessageIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    testId = `e2e-story-x-x-${Date.now()}`;
    createdUserIds = [];
    createdFamilyIds = [];
    createdMessageIds = [];
  });

  test.afterEach(async ({ page }) => {
    // Delete in reverse order of dependencies
    for (const messageId of createdMessageIds) {
      await page.request.delete(`${E2E_CONFIG.BASE_URL}/api/messages/${messageId}`);
    }
    for (const userId of createdUserIds) {
      await page.request.delete(`${E2E_CONFIG.BASE_URL}/api/users/${userId}`);
    }
    for (const familyId of createdFamilyIds) {
      await page.request.delete(`${E2E_CONFIG.BASE_URL}/api/families/${familyId}`);
    }
  });
});
```

## Multi-User Browser Context Pattern

For chat features, use multiple browser contexts to simulate real multi-user interactions:

```typescript
test('Multi-user message exchange', async ({ browser }) => {
  const testId = `e2e-messaging-${Date.now()}`;

  // Create isolated browser contexts
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  const member1Context = await browser.newContext();
  const member1Page = await member1Context.newPage();

  const member2Context = await browser.newContext();
  const member2Page = await member2Context.newPage();

  try {
    // 1. Admin creates family and gets invite code
    await adminPage.goto('/login');
    await adminPage.locator('input[name="familyName"]').fill(`[${testId}] Family`);
    await adminPage.locator('input[name="userName"]').fill(`[${testId}] Admin`);
    await adminPage.locator('input[name="email"]').fill(`${testId}-admin@example.com`);
    await adminPage.locator('input[name="password"]').fill('AdminPass123!');
    await adminPage.locator('button[type="submit"]').click();

    const inviteCode = await adminPage.locator('[data-testid="invite-code"]').textContent();

    // 2. Member 1 joins
    await member1Page.goto('/login');
    await member1Page.getByText('Join Family').click();
    await member1Page.locator('input[name="userName"]').fill(`[${testId}] Member1`);
    await member1Page.locator('input[name="email"]').fill(`${testId}-member1@example.com`);
    await member1Page.locator('input[name="password"]').fill('Member1Pass123!');
    await member1Page.locator('input[name="inviteCode"]').fill(inviteCode);
    await member1Page.locator('button[type="submit"]').click();

    // 3. Member 2 joins
    await member2Page.goto('/login');
    await member2Page.getByText('Join Family').click();
    await member2Page.locator('input[name="userName"]').fill(`[${testId}] Member2`);
    await member2Page.locator('input[name="email"]').fill(`${testId}-member2@example.com`);
    await member2Page.locator('input[name="password"]').fill('Member2Pass123!');
    await member2Page.locator('input[name="inviteCode"]').fill(inviteCode);
    await member2Page.locator('button[type="submit"]').click();

    // 4. Test interactions
    // Admin sends message
    await adminPage.locator('input[placeholder="Type a message"]').fill('Hello everyone');
    await adminPage.locator('button[aria-label="Send"]').click();

    // Both members should see it
    await expect(member1Page.locator('text=Hello everyone')).toBeVisible();
    await expect(member2Page.locator('text=Hello everyone')).toBeVisible();

    // Member 1 replies
    await member1Page.locator('input[placeholder="Type a message"]').fill('Hi from member 1');
    await member1Page.locator('button[aria-label="Send"]').click();

    // Admin and Member 2 should see it
    await expect(adminPage.locator('text=Hi from member 1')).toBeVisible();
    await expect(member2Page.locator('text=Hi from member 1')).toBeVisible();

  } finally {
    // Always cleanup contexts
    await adminContext.close();
    await member1Context.close();
    await member2Context.close();
  }
});
```

## API-Assisted Setup Pattern

Use REST/GraphQL API to create test data, then verify via UI:

```typescript
test('User can view family members', async ({ page }) => {
  const testId = `e2e-members-${Date.now()}`;

  // Create family via API
  const registerResponse = await page.request.post(`${E2E_CONFIG.BASE_URL}/api/auth/register`, {
    headers: {
      'Content-Type': 'application/json',
      'x-test-bypass-rate-limit': 'true',
    },
    data: {
      familyName: `[${testId}] Test Family`,
      userName: `[${testId}] Admin`,
      email: `${testId}-admin@example.com`,
      password: 'AdminPass123!',
    },
  });

  expect(registerResponse.ok()).toBeTruthy();
  const data = await registerResponse.json();

  // Track for cleanup
  createdFamilyIds.push(data.family.id);
  createdUserIds.push(data.user.id);

  // Now test UI displays the data correctly
  await page.goto('/members');
  await expect(page.locator(`text=${data.user.name}`)).toBeVisible();
  await expect(page.locator(`text=${data.family.name}`)).toBeVisible();
});
```

## Story-Based Test Organization

Tests should be organized by story and acceptance criteria:

```typescript
/**
 * Epic 1 - User Onboarding & Authentication
 * E2E Tests for Story 1.1: Create Family Account
 *
 * Story 1.1 Tests cover:
 * - AC1: Admin provides family name, email, password, and their name
 * - AC2: System generates unique invite code with embedded key
 * - AC3: Admin receives success confirmation with invite code
 * - AC4: Admin is automatically logged in and redirected
 */

test.describe('Story 1.1: Create Family Account', () => {
  test('AC1: Registration form accepts all required fields', async ({ page }) => {
    // ...
  });

  test('AC1: Form validation displays errors for invalid inputs', async ({ page }) => {
    // ...
  });

  test('AC3 & AC4: Successful registration completes without errors', async ({ page }) => {
    // ...
  });
});
```

## Common Locator Patterns

```typescript
// Form inputs by name attribute
page.locator('input[name="email"]')
page.locator('input[name="password"]')
page.locator('input[name="familyName"]')
page.locator('input[name="userName"]')
page.locator('input[name="inviteCode"]')

// Buttons by type or aria-label
page.locator('button[type="submit"]')
page.locator('button[aria-label="Send"]')

// Error messages
page.locator('[role="alert"], .text-red-500, .text-destructive')

// Card elements (shadcn/ui)
page.locator('[data-slot="card-description"]', { hasText: 'Expected Text' })

// Toast notifications
page.locator('[data-sonner-toast]')

// Test-specific data attributes
page.locator('[data-testid="invite-code"]')
```

## Timing and Waits

```typescript
// UI transitions (mode switches, animations)
await page.waitForTimeout(300);

// Form submission
await page.waitForTimeout(500);

// Navigation/redirects
await page.waitForTimeout(1500);

// API responses
const response = await page.waitForResponse(
  response => response.url().includes('/api/endpoint') && response.request().method() === 'POST'
);
```

## Rate Limit Bypass

Always include bypass header for test API calls:

```typescript
await page.request.post(`${E2E_CONFIG.BASE_URL}/api/endpoint`, {
  headers: {
    'Content-Type': 'application/json',
    'x-test-bypass-rate-limit': 'true', // Required for tests
  },
  data: { /* ... */ },
});
```
