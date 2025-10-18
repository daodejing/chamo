# Issue Report: Realtime Channel Subscription Error

**Date:** 2025-10-18
**Status:** Under Investigation
**Severity:** High - Blocks chat functionality

## Symptoms

**Console Error:**
```
Subscription failed: CHANNEL_ERROR
```

**Location:** `src/lib/hooks/use-realtime.ts:152:34`

**Context:**
- User navigates to `http://localhost:3002/chat`
- Error appears even after successful registration/login
- Chat screen shows error overlay instead of functional chat interface

## Steps to Reproduce

1. **Start Services:**
   ```bash
   pnpm supabase db reset
   pnpm dev
   ```

2. **Navigate to Login:**
   - Open browser: `http://localhost:3002/login`

3. **Create Family Account:**
   - Your Name: `Nick`
   - Email: `nick@test.com`
   - Password: `password123`
   - Family Name: `Test Family`
   - Click "Create Family"

4. **Expected:** Redirect to `/chat` with working chat interface
5. **Actual:** Error overlay showing "Subscription failed: CHANNEL_ERROR"

## Investigation Steps

### 1. Check Authentication State

**Browser Console:**
```javascript
// Check if user is authenticated
document.cookie

// Should see cookies like:
// sb-access-token=...
// sb-refresh-token=...
```

**Server Logs:**
Check terminal running `pnpm dev` for:
- `POST /api/auth/register 201` (successful registration)
- `GET /api/channels 200` (successful channel fetch)
- Any 401/403 errors

### 2. Verify Database State

```bash
pnpm supabase db shell
```

**Check if user was created:**
```sql
SELECT id, name, email, family_id, role FROM users;
```

**Check if family was created:**
```sql
SELECT id, name, invite_code FROM families;
```

**Check if default channel was created:**
```sql
SELECT c.id, c.family_id, c.name, c.is_default, f.name as family_name
FROM channels c
JOIN families f ON c.family_id = f.id;
```

**Expected Results:**
- 1 user row with role='admin'
- 1 family row
- 1 channel row with name='General' and is_default=true

### 3. Check Supabase Realtime Configuration

**Verify Realtime is enabled on messages table:**
```sql
-- Check if Realtime is enabled
SELECT schemaname, tablename,
       case when schemaname || '.' || tablename IN (
         SELECT publication_name FROM pg_publication_tables
       ) then 'enabled' else 'disabled' end as realtime_status
FROM pg_tables
WHERE tablename = 'messages';
```

**Check RLS policies on messages table:**
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'messages';
```

### 4. Check Browser Network Tab

**Look for these requests:**
1. `POST /api/auth/register` → Should return 201 with user/family data
2. `GET /api/channels` → Should return 200 with channels array
3. WebSocket connection to Supabase Realtime → Check if it connects

**WebSocket Debug:**
In browser console:
```javascript
// Check WebSocket connections
performance.getEntriesByType('resource')
  .filter(r => r.name.includes('realtime'))
