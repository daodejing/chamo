# Supabase to NestJS Architecture Migration Guide

**Date:** 2025-10-18
**Purpose:** Map existing Supabase tech specs to NestJS + GraphQL + MySQL implementation
**Status:** Active Reference

---

## Overview

All 7 epic tech specs were originally written for Supabase architecture. This guide provides the mapping to NestJS + GraphQL + MySQL stack for implementation teams.

**Key Changes:**
- **Database:** PostgreSQL (Supabase) → MySQL (PlanetScale) + Prisma ORM
- **API:** REST (Supabase PostgREST) → GraphQL (Apollo Server)
- **Real-time:** Supabase Realtime → GraphQL Subscriptions over WebSocket
- **Storage:** Supabase Storage → Cloudflare R2 (S3-compatible)
- **Auth:** Supabase Auth → Custom NestJS JWT auth with bcrypt

---

## 1. Database Migration (PostgreSQL → MySQL + Prisma)

### Table Creation

**Old (Supabase SQL migrations):**
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_edited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_channel_id ON messages(channel_id);
```

**New (Prisma schema):**
```prisma
model Message {
  id                String    @id @default(uuid())
  channelId         String
  channel           Channel   @relation(fields: [channelId], references: [id], onDelete: Cascade)
  userId            String
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  encryptedContent  String    @db.Text
  timestamp         DateTime  @default(now())
  isEdited          Boolean   @default(false)
  createdAt         DateTime  @default(now())

  @@index([channelId, timestamp])
  @@map("messages")
}
```

**Migration Steps:**
1. Define Prisma schema in `apps/backend/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name init` to generate migration
3. Run `npx prisma generate` to create TypeScript client
4. Import `PrismaService` in NestJS modules

### Row Level Security (RLS)

**Old (Supabase RLS policies):**
```sql
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

**New (NestJS resolver-level authorization):**
```typescript
// messages/messages.resolver.ts
@Resolver(() => Message)
export class MessagesResolver {
  @UseGuards(GqlAuthGuard)
  @Query(() => [Message])
  async messages(
    @Args('channelId') channelId: string,
    @CurrentUser() user: User,
  ) {
    // Validate user is in channel's family
    const channel = await this.channelsService.findOne(channelId);
    if (channel.familyId !== user.familyId) {
      throw new ForbiddenException('Access denied');
    }

    return this.messagesService.findByChannel(channelId);
  }
}
```

---

## 2. API Migration (REST → GraphQL)

### Query/Fetch Operations

**Old (Supabase REST client):**
```typescript
// Fetch messages
const { data, error } = await supabase
  .from('messages')
  .select('*, user:users(*), channel:channels(*)')
  .eq('channel_id', channelId)
  .order('timestamp', { ascending: false })
  .limit(50);
```

**New (Apollo Client GraphQL):**
```typescript
// GraphQL query definition
const GET_MESSAGES = gql`
  query GetMessages($channelId: ID!, $limit: Int) {
    messages(channelId: $channelId, limit: $limit) {
      id
      encryptedContent
      timestamp
      isEdited
      user {
        id
        name
        avatar
      }
      channel {
        id
        name
      }
    }
  }
`;

// Execute query
const { data, loading, error } = useQuery(GET_MESSAGES, {
  variables: { channelId, limit: 50 }
});
```

**Backend (NestJS resolver):**
```typescript
// messages/messages.resolver.ts
@Query(() => [Message])
@UseGuards(GqlAuthGuard)
async messages(
  @Args('channelId') channelId: string,
  @Args('limit', { type: () => Int, nullable: true }) limit = 50,
  @CurrentUser() user: User,
) {
  return this.messagesService.findByChannel(channelId, limit);
}
```

### Mutation/Write Operations

**Old (Supabase insert):**
```typescript
const { data, error } = await supabase
  .from('messages')
  .insert({
    channel_id: channelId,
    user_id: userId,
    encrypted_content: ciphertext,
  })
  .select();
```

**New (Apollo Client mutation):**
```typescript
// GraphQL mutation definition
const CREATE_MESSAGE = gql`
  mutation CreateMessage($channelId: ID!, $encryptedContent: String!) {
    createMessage(channelId: $channelId, encryptedContent: $encryptedContent) {
      id
      encryptedContent
      timestamp
      user {
        id
        name
      }
    }
  }
`;

// Execute mutation
const [createMessage] = useMutation(CREATE_MESSAGE);

await createMessage({
  variables: {
    channelId,
    encryptedContent: ciphertext,
  },
});
```

