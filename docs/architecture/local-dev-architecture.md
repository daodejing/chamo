# OurChat Local Development Architecture

**Date:** 2025-10-18
**Status:** Active Development
**Related:** [Kong Realtime Investigation](../testing/kong-realtime-investigation.md), [Kong Realtime Solution](../testing/kong-realtime-solution.md)

---

## Overview

This document describes the architecture of OurChat's local development environment, focusing on how requests flow from the browser through various services in the Supabase local stack.

---

## Components

### Frontend Layer

**Browser**
- User interface running OurChat application
- Makes HTTP requests for API calls
- Establishes WebSocket connections for real-time features
- Runs on `http://localhost:3002`

**Next.js Dev Server (Port 3002)**
- Serves React application
- Handles server-side rendering (SSR)
- Runs middleware for authentication
- Proxies API routes to backend services

### Proxy Layer

**Realtime Proxy (Port 54320)**
- Custom Node.js proxy server
- Routes REST API requests → Kong (port 54321)
- Routes WebSocket requests → Realtime (port 4000) **[BYPASS KONG]**
- Extracts authentication tokens from cookies
- Adds necessary headers for authentication

### Supabase Backend Services

**Kong API Gateway (Port 54321)**
- Entry point for REST API requests
- Routes traffic to appropriate backend services
- Validates API keys and JWT tokens
- Applies rate limiting and CORS policies
- **Issue:** Cannot process WebSocket query parameters

**GoTrue (Port 9999)**
- Authentication service
- Handles user login, registration, sessions
- Issues JWT tokens
- Manages user profiles

**PostgREST (Port 3000)**
- Auto-generated REST API for PostgreSQL
- Enforces Row Level Security (RLS)
- Provides CRUD operations on database tables
- Handles complex queries with filtering/sorting

**Realtime (Port 4000)**
- WebSocket server for real-time features
- Handles subscriptions to database changes
- Manages presence (user online status)
- Broadcasts messages to connected clients
- **Accessed directly, bypassing Kong**

**PostgreSQL (Port 54322)**
- Primary database
- Stores all application data
- Enforces RLS policies
- Triggers notify Realtime of changes

---

## Architecture Diagrams

