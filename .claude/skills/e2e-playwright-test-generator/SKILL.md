---
name: e2e-playwright-test-generator
description: Generate functional E2E Playwright tests from story files. This skill should be used proactively after completing feature implementation to create comprehensive test coverage. Takes a story file path as input and generates runnable .spec.ts files in tests/e2e/ based on acceptance criteria.
---

# E2E Playwright Test Generator

Generate functional Playwright E2E tests from story documentation files.

## Purpose

This skill transforms story acceptance criteria into executable Playwright tests for the OurChat application. It ensures comprehensive E2E test coverage by automatically generating tests that verify each acceptance criterion is satisfied through the user interface.

## When to Use

Use this skill proactively in these scenarios:
- After completing a story implementation (trigger automatically after feature work)
- When a story file is mentioned or referenced
- When explicitly asked to generate E2E tests
- When reviewing completed work to ensure test coverage

## How to Use This Skill

### Step 1: Identify the Story File

If the user has not provided a story file path, ask for it using the AskUserQuestion tool:
- Search for story files in `docs/stories/` using the pattern `story-*.md`
- Present available stories to the user
- If the user mentions a story number (e.g., "Story 1.1"), locate `docs/stories/story-1.1.md`

### Step 2: Analyze the Story

Read the story file and extract:
1. **Story title and number** (e.g., "Story 1.1: Create Family Account")
2. **User story** (the "As a... I want... so that..." section)
3. **All acceptance criteria** (AC1, AC2, AC3, etc.)
4. **Implementation notes** (Dev Notes, Architecture Change Note sections)
5. **Existing file references** to understand the implemented components

Pay special attention to:
- The current architecture (check for "Architecture Change Note")
- GraphQL mutations/queries mentioned
- UI components referenced
- API endpoints or routes

### Step 3: Generate Test Structure

Create a Playwright test file following this structure:

**File naming**: `tests/e2e/[epic-name-or-story-theme].spec.ts`
- Example: `tests/e2e/auth-onboarding.spec.ts` for authentication stories

**Test organization**:
```typescript
import { test, expect } from '@playwright/test';
import { E2E_CONFIG } from './config';
import { translations } from '../../src/lib/translations';

/**
 * Epic X - [Epic Name]
 * E2E Tests for Story X.X: [Story Title]
 *
 * Story X.X Tests cover:
 * - AC1: [Brief description]
 * - AC2: [Brief description]
 * ...
 *
 * NOTE: All UI text assertions use i18n translations (default language: 'en')
 */

// Helper to get translated text (default language is 'en')
const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

test.describe('Story X.X: [Story Title]', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the relevant page
    // Add common setup
  });

  /**
   * AC1: [Full acceptance criterion description]
   */
  test('AC1: [Test description]', async ({ page }) => {
    // Test implementation
  });

  // ... more tests for each AC
});
```

### Step 4: Generate Test Cases

For each acceptance criterion, generate one or more tests following these patterns:

#### Critical: Test Data Isolation

**ALWAYS use test-specific prefixes** to mark all test data for easy cleanup:
```typescript
// Generate unique test identifier
const testId = `e2e-story-1-1-${Date.now()}`;

// Use testId as prefix in ALL name fields
const familyName = `[${testId}] Test Family`;
const userName = `[${testId}] Test User`;
const email = `${testId}@example.com`;
```

**ALWAYS include afterEach cleanup** to delete test data:
```typescript
test.describe('Story X.X: [Story Title]', () => {
  let testId: string;
  let createdUserIds: string[] = [];
  let createdFamilyIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    testId = `e2e-story-x-x-${Date.now()}`;
    createdUserIds = [];
    createdFamilyIds = [];
  });

  test.afterEach(async ({ page }) => {
    // Delete test data using GraphQL mutations or API calls
    for (const userId of createdUserIds) {
      await page.request.delete(`${E2E_CONFIG.BASE_URL}/api/users/${userId}`);
    }
    for (const familyId of createdFamilyIds) {
      await page.request.delete(`${E2E_CONFIG.BASE_URL}/api/families/${familyId}`);
    }
  });
});
```

