# Solution Architecture
## OurChat - Private Family Collaboration Platform

**Version:** 1.0
**Date:** 2025-10-13
**Architect:** Winston (BMAD)
**Status:** Draft

---

## Executive Summary

OurChat is a privacy-first family collaboration platform built on modern, cost-effective infrastructure. The architecture prioritizes **simplicity** and **user experience** over theoretical security perfection, using a shared family key E2EE model that provides strong privacy guarantees while remaining completely transparent to non-technical users.

**Key Architectural Decisions:**
- **Monolithic full-stack** (Next.js 15 App Router) for MVP simplicity
- **Supabase** for integrated backend services (PostgreSQL + Realtime + Storage + Auth)
- **Shared Family Key E2EE** (AES-256-GCM) for transparent encryption
- **Groq API** (client-direct) for privacy-preserving LLM translation
- **Vercel** for zero-config deployment

**Infrastructure Costs:** $0/month (free tiers) for MVP, scales to ~$20-50/month for 100 families.

---

## 1. Technology Stack

### Frontend

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| **React** | 19.2.0 | UI framework | Latest stable, performance improvements, Server Components |
| **Next.js** | 15.x | Full-stack framework | App Router, API routes, SSR, optimal DX |
| **TypeScript** | 5.6.x | Type safety | Catch errors at compile time, better IDE support |
| **TailwindCSS** | 3.4.x | Styling | Utility-first, responsive, prototyped UI |
| **shadcn/ui** | Latest | Component library | Accessible Radix UI primitives, customizable |
| **Radix UI** | Latest | Headless components | WCAG compliant, keyboard navigation |
| **React Hook Form** | 7.55.x | Form management | Performant, validation, already in prototype |
| **date-fns** | 4.1.x | Date utilities | Lightweight, i18n support for calendar |
| **Sonner** | 2.0.x | Toast notifications | Already in prototype |

### Backend & Services

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| **Supabase** | Latest | Backend platform | PostgreSQL + Realtime + Storage + Auth integrated |
| **PostgreSQL** | 15.x | Database | Supabase managed, JSON support, full-text search |
| **Supabase Realtime** | Latest | WebSocket layer | Real-time message delivery, presence |
| **Supabase Storage** | Latest | Object storage | 1GB free, S3-compatible, presigned URLs |
| **Supabase Auth** | Latest | Authentication | JWT, invite code custom logic |

### External Services

| Service | Purpose | Free Tier | Rationale |
|---------|---------|-----------|-----------|
| **Groq API** | LLM translation | Generous | Fast inference, client-direct, Llama 3.1 70B |
| **Google OAuth** | Calendar integration | Free | Standard OAuth 2.0, Google Calendar API |
| **Google STUN** | NAT traversal (Phase 2) | Free | `stun.l.google.com:19302` |

### Encryption & Security

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| **Web Crypto API** | Native | Encryption primitives | Browser native, no external lib needed |
| **AES-256-GCM** | Standard | Symmetric encryption | Web Crypto built-in, AEAD, fast |
| **PBKDF2** | Standard | Key derivation | Derive keys from invite code |
| **bcrypt** | 5.1.x | Password hashing | Server-side auth (if needed) |

### Development & Deployment

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| **Vercel** | Latest | Hosting | Zero-config Next.js deployment, free tier |
| **pnpm** | 9.x | Package manager | Fast, efficient, monorepo support |
| **ESLint** | 9.x | Linting | Code quality |
| **Prettier** | 3.x | Formatting | Consistent style |
| **Vitest** | 2.x | Testing | Fast, Vite-compatible |

---

## 2. System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Devices                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Browser    │  │   Browser    │  │   Browser    │          │
│  │  (Mobile)    │  │  (Desktop)   │  │   (Tablet)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
│                     [Client-Side E2EE]                           │
│                 (Encrypt before send,                            │
│                  decrypt after receive)                          │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Vercel (Next.js App)                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Next.js 15 App Router                                    │  │
│  │  ┌──────────────────┐  ┌──────────────────┐              │  │
│  │  │   /app (Pages)   │  │  /api (Routes)   │              │  │
│  │  │  - /login        │  │  - /api/messages │              │  │
│  │  │  - /chat         │  │  - /api/photos   │              │  │
│  │  │  - /settings     │  │  - /api/calendar │              │  │
│  │  └──────────────────┘  └──────────────────┘              │  │
│  │  ┌────────────────────────────────────────┐              │  │
│  │  │  /lib (Business Logic)                 │              │  │
│  │  │  - supabase client/server              │              │  │
│  │  │  - e2ee (family key management)        │              │  │
│  │  │  - groq (translation proxy)            │              │  │
│  │  │  - google (calendar OAuth)             │              │  │
│  │  └────────────────────────────────────────┘              │  │
│  └───────────────────────────────────────────────────────────┘  │
└───────────────┬────────────────────┬────────────────────────────┘
                │                    │
                │ PostgreSQL         │ Storage API
                ▼                    ▼
