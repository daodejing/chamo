# Epic Alignment Matrix
## OurChat - Architecture Component Mapping

**Version:** 1.0
**Date:** 2025-10-13
**Purpose:** Maps each epic and user story to specific architecture components, ensuring complete coverage and traceability.

---

## Epic 1: User Onboarding & Authentication

**Priority:** Critical | **Story Points:** 8 | **Readiness:** ✅ 100%

| User Story | Architecture Components | Database Tables | API Routes | Libraries/Services |
|------------|------------------------|-----------------|------------|-------------------|
| **US-1.1** Create family account | `lib/supabase/server.ts`<br>`lib/e2ee/key-management.ts` | `families`<br>`users` | `POST /api/auth/register` | Supabase Auth<br>Web Crypto API |
| **US-1.2** Join via invite code | `components/(auth)/login/page.tsx`<br>`lib/e2ee/encryption.ts` | `families`<br>`users` | `POST /api/auth/join` | Supabase Auth<br>IndexedDB (idb) |
| **US-1.3** Session persistence | `middleware.ts`<br>`lib/supabase/middleware.ts` | N/A | `GET /api/auth/session`<br>`POST /api/auth/logout` | Supabase Auth (JWT)<br>HTTP-only cookies |

**Component Boundaries:**
- **Frontend:** Login screen (`components/(auth)/login/`)
- **Backend:** API routes (`app/api/auth/`)
- **Database:** `families`, `users` tables with RLS policies
- **Security:** Supabase Auth + family key distribution

---

## Epic 2: Multi-Channel Messaging

**Priority:** Critical | **Story Points:** 13 | **Readiness:** ✅ 100%

| User Story | Architecture Components | Database Tables | API Routes | Libraries/Services |
|------------|------------------------|-----------------|------------|-------------------|
| **US-2.1** Send messages in channels | `components/chat/message-input.tsx`<br>`lib/e2ee/encryption.ts`<br>`lib/hooks/use-realtime.ts` | `messages`<br>`channels` | `POST /api/messages`<br>`GET /api/messages?channelId=...` | Supabase Realtime<br>AES-256-GCM |
| **US-2.2** Edit messages | `components/chat/message-bubble.tsx` | `messages` | `PATCH /api/messages/:id` | Supabase Realtime |
| **US-2.3** Delete messages | `components/chat/message-bubble.tsx` | `messages` | `DELETE /api/messages/:id` | Supabase Realtime |
| **US-2.4** Schedule messages | `components/chat/message-input.tsx` | `scheduled_messages` | `POST /api/scheduled-messages`<br>`GET /api/scheduled-messages`<br>`DELETE /api/scheduled-messages/:id` | Vercel Cron (or serverless scheduler) |
| **US-2.5** Real-time translation | `components/chat/translation-display.tsx`<br>`lib/groq/translation.ts`<br>`lib/hooks/use-translation.ts` | N/A (client-side only) | N/A (client-direct to Groq) | Groq API (Llama 3.1 70B) |

**Component Boundaries:**
- **Frontend:** Chat screen (`components/chat/`), message components
- **Backend:** Message API routes (`app/api/messages/`), scheduled message cron job
- **Database:** `messages`, `scheduled_messages`, `channels` tables
- **Real-time:** Supabase Realtime WebSocket channels
- **External:** Groq API (client-direct, no server proxy)

---

## Epic 3: Photo Sharing & Albums

**Priority:** High | **Story Points:** 13 | **Readiness:** ✅ 100%

| User Story | Architecture Components | Database Tables | API Routes | Libraries/Services |
|------------|------------------------|-----------------|------------|-------------------|
| **US-3.1** Upload photos with captions | `components/photos/photo-upload.tsx`<br>`lib/e2ee/encryption.ts` (encryptFile) | `photos`<br>`photo_folders` | `POST /api/photos/upload-url`<br>`POST /api/photos` | Supabase Storage<br>Presigned URLs |
| **US-3.2** Organize photos into folders | `components/photos/folder-selector.tsx` | `photo_folders`<br>`photos` | `POST /api/folders`<br>`PATCH /api/photos/:id` (move) | Supabase PostgreSQL |
| **US-3.3** Like and comment | `components/photos/photo-detail.tsx` | `photos` (likes JSONB)<br>`photo_comments` | `POST /api/photos/:id/like`<br>`POST /api/photos/:id/comments` | Supabase Realtime (optional) |
| **US-3.4** Fast photo loading | `components/photos/photo-grid.tsx` | `photos` | `GET /api/photos?folderId=...&limit=50` | React lazy loading<br>Supabase CDN |

**Component Boundaries:**
- **Frontend:** Photos tab (`components/photos/`), grid and detail views
- **Backend:** Photos API routes (`app/api/photos/`)
- **Database:** `photos`, `photo_folders`, `photo_comments` tables
- **Storage:** Supabase Storage (S3-compatible), encrypted blobs
- **Encryption:** Client-side file encryption/decryption

