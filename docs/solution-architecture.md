# Solution Architecture
## OurChat - Private Family Collaboration Platform

**Version:** 2.0
**Date:** 2025-10-18
**Architect:** Winston (BMAD)
**Status:** Active - NestJS Architecture

---

## Executive Summary

OurChat is a privacy-first family collaboration platform built on a modern NestJS + GraphQL + MySQL stack. The architecture prioritizes **real-time functionality**, **developer experience**, and **cost efficiency** using free-tier infrastructure.

**Key Architectural Decisions:**
- **NestJS Backend** (modular monolith) with GraphQL API
- **MySQL** (PlanetScale) for database with Prisma ORM
- **GraphQL Subscriptions** over WebSocket for real-time messaging
- **Shared Family Key E2EE** (AES-256-GCM) for transparent encryption
- **Free-tier optimized** ($0/month MVP)

**Infrastructure Costs:** $0/month (free tiers) for MVP, scales to ~$7-12/month for 100 families.

---

## 1. Technology Stack

### Backend

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| **NestJS** | 10.3.0 | Enterprise backend framework | TypeScript-first, modular, GraphQL native support |
| **Apollo Server** | 4.10.0 | GraphQL server | Subscriptions over WebSocket, schema-first |
| **Prisma** | 5.9.0 | ORM | Type-safe MySQL client, migrations, schema management |
| **MySQL** | 8.0 | Database | PlanetScale free tier (5GB), serverless, branching |
| **Bull** | 4.12.0 | Job queue | Redis-backed scheduled message delivery |
| **Upstash Redis** | Latest | Cache/Queue | Serverless Redis, free tier (10k commands/day) |
| **class-validator** | 0.14.x | Validation | DTO validation with decorators |
| **bcrypt** | 5.1.x | Password hashing | Server-side auth security |
| **jsonwebtoken** | 9.0.x | JWT | Authentication tokens |

### Frontend

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| **React** | 19.0.0 | UI framework | Latest stable, performance improvements |
| **Next.js** | 15.0.3 | Full-stack framework | App Router, SSR, optimal DX |
| **Apollo Client** | 3.9.0 | GraphQL client | Subscriptions, normalized cache, React hooks |
| **TypeScript** | 5.6.x | Type safety | Compile-time error detection |
| **TailwindCSS** | 3.4.x | Styling | Utility-first, responsive design |
| **shadcn/ui** | Latest | Component library | Accessible Radix UI primitives |
| **React Hook Form** | 7.65.x | Form management | Performant validation |
| **date-fns** | 4.1.x | Date utilities | Lightweight, i18n support |

### External Services

| Service | Purpose | Free Tier | Rationale |
|---------|---------|-----------|-----------|
| **PlanetScale** | MySQL database | 5GB, 1 billion row reads | Serverless, branching, free forever |
| **Upstash Redis** | Cache & queue | 10k commands/day | Serverless Redis, no ops |
| **Cloudflare R2** | Object storage | 10GB, 1M writes/month | S3-compatible, zero egress fees |
| **Render** | Backend hosting | 750hrs/month free | NestJS deployment, auto-sleep |
| **Vercel** | Frontend hosting | Unlimited bandwidth | Next.js zero-config deployment |
| **Groq API** | LLM translation | Generous free tier | Fast Llama 3.1 70B inference |
| **Google OAuth** | Calendar integration | Free | Standard OAuth 2.0 |

### Development & Deployment

| Technology | Version | Purpose | Rationale |
|------------|---------|---------|-----------|
| **pnpm** | 9.x | Package manager | Monorepo workspaces, fast |
| **Vitest** | 3.x | Testing | Fast unit tests |
| **Playwright** | 1.56.0 | E2E testing | Browser automation |

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
                             │ HTTPS + WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Vercel (Next.js Frontend)                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Next.js 15 App Router                                    │  │
