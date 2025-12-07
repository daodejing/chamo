---
name: playwright-mcp-multi-user-testing
description: Interactive multi-user testing of web applications via Playwright MCP with dual browser instances. This skill should be used when testing real-time features between multiple users (chat, collaboration, notifications), when needing isolated browser contexts for different authenticated users, or when debugging multi-user interaction flows interactively.
---

# Playwright MCP Multi-User Testing

## Overview

This skill enables interactive multi-user testing using Playwright MCP with two separate browser instances (Chromium and Firefox). Each browser has completely isolated storage (cookies, localStorage, IndexedDB), allowing simultaneous login of different users to test real-time features like chat, collaboration, and notifications.

## When to Use

- Testing real-time messaging/chat between users
- Verifying WebSocket subscriptions work across sessions
- Testing invite flows, family/team joins
- Debugging multi-user interaction issues interactively
- Validating E2EE (end-to-end encryption) between users

## Configuration

### Dual Browser MCP Setup

Create `.mcp.json` in project root with two Playwright MCP server instances:

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

After creating this file, restart Claude Code to load the MCP servers.

### Available Tools

After restart, two sets of browser tools become available:
- `mcp__playwright__*` - Chromium instance (User A)
- `mcp__playwright-firefox__*` - Firefox instance (User B)

## Multi-User Testing Workflow

### Step 1: Start Test Environment

Ensure the test backend and frontend are running:

```bash
# Terminal 1: Backend with test profile
cd apps/backend && docker compose --profile test up

# Terminal 2: Frontend pointing to test backend
E2E_TEST=true \
NEXT_PUBLIC_GRAPHQL_HTTP_URL=http://localhost:4001/graphql \
NEXT_PUBLIC_GRAPHQL_WS_URL=ws://localhost:4001/graphql \
pnpm next dev --port 3003
```

### Step 2: Launch Both Browsers

Use `browser_navigate` on both MCP servers to open the application:

1. `mcp__playwright__browser_navigate` to `http://localhost:3003`
2. `mcp__playwright-firefox__browser_navigate` to `http://localhost:3003`

Optionally resize browsers using `browser_resize` (e.g., 720x900 for side-by-side viewing).

### Step 3: User A Setup (Chromium)

1. Register a new user account
2. Verify email via MailHog at `http://localhost:8025`
3. Log in
4. Create a family/team
5. Copy the invite code

### Step 4: User B Setup (Firefox)

1. Use the invite code to join family flow
2. Register a new user account
3. Verify email via MailHog
4. Log in - should be in the same family as User A

### Step 5: Test Real-Time Features

1. User A sends a message
2. Verify User B receives it via WebSocket subscription
3. Check console logs for subscription events

## Comprehensive Observation Discipline

**CRITICAL:** Testing is not just about verifying story acceptance criteria. Every action is an opportunity to discover issues across the entire application.

### After EVERY Action Checklist

After each browser action (click, navigate, submit), observe and document:

1. **Console logs** - Any errors, warnings, or unexpected messages?
2. **Network requests** - Failed requests, slow responses, unexpected calls?
3. **Visual state** - Correct page? Expected UI elements? Unexpected changes?
4. **Data correctness** - Counts accurate? Names correct? Timestamps valid?
5. **UX quality** - Confusing flows? Missing feedback? Broken translations?

### What Constitutes an Issue

Document ANY of these, regardless of story relevance:

| Category | Examples |
|----------|----------|
| **Bugs** | Incorrect data, broken functionality, errors |
| **UX Problems** | Confusing flows, missing guidance, unclear errors |
| **Translation Issues** | Untranslated keys, wrong language, grammar errors |
| **Visual Issues** | Layout problems, alignment, responsiveness |
| **Data Display** | Wrong counts, stale data, missing items |
| **Console Noise** | Errors that succeed, unnecessary warnings |
| **Performance** | Slow loads, excessive re-renders |
| **Accessibility** | Missing labels, keyboard navigation |

### Avoiding Narrow Focus

**DO NOT** limit observations to just the story being tested. If testing "Remove Member" and you notice:
- Translation keys showing as raw text → **Document it**
- Member count showing wrong number → **Document it**
- Duplicate logout buttons → **Document it**
- Auth state validation missing → **Document it**

These are all valid issues even if unrelated to the story's acceptance criteria.

### Staying in Observation Mode

To maintain comprehensive observation throughout a testing session:

1. **Start each action** by stating what you're testing AND that you'll observe for any issues
2. **After each action**, explicitly check: "Checking console... Checking visual state... Checking data..."
3. **Before moving on**, confirm: "No new issues observed" OR document what was found
4. **At session end**, review all observations and write to issues file

### Example Observation Pattern

```
[Action] Clicking "Remove" button for Bob Member
[Observe Console] ✓ No errors
[Observe Visual]
  - ✓ Confirmation modal appeared
  - ⚠️ Notice: Header still shows "Test Family · 2 members"
[Observe Data] Will verify count after confirmation
[Document] Potential issue: member count not updated immediately (may be expected)
```

