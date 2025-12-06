# E2E Test Architecture

## Overview

This document defines the verified and working patterns for E2E testing in Chamo. Following these patterns ensures tests are reliable, maintainable, and isolated.

## Infrastructure

### Test Environment (Isolated Ports)

| Service | Port | Container | Purpose |
|---------|------|-----------|---------|
| Frontend (test) | 3003 | Playwright-managed | Next.js dev server |
| Backend (test) | 4001 | ourchat_backend_test | GraphQL API |
| Database (test) | 5433 | ourchat_postgres_test | PostgreSQL |
| MailHog SMTP | 1025 | ourchat_mailhog | Email capture |
| MailHog Web UI | 8025 | ourchat_mailhog | Email inspection |

### Auto-Start Configuration

Playwright automatically starts both backend and frontend via `webServer` array in `playwright.config.ts`:

```typescript
webServer: [
  {
    // Backend services (docker compose with test profile)
    // Try "docker compose" (v2) first, fall back to "docker-compose" (v1) for local dev
    command: 'docker compose --profile test up 2>/dev/null || docker-compose --profile test up',
    url: 'http://localhost:4001/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    cwd: './apps/backend',
  },
  {
    // Frontend dev server on port 3003
    command: 'E2E_TEST=true NEXT_PUBLIC_GRAPHQL_HTTP_URL=http://localhost:4001/graphql pnpm next dev --port 3003',
    url: 'http://localhost:3003',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
],
```

**Key benefits:**
- Tests can run with `pnpm exec playwright test` (no manual docker-compose)
- `reuseExistingServer` skips startup if services already running (faster local dev)
- CI always starts fresh containers

---

## Decision Framework: Fixtures vs MailHog

Choose the appropriate approach based on **what the test is actually testing**:

| Approach | When to Use | Examples |
|----------|-------------|----------|
| **Fixtures** | Test needs authenticated user as prerequisite (not testing auth) | Messaging, settings, invites |
| **MailHog** | Test specifically tests email/registration/verification flow | Registration, email verification, E2EE key sharing via invite |

### Rule of Thumb
- If the user needs to be logged in but auth isn't the focus → **Fixtures**
- If the test validates email delivery or verification → **MailHog**

---

## Pattern 1: Fixture-Based Setup (Recommended for Most Tests)

Use this when tests need an authenticated user with a family, but aren't testing the registration flow.

### Example: Feature Testing with Fixtures

```typescript
import { test, expect } from '@playwright/test';
import { setupFamilyAdminTest } from './fixtures';

test.describe('Story X.Y: Feature Name', () => {
  test('AC1: User can do something', async ({ page }) => {
    const testId = `feature-${Date.now()}`;

    // SETUP: Create family admin via API and inject auth state
    const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

    try {
      // Navigate to feature page (user is already authenticated)
      await page.goto('/feature-page');
      await page.waitForLoadState('networkidle');

      // Verify we're on the correct page
      await expect(page.getByText(fixture.family.name).first()).toBeVisible({
        timeout: 10000,
      });

      // ... test assertions ...

    } finally {
      // TEARDOWN: Always cleanup test data
      await cleanup();
    }
  });
});
```

### What `setupFamilyAdminTest()` Does

1. Generates a real NaCl keypair for E2EE
2. Creates user and family via `test-support` GraphQL API
3. Navigates to app origin (required for Firefox localStorage access)
4. Injects auth token into localStorage
5. Stores private key using production `storePrivateKey` function
6. Injects family encryption key into IndexedDB
7. Reloads page to ensure auth state is loaded
8. Returns fixture data and cleanup function

### Key Points

- **Always use `try/finally`** to ensure cleanup runs even if test fails
- **Use `fixture.family.name.first()`** when text might appear multiple times (avoids strict mode violations)
- **Test data is isolated** - each test creates unique users/families via timestamp-based `testId`

---

## Pattern 2: MailHog-Based Testing

Use this when testing email flows (registration, verification, invite emails).

### Example: Email Verification Flow

```typescript
import { test, expect } from '@playwright/test';
import { clearMailHogEmails, waitForMailHogEmail, extractVerificationToken, cleanupTestData } from './fixtures';

test.describe('Email Verification Flow', () => {
  test('User completes email verification', async ({ page }) => {
    const testId = `verify-${Date.now()}`;

    // STEP 1: Clear MailHog before test (isolation)
    await clearMailHogEmails();

    // STEP 2: Register via UI
    await page.goto('/login');
    await page.getByText('Create account').click();

    const userEmail = `${testId}@example.com`;
    await page.locator('#email').fill(userEmail);
    await page.locator('#password').fill('TestPassword123!');
    await page.locator('button[type="submit"]').click();

    // STEP 3: Wait for verification email
    const email = await waitForMailHogEmail('to', userEmail, 15000);
    expect(email).toBeTruthy();

    // STEP 4: Extract token and verify
    const token = extractVerificationToken(email);
    expect(token, 'Verification token should be in email').toBeTruthy();

    await page.goto(`/verify-email?token=${token}`);
    await expect(page.getByText(/verified|success/i)).toBeVisible({ timeout: 15000 });

    // CLEANUP: Delete test user
    await cleanupTestData({ emailPatterns: [testId] });
  });
});
```