│  │  ┌──────────────────┐  ┌──────────────────┐              │  │
│  │  │   /app (Pages)   │  │  Apollo Client   │              │  │
│  │  │  - /login        │  │  - GraphQL       │              │  │
│  │  │  - /chat         │  │  - Subscriptions │              │  │
│  │  │  - /settings     │  │  - Normalized    │              │  │
│  │  └──────────────────┘  │    Cache         │              │  │
│  │  ┌────────────────────┴───────────────────┘              │  │
│  │  │  /lib (Business Logic)                                │  │
│  │  │  - apollo client setup                                │  │
│  │  │  - e2ee (family key management)                       │  │
│  │  │  - groq (translation)                                 │  │
│  │  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         │ GraphQL over HTTPS/WSS
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Render (NestJS Backend)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  NestJS 10 Application                                    │  │
│  │  ┌──────────────────────────────────────────────────────┐│  │
│  │  │  GraphQL Module (Apollo Server 4)                    ││  │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ ││  │
│  │  │  │   Queries    │  │  Mutations   │  │Subscriptions││ ││  │
│  │  │  │  - messages  │  │  - createMsg │  │ - msgCreated││ ││  │
│  │  │  │  - channels  │  │  - joinFam   │  │ - msgUpdated││ ││  │
│  │  │  │  - family    │  │  - uploadPic │  │ - presence  ││ ││  │
│  │  │  └──────────────┘  └──────────────┘  └────────────┘ ││  │
│  │  └──────────────────────────────────────────────────────┘│  │
│  │  ┌──────────────────────────────────────────────────────┐│  │
│  │  │  Feature Modules                                     ││  │
│  │  │  - AuthModule     (JWT, bcrypt)                      ││  │
│  │  │  - MessagesModule (Prisma, Bull queue)              ││  │
│  │  │  - PhotosModule   (R2 presigned URLs)               ││  │
│  │  │  - CalendarModule (Google OAuth)                    ││  │
│  │  │  - FamilyModule   (Invite codes)                    ││  │
│  │  └──────────────────────────────────────────────────────┘│  │
│  │  ┌──────────────────────────────────────────────────────┐│  │
│  │  │  Prisma ORM                                          ││  │
│  │  │  - Type-safe MySQL client                           ││  │
│  │  │  - Migrations & schema management                   ││  │
│  │  └──────────────────────────────────────────────────────┘│  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────┬──────────────────┬──────────────────┬───────────────┘
           │                  │                  │
           │ MySQL            │ Redis            │ S3 API
           ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────┐  ┌────────────────────┐
│  PlanetScale     │  │  Upstash     │  │  Cloudflare R2     │
│  ┌─────────────┐ │  │  Redis       │  │  ┌──────────────┐  │
│  │  MySQL 8.0  │ │  │  ┌─────────┐ │  │  │   Encrypted  │  │
│  │  - users    │ │  │  │  Cache  │ │  │  │   Photos     │  │
│  │  - families │ │  │  │  Queue  │ │  │  │  (AES-256)   │  │
│  │  - messages │ │  │  │  Jobs   │ │  │  │              │  │
│  │  - photos   │ │  │  └─────────┘ │  │  │  family_id/  │  │
│  │  - channels │ │  │              │  │  │   photo_id   │  │
│  │  - events   │ │  │  Bull Queue: │  │  └──────────────┘  │
│  └─────────────┘ │  │  - scheduled │  │                    │
│                  │  │    messages  │  │  Presigned URLs    │
│  Serverless DB   │  │              │  │  for upload/       │
│  5GB free tier   │  └──────────────┘  │  download          │
└──────────────────┘                    └────────────────────┘

External Services (Client-Direct):
┌──────────────────────┐      ┌──────────────────────────┐
│   Groq API           │      │   Google Calendar API    │
│   (LLM Translation)  │      │   (OAuth + Sync)         │
│   - Llama 3.1 70B    │      │   - Read/Write events    │
│   - Client-direct    │      │   - OAuth 2.0 PKCE       │
└──────────────────────┘      └──────────────────────────┘
```

### Request Flow Examples

#### Message Send Flow (GraphQL Mutation + Subscription)

```
1. User types message in chat UI
2. Client encrypts message with family key (AES-256-GCM)
   plaintext → ciphertext
3. Client sends GraphQL mutation:
   mutation CreateMessage {
     createMessage(channelId: "...", encryptedContent: "...") {
       id timestamp user { name }
     }
   }
4. NestJS MessageResolver validates JWT, calls MessageService
5. Prisma saves encrypted message to MySQL (ciphertext only)
6. GraphQL subscription triggers broadcast to channel subscribers
7. Other clients receive via WebSocket:
   subscription MessageCreated {
     messageCreated(channelId: "...") {
       id encryptedContent timestamp user { name }
     }
   }