## Critical Patterns

### Screenshot-Driven Testing

**Take screenshots after every significant action** to catch unexpected behavior early:

1. After navigation - verify correct page loaded
2. After form submission - check for error toasts or unexpected redirects
3. After mutations - confirm UI updated correctly
4. When something seems off - visual verification catches issues snapshots miss

```
mcp__playwright__browser_take_screenshot({ filename: "after-login.png" })
```

Screenshots reveal issues that accessibility snapshots don't show:
- Toast notifications with error messages
- Visual layout problems
- Unexpected modal dialogs
- Data display inconsistencies (wrong counts, missing items)

**Pattern:** Action → Screenshot → Analyze → Continue or Investigate

### UI Element Identification

Always take snapshots before interacting with elements. The accessibility snapshot shows element refs that can be used for clicks:

```
button "Send message" [ref=e36]
```

When unsure which button is correct, **take a screenshot** using `browser_take_screenshot` to visually verify.

### Send Button vs Schedule Button

In chat interfaces with multiple buttons next to the input:
- **Send button**: Usually has `rounded-full` class, pink/gradient background
- **Schedule button**: Usually has clock icon, no `rounded-full` class

Identify by checking the source code or taking screenshots.

### Typing and Sending Messages

1. Type message using `browser_type` with the textbox ref
2. Verify send button becomes enabled (check snapshot for `[disabled]`)
3. Click the **correct** send button (not schedule)

### Firefox localStorage Quirk

Firefox throws "The operation is insecure" when accessing localStorage on `about:blank`. Always navigate to the app URL first before any storage operations.

### Verifying Message Delivery

Check console logs for subscription events:
```
[Subscription:N] Processing new message: <uuid>
[Subscription:N] Message decrypted successfully
[Subscription:N] Adding new message: <uuid>
```

## Testing Authenticated Mutations

When testing features that require authentication (Delete Account, Remove Member, etc.):

### Verify Auth State First

Before testing protected mutations, **always verify the browser has a valid auth token**:

```javascript
// Use browser_evaluate to check storage
mcp__playwright__browser_evaluate({
  function: "() => ({ localStorage: Object.keys(localStorage), hasToken: !!localStorage.getItem('authToken') })"
})
```

If storage is empty but UI shows user data, the browser has **stale React state**. This causes "Unauthorized" errors on mutations while UI appears normal.

### Fresh Login for Mutation Tests

For reliable mutation testing, always start with a fresh login:

1. Navigate to `/login`
2. Create new user or log in
3. Verify email if needed (via MailHog)
4. **Then** test protected operations

### Account Deletion / Soft Delete Testing Pattern

Complete workflow for testing self-deregistration:

1. **Setup**: Log in as user with family membership
2. **Execute**: Navigate to Settings → Delete Account → Confirm
3. **Verify Logout**: User should be redirected to `/login`
4. **Verify Re-registration**: Register with same email
5. **Verify Fresh State**: New user has no family memberships

Console indicators for successful deregistration:
```
[WebSocket] ❌ Connection closed: {code: 1000, reason: Normal Closure, wasClean: true}
```

## Issue Documentation

### Where to Write Issues

Write testing issues to `docs/issues/` with date-hour prefix:

```
docs/issues/YYYY-MM-DD-HH-<description>.md
```

Example: `docs/issues/2025-12-07-23-story-1.14-remove-member.md`

### Issue File Format

```markdown
# Testing Issues: [Feature/Story Name]

**Date:** YYYY-MM-DD
**Tested by:** Claude (Playwright MCP dual browser testing)
**Story:** [Story reference if applicable]

---

## Test Results Summary

| AC | Description | Status | Notes |
|---|---|---|---|
| AC1 | ... | PASS/FAIL/NOT TESTED | ... |

---

## Issues Found

### Issue 1: [Title]

- **Severity:** Low/Medium/High/Critical
- **Component:** Frontend/Backend/Both
- **Status:** Open/Fixed/Won't Fix

**Description:**
[What was observed]

**Expected:**
[What should happen]

**Steps to Reproduce:**
1. Step one
2. Step two
3. Observe: [specific observation]

**Console/Logs:**
\`\`\`
[relevant log output]
\`\`\`

**Notes:**
[Any additional context, workarounds, or related issues]
```

### Important

**Always write issues to a file before ending a testing session.** Do not just report issues verbally - they must be documented in `docs/issues/` for tracking.

**Comprehensive observation is mandatory.** Document ALL issues found during testing, not just those related to the story's acceptance criteria. A testing session that only reports story-specific issues has failed to fulfill the skill's purpose.

## Troubleshooting

See `references/troubleshooting.md` for detailed solutions to common issues including:
- Duplicate messages appearing
- Subscriptions not firing
- Email verification token extraction
- Browser installation errors
- Stale browser state issues
- Quoted-printable email encoding

## Test Environment Ports

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3003 | Next.js dev server |
| Backend | 4001 | GraphQL API |
| MailHog UI | 8025 | Email capture interface |
| MailHog SMTP | 1025 | Email sending |
