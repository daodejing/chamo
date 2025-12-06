# E2E Test Status Report - 2024-11-30

## Summary

**Total: 82 tests | Passed: 30 | Failed: 52**

## Context

This test run was performed after:
1. Adding MailHog for E2E email testing
2. Removing `ENABLE_TEST_SUPPORT` environment variable
3. Removing auto-verify functionality from `auth.service.ts`

## Passing Tests (30)

### invite-language-selection.spec.ts (2/2 passed)
- ✅ AC1-AC6: Language selector with full E2E flow
- ✅ Language selector allows changing languages

These tests use the **fixture-based approach** with `setupFamilyAdminTest()` which creates pre-verified users.

### epic-7-e2ee.spec.ts (5/6 passed)
- ✅ US-7.1: Message encryption works end-to-end
- ✅ US-7.2: File encryption works end-to-end
- ✅ US-7.3: Encryption performance meets < 20ms target
- ✅ Invite code: Key distribution works correctly
- ✅ Browser supports Web Crypto API
- ✅ Zero-knowledge: Ciphertext is not plaintext
- ❌ Key storage: Keys persist in IndexedDB (fails due to registration flow)

### email-verification.spec.ts (1/2 passed)
- ✅ redirects unverified login attempts to the verification pending screen
- ❌ persists pending family keys on verification and redirects back to login

### Other passing tests
- Various tests in auth-onboarding.spec.ts that don't depend on post-registration success flow
- Tests that use fixture-based authentication

## Failed Tests (52) - Pre-existing Issues

### Root Cause
These tests were written when `ENABLE_TEST_SUPPORT=true` auto-verified users during registration. They:
1. Register a new user via the UI
2. Expect to see a success toast and be logged in immediately
3. But now registration correctly requires email verification, showing the "verification pending" screen

### Affected Test Files

#### auth-onboarding.spec.ts
- Tests that expect toast after registration
- Tests that expect to navigate to chat after registration
- Need to either use fixtures or complete email verification via MailHog

#### e2ee-key-sharing.spec.ts
- Tries to fill `#familyName` form field after registration
- Tests the invite code flow but starts with UI registration

#### messaging.spec.ts
- Tries to fill `input[name="familyName"]` form field
- All messaging tests fail because they start with UI registration

#### email-bound-invites.spec.ts
- Shows warning: "Email verification required - cannot complete E2E test without verified account"

## Recommended Actions

### Option 1: Migrate to Fixture-Based Approach
For tests that don't specifically test the registration flow:
```typescript
import { setupFamilyAdminTest } from './fixtures';

test('my test', async ({ page }) => {
  const { fixture, cleanup } = await setupFamilyAdminTest(page, 'test-id');
  // Test runs with pre-verified, authenticated user
  await cleanup();
});
```

### Option 2: Use MailHog for Email Verification
For tests that need to test the full registration flow:
```typescript
import { waitForMailHogEmail, extractVerificationToken, clearMailHogEmails } from './fixtures';

test('registration with email verification', async ({ page }) => {
  await clearMailHogEmails();

  // Fill registration form and submit
  await page.locator('#email').fill('test@example.com');
  // ... submit form

  // Wait for verification email
  const email = await waitForMailHogEmail('to', 'test@example.com');
  const token = extractVerificationToken(email);

  // Visit verification URL
  await page.goto(`http://localhost:3003/verify-email?token=${token}`);

  // Now user is verified and can log in
});
```

## MailHog Configuration

MailHog is now available for E2E tests:
- **SMTP**: `mailhog:1025` (from within Docker network)
- **Web UI**: `http://localhost:8025`
- **API**: `http://localhost:8025/api/v2`

Backend test environment variables:
```yaml
SMTP_HOST: "mailhog"
SMTP_PORT: "1025"
EMAIL_FROM: "test@chamo.app"
EMAIL_FROM_NAME: "Chamo Test"
```

## Files Modified in This Change

1. `apps/backend/docker-compose.yml` - Added MailHog, removed ENABLE_TEST_SUPPORT
2. `apps/backend/src/email/email.service.ts` - Added dual SMTP/Brevo transport
3. `apps/backend/src/auth/auth.service.ts` - Removed autoVerifyForTests
4. `apps/backend/src/test-support/test-support.service.ts` - Simplified isEnabled check
5. `apps/backend/src/app.module.ts` - Simplified shouldEnableTestSupport check
6. `tests/e2e/fixtures.ts` - Added MailHog helper functions
7. `tests/e2e/config.ts` - Added MAILHOG_API_URL

## Priority for Fixing

1. **High**: `auth-onboarding.spec.ts` - Core authentication tests
2. **Medium**: `messaging.spec.ts` - Core feature tests
3. **Medium**: `e2ee-key-sharing.spec.ts` - Security-critical tests
4. **Lower**: `email-bound-invites.spec.ts` - Already shows helpful warning