┌───────────────────────────┐  ┌────────────────────────────┐
│   Supabase PostgreSQL     │  │   Supabase Storage         │
│  ┌──────────────────────┐ │  │  ┌──────────────────────┐  │
│  │  Tables:             │ │  │  │  Encrypted Photos    │  │
│  │  - users             │ │  │  │  (AES-256-GCM blob)  │  │
│  │  - families          │ │  │  │                      │  │
│  │  - messages          │ │  │  │  family_id/          │  │
│  │  - photos            │ │  │  │    photo_id.enc      │  │
│  │  - calendar_events   │ │  │  └──────────────────────┘  │
│  │  - channels          │ │  │                            │
│  │  - ...               │ │  │  Presigned URLs for        │
│  └──────────────────────┘ │  │  secure upload/download    │
│                           │  └────────────────────────────┘
│  Supabase Realtime        │
│  ┌──────────────────────┐ │
│  │  WebSocket Channels  │ │
│  │  - messages:*        │ │
│  │  - presence:*        │ │
│  └──────────────────────┘ │
└───────────────────────────┘

External Services (Client-Direct):
┌──────────────────────┐      ┌──────────────────────────┐
│   Groq API           │      │   Google Calendar API    │
│   (LLM Translation)  │      │   (OAuth + Sync)         │
│   - Llama 3.1 70B    │      │   - Read/Write events    │
│   - Client-direct    │      │   - OAuth 2.0 PKCE       │
└──────────────────────┘      └──────────────────────────┘
```

### Data Flow Examples

#### Message Send Flow (E2EE)

```
1. User types message in /chat
2. Client encrypts message with family key (AES-256-GCM)
   plaintext → ciphertext
3. Client sends POST /api/messages { encryptedContent, channelId }
4. Next.js API route validates, stores in PostgreSQL (ciphertext only)
5. Supabase Realtime broadcasts to channel subscribers
6. Other clients receive encrypted message
7. Each client decrypts with family key
   ciphertext → plaintext
8. Display in UI
```

#### Photo Upload Flow (E2EE)

```
1. User selects photo from device
2. Client encrypts photo blob with family key (AES-256-GCM)
   photoBlob → encryptedBlob
3. Client requests presigned upload URL from /api/photos/upload
4. Client uploads encrypted blob directly to Supabase Storage
5. Client sends POST /api/photos { storageUrl, encryptedCaption, ... }
6. Server stores metadata in PostgreSQL
7. Other clients fetch metadata, download encrypted blob
8. Decrypt blob client-side, display
```

#### Translation Flow (Client-Direct, Privacy-Preserving)

```
1. User sends message (already encrypted and stored)
2. Client decrypts message (plaintext only in client memory)
3. Client reads user's preferred language from settings (preferences.preferredLanguage)
4. Groq/Llama auto-detects message source language:
   a. Client calls Groq API directly (no server proxy)
   b. Send plaintext to Groq: "Translate to {preferredLanguage}: {message}"
   c. Groq returns translation (supports 20+ languages: en, ja, es, fr, de, zh, ko, pt, ru, ar, it, nl, pl, tr, vi, th, id, hi, sv, no)
   d. If translation differs from original, display translation below original (not stored)
5. Server never sees plaintext or translation
```

---

## 3. Database Schema

### Tables

#### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar TEXT, -- URL or base64 data URI
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member')),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  encrypted_family_key TEXT NOT NULL, -- Family key encrypted with user's key
  preferences JSONB DEFAULT '{}', -- { theme, fontSize, uiLanguage, preferredLanguage, quietHours }
  google_calendar_token TEXT, -- Encrypted OAuth token
  google_calendar_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_family_id ON users(family_id);
CREATE INDEX idx_users_email ON users(email);
```

#### families
```sql
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  avatar TEXT,
  invite_code VARCHAR(50) UNIQUE NOT NULL, -- Format: CODE-XXXX-YYYY
  max_members INTEGER DEFAULT 10,
  created_by UUID NOT NULL, -- user_id
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_families_invite_code ON families(invite_code);
```

