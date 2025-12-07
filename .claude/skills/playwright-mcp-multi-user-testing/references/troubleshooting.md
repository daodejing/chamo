# Troubleshooting Guide

## Duplicate Messages Appearing

### Symptom
When sending a message, it appears twice in the sender's view.

### Cause
The optimistic update creates a temporary message (ID: `temp-<timestamp>`), but when the real message arrives via WebSocket subscription (ID: `<uuid>`), the duplicate check only compares exact IDs. Since they differ, both messages are added.

### Solution
When the subscription receives a message from the current user (`isMine: true`), remove any temp messages before adding the real one:

```typescript
// In subscription handler, before adding new message:
let filtered = prev;
if (newMessage.isMine) {
  const tempCount = prev.filter((m) => m.id.startsWith('temp-')).length;
  if (tempCount > 0) {
    console.log(`Removing ${tempCount} optimistic temp message(s)`);
    filtered = prev.filter((m) => !m.id.startsWith('temp-'));
  }
}
const updated = [...filtered, newMessage];
```

### Console Indicators
```
[Subscription:N] setState callback {prevLength: 2, prevIds: ...,temp-123...}
[Subscription:N] Removing 1 optimistic temp message(s)
[Subscription:N] Updated messages count: 2
```

---

## Subscriptions Not Firing

### Symptom
Console shows `[Subscription:N] Skipping - missing deps`

### Cause
The subscription effect requires certain dependencies (user, familyKey, channelId) that aren't loaded yet.

### Solution
Wait for the app to fully initialize. Check console for:
```
[KeyCheck] userId: <uuid> hasUserKey: true hasFamilyKey: true
[WebSocket] Connected to GraphQL server
```

---

## Clicking Wrong Button (Schedule vs Send)

### Symptom
Clicking "send" opens a schedule dialog instead of sending the message.

### Diagnosis
The chat UI has two buttons near the input:
1. Schedule button (clock icon)
2. Send button (arrow/send icon, pink/gradient, rounded-full)

### Solution
1. **Take a screenshot** to visually identify buttons
2. **Read the source code** to understand button classes
3. The send button typically has:
   - `rounded-full` class
   - `bg-gradient-to-r from-[#E7B2DF] to-[#CF68C0]` or similar gradient
   - `<Send>` icon component

Use the rightmost button in the input area, or identify by class in the accessibility snapshot.

---

## Email Verification Token Extraction

### Symptom
Need to extract verification token from MailHog emails.

### Pattern
1. Fetch email from MailHog API: `http://localhost:8025/api/v2/messages`
2. Search for the specific recipient
3. Extract token from email body using regex

### Quoted-Printable Encoding (Critical)
Email bodies use **quoted-printable encoding** where special characters are escaped:
- `=3D` represents `=`
- `=20` represents space
- Lines ending with `=` are continuation markers

**Example:**
```
# Raw email body:
http://localhost:3003/verify-email?=
token=3DVUa6iC3i-RsTFetajFf6qg&lang=3Den

# After decoding:
http://localhost:3003/verify-email?token=VUa6iC3i-RsTFetajFf6qg&lang=en
```

**Fix:** When extracting tokens, remove `=3D` prefix and use just the token value:
```
# Wrong: token=3DVUa6iC3i-RsTFetajFf6qg
# Right: token=VUa6iC3i-RsTFetajFf6qg
```

### MailHog Search
```bash
curl 'http://localhost:8025/api/v2/search?kind=to&query=user@example.com' | jq -r '.items[0].Content.Body'
```

Note: Use single quotes around URL to avoid shell escaping issues with `&`.

---

## Browser Not Installed Error

### Symptom
```
Error: Browser not installed
```

### Solution
Call the `browser_install` tool for the respective MCP server:
- `mcp__playwright__browser_install` for Chromium
- `mcp__playwright-firefox__browser_install` for Firefox

---

## Firefox localStorage "Insecure Operation" Error

### Symptom
Firefox throws "The operation is insecure" when accessing localStorage.

### Cause
Attempting to access localStorage while on `about:blank` before navigating to the app.

### Solution
Always navigate to the application URL first before any storage operations:
```
mcp__playwright-firefox__browser_navigate to http://localhost:3003
```

---

## Family Key Not Found

### Symptom
Console shows `hasFamilyKey: false` and messages won't encrypt/decrypt.

### Cause
The family key is stored in IndexedDB with format `familyKey:{familyId}`. If the key isn't properly stored during family creation or join, encryption fails.

### Diagnosis
Check console for:
```
[Decrypt] Effect triggered: {rawMessagesCount: N, hasFamilyKey: false, hasUser: true}
```

### Solution
1. Verify the invite code includes the encrypted family key after the `:`
2. Ensure the join flow properly stores the family key
3. Check IndexedDB for `familyKey:` entries

---

## WebSocket Connection Issues

### Symptom
Real-time messages not being received.

### Diagnosis
Check console for WebSocket status:
```
[WebSocket] Connecting to GraphQL server at: ws://localhost:4001/graphql
[WebSocket] Getting connection params, token exists: true
[WebSocket] Connected to GraphQL server
```

### Common Issues
1. Backend not running on port 4001
2. Token not present (authentication failed)
3. CORS issues (check backend CORS config)

---

## Member Count Shows 0

### Symptom
Family header shows "0 members" even after joining.

### Cause
This is often a caching issue or the member count query not refetching after join.

### Workaround
This doesn't affect functionality. Messages still work if both users are in the same family.

---

## Stale Browser State (Unauthorized Errors)

### Symptom
- UI displays user data, family info, messages as if logged in
- Any mutation (Delete Account, Send Message, etc.) returns "Unauthorized"
- Console shows no errors until mutation is attempted

### Cause
The MCP browser has **stale React in-memory state** while browser storage (localStorage, sessionStorage, cookies) is empty. This happens when:
- Browser session was interrupted
- Storage was manually cleared without page reload
- Previous test left inconsistent state

### Diagnosis
Check storage with `browser_evaluate`:
```javascript
() => ({
  localStorage: Object.keys(localStorage),
  sessionStorage: Object.keys(sessionStorage),
  hasToken: !!localStorage.getItem('authToken')
})
```

If `hasToken: false` but UI shows user as logged in → stale state.

### Solution
**Do a fresh login** rather than trying to repair state:
1. Navigate to `/login`
2. Log in or register a new user
3. Verify storage now has `authToken`
4. Then proceed with protected operation tests