**Backend (NestJS resolver):**
```typescript
// messages/messages.resolver.ts
@Mutation(() => Message)
@UseGuards(GqlAuthGuard)
async createMessage(
  @Args('channelId') channelId: string,
  @Args('encryptedContent') encryptedContent: string,
  @CurrentUser() user: User,
) {
  const message = await this.messagesService.create({
    channelId,
    userId: user.id,
    encryptedContent,
  });

  // Trigger subscription
  this.pubSub.publish('messageCreated', { messageCreated: message, channelId });

  return message;
}
```

---

## 3. Real-time Migration (Supabase Realtime → GraphQL Subscriptions)

### Subscribe to Changes

**Old (Supabase Realtime):**
```typescript
const channel = supabase
  .channel(`messages:${channelId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `channel_id=eq.${channelId}`
  }, (payload) => {
    const newMessage = payload.new;
    addMessageToUI(newMessage);
  })
  .subscribe();
```

**New (Apollo Client GraphQL Subscription):**
```typescript
// GraphQL subscription definition
const MESSAGE_CREATED = gql`
  subscription MessageCreated($channelId: ID!) {
    messageCreated(channelId: $channelId) {
      id
      encryptedContent
      timestamp
      user {
        id
        name
        avatar
      }
    }
  }
`;

// Use subscription hook
const { data, loading } = useSubscription(MESSAGE_CREATED, {
  variables: { channelId }
});

useEffect(() => {
  if (data?.messageCreated) {
    addMessageToUI(data.messageCreated);
  }
}, [data]);
```

**Backend (NestJS subscription resolver):**
```typescript
// messages/messages.resolver.ts
import { PubSub } from 'graphql-subscriptions';

@Resolver(() => Message)
export class MessagesResolver {
  constructor(
    private messagesService: MessagesService,
    private pubSub: PubSub, // Injected singleton
  ) {}

  @Subscription(() => Message, {
    filter: (payload, variables) => {
      return payload.channelId === variables.channelId;
    },
  })
  messageCreated(@Args('channelId') channelId: string) {
    return this.pubSub.asyncIterator('messageCreated');
  }
}
```

**PubSub Module Setup:**
```typescript
// app.module.ts
import { PubSub } from 'graphql-subscriptions';

@Module({
  providers: [
    {
      provide: PubSub,
      useValue: new PubSub(),
    },
  ],
  exports: [PubSub],
})
export class PubSubModule {}
```

---

## 4. Authentication Migration (Supabase Auth → NestJS JWT)

### User Registration

**Old (Supabase Auth):**
```typescript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      name,
      family_name: familyName,
    }
  }
});
```

**New (GraphQL mutation + JWT):**
```typescript
// GraphQL mutation
const REGISTER = gql`
  mutation Register($email: String!, $password: String!, $name: String!, $familyName: String!) {
    register(email: $email, password: $password, name: $name, familyName: $familyName) {
      user {
        id
        email
        name
        family {
          id
          name
          inviteCode
        }
      }
      accessToken
      refreshToken
    }
  }
`;

const [register] = useMutation(REGISTER);
const { data } = await register({
  variables: { email, password, name, familyName }
});

// Store tokens (HTTP-only cookies via API route)
await fetch('/api/auth/set-tokens', {
  method: 'POST',
  body: JSON.stringify({
    accessToken: data.register.accessToken,
    refreshToken: data.register.refreshToken,
  }),
});
```

**Backend (NestJS auth resolver):**
```typescript
// auth/auth.resolver.ts
@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Mutation(() => AuthResponse)
  async register(
    @Args('email') email: string,
    @Args('password') password: string,
    @Args('name') name: string,
    @Args('familyName') familyName: string,
  ) {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create family
    const family = await this.authService.createFamily({
      name: familyName,
      inviteCode: generateInviteCode(),
    });

    // Create user
    const user = await this.authService.createUser({
      email,
      passwordHash,
      name,
      familyId: family.id,
      role: 'ADMIN',
    });

    // Generate JWT tokens
    const accessToken = this.authService.generateAccessToken(user);
    const refreshToken = this.authService.generateRefreshToken(user);

    return { user, family, accessToken, refreshToken };
  }
}
```

### Session Management

**Old (Supabase session):**
```typescript
const { data: { session } } = await supabase.auth.getSession();
```

**New (JWT from cookies via GraphQL context):**
```typescript
// Client: Apollo Client setup with credentials
const apolloClient = new ApolloClient({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_HTTP_URL,
  credentials: 'include', // Send cookies
  cache: new InMemoryCache(),
});