#### Critical: Multi-User Testing with Browser Contexts

For chat app features, **ALWAYS use multiple browser contexts** to simulate multiple users:

```typescript
import { test, expect, Browser } from '@playwright/test';

test('Multi-user chat flow', async ({ browser }) => {
  const testId = `e2e-chat-${Date.now()}`;

  // Create first user context (Admin)
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  // Create second user context (Member)
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();

  try {
    // Admin creates family
    await adminPage.goto('/login');
    await adminPage.locator('input[name="familyName"]').fill(`[${testId}] Admin Family`);
    await adminPage.locator('input[name="userName"]').fill(`[${testId}] Admin User`);
    await adminPage.locator('input[name="email"]').fill(`${testId}-admin@example.com`);
    await adminPage.locator('input[name="password"]').fill('AdminPass123!');
    await adminPage.locator('button[type="submit"]').click();

    // Extract invite code from admin's session
    const inviteCodeElement = await adminPage.locator('[data-testid="invite-code"]');
    const inviteCode = await inviteCodeElement.textContent();

    // Member joins using invite code
    await memberPage.goto('/login');
    await memberPage.getByText('Join Family').click();
    await memberPage.locator('input[name="userName"]').fill(`[${testId}] Member User`);
    await memberPage.locator('input[name="email"]').fill(`${testId}-member@example.com`);
    await memberPage.locator('input[name="password"]').fill('MemberPass123!');
    await memberPage.locator('input[name="inviteCode"]').fill(inviteCode);
    await memberPage.locator('button[type="submit"]').click();

    // Both users should now be in the same family
    // Admin sends message
    await adminPage.locator('input[placeholder="Type a message"]').fill('Hello from admin');
    await adminPage.locator('button[aria-label="Send"]').click();

    // Member sees message
    await expect(memberPage.locator('text=Hello from admin')).toBeVisible();

    // Member replies
    await memberPage.locator('input[placeholder="Type a message"]').fill('Hello from member');
    await memberPage.locator('button[aria-label="Send"]').click();

    // Admin sees reply
    await expect(adminPage.locator('text=Hello from member')).toBeVisible();

  } finally {
    // Cleanup: Close contexts
    await adminContext.close();
    await memberContext.close();
  }
});
```

#### Critical: Using i18n Translations for UI Text

**ALWAYS use i18n translations** for all UI text assertions. OurChat uses a translation system (`src/lib/translations.ts`) with English as the default language.

**Setup:**
1. Import translations at the top of your test file
2. Create a helper function `t()` to access translations
3. Use `t('key')` for all text assertions

```typescript
import { translations } from '../../src/lib/translations';

// Helper to get translated text (default language is 'en')
const t = (key: keyof typeof translations.en): string => {
  return translations.en[key];
};

// Example usage in tests:
await expect(page.getByText(t('login.title'))).toBeVisible(); // "Family Chat"
await expect(submitButton).toContainText(t('login.createFamilyButton')); // "Create Family"
await page.getByText(t('login.switchToJoin')).click(); // "Have an invite code? Join Family"
```

**Why this matters:**
- UI text comes from translation files, not hardcoded strings
- Tests will break if you use hardcoded strings that don't match translations
- Using `t()` ensures tests stay in sync with actual UI text
- Makes tests resilient to translation changes

**Common translation keys:**
- `login.title` - "Family Chat"
- `login.createFamily` - "Create Family Account"
- `login.joinFamily` - "Join Family"
- `login.loginTitle` - "Login to Continue"
- `login.createFamilyButton` - "Create Family"
- `login.switchToJoin` - "Have an invite code? Join Family"
- `login.switchToCreate` - "Create a New Family"
- `login.switchToLogin` - "Already have an account? Login"

**Find more keys:** Check `src/lib/translations.ts` for all available translation keys.

#### Critical: Verify Locators Against UI Source Code

