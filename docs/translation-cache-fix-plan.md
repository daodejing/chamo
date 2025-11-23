# Translation Cache Fix Plan

**Date:** 2025-11-17
**Issue:** Translation display stuck on "Translating..." for real-time messages
**Decision:** Option A - Keep E2EE for database storage, remove redundant frontend cache query

---

## Problem Analysis

### Current Issues
1. GraphQL cache query fails with "Bad Request Exception" for new messages
2. Component unmounts during translation request (race condition)
3. Rate limit errors (429) not displayed properly due to unmount timing
4. Redundant cache checking (frontend GraphQL + backend database)

### Current Flow (Problematic)
```
1. Frontend: GraphQL query to check cache
   → FAILS for new messages with "Bad Request Exception"
2. Frontend: REST API call to /api/translate
3. Backend: Checks database cache (duplicate check!)
4. Backend: Calls Groq if cache miss
5. Backend: Returns translation
6. Frontend: Encrypts translation with family key
7. Frontend: GraphQL mutation to save encrypted translation
```

### Root Cause
- Frontend GraphQL cache query is redundant (backend already checks cache)
- Fails for newly arrived WebSocket messages
- Causes race conditions with component lifecycle

---

## Solution

Remove frontend GraphQL cache query. Let backend handle cache checking via REST API.

### New Flow (Simplified)
```
1. Frontend: REST API call to /api/translate
2. Backend: Checks database cache
3. Backend: Calls Groq if cache miss
4. Backend: Returns translation (with cached: true/false flag)
5. Frontend: Encrypts translation with family key
6. Frontend: GraphQL mutation to save encrypted translation
```

### Privacy Model Maintained
- ✅ Messages: Encrypted client-side, database stores ciphertext
- ✅ Translations: Backend sees plaintext temporarily, database stores encrypted ciphertext
- ✅ Database breach: Exposes only encrypted data
- ✅ Family key: Remains client-side only
- ⚠️ Backend + Groq temporarily see plaintext during translation (unavoidable)

---

## Implementation Steps

### 1. Remove GraphQL Cache Query from TranslationDisplay

**File:** `src/components/chat/translation-display.tsx`

**Remove:** Lines ~246-303 (entire GraphQL cache query block)

Delete this code:
```typescript
// 1. Check for cached translation via GraphQL (only if we can decrypt)
if (hasFamilyKey && familyKey && !cacheDisabledRef.current) {
  try {
    debugLog('querying GraphQL cache');
    const { data } = await client.query<
      MessageTranslationLookupQuery,
      MessageTranslationLookupQueryVariables
    >({
      query: MessageTranslationLookupDocument,
      variables: {
        messageId,
        targetLanguage,
      },
      fetchPolicy: 'network-only',
    });

    if (controller.signal.aborted || !isMountedRef.current) {
      return;
    }

    const encrypted = data?.messageTranslation?.encryptedTranslation;

    if (encrypted) {
      debugLog('cache hit; attempting decrypt');
      const decrypted = await decryptMessage(encrypted, familyKey);

      if (controller.signal.aborted || !isMountedRef.current) {
        return;
      }

      if (!textsMatch(decrypted, originalText)) {
        debugLog('decrypted cache differs from original text');
        setTranslatedText(decrypted);
        setPhase('ready');
      } else {
        debugLog('decrypted cache matches original text → suppress');
        setTranslatedText(null);
        setPhase('ready');
      }
      return;
    }
  } catch (cacheError) {
    const throttled =
      cacheError instanceof Error &&
      cacheError.message.includes('ThrottlerException');
    if (!throttled) {
      console.warn(
        '[TranslationDisplay] Cache lookup failed:',
        cacheError,
      );
    } else {
      debugLog('cache lookup throttled; continuing without cache');
      cacheDisabledRef.current = true;
    }
  }
} else if (cacheDisabledRef.current) {
  debugLog('cache lookup skipped (disabled)');
}
```

**Keep:**
- REST API call (line ~321) - backend checks cache internally
- GraphQL cache mutation (line ~445) - frontend encrypts & saves
- All error handling and state management

**Result:** Execution flow goes directly from initial checks to REST API call

### 2. Clean Up Unused Imports

**File:** `src/components/chat/translation-display.tsx`

**Remove imports:**
```typescript
MessageTranslationLookupDocument,
MessageTranslationLookupQuery,
MessageTranslationLookupQueryVariables,
```

**Keep imports:**
```typescript
CacheMessageTranslationRecordDocument,
CacheMessageTranslationRecordMutation,
CacheMessageTranslationRecordMutationVariables,
```

### 3. Remove Unused State/Refs

**File:** `src/components/chat/translation-display.tsx`

**Remove:**
- `cacheDisabledRef` (line ~109) - no longer needed
- Related cache throttling logic

### 4. Simplify Error Messages

**File:** `src/components/chat/translation-display.tsx`

**Remove cache-specific error constants** (if not used elsewhere):
- Any error messages specific to cache failures

**Keep:**
- `RATE_LIMIT_MESSAGE`
- `AUTH_REQUIRED_MESSAGE`
- `KEY_MISSING_MESSAGE` (still needed for GraphQL mutation failures)