```

### 5. Check Environment Variables

**File:** `.env.local`

Required variables:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

**Verify in browser console:**
```javascript
console.log({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...'
});
```

### 6. Check Chat Page State

**Add debug logging to `src/app/chat/page.tsx`:**

After line 68 (where currentChannelId is set):
```typescript
console.log('Debug Chat State:', {
  currentChannelId,
  channelsCount: channels.length,
  currentUserId,
  hasFamilyKey: !!familyKey,
});
```

**Expected Console Output:**
- `currentChannelId`: UUID string
- `channelsCount`: 1 or more
- `currentUserId`: UUID string
- `hasFamilyKey`: true

### 7. Check Realtime Hook Subscription

**Add debug logging to `src/lib/hooks/use-realtime.ts`:**

After line 88 (subscription creation):
```typescript
console.log('Realtime subscription attempt:', {
  channelId,
  subscriptionName,
  supabaseUrl: supabase.supabaseUrl,
});
```

In the subscribe callback (line 144):
```typescript
.subscribe((status, error) => {
  console.log('Realtime subscription status:', { status, error });
  // ... existing code
});
```

## Possible Root Causes

### A. Session Cookie Not Set Properly

**Symptom:** User appears logged in on client, but server doesn't recognize session

**Check:**
```bash
# Look for Set-Cookie headers in registration response
# Network tab → POST /api/auth/register → Response Headers
```

**Possible Fix:**
```typescript
// src/app/api/auth/register/route.ts
// Ensure cookies are set with correct options
```

### B. Channel ID is Null/Undefined

**Symptom:** `useRealtime` receives `null` or invalid channelId

**Check:** Debug logs from step 6 above

**Possible Fix:**
- Ensure `GET /api/channels` succeeds before mounting Realtime hook
- Add null check in chat page before passing to useRealtime

### C. Supabase Realtime Not Configured for Messages Table

**Symptom:** WebSocket connects but subscription fails

**Check:** Step 3 database queries above

**Possible Fix:**
```sql
-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

### D. RLS Policy Blocks Realtime Subscription

**Symptom:** Subscription fails due to RLS enforcement on Realtime events

**Check:** Step 3 RLS policy queries

**Possible Fix:**
- Review RLS policies on channels/messages tables
- Ensure user has permission to SELECT from channels table

### E. CORS/WebSocket Connection Issue

**Symptom:** WebSocket can't connect to Supabase Realtime endpoint

**Check:** Browser console for WebSocket errors

**Possible Fix:**
- Restart Supabase: `pnpm supabase stop && pnpm supabase start`
- Check firewall/network settings

## Debug Commands

```bash
# Check Supabase logs
pnpm supabase logs

# Check Supabase Realtime logs specifically
docker logs supabase_realtime_ourchat

# Check PostgreSQL logs
docker logs supabase_db_ourchat

# Verify migrations applied
pnpm supabase db diff --schema public
```

## Temporary Workarounds

### 1. Disable Realtime (for testing other features)

**In `src/app/chat/page.tsx`:**
```typescript
// Comment out the useRealtime hook
/*
useRealtime(currentChannelId, {
  // ...
});
*/
```

### 2. Use Polling Instead of Realtime

**Add polling interval:**
```typescript
useEffect(() => {
  if (!currentChannelId) return;

  const interval = setInterval(() => {
    fetchMessages(); // Re-fetch messages every 5 seconds
  }, 5000);

  return () => clearInterval(interval);
}, [currentChannelId]);
```

## Related Files

- `src/lib/hooks/use-realtime.ts` (subscription logic)
- `src/app/chat/page.tsx` (consumer of useRealtime)
- `src/lib/supabase/client.ts` (Supabase client setup)
- `.env.local` (environment configuration)
- `supabase/migrations/20251013000000_initial_schema.sql` (RLS policies)

## Expected vs Actual Behavior

**Expected:**
1. User registers → creates family + user + default channel
2. Redirects to `/chat`
3. Page loads channels from API
4. Selects default "General" channel
5. `useRealtime` subscribes to `messages:${channelId}`
6. Subscription status = 'SUBSCRIBED'
7. Chat interface functional, can send/receive messages

**Actual:**
1-4. ✅ Working (presumably)
5. Subscription attempted
6. ❌ Subscription status = 'CHANNEL_ERROR'
7. ❌ Error overlay blocks UI

## Next Steps

1. Run investigation steps 1-7 above
2. Collect console logs, network logs, database state
3. Identify which step fails
4. Apply appropriate fix from "Possible Root Causes" section
5. Test fix and verify subscription succeeds
6. Document solution in this file

## Notes

- Error handler added in Story 2.1 (M4 fix) includes retry logic
- Should see retry attempts in console if connection drops
- No retry attempts visible = initial subscription failing immediately
- Check if error is caught before retry logic can engage