### MailHog Helper Functions

| Function | Purpose |
|----------|---------|
| `clearMailHogEmails()` | Delete all emails (call before each email-related test) |
| `waitForMailHogEmail(kind, query, timeoutMs?)` | Poll until email arrives (default 10s) |
| `searchMailHogEmails(kind, query)` | Immediate search, returns array |
| `extractVerificationToken(email)` | Extract `?token=...` from email body |
| `extractInviteCode(email)` | Extract `?code=...` from email body |

### Email Token Extraction

Emails are often encoded in quoted-printable format. The `extractVerificationToken()` function handles this automatically:

```typescript
// Handles both plain and quoted-printable encoded emails
// Decodes =3D to = and =XX hex codes
const token = extractVerificationToken(email);
```

---

## Pattern 3: Multi-User Testing with Browser Context Isolation

When testing interactions between multiple users (e.g., admin invites member), use **separate browser contexts** to avoid auth state collision.

### Example: Admin and Member Interaction

```typescript
import { test, expect } from '@playwright/test';
import { setupFamilyAdminTest, clearMailHogEmails, waitForMailHogEmail } from './fixtures';

test('Admin invites member who joins', async ({ page, browser }) => {
  const testId = `multi-user-${Date.now()}`;

  // SETUP: Admin via fixtures
  const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

  try {
    // Admin creates invite...
    await page.goto('/family/settings');
    // ... create invite code ...

    // CRITICAL: Use browser.newContext() for member (NOT context.newPage())
    // This ensures completely isolated auth state
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();

    try {
      // Clear MailHog before member registration
      await clearMailHogEmails();

      // Member registers...
      await memberPage.goto('/join?code=' + encodeURIComponent(inviteCode));
      // ... member registration flow ...

      // Wait for member's verification email
      const email = await waitForMailHogEmail('to', memberEmail);
      // ... complete verification ...

    } finally {
      await memberContext.close();
    }
  } finally {
    await cleanup();
  }
});
```

### Why `browser.newContext()` Instead of `context.newPage()`?

| Approach | Auth State | Use Case |
|----------|------------|----------|
| `context.newPage()` | Shared cookies/localStorage | Same user, multiple tabs |
| `browser.newContext()` | Completely isolated | Different users |

---

## Pattern 4: Toast Notifications

When waiting for toasts, filter by content to avoid collisions with other toasts (e.g., "Logged in!"):

```typescript
// WRONG: May capture the wrong toast
const toast = page.locator('[data-sonner-toast]');

// CORRECT: Filter by expected content
const inviteToast = page.locator('[data-sonner-toast]').filter({ hasText: /FAMILY-/ });
await expect(inviteToast).toBeVisible({ timeout: 15000 });
```

---

## Pattern 5: IndexedDB Key Verification

The app stores encryption keys in IndexedDB with the format `familyKey:{familyId}`. To verify:

```typescript
const storedKey = await page.evaluate(async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ourchat-keys');

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['keys'], 'readonly');
      const store = transaction.objectStore('keys');

      // Get all keys and find familyKey:*
      const getAllKeysRequest = store.getAllKeys();
      getAllKeysRequest.onsuccess = async () => {
        const keys = getAllKeysRequest.result as string[];
        const familyKeyName = keys.find(k => k.startsWith('familyKey:'));

        if (!familyKeyName) {
          resolve(null);
          return;
        }

        const getRequest = store.get(familyKeyName);
        getRequest.onsuccess = async () => {
          const cryptoKey = getRequest.result;
          // Export CryptoKey to raw bytes then base64
          const exported = await crypto.subtle.exportKey('raw', cryptoKey);
          const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
          resolve(base64);
        };
      };
    };
  });
});
```

---

## Pattern 6: Button Selectors (Strict Mode)

When multiple buttons match a selector, use `exact: true` or additional constraints:

```typescript
// WRONG: Fails if "Close" and "Done" buttons both visible
await page.getByRole('button', { name: /done/i }).click();

// CORRECT: Exact match
await page.getByRole('button', { name: 'Done', exact: true }).click();

// OR: Use first() when appropriate
await page.getByText(fixture.family.name).first();
```

---

## File Structure

```
tests/e2e/
├── config.ts              # E2E_CONFIG: URLs, timeouts
├── fixtures.ts            # Setup helpers, MailHog, cleanup
├── global-teardown.ts     # Post-run cleanup
├── *.spec.ts              # Test files
```

---

## Registration Flow (2024+ Architecture)

The current registration flow after Story 1.10:

1. **Register** → `/login` (toggle to Create Account mode)
   - Fill: userName, email, password
   - Note: `familyName` field removed from registration

2. **Verification Pending** → `/verification-pending`
   - User sees "Check your email" message

3. **Verify Email** → `/verify-email?token=...`
   - Token extracted from verification email

4. **Login** → `/login`
   - After verification, user logs in with credentials

5. **Family Setup** → `/family-setup`
   - User creates or joins family
   - Invite code toast appears after family creation

---

## Best Practices Checklist