#### messages
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL, -- AES-256-GCM ciphertext
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
```

#### scheduled_messages
```sql
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_messages_scheduled_time ON scheduled_messages(scheduled_time);
CREATE INDEX idx_scheduled_messages_status ON scheduled_messages(status);
```

#### photos
```sql
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL REFERENCES photo_folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- Supabase Storage path: family_id/photo_id.enc
  encrypted_caption TEXT, -- AES-256-GCM ciphertext
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  likes JSONB DEFAULT '[]', -- Array of user_ids
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photos_folder_id ON photos(folder_id);
CREATE INDEX idx_photos_uploaded_at ON photos(uploaded_at DESC);
```

#### photo_comments
```sql
CREATE TABLE photo_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_comment TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photo_comments_photo_id ON photo_comments(photo_id);
```

#### photo_folders
```sql
CREATE TABLE photo_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(10), -- Emoji
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_default BOOLEAN DEFAULT FALSE -- "All Photos" folder
);

CREATE INDEX idx_photo_folders_family_id ON photo_folders(family_id);
```

#### calendar_events
```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN DEFAULT FALSE,
  reminder BOOLEAN DEFAULT FALSE,
  reminder_minutes INTEGER, -- 15, 30, 60
  color VARCHAR(7), -- Hex color
  google_event_id VARCHAR(255), -- For sync
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_family_id ON calendar_events(family_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(date);
```

#### channels
```sql
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- i18n key or custom name
  description TEXT,
  icon VARCHAR(10), -- Emoji
  created_by UUID NOT NULL REFERENCES users(id),
  is_default BOOLEAN DEFAULT FALSE, -- "General" channel
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_channels_family_id ON channels(family_id);
```

### Row Level Security (RLS) Policies

**Enable RLS on all tables:**

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- ... (enable for all tables)

-- Example policy: Users can only see data from their family
CREATE POLICY "Users can read their family's messages"
  ON messages FOR SELECT
  USING (
    channel_id IN (
      SELECT id FROM channels WHERE family_id = (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );
```

---

## 4. API Design

### REST API Endpoints (Next.js API Routes)

#### Authentication

```typescript
POST /api/auth/register
Body: { email, familyName, password }
Response: { user, family, inviteCode }

POST /api/auth/join
Body: { email, inviteCode, password }
Response: { user, family }

POST /api/auth/logout
Response: { success: true }

GET /api/auth/session
Response: { user, family }
```

#### Messages

```typescript
GET /api/messages?channelId={uuid}&limit=50&before={timestamp}
Response: { messages: Message[] }

POST /api/messages
Body: { channelId, encryptedContent }
Response: { message: Message }

PATCH /api/messages/:id
Body: { encryptedContent }
Response: { message: Message }

DELETE /api/messages/:id
Response: { success: true }
```

#### Scheduled Messages

```typescript
GET /api/scheduled-messages
Response: { scheduledMessages: ScheduledMessage[] }

POST /api/scheduled-messages
Body: { channelId, encryptedContent, scheduledTime }
Response: { scheduledMessage: ScheduledMessage }

DELETE /api/scheduled-messages/:id
Response: { success: true }
```

#### Photos

```typescript
GET /api/photos?folderId={uuid}&limit=50&offset=0
Response: { photos: Photo[] }

POST /api/photos/upload-url
Body: { fileName, fileSize }
Response: { uploadUrl, storagePath }

POST /api/photos
Body: { folderId, storagePath, encryptedCaption }
Response: { photo: Photo }

DELETE /api/photos/:id
Response: { success: true }

POST /api/photos/:id/like
Response: { photo: Photo }

POST /api/photos/:id/comments
Body: { encryptedComment }
Response: { comment: PhotoComment }
```

#### Calendar

```typescript
GET /api/calendar/events?startDate={date}&endDate={date}
Response: { events: CalendarEvent[] }

POST /api/calendar/events
Body: { title, description, date, startTime, ... }
Response: { event: CalendarEvent }

PATCH /api/calendar/events/:id
Body: { title, ... }
Response: { event: CalendarEvent }

DELETE /api/calendar/events/:id
Response: { success: true }
```

#### Google Calendar

```typescript
GET /api/google/auth
Response: { authUrl }

GET /api/google/callback?code={code}
Response: { success: true }

POST /api/google/sync
Response: { events: CalendarEvent[], newEventsCount }

DELETE /api/google/disconnect
Response: { success: true }
```

#### Family Management

```typescript
GET /api/family
Response: { family: Family, members: User[] }

PATCH /api/family
Body: { name, avatar, maxMembers }
Response: { family: Family }

POST /api/family/invite-code
Response: { inviteCode }

DELETE /api/family/members/:id
Response: { success: true }
```

#### Channels

```typescript
GET /api/channels
Response: { channels: Channel[] }

POST /api/channels
Body: { name, description, icon }
Response: { channel: Channel }

DELETE /api/channels/:id
Response: { success: true }
```

### Supabase Realtime Channels

**Subscribe to real-time updates:**

```typescript
// Messages
supabase
  .channel(`messages:${channelId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `channel_id=eq.${channelId}`
  }, (payload) => {
    // New message received (encrypted)
    const newMessage = payload.new;
    decryptAndDisplay(newMessage);
  })
  .subscribe();

