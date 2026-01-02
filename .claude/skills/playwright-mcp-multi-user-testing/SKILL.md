---
name: playwright-mcp-multi-user-testing
description: Interactive multi-user testing of web applications via Playwright MCP with dual browser instances. This skill should be used when testing real-time features between multiple users (chat, collaboration, notifications), when needing isolated browser contexts for different authenticated users, or when debugging multi-user interaction flows interactively.
---

# Playwright MCP Multi-User Testing

## Purpose: Guided Monkey Testing

**This is a guided monkey testing skill.** The primary goal is to **surface issues** - ANY issues - not to validate acceptance criteria.

### What is Guided Monkey Testing?

In traditional monkey testing, a tester randomly tries anything to find bugs. In **guided monkey testing**, your actions are guided by a story workflow, but **the goal remains finding issues**, not proving the story works.

| Traditional QA Mindset | Guided Monkey Testing Mindset |
|------------------------|-------------------------------|
| "Does AC1 pass? ✓ Move on" | "What broke while testing AC1?" |
| "Story complete, all ACs verified" | "Story workflow complete, found 5 issues" |
| "Non-blocking, skip it" | "Document it, investigate it" |
| Focus: Validate requirements | Focus: **Surface defects** |

### Success Criteria

A successful testing session is measured by **issues discovered**, not by acceptance criteria passed:

