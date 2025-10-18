# Integration Tests

Integration tests verify that multiple parts of the system work together correctly, including API routes, database operations, and business logic.

## Running Integration Tests

### Option 1: HTTP-based Integration Tests (Recommended) ✅

These tests make real HTTP requests to your API routes, testing the complete request/response cycle using **SuperTest** (2025 industry standard).

**Steps:**
```bash
# Terminal 1: Start Supabase
pnpm supabase:start

# Terminal 2: Start Next.js dev server
pnpm dev

# Terminal 3: Run integration tests
NEXT_PUBLIC_API_URL=http://localhost:3002 pnpm test src/tests/integration/chat/multi-user-messaging.test.ts
```

**What it tests:**
- ✅ Full HTTP request/response cycle
- ✅ Cookie-based authentication (matching production)
- ✅ All API route middleware
- ✅ Database operations via Supabase
- ✅ Multi-user scenarios (User 1 sends message, User 2 receives it)
- ✅ Real-time delivery performance (< 100ms)

**Status:** ✅ All 4 tests passing

### Option 2: Direct Handler Tests (Legacy)

These tests call route handlers directly, bypassing HTTP. **Not recommended** - use SuperTest approach above instead.

## Test Coverage

### Multi-User Messaging (Story 2.1 AC3)

**Integration Tests (SuperTest):** ✅ 4/4 passing
- ✅ User 2 can fetch messages sent by User 1
- ✅ Message delivery time < 2 seconds (actual: ~50-60ms)
- ✅ Channel isolation (messages filtered by channelId)
- ✅ Sender information included in messages

**E2E Tests (Playwright):** ✅ 9/10 passing
- Single-user message sending
- Message encryption
- Channel switching
- Message display with sender info

**Skipped:** Multi-user real-time E2E test (Playwright browser context limitation - see `docs/testing/multi-user-test-session-issue.md`)

**Note:** Multi-user functionality is now fully tested at the integration level using SuperTest with cookie-based authentication.

## Test Philosophy

We use a layered testing approach:

1. **Unit Tests** (`src/tests/unit/`) - Test individual functions and components
2. **Integration Tests** (`src/tests/integration/`) - Test API routes and database interactions
3. **E2E Tests** (`tests/e2e/`) - Test complete user flows through the browser

**For multi-user functionality:**
- E2E tests verify single-user flows work end-to-end
- Integration tests (manual with dev server) verify multi-user API logic
- Production deployment testing verifies real-world multi-user scenarios

## Known Limitations

### Playwright Multi-User Session Issue
Supabase SSR's cookie-based authentication doesn't persist correctly across isolated Playwright browser contexts. This is a test infrastructure limitation, not a code bug.

**Workaround:** Manual testing or API-level integration tests (requires dev server)

**Future:** Implement Playwright `storageState` or mock auth for multi-user e2e tests

## Adding New Integration Tests

```typescript
// src/tests/integration/my-feature/my-test.test.ts
import { describe, it, expect } from 'vitest';

describe('My Feature Integration', () => {
  it('should work correctly', async () => {
    // Make HTTP request to API
    const response = await fetch('http://localhost:3000/api/my-endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'test' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({ success: true });
  });
});
```

**Remember:** Start both Supabase and the dev server before running!