// Presence (online users)
supabase
  .channel(`presence:family:${familyId}`)
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    // Update online users list
  })
  .subscribe();
```

---

## 5. End-to-End Encryption Implementation

### Shared Family Key Model

**Architecture Decision:** Use a single symmetric key per family for simplicity and transparency.

#### Key Generation & Distribution

```typescript
// 1. Family creation (admin)
async function createFamily(familyName: string, adminEmail: string) {
  // Generate 256-bit family key
  const familyKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // Export key as raw bytes
  const rawKey = await crypto.subtle.exportKey('raw', familyKey);
  const base64Key = btoa(String.fromCharCode(...new Uint8Array(rawKey)));

  // Generate invite code
  const inviteCode = `FAMILY-${generateRandomCode(8)}`;

  // Store invite code + base64 key mapping (server)
  await supabase.from('families').insert({
    name: familyName,
    invite_code: inviteCode,
    created_by: adminId
  });

  // Store encrypted family key for admin
  await supabase.from('users').update({
    encrypted_family_key: base64Key // In production: encrypt this with user's password-derived key
  }).eq('id', adminId);

  return { inviteCode: `${inviteCode}:${base64Key}` }; // Format: CODE:KEY
}

// 2. Family join (member)
async function joinFamily(inviteCode: string) {
  // Parse invite code
  const [code, base64Key] = inviteCode.split(':');

  // Import family key
  const rawKey = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  const familyKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // Store encrypted family key for this user
  await supabase.from('users').update({
    encrypted_family_key: base64Key
  }).eq('id', userId);

  // Store key in IndexedDB (client-side)
  await idb.set('familyKey', familyKey);

  return { familyKey };
}
```

#### Encryption & Decryption

```typescript
// lib/e2ee/encryption.ts

async function encryptMessage(plaintext: string, familyKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV (96 bits for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    familyKey,
    data
  );

  // Combine IV + ciphertext + auth tag (all in ciphertext buffer)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Encode as base64
  return btoa(String.fromCharCode(...combined));
}

async function decryptMessage(encrypted: string, familyKey: CryptoKey): Promise<string> {
  // Decode base64
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

  // Extract IV and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    familyKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

async function encryptFile(blob: Blob, familyKey: CryptoKey): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    familyKey,
    arrayBuffer
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return new Blob([combined], { type: 'application/octet-stream' });
}

async function decryptFile(encryptedBlob: Blob, familyKey: CryptoKey): Promise<Blob> {
  const combined = new Uint8Array(await encryptedBlob.arrayBuffer());
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    familyKey,
    ciphertext
  );

  // Detect original MIME type from first bytes (magic numbers)
  const mimeType = detectMimeType(new Uint8Array(plaintext));
  return new Blob([plaintext], { type: mimeType });
}
```

#### Key Storage (Client-Side)

```typescript
// Store family key in IndexedDB (persists across sessions)
import { openDB } from 'idb';

const db = await openDB('ourchat', 1, {
  upgrade(db) {
    db.createObjectStore('keys');
  }
});

// Store
await db.put('keys', familyKey, 'familyKey');

// Retrieve
const familyKey = await db.get('keys', 'familyKey');

