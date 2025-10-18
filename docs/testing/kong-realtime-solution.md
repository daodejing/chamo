# Kong Realtime WebSocket Authentication - Implementation Plan

**Date:** 2025-10-18
**Status:** READY FOR IMPLEMENTATION
**Related:** [kong-realtime-investigation.md](./kong-realtime-investigation.md)

---

## Executive Summary

This document outlines the implementation plan for solving the Kong WebSocket authentication issue identified during the Realtime investigation. The solution uses an environment-configurable development proxy that runs as part of the dev server, converting WebSocket query parameters to headers before Kong processes the request.

**Key Principle:** Local development only - zero production impact.

---

## Problem Statement

Kong API Gateway's `request-transformer` plugin cannot access query parameters (`?apikey=...`) during WebSocket handshakes, only HTTP headers. Since WebSocket connections send the `apikey` as a query parameter (per WebSocket protocol standards), Kong rejects all Realtime WebSocket connections with `403 Forbidden`.

**Reference:** Full technical analysis in [kong-realtime-investigation.md](./kong-realtime-investigation.md)

---

## Solution Architecture

### Overview

```
Browser                  Proxy Server               Kong                 Realtime
  |                           |                       |                      |
  | ws://localhost:54322      |                       |                      |
  | ?apikey=sb_pub_xxx        |                       |                      |
  |-------------------------->|                       |                      |
  |                           |                       |                      |
  |                           | Extract apikey from   |                      |
  |                           | query params          |                      |
  |                           |                       |                      |
  |                           | ws://localhost:54321  |                      |
  |                           | Header: apikey=xxx    |                      |
  |                           |---------------------->|                      |
  |                           |                       |                      |
  |                           |                       | Validates apikey     |
  |                           |                       | Converts to JWT      |
  |                           |                       |                      |
  |                           |                       | ws://realtime:4000   |
  |                           |                       | Header: Bearer JWT   |
  |                           |                       |--------------------->|
  |                           |                       |                      |
  |<-------------------------------------------------------------------------->|
  |                     WebSocket connection established                       |
```

### Components

1. **Proxy Server** (`scripts/realtime-proxy.js`)
   - Lightweight Node.js HTTP proxy
   - Listens on port 54322
   - Intercepts WebSocket upgrade requests
   - Moves `apikey` from query params to headers
   - Proxies to Kong at localhost:54321

2. **Environment Configuration** (`.env.local`)
   - `NEXT_PUBLIC_SUPABASE_REALTIME_URL=ws://localhost:54322`
   - Optional: only set in local development
   - Not present in production environments

3. **Supabase Client** (`src/lib/supabase/client.ts`)
   - Reads `NEXT_PUBLIC_SUPABASE_REALTIME_URL` env var
   - If set, overrides Realtime endpoint
   - If not set, uses standard Supabase URL

4. **Dev Server Integration** (`package.json`)
   - Use `concurrently` to run proxy + Next.js together
   - `pnpm dev` starts both processes
   - `pnpm dev:next-only` bypasses proxy (for debugging)

---

## Implementation Steps

### Step 1: Create Proxy Server

**File:** `scripts/realtime-proxy.js`

