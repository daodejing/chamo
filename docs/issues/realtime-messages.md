# Issue: Invitee messages not realtime

## Summary
Invitees who just joined a family only see new chat messages after refreshing the page. The Firefox network log shows only the Next.js HMR websocket (`/_next/webpack-hmr`) and no `ws://localhost:4000/graphql` connection, so Apollo subscriptions never stream updates.

## Steps to Reproduce
1. In Profile A, create a family and invite Profile B.
2. Profile B registers, verifies email, accepts invite.
3. On `/chat`, send a message from Profile A.

## Expected
Profile B sees the message instantly.

## Actual
Profile B has to refresh. Network → WS panel shows no `/graphql` socket.

## Investigation Results (2025-11-15)

### Environment Variables ✅ CORRECT
- `.env.local` has correct variables: `NEXT_PUBLIC_GRAPHQL_HTTP_URL` and `NEXT_PUBLIC_GRAPHQL_WS_URL`
- Code expects: `NEXT_PUBLIC_GRAPHQL_HTTP_URL` and `NEXT_PUBLIC_GRAPHQL_WS_URL`
- ⚠️ `.env.local.example` has wrong variable name (`NEXT_PUBLIC_GRAPHQL_URL` should be `NEXT_PUBLIC_GRAPHQL_HTTP_URL`)

### JWT Token Flow ✅ WORKING
- Token is properly stored in localStorage after login/registration
- `acceptInvite()` uses existing token (user is already authenticated)
- WebSocket connectionParams reads token from localStorage dynamically
- **Token is not the issue**

### Backend Subscription Setup ✅ WORKING
- GraphQL subscriptions enabled with `'graphql-ws': true` in `app.module.ts`
- PubSub provider configured correctly
- Subscription resolvers properly defined for messageAdded/Edited/Deleted
- ⚠️ Subscriptions lack `@UseGuards(GqlAuthGuard)` (security issue, but not blocking)
- Backend running on port 4000, HTTP GraphQL endpoint responding
- ⚠️ Backend marked "unhealthy" due to rate limiting (429), but functional

### Frontend Setup ✅ VERIFIED
- Next.js dev server running on port 3002
- Apollo Client properly configured with split link
- WebSocket link created on client-side only (`typeof window !== 'undefined'`)

### Root Cause Hypothesis
The WebSocket connection **is not being established at all**. The `graphql-ws` client had **no error handlers**, so connection failures were being silently swallowed.

**Added comprehensive logging to `client.ts`:**
- Connection lifecycle events (connecting, connected, closed, error)
- Subscription operation routing
- Token existence checks
- Retry attempts

## Next Steps: Testing with Enhanced Logging

1. **Clear browser cache and localStorage** (to ensure clean state)
2. **Open browser DevTools Console** (to see WebSocket logs)
3. **Follow the invite acceptance flow:**
   - Register/login as invitee
   - Accept invite
   - Navigate to `/chat`
4. **Check console for WebSocket logs:**
   - Look for `[WebSocket] 🔄 Connecting to GraphQL server at: ws://localhost:4000/graphql`
   - Look for `[WebSocket] ✅ Connected` or `[WebSocket] ❌ Connection error`
   - Look for `[Apollo] 📡 Routing subscription operation to WebSocket: MessageAdded`
5. **Check Network tab → WS panel** for WebSocket connections

### Expected Console Output (if working):
```
[WebSocket] 🔄 Connecting to GraphQL server at: ws://localhost:4000/graphql
[WebSocket] Getting connection params, token exists: true
[WebSocket] ✅ Connected to GraphQL server
[Apollo] 📡 Routing subscription operation to WebSocket: MessageAdded
```

### If Connection Fails:
Look for specific error messages like:
- CORS errors
- Authentication failures
- Network connectivity issues
- Protocol mismatch errors

## ✅ SOLUTION (2025-11-15)

