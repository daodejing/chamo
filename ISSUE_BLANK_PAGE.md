# Issue: Blank Page on E2EE Test Harness

## Summary
The E2EE test harness page at `/test-e2ee` displays briefly then turns into a blank white page.

## Environment
- **Next.js**: 15.5.4
- **React**: 19.0.0
- **Dev Server**: Running on http://localhost:3000
- **Page URL**: http://localhost:3000/test-e2ee
- **File**: `/src/app/test-e2ee/page.tsx`

## What We Know
✅ **Working:**
- Dev server compiles successfully (no TypeScript/build errors)
- Server starts cleanly: `✓ Ready in 1506ms`
- JSX syntax error fixed (escaped `<` to `&lt;` in line 196)
- Cache cleared (deleted `.next` directory)
- All E2EE library imports exist and are correct:
  - `@/lib/e2ee/key-management`
  - `@/lib/e2ee/encryption`
- Page uses `'use client'` directive (required for Web Crypto API)

❌ **Issue:**
- Page content displays briefly
- Then changes to blank white page
- Suggests a **React runtime error** or **hydration mismatch**

## Previous Fixes Applied
1. **JSX Syntax Error (Line 196)**: Changed `< 20ms` to `&lt; 20ms`
2. **Stale Cache**: Cleared `.next` directory
3. **Server Restart**: Restarted dev server multiple times

## Investigation Suggestions

### 1. Check Browser Console (PRIORITY)
Open browser DevTools (F12) and check the Console tab for:
- React errors (hydration mismatches)
- JavaScript runtime errors
- Failed module imports
- Web Crypto API availability errors

**How to check:**
```
1. Open http://localhost:3000/test-e2ee
2. Press F12 (or Cmd+Option+I on Mac)
3. Go to Console tab
4. Look for red error messages
5. Screenshot or copy the errors
```

### 2. Check Network Tab
Look for failed resource loads:
- Check if `/_next/static/chunks/...` files are loading
- Look for 404 or 500 errors
- Check if all CSS/JS bundles load successfully

### 3. Check Browser Compatibility
The page uses Web Crypto API (`crypto.subtle`). Verify:
- Browser supports Web Crypto API
- Page is served over HTTPS or localhost (required for crypto.subtle)
- Test in different browsers (Chrome, Firefox, Safari)

**Test Web Crypto support:**
Open browser console on ANY page and run:
```javascript
console.log('Web Crypto available:', !!window.crypto.subtle)
```

### 4. Simplify the Test Page
Create a minimal test to isolate the issue:

**Option A: Test without E2EE imports**
Comment out all E2EE function calls and just render static content:
```typescript
export default function E2EETestPage() {
  return <div><h1>Test Page</h1></div>;
}
```

**Option B: Test one function at a time**
Start with just the message encryption button, add others incrementally.

### 5. Check for Async/Await Issues
The test functions use `async/await` with Web Crypto API. Potential issues:
- Unhandled promise rejections
- Errors in async initialization
- IndexedDB not available in browser

### 6. Check React 19 Compatibility
React 19 is relatively new. Possible issues:
- Hydration changes in React 19
- Stricter error boundaries
- Client component rendering differences

### 7. Server-Side Logs
Check the dev server output after visiting the page:
```bash
# Get latest server logs
pnpm exec next dev
# Then visit the page and watch for compilation errors
```

### 8. Test in Production Build
Development mode has stricter checks. Try a production build:
```bash
pnpm build
pnpm start
# Then visit http://localhost:3000/test-e2ee
```

## Likely Culprits (Ranked)

1. **Web Crypto API not available** (50% probability)
   - Browser doesn't support crypto.subtle
   - Mixed content (HTTP/HTTPS) issue

2. **React hydration mismatch** (30% probability)
   - State initialization issue
   - Client/server rendering mismatch

3. **Unhandled async error** (15% probability)
   - Promise rejection in useEffect
   - IndexedDB access denied

4. **React 19 breaking change** (5% probability)
   - New strict mode behavior
   - Client component rendering change

## Next Steps

**IMMEDIATE:**
1. Open browser console and check for errors
2. Share any error messages found

**IF NO ERRORS IN CONSOLE:**
1. Simplify the page to just `<h1>Test</h1>`
2. Gradually add back functionality
3. Find which part causes the blank page

**IF CRYPTO API MISSING:**
1. Verify browser support: https://caniuse.com/cryptography
2. Check if localhost or HTTPS (required)
3. Test in Chrome/Firefox (best support)

## Files Involved

- `/src/app/test-e2ee/page.tsx` - Test harness page
- `/src/lib/e2ee/key-management.ts` - Key generation/distribution
- `/src/lib/e2ee/encryption.ts` - Encryption functions
- `/src/lib/e2ee/storage.ts` - IndexedDB storage

## Related Commits

- `52f8554` - Fix JSX syntax error: escape < character
- Cache cleared and server restarted (not committed)

---
**Created**: 2025-10-13
**Resolved**: 2025-10-13
**Status**: ✅ RESOLVED - Port Conflict

## Resolution

### Root Cause
The blank page issue was **NOT** a React error or code problem. It was a **port conflict**:
- Port 3000 was already in use by another application (NestJS backend)
- The 404 error format `{"message":"Cannot GET /test-e2ee","error":"Not Found","statusCode":404}` is NestJS/Express, not Next.js
- Our Next.js server claimed to start on 3000 but was actually being blocked

### Solution Implemented

1. **Created Port Allocation Strategy** (`PORT_ALLOCATION.md`)
   - Documented all port assignments
   - Established best practices for port management
   - Assigned port 3002 for primary development
   - Reserved port 4000 for E2E testing

2. **Updated package.json**
   - Changed `dev` script from `next dev` to `next dev --port 3002`
   - Ensured explicit port declaration to avoid conflicts

3. **Verified Functionality**
   - ✅ Page loads correctly on http://localhost:3002/test-e2ee
   - ✅ Message encryption test passed
   - ✅ File encryption test passed
   - ✅ Performance test passed (0.06ms avg, target: <20ms)
   - ✅ No console errors (only React DevTools info message)

### Key Lessons

1. **Always use explicit ports** - Never rely on default port 3000
2. **Verify port availability** - Check response format to identify service type
3. **Document port allocation** - Maintain a clear port management strategy
4. **Don't blindly kill processes** - Investigate first, manage ports deliberately

### Files Modified

- `package.json` - Updated dev script to use port 3002
- `PORT_ALLOCATION.md` - Created comprehensive port management documentation