**ALWAYS verify locators** by inspecting the actual UI component source code before writing tests.

**Why this matters:**
- Input fields may use `id`, `name`, or `data-testid` attributes
- Buttons may have different text or aria-labels than expected
- Form structure varies between components
- Hardcoded locators will break if they don't match actual implementation

**How to verify locators:**

1. **Find the UI component** referenced in the story file
2. **Read the component source code** to identify actual attributes
3. **Use correct selectors** based on what you find

**Example verification process:**

```typescript
// WRONG: Assuming input uses name attribute
await page.locator('input[name="email"]').fill(email);

// CORRECT: Check the component first
// Found in src/components/auth/unified-login-screen.tsx:
// <Input id="email" type="email" ... />

// Use the actual attribute
await page.locator('#email').fill(email);
```

**Common patterns to check:**
- Input fields: Look for `id=`, `name=`, or `data-testid=` attributes
- Buttons: Check button text, `type=`, `aria-label=` attributes
- Form elements: Verify actual HTML structure and attributes
- Dynamic text: Use i18n translation keys, not hardcoded strings

**Steps to verify:**
1. Grep for the component file in the story's "File List" section
2. Read the component with the Read tool
3. Search for Input, Button, or relevant UI elements
4. Note the actual attributes (id, name, data-testid, etc.)
5. Write test locators using the verified attributes

#### Pattern 1: Form Field Validation
For ACs about user input:
```typescript
test('AC1: Form accepts all required fields', async ({ page }) => {
  const testId = `e2e-form-validation-${Date.now()}`;

  // Locate form fields
  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');

  // Verify visibility
  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();

  // Fill with valid data using test identifier
  await emailInput.fill(`${testId}@example.com`);
  await passwordInput.fill('ValidPassword123!');

  // Verify submit button enabled and has correct text
  const submitButton = page.locator('button[type="submit"]');
  await expect(submitButton).toBeEnabled();
  await expect(submitButton).toContainText(t('login.createFamilyButton'));
});
```

#### Pattern 2: Form Validation Errors
For ACs about validation:
```typescript
test('AC1: Form validation displays errors', async ({ page }) => {
  const submitButton = page.locator('button[type="submit"]');
  await submitButton.click();
  await page.waitForTimeout(500);

  // Verify error messages appear
  const errorMessages = page.locator('[role="alert"], .text-red-500, .text-destructive');
  await expect(errorMessages.first()).toBeVisible();
});
```

#### Pattern 3: API-Assisted E2E Flow with Data Tracking
For ACs requiring real data or complex setup:
```typescript
test('AC2-AC5: Complete user flow with real data', async ({ page }) => {
  const testId = `e2e-flow-${Date.now()}`;

  // Use page.request.post to create test data
  const response = await page.request.post(`${E2E_CONFIG.BASE_URL}/api/endpoint`, {
    headers: {
      'Content-Type': 'application/json',
      'x-test-bypass-rate-limit': 'true',
    },
    data: {
      name: `[${testId}] Test Name`,
      email: `${testId}@example.com`,
    },
  });

  expect(response.ok()).toBeTruthy();
  const data = await response.json();

  // Track created resource for cleanup
  createdUserIds.push(data.user.id);
  createdFamilyIds.push(data.family.id);

  // Use the real data in UI test
  await page.locator('input[name="field"]').fill(data.someValue);
  await page.locator('button[type="submit"]').click();

  // Verify response
  const apiResponse = await page.waitForResponse(
    response => response.url().includes('/api/endpoint')
  );
  expect(apiResponse.status()).toBe(200);
});
```

#### Pattern 4: Navigation and Redirects
For ACs about page navigation:
```typescript
test('AC4: User redirected after action', async ({ page }) => {
  // Perform action
  await page.locator('button[type="submit"]').click();

  // Wait for navigation
  await page.waitForTimeout(1500);

  // Verify URL changed
  const currentUrl = page.url();
  expect(currentUrl).toContain('/expected-path');
});
```