- [ ] Use unique `testId` with timestamp for test isolation
- [ ] Always use `try/finally` with fixtures for cleanup
- [ ] Clear MailHog before email-related tests
- [ ] Use `browser.newContext()` for multi-user tests
- [ ] Filter toasts by expected content
- [ ] Use `exact: true` or `.first()` for ambiguous selectors
- [ ] Prefer `waitForLoadState('networkidle')` over arbitrary timeouts
- [ ] Keep `waitForTimeout()` under 1000ms (use sparingly)
- [ ] Handle quoted-printable encoding when extracting email tokens

---

## Running Tests

```bash
# Run all E2E tests (auto-starts services)
pnpm exec playwright test

# Run specific test file
pnpm exec playwright test tests/e2e/messaging.spec.ts

# Run with visible browser
pnpm exec playwright test --headed

# Run with UI mode for debugging
pnpm exec playwright test --ui

# View MailHog inbox during debugging
open http://localhost:8025
```

---

## Troubleshooting

### Firefox localStorage Security Error
**Error:** "The operation is insecure"
**Cause:** Trying to access localStorage on `about:blank`
**Fix:** Navigate to app origin before injecting tokens (handled by `injectAuthToken()`)

### Toast Not Found
**Cause:** Multiple toasts displayed simultaneously
**Fix:** Filter by content: `.filter({ hasText: /expected-text/ })`

### Strict Mode Violation
**Cause:** Selector matches multiple elements
**Fix:** Use `.first()`, `exact: true`, or more specific selector

### Email Token Extraction Failed
**Cause:** Quoted-printable encoding (`=3D` instead of `=`)
**Fix:** Use `extractVerificationToken()` which decodes automatically

### Auth State Collision in Multi-User Tests
**Cause:** Using `context.newPage()` shares cookies
**Fix:** Use `browser.newContext()` for separate auth states

---

## CI/CD Integration

### How E2E Tests Run in GitHub Actions

**IMPORTANT:** The CI workflow does NOT manually start docker-compose. Playwright handles everything via its `webServer` configuration.

```yaml
# .github/workflows/ci.yml - E2E Tests job
- name: Install Playwright browsers
  run: pnpm exec playwright install --with-deps firefox

# Playwright's webServer config handles docker-compose startup automatically
# See playwright.config.ts - uses --profile test (port 4001) with health check

- name: Run E2E tests
  run: pnpm test:e2e
  env:
    CI: true
```

### Why This Approach?

| Approach | Problem |
|----------|---------|
| Manual docker-compose in CI | Conflicts with Playwright's webServer, wrong ports, duplicate startup |
| Playwright webServer | Built-in health checks, proper timeout handling, automatic teardown |

### Key Configuration

In `playwright.config.ts`:
- `reuseExistingServer: !process.env.CI` - CI always starts fresh containers
- Backend uses `--profile test` (port 4001, not 4000)
- 120 second timeout for docker startup
- `globalTeardown` handles cleanup

### Common CI Failure: Backend Timeout

**Symptom:** "Wait for services to be ready" times out with exit code 124

**Root Causes:**
1. CI workflow manually starts wrong docker profile (port 4000 instead of 4001)
2. TypeScript compilation in watch mode takes too long

**Fix:** Let Playwright handle startup. Remove any manual `docker compose up` steps from CI workflow.

---

## Smoke Test Strategy

E2E tests are organized into two tiers for optimal CI performance:

### Test Tiers

| Tier | Trigger | Tests | Timeout | Purpose |
|------|---------|-------|---------|---------|
| **Smoke** | Every push/PR | ~3 tests | 15 min | Quick feedback on critical paths |
| **Full Suite** | Nightly (3 AM UTC) | ~86 tests | 60 min | Comprehensive coverage |

### Smoke Tests (`@smoke` tag)

Smoke tests cover the most critical user journeys:

1. **E2EE & Key Sharing**
   - `e2ee-key-sharing.spec.ts`: Full registration + family creation + key sharing flow
   - `epic-7-e2ee.spec.ts`: Message encryption (US-7.1)

2. **Messaging**
   - `messaging.spec.ts`: Send message (AC2)

> **Note:** Additional smoke tests for story-1.1, 1.2, 1.3 are pending - they need updates
> to use the modern registration flow (where family creation is separate from registration).

### Running Tests

```bash
# Run smoke tests only (CI default)
pnpm test:e2e --grep @smoke

# Run full suite (nightly)
pnpm test:e2e

# Run smoke tests locally
pnpm exec playwright test --grep @smoke
```

### Adding Smoke Tag

To mark a test as smoke, add `@smoke` to the test name:

```typescript
test('@smoke Critical user journey', async ({ page }) => {
  // ...
});
```

### CI Workflows

- **ci.yml** (on push/PR): Runs `pnpm test:e2e --grep @smoke`
- **ci-nightly.yml** (cron: 0 3 * * *): Runs full `pnpm test:e2e`

### Criteria for Smoke Tests

A test should be tagged `@smoke` if it:
- Tests a critical user journey (registration, login, core feature)
- Would indicate a major regression if it fails
- Is stable and doesn't flake
- Completes in under 2 minutes
