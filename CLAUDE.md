- The backend is in @apps/backend/ and uses docker-compose to restart
- NEVER hardcode human language strings in UI components. All user-facing text must use the translation system in src/lib/translations.ts
- The frontend uses Next.js static export (output: 'export'). Never call router.push() or other browser-dependent code during render. Use useEffect for client-side navigation and redirects.

## Project Skills
Located in `.claude/skills/`. Read SKILL.md for usage.
- restart/start/stop dev env → `manage-local-dev-env`
- generate e2e tests → `e2e-playwright-test-generator`
- database migrations → `database-migrations`
- update graphql/db schemas → `schema-updater`
- adapt prototype to production → `prototype-to-production-adaptation`
- **interactive browser testing with Playwright MCP** → `playwright-mcp-multi-user-testing`

**Auto-trigger:** When asked to "use Playwright MCP to test" or "test with the browser", invoke the `playwright-mcp-multi-user-testing` skill first.

## Testing Commands

### E2E Tests (Playwright)

**Full architecture documentation:** See `docs/e2e-test-architecture.md`

E2E tests use an isolated test environment (services auto-start via Playwright):
- Test frontend: port 3003
- Test backend: port 4001 (uses test database on port 5433)
- MailHog: port 8025 (Web UI) / port 1025 (SMTP) - captures all emails for testing

```bash
# Run all E2E tests (auto-starts backend + frontend)
pnpm exec playwright test

# Run specific test file
pnpm exec playwright test tests/e2e/invite-language-selection.spec.ts

# Run with visible browser
pnpm exec playwright test --headed

# Run with UI mode for debugging
pnpm exec playwright test --ui

# View captured emails during debugging
open http://localhost:8025
```

### Backend Unit Tests
```bash
cd apps/backend && pnpm test
```

### Frontend Unit Tests
```bash
pnpm test:unit
```

## E2E Test Fixtures

### Decision Framework: Fixtures vs MailHog

| Approach | When to Use | Example Tests |
|----------|-------------|---------------|
| **Fixtures** | Test needs authenticated user (not testing auth) | Messaging, settings, invites |
| **MailHog** | Test specifically tests email/verification flow | Registration, email verification, E2EE key sharing |

**Rule:** If auth is just a prerequisite → Fixtures. If testing email delivery → MailHog.

### Fixture-Based Setup (Recommended for Most Tests)

```typescript
import { setupFamilyAdminTest } from './fixtures';

test('Feature test', async ({ page }) => {
  const testId = `feature-${Date.now()}`;
  const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

  try {
    await page.goto('/feature-page');
    // ... test assertions ...
  } finally {
    await cleanup();  // Always cleanup
  }
});
```

The `setupFamilyAdminTest()` function:
- Creates user and family via `test-support` GraphQL API
- Generates real NaCl keypairs for E2EE
- Injects auth token and keys into browser storage
- Returns fixture data and cleanup function

### Multi-User Testing

Use `browser.newContext()` (not `context.newPage()`) to isolate auth state:

```typescript
test('Admin and member', async ({ page, browser }) => {
  const { fixture, cleanup } = await setupFamilyAdminTest(page, testId);

  try {
    // Admin actions on `page`...

    // CRITICAL: Separate context for member
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();

    try {
      // Member actions on `memberPage`...
    } finally {
      await memberContext.close();
    }
  } finally {
    await cleanup();
  }
});
```

### Key E2E Testing Patterns

**Encryption Keys**: The app uses NaCl box keypairs stored in IndexedDB with Dexie encryption. For E2E tests:
- Generate real keypairs using `nacl.box.keyPair()` (not mock data)
- Pass the public key to the backend when creating test fixtures
- Store the matching private key using the production `storePrivateKey` function exposed via `window.__e2e_storePrivateKey`
- This prevents the "Encryption Keys Not Found" modal from appearing

**Firefox localStorage**: Firefox throws "The operation is insecure" if you access localStorage via `page.evaluate()` without a valid origin context (e.g., on `about:blank`). Always navigate to the app URL first before injecting tokens.

**Auth State Race Conditions**: When navigating to protected pages after injecting auth tokens, the page may redirect before the auth context finishes loading. Protected pages should check `loading` state from `useAuth()` before redirecting unauthenticated users:
```typescript
useEffect(() => {
  if (!loading && !user?.activeFamily) {
    router.push('/family-setup');
  }
}, [user, loading, router]);
```

### Email Testing with MailHog

E2E tests use MailHog to capture emails sent by the backend. The test backend is configured to send emails via SMTP to MailHog instead of the Brevo API.

**MailHog Helper Functions** (in `tests/e2e/fixtures.ts`):
```typescript
// Clear all emails before a test
await clearMailHogEmails();

// Wait for an email to arrive
const email = await waitForMailHogEmail('to', 'user@example.com');

// Search emails by criteria
const emails = await searchMailHogEmails('containing', 'verification');

// Extract tokens/codes from email body
const token = extractVerificationToken(email);
const code = extractInviteCode(email);
```

**MailHog Web UI**: Visit http://localhost:8025 to view captured emails during test debugging.

### Common Pitfalls (Verified Fixes)

**Toast Collisions**: Multiple toasts may appear simultaneously. Filter by expected content:
```typescript
// WRONG: May capture wrong toast (e.g., "Logged in!")
const toast = page.locator('[data-sonner-toast]');

// CORRECT: Filter by expected content
const inviteToast = page.locator('[data-sonner-toast]').filter({ hasText: /FAMILY-/ });
```

**Strict Mode Violations**: Use `exact: true` or `.first()` when multiple elements match:
```typescript
await page.getByRole('button', { name: 'Done', exact: true }).click();
await page.getByText(fixture.family.name).first();
```

**IndexedDB Key Format**: Family keys are stored as `familyKey:{familyId}`, not `familyKey`. Use `getAllKeys()` to find them.