# Issue: Admin View Shows Stale Member List After Member Self-Deletes

**Date Discovered:** 2025-12-08
**Discovered During:** Story 1.14 manual testing with Playwright MCP
**Severity:** Data Synchronization Bug

## Description

When a family member deletes their own account (self de-registration), other family members (specifically admins viewing the Settings panel) continue to see the deleted member in the member list until they manually refresh the page.

## Steps to Reproduce

1. User A (Admin) logs in on Browser 1, opens Settings panel
2. User B (Member) logs in on Browser 2
3. User B navigates to Settings → Delete Account and confirms deletion
4. User B is redirected to login page (account deleted)
5. Observe User A's browser - member list still shows User B

## Expected Behavior

When a member deletes their account, other users' views should update to reflect the change, either:
- Immediately via real-time notification (WebSocket)
- On next data fetch/polling interval

## Actual Behavior

Admin continues to see the deleted member in the list. The deleted member even has an active "Remove" button which would fail if clicked.

## Impact

- Confusing UX for admins who may try to interact with a deleted member
- Potential for errors if admin clicks "Remove" on already-deleted member
- Data inconsistency between client state and server state

## Affected Components

- Settings → Family Group → Member Management
- Chat header member count
- Any component displaying family member data

## Suggested Fix

Options:
1. **Real-time updates:** Emit WebSocket event when member is deleted, subscribed clients update their member list
2. **Polling:** Periodically refetch member list
3. **Optimistic invalidation:** Invalidate member cache on any membership-related mutation
