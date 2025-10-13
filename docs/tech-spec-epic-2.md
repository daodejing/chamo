# Tech Spec: Epic 2 - Multi-Channel Messaging

**Epic ID:** Epic 2
**Priority:** Critical (MVP Blocker)
**Story Points:** 13
**Estimated Duration:** 2 weeks
**Dependencies:** Epic 7 (E2EE), Epic 1 (Authentication)

---

## 1. Epic Overview

Multi-channel messaging is the core feature of OurChat. Families can organize conversations into multiple channels (e.g., "General", "School", "Planning"). All messages are encrypted end-to-end, delivered in real-time via WebSocket, and support editing, deletion, scheduling, and real-time translation to user's preferred language (20+ languages supported).

**User Stories:**

- **US-2.1:** As a family member, I want to send messages in different channels so that I can organize conversations by topic
  - **AC1:** Select channel from channel list
  - **AC2:** Type message and send
  - **AC3:** Message appears in correct channel for all members
  - **AC4:** Message is encrypted before transmission

- **US-2.2:** As a family member, I want to edit my messages so that I can correct typos
  - **AC1:** Long-press or right-click own message
  - **AC2:** Edit message text
  - **AC3:** Message shows "(edited)" indicator
  - **AC4:** All members see updated message in real-time

- **US-2.3:** As a family member, I want to delete my messages so that I can remove mistakes
  - **AC1:** Long-press or right-click own message
  - **AC2:** Confirm deletion
  - **AC3:** Message removed for all members
  - **AC4:** Toast notification confirms deletion

- **US-2.4:** As a family member, I want to schedule messages so that I can send birthday wishes at the right time
  - **AC1:** Click "Schedule" button
  - **AC2:** Pick date and time
  - **AC3:** Message queued
  - **AC4:** System sends message at scheduled time
  - **AC5:** Can view and cancel scheduled messages

- **US-2.5:** As a user, I want to see messages translated to my preferred language so that I can understand messages from family members who speak different languages
  - **AC1:** Message displays in original language
  - **AC2:** If message language differs from my preferred language, translation appears below original
  - **AC3:** Translation accurate for common phrases (20+ languages supported)
  - **AC4:** No manual translation action required
  - **AC5:** Translation uses my "Translate Messages To" setting from preferences

---

## 2. Architecture Components

### 2.1 Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Chat Screen** | `app/(dashboard)/chat/page.tsx` | Main messaging interface |
| **Message List** | `components/chat/message-list.tsx` | Scrollable message feed |
| **Message Bubble** | `components/chat/message-bubble.tsx` | Individual message UI |
| **Message Input** | `components/chat/message-input.tsx` | Text input with send button |
| **Channel Selector** | `components/chat/channel-selector.tsx` | Channel switcher sidebar |
| **Translation Display** | `components/chat/translation-display.tsx` | Translated text below original |
| **Schedule Modal** | `components/chat/schedule-modal.tsx` | Date/time picker for scheduling |
| **Scheduled Messages List** | `components/chat/scheduled-messages-list.tsx` | View queued messages |

### 2.2 Backend API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/messages` | GET | Fetch message history (paginated) |
| `POST /api/messages` | POST | Send new message |
| `PATCH /api/messages/:id` | PATCH | Edit existing message |
| `DELETE /api/messages/:id` | DELETE | Delete message |
| `GET /api/scheduled-messages` | GET | Fetch user's scheduled messages |
| `POST /api/scheduled-messages` | POST | Schedule message for future delivery |
| `DELETE /api/scheduled-messages/:id` | DELETE | Cancel scheduled message |
| `GET /api/channels` | GET | Fetch family channels |

### 2.3 Database Tables