// Clear on logout
await db.delete('keys', 'familyKey');
```

#### Security Properties

**What's Protected:**
- ✅ Messages encrypted at rest (server stores ciphertext only)
- ✅ Photos encrypted at rest (object storage has ciphertext only)
- ✅ Server cannot read user content (zero-knowledge)
- ✅ Man-in-the-middle attacks mitigated (HTTPS + E2EE)

**What's NOT Protected:**
- ⚠️ Metadata (sender, timestamp, channel) visible to server
- ⚠️ Forward secrecy (old messages compromised if key leaked)
- ⚠️ Malicious server can inject keys (but requires compromising Vercel/Supabase)
- ⚠️ Members removed from family can still decrypt old messages (no key rotation in MVP)

**Acceptable for Family Use Case:** Yes - family members trust each other, server compromise unlikely for self-hosted infrastructure.

---

## 6. Security Architecture

### Threat Model

**In Scope:**
- External attackers intercepting network traffic
- Database breach (attacker gains access to PostgreSQL)
- Object storage breach (attacker gains access to S3)
- Compromised third-party services (e.g., Groq sees plaintext during translation)

**Out of Scope (MVP):**
- Malicious family members
- Compromised Vercel or Supabase infrastructure
- Nation-state attackers
- Quantum computing attacks

### Security Measures

#### Transport Security
- ✅ HTTPS/TLS 1.3 for all client-server communication
- ✅ HSTS enabled (Strict-Transport-Security header)
- ✅ Certificate pinning (automatic via Vercel)

#### Authentication & Authorization
- ✅ Supabase Auth (JWT-based)
- ✅ Password hashing: bcrypt (10 rounds)
- ✅ Session management: HTTP-only cookies
- ✅ CSRF protection: SameSite=Strict cookies
- ✅ Row Level Security (RLS) on all Supabase tables

#### Input Validation
- ✅ Client-side: React Hook Form validation
- ✅ Server-side: Zod schemas on API routes
- ✅ SQL injection: Parameterized queries (Supabase client)
- ✅ XSS: React auto-escaping + Content Security Policy

#### Rate Limiting
- ✅ Vercel edge functions rate limiting
- ✅ Supabase rate limiting (default: 100 req/min)
- ✅ Groq API rate limiting (free tier: ~30 req/min)

#### Secrets Management
- ✅ Environment variables (Vercel secrets)
- ✅ No secrets in client code (except Groq API key - rate-limited)
- ✅ Supabase service role key server-side only

#### Content Security Policy (CSP)

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      font-src 'self' data:;
      connect-src 'self' https://*.supabase.co https://api.groq.com;
      frame-ancestors 'none';
    `.replace(/\s{2,}/g, ' ').trim()
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
];
```

---

## 7. Deployment Architecture

### Infrastructure Overview

```
Production Environment:

┌──────────────────────────────────────────────────┐
│  Cloudflare CDN (Optional - Vercel has built-in) │
│  - Global edge caching                            │
│  - DDoS protection                                │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  Vercel Edge Network                              │
│  ┌────────────────────────────────────────────┐  │
│  │  Next.js 15 App (Serverless Functions)    │  │
│  │  - Automatic scaling                       │  │
│  │  - Edge runtime for API routes            │  │
│  │  - Static assets (CDN distributed)        │  │
│  └────────────────────────────────────────────┘  │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  Supabase (us-east-1 or nearest region)          │
│  ┌────────────────────────────────────────────┐  │
│  │  PostgreSQL 15 (Managed)                   │  │
│  │  - Auto backups (daily)                    │  │
│  │  - Point-in-time recovery                  │  │
│  │  - Connection pooling (PgBouncer)          │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │  Supabase Realtime (WebSocket)             │  │
│  │  - Pub/sub channels                        │  │
│  │  - Presence tracking                       │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │  Supabase Storage (S3-compatible)          │  │
│  │  - 1GB free tier                           │  │
│  │  - CDN delivery                            │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Environment Configuration

#### Development
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx... # Server-side only
NEXT_PUBLIC_GROQ_API_KEY=gsk_xxx # Client-side (rate-limited)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=xxx
```

#### Production
```bash
# Vercel Environment Variables (set in dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://prod.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
NEXT_PUBLIC_GROQ_API_KEY=gsk_xxx
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
NEXTAUTH_URL=https://ourchat.app
NEXTAUTH_SECRET=xxx
```

### Deployment Pipeline

```yaml
# Automated via Vercel GitHub integration

git push origin main
  ↓
Vercel detects push
  ↓
Build Next.js app
  - pnpm install
  - pnpm build
  - Run type checks
  - Run linting
  ↓
Deploy to preview (auto-generated URL)
  ↓
Run smoke tests (optional)
  ↓
Promote to production (manual approval)
  ↓
Deploy to ourchat.app
  ↓
Invalidate CDN cache
  ↓
