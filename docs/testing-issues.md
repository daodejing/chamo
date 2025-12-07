# Testing Issues - Story 1.14

## Issues Found During Manual Testing

### Issue 1: Multiple Untranslated Strings in Settings
- **Location:** Settings page, multiple sections
- **Observed:** Raw translation keys displayed instead of translated text:
  - `settings.setBiometrics` (Security section)
  - `settings.fontSmall`, `settings.fontMedium`, `settings.fontLarge` (Font Size section)
  - `settings.showTranslationDescription` (Translation Settings section)
  - `settings.enableQuietHours`, `settings.quietHoursInfo` (Quiet Hours section)
- **Expected:** Should display translated text
- **Severity:** Medium (multiple UI elements affected)
- **How to Replicate:**
  1. Log into the app
  2. Click the Settings (gear) icon in the header
  3. Scroll through the settings panel
  4. **Observe:** Raw translation keys visible in Security, Font Size, Translation Settings, and Quiet Hours sections
- **Root Cause:** Missing translation entries in `src/lib/translations.ts`
- **Screenshot:** `.playwright-mcp/page-2025-12-07T12-34-39-853Z.png`

---

### Issue 2: Incorrect Member Count Display
- **Location:** Main header showing family name
- **Observed:**
  - Firefox shows "0 members" for a family that clearly has members (messages from Alice Admin visible)
  - Chromium shows "1 members" for the same family
  - Two different user sessions exist in the same family, yet count shows 0 or 1
- **Expected:** Member count should accurately reflect actual membership (should show "2 members" if 2 users are in the family)
- **Severity:** Medium (data display inconsistency)
- **Possible causes:**
  - Stale cached data not refreshing
  - Query not counting members correctly
  - Race condition on initial load
- **How to Replicate:**
  1. Create a family with User A (admin)
  2. Invite User B to the family
  3. User B accepts invite and joins family
  4. Open two browser sessions: User A in Chromium, User B in Firefox
  5. Both navigate to `/chat`
  6. **Observe:** Header shows different member counts in each browser, neither showing correct total
- **Screenshots:**
  - `.playwright-mcp/chromium-member-count-1.png` - Shows "1 members"
  - `.playwright-mcp/firefox-member-count-0.png` - Shows "0 members" with visible messages

---

### Issue 3: Grammar Error in Member Count
- **Location:** Main header showing family info
- **Observed:** "1 members" displayed (plural form with singular count)
- **Expected:** "1 member" (singular when count is 1)
- **Severity:** Low (grammar/localization issue)
- **How to Replicate:**
  1. Log into the app with a family that has exactly 1 member
  2. Look at the header next to the family name
  3. **Observe:** Shows "1 members" instead of "1 member"
- **Root Cause:** Missing pluralization logic in the member count display

---

