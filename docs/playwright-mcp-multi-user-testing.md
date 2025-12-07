# Playwright MCP Multi-User Testing

## Goal

Enable interactive multi-user testing of the OurChat app via Playwright MCP, allowing Claude to control two browser sessions simultaneously for testing real-time chat functionality.

## Problem

The Playwright MCP server provides browser automation tools, but:
- Only exposes **tabs** (via `browser_tabs`), not separate **contexts**
- Tabs share the same browser context (cookies, localStorage, IndexedDB)
- Cannot have User A logged in on one tab and User B on another

This makes multi-user testing impossible with a single browser instance.

## Research Findings

### Playwright MCP Documentation Review

Sources:
- [Testomat Playwright MCP Guide](https://testomat.io/blog/playwright-mcp-modern-test-automation-from-zero-to-hero/)
- [Microsoft Playwright MCP GitHub](https://github.com/microsoft/playwright-mcp)

Key findings:
1. Playwright MCP **supports** isolated contexts, but via server configuration flags, not runtime tools
2. Available flags: `--isolated`, `--shared-browser-context`, `--storage-state`
3. No `browser_context_new` tool exists for runtime context creation
4. `browser_run_code` could theoretically create contexts, but they wouldn't be tracked by MCP

### Workarounds Considered

| Approach | Pros | Cons |
|----------|------|------|
| Logout/login flow | Works with single browser | Can't test real-time features |
| Two MCP server instances | Full isolation | Need different browser types |
| Regular Playwright tests | Full context support | Not interactive via Claude |

## Solution: Dual Browser Instances

Run two Playwright MCP servers with different browsers:
- **Chromium** → User A
- **Firefox** → User B

Each browser is a completely separate process with isolated storage.

### Configuration

Created `.mcp.json` in project root:

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--browser", "chromium"],
      "env": {}
    },
    "playwright-firefox": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--browser", "firefox"],
      "env": {}
    }
  }
}
```

### Expected Tool Availability

After restart, Claude should have access to:
- `mcp__playwright__*` → Chromium (User A)
- `mcp__playwright-firefox__*` → Firefox (User B)

## Test Environment

Using the E2E test profile to leverage MailHog for email testing:

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3003 | Next.js dev server |
| Backend | 4001 | GraphQL API |
| MailHog | 8025 | Email capture UI |
| MailHog SMTP | 1025 | Email sending |

### Startup Commands

```bash
# Terminal 1: Backend with test profile
cd apps/backend && docker compose --profile test up

# Terminal 2: Frontend pointing to test backend
E2E_TEST=true \
NEXT_PUBLIC_GRAPHQL_HTTP_URL=http://localhost:4001/graphql \
NEXT_PUBLIC_GRAPHQL_WS_URL=ws://localhost:4001/graphql \
pnpm next dev --port 3003
```

## Current Status

- [x] Researched Playwright MCP context limitations
- [x] Identified dual-browser solution
- [x] Created project-level `.mcp.json` config
- [x] Restart Claude Code to load new MCP servers
- [x] Verify both browser tools are available
- [x] Test multi-user chat scenario ✅ **Completed 2025-12-07**

## Test Scenario (Completed)

1. **Chromium (User A)**: Register, create family, send message ✅
2. **Firefox (User B)**: Register, join family via invite, receive message ✅
3. Verify real-time message delivery between browsers ✅

### Test Results

**Date**: December 7, 2025

| Step | Browser | Action | Result |
|------|---------|--------|--------|
| 1 | Chromium | Register Alice Admin | ✅ Email verified via MailHog |
| 2 | Chromium | Create "Test Family Alpha" | ✅ Family created with invite code |
| 3 | Firefox | Register Bob Member | ✅ Email verified via MailHog |
| 4 | Firefox | Join family via invite code | ✅ Successfully joined family |
| 5 | Chromium | Send message | ✅ Message encrypted and sent |
| 6 | Firefox | Receive message in real-time | ✅ WebSocket subscription delivered message |

**Key findings**:
- E2EE worked correctly - messages encrypted by Alice, decrypted by Bob
- WebSocket subscriptions functioned across isolated browser contexts
- Family key sharing via invite code worked as expected

## Considerations

### E2EE Keys
Each user needs their own NaCl keypair in IndexedDB. The test fixtures handle this, but via MCP we may need to:
- Use `browser_evaluate` to call key management functions
- Or go through the full registration flow which generates keys

### Firefox localStorage Quirk
Firefox throws "The operation is insecure" if accessing localStorage on `about:blank`. Always navigate to the app URL first before injecting tokens.

## Related Files

- `playwright.config.ts` - E2E test configuration
- `tests/e2e/fixtures.ts` - Test fixture helpers (MailHog, auth setup)
- `docs/e2e-test-architecture.md` - Full E2E architecture docs