Notify team (Slack/Discord webhook)
```

### Monitoring & Observability

#### Metrics
- **Vercel Analytics:** Page views, Core Web Vitals, API latency
- **Supabase Metrics:** Database queries, connection pool, storage usage
- **Custom Metrics:** E2EE operations (encrypt/decrypt timing)

#### Logging
- **Vercel Logs:** Function invocations, errors, cold starts
- **Supabase Logs:** Database queries, auth events
- **Client-side:** Sentry (optional) for frontend errors

#### Alerts
- **Uptime:** Vercel auto-alerts on deployment failures
- **Database:** Supabase alerts on connection pool exhaustion
- **Budget:** AWS Cost Alerts if exceeding free tier

---

## 8. Proposed Source Tree

```
ourchat/                          # Monorepo root
├── .github/
│   └── workflows/
│       ├── ci.yml                # GitHub Actions CI
│       └── deploy.yml            # Deployment automation
├── public/                       # Static assets
│   ├── icons/                    # App icons (PWA)
│   └── images/                   # Static images
├── src/
│   ├── app/                      # Next.js 15 App Router
│   │   ├── (auth)/               # Auth route group
│   │   │   ├── login/
│   │   │   │   └── page.tsx      # Login screen
│   │   │   └── layout.tsx        # Auth layout
│   │   ├── (dashboard)/          # Main app route group
│   │   │   ├── chat/
│   │   │   │   └── page.tsx      # Chat screen
│   │   │   ├── settings/
│   │   │   │   └── page.tsx      # Settings screen
│   │   │   └── layout.tsx        # Dashboard layout
│   │   ├── api/                  # API routes
│   │   │   ├── auth/
│   │   │   │   ├── register/route.ts
│   │   │   │   ├── join/route.ts
│   │   │   │   └── logout/route.ts
│   │   │   ├── messages/
│   │   │   │   ├── route.ts      # GET, POST
│   │   │   │   └── [id]/route.ts # PATCH, DELETE
│   │   │   ├── photos/
│   │   │   │   ├── route.ts
│   │   │   │   ├── upload-url/route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts  # DELETE
│   │   │   │       ├── like/route.ts
│   │   │   │       └── comments/route.ts
│   │   │   ├── calendar/
│   │   │   │   ├── events/route.ts
│   │   │   │   └── events/[id]/route.ts
│   │   │   ├── google/
│   │   │   │   ├── auth/route.ts
│   │   │   │   ├── callback/route.ts
│   │   │   │   ├── sync/route.ts
│   │   │   │   └── disconnect/route.ts
│   │   │   ├── family/
│   │   │   │   ├── route.ts
│   │   │   │   ├── invite-code/route.ts
│   │   │   │   └── members/[id]/route.ts
│   │   │   └── channels/
│   │   │       ├── route.ts
│   │   │       └── [id]/route.ts
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Redirect to /login or /chat
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   └── ... (all shadcn components)
│   │   ├── chat/
│   │   │   ├── message-bubble.tsx
│   │   │   ├── message-input.tsx
│   │   │   ├── channel-selector.tsx
│   │   │   └── translation-display.tsx
│   │   ├── photos/
│   │   │   ├── photo-grid.tsx
│   │   │   ├── photo-detail.tsx
│   │   │   ├── folder-selector.tsx
│   │   │   └── photo-upload.tsx
│   │   ├── calendar/
│   │   │   ├── calendar-view.tsx
│   │   │   ├── event-form.tsx
│   │   │   └── google-sync-panel.tsx
│   │   └── settings/
│   │       ├── profile-section.tsx
│   │       ├── family-section.tsx
│   │       └── preferences-section.tsx
│   ├── lib/                      # Business logic & utilities
│   │   ├── supabase/
│   │   │   ├── client.ts         # Browser client
│   │   │   ├── server.ts         # Server client (cookies)
│   │   │   └── middleware.ts     # Auth middleware
│   │   ├── e2ee/
│   │   │   ├── encryption.ts     # Encrypt/decrypt functions
│   │   │   ├── key-management.ts # Family key handling
│   │   │   └── storage.ts        # IndexedDB key storage
│   │   ├── groq/
│   │   │   └── translation.ts    # LLM translation client
│   │   ├── google/
│   │   │   ├── oauth.ts          # OAuth flow
│   │   │   └── calendar-sync.ts  # Calendar API calls
│   │   ├── utils/
│   │   │   ├── cn.ts             # Tailwind class merger
│   │   │   ├── date.ts           # Date formatting
│   │   │   └── validators.ts     # Zod schemas
│   │   └── hooks/
│   │       ├── use-family-key.ts # Get family key from IDB
│   │       ├── use-realtime.ts   # Supabase Realtime hook
│   │       └── use-translation.ts # LLM translation hook
│   ├── types/
│   │   ├── database.ts           # Supabase generated types
│   │   ├── api.ts                # API request/response types
│   │   └── index.ts              # Shared types
│   └── middleware.ts             # Next.js middleware (auth)
├── supabase/                     # Supabase config
│   ├── migrations/               # SQL migrations
│   │   └── 001_initial_schema.sql
│   ├── seed.sql                  # Dev seed data
│   └── config.toml               # Supabase config
├── tests/
│   ├── unit/                     # Vitest unit tests
│   ├── integration/              # API integration tests
│   └── e2e/                      # Playwright E2E tests
├── .env.local.example            # Example env vars
├── .eslintrc.json                # ESLint config
├── .prettierrc                   # Prettier config
├── next.config.js                # Next.js config
├── package.json                  # Dependencies
├── pnpm-lock.yaml                # Lock file
├── tsconfig.json                 # TypeScript config
├── tailwind.config.ts            # Tailwind config
├── components.json               # shadcn/ui config
└── README.md                     # Project README
```

---

## 9. Architecture Decision Records (ADRs)

### ADR-001: Next.js 15 App Router vs Pages Router

**Status:** Accepted

**Context:** Need to choose Next.js routing approach.

**Decision:** Use App Router (not Pages Router).

**Rationale:**
- App Router is the recommended approach (stable in Next.js 15)
- React Server Components improve performance
- Better data fetching patterns
- File-based routing with layouts

**Consequences:**
- Learning curve for App Router patterns
- Some libraries may not be fully compatible yet
- Better long-term maintainability

---

### ADR-002: Shared Family Key vs Signal Protocol

**Status:** Accepted

**Context:** Need E2EE that's transparent to non-tech users.

**Decision:** Use Shared Family Key (AES-256-GCM), not Signal Protocol or Megolm.

**Rationale:**
- **Simplicity:** ~100 LOC vs 500+ LOC
- **UX:** Zero user friction (no device verification)
- **Sufficient security:** Server can't decrypt, good enough for family trust model
- **Acceptable tradeoffs:** No forward secrecy acceptable for family use case

**Consequences:**
- Key compromise = all messages compromised
- Member removal requires key rotation (Phase 2 feature)
- Cannot claim "Signal-level security" in marketing

**Alternative Considered:** Simplified Megolm with auto-trust - rejected due to complexity.

---

### ADR-003: Supabase vs Self-Hosted PostgreSQL + Socket.IO

**Status:** Accepted

**Context:** Need database, realtime, storage, and auth.

**Decision:** Use Supabase (integrated platform).

**Rationale:**
- **Velocity:** All services in one platform
- **Cost:** Free tier sufficient for MVP
- **Maintenance:** Managed services reduce ops burden
- **DX:** Excellent TypeScript SDK

**Consequences:**
- Vendor lock-in (mitigated by standard PostgreSQL)
- Supabase Realtime less mature than Socket.IO
- Storage limited to 1GB free tier (migrate to Proton Drive if needed)

**Alternative Considered:** Neon + Socket.IO + Cloudflare R2 - rejected for MVP simplicity.

---

### ADR-004: Groq API (Client-Direct) vs Server-Mediated Translation

**Status:** Accepted

**Context:** Need LLM translation without breaking E2EE.

**Decision:** Client calls Groq API directly (not via server).

**Rationale:**
- **Privacy:** Server never sees plaintext or translations
- **Latency:** Direct connection is faster
- **Cost:** Groq free tier generous

**Consequences:**
- Groq API key exposed in client (mitigated by rate limiting)
- Clients must handle Groq errors directly
- Network failures visible to users

**Alternative Considered:** Server proxy with temp tokens - adds complexity without security benefit.

---

### ADR-005: Monorepo vs Polyrepo

**Status:** Accepted

**Context:** Need repository structure for frontend + backend.

**Decision:** Monorepo (single repo).

**Rationale:**
- **Simplicity:** Frontend + backend tightly coupled for MVP
- **Velocity:** Share types, easier refactoring
- **Deployment:** Vercel deploys monorepo seamlessly

**Consequences:**
- Cannot scale to microservices without restructuring
- Acceptable for MVP (can migrate to polyrepo in Phase 2 if needed)

---

## 10. Cost Analysis

### Free Tier Limits (MVP - Single Family)

| Service | Free Tier | Usage Estimate | Cost |
|---------|-----------|----------------|------|
| **Vercel** | 100GB bandwidth, serverless functions | ~5GB/month | $0 |
| **Supabase Database** | 500MB, 2GB RAM | ~50MB | $0 |
| **Supabase Storage** | 1GB | ~200MB (photos) | $0 |
| **Supabase Realtime** | Unlimited connections | 10 concurrent | $0 |
| **Groq API** | ~30 req/min free tier | ~50 translations/day | $0 |
| **Google Calendar API** | 10k req/day | ~50 req/day | $0 |
| **Total** | | | **$0/month** |

### Scaling Costs (Phase 2 - 100 Families)

| Service | Paid Tier | Usage Estimate | Cost |
|---------|-----------|----------------|------|
| **Vercel Pro** | Unlimited bandwidth | ~500GB/month | $20/month |
| **Supabase Pro** | 8GB DB, 100GB storage | ~2GB DB, 20GB storage | $25/month |
| **Groq API** | Pay-per-token | ~5k translations/day | ~$5/month |
| **Total** | | | **~$50/month** |

### Break-Even Analysis

- **Cost per family (100 families):** $0.50/month
- **Potential pricing:** $5/month per family
- **Margin:** 90% (sustainable SaaS)

---

## 11. Scaling Strategy

### Vertical Scaling (Single Instance Growth)

**Capacity:**
- 100 families = 1,000 users
- 10k messages/day
- 100GB photo storage
- Supabase Pro tier handles this comfortably

**Optimization:**
- Enable PostgreSQL connection pooling (PgBouncer)
- Implement Redis caching for frequently accessed data (Phase 3)
- Use Supabase Edge Functions for API routes (reduce latency)

### Horizontal Scaling (Multi-Region, Phase 3)

**When:**
- > 1,000 families
- Global user base (latency issues)

**Approach:**
- Multi-region Supabase (US, EU, APAC)
- Cloudflare Workers for edge API routes
- Regional read replicas for PostgreSQL

---

## 12. Migration & Future-Proofing

### From Shared Family Key to Advanced E2EE (Phase 2+)

**If needed (e.g., for paranoid users or marketing):**

1. **Add optional Megolm layer:**
   - Shared Family Key remains for backwards compat
   - Users opt-in to "Advanced Security Mode"
   - Enable device verification UI (hidden by default)

2. **Dual-encryption mode:**
   - New messages use Megolm (forward secrecy)
   - Old messages stay with Shared Family Key
   - Gradual migration over time

**Why deferred:** MVP users don't need this complexity.

---

### From Supabase to Self-Hosted (Phase 3+)

**If needed (vendor lock-in concerns, cost optimization):**

1. **Supabase is standard PostgreSQL:**
   - Dump database: `pg_dump`
   - Migrate to any PostgreSQL provider (Neon, Railway, RDS)

2. **Supabase Storage is S3-compatible:**
   - Migrate photos to AWS S3, Cloudflare R2, Backblaze B2

3. **Supabase Realtime replacement:**
   - Switch to Socket.IO + Redis
   - Client-side code changes minimal

**Migration effort:** ~1 week for experienced team.

---

## Appendix A: Technology Selection Rationale

### Why React 19.2.0?
- Latest stable release (October 2025)
- Performance improvements over React 18
- Better concurrent features
- Strong ecosystem

### Why Next.js 15?
- Best-in-class React framework
- App Router mature and recommended
- Vercel deployment zero-config
- Strong TypeScript support

### Why Supabase?
- Integrated platform (DB + Storage + Auth + Realtime)
- Excellent free tier for MVP
- Open source (PostgreSQL, PostgREST)
- Great DX (TypeScript SDK, auto-generated types)

### Why Shared Family Key E2EE?
- **UX over paranoia:** Non-tech users prioritized
- **Good enough security:** Server can't decrypt
- **Simple implementation:** ~100 LOC
- **Upgradeable:** Can add Megolm in Phase 2

### Why Groq API?
- **Fast inference:** Llama 3.1 70B, low latency
- **Privacy-preserving:** Client-direct connection
- **Free tier:** Generous limits
- **Fallback option:** Can switch to Cloudflare Workers AI

---

## Appendix B: Deployment Checklist

### Pre-Launch

- [ ] Set up Supabase project
- [ ] Create database schema (run migrations)
- [ ] Enable Row Level Security (RLS) policies
- [ ] Set up Supabase Storage buckets
- [ ] Create Vercel project
- [ ] Configure environment variables (production)
- [ ] Set up custom domain (ourchat.app)
- [ ] Enable HTTPS (automatic via Vercel)
- [ ] Configure CSP headers
- [ ] Set up Groq API key (client-side, rate-limited)
- [ ] Set up Google OAuth credentials
- [ ] Test E2EE encryption/decryption flows
- [ ] Run security audit (OWASP Top 10)
- [ ] Test with real family (5+ users, different devices)
- [ ] Monitor performance (Core Web Vitals)
- [ ] Set up error tracking (Sentry optional)
- [ ] Document deployment process (README)

### Post-Launch

- [ ] Monitor Vercel Analytics
- [ ] Monitor Supabase metrics (DB, Storage, Realtime)
- [ ] Set up uptime monitoring (UptimeRobot, StatusCake)
- [ ] Set up cost alerts (Vercel, Supabase)
- [ ] Collect user feedback
- [ ] Plan Phase 2 features (voice/video, advanced E2EE)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-13 | Winston | Initial architecture based on PRD, tech research, and stakeholder input |

---

**Next Steps:**
1. ✅ Architecture approved by Nick
2. ⏳ Generate Architecture Decision Records (detailed ADRs)
3. ⏳ Create per-epic tech specs
4. ⏳ Set up development environment
5. ⏳ Begin Epic 1: User Onboarding & Authentication

**Questions or Feedback:** Contact Nick or Winston (BMAD Architect)
