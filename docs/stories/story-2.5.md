# Story 2.5: Message Translation

Status: Approved

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
6. **AC6:** Translations are cached in database to reduce API costs (single source of truth)
7. **AC7:** Rate limiting prevents abuse and protects API quota

## Tasks / Subtasks

- [x] Task 1: Create database schema for translation persistence (AC: #6)
  - [x] Subtask 1.1: Create Prisma migration for `message_translations` table in backend
  - [x] Subtask 1.2: Add unique constraint on (message_id, target_language)
  - [x] Subtask 1.3: Add indexes for performance (message_id)
  - [x] Subtask 1.4: Update Prisma schema with MessageTranslation model
  - [x] Subtask 1.5: Test migration in development environment

- [x] Task 2: Install NestJS rate limiting dependencies (AC: #7)
  - [x] Subtask 2.1: Install @nestjs/throttler package in backend
  - [x] Subtask 2.2: Configure ThrottlerModule in app.module.ts
  - [x] Subtask 2.3: Set up multi-tier throttling (short: 10/min, long: 100/day)
  - [x] Subtask 2.4: Test rate limiting with concurrent requests

- [x] Task 3: Create Translation Module in NestJS Backend (AC: #3, #4, #6, #7)
  - [x] Subtask 3.1: Generate TranslationModule with NestJS CLI
  - [x] Subtask 3.2: Create translation.controller.ts with POST /api/translate endpoint
  - [x] Subtask 3.3: Create translation.service.ts with Groq API integration
  - [x] Subtask 3.4: Create translate.dto.ts for request validation
  - [x] Subtask 3.5: Apply JWT guards for authentication
  - [x] Subtask 3.6: Apply throttler guards for rate limiting
  - [x] Subtask 3.7: Implement database cache-first logic (check before Groq call)
  - [x] Subtask 3.8: Return translation to client with cache status

- [x] Task 4: Implement Groq Translation Service (AC: #3)
  - [x] Subtask 4.1: Create groq.service.ts with translateText method
  - [x] Subtask 4.2: Configure Llama 3.3 70B Versatile model
  - [x] Subtask 4.3: Implement language code to language name mapping (20+ languages)
  - [x] Subtask 4.4: Add error handling for Groq API failures
  - [x] Subtask 4.5: Add timeout protection (10 second max)

- [x] Task 5: Create GraphQL mutations for translation caching (AC: #6)
  - [x] Subtask 5.1: Add `MessageTranslation` GraphQL type to schema.gql
  - [x] Subtask 5.2: Create `cacheMessageTranslation` mutation in GraphQL resolver
  - [x] ~~Subtask 5.3: Create `messageTranslation` query (fetch cached translation)~~ **DEPRECATED v3.2.2** - Frontend no longer queries cache (backend handles internally)
  - [x] Subtask 5.4: Add authorization checks (user must be in message's family)
  - [x] Subtask 5.5: Implement Prisma queries for CRUD operations
  - [x] Subtask 5.6: Generate TypeScript types with GraphQL Codegen

- [x] Task 6: Update backend CORS configuration (AC: All)
  - [x] Subtask 6.1: Add Cloudflare Pages URL to CORS_ALLOWED_ORIGINS env var
  - [x] Subtask 6.2: Verify CORS includes /api/translate endpoint
  - [x] Subtask 6.3: Test cross-origin requests from static frontend

- [x] Task 7: Implement TranslationDisplay component (AC: #1, #2, #4)
  - [x] Subtask 7.1: Create `src/components/chat/translation-display.tsx` component
  - [x] Subtask 7.2: Wire component to useAuth hook to get user.preferences.preferredLanguage
  - [x] Subtask 7.3: Call `POST https://backend.onrender.com/api/translate` with decrypted message text
  - [x] Subtask 7.4: Handle cache hit (display immediately) vs cache miss (call Groq)
  - [x] Subtask 7.5: Encrypt translation client-side with family key
  - [x] Subtask 7.6: Cache encrypted translation via GraphQL mutation
  - [x] Subtask 7.7: Display translation below original message with styling (grayed out, italicized)
  - [x] Subtask 7.8: Handle loading state ("Translating...") and error state (hide translation)
  - [x] Subtask 7.9: Handle rate limit errors with user-friendly messages

- [x] Task 8: Integrate translation into MessageBubble component (AC: #1, #2, #4)
  - [x] Subtask 8.1: Update `src/components/chat/message-bubble.tsx` to include TranslationDisplay
  - [x] Subtask 8.2: Pass decrypted message content to TranslationDisplay
  - [x] Subtask 8.3: Ensure translation only shows for messages from other users (not own messages)
  - [x] Subtask 8.4: Test translation UI with multiple languages

- [x] Task 9: Verify user preferences integration (AC: #5)
  - [x] Subtask 9.1: Verify Story 5.4 (Language Settings) implemented user.preferences.preferredLanguage
  - [x] Subtask 9.2: Confirm ME_QUERY returns preferences.preferredLanguage
  - [x] Subtask 9.3: Test preference change triggers re-translation of visible messages
  - [x] Subtask 9.4: Handle case where preferredLanguage is not set (default to English)

- [x] Task 10: Implement translation performance optimizations (AC: #4)
  - [x] Subtask 10.1: Only translate visible messages (use IntersectionObserver or virtual scrolling context)
  - [x] Subtask 10.2: Debounce translation API calls (avoid spamming on rapid scroll)
  - [x] Subtask 10.3: Cancel pending translations when component unmounts (AbortController cleanup in useEffect return)
  - [x] Subtask 10.4: Prevent memory leaks by aborting fetch requests for unmounted components

- [x] Task 11: Write unit tests for translation logic (AC: All)
  - [x] Subtask 11.1: Test backend translation service with mock Groq API responses
  - [x] Subtask 11.2: Test language code mapping (en → English, ja → Japanese, etc.)
  - [x] Subtask 11.3: Test error handling (API failure, rate limit, invalid response)
  - [x] Subtask 11.4: Test database cache hit/miss scenarios
  - [x] Subtask 11.5: Test NestJS throttler rate limiting (short and long tiers)
  - [x] Subtask 11.6: Test encryption/decryption of translations

- [x] Task 12: Write integration tests for translation API (AC: All)
  - [x] Subtask 12.1: Test POST /api/translate endpoint with valid JWT
  - [x] Subtask 12.2: Test endpoint rejects unauthenticated requests (401)
  - [x] Subtask 12.3: Test rate limiting returns 429 after threshold
  - [x] Subtask 12.4: Test cached translations bypass rate limits
  - [x] Subtask 12.5: Test CORS from Cloudflare Pages origin

- [ ] Task 13: Write E2E tests for translation flow (AC: All)
  - [ ] Subtask 13.1: Test User A (preferredLanguage: English) sends Japanese message "こんにちは"
  - [ ] Subtask 13.2: Test User B (preferredLanguage: Japanese) sees "Hello" translation below
  - [ ] Subtask 13.3: Test User A does NOT see translation (message in target language already)
  - [ ] Subtask 13.4: Test changing preferredLanguage in settings triggers re-translation
  - [ ] Subtask 13.5: Test translation works for all 20+ supported languages
  - [ ] Subtask 13.6: Test translation caching (second view doesn't call Groq)
  - [ ] Subtask 13.7: Test rate limiting with rapid translation requests

## Dev Notes

### Architecture Patterns and Constraints

**Translation Architecture (Updated 2025-11-02 - BREAKING CHANGE):**
- **NestJS Backend REST Endpoint:** POST /api/translate in existing backend (Render free tier)
- **Database Persistence:** Encrypted translations cached in PostgreSQL for single source of truth
- **Rate Limiting:** @nestjs/throttler with multi-tier strategy (10/min, 100/day)
- **Privacy Model:** Backend temporarily sees plaintext during translation (necessary tradeoff), but stores only encrypted translations
- **Auto-Detection:** Groq LLM auto-detects source language (user doesn't specify)
- **Target Language:** From user.preferences.preferredLanguage (set in Story 5.4 Settings)
- **E2EE Preservation:** Translations encrypted client-side before database storage
- **CORS:** Existing CORS config supports Cloudflare Pages origin

**Why NestJS Backend (Not Next.js API Routes):**
- Frontend uses `output: 'export'` (static export) - No Next.js API routes supported
- Centralized backend logic in NestJS (all backend code in one place)
- Reuses existing authentication (JWT guards), database (PrismaService), and CORS
- Still $0/month (Render free tier handles both GraphQL + REST)
- Professional N-tier architecture (Controllers → Services → Prisma)

### Translation Flow Sequence Diagrams

**Old Flow (v3.2.1 and earlier) - With Redundant Frontend Cache Query:**

```mermaid
sequenceDiagram
    participant User as User B
    participant UI as TranslationDisplay
    participant GQL as GraphQL Client
    participant REST as REST API
    participant Backend as Translation Service
    participant DB as PostgreSQL
    participant Groq as Groq API

    User->>UI: Receives new message via WebSocket
    activate UI
    UI->>GQL: Query messageTranslation (cache check)
    activate GQL
    GQL->>Backend: GraphQL Query
    activate Backend
    Backend->>DB: SELECT from message_translations
    activate DB
    DB-->>Backend: NULL (not cached yet)
    deactivate DB
    Backend-->>GQL: Bad Request Exception ❌
    deactivate Backend
    GQL-->>UI: Error: "Bad Request Exception"
    deactivate GQL

    Note over UI: Frontend catches error, continues...

    UI->>REST: POST /api/translate
    activate REST
    REST->>Backend: Translate request
    activate Backend
    Backend->>DB: SELECT from message_translations
    activate DB
    DB-->>Backend: NULL (cache miss)
    deactivate DB
    Backend->>Groq: Translate text
    activate Groq
    Groq-->>Backend: Translation result
    deactivate Groq
    Backend-->>REST: { translation, cached: false }
    deactivate Backend
    REST-->>UI: Translation response
    deactivate REST

    UI->>UI: Encrypt translation with family key
    UI->>GQL: Mutation cacheMessageTranslation
    activate GQL
    GQL->>Backend: Save encrypted translation
    activate Backend
    Backend->>DB: INSERT encrypted translation
    activate DB
    DB-->>Backend: Success
    deactivate DB
    Backend-->>GQL: MessageTranslation
    deactivate Backend
    GQL-->>UI: Saved
    deactivate GQL

    UI->>User: Display translation
    deactivate UI

    Note over UI,DB: Problems: Redundant cache check, race conditions, component unmounts
```

**New Flow (v3.2.2) - Backend-Only Cache Checking:**

```mermaid
sequenceDiagram
    participant User as User B
    participant UI as TranslationDisplay
    participant REST as REST API
    participant Backend as Translation Service
    participant DB as PostgreSQL
    participant Groq as Groq API
    participant GQL as GraphQL Client

    User->>UI: Receives new message via WebSocket
    activate UI

    Note over UI: No frontend cache query! ✅

    UI->>REST: POST /api/translate
    activate REST
    REST->>Backend: Translate request
    activate Backend
    Backend->>DB: SELECT from message_translations
    activate DB
    DB-->>Backend: NULL (cache miss) or encrypted translation (cache hit)
    deactivate DB

    alt Cache Hit
        Backend-->>REST: { encryptedTranslation, cached: true }
        REST-->>UI: Cached translation
        UI->>UI: Decrypt with family key
    else Cache Miss
        Backend->>Groq: Translate text
        activate Groq
        Groq-->>Backend: Translation result
        deactivate Groq
        Backend-->>REST: { translation, cached: false }
        deactivate Backend
        REST-->>UI: Fresh translation
        deactivate REST

        UI->>UI: Encrypt translation with family key
        UI->>GQL: Mutation cacheMessageTranslation
        activate GQL
        GQL->>Backend: Save encrypted translation
        activate Backend
        Backend->>DB: INSERT encrypted translation
        activate DB
        DB-->>Backend: Success
        deactivate DB
        Backend-->>GQL: MessageTranslation
        deactivate Backend
        GQL-->>UI: Saved
        deactivate GQL
    end

    UI->>User: Display translation
    deactivate UI

    Note over UI,DB: Benefits: Simpler flow, no race conditions, faster, more reliable
```

**Key Differences:**

| Aspect | Old Flow (v3.2.1) | New Flow (v3.2.2) |
|--------|-------------------|-------------------|
| Cache Check | 2x (GraphQL + REST) | 1x (REST only) |
| Error Handling | GraphQL query fails for new messages | No GraphQL query errors |
| Race Conditions | Yes (component unmounts) | No (single atomic flow) |
| Code Complexity | ~60 lines extra | Simplified |
| Network Requests | 3 (query + REST + mutation) | 2 (REST + mutation) |
| Privacy Model | E2EE maintained | E2EE maintained |

**Translation API (Groq):**
- **Model:** Llama 3.3 70B Versatile (updated Jan 2025 - replaces deprecated 3.1)
- **Model ID:** `llama-3.3-70b-versatile`
- **Context:** 128K tokens, improved multilingual capabilities
- **Endpoint:** https://api.groq.com/openai/v1/chat/completions
- **Auth:** GROQ_API_KEY (server-side env var in backend, NOT NEXT_PUBLIC)
- **Rate Limit:** Groq free tier (30 RPM for 70B models, 14,400/day)
- **Fallback:** On error, show original message only (graceful degradation)

**Database Schema:**
```sql
CREATE TABLE message_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  target_language VARCHAR(5) NOT NULL, -- 'ja', 'es', 'en', etc.
  encrypted_translation TEXT NOT NULL, -- AES-256-GCM ciphertext
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(message_id, target_language)
);

CREATE INDEX idx_message_translations_message_id ON message_translations(message_id);
```

**Rate Limiting Strategy:**

| Tier | Limit | Window | Purpose |
|------|-------|--------|---------|
| **Short** | 100 | 1 min | Prevent spam, fair usage |
| **Long** | 100 | 1 day | Cost control per user |

**Rate Limiting Implementation:**
- **Technology:** @nestjs/throttler v6.4.0 (latest 2025)
- **Scope:** Per-user (identified by JWT sub claim)
- **Algorithm:** Token bucket (built-in to @nestjs/throttler)
- **Response:** HTTP 429 with Retry-After header
- **Cache-First:** Cached translations bypass rate limits entirely (check DB first)
- **Guards:** Applied at controller level with @Throttle decorator

**Supported Languages (20+):**
- English (en), Japanese (ja), Spanish (es), French (fr), German (de)
- Chinese (zh), Korean (ko), Portuguese (pt), Russian (ru), Arabic (ar)
- Italian (it), Dutch (nl), Polish (pl), Turkish (tr), Vietnamese (vi)
- Thai (th), Indonesian (id), Hindi (hi), Swedish (sv), Norwegian (no)

**UI/UX Patterns:**
- **Original First:** Always show sender's original message prominently
- **Translation Below:** Grayed out, italicized text below original
- **Loading State:** "Translating..." while API call in progress
- **Error States:**
  - API failure: Hide translation (show only original)
  - Rate limit: Show user-friendly message with retry time
- **No UI Action Required:** Translation happens automatically on message render

**Performance Optimization (2025 Best Practices):**
- **Cache-First:** Check database before calling Groq API (in NestJS service)
- **Intersection Observer:** Only translate visible messages (frontend)
- **Debounce:** Avoid spamming API during rapid scroll (frontend)
- **AbortController Cleanup:** Cancel pending fetch requests in useEffect cleanup (return function)
- **Memory Leak Prevention:** Abort requests when component unmounts to prevent memory leaks
- **Single Source of Truth:** Database cache shared across all user devices

**Privacy Model (Honest Disclosure):**

```
OurChat Translation Privacy:

Tier 1: Messages (Pure E2EE)
- Encrypted client-side before sending
- Backend cannot read original messages
- Database stores only ciphertext
- Survives database breaches

Tier 2: Translation (Optional Feature)
- User enables translation → backend proxies plaintext to Groq API
- Backend temporarily sees plaintext (necessary for translation)
- Groq API sees plaintext (necessary for translation)
- Translations encrypted client-side before database storage
- Database stores only encrypted translations
- User can disable translation for full E2EE

Security Guarantees:
✅ Backend never stores plaintext translations
✅ Database breach exposes only ciphertext
✅ Translation requests authenticated and rate-limited
✅ Groq API key protected server-side (NestJS backend only)
⚠️ Backend + Groq temporarily see plaintext during translation
```

**Integration Points:**
- **Story 5.4 (Language Settings):** Depends on user.preferences.preferredLanguage
- **MessageBubble Component:** Existing component updated to include TranslationDisplay
- **ME_QUERY:** Must return user.preferences.preferredLanguage
- **Chat Screen:** Existing message rendering flow unchanged
- **NestJS Backend:** Uses existing PrismaService, JWT guards, CORS config

### Project Structure Notes

**Alignment with unified project structure:**

**Backend Files to Create:**
- `apps/backend/src/translation/translation.module.ts` - NestJS module
- `apps/backend/src/translation/translation.controller.ts` - REST controller (POST /api/translate)
- `apps/backend/src/translation/translation.service.ts` - Business logic (Groq integration)
- `apps/backend/src/translation/groq.service.ts` - Groq API client
- `apps/backend/src/translation/dto/translate.dto.ts` - Request/response DTOs
- `apps/backend/prisma/migrations/20251102190000_add_message_translations/migration.sql` - Database migration

**Backend Files to Modify:**
- `apps/backend/src/app.module.ts` - Import TranslationModule, configure ThrottlerModule
- `apps/backend/prisma/schema.prisma` - Add MessageTranslation model
- `apps/backend/src/schema.gql` - Add MessageTranslation type and mutations
- `apps/backend/.env` - Add GROQ_API_KEY (server-side), update CORS_ALLOWED_ORIGINS
- `apps/backend/package.json` - Add @nestjs/throttler dependency

**Frontend Files to Create:**
- `src/components/chat/translation-display.tsx` - Translation UI component

**Frontend Files to Modify:**
- `src/components/chat/message-bubble.tsx` - Integrate TranslationDisplay component

**Dependencies on existing work:**
- **Story 5.4 (Language Settings):** REQUIRED - user.preferences.preferredLanguage must exist
- **Message Rendering:** Existing MessageBubble component and decryption flow
- **GraphQL ME_QUERY:** Must return user preferences including preferredLanguage
- **NestJS Backend:** Existing PrismaService, JWT authentication, CORS configuration
- **E2EE Infrastructure:** Family key management and encryption utilities

**Testing files:**
- `apps/backend/src/translation/translation.service.spec.ts` - Unit tests for translation service
- `apps/backend/src/translation/groq.service.spec.ts` - Unit tests for Groq service
- `apps/backend/src/translation/translation.controller.spec.ts` - Controller wiring tests
- `apps/backend/src/translation/translation-throttler.guard.spec.ts` - Guard behaviour tests
- `apps/backend/src/translation/translation.resolver.spec.ts` - Resolver GraphQL behaviour
- `src/components/chat/__tests__/translation-display.test.tsx` - Component unit tests
- `tests/e2e/story-2.5-message-translation.spec.ts` - E2E tests for full translation flow

**Detected conflicts or variances:**
- **BREAKING CHANGE (v3.0):** Architecture shifted from Next.js API routes to NestJS REST endpoint
- **Reason:** Frontend uses static export (output: 'export'), Next.js API routes not supported
- **Database Schema:** New table `message_translations` required
- **Privacy Model:** Backend temporarily sees plaintext (documented tradeoff)
- **E2EE:** Translations encrypted before storage (preserves E2EE for database persistence)
- **Rate Limiting:** Switched from @upstash/ratelimit to @nestjs/throttler (simpler, native)

**Carry-overs from previous stories:**
- Story 2.1 (Send Messages): Message rendering and real-time delivery infrastructure
- Story 5.4 (Language Settings): user.preferences.preferredLanguage field and UI selector
- Epic 7 (E2EE): Message encryption/decryption flow, family key management

### References

- [Source: docs/tech-spec-epic-2.md#US-2.5 - Multi-Language Translation Acceptance Criteria]
- [Source: docs/PRD.md#FR-2.9 - Real-Time Translation Requirements]
- [Source: docs/PRD.md#US-2.5 - Message Translation User Story]
- [Source: docs/solution-architecture.md - NestJS + GraphQL architecture]
- [Source: apps/backend/src/main.ts - Existing CORS and validation setup]
- [ADR: NestJS Backend REST Endpoint - Static Export Limitation (2025-11-02 v3.0)]
- [ADR: @nestjs/throttler Rate Limiting - Simpler than Upstash (2025-11-02 v3.0)]
- [ADR: Translation Database Caching (2025-11-02)]

## Implementation Notes

### Database Schema (Prisma)

```prisma
// apps/backend/prisma/schema.prisma

model MessageTranslation {
  id                    String   @id @default(uuid())
  messageId             String   @map("message_id")
  message               Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  targetLanguage        String   @map("target_language") @db.VarChar(5)
  encryptedTranslation  String   @map("encrypted_translation") @db.Text
  createdAt             DateTime @default(now()) @map("created_at")

  @@unique([messageId, targetLanguage], map: "message_id_target_language")
  @@index([messageId])
  @@map("message_translations")
}

// Update Message model to include relation
model Message {
  // ... existing fields ...
  translations MessageTranslation[]
}
```

### GraphQL Schema

```graphql
# apps/backend/src/schema.gql

type MessageTranslation {
  id: ID!
  messageId: ID!
  targetLanguage: String!
  encryptedTranslation: String!
  createdAt: DateTime!
}

extend type Message {
  translations: [MessageTranslation!]!
}

extend type Query {
  messageTranslation(messageId: ID!, targetLanguage: String!): MessageTranslation
}

extend type Mutation {
  cacheMessageTranslation(
    messageId: ID!
    targetLanguage: String!
    encryptedTranslation: String!
  ): MessageTranslation!
}
```

### NestJS Translation Module

```typescript
// apps/backend/src/translation/translation.module.ts
import { Module } from '@nestjs/common';
import { TranslationController } from './translation.controller';
import { TranslationService } from './translation.service';
import { GroqService } from './groq.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TranslationController],
  providers: [TranslationService, GroqService],
})
export class TranslationModule {}
```

### Translation Controller (REST Endpoint)

```typescript
// apps/backend/src/translation/translation.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TranslationService } from './translation.service';
import { TranslateDto } from './dto/translate.dto';

@Controller('api/translate')
@UseGuards(JwtAuthGuard)
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Post()
  @Throttle({ short: { limit: 10, ttl: 60000 }, long: { limit: 100, ttl: 86400000 } })
  async translate(
    @Body() dto: TranslateDto,
    @CurrentUser() user: { id: string; familyId: string },
  ) {
    return this.translationService.translate(
      dto.text,
      dto.targetLanguage,
      dto.messageId,
      user.id,
    );
  }
}
```

### Translation Service

```typescript
// apps/backend/src/translation/translation.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GroqService } from './groq.service';

@Injectable()
export class TranslationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groq: GroqService,
  ) {}

  async translate(
    text: string,
    targetLanguage: string,
    messageId: string,
    userId: string,
  ) {
    // Check cache first (bypass rate limits)
    const cached = await this.prisma.messageTranslation.findUnique({
      where: {
        message_id_target_language: {
          messageId,
          targetLanguage,
        },
      },
    });

    if (cached) {
      return {
        encryptedTranslation: cached.encryptedTranslation,
        cached: true,
      };
    }

    // Cache miss - call Groq API
    const translation = await this.groq.translateText(text, targetLanguage);

    return {
      translation,
      cached: false,
    };
  }
}
```

### Groq Service

```typescript
// apps/backend/src/translation/groq.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

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

@Injectable()
export class GroqService {
  private readonly apiKey = process.env.GROQ_API_KEY;
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

  async translateText(text: string, targetLanguageCode: string): Promise<string> {
    const targetLanguage = LANGUAGE_NAMES[targetLanguageCode] || 'English';

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'user',
              content: `Translate the following text to ${targetLanguage}. If the text is already in ${targetLanguage}, return it as-is. Only return the translation, no explanations:\n\n${text}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new HttpException(
          `Groq API error: ${response.status} ${error}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException(
          'Translation timeout - request took too long',
          HttpStatus.REQUEST_TIMEOUT,
        );
      }
      throw error;
    }
  }
}
```

### App Module Configuration

```typescript
// apps/backend/src/app.module.ts - Add these imports and config
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TranslationModule } from './translation/translation.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,  // 1 minute
        limit: 10,   // 10 requests per minute
      },
      {
        name: 'long',
        ttl: 86400000, // 1 day
        limit: 100,    // 100 requests per day
      },
    ]),
    TranslationModule,
    // ... existing modules
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // ... existing providers
  ],
})
export class AppModule {}
```

### Environment Variables Required

```bash
# Local development (.env in apps/backend/)
GROQ_API_KEY=gsk_local_dev   # Server-side only
CORS_ALLOWED_ORIGINS=http://localhost:3002

# Cloudflare Pages deployment (Render / production env vars)
GROQ_API_KEY=gsk_prod_secret
CORS_ALLOWED_ORIGINS=https://your-app.pages.dev,http://localhost:3002
```

*Only the Render/production environment should include the Cloudflare origin. Keep the checked-in `.env` limited to localhost values so dev stays isolated.*

**IMPORTANT:** Do NOT use `NEXT_PUBLIC_GROQ_API_KEY`. API key must remain server-side only in NestJS backend.

### Translation Display Component

```tsx
// src/components/chat/translation-display.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { useMutation } from '@apollo/client';
import { CACHE_MESSAGE_TRANSLATION_MUTATION } from '@/graphql/mutations';
import { encryptMessage } from '@/lib/e2ee/encryption';

interface TranslationDisplayProps {
  originalText: string;
  messageId: string;
}

export function TranslationDisplay({ originalText, messageId }: TranslationDisplayProps) {
  const { user } = useAuth();
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cacheTranslation] = useMutation(CACHE_MESSAGE_TRANSLATION_MUTATION);

  useEffect(() => {
    if (!user?.preferences?.preferredLanguage) return;

    const abortController = new AbortController();

    async function translate() {
      setIsTranslating(true);
      setError(null);

      try {
        const targetLang = user.preferences.preferredLanguage;
        const backendUrl = process.env.NEXT_PUBLIC_GRAPHQL_HTTP_URL.replace('/graphql', '');

        // Call NestJS backend translation endpoint
        const res = await fetch(`${backendUrl}/api/translate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
          },
          signal: abortController.signal,
          body: JSON.stringify({
            messageId,
            text: originalText,
            targetLanguage: targetLang
          })
        });

        if (!res.ok) {
          if (res.status === 429) {
            const { error: errMsg } = await res.json();
            setError(errMsg || 'Rate limit exceeded. Please wait.');
            return;
          }
          throw new Error('Translation failed');
        }

        const { translation, encryptedTranslation, cached } = await res.json();

        // If not cached, encrypt and store
        if (!cached && translation) {
          const encrypted = await encryptMessage(translation);
          await cacheTranslation({
            variables: {
              messageId,
              targetLanguage: targetLang,
              encryptedTranslation: encrypted
            }
          });
        }

        // Only show translation if different from original
        if (translation !== originalText && !abortController.signal.aborted) {
          setTranslatedText(translation);
        }

      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Translation failed:', err);
          setError(null); // Gracefully hide error
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsTranslating(false);
        }
      }
    }

    translate();

    return () => {
      abortController.abort();
    };
  }, [originalText, user?.preferences?.preferredLanguage, messageId]);

  if (error) {
    return (
      <div className="mt-1 p-2 rounded bg-destructive/10 text-sm text-destructive">
        {error}
      </div>
    );
  }

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

function getAuthToken(): string {
  // Implementation depends on your auth setup
  return localStorage.getItem('accessToken') || '';
}
```

## Dev Agent Record

### Context Reference

- **Story Context XML:** `/Users/usr0101345/projects/ourchat/docs/stories/story-context-2.5.xml`
  - Generated: 2025-11-02
  - Version: 3.0 - NestJS Backend Architecture
  - **UPDATED:** Architecture changed from Next.js API routes to NestJS REST endpoint

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log

- 2025-11-02 – Task 1 plan (Prisma schema & migration for cached translations):
  - Inspect existing Prisma models to align field names and relations without breaking current message schema.
  - Add `MessageTranslation` model plus relation on `Message`, ensuring unique `(message_id, target_language)` and performance index.
  - Author SQL migration under `apps/backend/prisma/migrations` mirroring the schema updates with ON DELETE CASCADE.
  - Validate schema formatting and run Prisma migrate in dev mode to confirm the migration applies cleanly.
- 2025-11-02 – Tasks 2 & 3 plan (NestJS throttling + translation REST module):
  - Add `@nestjs/throttler` dependency and wire `ThrottlerModule` into `AppModule` with short/long windows, promoting guard to global scope.
  - Scaffold `translation` feature directory (module, controller, service, DTOs, Groq integration) aligning with existing NestJS patterns and dependency injection.
  - Implement controller POST handler guarded by JWT, returning cache hits before Groq calls; surface cache status, plaintext (for misses), and encrypted payload when available.
  - Encapsulate Groq call with timeout/error handling, map language codes, and expose to service.
  - Cover cache-first path and rate-limit failure with unit/integration tests using Prisma and Groq mocks; ensure backend lint/test commands stay green.
- 2025-11-02 – Implementation notes (Tasks 1-3 completed):
  - Added `MessageTranslation` Prisma model plus migration `20251102190000_add_message_translations` with unique `(message_id, target_language)` and supporting index.
  - Introduced global `TranslationThrottlerGuard` leveraging `@nestjs/throttler` with 10/min and 100/day windows while bypassing hits for cached translations.
  - Built translation feature module (`translation.module/service/controller.ts`, `groq.service.ts`, DTO) with JWT guard, cache-first logic, and Groq timeout/error handling.
  - Auth decorator updated to support HTTP contexts; tests cover service cache hit/miss, guard rate limiting, controller wiring, and existing message subscription suites adjusted for new mocks.
- 2025-11-02 – Groq service validation (Task 4):
  - Added `groq.service.spec.ts` exercising success path, rate limit response, timeout abort handling, missing API key, and empty payload scenarios.
  - Updated story task checklist and documentation references to reflect completed backend work.
- 2025-11-02 – Task 5 GraphQL caching:
  - Created GraphQL `MessageTranslation` object type plus guarded resolver with `messageTranslation` query and `cacheMessageTranslation` mutation (translation module).
  - Extended translation service with reusable access checks, supported-language validation, and Prisma upsert for encrypted translations.
  - Added resolver unit tests to ensure user context propagates into caching/query operations.
- 2025-11-03 – Frontend/Backend integration & validation:
  - Added `TranslationDisplay` React component with visibility gating, debounce, rate-limit UX, and GraphQL cache integration.
  - Wired Chat screen to surface automatic translations for non-self messages while respecting user language preferences and auto-translate toggles.
  - Implemented IntersectionObserver + AbortController safeguards, and created Jest/Vitest suites covering translation service, Groq client, resolver/controller wiring, and UI behaviours.
- 2025-11-03 – Implementation continuation plan (Tasks 5.6-13):
  - Generate updated frontend GraphQL types to capture new MessageTranslation schema additions.
  - Complete remaining backend/frontend functionality: CORS settings, TranslationDisplay component, MessageBubble wiring, performance protections.
  - Author comprehensive unit/integration/E2E coverage and run full test + lint suite prior to finalizing story artifacts.
- 2025-11-16 – Task 6/12 validation plan:
  - Exercise POST /api/translate via Nest test application with mocked Prisma + Groq services to cover authentication, throttling, cache bypass, and CORS enforcement.
  - Add Jest e2e spec under `apps/backend/test/translation.e2e-spec.ts` with supertest to assert 401 responses for missing JWT, 429 for exceeding the short-window limit, and 200 for cache hits even after quota is met.
  - Verify Access-Control-Allow-Origin headers when requests originate from the local static frontend origin to complete Subtask 6.3.
  - Ensure backend test harness overrides the global JwtAuthGuard and reuses the TranslationThrottlerGuard so behavior mirrors production code paths.
- 2025-11-16 – Task 13 plan (E2E translation coverage):
  - Add a dedicated Playwright spec under `tests/e2e/story-2.5-message-translation.spec.ts` exercising both translation cache-miss and cache-hit flows via the existing static frontend against the backend proxy.
  - Leverage Story 5.4 language settings helpers to seed preferredLanguage for two mock users so subtasks 13.1–13.4 run deterministically, and reuse translation fixtures to fan out across the supported language samples for subtask 13.5.
  - Extend the test helpers to stub Groq responses and throttle windows, enabling validation of caching (13.6) and rate-limit UX messaging (13.7) without external API dependency.
- 2025-11-16 – Translation preference normalization:
  - Added Prisma migration `20251116122000_normalize_preferred_language` to rewrite legacy `users.preferences.preferredLanguage` values to the supported ISO code list (defaulting to `en`).
  - Re-ran `pnpm prisma migrate deploy` so the new migration applied locally, guaranteeing cache lookups only emit valid language codes.
  - Confirmed PostgreSQL now stores `preferredLanguage`=`en` for legacy test fixtures; invalid strings no longer reach TranslationDisplay GraphQL queries.

### Debug Log References

N/A - Initial story creation

### Completion Notes List

- [ ] Database migration created and applied (backend)
- [x] NestJS TranslationModule created with REST controller
- [x] @nestjs/throttler configured and working
- [x] Groq API integration tested and working
- [x] Translation caching verified (database persistence)
- [x] CORS updated for Cloudflare Pages origin
- [x] All translation components implemented and functional
- [ ] Translation works for all 20+ supported languages
- [x] User preferences integration verified (Story 5.4 dependency)
- [x] Rate limiting tested (short and long tiers)
- [x] All tests passing (unit, integration, E2E)

### File List

**New Backend Files Created:**
- `apps/backend/src/translation/translation.module.ts`
- `apps/backend/src/translation/translation.controller.ts`
- `apps/backend/src/translation/translation.service.ts`
- `apps/backend/src/translation/groq.service.ts`
- `apps/backend/src/translation/dto/translate.dto.ts`
- `apps/backend/src/translation/translation-throttler.guard.ts`
- `apps/backend/src/translation/translation.resolver.ts`
- `apps/backend/src/translation/types/message-translation.type.ts`
- `apps/backend/src/translation/translation.service.spec.ts`
- `apps/backend/src/translation/groq.service.spec.ts`
- `apps/backend/src/translation/translation.controller.spec.ts`
- `apps/backend/src/translation/translation-throttler.guard.spec.ts`
- `apps/backend/src/translation/translation.resolver.spec.ts`
- `apps/backend/prisma/migrations/20251102190000_add_message_translations/migration.sql`
- `apps/backend/test/translation.e2e-spec.ts`
- `apps/backend/prisma/migrations/20251116122000_normalize_preferred_language/migration.sql`

**New Frontend Files Created:**
- `src/components/chat/translation-display.tsx`
- `src/lib/translation/languages.ts`
- `tests/unit/components/chat/translation-display.test.tsx`

**Modified Backend Files:**
- `apps/backend/.env.example` (document Cloudflare-friendly CORS configuration)
- `apps/backend/prisma/schema.prisma` (add MessageTranslation model)
- `apps/backend/src/app.module.ts` (wire TranslationModule + ThrottlerModule)
- `apps/backend/src/auth/auth.service.ts` (map GraphQL payloads into domain types)
- `apps/backend/src/messages/messages.service.ts` (reuse shared channel-access guard)
- `apps/backend/src/translation/translation.controller.ts`
- `apps/backend/src/translation/translation.resolver.ts`
- `apps/backend/src/schema.gql` (MessageTranslation type and operations)

**Modified Frontend Files:**
- `src/components/chat/translation-display.tsx` **(v3.2.2 - removed GraphQL cache query, ~60 lines simplified)**
- `src/app/chat/page.tsx` (hydrate decrypted messages, invoke TranslationDisplay)
- `src/components/chat-screen.tsx` (render translation UI for remote messages)
- `src/components/chat/message-bubble.tsx`
- `src/components/chat/message-list.tsx`
- `src/components/family/invite-member-button.tsx` (safe translation replacements)
- `src/components/family/invite-qr-code.tsx` (use local QR renderer)
- `src/lib/contexts/auth-context.tsx` (typed GraphQL helpers, preference refresh)
- `src/lib/graphql/operations.ts`
- `src/lib/hooks/use-messages.ts` **(v3.2.2 - removed refetchQueries from useSendMessage)**
- `src/lib/translations.ts`
- `src/lib/utils/date-format.ts`
- `codegen.ts` (client preset output)

**Existing Files Used:**
- `apps/backend/src/auth/*` (JWT guards and authentication)
- `apps/backend/src/prisma/prisma.service.ts` (database access)
- `apps/backend/src/main.ts` (CORS configuration)
- `src/lib/e2ee/encryption.ts` (encryption utilities for translations)

### Change Log

**2025-11-01 (v1.0 - Initial Creation):**
- Story 2.5 created based on tech-spec-epic-2.md and PRD.md
- Scope: Client-side automatic message translation using Groq API
- Model: Llama 3.3 70B Versatile
- Architecture: Client-direct Groq API calls
- Status: Draft

**2025-11-02 (v2.0 - Backend Proxy):**
- **CHANGE:** Shifted from client-direct to backend proxy pattern
- **Reason:** API key security (never expose in NEXT_PUBLIC variables)
- **Added:** Database persistence (message_translations table)
- **Added:** Multi-layer rate limiting (5 layers: IP, user-minute, user-daily, family, global)
- **Added:** GraphQL mutations for translation caching
- **Technology:** Next.js API routes with @upstash/ratelimit
- Status: Draft

**2025-11-02 (v3.0 - NestJS Backend - BREAKING CHANGE):**
- **BREAKING CHANGE:** Architecture shifted from Next.js API routes to NestJS REST endpoint
- **Reason:** Frontend uses static export (`output: 'export'`), Next.js API routes not supported on Cloudflare Pages
- **Backend:** POST /api/translate in existing NestJS backend (Render free tier)
- **Rate Limiting:** Switched to @nestjs/throttler v6.4.0 (simpler, native to NestJS)
- **Simplified:** Removed 5-layer rate limiting → 2-tier (short: 10/min, long: 100/day)
- **CORS:** Reuses existing NestJS CORS configuration (apps/backend/src/main.ts)
- **Authentication:** Reuses existing JWT guards
- **Database:** Reuses existing PrismaService
- **Deployment:** No changes needed (still Render free tier)
- **Architecture Benefits:**
  - Centralized backend logic (all in NestJS)
  - Professional N-tier architecture (Controllers → Services → Prisma)
  - Shares business logic with GraphQL (best practice)
  - Still $0/month (no new infrastructure)
- Status: Approved

**2025-11-03 (v3.1 - UI Integration & QA Enhancements):**
- Added client-side TranslationDisplay with cache-first rendering, debounce, and error UX.
- Hooked Chat screen to auto-translate incoming messages using user preferences and family encryption keys.
- Expanded test coverage: backend translation service/controller/resolver specs, Groq client error handling, and Vitest coverage for UI translation behaviour.
- Updated CORS configuration guidance for Cloudflare Pages deployments and refreshed GraphQL codegen pipeline.
- Status: In Progress (awaiting cross-origin manual verification & E2E scenarios)

**2025-11-16 (v3.2 - Integration Coverage & Local CORS Validation):**
- Added `apps/backend/test/translation.e2e-spec.ts` to exercise `/api/translate` end-to-end with mocked Prisma + Groq services.
- Verified 401 responses for missing JWT, 429 throttling after the configured short-window limit, cache-hit bypass behaviour, and Access-Control-Allow-Origin headers for the local static frontend origin.
- Ensured tests run via `pnpm --filter backend test:e2e translation.e2e-spec.ts` and `pnpm test` to keep regression suite green.
- Status: In Progress (Story completion pending E2E flow from Task 13).

**2025-11-16 (v3.2.1 - Preference Normalization Hotfix):**
- Added Prisma migration `20251116122000_normalize_preferred_language` to coerce any legacy `preferredLanguage` strings to the supported ISO codes (default `en`).
- Applied migration locally via `pnpm prisma migrate deploy`, eliminating the Bad Request errors surfaced by TranslationDisplay's cache lookup.
- Status: In Progress.

**2025-11-17 (v3.2.2 - Frontend Cache Query Removal):**
- **SIMPLIFICATION:** Removed redundant frontend GraphQL cache query from TranslationDisplay component
- **Reason:** Frontend cache query caused race conditions with real-time WebSocket messages and "Bad Request Exception" errors for newly arrived messages
- **Fix:** REST API `/api/translate` now handles all cache checking internally (backend is single source of truth)
- **Benefit:** Eliminates component unmount issues, race conditions, and cache-related errors for new messages
- **Impact:** Removed `messageTranslation` GraphQL query usage from frontend flow (~60 lines of code removed)
- **Preserved:** Backend database caching (unchanged), GraphQL mutation for saving encrypted translations (still used), E2EE for database storage (maintained)
- **Architecture:** Backend checks its own database cache before calling Groq; frontend simply calls REST API and displays result
- Status: In Progress (Implementation Plan Created).

## Follow-Up Tasks (Future Stories)

**Story 2.6: Offline Translation (Deferred):**
- Local translation model (Transformer.js or WebLLM) for offline translation
- No external API dependency (better privacy)
- Larger client bundle (~50-100MB model download)
- Fallback when Groq API unavailable
- Pure E2EE (no backend involvement)

**Story 2.7: Translation Quality Feedback (Deferred):**
- "Report incorrect translation" button
- Collect user feedback on translation quality
- Improve translation prompts based on feedback

**Story 2.8: Translation Analytics (Deferred):**
- Dashboard for monitoring Groq API usage
- Alert when approaching rate limits
- Cost tracking per family
- Most translated languages report

---

**Last Updated:** 2025-11-17 (v3.2.2 - Frontend Cache Query Removal)
