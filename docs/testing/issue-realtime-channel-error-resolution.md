# Realtime Channel Error - Investigation & Resolution

**Date:** 2025-10-18
**Status:** BLOCKED - Requires Kong/Supabase Configuration Change
**Investigator:** Claude (Amelia)
**Time Invested:** ~3 hours
**Progress:** 66% (2/3 issues fixed)

## Executive Summary

Successfully reproduced and diagnosed the Realtime subscription error. Identified and fixed **2 critical infrastructure issues**, but **blocked on Kong API Gateway authentication configuration** that rejects WebSocket handshakes with anon key only.

**See `docs/testing/issue-realtime-final-status.md` for complete findings and decision options.**

## Issues Identified & Fixed

### 1. CSP WebSocket Protocol Blocking ✅ FIXED

**Issue:** Content Security Policy blocked WebSocket (`ws://`) connections
**Location:** `next.config.js:34`
**Error:**
```
Content-Security-Policy: The page's settings blocked the loading of a resource (connect-src)
at ws://localhost:54321/realtime/v1/websocket
```

**Root Cause:**
The CSP `connect-src` directive only allowed HTTP/HTTPS protocols, not WebSocket (`ws://` or `wss://`)

**Fix Applied:**
- Updated `next.config.js` to dynamically build CSP directives from `NEXT_PUBLIC_SUPABASE_URL`
- Added automatic WebSocket protocol support (`ws://` and `wss://`)
- Implemented fail-fast validation (throws error if env var missing)
- File: `/Users/usr0101345/projects/ourchat/next.config.js`

**Impact:** CSP no longer blocks WebSocket connections

---

### 2. Realtime Publication Missing ✅ FIXED

**Issue:** `messages` table not enabled for Realtime broadcasts
**Evidence:**
```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Returned: (0 rows)
```

**Root Cause:**
The `messages` table was never added to the `supabase_realtime` publication, preventing any Realtime events from being broadcast.

**Fix Applied:**
- Created migration: `supabase/migrations/20251018080000_enable_realtime_messages.sql`
- Added: `ALTER PUBLICATION supabase_realtime ADD TABLE messages;`
- Applied migration via `pnpm supabase db reset`

**Verification:**
```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Now returns: messages table with all columns
```

**Impact:** Messages table now broadcasts Realtime events

---

### 3. WebSocket Authentication Failure ❌ BLOCKED

**Issue:** Kong API Gateway returns `403 Forbidden` for WebSocket connections
**Evidence:**

Kong Logs:
```
GET /realtime/v1/websocket?apikey=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH&vsn=1.0.0 HTTP/1.1" 403
```

Browser Error:
```
Firefox can't establish a connection to the server at
ws://localhost:54321/realtime/v1/websocket?apikey=...&vsn=1.0.0
```

**Root Cause:**

Kong requires **authenticated JWT** in HTTP headers during WebSocket handshake, but client only sends **anon key**. The `supabase.realtime.setAuth()` method sends the JWT via WebSocket *message* after connection, but Kong blocks the connection *before* WebSocket upgrade.

**All Solutions Attempted:**

1. ❌ **`accessToken` callback in `createBrowserClient`**
   - Not supported by `@supabase/ssr` package

2. ❌ **`setAuth()` on chat page Supabase instance**
   - Race condition: called after `useRealtime` already subscribed
   - Different Supabase instance than hook uses

3. ❌ **`setAuth()` in `useRealtime` hook before subscribe**
   - Properly sequenced: get session → setAuth → subscribe
   - Still gets 403 from Kong
   - **Proves Kong blocks at HTTP handshake level, not WebSocket message level**

**Why This Is Blocking:**

Kong validates authentication during HTTP handshake (before WebSocket upgrade). Supabase client sends anon key in URL and attempts to send user JWT via WebSocket message *after* connection. This is a configuration mismatch between Kong and the Supabase client architecture.

**See `docs/testing/issue-realtime-final-status.md` for complete analysis and recommended solutions.**

---

## Files Modified

1. `/Users/usr0101345/projects/ourchat/next.config.js`
   - Added `buildConnectSrc()` function for dynamic CSP
   - Derives WebSocket URLs from environment variables
   - Fail-fast validation

2. `/Users/usr0101345/projects/ourchat/supabase/migrations/20251018080000_enable_realtime_messages.sql`
   - New migration to enable Realtime for messages table

3. `/Users/usr0101345/projects/ourchat/src/lib/supabase/client.ts`
   - Added explicit cookie handlers (may need to revert)

---

## Database Verification

**Realtime Publication Status:**
```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```
Result: ✅ `messages` table included with all columns

**RLS Policies:**
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'messages';
```
Result: 4 policies requiring authenticated users for all operations

**Containers Status:**
```bash
docker ps --filter "name=supabase_realtime"
```
Result: ✅ `supabase_realtime_ourchat` - Up, Healthy

---

## Decision Required

**This investigation is blocked pending configuration decision.**

Nick, how would you like to proceed?

1. **Investigate Kong configuration** (1-2 hours) - Best long-term solution
2. **Temporarily disable RLS** (15 min) - Test if hypothesis is correct
3. **Move forward with polling** - Use HTTP polling instead of Realtime
4. **Escalate to Supabase community** - GitHub issue/Discord for guidance

**See `docs/testing/issue-realtime-final-status.md` for:**
- Complete technical analysis of Kong authentication issue
- All attempted solutions with evidence
- Detailed pros/cons of each option
- Database verification queries
- Kong logs and browser console evidence

---

## References

- [Supabase Realtime Authorization Docs](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase SSR Documentation](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Next.js Server-Side Auth Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- Issue Report: `docs/testing/issue-realtime-channel-error.md`
- **Final Status Document: `docs/testing/issue-realtime-final-status.md`**

---

## Progress Summary

| Issue | Status | Impact |
|-------|--------|--------|
| CSP WebSocket Blocking | ✅ Fixed | High |
| Realtime Publication Missing | ✅ Fixed | Critical |
| WebSocket 403 Authentication | ❌ BLOCKED | Critical |

**Overall Status:** 66% Complete (2/3 issues fixed) - Blocked on Kong/Supabase configuration change.