// Backend: Extract user from JWT in context
// main.ts - GraphQL module config
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  context: ({ req }) => {
    const token = req.cookies['accessToken'];
    const user = token ? this.jwtService.verify(token) : null;
    return { req, user };
  },
}),
```

---

## 5. Storage Migration (Supabase Storage → Cloudflare R2)

### Upload Flow

**Old (Supabase Storage):**
```typescript
// Upload file
const { data, error } = await supabase.storage
  .from('photos')
  .upload(`${familyId}/${photoId}.enc`, encryptedBlob);

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('photos')
  .getPublicUrl(`${familyId}/${photoId}.enc`);
```

**New (Cloudflare R2 via presigned URLs):**
```typescript
// 1. Request presigned upload URL
const GET_UPLOAD_URL = gql`
  mutation GetPhotoUploadUrl($fileName: String!, $fileSize: Int!) {
    getPhotoUploadUrl(fileName: $fileName, fileSize: $fileSize) {
      uploadUrl
      storagePath
    }
  }
`;

const { data } = await getUploadUrl({
  variables: { fileName: 'photo.jpg', fileSize: encryptedBlob.size }
});

// 2. Upload directly to R2
await fetch(data.getPhotoUploadUrl.uploadUrl, {
  method: 'PUT',
  body: encryptedBlob,
  headers: { 'Content-Type': 'application/octet-stream' },
});

// 3. Create photo record
const CREATE_PHOTO = gql`
  mutation CreatePhoto($folderId: ID!, $storagePath: String!, $encryptedCaption: String) {
    createPhoto(folderId: $folderId, storagePath: $storagePath, encryptedCaption: $encryptedCaption) {
      id
      storagePath
      uploadedAt
    }
  }
`;

await createPhoto({
  variables: {
    folderId,
    storagePath: data.getPhotoUploadUrl.storagePath,
    encryptedCaption,
  },
});
```

**Backend (NestJS R2 service):**
```typescript
// photos/r2.service.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  async getPresignedUploadUrl(fileName: string): Promise<{ uploadUrl: string; storagePath: string }> {
    const storagePath = `${Date.now()}-${fileName}`;
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: storagePath,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    return { uploadUrl, storagePath };
  }
}
```

---

## 6. Epic-Specific Migrations

### Epic 1: User Onboarding & Authentication

**Tech Spec Updates:**
- Replace Supabase Auth API calls → NestJS AuthResolver mutations
- Replace Supabase session management → JWT stored in HTTP-only cookies
- Replace Supabase RLS policies → NestJS @UseGuards(GqlAuthGuard)

**Key Files:**
- `apps/backend/src/auth/auth.module.ts`
- `apps/backend/src/auth/auth.resolver.ts`
- `apps/backend/src/auth/auth.service.ts`
- `apps/backend/src/auth/jwt.strategy.ts`
- `apps/frontend/src/graphql/mutations.ts` (register, login, joinFamily)

---

### Epic 2: Multi-Channel Messaging

**Tech Spec Updates:**
- Replace Supabase PostgREST queries → GraphQL queries (messages)
- Replace Supabase Realtime subscriptions → GraphQL Subscriptions (messageCreated)
- Replace Supabase .insert() → GraphQL mutation (createMessage)

**Key Files:**
- `apps/backend/src/messages/messages.module.ts`
- `apps/backend/src/messages/messages.resolver.ts`
- `apps/backend/src/messages/messages.service.ts`
- `apps/frontend/src/graphql/subscriptions.ts` (MESSAGE_CREATED)
- `apps/frontend/src/components/chat/message-list.tsx`

**Real-time Setup:**
```typescript
// Apollo Client with WebSocket for subscriptions
import { split, HttpLink } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_HTTP_URL,
  credentials: 'include',
});

