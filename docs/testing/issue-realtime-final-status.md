# Realtime Channel Error - Final Investigation Status

**Date:** 2025-10-18
**Status:** BLOCKED - Kong Template System Limitation (See kong-realtime-investigation.md)
**Time Invested:** ~5 hours
**Progress:** 67% (2/3 issues fixed)

**⚠️ UPDATE:** See `docs/testing/kong-realtime-investigation.md` for complete technical analysis and recommended solutions.

## Summary

Successfully fixed 2 critical infrastructure issues but blocked on Kong API Gateway authentication configuration that rejects WebSocket handshakes with anon key only.

---

## ✅ Issues Fixed (2/3)

### 1. CSP WebSocket Protocol Blocking
- **Fix:** Updated `next.config.js` with dynamic CSP builder
- **Impact:** WebSocket protocol now allowed
- **File:** `next.config.js`

### 2. Realtime Publication Missing
- **Fix:** Created migration to add messages table to `supabase_realtime` publication
- **Impact:** Messages table now broadcasts Realtime events
- **File:** `supabase/migrations/20251018080000_enable_realtime_messages.sql`

---

## ❌ BLOCKED: Kong WebSocket Authentication (1/3)

### Problem

Kong API Gateway returns `403 Forbidden` during WebSocket handshake:

```
GET /realtime/v1/websocket?apikey=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH&vsn=1.0.0
HTTP/1.1" 403
```

### Root Cause

Kong requires **authenticated JWT** in HTTP headers during WebSocket handshake, but client only sends **anon key**.

The `supabase.realtime.setAuth()` method sends the JWT via WebSocket *message* after connection, but Kong blocks the connection *before* WebSocket upgrade.

### All Solutions Attempted

1. ❌ **`accessToken` callback in `createBrowserClient`**
   - Not supported by `@supabase/ssr` package
   - Option exists in `@supabase/supabase-js` but not SSR variant

2. ❌ **`setAuth()` on chat page Supabase instance**
   - Race condition: called after `useRealtime` already subscribed
   - Different Supabase instance than hook uses

3. ❌ **`setAuth()` in `useRealtime` hook before subscribe**
   - Properly sequenced: get session → setAuth → subscribe
   - Still gets 403 from Kong
   - **Proves Kong blocks at HTTP handshake level, not WebSocket message level**

### Why This Is Blocking

**Kong's behavior:**
- Validates authentication during HTTP handshake (before WebSocket upgrade)
- Rejects requests with only anon key (403 Forbidden)
- Never allows connection to upgrade to WebSocket protocol

**Supabase client behavior:**
- Sends anon key in URL query parameter
- Attempts to send user JWT via WebSocket message *after* connection
- Can't send JWT during handshake with current implementation

**Mismatch:** Client tries to authenticate post-connection, Kong requires pre-connection authentication.

---

## Possible Solutions (Require Further Investigation)

### Option A: Kong Configuration Change
**Modify Kong to allow anon Realtime connections for local dev**

Pros:
- Matches production Supabase behavior
- No code changes required

Cons:
- Requires understanding Kong configuration in Supabase local setup
- May be intentionally locked down for security

**Next Steps:**
1. Research Supabase local dev Kong configuration
2. Check if `supabase/config.toml` has Realtime auth bypass
3. Investigate Kong plugin configuration files

### Option B: Use Service Role Key (NOT RECOMMENDED)
**Replace anon key with service role key for Realtime**

Pros:
- Would likely bypass Kong auth check

Cons:
- **SECURITY RISK:** Service role bypasses RLS
- Not viable for production
- Wrong solution to the problem

### Option C: Custom WebSocket Headers
**Modify Supabase client to send JWT in initial HTTP headers**

Pros:
- Solves Kong handshake authentication

Cons:
- Requires forking/patching `@supabase/ssr` or `@supabase/realtime-js`
- Not sustainable for updates

### Option D: Disable RLS for Local Dev (TEMPORARY WORKAROUND)
**Temporarily disable RLS on messages table**

Pros:
- Would allow anon connections
- Quick test to verify hypothesis

Cons:
- Defeats purpose of testing RLS
- Not production-ready
- Doesn't solve the real problem

---

## Recommended Next Steps

### Immediate (Nick's Decision Required):

**Should we:**
1. **Investigate Kong config** (1-2 hours) - Best long-term solution
2. **Disable RLS temporarily** (15 min) - Test if hypothesis is correct
3. **Escalate to Supabase community** - GitHub issue/Discord
4. **Move forward without Realtime** - Use polling instead

### Medium-term:

1. **Test on hosted Supabase** - Verify this is local-only issue
2. **Review Supabase local dev docs** - Check for known Realtime auth config
3. **Check Supabase GitHub issues** - Search for similar problems

---

## Files Modified

| File | Purpose | Status |
|------|---------|--------|
| `next.config.js` | CSP WebSocket support | ✅ Complete |
| `supabase/migrations/20251018080000_enable_realtime_messages.sql` | Enable Realtime publication | ✅ Complete |
| `src/lib/supabase/client.ts` | Auth token configuration | ⚠️ Partial (doesn't solve Kong issue) |
| `src/lib/hooks/use-realtime.ts` | Set auth before subscribe | ⚠️ Partial (doesn't solve Kong issue) |
| `src/app/chat/page.tsx` | Realtime auth initialization | ⚠️ Partial (doesn't solve Kong issue) |

---

## Technical Details

### Kong Logs Evidence
```
172.20.0.1 - - [18/Oct/2025:07:46:52]
"GET /realtime/v1/websocket?apikey=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH&vsn=1.0.0
HTTP/1.1" 403 0
```

### Browser Console Evidence
```
Firefox can't establish a connection to the server at
ws://localhost:54321/realtime/v1/websocket?apikey=...
```

### Database Verification
```sql
-- Realtime publication: ✅ WORKING
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Returns: messages table with all columns

-- RLS policies on public.messages: ✅ EXIST (require auth)
SELECT policyname FROM pg_policies WHERE tablename = 'messages';
-- Returns: 4 policies requiring authenticated users

-- RLS policies on realtime schema: ✅ NONE
SELECT * FROM pg_policies WHERE schemaname = 'realtime';
-- Returns: (0 rows)
```

---

## Conclusion

We've successfully fixed the infrastructure (CSP + Realtime publication) but are **blocked by Kong's WebSocket authentication requirements**.

The Supabase client architecture assumes JWT can be sent post-connection, but Kong's local configuration requires pre-connection authentication in HTTP headers.

**This is not a code issue - it's a configuration mismatch between Kong and the Supabase client.**

### Decision Required

Nick, how would you like to proceed?

1. Invest time investigating Kong configuration?
2. Temporarily disable RLS to test?
3. Move forward with polling instead of Realtime?
4. Escalate to Supabase community for guidance?

---

**Related Documents:**
- Initial issue: `docs/testing/issue-realtime-channel-error.md`
- Resolution attempts: `docs/testing/issue-realtime-channel-error-resolution.md`
