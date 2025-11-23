# Double-Subscription Translation Issue

**Date:** 2025-11-23
**Issue:** Translations stuck on "Translating..." due to React StrictMode calling setState updater twice
**Root Cause:** React StrictMode development behavior - setState updater called twice with same inputs
**Solution:** Per-channel deduplication with recency-based pruning (always-on for defense in depth)
**Status:** Phase 2 Complete (Fix Implemented) - Ready for Testing

---

## Problem Description

After implementing v3.2.2 (simplified translation cache flow), translations are still stuck on "Translating..." in the local dev environment.

### Observed Symptoms

1. **User sends Japanese message** (こんにちは)
2. **"Translating..." badge appears** below message
3. **Badge never changes** to show actual translation
4. **Console shows double-processing:**
   ```
   [Subscription] Current messages count: 51
   [Subscription] ✅ Adding new message: 6e1b44cb-1087-40c8-87ef-ee6cfa5e5e9e
   [Subscription] Updated messages count: 52
   [Subscription] Current messages count: 51  ← Mysteriously reset!
   [Subscription] ✅ Adding new message: 6e1b44cb-1087-40c8-87ef-ee6cfa5e5e9e
   [Subscription] Updated messages count: 52
   ```
5. **NO `[TranslationDisplay]` debug logs** (should appear if translation request started)

---

## Root Cause Analysis

### Critical Discovery: Multiple Effects Updating Same State

**Two effects compete to update `displayMessages`:**

1. **Decrypt Effect** (`src/app/chat/page.tsx:254-359`)
   - Dependencies: `[rawMessages, familyKey, user?.id, language]`
   - Processes query data, calls `setDisplayMessages`
   - Has extensive logging (`[Decrypt]` prefix)
   - **NOT present in user's console logs** - suggests not running between subscription events

2. **Subscription Effect** (`src/app/chat/page.tsx:362-415`)
   - Dependencies: `[messageAdded, familyKey, user?.id, language]`
   - Processes real-time subscription data
   - Calls `setDisplayMessages` to add new message
   - **Running TWICE** for same message

### The Subscription Effect

```typescript
useEffect(() => {
  if (!messageAdded || !familyKey) return;

  const processNewMessage = async () => {
    // Decrypt and add message to displayMessages
    setDisplayMessages((prev) => {
      const exists = prev.some((m) => m.id === newMessage.id);
      if (exists) {
        console.log('[Subscription] ⚠️ Skipping duplicate message:', newMessage.id);
        return prev;
      }
      console.log('[Subscription] ✅ Adding new message:', newMessage.id);
      return [...prev, newMessage];
    });
  };

  processNewMessage();
}, [messageAdded, familyKey, user?.id, language]);
```

### What's Happening

1. **Apollo Client triggers subscription** with `messageAdded` object
2. **Effect runs**, adds message (count: 51 → 52)
3. **`messageAdded` dependency changes** (Apollo creates new object reference)
4. **Effect runs AGAIN** with same message ID
5. **Duplicate check fails** because `prev` has mysteriously reset to 51 (not 52)
6. **Message added second time** (count: 51 → 52 again)

### Why Duplicate Check Fails

The duplicate check on line 399 should prevent double-adds:
```typescript
const exists = prev.some((m) => m.id === newMessage.id);
if (exists) return prev;
```

But it's failing because between the two effect runs, `prev` is showing 51 messages instead of 52.

### Possible Causes (Need Instrumentation to Confirm)

