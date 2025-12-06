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

## Testing Commands

### E2E Tests (Playwright)
E2E tests use an isolated test environment:
- Test frontend: port 3003
- Test backend: port 4001 (uses test database on port 5433)
- MailHog: port 8025 (Web UI) / port 1025 (SMTP) - captures all emails for testing

```bash
# Start test backend (required before running E2E tests)
cd apps/backend && docker-compose --profile test up -d

# Run all E2E tests
pnpm exec playwright test

# Run specific E2E test file
pnpm exec playwright test tests/e2e/invite-language-selection.spec.ts

# Run with visible browser
pnpm exec playwright test --headed

# Run with UI mode for debugging
pnpm exec playwright test --ui

# Stop test backend when done
cd apps/backend && docker-compose --profile test down
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
E2E tests use the fixture-based setup pattern (see `tests/e2e/fixtures.ts`):
- Test data is created via the `test-support` GraphQL API
- Auth tokens and keys are injected into the browser
- Test data is cleaned up after each test via `testCleanup` mutation

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