8. Each client decrypts with family key
   ciphertext → plaintext
9. Display in UI
```

#### Photo Upload Flow (E2EE + R2 Presigned URLs)

```
1. User selects photo from device
2. Client encrypts photo blob with family key (AES-256-GCM)
   photoBlob → encryptedBlob
3. Client requests presigned upload URL:
   mutation GetUploadUrl {
     getPhotoUploadUrl(fileName: "photo.jpg", fileSize: 1024000) {
       uploadUrl storagePath
     }
   }
4. Client uploads encrypted blob directly to Cloudflare R2
5. Client creates photo record:
   mutation CreatePhoto {
     createPhoto(folderId: "...", storagePath: "...", encryptedCaption: "...") {
       id uploadedAt
     }
   }
6. Server stores metadata in MySQL
7. Other clients fetch metadata via query, download encrypted blob
8. Decrypt blob client-side, display
```

---

## 3. Database Schema (Prisma)

### Prisma Schema File

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  MEMBER
}

enum ScheduledMessageStatus {
  PENDING
  SENT
  CANCELLED
}

model User {
  id                    String            @id @default(uuid())
  email                 String            @unique
  name                  String
  avatar                String?
  role                  Role              @default(MEMBER)
  familyId              String
  family                Family            @relation(fields: [familyId], references: [id], onDelete: Cascade)
  passwordHash          String
  joinedAt              DateTime          @default(now())
  lastSeenAt            DateTime?
  encryptedFamilyKey    String            @db.Text // Family key encrypted with user's key
  publicKey             String            @db.Text // E2EE public key (future)
  preferences           Json              @default("{}")
  googleCalendarToken   String?           @db.Text
  googleCalendarConnected Boolean         @default(false)

  messages              Message[]
  scheduledMessages     ScheduledMessage[]
  photos                Photo[]
  photoComments         PhotoComment[]
  calendarEvents        CalendarEvent[]
  createdChannels       Channel[]
  createdFolders        PhotoFolder[]

  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  @@index([familyId])
  @@index([email])
  @@map("users")
}

model Family {
  id                    String            @id @default(uuid())
  name                  String
  avatar                String?
  inviteCode            String            @unique // Format: CODE-XXXX-YYYY
  maxMembers            Int               @default(10)
  createdBy             String

  users                 User[]
  channels              Channel[]
  photoFolders          PhotoFolder[]
  calendarEvents        CalendarEvent[]

  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  @@index([inviteCode])
  @@map("families")
}

model Channel {
  id                    String            @id @default(uuid())
  familyId              String
  family                Family            @relation(fields: [familyId], references: [id], onDelete: Cascade)
  name                  String
  description           String?           @db.Text
  icon                  String?           @db.VarChar(10) // Emoji
  createdById           String
  createdBy             User              @relation(fields: [createdById], references: [id])
  isDefault             Boolean           @default(false)

  messages              Message[]
  scheduledMessages     ScheduledMessage[]

  createdAt             DateTime          @default(now())

  @@index([familyId])
  @@map("channels")
}

model Message {
  id                    String            @id @default(uuid())
  channelId             String
  channel               Channel           @relation(fields: [channelId], references: [id], onDelete: Cascade)
  userId                String
  user                  User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  encryptedContent      String            @db.Text // AES-256-GCM ciphertext
  timestamp             DateTime          @default(now())
  isEdited              Boolean           @default(false)
  editedAt              DateTime?

  createdAt             DateTime          @default(now())

  @@index([channelId, timestamp])
  @@map("messages")
}

model ScheduledMessage {
  id                    String                  @id @default(uuid())
  userId                String
  user                  User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  channelId             String
  channel               Channel                 @relation(fields: [channelId], references: [id], onDelete: Cascade)
  encryptedContent      String                  @db.Text
  scheduledTime         DateTime
  status                ScheduledMessageStatus  @default(PENDING)

  createdAt             DateTime                @default(now())

  @@index([scheduledTime])
  @@index([status])
  @@map("scheduled_messages")
}

model PhotoFolder {
  id                    String            @id @default(uuid())
  familyId              String
  family                Family            @relation(fields: [familyId], references: [id], onDelete: Cascade)
  name                  String
  icon                  String?           @db.VarChar(10) // Emoji
  createdById           String
  createdBy             User              @relation(fields: [createdById], references: [id])
  isDefault             Boolean           @default(false)

  photos                Photo[]

  createdAt             DateTime          @default(now())

  @@index([familyId])
  @@map("photo_folders")
}

model Photo {
  id                    String            @id @default(uuid())
  folderId              String
  folder                PhotoFolder       @relation(fields: [folderId], references: [id], onDelete: Cascade)
  userId                String
  user                  User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  storagePath           String            // R2 path: family_id/photo_id.enc
  encryptedCaption      String?           @db.Text
  uploadedAt            DateTime          @default(now())
  likes                 Json              @default("[]") // Array of user IDs

  comments              PhotoComment[]

  createdAt             DateTime          @default(now())

  @@index([folderId])
  @@index([uploadedAt])
  @@map("photos")
}

model PhotoComment {
  id                    String            @id @default(uuid())
  photoId               String
  photo                 Photo             @relation(fields: [photoId], references: [id], onDelete: Cascade)
  userId                String
  user                  User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  encryptedComment      String            @db.Text
  timestamp             DateTime          @default(now())

  createdAt             DateTime          @default(now())

  @@index([photoId])
  @@map("photo_comments")
}

model CalendarEvent {
  id                    String            @id @default(uuid())
  familyId              String
  family                Family            @relation(fields: [familyId], references: [id], onDelete: Cascade)
  userId                String
  user                  User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  title                 String
  description           String?           @db.Text
  date                  DateTime          @db.Date
  startTime             DateTime?         @db.Time
  endTime               DateTime?         @db.Time
  allDay                Boolean           @default(false)
  reminder              Boolean           @default(false)
  reminderMinutes       Int?
  color                 String?           @db.VarChar(7) // Hex color
  googleEventId         String?

  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  @@index([familyId])
  @@index([date])
  @@map("calendar_events")
}
```