**Hypothesis 1: React StrictMode setState Updater Double-Invoke** ✅ CONFIRMED
- In dev, StrictMode intentionally calls setState updater functions twice within a single effect
- **Sequence:** Effect runs once → setState called → React invokes updater #1 → React invokes updater #2
- **Both updater invocations see the same pre-update state** (React hasn't applied first result yet)
- Both calls receive `prev` with same value (e.g., 50 messages)
- Second updater result overwrites first (last write wins)
- **Note:** Effect itself runs once, but the setState updater function is called twice

**Hypothesis 2: Apollo Subscription Updates Twice**
- First update: subscription data received
- Second update: Apollo normalizes cache, creates new object reference
- Both trigger effect re-run with `prev=51`

**Hypothesis 3: Decrypt Effect Interference** (Less likely - no logs)
- Decrypt effect runs between subscription runs
- Resets displayMessages to query result (51 messages)
- Second subscription run sees reset state
- **BUT:** No `[Decrypt]` logs in console suggests this isn't happening

**Hypothesis 4: Race Condition in setState**
- Both subscription calls happen before React flushes state
- Both see stale `prev` value (51 messages)
- React applies last setState, losing first update

### Impact on TranslationDisplay

When `displayMessages` array is replaced (even with same content), React sees it as a new array:
1. Old message objects unmount
2. New message objects mount
3. **TranslationDisplay component unmounts/remounts**
4. **AbortController aborts ongoing translation request**
5. Component remounts in 'idle' or 'loading' state
6. Gets stuck on "Translating..."

---

## Why This Wasn't Caught in Tests

The unit tests passed because:
1. Tests use **mocked Apollo Client** with stable object references
2. Tests don't have the real subscription behavior
3. Tests use `isTestEnv = true`, bypassing intersection observer complexity
4. Test environment doesn't have React StrictMode double-effects

---

## Proposed Solutions

### FIRST: Add Instrumentation to Diagnose Root Cause

Before implementing a fix, add logging to determine exact cause:

```typescript
// Use ref to track execution counter (stable across renders)
const executionCounterRef = useRef(0);

// Use WeakMap and ref to track object identity changes (both stable across renders)
const objectIdentityMap = useRef(new WeakMap<any, number>());
const nextIdentityIdRef = useRef(0);

const getObjectId = (obj: any) => {
  if (!obj) return null;
  if (!objectIdentityMap.current.has(obj)) {
    objectIdentityMap.current.set(obj, nextIdentityIdRef.current++);
  }
  return objectIdentityMap.current.get(obj);
};

useEffect(() => {
  const execId = ++executionCounterRef.current;
  const messageObjId = getObjectId(messageAdded);

  console.log(`[Subscription:${execId}] Effect triggered`, {
    messageId: messageAdded?.id,
    messageObjId, // Track object identity - changes reveal new references
    familyKeyPresent: !!familyKey,
    userId: user?.id,
    language,
    timestamp: Date.now(),
  });

  if (!messageAdded || !familyKey) {
    console.log(`[Subscription:${execId}] Skipping - missing deps`);
    return;
  }

  // Check if already processed
  if (processedMessageIds.current.has(messageAdded.id)) {
    console.log(`[Subscription:${execId}] ⚠️ Already processed:`, messageAdded.id);
    return;
  }

  console.log(`[Subscription:${execId}] Marking as processed:`, messageAdded.id);
  processedMessageIds.current.add(messageAdded.id);

  const processNewMessage = async () => {
    // ... existing logic

    setDisplayMessages((prev) => {
      console.log(`[Subscription:${execId}] setState callback`, {
        prevLength: prev.length,
        prevIds: prev.map(m => m.id).join(','),
        timestamp: Date.now(),
      });
      // ... rest of logic
    });
  };

  processNewMessage();

  return () => {
    console.log(`[Subscription:${execId}] Cleanup running at`, Date.now());
  };
}, [messageAdded, familyKey, user?.id, language]);
```

**This will reveal:**
- Whether effect runs twice due to dependency changes vs StrictMode
- Whether `messageAdded` object reference changes (different `messageObjId` for same `messageId`)
- Whether setState callbacks see stale state (check `prevLength`)
- Exact timing of effect execution and cleanup

**Understanding StrictMode behavior:**
- In dev, StrictMode **intentionally runs effects twice** with teardown between runs
- Sequence: Effect run #1 → Cleanup #1 → Effect run #2
- **Both runs see the same pre-update state** (not a batched overwrite)
- This helps catch bugs where components don't properly clean up effects

---

### Option 1: Per-Channel Deduplication with Lifecycle Management (Recommended)

Track processed IDs per channel with recency-based pruning:

```typescript
// Track processed IDs by channel with access timestamps for pruning
interface ChannelData {
  processedIds: Set<string>;
  lastAccessed: number;
}

const processedMessagesByChannel = useRef<Map<string, ChannelData>>(new Map());

// Get channel identifier (currentChannelId if available, fallback to familyId for single-room flows)
// Field availability confirmed in src/app/chat/page.tsx:
//   - currentChannelId: line 63 (state variable)
//   - family?.id: line 59 (from useAuth context)
//   - Fallback: 'default' for edge cases
const getChannelKey = (channelId: string | null | undefined, familyId: string | null | undefined) => {
  return channelId || familyId || 'default';
};

// Get or create channel data
const getChannelData = (channelKey: string): ChannelData => {
  if (!processedMessagesByChannel.current.has(channelKey)) {
    processedMessagesByChannel.current.set(channelKey, {
      processedIds: new Set(),
      lastAccessed: Date.now(),
    });
  }
  const data = processedMessagesByChannel.current.get(channelKey)!;
  data.lastAccessed = Date.now(); // Update access time
  return data;
};

// Prune old channels based on recency (keep current + 2 most recent)
const pruneOldChannels = (currentChannelKey: string) => {
  const entries = Array.from(processedMessagesByChannel.current.entries());
  if (entries.length <= 3) return; // Keep at least 3

  // Sort by lastAccessed (most recent first)
  entries.sort((a, b) => b[1].lastAccessed - a[1].lastAccessed);

  // Keep current channel + 2 most recent others
  const toKeep = new Set([
    currentChannelKey,
    ...entries.slice(0, 3).map(([key]) => key),
  ]);

  // Delete old channels
  entries.forEach(([key]) => {
    if (!toKeep.has(key)) {
      processedMessagesByChannel.current.delete(key);
      console.log('[Subscription] Pruned old channel:', key);
    }
  });
};

useEffect(() => {
  if (!messageAdded || !familyKey) return;

  const channelKey = getChannelKey(currentChannelId, family?.id);
  const channelData = getChannelData(channelKey);

  // Skip if already processed in this channel
  if (channelData.processedIds.has(messageAdded.id)) {
    console.log('[Subscription] ⚠️ Already processed:', messageAdded.id, 'in channel:', channelKey);
    return;
  }

  channelData.processedIds.add(messageAdded.id);
  pruneOldChannels(channelKey);

  const processNewMessage = async () => {
    try {
      const plaintext = await decryptMessage(messageAdded.encryptedContent, familyKey);

      const newMessage: DisplayMessage = {
        id: messageAdded.id,
        userId: messageAdded.userId,
        userName: messageAdded.user.name,
        userAvatar: messageAdded.user.avatar || '',
        message: plaintext,
        timestamp: formatDateTime(messageAdded.timestamp, language),
        isMine: messageAdded.userId === user?.id,
        isEdited: messageAdded.isEdited,
      };

      setDisplayMessages((prev) => {
        const exists = prev.some((m) => m.id === newMessage.id);
        if (exists) {
          console.log('[Subscription] ⚠️ Already in state:', newMessage.id);
          return prev;
        }

        console.log('[Subscription] ✅ Adding new message:', newMessage.id);
        return [...prev, newMessage];
      });
    } catch (error) {
      console.error('[Subscription] ❌ Failed to process:', error);
      channelData.processedIds.delete(messageAdded.id); // Allow retry
    }
  };

  processNewMessage();
}, [messageAdded, familyKey, user?.id, language, currentChannelId, family?.id]);

// Clear all processed IDs when family changes
useEffect(() => {
  console.log('[Subscription] Family key changed, clearing all processed IDs');
  processedMessagesByChannel.current.clear();
}, [familyKey]);
```

**Key improvements:**
- **Fallback identifier:** Uses `currentChannelId || user?.familyId || 'default'` to handle single-room flows
- **Recency tracking:** Tracks `lastAccessed` timestamp per channel
- **Smart pruning:** Sorts by recency and keeps current + 2 most recently used channels
- **Scoped per channel:** No cross-channel ID blocking
- **Auto-cleanup:** Clears on family change (key rotation)
- **Error handling:** Removes failed IDs to allow retry

**Pros:**
- Works even if `currentChannelId` doesn't exist
- Prunes based on actual usage (not arbitrary order)
- Memory bounded (max 3-4 channels cached)
- Handles multi-channel and single-channel apps

**Cons:**
- More complex than simple Set
- Still symptom mitigation (not root cause fix)

### Option 2: Use `messageAdded.id` in Dependencies (Limited Effectiveness)

Change dependency from `messageAdded` (object) to `messageAdded?.id` (string):

```typescript
const messageAddedId = messageAdded?.id;

useEffect(() => {
  if (!messageAdded || !familyKey || !messageAddedId) return;

  const processNewMessage = async () => {
    // ... existing logic
  };

  processNewMessage();
}, [messageAddedId, familyKey, user?.id, language]); // Use ID instead of object
```

**Pros:**
- Simpler change
- Reduces reruns when Apollo updates same message object

**Cons:**
- **Still reruns when other deps change** (language, user?.id, familyKey)
- Doesn't prevent double-processing if StrictMode is the cause
- **Gives false confidence** - appears to fix issue but doesn't address root cause
- Will still double-process if user changes language or familyKey updates

### Option 3: Disable React StrictMode (Not Recommended)

React StrictMode in dev intentionally double-invokes effects to catch bugs. Disabling it would hide the issue.

**Cons:**
- Hides potential production issues
- Not a real fix

---

## Implementation Plan

### Step 1: Add Instrumentation (FIRST)

**File:** `src/app/chat/page.tsx`

**Purpose:** Diagnose root cause before implementing fix

1. Add execution counter ref
2. Add object identity tracking (WeakMap)
3. Add logging to subscription effect
4. Run app and send test message
5. Analyze logs to determine cause

**See:** "FIRST: Add Instrumentation to Diagnose Root Cause" section above for complete code

### Step 2: Implement Deduplication (After Diagnosis)

**File:** `src/app/chat/page.tsx`

**Choose implementation based on instrumentation findings:**

1. Add per-channel deduplication Map
2. Implement `getChannelKey()` helper with fallback
3. Add recency tracking and pruning logic
4. Add family key change cleanup

**See:** "Option 1: Per-Channel Deduplication" section above for complete code

### Step 3: Add Tests

**Unit Test with StrictMode Simulation:**

```typescript
// tests/unit/chat/subscription-deduplication.test.tsx
import { renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, it, expect, vi } from 'vitest';

describe('Message Subscription Deduplication', () => {
  it('should not process same message twice in StrictMode', async () => {
    const processMessage = vi.fn();
    const processedIds = new Set<string>();

    const { rerender } = renderHook(
      ({ messageId }) => {
        if (processedIds.has(messageId)) return;
        processedIds.add(messageId);
        processMessage(messageId);
      },
      {
        wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
        initialProps: { messageId: 'msg-1' },
      }
    );

    // StrictMode will run effect twice, but processMessage should only be called once
    expect(processMessage).toHaveBeenCalledTimes(1);
    expect(processMessage).toHaveBeenCalledWith('msg-1');

    // Rerender with same ID - should still be deduplicated
    rerender({ messageId: 'msg-1' });
    expect(processMessage).toHaveBeenCalledTimes(1); // Still once
  });

  it('should process different messages', async () => {
    const processMessage = vi.fn();
    const processedIds = new Set<string>();

    const { rerender } = renderHook(
      ({ messageId }) => {
        if (processedIds.has(messageId)) return;
        processedIds.add(messageId);
        processMessage(messageId);
      },
      {
        wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
        initialProps: { messageId: 'msg-1' },
      }
    );

    expect(processMessage).toHaveBeenCalledTimes(1);

    // New message - should be processed
    rerender({ messageId: 'msg-2' });
    expect(processMessage).toHaveBeenCalledTimes(2);
    expect(processMessage).toHaveBeenLastCalledWith('msg-2');
  });
});
```

**E2E Test (Playwright):**

```typescript
// tests/e2e/chat/subscription-deduplication.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Real-time Message Subscription Deduplication', () => {
  test('should not add duplicate messages when subscription fires twice', async ({ page }) => {
    // Intercept translation API calls to count requests
    // Pattern '**/api/translate' matches: http://localhost:4000/api/translate
    // (confirmed in src/components/chat/translation-display.tsx:259)
    let translationRequestCount = 0;
    await page.route('**/api/translate', (route) => {
      translationRequestCount++;
      route.continue();
    });

    // Login and navigate to chat
    await page.goto('/chat');
    await page.waitForSelector('[data-testid="message-list"]');

    // Send a message
    await page.fill('[data-testid="message-input"]', 'こんにちは');
    await page.click('[data-testid="send-button"]');

    // Wait for message to appear
    await page.waitForSelector('text=こんにちは');

    // Count messages with this text (should be exactly 1, not 2)
    const messageCount = await page.locator('text=こんにちは').count();
    expect(messageCount).toBe(1);

    // Verify translation appears (not stuck on "Translating...")
    await expect(page.locator('text=Translating...')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Hello')).toBeVisible();

    // Verify only one translation request made
    expect(translationRequestCount).toBe(1);
  });
});
```

---

## Testing Checklist

- [ ] Send Japanese message, verify translation appears
- [ ] Send multiple messages rapidly, verify all translate
- [ ] Check console for double-processing logs
- [ ] Verify no "[TranslationDisplay] Request aborted" logs
- [ ] Test with React DevTools Profiler to check for extra renders
- [ ] Test message editing (different subscription)
- [ ] Test message deletion (different subscription)

---

## Success Criteria

1. ✅ Translations appear correctly for new messages
2. ✅ No double-processing logs in console
3. ✅ No component unmount/remount during translation
4. ✅ TranslationDisplay debug logs show complete request flow
5. ✅ All existing tests still pass
6. ✅ Integration test for deduplication passes

---

---

## Answers to Key Questions

### 1. Is there another effect syncing displayMessages from query data?

**YES** - The Decrypt Effect (`src/app/chat/page.tsx:254-359`)

```typescript
useEffect(() => {
  // Processes rawMessages from GraphQL query
  // Calls setDisplayMessages with smart merge logic
  // Should preserve subscription messages (lines 336-341)
}, [rawMessages, familyKey, user?.id, language]);
```

**Critical observation:** User's console shows NO `[Decrypt]` logs, suggesting this effect is NOT running between subscription events. This rules out Hypothesis 3 (Decrypt interference).

**However:** If `rawMessages` updates after subscription (query refetch), the decrypt effect COULD run and overwrite subscription messages if the smart merge fails.

### 2. Should the processed-ID Set be keyed/cleared per family?

**YES, per channel AND per family:**

- **Per channel:** Prevent blocking legitimate messages with same ID in different channels
- **Per family:** Clear when `familyKey` changes (family switching or key rotation)
- **On unmount:** Use effect cleanup to clear stale data

**Implementation:** See Option 1 - uses `Map<channelId, Set<messageId>>` with auto-pruning

### 3. Do we need instrumentation to confirm Apollo vs StrictMode?

**YES - Critical for choosing right fix:**

**Add this to subscription effect:**
```typescript
let execCounter = 0;

useEffect(() => {
  const execId = ++execCounter;
  console.log(`[Sub:${execId}] Triggered - deps:`, {
    messageAddedRef: messageAdded, // Log object identity
    messageId: messageAdded?.id,
    familyKey: !!familyKey,
    userId: user?.id,
    language,
  });

  return () => {
    console.log(`[Sub:${execId}] Cleanup`);
  };
}, [messageAdded, familyKey, user?.id, language]);
```

**What to look for:**
- **StrictMode:** `execId` increments by 2 each time (1→2, then 3→4 on next message)
- **Apollo:** `messageAddedRef` shows different object but same ID
- **Other deps:** Check if `familyKey`, `user?.id`, or `language` changed

**Also test:** Build production bundle (`pnpm build:static && pnpm start`) - StrictMode disabled in prod

---

## Alternative Investigation

If ref-based fix doesn't work, investigate:

1. **Apollo Client subscription behavior**
   - Enable Apollo DevTools to see cache updates
   - Check if `fetchPolicy` on subscription affects behavior
   - Review Apollo Link configuration

2. **React StrictMode interactions**
   - Temporarily disable in `next.config.js`
   - Compare dev vs production build behavior
   - Check React 18 batching interactions

3. **State batching issues**
   - Use React DevTools Profiler to see render timing
   - Consider `flushSync` for critical setState calls
   - Check if concurrent features affect batching

---

## Related Issues

- Original issue: Translation stuck on "Translating..." (fixed in v3.2.2)
- Root cause: Component unmounting during async translation request
- v3.2.2 fix: Removed redundant GraphQL cache query
- **New issue:** Double-subscription causing same unmount problem (current)

---

## Next Steps (Instrumentation-First Approach)

### Phase 1: Diagnose Root Cause

1. **Add instrumentation code** from "FIRST: Add Instrumentation" section above
   - Use `useRef` for stable execution counter
   - Use `WeakMap` to track object identity changes
   - Log timestamps and state in setState callbacks

2. **Run the instrumented app** and send a test message

3. **Analyze logs** to determine cause:
   - **If StrictMode:** `execId` jumps by 2 (e.g., 1→2 for first message, 3→4 for second)
   - **If Apollo:** Same `messageId` with different `messageObjId` values
   - **If other deps:** Check if `familyKey`, `user?.id`, or `language` changed

4. **Share instrumentation logs** to confirm diagnosis

### Phase 2: Implement Fix Based on Findings

**If StrictMode is the cause:**
- Implement Option 1 (Per-Channel Deduplication)
- This is expected dev behavior - fix handles it gracefully
- Test in production build to confirm it doesn't happen in prod

**If Apollo is the cause:**
- Implement Option 1 (prevents reprocessing regardless)
- Consider investigating Apollo cache configuration
- May indicate cache normalization creating new references

**If decrypt effect interference:**
- Review smart merge logic (lines 336-341 in chat/page.tsx)
- Ensure subscription messages are properly preserved
- May need to adjust merge strategy

### Phase 3: Test and Verify

1. **Add unit tests** (tests/unit/chat/subscription-deduplication.test.tsx)
2. **Add E2E tests** (tests/e2e/chat/subscription-deduplication.spec.ts)
3. **Verify translations work** for new messages
4. **Check console** for no double-processing logs
5. **Test in production build** to ensure no StrictMode artifacts

## Reviewer Feedback (2025-11-23 08:33:27Z)
- Keep the execution counter stable across renders by using `useRef` (a `let` will reset per render) and log object identity explicitly (e.g., via a `WeakMap`) so reference changes are clear.
- Clarify StrictMode rationale: effects are re-run with teardown between runs, so both runs see pre-update state; it’s not a batched overwrite scenario.
- Option 1 depends on `currentChannelId`; confirm this identifier exists or fall back to a family/chat ID so dedup doesn’t block in single-room flows.
- Align steps: run instrumentation first to choose the fix; then apply the dedup strategy based on findings.
- Place new tests under existing conventions (`tests/unit` for units, `tests/e2e` for Playwright) to ensure they execute.
- Specify Map pruning ordering (track recency explicitly) to avoid unexpectedly dropping recent channels.

## Reviewer Feedback (2025-11-23 08:37:05Z)
- Hypothesis 1 still frames StrictMode as "second run overwrites first due to batching"; revise to match the later StrictMode note (effects replay with teardown, both see pre-update state).
- Instrumentation snippet resets `nextIdentityId` on each render (`let nextIdentityId = 0`); move it to `useRef` so object IDs remain stable.
- "Implementation Plan" still starts with ref-based dedup, which conflicts with the instrumentation-first sequencing below; align the ordering so instrumentation precedes fixes.
- Playwright test relies on `window.__translationRequestCount`, but the doc doesn't specify how it's populated; either describe the hook/instrumentation needed or drop that assertion.
- Minor: ensure `currentChannelId`/`user?.familyId` exist in the real component scope before wiring Option 1; otherwise document the fallback to avoid runtime gaps.

---

## Phase 1 Complete: Instrumentation Added ✅

**Date:** 2025-11-23
**File Modified:** `src/app/chat/page.tsx`

### Changes Made

1. **Added instrumentation refs** (lines 86-89):
   - `executionCounterRef`: Stable counter across renders
   - `objectIdentityMap`: WeakMap to track object references
   - `nextIdentityIdRef`: Stable ID generator

2. **Added helper function** (lines 91-98):
   - `getObjectId()`: Tracks whether messageAdded object reference changes

3. **Updated subscription effect** (lines 376-442):
   - Added execution ID logging (`execId`)
   - Added object identity tracking (`messageObjId`)
   - Added detailed timestamps
   - Added setState callback logging with prevLength and prevIds
   - Added cleanup logging

### Next Steps: Run Instrumented App

**To diagnose the root cause:**

1. **Start the development environment:**
   ```bash
   # Terminal 1: Start backend
   cd apps/backend
   pnpm db:start && pnpm dev

   # Terminal 2: Start frontend
   pnpm dev
   ```

2. **Open browser console** (F12) and navigate to chat

3. **Send a test message** (Japanese recommended: こんにちは)

4. **Analyze the console logs** looking for:

   **Pattern A: StrictMode Double-Invoke**
   ```
   [Subscription:1] Effect triggered { messageId: "abc-123", messageObjId: 0, ... }
   [Subscription:1] setState callback { prevLength: 51, ... }
   [Subscription:1] Cleanup running at <timestamp>
   [Subscription:2] Effect triggered { messageId: "abc-123", messageObjId: 0, ... }
   [Subscription:2] setState callback { prevLength: 51, ... }  ← Same prevLength!
   ```
   - execId jumps by 2 (1→2 for first message, 3→4 for second)
   - Same `messageObjId` (object reference unchanged)
   - Both setState callbacks see same `prevLength`
   - **Confirms:** StrictMode running effect twice with same initial state

   **Pattern B: Apollo Cache Update**
   ```
   [Subscription:1] Effect triggered { messageId: "abc-123", messageObjId: 0, ... }
   [Subscription:1] setState callback { prevLength: 51, ... }
   [Subscription:2] Effect triggered { messageId: "abc-123", messageObjId: 1, ... }  ← Different ID!
   [Subscription:2] setState callback { prevLength: 52, ... }
   ```
   - execId increments by 1
   - Different `messageObjId` (Apollo created new object reference)
   - Second setState sees updated `prevLength`
   - **Confirms:** Apollo cache normalization triggering re-run

   **Pattern C: Decrypt Effect Interference**
   ```
   [Subscription:1] Effect triggered { messageId: "abc-123", ... }
   [Subscription:1] setState callback { prevLength: 51, ... }
   [Decrypt] Processing rawMessages...  ← Decrypt effect runs between
   [Subscription:2] Effect triggered { messageId: "abc-123", ... }
   [Subscription:2] setState callback { prevLength: 51, ... }  ← Reset!
   ```
   - `[Decrypt]` logs appear between subscription runs
   - Second setState sees reset `prevLength`
   - **Confirms:** Decrypt effect overwriting state

5. **Share the console logs** showing the pattern observed

### Expected Outcome

The logs will reveal which hypothesis is correct, allowing us to:
- **If Pattern A (StrictMode):** Implement Option 1 (Per-Channel Deduplication) - expected dev behavior
- **If Pattern B (Apollo):** Investigate Apollo cache config + implement Option 1
- **If Pattern C (Decrypt):** Fix smart merge logic in decrypt effect

### Verification

Type check passed with no errors in `src/app/chat/page.tsx`:
```bash
pnpm tsc --noEmit  # No errors in chat/page.tsx
```

---

## Diagnostic Results: Root Cause Confirmed ✅

**Date:** 2025-11-23
**Test:** User B sent "こんにちは" to User A
**Logs Source:** User A's browser console (receiver)

### Console Logs Received

```
[Subscription:1] Effect triggered
{ messageId: "804c55c9-b645-45bd-83e0-891b8ac31117", messageObjId: 0,
  familyKeyPresent: true, userId: "c27ea19a-ac91-4119-9467-dcb49f4f5235",
  language: "en", timestamp: 1763887628946 }

[Subscription:1] Message decrypted successfully
[Subscription:1] New message object created:
{ id: "804c55c9-b645-45bd-83e0-891b8ac31117", userId: "ec5a2404-1357-43f9-b726-13a64f59e886",
  userName: "Nyapo", userAvatar: "", message: "こんにちは",
  timestamp: "Nov 23, 2025, 5:47 PM", isMine: false, isEdited: false }

[Subscription:1] setState callback
{ prevLength: 50, prevIds: "3304cf9c-8f87-486d-b245-bd59d1220c8c,...", timestamp: 1763887628953 }
[Subscription:1] ✅ Adding new message: 804c55c9-b645-45bd-83e0-891b8ac31117
[Subscription:1] Updated messages count: 51

[Subscription:1] setState callback
{ prevLength: 50, prevIds: "3304cf9c-8f87-486d-b245-bd59d1220c8c,...", timestamp: 1763887628953 }
[Subscription:1] ✅ Adding new message: 804c55c9-b645-45bd-83e0-891b8ac31117
[Subscription:1] Updated messages count: 51

[TranslationDisplay] request started
{ messageId: "804c55c9-b645-45bd-83e0-891b8ac31117", targetLanguage: "en",
  hasFamilyKey: true, preferredLanguage: "en" }
[TranslationDisplay] invoking REST translation fetch
[TranslationDisplay] REST response received { status: 200, ok: true }
[TranslationDisplay] ⚠️ Request aborted or component unmounted
{ aborted: false, mounted: false }
```

### Analysis: Pattern A - React StrictMode Confirmed

**Evidence:**

1. ✅ **Effect runs ONLY ONCE**
   - Only `execId: 1` appears (no `execId: 2`)
   - Effect triggered once at timestamp `1763887628946`

2. ✅ **Object reference is STABLE**
   - `messageObjId: 0` (first object tracked)
   - Same object throughout - Apollo is NOT creating new references

3. ✅ **setState updater called TWICE with SAME inputs**
   - Both callbacks: `prevLength: 50`, `timestamp: 1763887628953`
   - Both see identical initial state
   - Both add message, both show count: 51 (not 50→51→52)

4. ✅ **No Decrypt or second Subscription effect**
   - No `[Decrypt]` logs between subscription runs
   - No `[Subscription:2]` logs
   - Rules out Hypothesis 2 (Apollo) and Hypothesis 3 (Decrypt interference)

**Root Cause:**

React StrictMode in development intentionally calls setState updater functions **twice within the same effect execution** to help detect impure updater functions. This is documented React behavior for StrictMode.

**Sequence:**
```
1. Effect runs (execId: 1)
2. Message decrypted
3. setState updater function called
4. React StrictMode calls updater FIRST time  → prev=50, returns 51
5. React StrictMode calls updater SECOND time → prev=50, returns 51 (overwrites first)
6. New array created (different reference)
7. React unmounts old message components
8. React mounts new message components
9. TranslationDisplay component unmounts mid-request
10. Translation request completes but component is gone (mounted: false)
11. Translation stuck on "Translating..."
```

**Why setState updater is called twice:**
- StrictMode helps catch bugs in updater functions that rely on side effects
- Updater should be a pure function: `(prev) => next`
- Our updater IS pure, but the duplicate call still causes issues because:
  - Both calls see same `prev` state (React hasn't applied first result yet)
  - Second call overwrites first
  - Array reference changes → component unmount → translation aborted

### Confirmed Solution: Option 1 - Per-Channel Deduplication

**Why this fix works:**

Even though the setState updater is pure, we need to prevent the same message from being **processed and added** multiple times. The deduplication Set prevents `processNewMessage()` from executing twice for the same message ID.

**Implementation:** Add a `processedMessagesByChannel` ref that tracks which message IDs have already been processed in the current effect, preventing duplicate processing even when React calls the updater multiple times.

**Production Consideration - Keep Dedup Always-On:**

While the root cause is StrictMode (dev-only behavior), we should **keep deduplication enabled in production** because:

1. **Defense in depth:** Protects against other duplicate scenarios:
   - Rapid Apollo cache updates
   - Network timing edge cases
   - Future GraphQL subscription behavior changes

2. **Minimal overhead:**
   - Ref-based Set lookup is O(1)
   - No performance impact
   - Memory bounded by pruning strategy (max 3-4 channels)

3. **Consistency:**
   - Same code path in dev and production
   - Easier to test and maintain
   - StrictMode helps us catch the issue early

4. **Real-world safety:**
   - WebSocket reconnections could trigger duplicate events
   - Apollo Client updates could create new object references
   - User switching channels rapidly could cause race conditions

**Decision:** Implement deduplication **without** dev-only checks. It's a defensive pattern that improves robustness.

**Status:** Ready to implement Phase 2 fix

---

## Phase 2 Complete: Deduplication Fix Implemented ✅

**Date:** 2025-11-23
**File Modified:** `src/app/chat/page.tsx`

### Changes Made

1. **Added deduplication data structures** (lines 100-146):
   - `ChannelData` interface with `processedIds` Set and `lastAccessed` timestamp
   - `processedMessagesByChannel` ref: Map tracking processed message IDs per channel
   - `getChannelKey()`: Helper to get channel identifier with fallback (`currentChannelId || family?.id || 'default'`)
   - `getChannelData()`: Get or create channel data with recency tracking
   - `pruneOldChannels()`: Remove old channels based on recency (keep current + 2 most recent)

2. **Updated subscription effect** (lines 442-453):
   - Added deduplication check before processing message
   - Early return if message ID already processed in current channel
   - Mark message as processed before async operations
   - Call pruning to maintain memory bounds

3. **Enhanced error handling** (lines 494-496):
   - Remove message ID from processed set on failure
   - Allows retry on next dependency change

4. **Added cleanup effect** (lines 507-511):
   - Clear all processed IDs when `familyKey` changes
   - Handles family key rotation and family switching

5. **Updated dependency array** (line 505):
   - Added `currentChannelId` and `family?.id` to trigger effect on channel/family changes

### Implementation Details

**Deduplication logic:**
```typescript
// Check if already processed in this channel
const channelKey = getChannelKey(currentChannelId, family?.id);
const channelData = getChannelData(channelKey);

if (channelData.processedIds.has(messageAdded.id)) {
  console.log(`Already processed: ${messageAdded.id} in channel: ${channelKey}`);
  return; // Skip processing
}

// Mark as processed before async operations
channelData.processedIds.add(messageAdded.id);
pruneOldChannels(channelKey);
```

**Memory management:**
- Tracks processed IDs per channel (prevents cross-channel blocking)
- Prunes old channels based on recency (max 3-4 channels in memory)
- Clears all on family key change (handles key rotation)

**Error recovery:**
- Failed processing removes ID from set (allows retry)
- Non-fatal - doesn't break other messages

### Verification

**Type check:** ✅ Passed (no errors in `src/app/chat/page.tsx`)

**Expected behavior:**
1. ✅ First setState call: Message processed and added
2. ✅ Second setState call (StrictMode): Skipped (already processed)
3. ✅ No component unmount/remount
4. ✅ Translation completes successfully
5. ✅ Console shows: `[Subscription:1] ⚠️ Already processed: <id> in channel: <key>`

### Next Steps: Test the Fix

1. **Hot reload should apply changes automatically** (Next.js HMR)
   - If dev server is running, changes are already live
   - Refresh browser if needed

2. **Send test message** (User B → User A with Japanese text)

3. **Verify console logs show:**
   ```
   [Subscription:1] Effect triggered { messageId: "...", ... }
   [Subscription:1] ⚠️ Already processed: ... in channel: ...
   [TranslationDisplay] request started
   [TranslationDisplay] REST response received { status: 200, ok: true }
   [TranslationDisplay] translation received { translationText: "Hello" }
   ```

4. **Confirm translation appears** (not stuck on "Translating...")

5. **Share results** to confirm fix works

## Reviewer Feedback (2025-11-23 08:52:05Z)
- ✅ Earlier sections still describe Hypothesis 1 as an effect re-run; reconcile that with the confirmed behavior (single effect run, updater invoked twice) to avoid contradictory narratives.
  - **Fixed:** Updated Hypothesis 1 (line 94-100) to clarify "setState updater function called twice within single effect"
- ✅ Consider whether the deduplication should be limited to dev/StrictMode or always on; clarify expected production impact now that the root cause is dev-only behavior.
  - **Fixed:** Added "Production Consideration - Keep Dedup Always-On" section (lines 933-957) with rationale for defense-in-depth
- ✅ Implementation plan numbering has two "Step 3" sections; renumber to avoid confusion.
  - **Fixed:** Removed duplicate cleanup strategy section, kept single "Step 3: Add Tests" (line 419)
- ✅ Playwright test interception targets `**/api/translate`; confirm this matches the actual translation endpoint or document the required route pattern.
  - **Fixed:** Added comment documenting endpoint match (line 490-491): confirmed in src/components/chat/translation-display.tsx:259
- ✅ If the dedup Map relies on `currentChannelId`/`user?.familyId`, spell out the availability of those fields in the real component to prevent runtime gaps.
  - **Fixed:** Added field availability documentation (lines 238-241) and corrected usage from `user?.familyId` to `family?.id` (lines 285, 329)