```javascript
/**
 * Development-only WebSocket proxy for Supabase Realtime
 * Converts query parameters to headers before Kong sees the request
 *
 * Why: Kong's request-transformer can only access headers, not query params.
 * WebSocket authentication requires apikey in query params, causing Kong to reject with 403.
 *
 * Usage: Started automatically via `pnpm dev`
 */

const http = require('http');
const httpProxy = require('http-proxy');
const url = require('url');

// Only run in development
if (process.env.NODE_ENV === 'production') {
  console.log('Realtime proxy skipped (production mode)');
  process.exit(0);
}

const PROXY_PORT = 54322;
const KONG_TARGET = 'http://localhost:54321';

// Create proxy server
const proxy = httpProxy.createProxyServer({
  target: KONG_TARGET,
  ws: true, // Enable WebSocket proxying
  changeOrigin: true,
});

// Create HTTP server
const server = http.createServer((req, res) => {
  // Extract apikey from query params and add as header
  const parsedUrl = url.parse(req.url, true);
  if (parsedUrl.query.apikey) {
    req.headers['apikey'] = parsedUrl.query.apikey;
  }

  // Proxy HTTP request
  proxy.web(req, res);
});

// Handle WebSocket upgrade requests
server.on('upgrade', (req, socket, head) => {
  // Extract apikey from query params and add as header
  const parsedUrl = url.parse(req.url, true);
  if (parsedUrl.query.apikey) {
    req.headers['apikey'] = parsedUrl.query.apikey;
  }

  // Proxy WebSocket upgrade
  proxy.ws(req, socket, head);
});

// Error handling
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  if (res && !res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy error');
  }
});

// Start server
server.listen(PROXY_PORT, () => {
  console.log(`🔌 Realtime proxy running on http://localhost:${PROXY_PORT}`);
  console.log(`   Forwarding to Kong at ${KONG_TARGET}`);
  console.log(`   Converting query params to headers for WebSocket auth`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Realtime proxy...');
  server.close(() => {
    proxy.close();
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    proxy.close();
    process.exit(0);
  });
});
```

---

### Step 2: Update Environment Configuration

**File:** `.env.local`

Add:
```env
# Realtime WebSocket Proxy (Local Development Only)
# Routes Realtime WebSocket connections through a proxy that converts
# query parameters to headers, solving Kong authentication issue.
#
# Production: Leave unset - uses standard Supabase Realtime URL
# Debugging: Comment out to bypass proxy and test direct connection
NEXT_PUBLIC_SUPABASE_REALTIME_URL=ws://localhost:54322
```

---

### Step 3: Update Supabase Client

**File:** `src/lib/supabase/client.ts`

```typescript
/**
 * Supabase client for browser (client components).
 */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Optional: Override Realtime URL for local development proxy
  const realtimeUrl = process.env.NEXT_PUBLIC_SUPABASE_REALTIME_URL;

  return createBrowserClient(supabaseUrl, supabaseKey, {
    realtime: realtimeUrl ? {
      // Use custom Realtime endpoint (development proxy)
      params: {
        eventsPerSecond: 10,
      },
    } : undefined,
    global: {
      headers: realtimeUrl ? {
        'X-Realtime-Endpoint': realtimeUrl,
      } : {},
    },
  });
}
```

**Note:** Need to verify exact API for overriding Realtime endpoint. May need to use `supabase.realtime.setAuth()` pattern or different configuration approach.

---

### Step 4: Add Dependencies

**Command:**
```bash
pnpm add -D concurrently http-proxy
```

**Why:**
- `concurrently`: Run multiple npm scripts simultaneously
- `http-proxy`: Production-ready HTTP/WebSocket proxy library

---

### Step 5: Update Package Scripts

**File:** `package.json`

Update scripts section:
```json
{
  "scripts": {
    "dev": "concurrently --names \"PROXY,NEXT\" --prefix-colors \"cyan,green\" \"node scripts/realtime-proxy.js\" \"next dev -p 3002\"",
    "dev:next-only": "next dev -p 3002",
    "build": "next build",
    "start": "next start"
  }
}
```

**Usage:**
- `pnpm dev` - Start proxy + Next.js (normal development)
- `pnpm dev:next-only` - Start Next.js only (bypass proxy for debugging)

---

## Testing & Verification

### Test 1: Proxy Server Starts
```bash
pnpm dev
```

**Expected:**
- Console shows both PROXY and NEXT processes
- "Realtime proxy running on http://localhost:54322"
- Next.js starts on port 3002

---

### Test 2: WebSocket Connection Succeeds

1. Open browser to `http://localhost:3002/chat`
2. Open browser DevTools → Network → WS tab
3. Look for WebSocket connection to `ws://localhost:54322/realtime/v1/websocket`

**Expected:**
- Status: 101 Switching Protocols (not 403)
- Connection state: Connected
- Console: "Realtime auth token set"

---

### Test 3: Real-time Message Delivery

