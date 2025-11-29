# Plugin API Alpha Specification

**Version:** 0.1.0-alpha
**Status:** Experimental
**Goal:** Validate adapter pattern and plugin architecture with minimal implementation

---

## Overview

Alpha release to test the portable app architecture pattern with a real plugin. Focus on:
1. Core adapter interfaces
2. Plugin manifest
3. Simple plugin execution
4. Message annotation output

**Out of scope for alpha:**
- Plugin marketplace/discovery
- Plugin installation UI
- Permission system
- Multi-step interactions
- Advanced OAuth flows

---

## Core Adapter Interfaces

### Storage Adapter

```typescript
interface StorageAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}
```

**Implementation notes:**
- Plugin storage is scoped to plugin ID automatically
- Uses IndexedDB with encryption (user's E2EE key)
- TTL in seconds (optional)

### LLM Adapter

```typescript
interface LLMAdapter {
  // Generic text completion
  complete(prompt: string, options?: {
    maxTokens?: number;
    temperature?: number;
  }): Promise<string>;

  // Structured JSON output with schema
  parseJSON<T>(prompt: string, schema?: Record<string, string>): Promise<T>;
}
```

**Implementation notes:**
- Routes to Chamo's server-side LLM proxy
- Messages decrypted client-side, sent to server for processing
- Free for plugins (Chamo covers API costs)
- Rate limiting applied per plugin

### OAuth Adapter

```typescript
interface OAuthAdapter {
  // Initiate OAuth flow (returns immediately, completes async)
  authorize(service: string, scopes: string[]): Promise<void>;

  // Get cached token (null if not authorized)
  getToken(service: string): Promise<string | null>;

  // Check if authorized
  isAuthorized(service: string): Promise<boolean>;
}
```

**Implementation notes:**
- PKCE flow managed by SDK
- Tokens stored in plugin storage (encrypted)
- Automatic token refresh
- Alpha: Only support Google OAuth

---

## Message Annotation API

```typescript
interface ChatAdapter {
  // Attach annotation to a message
  annotateMessage(messageId: string, annotation: MessageAnnotation): Promise<void>;

  // Get messages (for context)
  getMessages(messageIds: string[]): Promise<Message[]>;
}

// Generic UI primitives (not domain-specific)
type MessageAnnotation =
  | TextAnnotation
  | RichContentAnnotation
  | ActionResultAnnotation
  | MediaAnnotation;

interface BaseAnnotation {
  pluginId: string;
  icon?: string;
  collapsible?: boolean;
}

interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  content: string;
  format?: 'plain' | 'markdown';
  metadata?: Record<string, any>;
}

interface RichContentAnnotation extends BaseAnnotation {
  type: 'rich_content';
  fields: Array<{
    label: string;
    value: string;
    inline?: boolean;
  }>;
  metadata?: Record<string, any>;
}

interface ActionResultAnnotation extends BaseAnnotation {
  type: 'action_result';
  status: 'success' | 'error' | 'pending' | 'info';
  message: string;
  details?: {
    url?: string;
    timestamp?: string;
    [key: string]: any;
  };
  metadata?: Record<string, any>;
}

interface MediaAnnotation extends BaseAnnotation {
  type: 'media';
  mediaType: 'image' | 'video' | 'audio' | 'icon';
  url?: string;
  content?: string;
  caption?: string;
  metadata?: Record<string, any>;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
```

---

## Plugin Manifest

```yaml
# plugin.yaml
name: "message-icons"
version: "0.1.0"
description: "Attach emoji or custom icons to messages"
author:
  name: "Your Name"
  email: "you@example.com"

# Entry point
main: "dist/index.js"

# Permissions requested
permissions:
  - "storage"        # Access to plugin-scoped storage
  - "messages:read"  # Read selected messages
  - "messages:annotate"  # Add annotations to messages

# Alpha: No external APIs yet
external_apis: []

# UI configuration
display:
  icon: "icon.png"
  category: "utilities"
```

---

## Plugin Entry Point

```typescript
// src/index.tsx
import { PluginContext, Message } from '@chamo/plugin-sdk';

interface PluginContext {
  storage: StorageAdapter;
  llm: LLMAdapter;
  oauth: OAuthAdapter;
  chat: ChatAdapter;
  pluginId: string;
}

// Plugin entry point
export default async function execute(
  messages: Message[],
  context: PluginContext
): Promise<React.ReactElement> {

  // Your app component with adapters injected
  return (
    <YourApp
      storage={context.storage}
      llm={context.llm}
      oauth={context.oauth}
      initialMessages={messages}
      onComplete={(result) => {
        context.chat.annotateMessage(messages[0].id, {
          type: 'action_result',
          pluginId: context.pluginId,
          status: 'success',
          message: result.message,
          icon: '✅'
        });
      }}
    />
  );
}
```

---

## Alpha Implementation Plan

### Phase 1: Core SDK (~2 days)
- [ ] Create `@chamo/plugin-sdk` package
- [ ] Implement adapter interfaces
- [ ] Storage adapter (IndexedDB + encryption)
- [ ] LLM adapter (server-side proxy)
- [ ] OAuth adapter (Google only, PKCE flow)
- [ ] Chat adapter (annotateMessage)

### Phase 2: Plugin Loader (~1 day)
- [ ] Plugin manifest parser
- [ ] Web Worker isolation
- [ ] Plugin execution context
- [ ] Message passing between main thread and worker

### Phase 3: UI Integration (~2 days)
- [ ] Annotation rendering in chat UI
- [ ] Plugin trigger UI (select message → choose plugin)
- [ ] Generic annotation renderers (text, action_result, media)
- [ ] Enhanced rendering for known plugins (optional)

### Phase 4: Sample Plugin (~1 day)
- [ ] Build "Message Icons" plugin
- [ ] Test full flow: select message → run plugin → see annotation
- [ ] Document pain points

### Phase 5: Evaluation & Iteration (~1 day)
- [ ] List pain points
- [ ] Identify missing features
- [ ] Plan improvements
- [ ] Decision: MVP features for beta

**Total: ~7 days for alpha**

---

## Sample Plugin: Message Icons

Simple plugin to test the full stack without external dependencies.

```typescript
// message-icons-plugin/src/index.tsx
import { PluginContext, Message } from '@chamo/plugin-sdk';
import { useState } from 'react';

function IconPickerApp({
  storage,
  message,
  onComplete
}: {
  storage: StorageAdapter;
  message: Message;
  onComplete: (icon: string) => void;
}) {
  const [selectedIcon, setSelectedIcon] = useState<string>('');

  const popularEmojis = [
    "❤️", "👍", "😊", "🎉", "🔥", "✅",
    "❓", "⚠️", "💡", "📌", "🎯", "⭐"
  ];

  async function attachIcon() {
    // Save to recent icons
    const recent = await storage.get('recent_icons') || [];
    await storage.set('recent_icons', [selectedIcon, ...recent.slice(0, 9)]);

    onComplete(selectedIcon);
  }

  return (
    <div className="icon-picker">
      <h3>Choose an icon for this message</h3>
      <div className="emoji-grid">
        {popularEmojis.map(emoji => (
          <button
            key={emoji}
            onClick={() => setSelectedIcon(emoji)}
            className={selectedIcon === emoji ? 'selected' : ''}
          >
            {emoji}
          </button>
        ))}
      </div>
      <button onClick={attachIcon} disabled={!selectedIcon}>
        Attach Icon
      </button>
    </div>
  );
}

export default async function execute(
  messages: Message[],
  context: PluginContext
): Promise<React.ReactElement> {
  return (
    <IconPickerApp
      storage={context.storage}
      message={messages[0]}
      onComplete={(icon) => {
        context.chat.annotateMessage(messages[0].id, {
          type: 'media',
          pluginId: context.pluginId,
          mediaType: 'icon',
          content: icon,
          metadata: { iconType: 'emoji' },
          icon,
          collapsible: false
        });
      }}
    />
  );
}
```

---

## Success Criteria for Alpha

1. ✅ Can load and execute a plugin in Web Worker
2. ✅ Plugin can use storage adapter (save/load data)
3. ✅ Plugin can call LLM adapter (simple prompt)
4. ✅ Plugin can output via annotateMessage
5. ✅ Annotation renders correctly in chat UI
6. ✅ Same plugin code works with different adapters (portable)
7. ✅ Developer experience feels like "building a web app"

---

## Next Steps After Alpha

1. **Gather feedback** from building sample plugin
2. **Create full epic** in BMM for production implementation
3. **Define MVP scope** based on alpha learnings
4. **Add missing features** identified during alpha
5. **Plan beta release** with multiple sample plugins

---

## Questions to Answer During Alpha

- [ ] Is the adapter pattern ergonomic for developers?
- [ ] Are we missing any critical adapters?
- [ ] Is the plugin manifest sufficient?
- [ ] Does Web Worker isolation work well?
- [ ] Are annotation types generic enough?
- [ ] Is the OAuth flow smooth for users?
- [ ] What pain points emerge during development?