```sql
-- Messages table
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
CREATE INDEX idx_messages_user_id ON messages(user_id);

-- Scheduled messages table
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
CREATE INDEX idx_scheduled_messages_user_id ON scheduled_messages(user_id);

-- Channels table
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

### 2.4 Real-time Infrastructure

**Supabase Realtime WebSocket:**
- Subscribe to channel: `messages:channel_id`
- Events: INSERT, UPDATE, DELETE on `messages` table
- Presence tracking: Online users per channel

### 2.5 External Services

| Service | Purpose | Integration |
|---------|---------|-------------|
| **Groq API** | LLM translation (Llama 3.1 70B) | Client-direct (privacy-preserving) |
| **Supabase Realtime** | WebSocket message delivery | Built-in |

---

## 3. Implementation Details

### 3.1 Database Schema (Detailed)

#### Messages Table with RLS

```sql
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read messages from their family's channels
CREATE POLICY "Users can read family messages"
  ON messages FOR SELECT
  USING (
    channel_id IN (
      SELECT id FROM channels WHERE family_id = (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Policy: Users can insert messages to their family's channels
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    channel_id IN (
      SELECT id FROM channels WHERE family_id = (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Policy: Users can update their own messages
CREATE POLICY "Users can edit own messages"
  ON messages FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own messages
CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE
  USING (user_id = auth.uid());
```

#### Scheduled Messages Table with RLS

```sql
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own scheduled messages"
  ON scheduled_messages FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create scheduled messages"
  ON scheduled_messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can cancel own scheduled messages"
  ON scheduled_messages FOR DELETE
  USING (user_id = auth.uid() AND status = 'pending');
```

#### Channels Table with RLS

```sql
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read family channels"
  ON channels FOR SELECT
  USING (
    family_id = (SELECT family_id FROM users WHERE id = auth.uid())
  );

-- Only admins can create/delete channels (Epic 6)
CREATE POLICY "Admins can manage channels"
  ON channels FOR ALL
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 3.2 API Contracts

#### GET /api/messages

**Authentication:** Required (JWT)

**Query Parameters (Zod):**
```typescript
import { z } from 'zod';

export const messagesQuerySchema = z.object({
  channelId: z.string().uuid('Invalid channel ID'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(), // Pagination: fetch messages before this timestamp
});

export type MessagesQuery = z.infer<typeof messagesQuerySchema>;
```

**Response Schema:**
```typescript
type MessagesResponse = {
  messages: Array<{
    id: string;
    channelId: string;
    userId: string;
    encryptedContent: string; // Base64 ciphertext
    timestamp: string; // ISO 8601
    isEdited: boolean;
    editedAt: string | null;
    user: {
      id: string;
      name: string;
      avatar: string | null;
    };
  }>;
  hasMore: boolean; // True if more messages available
};
```

**Error Responses:**
- 400: Invalid query parameters
- 401: Not authenticated
- 403: User not in this channel's family
- 500: Server error

**Rate Limiting:** None (read-only, frequently called)

**Implementation Logic:**
1. Validate JWT and extract user ID
2. Verify user belongs to channel's family (RLS handles this)
3. Fetch messages with limit + 1 (to check if more exist)
4. Join with users table for sender info
5. Return messages with hasMore flag

---

#### POST /api/messages

**Authentication:** Required (JWT)

**Request Schema (Zod):**
```typescript
export const sendMessageSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID'),
  encryptedContent: z.string().min(1, 'Message cannot be empty'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
```

**Response Schema:**
```typescript
type SendMessageResponse = {
  message: {
    id: string;
    channelId: string;
    userId: string;
    encryptedContent: string;
    timestamp: string;
    isEdited: boolean;
    editedAt: null;
  };
};
```

**Error Responses:**
- 400: Invalid input (missing channelId or content)
- 401: Not authenticated
- 403: User not in this channel's family, or quiet hours active
- 429: Rate limit exceeded (100 messages/minute per user)
- 500: Server error

**Rate Limiting:** 100 messages per minute per user

**Implementation Logic:**
1. Validate JWT and input
2. Check user's quiet hours settings (if active, block and return 403)
3. Verify user belongs to channel's family
4. Insert message into database (already encrypted by client)
5. Supabase Realtime broadcasts to channel subscribers
6. Return created message

**Quiet Hours Check:**
```typescript
// Server-side check
const user = await supabase.from('users').select('preferences').eq('id', userId).single();
const prefs = user.preferences || {};

if (prefs.quietHoursEnabled) {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMin] = prefs.quietHoursStart.split(':').map(Number);
  const [endHour, endMin] = prefs.quietHoursEnd.split(':').map(Number);
  const start = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;

  const isQuietHours = (start <= end)
    ? (currentTime >= start && currentTime < end)
    : (currentTime >= start || currentTime < end); // Overnight case

  if (isQuietHours) {
    return NextResponse.json(
      { error: 'Cannot send messages during quiet hours' },
      { status: 403 }
    );
  }
}
```

---

#### PATCH /api/messages/:id

**Authentication:** Required (JWT)

**Request Schema (Zod):**
```typescript
export const editMessageSchema = z.object({
  encryptedContent: z.string().min(1, 'Message cannot be empty'),
});

export type EditMessageInput = z.infer<typeof editMessageSchema>;
```

**Response Schema:**
```typescript
type EditMessageResponse = {
  message: {
    id: string;
    encryptedContent: string;
    isEdited: true;
    editedAt: string;
  };
};
```

**Error Responses:**
- 400: Invalid input
- 401: Not authenticated
- 403: User does not own this message
- 404: Message not found
- 500: Server error

**Rate Limiting:** None

**Implementation Logic:**
1. Validate JWT and input
2. Verify user owns message (RLS policy enforces this)
3. Update message: set `encrypted_content`, `is_edited = true`, `edited_at = NOW()`
4. Supabase Realtime broadcasts UPDATE event
5. Return updated message

---

#### DELETE /api/messages/:id

**Authentication:** Required (JWT)

**Request Schema:** None (message ID in URL)

**Response Schema:**
```typescript
type DeleteMessageResponse = {
  success: true;
  messageId: string;
};
```

**Error Responses:**
- 401: Not authenticated
- 403: User does not own this message
- 404: Message not found
- 500: Server error

**Rate Limiting:** None

**Implementation Logic:**
1. Validate JWT
2. Verify user owns message (RLS policy)
3. Delete message from database
4. Supabase Realtime broadcasts DELETE event
5. Return success

---

#### POST /api/scheduled-messages

**Authentication:** Required (JWT)

**Request Schema (Zod):**
```typescript
export const scheduleMessageSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID'),
  encryptedContent: z.string().min(1, 'Message cannot be empty'),
  scheduledTime: z.string().datetime('Invalid date format'), // ISO 8601
});

export type ScheduleMessageInput = z.infer<typeof scheduleMessageSchema>;
```

**Response Schema:**
```typescript
type ScheduleMessageResponse = {
  scheduledMessage: {
    id: string;
    userId: string;
    channelId: string;
    encryptedContent: string;
    scheduledTime: string;
    status: 'pending';
    createdAt: string;
  };
};
```

**Error Responses:**
- 400: Invalid input (past date, invalid format)
- 401: Not authenticated
- 403: User not in channel's family
- 500: Server error

**Rate Limiting:** 10 scheduled messages per hour per user

**Implementation Logic:**
1. Validate JWT and input
2. Verify scheduledTime is in the future
3. Insert into `scheduled_messages` table (status = 'pending')
4. Background cron job will send at scheduled time
5. Return scheduled message record

**Cron Job (Vercel Cron):**
```typescript
// app/api/cron/send-scheduled-messages/route.ts
export async function GET() {
  // Fetch pending scheduled messages where scheduledTime <= NOW()
  const { data: pendingMessages } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_time', new Date().toISOString());

  for (const msg of pendingMessages) {
    // Send message to channel
    await supabase.from('messages').insert({
      channel_id: msg.channel_id,
      user_id: msg.user_id,
      encrypted_content: msg.encrypted_content,
    });

    // Mark as sent
    await supabase
      .from('scheduled_messages')
      .update({ status: 'sent' })
      .eq('id', msg.id);
  }

  return NextResponse.json({ sent: pendingMessages.length });
}
```

**Vercel Cron Config (`vercel.json`):**
```json
{
  "crons": [
    {
      "path": "/api/cron/send-scheduled-messages",
      "schedule": "* * * * *" // Every minute
    }
  ]
}
```

---

#### GET /api/scheduled-messages

**Authentication:** Required (JWT)

**Query Parameters:** None

**Response Schema:**
```typescript
type ScheduledMessagesResponse = {
  scheduledMessages: Array<{
    id: string;
    channelId: string;
    encryptedContent: string;
    scheduledTime: string;
    status: 'pending' | 'sent' | 'cancelled';
    createdAt: string;
    channel: {
      name: string;
    };
  }>;
};
```

**Error Responses:**
- 401: Not authenticated
- 500: Server error

**Rate Limiting:** None

---

#### DELETE /api/scheduled-messages/:id

**Authentication:** Required (JWT)

**Request Schema:** None (ID in URL)

**Response Schema:**
```typescript
type CancelScheduledMessageResponse = {
  success: true;
  scheduledMessageId: string;
};
```

**Error Responses:**
- 401: Not authenticated
- 403: User does not own this scheduled message
- 404: Scheduled message not found
- 409: Message already sent (cannot cancel)
- 500: Server error

---

#### GET /api/channels

**Authentication:** Required (JWT)

**Query Parameters:** None

**Response Schema:**
```typescript
type ChannelsResponse = {
  channels: Array<{
    id: string;
    familyId: string;
    name: string;
    description: string | null;
    icon: string | null; // Emoji
    isDefault: boolean;
    createdAt: string;
  }>;
};
```

**Error Responses:**
- 401: Not authenticated
- 500: Server error

**Rate Limiting:** None (cached on client)

---

### 3.3 Component Implementation Guide

#### Component: Chat Screen

**File:** `app/(dashboard)/chat/page.tsx`

**State Management:**
```typescript
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useRealtime } from '@/lib/hooks/use-realtime';

const [selectedChannelId, setSelectedChannelId] = useState<string>('');
const [messages, setMessages] = useState<Message[]>([]);
const [channels, setChannels] = useState<Channel[]>([]);
const [loading, setLoading] = useState(true);
```

**Key Functions:**
- `fetchMessages(channelId)` - Load message history from API
- `handleSendMessage(content)` - Encrypt and send message
- `handleEditMessage(messageId, newContent)` - Edit message
- `handleDeleteMessage(messageId)` - Delete message
- `subscribeToRealtimeUpdates(channelId)` - WebSocket subscription

**Integration Points:**
- API: `/api/messages`, `/api/channels`
- Hooks: `useAuth()`, `useRealtime()`, `useFamilyKey()` (Epic 7)
- E2EE: `encryptMessage()`, `decryptMessage()` (Epic 7)
- Realtime: Supabase Realtime WebSocket

**Component Structure:**
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useFamilyKey } from '@/lib/hooks/use-family-key';
import { useRealtime } from '@/lib/hooks/use-realtime';
import { ChannelSelector } from '@/components/chat/channel-selector';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { encryptMessage, decryptMessage } from '@/lib/e2ee/encryption';

export default function ChatPage() {
  const { user } = useAuth();
  const { familyKey } = useFamilyKey();
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);

  // Fetch channels on mount
  useEffect(() => {
    async function loadChannels() {
      const res = await fetch('/api/channels');
      const data = await res.json();
      setChannels(data.channels);
      // Select first channel (default: "General")
      setSelectedChannelId(data.channels[0]?.id);
    }
    loadChannels();
  }, []);

  // Fetch messages when channel changes
  useEffect(() => {
    if (!selectedChannelId) return;

    async function loadMessages() {
      const res = await fetch(`/api/messages?channelId=${selectedChannelId}&limit=50`);
      const data = await res.json();

      // Decrypt messages
      const decrypted = await Promise.all(
        data.messages.map(async (msg) => ({
          ...msg,
          content: await decryptMessage(msg.encryptedContent, familyKey!),
        }))
      );

      setMessages(decrypted);
    }

    loadMessages();
  }, [selectedChannelId, familyKey]);

  // Subscribe to real-time updates
  useRealtime(selectedChannelId, {
    onInsert: async (newMessage) => {
      const content = await decryptMessage(newMessage.encryptedContent, familyKey!);
      setMessages((prev) => [...prev, { ...newMessage, content }]);
    },
    onUpdate: async (updatedMessage) => {
      const content = await decryptMessage(updatedMessage.encryptedContent, familyKey!);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === updatedMessage.id ? { ...updatedMessage, content } : msg))
      );
    },
    onDelete: (deletedId) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== deletedId));
    },
  });

  const handleSendMessage = async (content: string) => {
    if (!familyKey || !selectedChannelId) return;

    // Encrypt message
    const encrypted = await encryptMessage(content, familyKey);

    // Send to server
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: selectedChannelId,
        encryptedContent: encrypted,
      }),
    });

    // Real-time subscription will handle adding to UI
  };

  return (
    <div className="flex h-screen">
      <ChannelSelector
        channels={channels}
        selectedChannelId={selectedChannelId}
        onSelectChannel={setSelectedChannelId}
      />
      <div className="flex-1 flex flex-col">
        <MessageList messages={messages} currentUserId={user?.id} />
        <MessageInput onSend={handleSendMessage} />
      </div>
    </div>
  );
}
```

---

#### Component: Message Bubble

**File:** `components/chat/message-bubble.tsx`

**Props:**
```typescript
interface MessageBubbleProps {
  message: {
    id: string;
    content: string; // Decrypted plaintext
    userId: string;
    user: {
      name: string;
      avatar: string | null;
    };
    timestamp: string;
    isEdited: boolean;
  };
  isOwnMessage: boolean;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string) => void;
}
```

**State Management:**
```typescript
const [showMenu, setShowMenu] = useState(false);
const [isEditing, setIsEditing] = useState(false);
const [editedContent, setEditedContent] = useState(message.content);
```

**Key Functions:**
- `handleEdit()` - Open edit mode
- `handleSave()` - Save edited message
- `handleDelete()` - Confirm and delete message
- `handleTranslate()` - Trigger translation (if needed)

**Integration Points:**
- Translation: `useTranslation()` hook (Groq API)
- Context Menu: Radix UI ContextMenu component

**Implementation:**
```tsx
'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { TranslationDisplay } from './translation-display';

