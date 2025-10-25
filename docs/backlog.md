# OurChat Development Backlog

**Last Updated:** 2025-10-20

This document tracks critical issues, technical debt, and follow-up work items identified during development and code reviews.

---

## Critical Issues

| ID | Date | Story | Epic | Type | Severity | Owner | Status | Estimated Effort | Actual Effort | Completed |
|----|------|-------|------|------|----------|-------|--------|------------------|--------------|-----------|
| CRIT-001 | 2025-10-20 | 1.2 | 1 | Bug | **CRITICAL** | Backend Dev | ✅ **RESOLVED** | 1-2 days | 1 hour | 2025-10-20 |

### CRIT-001: Backend Not Using E2EE Library for Invite Codes

**Description:**
Backend generates invite codes server-side without integrating with the existing E2EE library (`src/lib/e2ee/key-management.ts`). Current format is `CODE-XXXX-YYYY` instead of the designed `FAMILY-XXXXXXXX:BASE64KEY` format. This breaks the E2EE key distribution design where invite codes should embed the family encryption key.

**Impact:**
- **Security:** Family encryption keys not properly distributed via invite codes
- **Architecture:** Backend duplicates key generation logic instead of using Epic 7 E2EE library
- **E2EE:** Blocks complete end-to-end encryption implementation

**Root Cause:**
Architecture changed from Supabase to NestJS+GraphQL, but backend implementation didn't integrate with existing client-side E2EE library (Epic 7, which is complete).

**Related Files:**
- `apps/backend/src/auth/auth.service.ts:218-228` (generateInviteCode - needs update)
- `apps/backend/src/auth/auth.service.ts:89-152` (joinFamily - needs key parsing)
- `src/lib/e2ee/key-management.ts` (E2EE library - already complete)

**Related Review Items:**
- Story 1.2 Review: M1 (Family Key Encryption Not Fully Implemented)
- Story 1.2 Review: M3 (Invite Code Format Mismatch)

**Action Items:**
See Story 1.2 "Follow-Up Tasks (Post-Review)" section for detailed implementation checklist.

**References:**
- Story 1.2: `/Users/usr0101345/projects/ourchat/docs/stories/story-1.2.md`
- E2EE Library: `/Users/usr0101345/projects/ourchat/src/lib/e2ee/key-management.ts`

**Resolution (2025-10-20):**
✅ **RESOLVED** - E2EE integration complete. Backend now uses client-side E2EE library functions:
- Frontend generates family keys client-side using `generateFamilyKey()`
- Backend accepts `familyKeyBase64` parameter and generates invite codes in format `FAMILY-XXXXXXXX:BASE64KEY`
- `joinFamily` parses invite codes to extract embedded encryption keys
- Both registration and join flows store keys in IndexedDB via `initializeFamilyKey()`
- GraphQL Code Generator installed for type safety between frontend/backend
- Environment validation added (fail-fast for missing JWT secrets)

See Story 1.2 "Follow-Up Tasks" section for detailed implementation summary.

---

## Technical Debt

| ID | Date | Story | Type | Priority | Owner | Status |
|----|------|-------|------|----------|-------|--------|
| DEBT-001 | 2025-10-20 | 1.2 | Testing | Medium | Backend Dev | Open |
| DEBT-002 | 2025-10-20 | 1.2 | Security | Medium | Backend Dev | Open |
| DEBT-003 | 2025-10-25 | 1.3 | UI/UX | High | Frontend Dev | ✅ **RESOLVED** |

### DEBT-001: Missing NestJS Backend Tests

**Description:** No unit tests exist for `AuthService` methods (register, joinFamily, login). Integration and E2E tests for GraphQL backend also missing.

**Impact:** Reduced confidence in refactoring, harder to catch regressions

**Recommendation:** Create test suite:
- `apps/backend/src/auth/auth.service.spec.ts` (unit tests)
- `apps/backend/test/auth.e2e-spec.ts` (E2E tests)

---

### DEBT-002: Rate Limiting Not Implemented

**Description:** GraphQL mutations (register, joinFamily, login) have no rate limiting. Original spec called for 10 requests/hour per IP.

**Impact:** Potential for abuse - spam registrations, brute force invite codes

**Recommendation:** Implement GraphQL rate limiting middleware (e.g., `graphql-rate-limit-directive` package)

**Priority:** Medium for MVP, High before public launch

---

### DEBT-003: Logout UI Not Implemented ✅ **RESOLVED**

**Description:** Story 1.3 requires logout functionality with UI button accessible from chat/dashboard, but implementation is incomplete. The logout() function exists in auth context but has no UI trigger.

**Impact:**
- Users cannot log out via UI (blocking AC5, AC6, AC7 of Story 1.3)
- E2E test for logout flow is skipped (`tests/e2e/story-1.3-session-persistence.spec.ts:278`)
- Incomplete session management user experience

**Resolution (2025-10-25):**
✅ **COMPLETE** - Logout UI fully implemented with privacy-preserving behavior:

1. ✅ Added logout button to ChatScreen header (`src/components/chat-screen.tsx:305-308`)
2. ✅ Wired to handleLogoutClick() in chat page (`src/app/chat/page.tsx:331-340`)
3. ✅ **AC6 MODIFIED:** Logout now PRESERVES IndexedDB keys (removed clearKeys() call)
   - Keys persist for true E2EE - server never has access to decryption keys
   - User responsible for key custody (clearing browser data = permanent message loss)
   - This is BY DESIGN for privacy - no key backup feature planned
4. ✅ E2E test updated and passing (`tests/e2e/story-1.3-session-persistence.spec.ts:278-341`)
   - Test verifies keys PERSIST after logout
   - Includes re-login verification to prove persisted keys work
5. ✅ All 7/7 E2E tests passing for Story 1.3

**Files Modified:**
- `src/lib/contexts/auth-context.tsx:180-191` (removed clearKeys() for privacy)
- `src/components/chat-screen.tsx:305-308` (added logout button)
- `src/app/chat/page.tsx:331-340` (logout handler with redirect)
- `tests/e2e/story-1.3-session-persistence.spec.ts:278-341` (updated test)

**Priority:** High (blocks Story 1.3 acceptance criteria) - ✅ **RESOLVED**

---

## Completed Items

### ✅ CRIT-001: Backend Not Using E2EE Library (Resolved 2025-10-20)

**Original Issue:** Backend generated invite codes server-side without integrating with existing E2EE library.

**Resolution:** Complete E2EE integration implemented:
- Client-side key generation using Web Crypto API
- Invite code format: `FAMILY-XXXXXXXX:BASE64KEY`
- Backend parses codes and extracts embedded encryption keys
- Keys stored in IndexedDB for E2EE operations
- GraphQL Code Generator installed for frontend/backend type safety
- Fail-fast environment validation added

**Files Modified:** 8 files (4 backend, 4 frontend/tooling)
**Actual Effort:** 1 hour (vs estimated 1-2 days)

---

## Backlog Management

**Priority Levels:**
- **CRITICAL:** Security vulnerability or blocking E2EE functionality
- **High:** Impacts production readiness or user experience
- **Medium:** Technical debt that should be addressed before scale
- **Low:** Nice-to-have improvements

**Status Values:**
- **Open:** Not started
- **In Progress:** Currently being worked on
- **Blocked:** Waiting on dependency or decision
- **Completed:** Resolved and tested

---

**Note:** For detailed task breakdowns, refer to the "Follow-Up Tasks" sections in individual story files.