### Current Implementation (Realtime Bypass)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           BROWSER (User)                             │
│                      http://localhost:3002                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP Requests & WebSocket Upgrades
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Next.js Dev Server (Port 3002)                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  - React SSR                                                    │ │
│  │  - Authentication Middleware                                    │ │
│  │  - API Routes (/api/*)                                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ All Supabase requests
                             │ NEXT_PUBLIC_SUPABASE_URL=http://localhost:54320
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│             Realtime Proxy (Port 54320) - Smart Router              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Routing Logic:                                                 │ │
│  │  • WebSocket Upgrade?  → Direct to Realtime (port 4000)        │ │
│  │  • HTTP Request?       → Forward to Kong (port 54321)          │ │
│  │                                                                  │ │
│  │  Authentication:                                                │ │
│  │  • Extract JWT from cookies                                     │ │
│  │  • Add Authorization header                                     │ │
│  │  • Pass through API keys                                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────┬───────────────────────────────────┬───────────────────┘
              │                                   │
              │ HTTP REST API                     │ WebSocket (BYPASS)
              │                                   │
              ▼                                   ▼
┌──────────────────────────────┐   ┌──────────────────────────────────┐
│  Kong API Gateway (54321)    │   │   Realtime Service (4000)        │
│  ┌────────────────────────┐  │   │  ┌────────────────────────────┐  │
│  │  Routes:               │  │   │  │  - WebSocket server        │  │
│  │  • /auth/v1/*          │  │   │  │  - Postgres CDC listener   │  │
│  │  • /rest/v1/*          │  │   │  │  - Presence management     │  │
│  │  • /storage/v1/*       │  │   │  │  - Broadcast channels      │  │
│  │  • /functions/v1/*     │  │   │  │  - Authentication checks   │  │
│  │                        │  │   │  └────────────────────────────┘  │
│  │  Security:             │  │   └──────────────────────────────────┘
│  │  • API key validation  │  │                    │
│  │  • JWT verification    │  │                    │ Listens for
│  │  • Rate limiting       │  │                    │ DB changes
│  │  • CORS handling       │  │                    │
│  └────────────────────────┘  │                    ▼
└──────────────┬───────────────┘   ┌──────────────────────────────────┐
               │                   │   PostgreSQL (Port 54322)        │
               │                   │  ┌────────────────────────────┐  │
               ▼                   │  │  - Application database    │  │
┌──────────────────────────────┐  │  │  - Row Level Security      │  │
│   GoTrue (Port 9999)         │  │  │  - Triggers & Functions    │  │
│  ┌────────────────────────┐  │  │  │  - Tables:                 │  │
│  │  - User authentication │  │  │  │    * users                 │  │
│  │  - Session management  │  │  │    * families              │  │
│  │  - JWT token issuing   │  │  │    * channels              │  │
│  │  - Password resets     │  │  │    * messages              │  │
│  └────────────────────────┘  │  │  └────────────────────────────┘  │
└───────────────────────────────┘  └──────────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│   PostgREST (Port 3000)      │
│  ┌────────────────────────┐  │
│  │  - Auto-generated API  │  │
│  │  - CRUD operations     │  │
│  │  - Query filtering     │  │
│  │  - RLS enforcement     │  │
│  └────────────────────────┘  │
└───────────────────────────────┘
               │
               │ SQL Queries
               ▼
         [PostgreSQL]
```

---

## Request Flow Details

### 1. Page Load (HTTP Request)

```
Browser → Next.js (3002) → Proxy (54320) → Kong (54321) → GoTrue (9999)
                                                         ↓
                                          Validates session JWT
                                                         ↓
                                          Returns user data ✅
```

**Purpose:** Check if user is authenticated

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Cookie: sb-localhost-auth-token=...
```

---

### 2. Database Query (HTTP Request)

```
Browser → Next.js (3002) → API Route (/api/channels)
                               ↓
                    Proxy (54320) → Kong (54321) → PostgREST (3000)
                                                         ↓
                                                    PostgreSQL (54322)
                                                         ↓
                                                   Query channels table
                                                         ↓
                                             Apply RLS (user's family only)
                                                         ↓
                                              Return filtered results ✅
```

**Purpose:** Fetch channels for user's family

**Example Request:**
```
GET /rest/v1/channels?select=id,name,description&family_id=eq.XXX
```

---

### 3. Real-time WebSocket (BYPASSES KONG)

```
Browser → Next.js (3002) → Proxy (54320) → Realtime (4000)
                                   ↓             ↓
                     Detects WebSocket    Accepts connection
                           upgrade              ↓
                               ↓          Validates JWT token
                     Extracts JWT from          ↓
                          cookies         Subscribes to channel
                               ↓                 ↓
                     Adds Authorization   Listens to PostgreSQL
                           header              ↓
                               ↓           Notifies on changes ✅
```

**Why Bypass Kong?**
- Kong blocks WebSocket upgrades with query parameters
- Kong's `request-transformer` cannot access query params during WebSocket handshake
- Direct connection to Realtime (4000) avoids Kong entirely

**WebSocket URL:**
```
ws://localhost:54320/realtime/v1/websocket?apikey=sb_publishable_XXX&vsn=1.0.0
```

**Proxy Behavior:**
1. Detects WebSocket upgrade request (`Upgrade: websocket` header)
2. Extracts JWT token from `sb-localhost-auth-token` cookie
3. Adds `Authorization: Bearer <JWT>` header
4. Forwards directly to Realtime (port 4000), **NOT Kong**

---

## Environment Configuration

### Development (.env.local)

```bash
# Supabase Core
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_XXX
SUPABASE_SERVICE_ROLE_KEY=sb_secret_XXX

# Proxy Configuration (Routes through port 54320)
REALTIME_PROXY_PORT=54320
REALTIME_PROXY_KONG_TARGET=http://localhost:54321
REALTIME_PROXY_DIRECT_TARGET=ws://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54320
```

### Production

```bash
# Hosted Supabase (No proxy needed)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# Proxy not used in production
# REALTIME_PROXY_* variables ignored
```

---

## Port Reference

| Port  | Service           | Purpose                          | Access      |
|-------|-------------------|----------------------------------|-------------|
| 3002  | Next.js Dev       | Frontend application             | Browser     |
| 54320 | Realtime Proxy    | Smart router (custom)            | Next.js     |
| 54321 | Kong              | API Gateway                      | Proxy       |
| 9999  | GoTrue            | Authentication                   | Kong        |
| 3000  | PostgREST         | Database REST API                | Kong        |
| 4000  | Realtime          | WebSocket server                 | Proxy       |
| 54322 | PostgreSQL        | Database                         | Services    |
| 54323 | Studio            | Supabase Admin UI                | Browser     |

---

## Security Considerations

### Local Development

**Authentication:**
- JWT tokens validated by GoTrue (for HTTP) and Realtime (for WebSocket)
- RLS policies enforced by PostgreSQL
- API keys prevent unauthorized access

**Limitations:**
- WebSocket bypasses Kong security layer
- Acceptable for local single-developer environment
- **NOT suitable for multi-user or exposed environments**

### Production

**All traffic through Kong:**
- No proxy needed
- Kong validates all requests
- Standard Supabase security applies
- WebSocket authentication works correctly

---

## Troubleshooting

### Issue: WebSocket Connection Fails (403)

**Symptom:** Browser console shows WebSocket connection refused

**Cause:** Proxy not running or not configured correctly

**Solution:**
```bash
# Check proxy is running
lsof -i :54320

# Restart dev server
pnpm dev

# Check environment variables are loaded
echo $REALTIME_PROXY_PORT
```

---

### Issue: Database Queries Fail (401)

**Symptom:** API routes return unauthorized

**Cause:** JWT token expired or invalid

**Solution:**
```bash
# Clear cookies and re-login
# Check token in browser DevTools → Application → Cookies
```

---

### Issue: Realtime Messages Not Appearing

**Symptom:** Messages sent but not received in real-time

**Possible Causes:**
1. WebSocket not connected
2. Channel subscription failed
3. RLS policies blocking SELECT

**Debug Steps:**
```javascript
// Check WebSocket status in browser console
supabase.realtime.channels.forEach(channel => {
  console.log(channel.state) // Should be "joined"
})

// Check RLS policies allow SELECT
// In database: GRANT SELECT ON messages TO authenticated;
```

---

## Performance Characteristics

### Latency

| Operation                  | Expected Latency | Notes                           |
|----------------------------|------------------|---------------------------------|
| Page load (authenticated)  | 50-100ms         | JWT validation + RLS check      |
| Database query (REST)      | 20-50ms          | PostgREST + PostgreSQL          |
| Realtime message delivery  | 50-200ms         | WebSocket + Postgres trigger    |
| WebSocket connection       | 10-30ms          | Direct to Realtime (no Kong)    |

### Scalability

**Local Development:**
- Single user
- No rate limiting needed
- Direct connections acceptable

**Production:**
- Kong handles rate limiting
- Connection pooling via Supavisor
- Horizontal scaling supported

---

## Future Improvements

### Option 1: Fix Kong WebSocket Support

**When:** If Supabase CLI fixes Kong configuration

**Changes Needed:**
- Remove proxy bypass for WebSocket
- Route all traffic through Kong
- Update environment configuration

---

### Option 2: Use Hosted Supabase

**When:** Moving to production or multi-developer testing

**Benefits:**
- No proxy needed
- Full Kong security
- Better performance
- Automatic backups

---

## References

- [Kong Realtime Investigation](../testing/kong-realtime-investigation.md) - Technical analysis of Kong WebSocket issue
- [Kong Realtime Solution](../testing/kong-realtime-solution.md) - Original proxy implementation attempt
- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
- [Kong Documentation](https://docs.konghq.com/)
- [Realtime Protocol](https://supabase.com/docs/guides/realtime/protocol)

---

**Last Updated:** 2025-10-18
**Maintainer:** Development Team
**Status:** Investigation Complete - Known Limitation

## Critical Finding

**WebSocket connections to Realtime cannot bypass Kong in local development.**

**Reason:** Kong provides essential authentication and header transformation that Realtime requires. Bypassing Kong causes Realtime to reject connections because:
1. Kong validates the `apikey` query parameter and converts it to a JWT token
2. Kong adds required authentication headers (`Authorization`, `apikey`, etc.)
3. Realtime expects these Kong-transformed headers and won't accept direct connections
4. The Docker container IP (172.19.0.6:4000) is accessible but Realtime service requires Kong's authentication layer

**Attempted Solutions:**
- ✅ Option 1: Regenerate Supabase keys - No effect
- ❌ Option 2: Bypass Kong directly to Realtime - Realtime rejects unauthenticated connections
- ❌ Option 3: Proxy with header transformation - Still requires Kong's authentication logic

**Root Cause:** Kong API Gateway's `request-transformer` plugin cannot access query parameters during WebSocket upgrade handshakes, causing all WebSocket connections with `?apikey=xxx` to fail with 403 Forbidden.

## Recommended Solutions

### Solution 1: Use Hosted Supabase (Recommended)
**Pros:**
- No Kong WebSocket issues (hosted Supabase handles this correctly)
- Free tier: 50,000 MAU, 500MB database, 1GB file storage
- Better performance than local Docker
- Automatic backups and monitoring

**Cons:**
- Requires internet connection
- Data stored remotely

**Implementation:**
1. Create project at https://supabase.com
2. Update `.env.local` with hosted project URL and keys
3. Remove proxy configuration

### Solution 2: Disable Real-time Features Temporarily
**Pros:**
- Can continue local development
- All other features work (auth, database, storage)

**Cons:**
- No real-time message delivery
- Must manually refresh to see new messages

**Implementation:**
- Comment out real-time subscription code
- Use polling or manual refresh as fallback

### Solution 3: Wait for Supabase Fix
**Status:** Tracked in GitHub issues #32631, #33153, #1442, #2474

The Supabase team is aware of this issue. Kong Issue #7122 documents the root cause.

**Last Updated:** 2025-10-18
**Maintainer:** Development Team
**Status:** Investigation Complete - Known Kong Limitation