---

## Epic 4: Family Calendar

**Priority:** High | **Story Points:** 13 | **Readiness:** ✅ 100%

| User Story | Architecture Components | Database Tables | API Routes | Libraries/Services |
|------------|------------------------|-----------------|------------|-------------------|
| **US-4.1** Create calendar events | `components/calendar/event-form.tsx`<br>`components/calendar/calendar-view.tsx` | `calendar_events` | `POST /api/calendar/events`<br>`GET /api/calendar/events?startDate=...` | date-fns<br>react-day-picker |
| **US-4.2** Set reminders | `components/calendar/event-form.tsx` | `calendar_events` (reminder, reminder_minutes) | N/A (client-side cron) | Browser Notification API |
| **US-4.3** Google Calendar sync | `components/calendar/google-sync-panel.tsx`<br>`lib/google/oauth.ts`<br>`lib/google/calendar-sync.ts` | `calendar_events` (google_event_id)<br>`users` (google_calendar_token) | `GET /api/google/auth`<br>`GET /api/google/callback`<br>`POST /api/google/sync`<br>`DELETE /api/google/disconnect` | Google OAuth 2.0<br>Google Calendar API |

**Component Boundaries:**
- **Frontend:** Calendar tab (`components/calendar/`), event forms, sync panel
- **Backend:** Calendar API routes (`app/api/calendar/`), Google OAuth routes (`app/api/google/`)
- **Database:** `calendar_events` table, `users` table (OAuth tokens)
- **External:** Google Calendar API (OAuth PKCE flow)
- **Client-side:** Browser notifications for reminders

---

## Epic 5: Settings & Customization

**Priority:** Medium | **Story Points:** 8 | **Readiness:** ✅ 100%

| User Story | Architecture Components | Database Tables | API Routes | Libraries/Services |
|------------|------------------------|-----------------|------------|-------------------|
| **US-5.1** Dark mode toggle | `components/settings/preferences-section.tsx` | `users` (preferences JSONB) | `PATCH /api/users/:id` | TailwindCSS (dark: classes) |
| **US-5.2** Adjust font size | `components/settings/preferences-section.tsx` | `users` (preferences JSONB) | `PATCH /api/users/:id` | CSS variables |
| **US-5.3** Set quiet hours | `components/settings/preferences-section.tsx`<br>`lib/utils/quiet-hours.ts` | `users` (preferences JSONB) | `PATCH /api/users/:id` | Client-side validation |
| **US-5.4** Switch language | `components/settings/preferences-section.tsx`<br>`lib/i18n/` (to be created) | `users` (preferences JSONB) | `PATCH /api/users/:id` | next-intl or react-i18next |

**Component Boundaries:**
- **Frontend:** Settings screen (`components/settings/`), preferences section
- **Backend:** User API routes (PATCH user preferences)
- **Database:** `users.preferences` JSONB column
- **Theming:** TailwindCSS dark mode, CSS variables for font scaling
- **i18n:** Client-side internationalization library (not detailed in architecture)

---

## Epic 6: Family & Channel Management

**Priority:** Medium | **Story Points:** 5 | **Readiness:** ✅ 100%

| User Story | Architecture Components | Database Tables | API Routes | Libraries/Services |
|------------|------------------------|-----------------|------------|-------------------|
| **US-6.1** Invite new members | `components/settings/family-section.tsx` | `families` | `POST /api/family/invite-code`<br>`GET /api/family` | Supabase Auth (invite links) |
| **US-6.2** Remove members | `components/settings/family-section.tsx` | `users` | `DELETE /api/family/members/:id` | Supabase RLS (admin check) |
| **US-6.3** Create custom channels | `components/settings/family-section.tsx` | `channels` | `POST /api/channels`<br>`DELETE /api/channels/:id` | Supabase PostgreSQL |

**Component Boundaries:**
- **Frontend:** Settings screen (`components/settings/family-section.tsx`)
- **Backend:** Family API routes (`app/api/family/`), channels API (`app/api/channels/`)
- **Database:** `families`, `users`, `channels` tables
- **Authorization:** Supabase RLS policies (admin-only operations)

---

## Epic 7: End-to-End Encryption (Infrastructure)

**Priority:** Critical | **Story Points:** 13 | **Readiness:** ✅ 100%