const wsLink = new GraphQLWsLink(createClient({
  url: process.env.NEXT_PUBLIC_GRAPHQL_WS_URL,
  connectionParams: {
    // JWT sent with WebSocket connection
    authToken: getCookie('accessToken'),
  },
}));

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink,
);
```

---

### Epic 3: Photo Sharing

**Tech Spec Updates:**
- Replace Supabase Storage upload → R2 presigned URL upload
- Replace Supabase .from('photos') → GraphQL mutations/queries
- Keep client-side encryption identical (Web Crypto API)

**Key Files:**
- `apps/backend/src/photos/photos.module.ts`
- `apps/backend/src/photos/photos.resolver.ts`
- `apps/backend/src/photos/r2.service.ts`
- `apps/frontend/src/components/photos/photo-upload.tsx`

---

### Epic 4: Shared Calendar

**Tech Spec Updates:**
- Replace Supabase calendar_events table → Prisma CalendarEvent model
- Replace Supabase REST API → GraphQL queries/mutations
- Google OAuth integration remains identical

**Key Files:**
- `apps/backend/src/calendar/calendar.module.ts`
- `apps/backend/src/calendar/calendar.resolver.ts`
- `apps/backend/src/calendar/google-calendar.service.ts`

---

### Epic 5: User Preferences

**Tech Spec Updates:**
- Replace Supabase users.preferences JSONB → Prisma User.preferences Json
- Groq translation client-side integration remains identical

**Key Files:**
- `apps/backend/src/users/users.resolver.ts` (updatePreferences mutation)
- `apps/frontend/src/lib/groq/translation.ts` (unchanged)

---

### Epic 6: Family Management

**Tech Spec Updates:**
- Replace Supabase family/channel management → GraphQL mutations
- Replace invite code lookup → Prisma findUnique query

**Key Files:**
- `apps/backend/src/family/family.module.ts`
- `apps/backend/src/family/family.resolver.ts`
- `apps/backend/src/channels/channels.resolver.ts`

---

### Epic 7: E2EE Infrastructure

**Tech Spec Updates:**
- **No changes** - E2EE is entirely client-side
- Web Crypto API, IndexedDB storage, family key management remain identical
- Server never sees plaintext (same as Supabase)

**Key Files:**
- `apps/frontend/src/lib/e2ee/encryption.ts` (unchanged)
- `apps/frontend/src/lib/e2ee/key-management.ts` (unchanged)
- `apps/frontend/src/lib/e2ee/storage.ts` (unchanged)

---

## 7. Testing Migration

### Unit Tests

**Old (Supabase client mocking):**
```typescript
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: mockMessages }),
    })),
  })),
}));
```

**New (Prisma mocking):**
```typescript
// Use Prisma's mock client
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('MessagesService', () => {
  let service: MessagesService;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    service = new MessagesService(prisma);
  });

  it('should find messages by channel', async () => {
    prisma.message.findMany.mockResolvedValue(mockMessages);
    const result = await service.findByChannel('channel-id');
    expect(result).toEqual(mockMessages);
  });
});
```

### Integration Tests

**Old (Supabase test database):**
```typescript
beforeAll(async () => {
  // Connect to test Supabase instance
  supabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_KEY);
});
```

**New (Prisma test database):**
```typescript
// Use Prisma test setup with safe database operations
beforeAll(async () => {
  // Set test database URL
  process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/ourchat_test';

  // Run Prisma migrations (use Bash tool or package.json scripts)
  // In package.json: "test:setup": "prisma migrate deploy"

  // Seed test data
  await prisma.user.createMany({ data: testUsers });
});

afterAll(async () => {
  // Clean up test data
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users CASCADE');
  await prisma.$disconnect();
});
```

---

## 8. Environment Variables Migration

### Old (.env.local - Supabase)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

### New (.env - Backend)

```bash
DATABASE_URL="mysql://user:pass@aws.connect.psdb.cloud/ourchat?sslaccept=strict"
JWT_SECRET=xxx
JWT_EXPIRES_IN=7d
REDIS_URL=redis://default:pass@upstash.io:6379
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=ourchat-photos
```

### New (.env.local - Frontend)

```bash
NEXT_PUBLIC_GRAPHQL_HTTP_URL=http://localhost:4000/graphql
NEXT_PUBLIC_GRAPHQL_WS_URL=ws://localhost:4000/graphql
NEXT_PUBLIC_GROQ_API_KEY=gsk_xxx
```

---

## 9. Deployment Migration

### Old (Vercel + Supabase)

- Frontend: Vercel (Next.js)
- Backend: Supabase (PostgreSQL + Realtime + Storage + Auth)
- Single environment variable: `NEXT_PUBLIC_SUPABASE_URL`

### New (Vercel + Render + PlanetScale)

- Frontend: Vercel (Next.js + Apollo Client)
- Backend: Render (NestJS + Apollo Server)
- Database: PlanetScale (MySQL)
- Cache/Queue: Upstash Redis
- Storage: Cloudflare R2

**Deployment Steps:**

1. **PlanetScale Setup:**
   - Create database via dashboard or CLI
   - Create production branch
   - Run migrations via Bash tool or package.json script

2. **Render Setup:**
   - Connect GitHub repo (apps/backend folder)
   - Build command: `cd apps/backend && pnpm install && npx prisma generate && pnpm build`
   - Start command: `cd apps/backend && pnpm start:prod`
   - Environment variables: `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `R2_*`