---

## 4. GraphQL API Schema

### Type Definitions

```graphql
# schema.graphql

scalar DateTime
scalar JSON

type User {
  id: ID!
  email: String!
  name: String!
  avatar: String
  role: Role!
  familyId: ID!
  family: Family!
  joinedAt: DateTime!
  lastSeenAt: DateTime
  preferences: JSON!
  googleCalendarConnected: Boolean!
}

enum Role {
  ADMIN
  MEMBER
}

type Family {
  id: ID!
  name: String!
  avatar: String
  inviteCode: String!
  maxMembers: Int!
  members: [User!]!
  channels: [Channel!]!
  photoFolders: [PhotoFolder!]!
  createdAt: DateTime!
}

type Channel {
  id: ID!
  familyId: ID!
  name: String!
  description: String
  icon: String
  isDefault: Boolean!
  createdBy: User!
  createdAt: DateTime!
}

type Message {
  id: ID!
  channelId: ID!
  channel: Channel!
  userId: ID!
  user: User!
  encryptedContent: String!
  timestamp: DateTime!
  isEdited: Boolean!
  editedAt: DateTime
}

type ScheduledMessage {
  id: ID!
  userId: ID!
  user: User!
  channelId: ID!
  channel: Channel!
  encryptedContent: String!
  scheduledTime: DateTime!
  status: ScheduledMessageStatus!
  createdAt: DateTime!
}

enum ScheduledMessageStatus {
  PENDING
  SENT
  CANCELLED
}

type PhotoFolder {
  id: ID!
  familyId: ID!
  name: String!
  icon: String
  isDefault: Boolean!
  photos: [Photo!]!
  createdAt: DateTime!
}

type Photo {
  id: ID!
  folderId: ID!
  folder: PhotoFolder!
  userId: ID!
  user: User!
  storagePath: String!
  encryptedCaption: String
  uploadedAt: DateTime!
  likes: [ID!]!
  comments: [PhotoComment!]!
}

type PhotoComment {
  id: ID!
  photoId: ID!
  userId: ID!
  user: User!
  encryptedComment: String!
  timestamp: DateTime!
}

type CalendarEvent {
  id: ID!
  familyId: ID!
  userId: ID!
  user: User!
  title: String!
  description: String
  date: DateTime!
  startTime: DateTime
  endTime: DateTime
  allDay: Boolean!
  reminder: Boolean!
  reminderMinutes: Int
  color: String
  googleEventId: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

type AuthResponse {
  user: User!
  family: Family!
  accessToken: String!
  refreshToken: String!
}

type PhotoUploadUrl {
  uploadUrl: String!
  storagePath: String!
}

type Query {
  # Auth
  me: User!

  # Family
  family: Family!

  # Channels
  channels: [Channel!]!
  channel(id: ID!): Channel

  # Messages
  messages(channelId: ID!, limit: Int, before: DateTime): [Message!]!
  scheduledMessages: [ScheduledMessage!]!

  # Photos
  photoFolders: [PhotoFolder!]!
  photos(folderId: ID!, limit: Int, offset: Int): [Photo!]!
  photo(id: ID!): Photo

  # Calendar
  calendarEvents(startDate: DateTime!, endDate: DateTime!): [CalendarEvent!]!
}

type Mutation {
  # Auth
  register(email: String!, familyName: String!, password: String!, name: String!): AuthResponse!
  joinFamily(email: String!, inviteCode: String!, password: String!, name: String!): AuthResponse!
  login(email: String!, password: String!): AuthResponse!
  logout: Boolean!

  # Family
  updateFamily(name: String, avatar: String, maxMembers: Int): Family!
  regenerateInviteCode: Family!
  removeFamilyMember(userId: ID!): Boolean!

  # Channels
  createChannel(name: String!, description: String, icon: String): Channel!
  deleteChannel(id: ID!): Boolean!

  # Messages
  createMessage(channelId: ID!, encryptedContent: String!): Message!
  updateMessage(id: ID!, encryptedContent: String!): Message!
  deleteMessage(id: ID!): Boolean!

  # Scheduled Messages
  scheduleMessage(channelId: ID!, encryptedContent: String!, scheduledTime: DateTime!): ScheduledMessage!
  cancelScheduledMessage(id: ID!): Boolean!

  # Photos
  createPhotoFolder(name: String!, icon: String): PhotoFolder!
  deletePhotoFolder(id: ID!): Boolean!
  getPhotoUploadUrl(fileName: String!, fileSize: Int!): PhotoUploadUrl!
  createPhoto(folderId: ID!, storagePath: String!, encryptedCaption: String): Photo!
  deletePhoto(id: ID!): Boolean!
  likePhoto(id: ID!): Photo!
  createPhotoComment(photoId: ID!, encryptedComment: String!): PhotoComment!

  # Calendar
  createCalendarEvent(title: String!, description: String, date: DateTime!, startTime: DateTime, endTime: DateTime, allDay: Boolean, reminder: Boolean, reminderMinutes: Int, color: String): CalendarEvent!
  updateCalendarEvent(id: ID!, title: String, description: String, date: DateTime, startTime: DateTime, endTime: DateTime, allDay: Boolean, reminder: Boolean, reminderMinutes: Int, color: String): CalendarEvent!
  deleteCalendarEvent(id: ID!): Boolean!

  # Google Calendar
  connectGoogleCalendar(code: String!): Boolean!
  syncGoogleCalendar: Int!
  disconnectGoogleCalendar: Boolean!
}

type Subscription {
  # Messages
  messageCreated(channelId: ID!): Message!
  messageUpdated(channelId: ID!): Message!
  messageDeleted(channelId: ID!): ID!

  # Presence
  userPresence(familyId: ID!): UserPresenceUpdate!
}

type UserPresenceUpdate {
  userId: ID!
  online: Boolean!
  lastSeen: DateTime
}
```

