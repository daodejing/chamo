# Product Requirements Document (PRD)
## OurChat - Private Family Collaboration Platform

**Version:** 1.0
**Date:** 2025-10-13
**Author:** Nick
**Status:** Draft

---

## Executive Summary

OurChat is a privacy-first family collaboration platform that combines real-time messaging, photo sharing, and family calendar management in a single, easy-to-use application. Built with end-to-end encryption (E2EE) and designed for non-tech-savvy users, OurChat provides families with a secure, private alternative to mainstream communication tools without sacrificing features or usability.

**Key Differentiators:**
- End-to-end encrypted messages and photos
- Transparent privacy (E2EE works seamlessly without user intervention)
- Family-centric features (calendar, photo albums, multi-channel chat)
- Multi-language support with real-time translation (20+ languages)
- Free tier hosting architecture (sustainable at family scale)

**Target Launch:** MVP for single family use, with path to multi-tenant SaaS

---

## 1. Problem Statement

### The Problem
Families want private, secure communication but existing solutions have significant drawbacks:

- **Big Tech Platforms** (WhatsApp, Messenger): Privacy concerns, data mining, complex features overwhelming for older users
- **Signal/Telegram**: Focused on messaging only, lack family-specific features (calendar, organized photo albums)
- **Google/Apple Ecosystems**: Lock-in, not cross-platform, missing privacy controls

### The Opportunity
Build a purpose-built family platform that:
1. Prioritizes privacy without complexity
2. Integrates family-specific features in one place
3. Works seamlessly across web and mobile
4. Remains sustainable on free/low-cost infrastructure

---

## 2. Goals & Success Criteria

### Primary Goals

**Phase 1 - MVP (Single Family):**
- ✅ Family of 4-10 can communicate privately with E2EE
- ✅ All prototype features functional (messaging, photos, calendar)
- ✅ Works on web and mobile browsers
- ✅ Runs on free tier hosting

**Phase 2 - Multi-Tenant SaaS:**
- ✅ Support 50-100 families
- ✅ Self-service onboarding
- ✅ Scalable infrastructure (still cost-effective)

### Success Metrics

**User Experience:**
- Message delivery < 2 seconds (95th percentile)
- Photo upload < 5 seconds for 10MB photo
- Zero E2EE-related user confusion (transparent encryption)
- App usable by users aged 10-80+ without training

**Technical:**
- 99.5% uptime for MVP
- < $50/month hosting costs for Phase 1
- E2EE verification: 100% of messages/photos encrypted at rest

**Engagement:**
- Daily active usage by 80%+ of family members
- 10+ messages per family per day
- 5+ photos uploaded per family per week

---

## 3. Target Users

### Primary Persona: "Family Member"

**Demographics:**
- Age: 10-80+ years old
- Tech Proficiency: Low to moderate
- Relationship: Immediate or extended family members

**Needs:**
- Simple, intuitive communication with family
- Share photos and memories easily
- Coordinate family events and schedules
- Privacy from big tech surveillance

**Pain Points:**
- Overwhelmed by complex apps with too many features
- Worried about privacy but doesn't understand encryption
- Forgets to check multiple apps for family updates
- Struggles with tech troubleshooting

**Use Cases:**
- Daily check-ins and casual conversation
- Sharing meal photos, family outings
- Planning birthdays, reunions, appointments
- Staying connected across distance/time zones

### Secondary Persona: "Family Admin"

**Demographics:**
- Age: 25-50 years old
- Tech Proficiency: Moderate to high
- Role: Sets up and manages family account

**Needs:**
- Easy setup process
- Ability to invite and manage family members
- Confidence that family's data is secure
- Low maintenance (set it and forget it)

---

## 4. Functional Requirements

### FR-1: Authentication & Authorization

**FR-1.1** Users must authenticate via email + invite code
**FR-1.2** Family admin generates invite codes for new members
**FR-1.3** System supports admin and member roles
**FR-1.4** Admin can remove family members
**FR-1.5** Sessions persist across browser restarts
**FR-1.6** Logout clears local session data