- ❌ **Bad outcome:** "All ACs pass, no issues found" (unlikely - you weren't looking)
- ✅ **Good outcome:** "All ACs pass, found 3 UX issues, 1 data bug, 2 console errors"
- ✅ **Also good:** "AC3 failed, plus found 4 unrelated issues during testing"

### The Story is Just Your Guide

When asked to "test Story X", the story provides:
- A **workflow to follow** (registration → login → feature → verify)
- **Context for what you're doing** (not blinders for what you observe)

The story does NOT limit:
- What issues you should notice
- What you should document
- What deserves investigation

**Every page load, every click, every form submission is an opportunity to find bugs.**

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

**CRITICAL:** This is guided monkey testing. Your job is to **find bugs**, not to check boxes. The story workflow guides your path through the application, but your eyes should be looking for problems everywhere.

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

### Avoiding Narrow Focus (The #1 Mistake)

**The most common failure mode is tunnel vision on acceptance criteria.**

If you find yourself thinking "that's not related to this story" or "non-blocking issue, skip it" - **STOP**. You've fallen into QA validation mode instead of bug hunting mode.

**DO NOT** limit observations to just the story being tested. If testing "Remove Member" and you notice:
- Translation keys showing as raw text → **Document it**
- Member count showing wrong number → **Document it**
- Duplicate logout buttons → **Document it**
- Auth state validation missing → **Document it**
- Page flickers during load → **Document it**
- Console warning about deprecated API → **Document it**

**Every issue is a valid issue.** The story is irrelevant to whether something is worth documenting.

### Staying in Observation Mode

To maintain comprehensive observation throughout a testing session:

1. **Start each action** by stating what you're testing AND that you'll observe for any issues
2. **After each action**, explicitly check: "Checking console... Checking visual state... Checking data..."
3. **If something strange**: Spawn an investigation subagent immediately (see "Automated Issue Investigation with Subagents" section)
4. **Before moving on**, confirm: "No new issues observed" OR document what was found + spawn investigation
5. **At session end**, collect all subagent results and write comprehensive findings to issues file

### Example Observation Pattern

```
[Action] Clicking "Remove" button for Bob Member
[Observe Console] ✓ No errors
[Observe Visual]
  - ✓ Confirmation modal appeared
  - ⚠️ Notice: Header still shows "Test Family · 3 members" (should be 2)
[Observe Data] Member count discrepancy detected
[Investigate] Spawning subagent to investigate stale member count...
  → Task(subagent_type="Explore", run_in_background=true, ...)
  → Agent ID: agent-12345
[Continue] Proceeding with test while investigation runs
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

### Expected Deliverables

At the end of every testing session, you should produce:

1. **Individual issue files** - One file per issue in `docs/issues/YYYY-MM-DD-<description>.md`
2. **Each issue documented properly** - With reproduction steps, expected vs actual, severity

**Do NOT:**
- Bundle all issues into a single "test results" file
- Dismiss issues as "minor" or "non-blocking" without documenting them
- End a session without creating issue files for every problem found

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

**Root Cause Analysis:** (from investigation subagent)
[If a subagent was spawned, include its findings here]
- Source file: `path/to/file.ts:123`
- Root cause: [explanation]
- Suggested fix: [code change or approach]
```

### Important

**Always write issues to a file before ending a testing session.** Do not just report issues verbally - they must be documented in `docs/issues/` for tracking.

**Comprehensive observation is mandatory.** Document ALL issues found during testing, not just those related to the story's acceptance criteria. A testing session that only reports story-specific issues has failed to fulfill the skill's purpose.

## Automated Issue Investigation with Subagents

**CRITICAL:** When you encounter something strange during testing, do NOT just document it and move on. Spawn a subagent to investigate the root cause immediately.

### When to Spawn an Investigation Subagent

Spawn an investigation subagent when you observe ANY of these:

| Signal | Investigation Type | Subagent Purpose |
|--------|-------------------|------------------|
| Console errors (non-transient) | `Explore` | Find error source in codebase |
| Unexpected UI state | `Explore` | Check component logic and state management |
| Data inconsistency (wrong counts, missing items) | `Explore` | Trace data flow from backend to frontend |
| GraphQL errors in network tab | `Explore` | Examine resolver implementation |
| Translation keys showing raw | `Explore` | Find missing translation entries |
| Auth/permission failures | `Explore` | Check auth middleware and token handling |
| WebSocket issues | `Explore` | Investigate subscription setup |
| Feature not working as expected | `code-explorer` | Deep dive into feature implementation |

### How to Spawn Investigation Subagents

Use the Task tool with appropriate subagent type:

```
Task tool:
  subagent_type: "Explore"
  description: "Investigate [specific issue]"
  prompt: |
    During Playwright MCP testing, I observed: [detailed observation]

    Context:
    - Page: [current URL]
    - Action taken: [what was clicked/submitted]
    - Expected: [what should have happened]
    - Actual: [what actually happened]
    - Console output: [relevant logs]

    Investigate:
    1. Find the relevant code handling this functionality
    2. Identify the root cause of the discrepancy
    3. Determine if this is a bug or expected behavior
    4. If a bug, suggest the minimal fix

    Report back with:
    - Root cause analysis
    - Affected files and line numbers
    - Recommended fix (if applicable)
    - Whether this blocks the current test
```

### Investigation Workflow

1. **Observe** - Notice something strange
2. **Document** - Record the exact observation (screenshot, console logs)
3. **Spawn** - Launch subagent with detailed context
4. **Continue** - Keep testing while subagent investigates (use `run_in_background: true`)
5. **Collect** - Retrieve subagent findings with AgentOutputTool
6. **Update** - Add root cause to issue documentation

### Example: Member Count Bug Investigation

```
[Testing] Clicked "Remove Member" for Bob
[Observe] Member count in header still shows "3 members" after removal
[Action] Spawning investigation subagent...

Task tool:
  subagent_type: "Explore"
  run_in_background: true
  description: "Investigate stale member count"
  prompt: |
    During testing "Remove Family Member", the member count in the header
    did not update after successful member removal.

    Observed:
    - Page: /chat
    - Header shows: "Test Family · 3 members"
    - Expected after removal: "Test Family · 2 members"
    - Removal mutation succeeded (no GraphQL errors)
    - Console shows no errors

    Investigate:
    1. How is member count fetched and cached?
    2. What should trigger a refetch after removal?
    3. Is there a cache invalidation issue?

    Check files:
    - Components displaying member count
    - GraphQL queries for family data
    - Cache invalidation logic after mutations
```

### Subagent Types for Different Issues

| Issue Category | Recommended Subagent | Rationale |
|---------------|---------------------|-----------|
| Quick code lookup | `Explore` (quick) | Fast pattern search |
| Data flow tracing | `Explore` (medium) | Follow data through layers |
| Complex bug analysis | `code-explorer` | Deep architectural understanding |
| Feature implementation review | `feature-dev:code-explorer` | Full feature trace |
| Security concerns | `Explore` (very thorough) | Comprehensive security audit |

### Parallel Investigation Pattern

When multiple issues are found, spawn investigations in parallel:

```
[Multiple issues detected]
1. Member count not updating
2. Console error: "Cannot read property 'id' of undefined"
3. Toast showing wrong language

[Spawning 3 parallel investigations...]

Task tool (call 1):
  subagent_type: "Explore"
  run_in_background: true
  description: "Investigate member count"
  ...

Task tool (call 2):
  subagent_type: "Explore"
  run_in_background: true
  description: "Investigate undefined error"
  ...

Task tool (call 3):
  subagent_type: "Explore"
  run_in_background: true
  description: "Investigate translation issue"
  ...

[Continue testing while investigations run]
```

### Collecting Investigation Results

After spawning background agents, collect results before ending the test session:

```
AgentOutputTool:
  agentId: "<agent-id-from-spawn>"
  block: true  # Wait for results if still running
```

Add findings to the issue documentation with root cause analysis.

### When NOT to Spawn Subagents

- **Transient errors**: Network blips, temporary loading states
- **Known issues**: Already documented in `docs/issues/`
- **Configuration issues**: Missing env vars, wrong ports
- **Test environment problems**: Backend not running, MailHog down

For these, document and continue. No investigation needed.

---

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