---

## 5. NestJS Architecture

### Monorepo Structure

```
ourchat/
├── apps/
│   ├── backend/                    # NestJS application
│   │   ├── src/
│   │   │   ├── main.ts             # Bootstrap
│   │   │   ├── app.module.ts       # Root module
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.resolver.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── guards/
│   │   │   ├── messages/
│   │   │   │   ├── messages.module.ts
│   │   │   │   ├── messages.resolver.ts
│   │   │   │   ├── messages.service.ts
│   │   │   │   └── dto/
│   │   │   ├── photos/
│   │   │   │   ├── photos.module.ts
│   │   │   │   ├── photos.resolver.ts
│   │   │   │   ├── photos.service.ts
│   │   │   │   └── r2.service.ts
│   │   │   ├── calendar/
│   │   │   │   ├── calendar.module.ts
│   │   │   │   ├── calendar.resolver.ts
│   │   │   │   ├── calendar.service.ts
│   │   │   │   └── google-calendar.service.ts
│   │   │   ├── family/
│   │   │   │   ├── family.module.ts
│   │   │   │   ├── family.resolver.ts
│   │   │   │   └── family.service.ts
│   │   │   ├── channels/
│   │   │   │   ├── channels.module.ts
│   │   │   │   ├── channels.resolver.ts
│   │   │   │   └── channels.service.ts
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.module.ts
│   │   │   │   └── prisma.service.ts
│   │   │   └── common/
│   │   │       ├── decorators/
│   │   │       ├── filters/
│   │   │       └── pipes/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── test/
│   │   ├── .env
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── frontend/                   # Next.js application
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/
│       │   │   │   └── login/page.tsx
│       │   │   ├── (dashboard)/
│       │   │   │   ├── chat/page.tsx
│       │   │   │   └── settings/page.tsx
│       │   │   └── layout.tsx
│       │   ├── components/
│       │   │   ├── ui/             # shadcn/ui
│       │   │   ├── chat/
│       │   │   ├── photos/
│       │   │   └── calendar/
│       │   ├── lib/
│       │   │   ├── apollo/
│       │   │   │   ├── client.ts
│       │   │   │   └── provider.tsx
│       │   │   ├── e2ee/
│       │   │   │   ├── encryption.ts
│       │   │   │   ├── key-management.ts
│       │   │   │   └── storage.ts
│       │   │   ├── groq/
│       │   │   │   └── translation.ts
│       │   │   └── hooks/
│       │   ├── graphql/
│       │   │   ├── queries.ts
│       │   │   ├── mutations.ts
│       │   │   └── subscriptions.ts
│       │   └── middleware.ts
│       ├── public/
│       ├── .env.local
│       ├── next.config.js
│       └── package.json
│
├── packages/
│   ├── shared-types/               # Shared TypeScript types
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   └── eslint-config/
│       └── package.json
│
├── pnpm-workspace.yaml
├── package.json                    # Root package.json
├── tsconfig.json                   # Base TypeScript config
└── README.md
```

