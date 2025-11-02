# Story 2.5: Message Translation

Status: ContextReadyDraft

## Story

As a family member,
I want to see messages translated to my preferred language,
so that I can understand messages from relatives who speak different languages.

## Acceptance Criteria

1. **AC1:** Message displays in sender's original language
2. **AC2:** If message language differs from my preferred language, translation appears below original
3. **AC3:** Translation accurate for common phrases (20+ languages supported)
4. **AC4:** No manual translation action required (automatic translation)
5. **AC5:** Translation uses my "Translate Messages To" setting from preferences (user.preferences.preferredLanguage)

## Tasks / Subtasks

- [ ] Task 1: Implement TranslationDisplay component (AC: #1, #2, #4)
  - [ ] Subtask 1.1: Create `src/components/chat/translation-display.tsx` component
  - [ ] Subtask 1.2: Wire component to useAuth hook to get user.preferences.preferredLanguage
  - [ ] Subtask 1.3: Implement auto-translation logic (only translate if source language != target language)
  - [ ] Subtask 1.4: Display translation below original message with styling (grayed out, italicized)
  - [ ] Subtask 1.5: Handle loading state ("Translating...") and error state (hide translation)

- [ ] Task 2: Implement Groq translation service (AC: #3, #4)
  - [ ] Subtask 2.1: Create `src/lib/groq/translation.ts` module
  - [ ] Subtask 2.2: Implement translateText(text: string, targetLanguage: string) function
  - [ ] Subtask 2.3: Use Groq API (Llama 3.1 70B) with auto-detect source language
  - [ ] Subtask 2.4: Map language codes (en, ja, es, fr, de, zh, ko, pt, ru, ar, it, nl, pl, tr, vi, th, id, hi, sv, no) to full names
  - [ ] Subtask 2.5: Handle API errors gracefully (return original text on failure)
  - [ ] Subtask 2.6: Cache translations client-side (avoid duplicate API calls for same message)

- [ ] Task 3: Integrate translation into MessageBubble component (AC: #1, #2, #4)
  - [ ] Subtask 3.1: Update `src/components/chat/message-bubble.tsx` to include TranslationDisplay
  - [ ] Subtask 3.2: Pass decrypted message content to TranslationDisplay
  - [ ] Subtask 3.3: Ensure translation only shows for messages from other users (not own messages)
  - [ ] Subtask 3.4: Test translation UI with multiple languages

- [ ] Task 4: Verify user preferences integration (AC: #5)
  - [ ] Subtask 4.1: Verify Story 5.4 (Language Settings) implemented user.preferences.preferredLanguage
  - [ ] Subtask 4.2: Confirm ME_QUERY returns preferences.preferredLanguage
  - [ ] Subtask 4.3: Test preference change triggers re-translation of visible messages
  - [ ] Subtask 4.4: Handle case where preferredLanguage is not set (default to English)

- [ ] Task 5: Implement translation performance optimizations (AC: #4)
  - [ ] Subtask 5.1: Only translate visible messages (use IntersectionObserver or virtual scrolling context)
  - [ ] Subtask 5.2: Debounce translation API calls (avoid spamming on rapid scroll)
  - [ ] Subtask 5.3: Implement client-side translation cache (Map<messageId-targetLang, translation>)
  - [ ] Subtask 5.4: Cancel pending translations when component unmounts (AbortController cleanup in useEffect return)
  - [ ] Subtask 5.5: Prevent memory leaks by aborting fetch requests for unmounted components

- [ ] Task 6: Write unit tests for translation logic (AC: All)
  - [ ] Subtask 6.1: Test translateText function with mock Groq API responses
  - [ ] Subtask 6.2: Test language code mapping (en → English, ja → Japanese, etc.)
  - [ ] Subtask 6.3: Test error handling (API failure, rate limit, invalid response)
  - [ ] Subtask 6.4: Test translation cache (verify no duplicate API calls)

- [ ] Task 7: Write integration tests for translation UI (AC: All)
  - [ ] Subtask 7.1: Test TranslationDisplay renders translation below original
  - [ ] Subtask 7.2: Test translation only shows when source != target language
  - [ ] Subtask 7.3: Test loading state appears during translation
  - [ ] Subtask 7.4: Test error state (no translation shown on API failure)

- [ ] Task 8: Write E2E tests for translation flow (AC: All)
  - [ ] Subtask 8.1: Test User A (preferredLanguage: English) sends Japanese message "こんにちは"
  - [ ] Subtask 8.2: Test User B (preferredLanguage: Japanese) sees "Hello" translation below
  - [ ] Subtask 8.3: Test User A does NOT see translation (message in target language already)
  - [ ] Subtask 8.4: Test changing preferredLanguage in settings triggers re-translation
  - [ ] Subtask 8.5: Test translation works for all 20+ supported languages

## Dev Notes

### Architecture Patterns and Constraints

**Translation Architecture:**
- **Client-Direct Translation:** Groq API called directly from browser (no server proxy)
- **Privacy Tradeoff:** Plaintext messages sent to Groq for translation (acceptable for UX, Groq doesn't store per ToS)
- **Auto-Detection:** Groq LLM auto-detects source language (user doesn't specify)
- **Target Language:** From user.preferences.preferredLanguage (set in Story 5.4 Settings)
- **Caching:** Client-side Map cache to avoid duplicate translations

**Translation API (Groq):**
- **Model:** Llama 3.3 70B Versatile (updated Jan 2025 - replaces deprecated 3.1)
- **Model ID:** `llama-3.3-70b-versatile`
- **Context:** 128K tokens, improved multilingual capabilities
- **Endpoint:** https://api.groq.com/openai/v1/chat/completions
- **Auth:** NEXT_PUBLIC_GROQ_API_KEY (client-side env var)
- **Rate Limit:** Groq free tier (30 RPM for 70B models, 14,400/day)
- **Fallback:** On error, show original message only (graceful degradation)

**Supported Languages (20+):**
- English (en), Japanese (ja), Spanish (es), French (fr), German (de)
- Chinese (zh), Korean (ko), Portuguese (pt), Russian (ru), Arabic (ar)
- Italian (it), Dutch (nl), Polish (pl), Turkish (tr), Vietnamese (vi)
- Thai (th), Indonesian (id), Hindi (hi), Swedish (sv), Norwegian (no)

**UI/UX Patterns:**
- **Original First:** Always show sender's original message prominently
- **Translation Below:** Grayed out, italicized text below original
- **Loading State:** "Translating..." while API call in progress
- **Error State:** Hide translation entirely (show only original)
- **No UI Action Required:** Translation happens automatically on message render

**Performance Optimization (2025 Best Practices):**
- **Intersection Observer:** Only translate visible messages
- **Debounce:** Avoid spamming API during rapid scroll
- **AbortController Cleanup:** Cancel pending fetch requests in useEffect cleanup (return function)
- **Memory Leak Prevention:** Abort requests when component unmounts to prevent memory leaks
- **Cache:** Map<`${messageId}-${targetLang}`, string> to avoid duplicate calls
- **Consider React Query/SWR:** For production, consider advanced caching libraries for better stale data management

**Integration Points:**
- **Story 5.4 (Language Settings):** Depends on user.preferences.preferredLanguage
- **MessageBubble Component:** Existing component updated to include TranslationDisplay
- **ME_QUERY:** Must return user.preferences.preferredLanguage
- **Chat Screen:** Existing message rendering flow unchanged

### Project Structure Notes

**Alignment with unified project structure:**

Files to create:
- `src/components/chat/translation-display.tsx` - Translation UI component
- `src/lib/groq/translation.ts` - Groq API translation service
- `src/lib/groq/translation-cache.ts` - Client-side translation cache

Files to modify:
- `src/components/chat/message-bubble.tsx` - Integrate TranslationDisplay component
- `src/lib/contexts/auth-context.tsx` - Ensure user.preferences.preferredLanguage available
- `.env.local` - Add NEXT_PUBLIC_GROQ_API_KEY

Dependencies on existing work:
- **Story 5.4 (Language Settings):** REQUIRED - user.preferences.preferredLanguage must exist
- **Message Rendering:** Existing MessageBubble component and decryption flow
- **GraphQL ME_QUERY:** Must return user preferences including preferredLanguage

Testing files:
- `tests/unit/groq/translation.test.ts` - Unit tests for translation service
- `tests/unit/components/translation-display.test.tsx` - Component unit tests
- `tests/integration/translation-ui.test.ts` - Integration tests for UI
- `tests/e2e/story-2.5-message-translation.spec.ts` - E2E tests for full translation flow

**Detected conflicts or variances:** None. Translation is client-side and doesn't conflict with E2EE architecture (messages still encrypted at rest and in transit, only decrypted client-side before translation).

**Carry-overs from previous stories:**
- Story 2.1 (Send Messages): Message rendering and real-time delivery infrastructure
- Story 5.4 (Language Settings): user.preferences.preferredLanguage field and UI selector
- Epic 7 (E2EE): Message encryption/decryption flow (translation happens AFTER client-side decryption)

### References

- [Source: docs/tech-spec-epic-2.md#US-2.5 - Multi-Language Translation Acceptance Criteria]
- [Source: docs/tech-spec-epic-2.md#3.4 - Translation Display Component Implementation]
- [Source: docs/tech-spec-epic-2.md#3.4 - Groq Translation Module (lib/groq/translation.ts)]
- [Source: docs/PRD.md#FR-2.9 - Real-Time Translation Requirements]
- [Source: docs/PRD.md#US-2.5 - Message Translation User Story]
- [Source: docs/PRD.md#Appendix B - UserPreferences.preferredLanguage]
- [Source: docs/solution-architecture.md - NestJS + GraphQL architecture (translation is client-side only)]

## Implementation Notes

### Groq Translation API Integration

**API Request Format:**
```typescript
POST https://api.groq.com/openai/v1/chat/completions
Headers:
  Authorization: Bearer ${NEXT_PUBLIC_GROQ_API_KEY}
  Content-Type: application/json

Body:
{
  "model": "llama-3.1-70b-versatile",
  "messages": [
    {
      "role": "user",
      "content": "Translate the following text to English. If the text is already in English, return it as-is. Only return the translation, no explanations:\n\nこんにちは"
    }
  ],
  "temperature": 0.3,
  "max_tokens": 500
}
```

**API Response Format:**
```json
{
  "choices": [
    {
      "message": {
        "content": "Hello"
      }
    }
  ]
}
```

### Translation Display Component Structure

```tsx
// src/components/chat/translation-display.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { translateText } from '@/lib/groq/translation';

interface TranslationDisplayProps {
  originalText: string;
  messageId: string; // For caching
}

export function TranslationDisplay({ originalText, messageId }: TranslationDisplayProps) {
  const { user } = useAuth();
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (!user?.preferences?.preferredLanguage) return;

    // Create AbortController for cleanup (2025 best practice)
    const abortController = new AbortController();

    async function translate() {
      setIsTranslating(true);
      try {
        const targetLang = user.preferences.preferredLanguage;
        const result = await translateText(originalText, targetLang, messageId, abortController.signal);

        // Only show translation if different from original
        if (result !== originalText && !abortController.signal.aborted) {
          setTranslatedText(result);
        }
      } catch (error) {
        // Ignore abort errors (expected on unmount)
        if (error.name !== 'AbortError') {
          console.error('Translation failed:', error);
        }
        // Gracefully fail - show original only
      } finally {
        if (!abortController.signal.aborted) {
          setIsTranslating(false);
        }
      }
    }

    translate();

    // Cleanup: abort pending request on unmount (prevents memory leaks)
    return () => {
      abortController.abort();
    };
  }, [originalText, user?.preferences?.preferredLanguage, messageId]);

  if (!translatedText && !isTranslating) return null;

  return (
    <div className="mt-1 p-2 rounded bg-muted/50 text-sm text-muted-foreground italic">
      {isTranslating ? (
        <span>Translating...</span>
      ) : (
        <span>{translatedText}</span>
      )}
    </div>
  );
}
```

### Translation Service Implementation

```typescript
// src/lib/groq/translation.ts
const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY!;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Language code to full name mapping
const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'ja': 'Japanese',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'zh': 'Chinese (Simplified)',
  'ko': 'Korean',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ar': 'Arabic',
  'it': 'Italian',
  'nl': 'Dutch',
  'pl': 'Polish',
  'tr': 'Turkish',
  'vi': 'Vietnamese',
  'th': 'Thai',
  'id': 'Indonesian',
  'hi': 'Hindi',
  'sv': 'Swedish',
  'no': 'Norwegian',
};

// Client-side cache
const translationCache = new Map<string, string>();

export async function translateText(
  text: string,
  targetLanguageCode: string,
  cacheKey?: string,
  signal?: AbortSignal // 2025 best practice: support request cancellation
): Promise<string> {
  const targetLanguage = LANGUAGE_NAMES[targetLanguageCode] || 'English';

  // Check cache
  const fullCacheKey = `${cacheKey || text}-${targetLanguageCode}`;
  if (translationCache.has(fullCacheKey)) {
    return translationCache.get(fullCacheKey)!;
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal, // Pass abort signal to fetch
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Updated Jan 2025 (3.1 deprecated)
        messages: [
          {
            role: 'user',
            content: `Translate the following text to ${targetLanguage}. If the text is already in ${targetLanguage}, return it as-is. Only return the translation, no explanations:\n\n${text}`,
          },
        ],
        temperature: 0.3, // Lower temperature for consistent translation
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`);
    }

    const data = await response.json();
    const translation = data.choices[0].message.content.trim();

    // Cache the translation
    translationCache.set(fullCacheKey, translation);

    return translation;
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}

// Clear cache utility (for preference changes)
export function clearTranslationCache() {
  translationCache.clear();
}
```

### Environment Variables Required

```bash
# .env.local (frontend)
NEXT_PUBLIC_GROQ_API_KEY=gsk_xxx  # Get from https://console.groq.com/keys
```

## Dev Agent Record

### Context Reference

- **Story Context XML:** `/Users/usr0101345/projects/ourchat/docs/stories/story-context-2.5.xml`
  - Generated: 2025-11-01
  - Includes: Documentation references, code artifacts, interfaces, constraints, implementation guidance, testing ideas
  - Updated with 2025 best practices (Llama 3.3 70B, AbortController cleanup)

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

N/A - Initial story creation

### Completion Notes List

- [ ] All translation components implemented and functional
- [ ] Translation works for all 20+ supported languages
- [ ] Groq API integration tested and working
- [ ] Translation cache implemented to avoid duplicate API calls
- [ ] User preferences integration verified (Story 5.4 dependency)
- [ ] All tests passing (unit, integration, E2E)

### File List

**New Files Created:**
- `src/components/chat/translation-display.tsx`
- `src/lib/groq/translation.ts`
- `src/lib/groq/translation-cache.ts` (optional, if separate cache module)
- `tests/unit/groq/translation.test.ts`
- `tests/unit/components/translation-display.test.tsx`
- `tests/integration/translation-ui.test.ts`
- `tests/e2e/story-2.5-message-translation.spec.ts`

**Modified Files:**
- `src/components/chat/message-bubble.tsx` (integrate TranslationDisplay)
- `.env.local` (add NEXT_PUBLIC_GROQ_API_KEY)

**Existing Files Used:**
- `src/lib/contexts/auth-context.tsx` (useAuth hook for user.preferences.preferredLanguage)
- `src/components/chat/message-bubble.tsx` (existing message rendering)

### Change Log

**2025-11-01 (Initial Creation + 2025 Updates):**
- Story 2.5 created based on tech-spec-epic-2.md and PRD.md
- Scope: Client-side automatic message translation using Groq API
- **Updated with 2025 best practices:**
  - Model: Llama 3.3 70B Versatile (replaces deprecated 3.1)
  - Model ID: `llama-3.3-70b-versatile` (effective Jan 24, 2025)
  - AbortController cleanup in useEffect for memory leak prevention
  - Signal parameter in fetch for request cancellation
  - Enhanced caching and performance optimization guidance
- Dependencies: Story 5.4 (Language Settings) for user.preferences.preferredLanguage
- Status: Draft

## Follow-Up Tasks (Future Stories)

**Story 2.6: Offline Translation (Deferred):**
- Local translation model (Transformer.js or WebLLM) for offline translation
- No external API dependency (better privacy)
- Larger client bundle (~50-100MB model download)
- Fallback when Groq API unavailable

**Story 2.7: Translation Quality Feedback (Deferred):**
- "Report incorrect translation" button
- Collect user feedback on translation quality
- Improve translation prompts based on feedback

---

**Last Updated:** 2025-11-01
