# Issue: Channel Name Briefly Shows Empty (Just # Icon)

**Date Discovered:** 2025-12-08
**Discovered During:** Story 1.14 manual testing with Playwright MCP
**Severity:** UX Bug

## Description

When the chat page loads, the channel name area momentarily displays just the `#` icon without any channel name text, before "General" (or the actual channel name) appears.

## Steps to Reproduce

1. Login as any user with an active family
2. Navigate to /chat
3. Observe the channel selector/header area during initial load

## Expected Behavior

Channel name should either:
- Show a loading placeholder until channel data is ready
- Not render the `#` icon until the channel name is also available

## Actual Behavior

The `#` icon renders immediately, followed by a brief delay before the channel name appears.

## Affected Components

- Chat page channel header/selector

## Suggested Fix

Ensure channel name and icon render together, or add appropriate loading state.