### Environment Configuration

#### Backend (.env)

```bash
# Database
DATABASE_URL="mysql://user:password@aws.connect.psdb.cloud/ourchat?sslaccept=strict"

# JWT
JWT_SECRET=your-jwt-secret-here-generate-with-openssl-rand-base64-32
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-refresh-secret-here
REFRESH_TOKEN_EXPIRES_IN=30d

# Redis (Upstash)
REDIS_URL=redis://default:password@regional-endpoint.upstash.io:6379

# Cloudflare R2
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=ourchat-photos
R2_PUBLIC_URL=https://pub-xxxx.r2.dev

# Google OAuth (for Calendar)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# Server
PORT=4000
NODE_ENV=development
```

#### Frontend (.env.local)

```bash
# GraphQL API
NEXT_PUBLIC_GRAPHQL_HTTP_URL=http://localhost:4000/graphql
NEXT_PUBLIC_GRAPHQL_WS_URL=ws://localhost:4000/graphql

# Groq API (client-side translation)
NEXT_PUBLIC_GROQ_API_KEY=gsk_xxx

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com

# Environment
NODE_ENV=development
```

---

## 6. End-to-End Encryption Implementation

(Same as Supabase version - client-side E2EE with shared family key)

See original document sections for:
- Key generation & distribution
- Encryption & decryption (Web Crypto API)
- IndexedDB storage
- Security properties

---

## 7. Security Architecture

### Authentication Flow

```
1. User submits login credentials
2. NestJS AuthResolver validates email/password
3. bcrypt compares password hash
4. Generate JWT access token (7 days) + refresh token (30 days)
5. Return tokens to client
6. Client stores tokens in HTTP-only cookies (set by Next.js API route)
7. Subsequent requests include JWT in Authorization header
8. NestJS JwtAuthGuard validates token on protected resolvers
```

### Authorization

```typescript
// guards/gql-auth.guard.ts
@Injectable()
export class GqlAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();
    return req.user != null; // Populated by JwtStrategy
  }
}

// Usage in resolver
@UseGuards(GqlAuthGuard)
@Query(() => [Message])
async messages(@Args('channelId') channelId: string, @CurrentUser() user: User) {
  // Validate user is in channel's family
  return this.messagesService.findByChannel(channelId, user.familyId);
}
```