### Root Cause
The backend configuration had `subscriptions: { 'graphql-ws': true }` but the WebSocket server wasn't actually starting. A backend restart was required to properly initialize the WebSocket subscription server.

### Fix Applied
1. **Enhanced frontend logging** (`src/lib/graphql/client.ts`):
   - Added comprehensive WebSocket event logging
   - Added subscription operation routing logs
   - Added connection parameter logging

2. **Backend restart**:
   - Restarted `ourchat_backend` container to ensure subscription handlers initialized
   - Configuration in `apps/backend/src/app.module.ts` was already correct

### Verification
After the fix, browser console shows:
```
[Apollo] 📡 Routing subscription operation to WebSocket: MessageAdded
[WebSocket] 🔄 Connecting to GraphQL server at: ws://localhost:4000/graphql
[Apollo] 📡 Routing subscription operation to WebSocket: MessageEdited
[Apollo] 📡 Routing subscription operation to WebSocket: MessageDeleted
[WebSocket] Getting connection params, token exists: true
[WebSocket] ✅ Connected to GraphQL server
```

### Status: RESOLVED
Real-time messaging now works for invitees. Messages appear instantly without page refresh.

### Notes for Future
- Keep enhanced logging in place for debugging
- WebSocket server in Apollo Server 5 starts silently (no explicit log)
- Subscription configuration requires backend restart to take effect

## ✅ ADDITIONAL FIX (2025-11-16)

### Issue: Infinite Loop After WebSocket Fix
After the WebSocket connection was working, a new issue emerged: messages were received via subscriptions but caused an infinite re-render loop.

**Error**: `Maximum update depth exceeded. This can happen when a component calls setState inside useEffect...`

### Root Cause
The `decryptMessages` useEffect in `src/app/chat/page.tsx` had `displayMessages.length` in its dependency array (line 300). When subscriptions added messages and changed the length, it triggered the decrypt effect to re-run, which overwrote `displayMessages` with only the query data (excluding subscription updates), creating an infinite loop.

### Fix Applied
**File**: `src/app/chat/page.tsx`

1. **Removed `displayMessages.length` from dependency array** (line 300):
   - Before: `}, [rawMessages, familyKey, user?.id, language, displayMessages.length]);`
   - After: `}, [rawMessages, familyKey, user?.id, language]);`

2. **Fixed infinite loop when no messages** (line 256):
   - Changed from unconditional `setDisplayMessages([])` to conditional:
   ```typescript
   setDisplayMessages((prev) => prev.length === 0 ? prev : []);
   ```
   - Only updates state when it actually needs to change

### Verification (2025-11-16)
- ✅ No "Maximum update depth exceeded" error in console
- ✅ Messages appear in real-time without page refresh
- ✅ Subscription handler logs show messages being added correctly
- ✅ UI updates instantly when new messages arrive

### Status: FULLY RESOLVED
Real-time messaging now works correctly end-to-end with no infinite loops or performance issues.

## ⚠️ REGRESSION & FIX (2025-11-16 Part 2)

### Issue: Auth Guards on Subscriptions Breaking WebSocket
Another developer added `@UseGuards(GqlAuthGuard)` to subscription resolvers, causing WebSocket to close immediately with code 1000.

**Backend Error**:
```
ERROR [ExceptionsHandler] TypeError: Cannot read properties of undefined (reading 'authorization')
at JwtStrategy._jwtFromRequest
at GqlAuthGuard.canActivate
```

### Root Cause
`GqlAuthGuard` extracts JWT from HTTP headers, but WebSocket subscriptions pass auth via `connectionParams`, not headers. The guard failed, closing the connection.

### Fix Applied
**File**: `apps/backend/src/messages/messages.resolver.ts`

Removed `@UseGuards(GqlAuthGuard)` from subscription resolvers (lines 90, 101, 111).

### Security Note
⚠️ **TODO**: Implement WebSocket auth guards that read from `connectionParams`.