#### Pattern 5: UI Mode Toggling
For ACs about UI state changes:
```typescript
test('UI: Can toggle between modes', async ({ page }) => {
  // Verify initial state
  await expect(page.locator('[data-slot="card-description"]', { hasText: 'Initial Mode' })).toBeVisible();

  // Toggle to different mode
  await page.getByText('Switch to Other Mode').click();
  await page.waitForTimeout(300);

  // Verify state changed
  await expect(page.locator('[data-slot="card-description"]', { hasText: 'Other Mode' })).toBeVisible();
});
```

### Step 5: Reference Project Patterns

Consult `references/test-patterns.md` for OurChat-specific E2E test patterns.

For architectural context, read:
- `docs/solution-architecture.md` - Complete system architecture
- `docs/tech-spec-epic-*.md` - Epic-specific technical specifications
- Story file's "Architecture Change Note" section - Story-specific architecture details

Key patterns to follow:
- Use `E2E_CONFIG` for base URLs and endpoints
- Include story/AC documentation in test headers
- Use unique timestamps for test data (`Date.now()`)
- Add `x-test-bypass-rate-limit: 'true'` header for API calls
- Use `page.waitForTimeout()` for UI transitions (300-500ms)
- Use descriptive test names that include AC numbers

### Step 6: Write the Test File

Generate the complete `.spec.ts` file using the Write tool:
- Place in `tests/e2e/` directory
- Use proper naming convention
- Include all necessary imports
- Add comprehensive documentation headers
- Implement all test cases

### Step 7: Verify Test Quality

Before finishing, ensure:
1. **All ACs are covered** - Each acceptance criterion has at least one test
2. **Tests are runnable** - Use actual locators, valid syntax
3. **Tests are functional** - Focus on verifying behavior, not performance
4. **Tests use real data** - Leverage API-assisted setup when needed
5. **Tests are documented** - Clear comments explaining what each test verifies

## Important Guidelines

### Focus on Functionality
- DO verify features work correctly
- DO test happy paths and error cases
- DON'T add performance tests or timing assertions
- DON'T worry about rate limiting in tests

### Data Isolation is Mandatory
- **ALWAYS** prefix test data with unique identifiers: `[${testId}] Name` or `${testId}@example.com`
- **ALWAYS** track created resource IDs (users, families, messages, etc.)
- **ALWAYS** include `afterEach` cleanup to delete test data
- Use `Date.now()` to generate unique testIds: `e2e-story-x-x-${Date.now()}`

### Multi-User Testing for Chat Features
- **ALWAYS** use multiple browser contexts for chat/messaging features
- Typical pattern: Create admin context + member context(s)
- Test interactions: Admin sends message → Member receives → Member replies → Admin receives
- Clean up: Close all contexts in `finally` block
- Use multi-user contexts when testing:
  - Message sending/receiving
  - Real-time updates between users
  - Family member interactions
  - Invite code flows (admin creates, member joins)
  - Presence/typing indicators
  - Any feature involving multiple users

### Use OurChat Patterns
- Import from `./config` for E2E_CONFIG
- Use GraphQL mutations when mentioned in story
- Add bypass headers for test-specific routes
- Follow existing test file structure (see `tests/e2e/auth-onboarding.spec.ts`)

### Generate Runnable Code
- Use actual Playwright API syntax
- Use realistic locators that match implemented UI
- Include all necessary awaits and expects
- Make tests executable with `pnpm test:e2e`

### Adapt to Current Architecture
- Check story's "Architecture Change Note" section
- Use GraphQL mutations if mentioned, not REST endpoints
- Reference actual file paths from story's "File List"
- Match authentication patterns to implemented auth system

## Output Format

Always create a complete, runnable `.spec.ts` file that:
1. Can be executed immediately with `pnpm test:e2e`
2. Includes all necessary imports and configuration
3. Has clear documentation headers
4. Covers all acceptance criteria from the story
5. Follows OurChat's established testing patterns