---

## 8. Deployment Architecture

### Production Environment

```
Frontend:
┌────────────────────────────────┐
│  Vercel                         │
│  - Next.js 15 SSR              │
│  - Edge functions              │
│  - Global CDN                  │
│  - Auto HTTPS                  │
└────────────────────────────────┘
         │ GraphQL/WSS
         ▼
Backend:
┌────────────────────────────────┐
│  Render                         │
│  - NestJS app                  │
│  - WebSocket support           │
│  - Auto-deploy from Git        │
│  - Free tier: 750hrs/month     │
└────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│ PlanetScale  │  │ Upstash Redis│  │ Cloudflare R2    │
│ MySQL 5GB    │  │ 10k cmds/day │  │ 10GB storage     │
└──────────────┘  └──────────────┘  └──────────────────┘
```

### Deployment Commands

```bash
# Backend (Render auto-deploys on git push)
git push origin main

# Frontend (Vercel auto-deploys)
git push origin main

# Database migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

---

## 9. Architecture Decision Records (ADRs)

### ADR-001: NestJS + GraphQL vs Supabase

**Status:** Accepted

**Context:** Kong WebSocket authentication issue blocking Supabase Realtime in local development. Need reliable real-time messaging.

**Decision:** Migrate to NestJS + GraphQL + MySQL instead of Supabase.

**Rationale:**
- **Zero sunk cost:** No production code written yet
- **Real-time guaranteed:** GraphQL Subscriptions over WebSocket (no Kong issues)
- **Developer control:** Full control over authentication and real-time logic
- **Type safety:** End-to-end TypeScript with Prisma
- **Free tier:** PlanetScale + Render + Vercel = $0/month MVP

**Consequences:**
- More infrastructure to manage vs Supabase integrated platform
- Need to implement auth ourselves (vs Supabase Auth)
- Need to handle scheduled jobs (Bull queue)
- Better long-term scalability and control

**Alternative Considered:** Hosted Supabase - rejected due to avoiding vendor lock-in and wanting full control.

---

### ADR-002: MySQL (PlanetScale) vs PostgreSQL

**Status:** Accepted

**Context:** Need cost-effective serverless database.

**Decision:** Use MySQL 8.0 via PlanetScale.

**Rationale:**
- **Free forever tier:** 5GB database, 1 billion row reads/month
- **Serverless:** Auto-scaling, no connection limits
- **Branching:** Database branching like Git (great for migrations)
- **Prisma support:** First-class Prisma ORM compatibility

**Consequences:**
- MySQL vs PostgreSQL tradeoffs (JSON support less rich, no array columns)
- Vendor lock-in to PlanetScale (mitigated by standard MySQL compatibility)

**Alternative Considered:** Supabase PostgreSQL, Neon - rejected due to free tier limits and vendor lock-in.

---

### ADR-003: Monorepo vs Polyrepo

**Status:** Accepted

**Context:** Need to organize frontend and backend code.

**Decision:** Use pnpm workspaces monorepo.

**Rationale:**
- **Shared types:** Easy type sharing between frontend/backend
- **Atomic commits:** Frontend + backend changes in single PR
- **Simplified CI/CD:** Single repository to deploy
- **Developer experience:** One clone, one install

**Consequences:**
- Slightly larger repository size
- Need workspace-aware tooling (pnpm)

**Alternative Considered:** Polyrepo with separate frontend/backend repos - rejected for MVP simplicity.

---

### ADR-004: Free Tier Optimization Strategy

**Status:** Accepted

**Context:** Want $0/month MVP hosting costs.

**Decision:** Use free tiers: Render (750hrs) + Vercel (unlimited) + PlanetScale (5GB) + Upstash (10k commands) + R2 (10GB).

**Rationale:**
- **Zero cost MVP:** Perfect for bootstrapping
- **Generous limits:** 5GB database, 10GB storage sufficient for 10-50 families
- **Easy upgrade path:** All services have paid tiers when needed

**Consequences:**
- Render free tier sleeps after inactivity (30s cold start)
- Need to monitor free tier limits
- Acceptable tradeoff for MVP

**Cost at 100 families:**
- Render: $7/month (persistent instance)
- PlanetScale: Free tier likely sufficient
- Upstash: Free tier likely sufficient
- R2: ~$1-2/month (storage)
- Vercel: Free tier sufficient
- **Total: ~$8-10/month**

---

### ADR-005: GraphQL Subscriptions vs Server-Sent Events (SSE)

**Status:** Accepted

**Context:** Need real-time message delivery.

**Decision:** Use GraphQL Subscriptions over WebSocket (via Apollo Server).

**Rationale:**
- **Bidirectional:** WebSocket allows server push + client queries
- **Native Apollo support:** Apollo Client/Server have excellent subscription support
- **Type safety:** GraphQL schema enforces types
- **Presence:** Can implement user online/offline easily

**Consequences:**
- WebSocket connections more resource-intensive than SSE
- Need to handle reconnection logic
- Apollo Server handles complexity well

**Alternative Considered:** Server-Sent Events (SSE) - rejected due to unidirectional nature and lack of native Apollo support.

---

## 10. Cost Analysis

### Free Tier Limits (MVP - 10 Families)

| Service | Free Tier | Usage Estimate | Cost |
|---------|-----------|----------------|------|
| **Render** | 750hrs/month, auto-sleep | ~720hrs (sleeps when inactive) | $0 |
| **Vercel** | Unlimited bandwidth | ~10GB/month | $0 |
| **PlanetScale** | 5GB, 1B row reads | ~100MB database | $0 |
| **Upstash Redis** | 10k commands/day | ~5k commands/day | $0 |
| **Cloudflare R2** | 10GB storage, 1M writes | ~2GB photos | $0 |
| **Groq API** | ~30 req/min | ~50 translations/day | $0 |
| **Google Calendar API** | 10k req/day | ~50 req/day | $0 |
| **Total** | | | **$0/month** |

### Scaling Costs (100 Families)

| Service | Paid Tier | Usage Estimate | Cost |
|---------|-----------|----------------|------|
| **Render** | Starter ($7/month) | Persistent instance | $7/month |
| **Vercel** | Free tier sufficient | ~100GB/month | $0 |
| **PlanetScale** | Free tier (if <5GB) | ~1GB database | $0 |
| **Upstash Redis** | Free tier sufficient | ~8k commands/day | $0 |
| **Cloudflare R2** | Storage + ops | ~20GB photos | ~$2/month |
| **Groq API** | Pay-per-token | ~500 translations/day | ~$3/month |
| **Total** | | | **~$12/month** |

### Break-Even Analysis

- **Cost per family (100 families):** $0.12/month
- **Potential pricing:** $5/month per family
- **Margin:** 97.6% (highly sustainable)

---

## 11. Testing Strategy

### Unit Tests (Vitest)

```typescript
// messages.service.spec.ts
describe('MessagesService', () => {
  it('should create encrypted message', async () => {
    const message = await service.create({
      channelId: 'xxx',
      userId: 'yyy',
      encryptedContent: 'base64ciphertext',
    });
    expect(message.encryptedContent).toBe('base64ciphertext');
  });
});
```

### Integration Tests (Playwright)

```typescript
// tests/e2e/chat-messaging.spec.ts
test('should send and receive real-time message', async ({ page, context }) => {
  // User 1: Login and open chat
  await page.goto('/login');
  await page.fill('[name=email]', 'user1@test.com');
  await page.fill('[name=password]', 'password123');
  await page.click('button[type=submit]');

  // User 2: Open in new tab
  const page2 = await context.newPage();
  await page2.goto('/login');
  // ... login as user2

  // User 1: Send message
  await page.goto('/chat');
  await page.fill('[name=message]', 'Hello from User 1');
  await page.click('button:has-text("Send")');

  // User 2: Should see message in real-time
  await expect(page2.locator('text=Hello from User 1')).toBeVisible({ timeout: 2000 });
});
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-13 | Winston | Initial Supabase architecture |
| 2.0 | 2025-10-18 | Winston | Complete rewrite for NestJS + GraphQL + MySQL |

---

**Next Steps:**
1. ✅ Architecture approved
2. ⏳ Set up monorepo structure
3. ⏳ Initialize NestJS backend with GraphQL
4. ⏳ Initialize Next.js frontend with Apollo Client
5. ⏳ Set up Prisma with PlanetScale
6. ⏳ Implement Epic 1: User Onboarding & Authentication

**Questions or Feedback:** Contact development team