### FR-2: Multi-Channel Messaging

**FR-2.1** Support multiple chat channels per family (e.g., "General", "School", custom)
**FR-2.2** Users can send, edit, and delete their own messages
**FR-2.3** Messages display sender name, avatar, and timestamp
**FR-2.4** Messages are delivered in real-time to all online family members
**FR-2.5** Message history persists and syncs across devices
**FR-2.6** Edited messages display "(edited)" indicator
**FR-2.7** All messages are end-to-end encrypted before storage

**FR-2.8 Scheduled Messages:**
- Users can schedule messages for future delivery
- View list of scheduled messages
- Cancel scheduled messages before delivery
- System sends scheduled messages at specified time

**FR-2.9 Real-Time Translation:**
- Messages display in sender's language
- Recipients see translated version below original (in their preferred language)
- Support 20+ languages: en, ja, es, fr, de, zh, ko, pt, ru, ar, it, nl, pl, tr, vi, th, id, hi, sv, no
- Auto-detects source language (user doesn't specify what language message is in)
- Translation happens transparently (no manual action required)

### FR-3: Photo Sharing & Organization

**FR-3.1** Users can upload photos with captions
**FR-3.2** Photos are end-to-end encrypted before storage
**FR-3.3** Photos organized into folders (custom and predefined)
**FR-3.4** Support folder operations: create, rename, delete, move photos
**FR-3.5** Users can like photos (see who liked)
**FR-3.6** Users can comment on photos with threaded discussions
**FR-3.7** Display photo metadata: uploader, timestamp
**FR-3.8** Support image formats: JPEG, PNG, HEIC
**FR-3.9** Photo grid view and detail view

### FR-4: Family Calendar & Events

**FR-4.1** Users can create calendar events with title, description, date, time
**FR-4.2** Support all-day events and timed events
**FR-4.3** Events display on calendar view (month/week/day)
**FR-4.4** Users can edit and delete their own events
**FR-4.5** Event colors customizable per user
**FR-4.6** Event reminders configurable (minutes before event)
**FR-4.7** System sends browser notifications for reminders

**FR-4.8 Google Calendar Integration:**
- Users can connect their Google Calendar via OAuth
- Two-way sync: Import Google events, export app events
- Manual and auto-sync options
- Display last sync time
- Disconnect Google Calendar option

### FR-5: Family Management

**FR-5.1** Admin can set family name and avatar
**FR-5.2** Admin can configure max family members (default: 10)
**FR-5.3** Display list of all family members with roles and join dates
**FR-5.4** Admin can remove members (with confirmation)
**FR-5.5** Members can view but not modify family settings

### FR-6: User Preferences & Settings

**FR-6.1** Toggle dark mode / light mode
**FR-6.2** Adjust font size: small, medium, large (accessibility)
**FR-6.3** Switch UI language: Japanese, English (controls app interface)
**FR-6.3a** Set preferred translation language: 20+ languages (controls message translation target)
**FR-6.4** All UI text and labels respect UI language setting

**FR-6.5 Quiet Hours:**
- Enable/disable quiet hours
- Set start and end time (e.g., 22:00 - 07:00)
- Block message sending during quiet hours (with toast notification)
- Calendar reminders respect quiet hours

**FR-6.6** User profile: name, email, avatar (view and edit)

### FR-7: Channel Management

**FR-7.1** Admin can create custom channels (name, description, icon)
**FR-7.2** Admin can delete custom channels
**FR-7.3** Default channels: "General" (cannot be deleted)
**FR-7.4** Channel descriptions support i18n (language-aware)
**FR-7.5** Users switch between channels seamlessly

---

## 5. Non-Functional Requirements

### NFR-1: Security & Privacy

**NFR-1.1** All messages encrypted end-to-end before transmission
**NFR-1.2** All photos encrypted end-to-end before storage
**NFR-1.3** Encryption keys never leave client devices
**NFR-1.4** Server cannot decrypt user content (zero-knowledge architecture)
**NFR-1.5** OAuth tokens stored securely (encrypted at rest)
**NFR-1.6** HTTPS/TLS for all client-server communication
**NFR-1.7** No third-party analytics or tracking (privacy-first)

### NFR-2: Performance

**NFR-2.1** Message delivery: < 2 seconds end-to-end (p95)
**NFR-2.2** Photo upload: < 5 seconds for 10MB photo (p95)
**NFR-2.3** Photo load: < 3 seconds for thumbnail grid
**NFR-2.4** Calendar render: < 1 second for month view
**NFR-2.5** Real-time updates: < 500ms perceived latency
**NFR-2.6** App initial load: < 3 seconds on 4G connection

### NFR-3: Usability

**NFR-3.1** Zero-training requirement for basic usage (send message, view photos)
**NFR-3.2** All E2EE operations transparent to user (no manual key exchange)
**NFR-3.3** Error messages in plain language (no technical jargon)
**NFR-3.4** Responsive design: works on mobile (320px+), tablet, desktop
**NFR-3.5** Accessibility: WCAG 2.1 Level AA compliance
**NFR-3.6** Keyboard navigation support

### NFR-4: Reliability

**NFR-4.1** 99.5% uptime for MVP (single family)
**NFR-4.2** Graceful degradation: offline mode for viewing cached content
**NFR-4.3** Message delivery guaranteed (store-and-forward if recipient offline)
**NFR-4.4** No data loss on client crashes
**NFR-4.5** Automatic reconnection on network interruption

### NFR-5: Scalability

**NFR-5.1** Support 10 concurrent users per family (MVP)
**NFR-5.2** Support 1,000 messages per day per family
**NFR-5.3** Support 100GB photo storage per family
**NFR-5.4** Architecture scales to 100 families (Phase 2)

### NFR-6: Cost & Operations

**NFR-6.1** MVP hosting costs < $50/month (free tier preferred)
**NFR-6.2** Database costs scale linearly with usage
**NFR-6.3** No vendor lock-in (can migrate providers)
**NFR-6.4** Infrastructure as code (reproducible deployments)
**NFR-6.5** Monitoring and logging for ops visibility

### NFR-7: Compatibility

**NFR-7.1** Web: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
**NFR-7.2** Mobile web: iOS Safari 14+, Chrome Android 90+
**NFR-7.3** PWA support for installable app experience
**NFR-7.4** No native app requirement for MVP

---

## 6. Epics & User Stories

### Epic 1: User Onboarding & Authentication

**Priority:** Critical (MVP Blocker)
**Story Points:** 8

**User Stories:**

**US-1.1** As a family admin, I want to create a family account so that I can invite my family members
**Acceptance Criteria:**
- Admin provides family name, email, and password
- System generates unique invite code
- Admin receives confirmation

**US-1.2** As a family member, I want to join using an invite code so that I can access my family's chat
**Acceptance Criteria:**
- Member enters email + invite code
- System validates code and creates account
- Member redirected to chat screen

**US-1.3** As a user, I want my session to persist so that I don't have to log in every time
**Acceptance Criteria:**
- Session tokens stored securely in browser
- Auto-login on app revisit (if session valid)
- Logout clears session

---

### Epic 2: Multi-Channel Messaging

**Priority:** Critical (MVP Blocker)
**Story Points:** 13

**User Stories:**

**US-2.1** As a family member, I want to send messages in different channels so that I can organize conversations by topic
**Acceptance Criteria:**
- Select channel from channel list
- Type message and send
- Message appears in correct channel for all members

**US-2.2** As a family member, I want to edit my messages so that I can correct typos
**Acceptance Criteria:**
- Long-press or right-click own message
- Edit message text
- Message shows "(edited)" indicator
- All members see updated message

**US-2.3** As a family member, I want to delete my messages so that I can remove mistakes
**Acceptance Criteria:**
- Long-press or right-click own message
- Confirm deletion
- Message removed for all members
- Toast notification confirms deletion

**US-2.4** As a family member, I want to schedule messages so that I can send birthday wishes at the right time
**Acceptance Criteria:**
- Click "Schedule" button
- Pick date and time
- Message queued
- System sends message at scheduled time
- Can view and cancel scheduled messages

**US-2.5** As a family member, I want to see messages translated to my preferred language so that I can understand messages from relatives who speak different languages
**Acceptance Criteria:**
- Message displays in sender's original language
- Translation appears below original (in my preferred language from settings)
- Supports 20+ languages (auto-detects source language)
- Translation accurate for common phrases
- No manual translation action required

---

### Epic 3: Photo Sharing & Albums

**Priority:** High (MVP)
**Story Points:** 13

**User Stories:**

**US-3.1** As a family member, I want to upload photos with captions so that I can share memories
**Acceptance Criteria:**
- Click upload button
- Select photo from device
- Add optional caption
- Photo appears in selected folder
- All family members can view

**US-3.2** As a family member, I want to organize photos into folders so that I can find them easily
**Acceptance Criteria:**
- Create custom folders with names and icons
- Move photos between folders
- View photos filtered by folder
- Delete empty folders

**US-3.3** As a family member, I want to like and comment on photos so that I can engage with shared memories
**Acceptance Criteria:**
- Click heart to like photo
- See count and names of likers
- Add text comments
- Comments threaded under photo

**US-3.4** As a family member, I want photos to load quickly so that browsing is smooth
**Acceptance Criteria:**
- Thumbnail grid loads < 3 seconds
- Lazy loading for large albums
- Full-size image loads on click < 2 seconds

---

### Epic 4: Family Calendar

**Priority:** High (MVP)
**Story Points:** 13

**User Stories:**

**US-4.1** As a family member, I want to create calendar events so that everyone knows about family activities
**Acceptance Criteria:**
- Click date on calendar
- Enter event title, description, time
- Select all-day or timed event
- Event appears on family calendar

**US-4.2** As a family member, I want to set reminders so that I don't forget important events
**Acceptance Criteria:**
- Enable reminder when creating event
- Choose minutes before event (15, 30, 60)
- System sends browser notification at reminder time
- Reminders respect quiet hours

**US-4.3** As a family member, I want to sync with Google Calendar so that I have one source of truth
**Acceptance Criteria:**
- Connect Google account via OAuth
- Import Google events into app
- Create events that sync to Google
- Manual sync button + auto-sync option
- Disconnect option clears sync

---

### Epic 5: Settings & Customization

**Priority:** Medium (MVP)
**Story Points:** 8

**User Stories:**

**US-5.1** As a family member, I want to enable dark mode so that the app is easier on my eyes at night
**Acceptance Criteria:**
- Toggle dark/light mode in settings
- Theme persists across sessions
- All screens respect theme

**US-5.2** As an older family member, I want to increase font size so that I can read messages easily
**Acceptance Criteria:**
- Select small/medium/large font size
- All text scales proportionally
- Layout remains usable at large sizes

**US-5.3** As a family member, I want to set quiet hours so that I'm not disturbed during sleep
**Acceptance Criteria:**
- Enable quiet hours in settings
- Set start and end time
- App blocks message sending during quiet hours
- Clear toast message explains why send is blocked

**US-5.4** As a family member, I want to customize language settings so that the app feels natural and I can read messages in my preferred language
**Acceptance Criteria:**
- Switch UI language in settings (Japanese/English for MVP)
- Switch preferred translation language (20+ languages: en, ja, es, fr, de, zh, ko, pt, ru, ar, it, nl, pl, tr, vi, th, id, hi, sv, no)
- All UI text, labels, buttons respect UI language setting
- Message translations respect preferred translation language setting
- Date/time formats localized based on UI language
- Language changes take effect immediately (no page reload)

---

### Epic 6: Family & Channel Management

**Priority:** Medium (MVP)
**Story Points:** 5

**User Stories:**

**US-6.1** As a family admin, I want to invite new members so that I can grow my family group
**Acceptance Criteria:**
- Generate new invite codes
- Share codes via any method
- View list of pending invites
- Revoke unused codes

**US-6.2** As a family admin, I want to remove members so that I can manage who has access
**Acceptance Criteria:**
- View list of all members
- Select member and remove (with confirmation)
- Removed member loses access immediately
- Messages/photos from removed member remain

**US-6.3** As a family admin, I want to create custom channels so that we can organize conversations
**Acceptance Criteria:**
- Create channel with name, description, icon
- All members can see new channel
- Delete custom channels (not "General")
- Messages in deleted channels are archived

---

### Epic 7: End-to-End Encryption (Infrastructure)

**Priority:** Critical (MVP Blocker)
**Story Points:** 13

**User Stories:**

**US-7.1** As a privacy-conscious user, I want all messages encrypted so that only my family can read them
**Acceptance Criteria:**
- Messages encrypted before leaving device
- Server stores only ciphertext
- Decryption happens only on recipient devices
- No manual key management required

**US-7.2** As a privacy-conscious user, I want all photos encrypted so that my memories are private
**Acceptance Criteria:**
- Photos encrypted before upload
- Object storage contains only ciphertext
- Decryption happens in browser
- Thumbnails also encrypted

**US-7.3** As a developer, I want encryption to be transparent so that users don't notice it
**Acceptance Criteria:**
- No loading delays from encryption/decryption
- No UI indicators of encryption process
- Error messages don't expose crypto details
- Backup/sync works seamlessly

---

### Epic 8: Production Deployment & CI/CD

**Priority:** High (Infrastructure)
**Story Points:** 8

**User Stories:**

**US-8.1** As a developer, I want automated CI/CD pipeline so that code changes are tested and deployed automatically
**Acceptance Criteria:**
- GitHub Actions runs all tests on every PR
- PRs blocked from merging if tests fail
- Successful merges to main trigger staging deployment
- Database migrations applied automatically
- Health checks verify deployment success
- Deployment logs retained for 30 days
- Basic uptime monitoring alerts team

---

## 7. Technical Constraints

### Architecture

**Hybrid Backend-First:**
- All features require backend (messages, photos, calendar)
- WebSocket for real-time messaging
- HTTPS REST API for photo upload/download
- Uniform experience for all users (no feature gating by network topology)

**Optional P2P Enhancement (Phase 2):**
- WebRTC Data Channels for lower-latency messaging
- STUN servers for NAT traversal (use public free servers)
- Fallback to WebSocket if P2P fails
- TURN server deferred to voice/video phase (not MVP)

### Hosting & Infrastructure

**Free Tier Constraints:**
- Supabase Free: 500MB DB + 1GB storage + Auth + Realtime
- Vercel Free: Serverless functions + static hosting
- Neon Free: PostgreSQL (3 projects, 0.5GB each)
- Cloudflare R2: 10GB free storage (photos)

**Scalability Path:**
- Start on free tiers for single family
- Migrate to paid tiers ($10-50/month) for multi-family
- Use serverless to minimize fixed costs

### Technology Stack

**Frontend:**
- React 18 (already prototyped)
- Vite (build tool)
- shadcn/ui + Radix UI (component library)
- TailwindCSS (styling)

**Backend:**
- To be determined in architecture phase
- Requirements: WebSocket support, serverless-friendly, TypeScript
- Candidates: Vercel Functions, Supabase Edge Functions, Next.js API routes

**Database:**
- PostgreSQL (Supabase or Neon)
- Requirements: JSON support, full-text search, real-time subscriptions

**Object Storage:**
- Cloudflare R2 or S3-compatible
- Requirements: client-side encryption support, presigned URLs

**Encryption:**
- Web Crypto API (browser native)
- Library: TweetNaCl or libsodium.js
- Algorithm: XChaCha20-Poly1305 or AES-256-GCM

---

## 8. Out of Scope (Phase 2+)

The following features are explicitly deferred to future phases:

### Phase 2 Features:
- Voice calling (WebRTC media channels)
- Video calling
- Screen sharing
- Message reactions (emoji)
- Message threads/replies
- File attachments (non-image)
- Voice messages
- Desktop notifications (push)
- Native mobile apps (iOS/Android)

### Phase 3 Features:
- Multi-family SaaS (self-service signup)
- Payment processing (subscription)
- Admin dashboard (multi-tenant management)
- Advanced analytics
- Export/backup tools
- End-to-end encrypted backup to personal cloud

### Explicitly Not In Scope:
- Public social features (no public profiles, no friend requests)
- Cross-family messaging
- Bots or automation
- AI features (summarization, smart replies)
- Blockchain/crypto features

---

## 9. Dependencies & Risks

### External Dependencies

**Third-Party Services:**
- Google OAuth API (calendar integration)
- Google Calendar API (sync)
- STUN servers (NAT traversal) - free public servers
- Translation API (or embedded model)

**Risks:**
- Google API quota limits for free tier
- Public STUN servers may be unreliable
- Translation quality for family-specific language

**Mitigation:**
- Cache Google Calendar data to reduce API calls
- Fallback translation service or offline model
- Monitor STUN server health, add backups

### Technical Risks

**Risk 1: E2EE Performance on Low-End Devices**
- Encryption/decryption may slow down older phones
- Mitigation: Optimize crypto library, test on target devices, async encryption

**Risk 2: Free Tier Limits Hit Earlier Than Expected**
- User growth exceeds free tier quotas
- Mitigation: Monitor usage closely, plan migration path, implement soft limits

**Risk 3: WebSocket Connection Stability**
- Mobile browsers may kill background connections
- Mitigation: Implement reconnection logic, fallback to polling, use service workers

**Risk 4: Browser Crypto API Compatibility**
- Older browsers may lack Web Crypto support
- Mitigation: Polyfill or graceful degradation, require modern browsers (documented)

---

## 10. Success Metrics (Revisited)

### Launch Criteria (MVP)

**Functional Completeness:**
- ✅ All Epic 1-7 user stories implemented
- ✅ All FRs and NFRs met (or documented exceptions)
- ✅ E2EE verified (messages and photos encrypted)
- ✅ Prototype screens functional in production

**Quality Gates:**
- ✅ Zero critical bugs
- ✅ < 5 high-priority bugs
- ✅ Performance benchmarks met (NFR-2)
- ✅ Security audit passed (E2EE, OAuth, storage)

**User Validation:**
- ✅ Tested with real family (4+ members, ages 10-70+)
- ✅ Non-tech-savvy users can send message without help
- ✅ All users report "feels private and secure"

### Post-Launch Metrics (3 Months)

**Engagement:**
- 80%+ daily active users
- 10+ messages per family per day
- 5+ photos per family per week
- 5+ calendar events per family per month

**Technical:**
- 99.5% uptime
- < $50/month hosting costs
- < 2 second message delivery (p95)
- Zero E2EE failures

**Satisfaction:**
- NPS > 50
- < 5% churn rate
- User reports "easier than WhatsApp" for family use

---

## Appendix A: Prototype Screens

The frontend prototype defines the complete UI/UX:

**Location:** `/Users/usr0101345/projects/ourchat/frontend-proto/`

**Key Files:**
- `src/App.tsx` - Main application state and logic
- `src/components/login-screen.tsx` - Authentication UI
- `src/components/chat-screen.tsx` - Main messaging interface
- `src/components/settings-screen.tsx` - Settings and preferences

**Screens Implemented:**
1. Login Screen (email + invite code)
2. Chat Screen (messages, channels, photos, calendar tabs)
3. Settings Screen (profile, family, preferences, integrations)

**UI Components:**
- shadcn/ui component library (Radix UI primitives)
- Dark/light theme support
- Responsive layouts (mobile-first)
- Accessible (keyboard navigation, ARIA labels)

---

## Appendix B: Data Models

### User
```typescript
{
  id: string (UUID)
  email: string (unique)
  name: string
  avatar: string (URL or base64)
  role: "admin" | "member"
  familyId: string (FK)
  joinedAt: timestamp
  publicKey: string (E2EE)
  preferences: UserPreferences (JSONB)
}
```

### UserPreferences
```typescript
{
  theme: "light" | "dark"
  fontSize: "small" | "medium" | "large"
  uiLanguage: "en" | "ja"                    // App interface language
  preferredLanguage: TranslationLanguage      // Message translation target
  quietHoursEnabled: boolean
  quietHoursStart: string                     // "HH:MM" format
  quietHoursEnd: string                       // "HH:MM" format
}

type TranslationLanguage =
  | "en"  // English
  | "ja"  // Japanese
  | "es"  // Spanish
  | "fr"  // French
  | "de"  // German
  | "zh"  // Chinese (Simplified)
  | "ko"  // Korean
  | "pt"  // Portuguese
  | "ru"  // Russian
  | "ar"  // Arabic
  | "it"  // Italian
  | "nl"  // Dutch
  | "pl"  // Polish
  | "tr"  // Turkish
  | "vi"  // Vietnamese
  | "th"  // Thai
  | "id"  // Indonesian
  | "hi"  // Hindi
  | "sv"  // Swedish
  | "no"  // Norwegian
```

### Message
```typescript
{
  id: string (UUID)
  channelId: string (FK)
  userId: string (FK)
  encryptedContent: string (ciphertext)
  timestamp: timestamp
  isEdited: boolean
  editedAt: timestamp | null
}
```

### Photo
```typescript
{
  id: string (UUID)
  folderId: string (FK)
  userId: string (FK)
  encryptedUrl: string (S3 object key)
  encryptedCaption: string
  uploadedAt: timestamp
  likes: string[] (user IDs)
  comments: PhotoComment[]
}
```

### CalendarEvent
```typescript
{
  id: string (UUID)
  familyId: string (FK)
  userId: string (FK - creator)
  title: string
  description: string
  date: date
  startTime: time
  endTime: time
  allDay: boolean
  reminder: boolean
  reminderMinutes: int
  color: string (hex)
  googleEventId: string | null
}
```

### Family
```typescript
{
  id: string (UUID)
  name: string
  avatar: string
  maxMembers: int
  inviteCode: string (unique)
  createdAt: timestamp
  createdBy: string (user ID)
}
```

### Channel
```typescript
{
  id: string (UUID)
  familyId: string (FK)
  name: string (i18n key)
  description: string (i18n key)
  icon: string (emoji)
  createdAt: timestamp
  createdBy: string (user ID)
  isDefault: boolean
}
```

---

## Appendix C: Architecture Principles

### Guiding Principles

1. **Privacy First, Always**
   - E2EE is non-negotiable for messages and photos
   - Zero-knowledge architecture (server cannot decrypt)
   - No third-party analytics or tracking

2. **Simplicity Over Features**
   - Every feature must justify its complexity
   - Remove features that confuse non-tech users
   - Invisible encryption (no manual key management)

3. **Family-Scale Economics**
   - Design for 10 concurrent users, not 10,000
   - Leverage free tiers where possible
   - Avoid premature optimization

4. **Progressive Enhancement**
   - Core features work without P2P (WebSocket baseline)
   - P2P optimization is enhancement, not requirement
   - Graceful degradation for offline/poor network

5. **Boring Technology**
   - Use proven tools (PostgreSQL, React, WebCrypto)
   - Avoid bleeding-edge frameworks
   - Minimize dependencies

---

## Document History

| Version | Date       | Author | Changes                          |
|---------|------------|--------|----------------------------------|
| 1.0     | 2025-10-13 | Nick   | Initial PRD based on prototype   |

---

**Next Steps:**
1. ✅ PRD Review & Approval
2. ⏳ Create project-workflow-analysis.md (project level, field type, scale assessment)
3. ⏳ Run solution architecture workflow
4. ⏳ Generate per-epic tech specs
5. ⏳ Begin Epic 1: User Onboarding & Authentication

**Questions or Feedback:** Contact Nick