Current security:
- Channel-level filtering by `channelId`
- Client-side requires authentication
- Subscription filters validate access

### Status: RESOLVED (security TODO remains)
Real-time messaging works. Proper WebSocket auth guards needed later.

## ✅ SECURITY FIX: WebSocket Authentication Guards (2025-11-16 Part 3)

### Implementation: Dual-Transport Authentication Guard
Created a custom authentication guard that works for both HTTP requests and WebSocket subscriptions by extracting JWT tokens from different sources depending on the transport type.

### Files Created
**`apps/backend/src/auth/gql-subscription-auth.guard.ts`**:
- Custom `CanActivate` guard that handles both HTTP and WebSocket transports
- Extracts JWT from `Authorization` header for HTTP requests
- Extracts JWT from `ctx.req.headers.authorization` for WebSocket subscriptions
- Verifies JWT using `JwtService.verifyAsync()`
- Attaches decoded user payload to context for resolver access
- Throws `UnauthorizedException` for missing or invalid tokens

### Files Modified

**`apps/backend/src/app.module.ts`**:
- Added WebSocket configuration with `onConnect` callback to extract authorization from `connectionParams`
- Modified `context` function to read from `context.connectionParams.authorization` (not `extra`!)
- Formats WebSocket auth as `{ req: { headers: { authorization: token } } }` for guard compatibility

**Key Discovery**: With Apollo Server 5's `graphql-ws` protocol, the return value from `onConnect` is merged into `context.connectionParams`, not `extra`. This is different from the legacy `subscriptions-transport-ws` protocol.

**`apps/backend/src/auth/auth.module.ts`**:
- Added `JwtModule` to exports array to allow other modules to inject `JwtService`

**`apps/backend/src/messages/messages.module.ts`**:
- Imported `JwtModule.register()` to provide JWT functionality
- Added `GqlSubscriptionAuthGuard` to providers
- Imported `AuthModule` for authentication services

**`apps/backend/src/messages/messages.resolver.ts`**:
- Applied `@UseGuards(GqlSubscriptionAuthGuard)` to all subscription resolvers:
  - `messageAdded` (line 91)
  - `messageEdited` (line 102)
  - `messageDeleted` (line 112)

### Authentication Flow

1. **Client Connection**: Client connects to WebSocket with JWT in `connectionParams.authorization`
2. **onConnect Callback**: Extracts token and returns `{ authorization: token }`
3. **Context Merging**: The return value is merged into `context.connectionParams` by graphql-ws
4. **Context Formatting**: Context handler formats it as `{ req: { headers: { authorization: token } } }`
5. **Guard Execution**: Guard reads from `ctx.req.headers.authorization` and verifies JWT
6. **User Attachment**: Decoded JWT payload is attached to `ctx.user` for resolver access
7. **Subscription Authorized**: If valid, subscription proceeds; if invalid, throws `UnauthorizedException`

### Dependency Injection Fix

**Error encountered**: `UnknownDependenciesException: Nest can't resolve dependencies of the GqlSubscriptionAuthGuard (?). Please make sure that the argument JwtService at index [0] is available in the MessagesModule context.`

**Solution**:
1. Export `JwtModule` from `AuthModule`
2. Import `JwtModule.register()` in `MessagesModule`
3. Add `GqlSubscriptionAuthGuard` to `MessagesModule` providers

### Testing & Verification

**Debug Process**:
1. Initially tested with `onConnect` return merged into `extra` - didn't work
2. Added comprehensive debug logging to track context flow
3. Discovered authorization was in `context.connectionParams`, not `extra`
4. Updated context handler to read from correct location
5. Verified with real message sending between two authenticated users

**User Confirmation**: "messages received and displaying!" ✅

### Status: FULLY RESOLVED WITH SECURITY
WebSocket subscriptions now require valid JWT authentication. Unauthorized clients cannot subscribe to message updates.