| User Story | Architecture Components | Database Tables | API Routes | Libraries/Services |
|------------|------------------------|-----------------|------------|-------------------|
| **US-7.1** Encrypted messages | `lib/e2ee/encryption.ts` (encryptMessage, decryptMessage)<br>`lib/e2ee/key-management.ts`<br>`lib/e2ee/storage.ts` | `users` (encrypted_family_key)<br>`messages` (encrypted_content) | All message APIs | Web Crypto API<br>AES-256-GCM<br>IndexedDB (idb) |
| **US-7.2** Encrypted photos | `lib/e2ee/encryption.ts` (encryptFile, decryptFile) | `photos` (storage_path → encrypted blob) | All photo APIs | Web Crypto API<br>Supabase Storage |
| **US-7.3** Transparent encryption | All components (E2EE handled in lib layer) | N/A | N/A | Web Crypto API (async, non-blocking) |

**Component Boundaries:**
- **Core Library:** `lib/e2ee/` (encryption, key management, storage)
- **Database:** All tables with `encrypted_*` columns
- **Client Storage:** IndexedDB for family key persistence
- **Security:** Zero-knowledge architecture (server stores ciphertext only)
- **Shared Family Key Model:** Single symmetric key per family (AES-256-GCM)

---

## Cross-Epic Components

### Core Infrastructure

| Component | Purpose | Used By Epics |
|-----------|---------|---------------|
| **Supabase Client** (`lib/supabase/client.ts`, `lib/supabase/server.ts`) | Database access, auth, storage | All epics |
| **Supabase Realtime** (`lib/hooks/use-realtime.ts`) | WebSocket real-time updates | Epic 2, Epic 3 (comments) |
| **E2EE Library** (`lib/e2ee/`) | Encryption/decryption primitives | Epic 2, Epic 3, Epic 7 |
| **Middleware** (`src/middleware.ts`) | Auth protection, session validation | Epic 1, All protected routes |
| **Zod Validators** (`lib/utils/validators.ts`) | API input validation | All API routes |

### UI Infrastructure

| Component | Purpose | Used By Epics |
|-----------|---------|---------------|
| **shadcn/ui** (`components/ui/`) | Base UI components (buttons, dialogs, inputs) | All epics |
| **TailwindCSS** | Styling, theming, responsive design | All epics |
| **Layout Components** (`app/(dashboard)/layout.tsx`) | Tab navigation, header, settings button | Epic 2-7 |

---

## Readiness Summary

| Epic | Story Count | Ready Stories | Readiness % | Gaps |
|------|-------------|---------------|-------------|------|
| **Epic 1** | 3 | 3 | 100% | None |
| **Epic 2** | 5 | 5 | 100% | None |
| **Epic 3** | 4 | 4 | 100% | None |
| **Epic 4** | 3 | 3 | 100% | None |
| **Epic 5** | 4 | 4 | 100% | Minor: i18n library not specified |
| **Epic 6** | 3 | 3 | 100% | None |
| **Epic 7** | 3 | 3 | 100% | None |
| **TOTAL** | **25** | **25** | **100%** | 1 minor gap |

**Overall Assessment:** ✅ **Architecture is implementation-ready**

All user stories have clear component assignments, database schemas, and API routes defined. The single minor gap (i18n library selection) can be decided during Epic 5 implementation without impacting other epics.

---

## Component Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Components                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │  Login  │  │  Chat   │  │ Photos  │  │Calendar │       │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
│       │            │             │             │            │
│       └────────────┴─────────────┴─────────────┘            │
│                           ↓                                  │
│       ┌───────────────────────────────────────┐             │
│       │     Core Libraries (lib/)             │             │
│       │  - e2ee/                              │             │
│       │  - supabase/                          │             │
│       │  - groq/                              │             │
│       │  - google/                            │             │
│       │  - hooks/                             │             │
│       └─────────┬─────────────────────────────┘             │
└─────────────────┼─────────────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────────────┐
│              Next.js API Routes (app/api/)                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │  Auth   │  │Messages │  │ Photos  │  │Calendar │       │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
│       └────────────┴─────────────┴─────────────┘            │
│                           ↓                                  │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Supabase Platform                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │   Realtime   │  │   Storage    │      │
│  │  (Encrypted  │  │  (WebSocket) │  │  (Encrypted  │      │
│  │   Database)  │  │              │  │    Blobs)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  External Services                           │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  Groq API    │  │ Google APIs  │                         │
│  │ (Translation)│  │  (Calendar)  │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Sequence Recommendation

Based on component dependencies, the recommended implementation order:

### Phase 1: Foundation (Week 1-2)
1. **Epic 7** → E2EE infrastructure (`lib/e2ee/`)
2. **Epic 1** → Authentication (unblocks all other features)

### Phase 2: Core Features (Week 3-4)
3. **Epic 2** → Messaging (validates E2EE + Realtime)
4. **Epic 3** → Photos (validates file encryption + storage)

### Phase 3: Advanced Features (Week 5-6)
5. **Epic 4** → Calendar (includes Google OAuth complexity)
6. **Epic 5** → Settings (depends on preferences from all features)

### Phase 4: Administration (Week 7)
7. **Epic 6** → Family/Channel Management

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-13 | Winston | Initial epic alignment matrix |