1. Open chat in two browser tabs (same user or different users)
2. Send message in Tab 1
3. Observe Tab 2

**Expected:**
- Message appears in Tab 2 within 1-2 seconds
- No manual refresh required
- Realtime subscription status: SUBSCRIBED

---

### Test 4: Integration Tests Pass

```bash
NEXT_PUBLIC_API_URL=http://localhost:3002 pnpm test src/tests/integration/chat/multi-user-messaging.test.ts
```

**Expected:**
- All tests pass
- No WebSocket connection errors
- Message delivery times < 2000ms

---

### Test 5: E2E Tests Pass

```bash
pnpm test:e2e tests/e2e/chat/messaging.spec.ts
```

**Expected:**
- All Playwright tests pass
- Real-time message delivery works in headless browser

---

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | - | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | - | Supabase anonymous key |
| `NEXT_PUBLIC_SUPABASE_REALTIME_URL` | No | (unset) | Custom Realtime endpoint. Set to `ws://localhost:54322` for local dev proxy. |

### Proxy Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Proxy port | 54322 | Must not conflict with existing services |
| Kong target | http://localhost:54321 | Standard Supabase local dev port |
| WebSocket support | Enabled | Required for Realtime |

---

## Debugging

### Proxy not starting

**Symptom:** `pnpm dev` shows only NEXT process

**Solution:**
1. Check `scripts/realtime-proxy.js` exists
2. Ensure `http-proxy` is installed: `pnpm add -D http-proxy`
3. Check for port conflicts: `lsof -i :54322`

---

### WebSocket still getting 403

**Symptom:** Browser shows 403 error on WebSocket connection

**Possible causes:**
1. `.env.local` not updated with `NEXT_PUBLIC_SUPABASE_REALTIME_URL`
2. Environment variable not loaded (restart dev server)
3. Proxy not running (check console for "Realtime proxy running")
4. Wrong proxy URL (should be `ws://localhost:54322`, not `http://`)

**Debug steps:**
```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_REALTIME_URL

# Check proxy is listening
curl http://localhost:54322

# Check Kong is listening
curl http://localhost:54321
```

---

### Real-time still not working

**Symptom:** WebSocket connects but messages don't appear in real-time

**Possible causes:**
1. Realtime publication not enabled (see investigation doc)
2. RLS policies blocking (verify user permissions)
3. Channel subscription failed (check browser console)

**Debug steps:**
1. Check browser console for Realtime errors
2. Verify messages table in publication:
   ```sql
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```
3. Check RLS policies allow SELECT on messages table

---

## Production Deployment

### Important: Proxy is NOT used in production

**How to ensure:**

1. **Do not set** `NEXT_PUBLIC_SUPABASE_REALTIME_URL` in production environment
2. Proxy script exits early if `NODE_ENV=production`
3. Production uses standard Supabase Realtime URL (no Kong issue on hosted Supabase)

**Verification:**
```bash
# In production build
NODE_ENV=production node scripts/realtime-proxy.js
# Output: "Realtime proxy skipped (production mode)"
```

---

## Success Criteria

- ✅ Proxy starts automatically with `pnpm dev`
- ✅ WebSocket connections succeed (no 403 errors)
- ✅ Real-time messages delivered within 2 seconds
- ✅ All integration tests pass
- ✅ All E2E tests pass
- ✅ Zero impact on production builds
- ✅ Easy to disable for debugging (comment out env var)

---

## Next Steps

1. Implement proxy server
2. Update environment configuration
3. Update Supabase client (verify API for Realtime endpoint override)
4. Install dependencies
5. Update package.json scripts
6. Test all verification steps
7. Update kong-realtime-investigation.md with resolution
8. Commit changes with clear message referencing investigation

---

## References

- [Kong Realtime Investigation](./kong-realtime-investigation.md) - Full technical analysis
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [http-proxy Library](https://github.com/http-party/node-http-proxy)
- [WebSocket RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)

---

**Status:** Ready for implementation
**Estimated Time:** 1-2 hours (including testing)
**Risk Level:** Low (dev-only, easy rollback)