export function MessageBubble({ message, isOwnMessage, onEdit, onDelete }: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);

  const handleSave = () => {
    onEdit(message.id, editedContent);
    setIsEditing(false);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className={`flex items-start gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
          <Avatar>
            <AvatarImage src={message.user.avatar || undefined} />
            <AvatarFallback>{message.user.name[0]}</AvatarFallback>
          </Avatar>

          <div className={`flex-1 ${isOwnMessage ? 'text-right' : ''}`}>
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{message.user.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
              </span>
              {message.isEdited && (
                <span className="text-xs text-muted-foreground">(edited)</span>
              )}
            </div>

            {isEditing ? (
              <div className="flex gap-2 mt-1">
                <Input
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
                <Button size="sm" onClick={handleSave}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm">{message.content}</p>
                <TranslationDisplay originalText={message.content} />
              </>
            )}
          </div>
        </div>
      </ContextMenuTrigger>

      {isOwnMessage && (
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setIsEditing(true)}>Edit</ContextMenuItem>
          <ContextMenuItem onClick={() => onDelete(message.id)} className="text-destructive">
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
```

---

#### Component: Translation Display

**File:** `components/chat/translation-display.tsx`

**Props:**
```typescript
interface TranslationDisplayProps {
  originalText: string;
}
```

**State Management:**
```typescript
const [translatedText, setTranslatedText] = useState<string | null>(null);
const [isTranslating, setIsTranslating] = useState(false);
```

**Key Functions:**
- `translateText(text, targetLang)` - Call Groq API (client-direct)
- `detectLanguage(text)` - Simple heuristic (Japanese chars vs Latin chars)

**Integration Points:**
- Groq API: Client-direct call (no server proxy)
- User preferences: `useAuth()` hook (user.preferences.language)

**Implementation:**
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { translateText } from '@/lib/groq/translation';

export function TranslationDisplay({ originalText }: TranslationDisplayProps) {
  const { user } = useAuth();
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (!user?.preferences?.preferredLanguage) return;

    // Auto-detect source language and translate to user's preferred language
    async function translate() {
      setIsTranslating(true);
      try {
        const targetLang = user.preferences.preferredLanguage;
        const result = await translateText(originalText, targetLang);

        // Only show translation if it's different from original
        // (Groq will return original if already in target language)
        if (result !== originalText) {
          setTranslatedText(result);
        }
      } catch (error) {
        console.error('Translation failed:', error);
        // Silently fail - show original message only
      } finally {
        setIsTranslating(false);
      }
    }

    translate();
  }, [originalText, user?.preferences?.preferredLanguage]);

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

---

### 3.4 Business Logic (lib/)

#### Module: Groq Translation

**File:** `lib/groq/translation.ts`

**Exports:**
```typescript
export async function translateText(text: string, targetLanguage: string): Promise<string>;
```

**Implementation:**
```typescript
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

export async function translateText(text: string, targetLanguageCode: string): Promise<string> {
  const targetLanguage = LANGUAGE_NAMES[targetLanguageCode] || 'English';

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
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
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}
```

**Note:** Groq API key is client-side (rate-limited by Groq). This preserves E2EE (server never sees plaintext).

---

#### Module: Realtime Subscriptions

**File:** `lib/hooks/use-realtime.ts`

**Exports:**
```typescript
export function useRealtime(
  channelId: string,
  callbacks: {
    onInsert: (message: Message) => void;
    onUpdate: (message: Message) => void;
    onDelete: (messageId: string) => void;
  }
): void;
```

**Implementation:**
```typescript
import { useEffect } from 'react';
import { createSupabaseClient } from '@/lib/supabase/client';

export function useRealtime(
  channelId: string,
  callbacks: {
    onInsert: (message: Message) => void;
    onUpdate: (message: Message) => void;
    onDelete: (messageId: string) => void;
  }
) {
  useEffect(() => {
    if (!channelId) return;

    const supabase = createSupabaseClient();

    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          callbacks.onInsert(payload.new as Message);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          callbacks.onUpdate(payload.new as Message);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          callbacks.onDelete(payload.old.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, callbacks]);
}
```

---

## 4. Error Handling

### 4.1 Client-Side Errors

**Encryption Errors:**
- Display toast: "Failed to send message. Please try again."
- Log error to console (don't expose crypto details)

**WebSocket Disconnection:**
- Show "Reconnecting..." indicator
- Auto-reconnect with exponential backoff (Supabase Realtime handles this)

**Translation Errors:**
- Show original message only (no translation)
- Log error: "Translation failed"

**Quiet Hours Blocked:**
- Display toast: "Cannot send messages during quiet hours (22:00 - 07:00)"

### 4.2 API Errors

**Error Response Format:**
```typescript
type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};
```

**Common Errors:**
- `QUIET_HOURS_ACTIVE` (403) - Cannot send during quiet hours
- `CHANNEL_NOT_FOUND` (404) - Channel does not exist
- `UNAUTHORIZED` (401) - Not authenticated
- `FORBIDDEN` (403) - Not in this channel's family
- `RATE_LIMIT_EXCEEDED` (429) - Too many messages

### 4.3 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **User switches channels mid-send** | Cancel previous channel subscription, load new channel |
| **Message sent while offline** | Queue in IndexedDB, retry on reconnection |
| **Duplicate messages (WebSocket + API)** | Deduplicate by message ID |
| **Edit message deleted by another user** | Return 404, show toast "Message no longer exists" |
| **Scheduled message time in past** | Reject with 400 "Scheduled time must be in the future" |
| **Groq API quota exceeded** | Disable translation temporarily, show "Translation unavailable" |

---

## 5. Testing Strategy

### 5.1 Unit Tests (Vitest)

**File:** `tests/unit/chat/translation.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { translateText } from '@/lib/groq/translation';

// Mock Groq API
global.fetch = vi.fn();

describe('Translation', () => {
  it('should translate English to Japanese', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'こんにちは' } }],
      }),
    });

    const result = await translateText('Hello', 'Japanese');
    expect(result).toBe('こんにちは');
  });

  it('should handle API errors gracefully', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Rate limit exceeded',
    });

    await expect(translateText('Test', 'Japanese')).rejects.toThrow('Groq API error');
  });
});
```

### 5.2 Integration Tests

**File:** `tests/integration/chat/message-flow.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { encryptMessage } from '@/lib/e2ee/encryption';
import { generateFamilyKey } from '@/lib/e2ee/key-management';

describe('Message Flow Integration', () => {
  let supabase;
  let familyKey;
  let channelId;

  beforeAll(async () => {
    supabase = createSupabaseServerClient();
    const { familyKey: key } = await generateFamilyKey();
    familyKey = key;

    // Create test channel
    const { data: channel } = await supabase.from('channels').insert({ name: 'Test' }).select().single();
    channelId = channel.id;
  });

  afterAll(async () => {
    await supabase.from('channels').delete().eq('id', channelId);
  });

  it('should send encrypted message and store in database', async () => {
    const plaintext = 'Integration test message';
    const encrypted = await encryptMessage(plaintext, familyKey);

    const response = await fetch('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId,
        encryptedContent: encrypted,
      }),
    });

    expect(response.status).toBe(200);

    // Verify stored in database
    const { data: message } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .single();

    expect(message.encrypted_content).toBe(encrypted);
  });
});
```

### 5.3 E2E Tests (Playwright)

**File:** `tests/e2e/chat/messaging.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Messaging Flow', () => {
  test('should send and receive message in real-time', async ({ page, context }) => {
    // User 1 logs in
    await page.goto('/login');
    await page.fill('[name="email"]', 'user1@test.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button:text("Login")');
    await expect(page).toHaveURL('/chat');

    // User 2 logs in (same family)
    const page2 = await context.newPage();
    await page2.goto('/login');
    await page2.fill('[name="email"]', 'user2@test.com');
    await page2.fill('[name="password"]', 'password123');
    await page2.click('button:text("Login")');
    await expect(page2).toHaveURL('/chat');

    // User 1 sends message
    await page.fill('[data-testid="message-input"]', 'Real-time test message');
    await page.click('button:text("Send")');

    // User 2 sees message appear (real-time)
    await expect(page2.locator('text=Real-time test message')).toBeVisible({ timeout: 3000 });
  });

  test('should edit message and show (edited) indicator', async ({ page }) => {
    await page.goto('/chat');

    // Send message
    await page.fill('[data-testid="message-input"]', 'Original message');
    await page.click('button:text("Send")');

    // Right-click to edit
    const message = page.locator('text=Original message').first();
    await message.click({ button: 'right' });
    await page.click('text=Edit');

    // Edit content
    await page.fill('[data-testid="edit-input"]', 'Edited message');
    await page.click('button:text("Save")');

    // Verify edited indicator
    await expect(page.locator('text=Edited message')).toBeVisible();
    await expect(page.locator('text=(edited)')).toBeVisible();
  });

  test('should delete message and remove for all users', async ({ page, context }) => {
    // Setup two users
    await page.goto('/chat');
    const page2 = await context.newPage();
    await page2.goto('/chat');

    // User 1 sends message
    await page.fill('[data-testid="message-input"]', 'Message to delete');
    await page.click('button:text("Send")');

    // User 2 sees message
    await expect(page2.locator('text=Message to delete')).toBeVisible();

    // User 1 deletes message
    const message = page.locator('text=Message to delete');
    await message.click({ button: 'right' });
    await page.click('text=Delete');
    await page.click('button:text("Confirm")');

    // Verify removed for both users
    await expect(page.locator('text=Message to delete')).not.toBeVisible();
    await expect(page2.locator('text=Message to delete')).not.toBeVisible({ timeout: 3000 });
  });

  test('should schedule message for future delivery', async ({ page }) => {
    await page.goto('/chat');

    // Open schedule modal
    await page.click('button[aria-label="Schedule message"]');

    // Fill form
    await page.fill('[data-testid="message-input"]', 'Scheduled birthday wish');
    await page.fill('[data-testid="schedule-date"]', '2025-12-25');
    await page.fill('[data-testid="schedule-time"]', '09:00');
    await page.click('button:text("Schedule")');

    // Verify success toast
    await expect(page.locator('text=Message scheduled')).toBeVisible();

    // View scheduled messages
    await page.click('button:text("Scheduled Messages")');
    await expect(page.locator('text=Scheduled birthday wish')).toBeVisible();
  });

  test('should translate Japanese message to English', async ({ page }) => {
    // Set user language to English
    await page.goto('/settings');
    await page.click('text=Language');
    await page.click('text=English');

    await page.goto('/chat');

    // Simulate receiving Japanese message (from another user)
    // Note: In real scenario, another user would send this
    // For test, we inject directly into the message feed

    // Verify translation appears below original
    await expect(page.locator('text=こんにちは')).toBeVisible(); // Original
    await expect(page.locator('text=Hello')).toBeVisible({ timeout: 5000 }); // Translation
  });
});
```

### 5.4 Acceptance Criteria Validation

| AC | Test Type | Validation Method |
|----|-----------|-------------------|
| **AC1.1:** Select channel from list | E2E | Click channel, verify URL/state changes |
| **AC1.2:** Type and send message | E2E | Fill input, click send, verify message appears |
| **AC1.3:** Message appears for all members | E2E | Two browser contexts, verify real-time delivery |
| **AC1.4:** Message encrypted before transmission | Integration | Verify network request contains ciphertext only |
| **AC2.1-2.4:** Edit message flow | E2E | Right-click, edit, verify (edited) indicator, real-time update |
| **AC3.1-3.4:** Delete message flow | E2E | Right-click, delete, confirm, verify removal |
| **AC4.1-4.5:** Schedule message flow | E2E | Open modal, set date/time, verify in scheduled list |
| **AC5.1-5.4:** Translation flow | E2E | Send Japanese message, verify English translation appears |

---

## 6. Security Considerations

### 6.1 Message Encryption

**All messages encrypted with AES-256-GCM (Epic 7):**
- Client encrypts before sending
- Server stores ciphertext only
- Recipients decrypt locally

**Metadata Visible to Server:**
- Sender ID, channel ID, timestamp (required for routing and RLS)
- Content is ciphertext (server cannot read)

### 6.2 WebSocket Security

**Supabase Realtime uses:**
- JWT authentication (same as REST API)
- WSS (WebSocket Secure - TLS 1.3)
- RLS policies applied to real-time events

**No additional security measures needed** (Supabase handles this)

### 6.3 Translation Privacy

**Groq API receives plaintext** (required for translation):
- Client-direct call (no server proxy)
- Temporary exposure (not stored by Groq per their terms)
- Acceptable tradeoff for UX (users want translation)

**Alternative (Phase 2):** Local translation model (Transformer.js) - no external API, but larger client bundle.

### 6.4 Rate Limiting

**Prevent spam and abuse:**
- 100 messages/minute per user (POST /api/messages)
- 10 scheduled messages/hour per user

**Implementation:** Vercel Edge Middleware + Redis (or in-memory cache for MVP)

---

## 7. Performance Targets

| Operation | Target Latency | Acceptable Max |
|-----------|---------------|----------------|
| **Send message** | < 500ms | < 2s (NFR-2.1) |
| **Receive message (real-time)** | < 500ms | < 2s |
| **Load message history (50 msgs)** | < 1s | < 3s |
| **Edit message** | < 300ms | < 1s |
| **Delete message** | < 300ms | < 1s |
| **Translate message** | < 2s | < 5s (external API) |
| **Schedule message** | < 500ms | < 1.5s |

**Optimization Strategies:**
- Pagination for message history (50 at a time)
- Virtual scrolling for long message lists (react-window)
- Debounce translation API calls (only translate visible messages)
- WebSocket connection reuse (single connection for all channels)

---

## 8. Implementation Checklist

### Week 1: Backend & Real-time
- [ ] Create messages, scheduled_messages, channels tables
- [ ] Implement RLS policies for all tables
- [ ] Implement POST /api/messages (send message)
- [ ] Implement GET /api/messages (paginated history)
- [ ] Implement PATCH /api/messages/:id (edit)
- [ ] Implement DELETE /api/messages/:id (delete)
- [ ] Implement POST /api/scheduled-messages (schedule)
- [ ] Implement GET /api/scheduled-messages (list)
- [ ] Implement DELETE /api/scheduled-messages/:id (cancel)
- [ ] Implement Vercel cron job for scheduled message delivery
- [ ] Set up Supabase Realtime subscriptions (test in Postman/curl)
- [ ] Write unit tests for API routes (95% coverage)

### Week 2: Frontend & Integration
- [ ] Implement Chat Screen layout (channel selector + message list + input)
- [ ] Implement ChannelSelector component
- [ ] Implement MessageList component (with virtual scrolling)
- [ ] Implement MessageBubble component (with context menu)
- [ ] Implement MessageInput component (textarea with send button)
- [ ] Implement real-time subscription hook (useRealtime)
- [ ] Integrate E2EE encryption/decryption (call Epic 7 functions)
- [ ] Implement edit message flow (inline editing)
- [ ] Implement delete message flow (with confirmation dialog)
- [ ] Implement schedule message modal (date/time picker)
- [ ] Implement ScheduledMessagesList component
- [ ] Implement TranslationDisplay component (Groq API integration)
- [ ] Test real-time updates (two browser windows, send/edit/delete)
- [ ] Write integration tests (message CRUD flows)
- [ ] Write E2E tests (Playwright scenarios)

### Week 2.5: Polish & Performance
- [ ] Implement quiet hours check (server-side API validation)
- [ ] Implement rate limiting (middleware)
- [ ] Optimize message list rendering (react-window for virtual scrolling)
- [ ] Implement offline message queue (IndexedDB)
- [ ] Error handling and user-facing error messages
- [ ] Performance testing (message latency benchmarks)
- [ ] Accessibility testing (keyboard navigation, screen readers)

---

## 9. Dependencies & Risks

**Depends On:**
- Epic 7: E2EE encryption/decryption functions
- Epic 1: Authentication (session management)

**Depended On By:**
- Epic 3: Photo comments (similar real-time pattern)

**Risks:**

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Supabase Realtime latency** | High | Low | Monitor latency, fallback to polling if needed |
| **Groq API quota exceeded** | Medium | Medium | Cache translations, implement rate limiting, local fallback |
| **WebSocket connection instability (mobile)** | High | Medium | Auto-reconnect, offline queue, retry logic |
| **Message encryption overhead** | Low | Very Low | Benchmark on low-end devices, use Web Workers if needed |
| **Scheduled messages not sent on time** | Medium | Low | Monitor cron job health, implement retry mechanism |

---

## 10. Acceptance Criteria

### US-2.1: Send Messages in Channels

- [ ] User selects channel from sidebar
- [ ] User types message in input field
- [ ] User clicks send button
- [ ] Message appears in selected channel immediately (optimistic UI)
- [ ] Message delivered to all family members in real-time (< 2s)
- [ ] Message encrypted before transmission (verify network logs show ciphertext)
- [ ] Message stored encrypted in database (verify `encrypted_content` is ciphertext)

### US-2.2: Edit Messages

- [ ] User right-clicks own message
- [ ] "Edit" option appears in context menu
- [ ] User clicks "Edit" and inline editor appears
- [ ] User modifies text and clicks "Save"
- [ ] Message updates for all members in real-time
- [ ] "(edited)" indicator appears next to timestamp
- [ ] Edited message still encrypted (verify database)

### US-2.3: Delete Messages

- [ ] User right-clicks own message
- [ ] "Delete" option appears in context menu
- [ ] User clicks "Delete" and confirmation dialog appears
- [ ] User confirms deletion
- [ ] Message removed for all members in real-time
- [ ] Toast notification: "Message deleted"
- [ ] Message removed from database (verify with SQL query)

### US-2.4: Schedule Messages

- [ ] User clicks "Schedule" button in message input
- [ ] Modal opens with message input, date picker, time picker
- [ ] User fills form and clicks "Schedule"
- [ ] Success toast: "Message scheduled for [date time]"
- [ ] Message appears in "Scheduled Messages" list
- [ ] At scheduled time, message delivered to channel
- [ ] User can view and cancel scheduled messages before delivery

### US-2.5: Multi-Language Translation

- [ ] Message displays in original language (sender's language)
- [ ] If message language differs from user's "Translate Messages To" setting, translation appears below (< 5s)
- [ ] Translation text is grayed out/italicized to distinguish from original
- [ ] Translation supports 20+ languages (en, ja, es, fr, de, zh, ko, pt, ru, ar, it, nl, pl, tr, vi, th, id, hi, sv, no)
- [ ] User's translation language set in Settings (Epic 5: preferences.preferredLanguage)
- [ ] Translation is automatic (no button to click)
- [ ] Groq/Llama auto-detects source language
- [ ] If already in target language, no translation shown
- [ ] If Groq API fails, original message still visible (graceful degradation)

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-13 | Claude (Tech Spec Generator) | Initial tech spec for Epic 2 |

---

**Status:** ✅ Ready for Implementation