3. **Vercel Setup:**
   - Connect GitHub repo (apps/frontend folder)
   - Build command: `cd apps/frontend && pnpm install && pnpm build`
   - Environment variables: `NEXT_PUBLIC_GRAPHQL_HTTP_URL`, `NEXT_PUBLIC_GRAPHQL_WS_URL`

---

## 10. Quick Reference: API Mapping

| Operation | Supabase | NestJS + GraphQL |
|-----------|----------|------------------|
| Fetch data | `.from('table').select()` | `query { table { fields } }` |
| Insert data | `.from('table').insert()` | `mutation { createTable(...) }` |
| Update data | `.from('table').update()` | `mutation { updateTable(...) }` |
| Delete data | `.from('table').delete()` | `mutation { deleteTable(...) }` |
| Real-time subscribe | `.channel().on('postgres_changes')` | `subscription { tableCreated }` |
| Auth register | `supabase.auth.signUp()` | `mutation { register(...) }` |
| Auth login | `supabase.auth.signInWithPassword()` | `mutation { login(...) }` |
| Get session | `supabase.auth.getSession()` | `query { me { ... } }` (JWT in context) |
| Upload file | `.storage.from().upload()` | Presigned URL + direct R2 upload |

---

## 11. Common Patterns

### Pattern 1: Data Fetching with Loading States

**Old:**
```typescript
const [messages, setMessages] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function fetchMessages() {
    const { data } = await supabase.from('messages').select();
    setMessages(data);
    setLoading(false);
  }
  fetchMessages();
}, []);
```

**New:**
```typescript
const { data, loading } = useQuery(GET_MESSAGES, {
  variables: { channelId }
});

// Apollo Client handles loading state automatically
```

### Pattern 2: Optimistic Updates

**Old:**
```typescript
// Manual optimistic update
setMessages([...messages, newMessage]);
const { error } = await supabase.from('messages').insert(newMessage);
if (error) {
  setMessages(messages); // Rollback
}
```

**New:**
```typescript
const [createMessage] = useMutation(CREATE_MESSAGE, {
  optimisticResponse: {
    createMessage: {
      __typename: 'Message',
      id: 'temp-id',
      ...newMessage,
    },
  },
  update: (cache, { data }) => {
    // Apollo cache automatically updates
  },
});
```

### Pattern 3: Pagination

**Old:**
```typescript
const { data } = await supabase
  .from('messages')
  .select()
  .range(offset, offset + limit - 1);
```

**New:**
```typescript
const { data, fetchMore } = useQuery(GET_MESSAGES, {
  variables: { channelId, limit: 50, offset: 0 }
});

// Load more
await fetchMore({
  variables: { offset: messages.length },
  updateQuery: (prev, { fetchMoreResult }) => ({
    messages: [...prev.messages, ...fetchMoreResult.messages]
  }),
});
```

---

## 12. Migration Checklist

### For Each Epic Tech Spec:

- [ ] Replace Supabase table schemas with Prisma models
- [ ] Replace REST API endpoints with GraphQL schema
- [ ] Replace Supabase client queries with Apollo Client queries
- [ ] Replace Supabase Realtime with GraphQL Subscriptions
- [ ] Replace Supabase Auth with NestJS JWT auth
- [ ] Update environment variables
- [ ] Update deployment configuration
- [ ] Update test mocks (Supabase → Prisma)
- [ ] Verify E2EE flows remain client-side only

---

## Conclusion

This guide provides the complete mapping from Supabase to NestJS + GraphQL + MySQL. All 7 epic tech specs can reference this document for implementation details.

**Key Principle:** User-facing behavior remains identical. Only the technical implementation changes.

**Next Steps:**
1. Reference this guide when implementing each epic
2. Update epic tech specs with NestJS-specific code examples as needed
3. Follow the monorepo structure defined in solution-architecture.md
4. Start with Epic 1 (Authentication) as foundation

---

**Document Status:** Complete
**Last Updated:** 2025-10-18
**Maintained By:** Development Team