### Issue 4: Incomplete Member List Display
- **Location:** Settings > Family Group > Member Management
- **Observed:**
  - Firefox (Bob Member) only shows Bob Member in list
  - Chromium (Alice Admin) only shows Alice Admin in list
  - Both users are in same family (can see each other's messages)
  - Each should see ALL family members, not just themselves
- **Expected:** Member list should show complete list of family members
- **Severity:** High (core functionality broken - blocks Remove Member testing)
- **How to Replicate:**
  1. Create a family with User A (admin)
  2. Invite User B to the family, User B accepts
  3. Log in as User A, go to Settings > Family Group > Member Management
  4. **Observe:** Only User A is shown in the member list
  5. Log in as User B in a different browser, go to same settings
  6. **Observe:** Only User B is shown in the member list
  7. **Note:** Both users can see each other's messages, proving they're in the same family
- **Root Cause:** Query may be filtering by current user instead of fetching all family members
- **Screenshot:** `.playwright-mcp/firefox-bob-settings.png`

---

### Issue 5: ~~Self-Deregistration Fails with Unauthorized Error~~ **RESOLVED**
- **Status:** ✅ **RESOLVED** - Initial failure was due to stale test environment (Issue 7)
- **Location:** Settings > Delete Account
- **Initial Observation:**
  - User clicks "Delete Account" button, confirms, gets "Unauthorized" error
  - Was caused by missing auth token in browser storage (stale test state)
- **Resolution Testing:**
  1. Created fresh user: `alice.admin.1733@test.local`
  2. Verified email via MailHog
  3. Created family, accessed Settings
  4. Clicked "Delete Account", confirmed dialog
  5. ✅ **SUCCESS:** User was logged out and redirected to login page
  6. ✅ **AC14 verified:** Re-registered with same email, verified, logged in successfully
  7. ✅ New user ID assigned: `b70e9509-70fa-4c27-bbb2-4501bfb3e080`
  8. ✅ User treated as fresh (no family memberships - AC10 confirmed)
- **Conclusion:** Self-deregistration works correctly with valid auth session

---

### Issue 6: Duplicate Logout Button in Settings
- **Location:** Settings panel (above Delete Account section)
- **Observed:**
  - A "Logout" button exists within the Settings panel
  - A "Logout" button already exists in the top-right header bar
  - Two logout buttons are redundant and confusing
- **Expected:** Settings panel should NOT contain a Logout button; Logout should only be in the header
- **Severity:** Low (UI/UX issue - inappropriate placement)
- **Rationale:** Settings is for configuration, not session actions. Logout is already accessible in the header.
- **How to Replicate:**
  1. Log into the app
  2. Click the Settings (gear) icon in the header
  3. Scroll down in the settings panel
  4. **Observe:** "Logout" button appears above "Delete Account" section
  5. **Also observe:** "Logout" button already exists in the top-right header bar

---

### Issue 7: App Doesn't Validate Auth State on Page Load (Security/UX)
- **Location:** Global app behavior (all protected pages)
- **Observed:**
  - User can view protected pages (chat, settings, family data) without a valid auth token
  - localStorage, sessionStorage, and cookies are all empty (no `authToken`)
  - UI displays user name, family info, messages as if logged in
  - Only fails when attempting authenticated mutations (e.g., "Unauthorized" on Delete Account)
  - App relies on stale React in-memory state instead of validating against persistent storage
- **Expected:**
  - App should validate auth token exists and is valid on page load
  - If no valid token, redirect to `/login` immediately
  - Should not allow browsing protected content with expired/missing credentials
- **Severity:** Medium (Security/UX concern)
- **How to Replicate:**
  1. Log into the app normally (auth token saved to localStorage)
  2. Open browser DevTools → Application → Local Storage
  3. Manually clear localStorage (or delete `authToken` key)
  4. Refresh the page OR navigate to `/chat`
  5. **Observe:** App still shows protected content instead of redirecting to login
  6. Try any authenticated action (e.g., Delete Account, send message)
  7. **Observe:** Action fails with "Unauthorized" error
- **Root Cause:** The `useAuth` hook or auth context likely initializes from React state and doesn't revalidate against storage on mount/navigation
- **Screenshot:** `.playwright-mcp/firefox-delete-account-error.png` (shows Unauthorized error)

---

## Acceptance Criteria Test Results

### Part B: Self De-registration (Tested Successfully)

| AC | Description | Status | Notes |
|----|-------------|--------|-------|
| AC6 | Soft Delete Schema | ✅ Pass | `deletedAt` field allows email reuse |
| AC7 | Self De-registration UI | ✅ Pass | Delete Account button visible in Settings |
| AC9 | Soft Delete Execution | ✅ Pass | User logged out, redirected to login |
| AC10 | Membership Cleanup | ✅ Pass | Re-registered user has no family memberships |
| AC13 | Query Filtering | ✅ Pass | Old deleted user properly filtered from queries |
| AC14 | Re-registration | ✅ Pass | Same email can register fresh account |

### Part A: Remove Family Member (Blocked by Issue 4)

| AC | Description | Status | Notes |
|----|-------------|--------|-------|
| AC1 | Remove Member UI | ⚠️ Partial | Button visible but member list incomplete (Issue 4) |
| AC2 | Remove Member Backend | 🔲 Not Tested | Blocked by Issue 4 |
| AC3 | Admin Protection | 🔲 Not Tested | Blocked by Issue 4 |
| AC4 | Allow Re-invite | 🔲 Not Tested | Blocked by Issue 4 |
| AC5 | Cleanup | 🔲 Not Tested | Blocked by Issue 4 |

---

## Summary

**Critical Blocker:** Issue 4 (Incomplete Member List) prevents testing Remove Family Member functionality. Each user only sees themselves in the member list, making it impossible to select another member to remove.

**Self De-registration:** All ACs passed. The feature works correctly when the user has a valid authenticated session.

**Remaining Issues (6 total):**
- Issue 1: Untranslated strings (Medium)
- Issue 2: Incorrect member count (Medium)
- Issue 3: Grammar error "1 members" (Low)
- Issue 4: Incomplete member list (High - blocker)
- Issue 6: Duplicate logout button (Low)
- Issue 7: Auth state validation (Medium - security)

---

*Testing performed: 2025-12-07*
*Story: 1.14 - Remove Family Member & Self De-registration*