---

## Testing Requirements

### Unit Tests

**File:** `tests/unit/components/chat/translation-display.test.tsx`

**Update existing tests:**
- ✅ Remove tests for GraphQL cache query
- ✅ Verify REST API called directly (no cache pre-check)
- ✅ Verify translation displayed when backend returns `cached: true`
- ✅ Verify translation displayed when backend returns `cached: false`
- ✅ Verify GraphQL mutation called to save encrypted translation
- ✅ Verify rate limit (429) error displays properly
- ✅ Verify network errors handled gracefully
- ✅ Verify component cleanup on unmount

**New test cases:**
```typescript
describe('TranslationDisplay - Simplified Cache Flow', () => {
  it('should call REST API directly without GraphQL cache query', async () => {
    // Mock REST API to return cached translation
    // Verify GraphQL cache query NOT called
    // Verify translation displayed
  });

  it('should encrypt and save translation via GraphQL mutation', async () => {
    // Mock REST API to return uncached translation
    // Verify translation encrypted with family key
    // Verify GraphQL mutation called with encrypted data
  });

  it('should handle rate limit error (429) before component unmount', async () => {
    // Mock REST API to return 429
    // Verify error message displayed
    // Verify component doesn't get stuck on "Translating..."
  });
});
```

### Integration Tests

**File:** `apps/backend/test/translation.e2e-spec.ts`

**Verify backend behavior:**
- ✅ POST /api/translate returns cached translation when available
- ✅ POST /api/translate calls Groq when cache miss
- ✅ Rate limiting returns 429 after threshold (10/min)
- ✅ Authentication required (401 without JWT)
- ✅ Message access validation (403 for unauthorized messages)

### End-to-End Tests

**File:** `tests/integration/chat/translation-flow.spec.ts` (new)

**Full user flow scenarios:**
```typescript
describe('Real-time Message Translation', () => {
  it('should translate new message from User A to User B', async () => {
    // User A sends Japanese message "こんにちは"
    // User B (preferredLanguage: en) receives message
    // Verify "Hello" translation appears within 3 seconds
    // Verify no console errors
  });

  it('should use cached translation on page refresh', async () => {
    // Load chat with previously translated messages
    // Verify translations load instantly (< 500ms)
    // Verify backend returns cached: true
  });

  it('should display rate limit error gracefully', async () => {
    // Send 15 messages rapidly
    // Verify first 10 translate successfully
    // Verify messages 11-15 show rate limit error
    // Verify error message is user-friendly
  });

  it('should work for multiple languages', async () => {
    // Test translation for: ja, es, fr, de, zh
    // Verify all translate correctly
  });
});
```

---

## Success Criteria

### Functional Requirements
- ✅ New messages from WebSocket translate successfully
- ✅ No "Bad Request Exception" errors in console
- ✅ No component unmount during translation request
- ✅ Rate limit errors (429) display properly to user
- ✅ Historical messages still use backend cache efficiently
- ✅ Translation latency < 3 seconds for uncached messages
- ✅ Cached translations load < 500ms

### Code Quality
- ✅ Simpler code (removed ~60 lines of redundant logic)
- ✅ Fewer GraphQL operations (removed 1 query, kept 1 mutation)
- ✅ All tests pass (unit + integration + E2E)
- ✅ No new lint errors
- ✅ No new TypeScript errors

### Privacy & Security
- ✅ E2EE maintained for database storage
- ✅ Family keys remain client-side only
- ✅ Backend never stores plaintext translations
- ✅ Database breach exposes only ciphertext

---

## Files Modified

1. `src/components/chat/translation-display.tsx` - Remove GraphQL cache query
2. `tests/unit/components/chat/translation-display.test.tsx` - Update unit tests
3. `tests/integration/chat/translation-flow.spec.ts` - New E2E tests (create)

## Files Unchanged (No Backend Changes)
- `apps/backend/src/translation/*` - Backend logic unchanged
- `apps/backend/src/schema.gql` - GraphQL schema unchanged
- Backend still checks cache and saves encrypted translations

---

## Rollout Plan

### Phase 1: Implementation
1. Remove GraphQL cache query from TranslationDisplay
2. Clean up imports and unused code
3. Update unit tests

### Phase 2: Testing
1. Run unit tests locally
2. Run integration tests locally
3. Create and run E2E tests

### Phase 3: Verification
1. Test in development environment
2. Verify no console errors
3. Verify translations work for new messages
4. Verify rate limit handling
5. Load test with multiple users

### Phase 4: Deployment
1. Create PR with changes
2. Code review
3. Merge to main
4. Deploy to production
5. Monitor error logs for 24 hours

---

## Rollback Plan

If issues occur after deployment:
1. Revert commit containing changes
2. Redeploy previous version
3. Investigate root cause
4. Fix and redeploy

Previous behavior will be restored (with the original bugs, but functional).

---

## Notes

- This fix addresses the immediate issue (translation not appearing)
- Future optimization: Consider WebSocket-based translation updates
- Future enhancement: Add translation language auto-detection
- Future consideration: Offline translation using local models
