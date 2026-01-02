# Issue: Member Count Display Flicker During Page Load

**Date Discovered:** 2025-12-08
**Discovered During:** Story 1.14 manual testing with Playwright MCP
**Severity:** UX Bug

## Description

The member count in the chat header and Settings page displays inconsistent values (0, 1, 3, etc.) during page loads before settling to the correct value. This creates a flickering effect that's visually jarring.

## Steps to Reproduce

1. Login as a family admin
2. Navigate to /chat
3. Observe the member count in the header during initial load
4. Open Settings panel
5. Observe "X / 10 members" display

## Expected Behavior

Member count should either:
- Show a loading skeleton/placeholder until data is ready
- Not render until the correct value is available

## Actual Behavior

Member count rapidly changes through multiple incorrect values before displaying the correct count.

## Affected Components

- Chat header (family name area)
- Settings → Family Group → Member Management section

## Suggested Fix

Add loading state handling to prevent rendering until `familyMembers` data is loaded, or use a skeleton placeholder.
