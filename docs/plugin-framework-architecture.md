# Plugin Framework Architecture for Chamo

**Document Version:** 1.0
**Date:** 2025-11-24
**Author:** Winston (Architect Agent)
**Status:** Proposal / Design Phase

---

## Executive Summary

This document outlines the architectural design for Chamo's plugin framework, enabling developers to easily create function plugins that users can apply to messages. The framework combines proven patterns from Slack Bolt, MCP (Model Context Protocol), and Figma's security model to deliver a secure, scalable, and developer-friendly plugin system with native LLM integration.

### Key Features

- **Developer-Friendly SDK**: TypeScript-based with class patterns and comprehensive abstractions
- **LLM-Native Integration**: Built-in support for Claude and other LLMs via MCP-inspired interface
- **Process Isolation Security**: Plugins run in isolated processes with resource limits
- **Multi-Step Interactions**: State machine-based flows for complex user interactions
- **OAuth 2.1 with PKCE**: Modern, secure authentication for external API access
- **Declarative Manifests**: YAML-based capability declaration for transparency and validation

---

## Table of Contents

1. [Research Foundation](#research-foundation)
2. [Core Architecture](#core-architecture)
3. [Plugin Manifest Design](#plugin-manifest-design)
4. [Developer SDK](#developer-sdk)
5. [Plugin Examples: Simple vs Complex](#plugin-examples-simple-vs-complex)
6. [Multi-Step Flow State Machine](#multi-step-flow-state-machine)
7. [Security Architecture](#security-architecture)
8. [LLM Context Management](#llm-context-management)
9. [Plugin Discovery & Registry](#plugin-discovery--registry)
10. [Rate Limiting & Quotas](#rate-limiting--quotas)
11. [Monitoring & Observability](#monitoring--observability)
12. [Versioning & Breaking Changes](#versioning--breaking-changes)
13. [Implementation Phases](#implementation-phases)
14. [Architectural Decisions](#architectural-decisions)
15. [Open Questions](#open-questions)

---

## Research Foundation

This architecture is informed by comprehensive research into modern plugin frameworks:

### Platforms Analyzed

1. **Slack Bolt Framework**: Event-driven listener pattern, OAuth handling, Block Kit interactions
2. **Discord Bot Architecture**: Application commands, interaction patterns, permissions system
3. **Microsoft Teams App Platform**: Manifest system, message extensions, OAuth integration
4. **WhatsApp Business API**: Template system, interactive components, message flows
5. **Claude MCP (Model Context Protocol)**: Universal AI tool integration standard
6. **Figma Plugin System**: Dual-execution model, QuickJS sandboxing, security-first approach
7. **ChatGPT Plugins**: Discovery manifests, OpenAPI definitions, OAuth flows

### Key Insights

- **Manifest-Based Discovery**: Pre-declare capabilities for platform validation
- **Process Isolation**: Separate plugin execution from host application
- **Capability-Based Security**: Explicit permission grants, deny-by-default
- **Async-First Design**: Acknowledge immediately, process in background
- **State Persistence**: External storage (Redis) for multi-step interactions
- **OAuth 2.1 with PKCE**: Modern standard for secure external API access

---

## Core Architecture

### Critical Constraint: End-to-End Encryption (E2EE)

**IMPORTANT**: Chamo uses E2E encryption, meaning messages are encrypted on the server. Therefore, **plugins MUST execute client-side** where messages are decrypted. This fundamentally shapes the architecture:

- ✅ Plugins run in browser/app (client-side)
- ✅ Access to decrypted message content
- ✅ Web Workers for isolation (not Node.js processes)
- ✅ Client-side storage (encrypted or IndexedDB)
- ❌ Cannot run plugins server-side (no access to plaintext)

This matches the current implementation approach (e.g., translation runs client-side).

### Recommended Pattern: Hybrid MCP + Slack Bolt (Client-Side)

Combine two proven approaches, adapted for client-side execution:
1. **MCP** for plugin interface (LLM-native tool integration)
2. **Slack Bolt** patterns for developer experience
3. **Web Workers** for isolation (browser equivalent of process isolation)

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Chamo Client (Browser/App)                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Chat UI Layer                                        │  │
│  │  - Message decryption (E2EE)                          │  │
│  │  - Message selection                                  │  │
│  │  - Plugin chooser                                     │  │
│  │  - Conversation thread                                │  │
│  └───────────────┬───────────────────────────────────────┘  │
│                  │                                           │
│  ┌───────────────▼───────────────────────────────────────┐  │
│  │  Plugin Orchestrator (Client-Side TypeScript)        │  │
│  │  - Plugin registry & discovery                        │  │
│  │  - Permission enforcement                             │  │
│  │  - Context management (decrypted messages)            │  │
│  │  - State machine for multi-step flows                 │  │
│  │  - Web Worker pool management                         │  │
│  └───────────────┬───────────────────────────────────────┘  │
│                  │                                           │
│         ┌────────┴────────┐                                 │
│         │                 │                                  │
│  ┌──────▼──────┐   ┌─────▼─────────────────────────────┐   │
│  │  LLM Proxy  │   │  Plugin Web Workers (Isolated)    │   │
│  │  (Client→   │   │  - Sandboxed execution contexts   │   │
│  │   Server)   │   │  - Resource limits                │   │
│  └─────────────┘   │  - Crash containment              │   │
│                    └─────┬─────────────────────────────┘   │
│                          │                                  │
│              ┌───────────┼───────────┐                      │
│              │           │           │                      │
│         ┌────▼───┐  ┌───▼────┐  ┌──▼──────┐               │
│         │Plugin A│  │Plugin B│  │Plugin C │               │
│         │(Icons) │  │(Trans) │  │(Cal)    │               │
│         └────────┘  └────────┘  └──┬──────┘               │
│                                     │                       │
└─────────────────────────────────────┼───────────────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │  External APIs          │
                         │  (from client via CORS) │
                         │  - Google Calendar      │
                         │  - Todoist, GitHub      │
                         └─────────────────────────┘
```

### Component Responsibilities

**Chamo Chat UI (Client-Side):**
- **Message decryption** (E2EE decryption happens here)
- Message selection interface
- Plugin discovery and installation
- Multi-step interaction UI rendering
- OAuth consent flows (PKCE in browser)

**Plugin Orchestrator (Client-Side):**
- Plugin lifecycle management
- **Context assembly with decrypted messages**
- State machine execution
- Permission enforcement
- Rate limiting (client-side quotas)
- Metrics collection
- Web Worker pool management

**LLM Proxy (Client → Server):**
- Forwards LLM requests from client to server
- Server validates user has quota/permissions
- Server calls Claude API
- Response returned to client
- **Plaintext messages never stored on server**

**Plugin Web Workers (Client-Side Isolation):**
- Sandboxed JavaScript execution
- Resource limits (memory, CPU time)
- Timeout management
- Crash isolation (worker crash ≠ app crash)
- Message passing with main thread

**Individual Plugins (Running in Web Workers):**
- Business logic implementation
- **Access to decrypted message content**
- External API integration (via CORS)
- Custom UI components (rendered by main thread)
- Data transformation

---

## Plugin Manifest Design

Declarative YAML manifest inspired by Slack, Teams, and MCP:

```yaml
# plugin.yaml
name: "google-calendar-reminder"
version: "1.0.0"
description: "Create calendar reminders from messages"

# MCP-style capability declaration
capabilities:
  - type: "tool"
    name: "create_reminder"
    description: "Creates a calendar reminder from message content"

    # What the plugin needs access to
    required_context:
      - "selected_messages"  # Messages user selected
      - "chat_history"       # Recent conversation context
      - "user_timezone"      # For date/time parsing

    # External APIs this plugin calls
    external_apis:
      - service: "google_calendar"
        scopes: ["calendar.events"]
        oauth_config:
          client_id: "${GOOGLE_CLIENT_ID}"
          auth_url: "https://accounts.google.com/o/oauth2/v2/auth"
          token_url: "https://oauth2.googleapis.com/token"

    # Multi-step interaction flow
    interaction_flow:
      - step: "parse_message"
        llm_required: true
        prompt_template: "templates/parse_reminder.txt"

      - step: "confirm_details"
        ui_type: "form"
        fields:
          - name: "title"
            type: "text"
            prefilled: true
          - name: "date"
            type: "datetime"
            prefilled: true
          - name: "recurrence"
            type: "select"
            options: ["once", "daily", "weekly", "monthly"]

      - step: "create_event"
        llm_required: false
        api_call: "google_calendar.events.create"

# Security & resource limits
security:
  sandbox: "process"  # Run in isolated process
  max_execution_time: 30000  # 30 seconds
  max_memory_mb: 256
  network_access: ["googleapis.com"]

# Developer info
author:
  name: "Nick"
  email: "nick@chamo.app"

# Display info
display:
  icon: "calendar.png"
  screenshots:
    - "screenshot1.png"
    - "screenshot2.png"
  category: "productivity"
  tags: ["calendar", "reminders", "google"]
```

### Manifest Validation

The orchestrator validates manifests on plugin installation:

- Required fields present
- Valid semver version
- OAuth URLs are HTTPS
- Network access domains are valid
- Resource limits within platform maximums
- No conflicting capability names

---

## Developer SDK

### Philosophy: Build Web Apps, Get Chat Context for Free

**Core Principle**: Plugin development should feel like building a standalone web app. The SDK provides **easy access to chat context** as a bonus, not as a burden.

#### Standalone App vs Plugin

```typescript
// ❌ What we DON'T want: Complex plugin-specific APIs
class MyPlugin extends ChamoPlugin {
  async execute(context: PluginContext) {
    await this.initializeFramework();
    await this.registerHandlers();
    const messages = await this.getMessagesFromContext(context);
    // ... lots of boilerplate
  }
}

// ✅ What we DO want: Just build your app
export default function TranslationApp({ messages, onComplete }) {
  const [targetLang, setTargetLang] = useState('es');
  const [translation, setTranslation] = useState(null);

  async function translate() {
    // Use Chamo's LLM API - just like calling any API
    const result = await chamo.llm.translate(messages[0].content, targetLang);
    setTranslation(result);
  }

  return (
    <div>
      <LanguageSelector value={targetLang} onChange={setTargetLang} />
      <button onClick={translate}>Translate</button>
      {translation && <Result text={translation} />}
    </div>
  );
}
```

**Key DX Goals:**

1. **Familiar patterns** - Use React, Vue, or vanilla JS (developer's choice)
2. **Standard web APIs** - fetch(), localStorage, IndexedDB work as expected
3. **Chat context as props** - Messages passed in like any other data
4. **Progressive complexity** - Start simple, add features when needed
5. **No lock-in** - Plugin code is just JavaScript, easily testable

### Comparison: Building vs Not Building a Plugin

| Task | Without Chamo | As Chamo Plugin | Benefit |
|------|---------------|-----------------|---------|
| **Get user input** | Build forms, validation | `messages` prop | Input already captured |
| **Call LLM** | Manage API keys, billing, quotas | `chamo.llm.*` API | Free LLM access |
| **Store data** | Set up database, auth, backups | `chamo.storage.*` | Encrypted storage included |
| **Deploy** | Set up hosting, domains, SSL | `chamo-plugin publish` | One-command deploy |
| **OAuth** | Implement PKCE, manage tokens | `chamo.oauth.connect()` | Handled by platform |
| **Updates** | Push to CDN, cache invalidation | Publish new version | Instant user updates |
| **Discovery** | Marketing, SEO, ads | Plugin marketplace | Built-in distribution |

**Key insight**: A plugin is **easier to build** than a standalone app because Chamo provides the infrastructure. You just focus on the logic.

### Real Example: Translation in 20 Lines

```typescript
// This is the ENTIRE plugin code - no boilerplate!
import { chamo } from '@chamo/plugin-sdk';

export default function TranslatePlugin({ messages, annotateMessage }) {
  const [lang, setLang] = useState('es');
  const [loading, setLoading] = useState(false);

  async function translate() {
    setLoading(true);
    const translation = await chamo.llm.translate(messages[0].content, lang);

    // Attach translation to the original message (like current implementation)
    annotateMessage(messages[0].id, {
      type: 'translation',
      content: translation,
      language: lang
    });

    setLoading(false);
  }

  return (
    <div>
      <select value={lang} onChange={e => setLang(e.target.value)}>
        <option value="es">Spanish</option>
        <option value="fr">French</option>
      </select>
      <button onClick={translate} disabled={loading}>
        {loading ? 'Translating...' : 'Translate'}
      </button>
    </div>
  );
}
```

**That's it!** 25 lines. Translation appears **attached to the original message**, matching current behavior.

### Architecture Pattern: Portable Apps → Plugins

**Question**: "If I'm building a standalone reminder app that might become a Chamo plugin later, how should I architect it?"

**Answer**: Use the **Adapter Pattern** to abstract external dependencies. Your app will work standalone AND as a plugin with minimal changes.

#### Step 1: Build Your App with Adapters

```typescript
// 1. Define adapters ONLY for things that differ between standalone/plugin
interface StorageAdapter {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
}

interface LLMAdapter {
  // Generic text completion
  complete(prompt: string): Promise<string>;

  // Structured output with JSON schema (preferred for type safety)
  parseJSON<T>(prompt: string, schema?: Record<string, string>): Promise<T>;
}

interface OAuthAdapter {
  authorize(service: string, scopes: string[]): Promise<string>; // Returns access token
  getToken(service: string): Promise<string | null>; // Get cached token
}

// 2. Build your app component (framework-agnostic)
function ReminderApp({
  storage,        // Injected adapter
  llm,            // Injected adapter
  oauth,          // Injected adapter
  initialMessage, // Optional: pre-filled from chat
  onComplete      // Optional: callback when done
}: {
  storage: StorageAdapter;
  llm: LLMAdapter;
  oauth: OAuthAdapter;
  initialMessage?: string;
  onComplete?: (result: EventResult) => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [recurrence, setRecurrence] = useState('once');
  const [loading, setLoading] = useState(false);

  // Auto-parse initial message with LLM
  useEffect(() => {
    if (initialMessage) {
      parseInitialMessage();
    }
  }, [initialMessage]);

  async function parseInitialMessage() {
    setLoading(true);
    try {
      // App-specific prompt and schema - not in the adapter!
      const parsed = await llm.parseJSON<ReminderDraft>(
        `Extract reminder details from: "${initialMessage}"\n\n` +
        `Return JSON with:\n` +
        `- title: string (the reminder title)\n` +
        `- datetime: string (ISO 8601 format)\n` +
        `- recurrence: "once" | "daily" | "weekly" | "monthly"`,
        { title: 'string', datetime: 'string', recurrence: 'string' }
      );

      setTitle(parsed.title);
      setDate(parsed.datetime);
      setRecurrence(parsed.recurrence || 'once');
    } catch (error) {
      // Fallback: just use raw message as title
      setTitle(initialMessage);
    }
    setLoading(false);
  }

  async function createReminder() {
    // Get OAuth token (adapter handles the flow)
    const token = await oauth.getToken('google-calendar');
    if (!token) {
      await oauth.authorize('google-calendar', [
        'https://www.googleapis.com/auth/calendar.events'
      ]);
      return; // Will retry after OAuth redirect/completion
    }

    // Call Google Calendar API directly - same in standalone and plugin!
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: title,
        start: {
          dateTime: new Date(date).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: new Date(new Date(date).getTime() + 3600000).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        recurrence: recurrence !== 'once' ? [`RRULE:FREQ=${recurrence.toUpperCase()}`] : undefined
      })
    });

    const event = await response.json();
    await storage.set('last_reminder', { title, date });

    onComplete?.({
      eventId: event.id,
      url: event.htmlLink
    });
  }

  return (
    <div>
      <input value={title} onChange={e => setTitle(e.target.value)} />
      <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
      <select value={recurrence} onChange={e => setRecurrence(e.target.value)}>
        <option value="once">Once</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
      </select>
      <button onClick={createReminder}>Create Reminder</button>
    </div>
  );
}
```

#### Step 2: Standalone App Uses Browser APIs

```typescript
// standalone-app/index.tsx
import { ReminderApp } from './ReminderApp';

// Browser-based adapters
const browserStorage: StorageAdapter = {
  get: async (key) => JSON.parse(localStorage.getItem(key) || 'null'),
  set: async (key, value) => localStorage.setItem(key, JSON.stringify(value))
};

const anthropicLLM: LLMAdapter = {
  complete: async (prompt) => {
    // Call Claude API directly - you manage API key and billing
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    return data.content[0].text;
  },

  parseJSON: async (prompt, schema) => {
    // Use tool use for structured output
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        tools: schema ? [{
          name: 'return_result',
          description: 'Return the extracted data',
          input_schema: {
            type: 'object',
            properties: Object.fromEntries(
              Object.entries(schema).map(([k, v]) => [k, { type: v }])
            ),
            required: Object.keys(schema)
          }
        }] : undefined,
        tool_choice: schema ? { type: 'tool', name: 'return_result' } : undefined
      })
    });

    const data = await response.json();
    return schema ? data.content[0].input : JSON.parse(data.content[0].text);
  }
};

const browserOAuth: OAuthAdapter = {
  authorize: async (service, scopes) => {
    // Standard OAuth2 PKCE flow for SPAs
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    localStorage.setItem('pkce_verifier', codeVerifier);
    localStorage.setItem('oauth_service', service);

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: window.location.origin + '/oauth/callback',
      response_type: 'code',
      scope: scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },

  getToken: async (service) => {
    return localStorage.getItem(`${service}_token`);
  }
};

// Render standalone app
ReactDOM.render(
  <ReminderApp
    storage={browserStorage}
    llm={anthropicLLM}
    oauth={browserOAuth}
    onComplete={(result) => {
      alert(`Reminder created! Event ID: ${result.eventId}`);
    }}
  />,
  document.getElementById('root')
);
```

#### Step 3: Plugin Uses Chamo SDK Adapters

```typescript
// chamo-plugin/index.tsx
import { ChamoPlugin } from '@chamo/plugin-sdk';
import { ReminderApp } from './ReminderApp'; // Same component!

export default class ReminderPlugin extends ChamoPlugin {

  async execute(messages: Message[]) {
    // Chamo-based adapters (just wrappers around SDK)
    const chamoStorage: StorageAdapter = {
      get: (key) => this.storage.get(key),
      set: (key, value) => this.storage.set(key, value)
    };

    const chamoLLM: LLMAdapter = {
      complete: async (prompt) => {
        // Use Chamo's server-side LLM proxy - FREE for plugins!
        // No API key management, no billing, handles E2EE properly
        return await this.llm.complete(prompt);
      },

      parseJSON: async (prompt, schema) => {
        // Chamo SDK handles structured output automatically
        return await this.llm.parseJSON(prompt, schema);
      }
    };

    const chamoOAuth: OAuthAdapter = {
      authorize: async (service, scopes) => {
        // SDK handles OAuth PKCE flow automatically (in-app, no redirect!)
        await this.oauth.authorize(service, { scopes });
      },

      getToken: async (service) => {
        // SDK manages tokens, refreshes, etc.
        return await this.oauth.getToken(service);
      }
    };

    // Extract message text as initial value
    const initialMessage = messages[0]?.content;

    // Render the SAME component with different adapters!
    // Note: Google Calendar API calls inside the component are IDENTICAL!
    return (
      <ReminderApp
        storage={chamoStorage}
        llm={chamoLLM}
        oauth={chamoOAuth}
        initialMessage={initialMessage}
        onComplete={(result) => {
          // Output via Chamo annotation API
          this.chat.annotateMessage(messages[0].id, {
            type: 'action_result',
            pluginId: 'google-calendar',
            status: 'success',
            message: `Created reminder: "${result.title}"`,
            details: {
              url: result.url,
              timestamp: new Date().toISOString()
            },
            icon: '📅'
          });
        }}
      />
    );
  }
}
```

#### What Changed? Almost Nothing!

**Standalone → Plugin conversion:**
1. ✅ Swap `browserStorage` → `chamoStorage` (3 lines)
2. ✅ Swap `anthropicLLM` → `chamoLLM` (5 lines)
3. ✅ Swap `browserOAuth` → `chamoOAuth` (3 lines)
4. ✅ Add `initialMessage` prop (1 line)
5. ✅ Change `onComplete` callback (1 line)

**Your app logic:** ✅ **Zero changes** - same component, same business logic, same UI, **same Google Calendar API calls!**

#### Key Benefits

| Aspect | Standalone App | Chamo Plugin | Effort to Convert |
|--------|----------------|--------------|-------------------|
| **Core component** | `ReminderApp.tsx` | Same file | 0% |
| **Business logic** | Inside component | Unchanged | 0% |
| **UI/UX** | React components | Same components | 0% |
| **External API calls** | `fetch()` to Google/Todoist/etc. | **Identical!** | 0% ✅ |
| **Storage** | `localStorage` adapter | `chamoStorage` adapter | ~3 lines |
| **LLM** | Anthropic API + API key + billing | `chamoLLM` adapter (FREE!) | ~5 lines |
| **OAuth** | Manual PKCE flow | `chamoOAuth` adapter | ~3 lines |
| **Input** | User types | Pre-filled from message | +1 prop |
| **Output** | `alert()` / DOM | `annotateMessage()` | +1 method |

**Total conversion effort: ~15 minutes, 13 lines of code**

**Key advantage**: As a Chamo plugin, you get **free LLM access** through Chamo's server-side proxy. No API key management, no billing, and it properly handles E2EE (messages are decrypted client-side, sent to server for LLM processing, results returned).

#### Best Practices for Portable Apps

1. **Dependency Injection**: Never hardcode `localStorage`, `fetch`, LLM calls, etc. - inject adapters
2. **Component-Based**: Use React/Vue/Svelte components that accept props
3. **Pure Business Logic**: Keep core logic separate from I/O (easier to test too!)
4. **Callback Pattern**: Use `onComplete` instead of direct DOM manipulation
5. **Optional Chat Context**: Make message input optional (works standalone or plugin)
6. **Abstract All External Services**: Storage, LLM, OAuth, external APIs - everything gets an adapter

**Result**: You build a standalone app with good architecture, and porting to Chamo is trivial. Plus, as a plugin you get free LLM access!

### Plugin Output: `annotateMessage` API

**Key UX principle**: Plugin output should be **visually distinct** from user messages and **attached to the triggering message**.

#### Why Not Regular Messages?

```typescript
// ❌ BAD: Sends as if user wrote it
chamo.chat.sendMessage("Translation: Hola mundo");
// Problem: Looks like user sent it, clutters chat, no association with original

// ✅ GOOD: Attaches to original message
annotateMessage(messageId, {
  type: 'translation',
  content: 'Hola mundo',
  language: 'es'
});
// Result: Shows below/beside original message, clearly a plugin annotation
```

#### Visual Rendering (in Chat UI)

```
┌─────────────────────────────────────┐
│ Alice: Hello world                  │  ← Original message
│                                     │
│ 🌐 Translation Plugin               │  ← Plugin annotation (distinct styling)
│ Spanish: Hola mundo                 │  ← Plugin output
│ [Show more languages ▼]            │  ← Plugin UI can be interactive
└─────────────────────────────────────┘
```

**Benefits:**
- Clear visual distinction (not confused with user messages)
- Associated with context (which message was translated)
- Multiple annotations possible (translate + summarize same message)
- Doesn't pollute chat history
- Can be collapsed/hidden by user

#### Annotation Types

**Design Philosophy**: Following Slack's Block Kit model, we define annotation types based on **UI primitives** (how to render), not semantic meaning (what it represents). This keeps the framework generic and reusable across all plugins.

```typescript
// Base properties shared by all annotations
interface BaseAnnotation {
  pluginId: string;       // Which plugin created this (for enhanced rendering)
  icon?: string;          // Emoji or icon name
  collapsible?: boolean;  // Can user collapse it?
}

// Generic UI primitive types (like Slack's blocks)

interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  content: string;
  format?: 'plain' | 'markdown';
  metadata?: Record<string, any>;  // Plugin-specific data
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
    url?: string;         // Link to external resource
    timestamp?: string;   // ISO 8601
    [key: string]: any;   // Additional plugin-specific details
  };
  metadata?: Record<string, any>;
}

interface MediaAnnotation extends BaseAnnotation {
  type: 'media';
  mediaType: 'image' | 'video' | 'audio' | 'icon';
  url?: string;           // URL for images/videos
  content?: string;       // For inline content like emoji icons
  caption?: string;
  metadata?: Record<string, any>;
}

interface InteractiveAnnotation extends BaseAnnotation {
  type: 'interactive';
  componentId: string;    // Identifier for the interactive component
  content: string;        // Display text/description
  metadata?: Record<string, any>;
}

// Discriminated union based on UI rendering needs
type MessageAnnotation =
  | TextAnnotation
  | RichContentAnnotation
  | ActionResultAnnotation
  | MediaAnnotation
  | InteractiveAnnotation;
```

**Why This Design?**

1. **Generic & Reusable**: Like Slack's blocks, any plugin can use any annotation type. Translation, calendar, and sentiment analysis plugins can all use `TextAnnotation` if appropriate.

2. **UI Knows How to Render**: The UI has standard rendering logic for `text`, `rich_content`, `action_result`, etc. - these are layout primitives, not domain-specific types.

3. **Plugin Flexibility**: Plugins aren't restricted to predefined semantic types. Create any plugin you want and choose the appropriate UI primitive.

4. **Enhanced Rendering via pluginId**: The UI can check `pluginId` to provide enhanced rendering for known plugins (e.g., show language badges for translation plugin), while still having generic fallback rendering.

5. **Type Safety Where It Matters**: TypeScript enforces structure (`type`, `pluginId`, required fields) while keeping `metadata` flexible for plugin-specific data.

**Examples:**

```typescript
// Translation plugin uses TextAnnotation (simple text output)
annotateMessage(msgId, {
  type: 'text',
  pluginId: 'translation',
  content: 'Hola mundo',
  format: 'plain',
  metadata: {
    targetLanguage: 'es',
    confidence: 0.95,
    originalLanguage: 'en'
  },
  icon: '🌐',
  collapsible: true
});

// Calendar plugin uses ActionResultAnnotation (confirms an action was taken)
annotateMessage(msgId, {
  type: 'action_result',
  pluginId: 'google-calendar',
  status: 'success',
  message: 'Created calendar event: "Take out trash"',
  details: {
    url: 'https://calendar.google.com/event?id=abc123',
    timestamp: '2025-11-24T20:00:00Z'
  },
  metadata: {
    eventId: 'cal_123',
    recurrence: 'weekly'
  },
  icon: '📅'
});

// Todoist plugin also uses ActionResultAnnotation (same generic type, different plugin)
annotateMessage(msgId, {
  type: 'action_result',
  pluginId: 'todoist',
  status: 'success',
  message: 'Task created in Todoist',
  details: {
    url: 'https://todoist.com/task/456'
  },
  metadata: {
    taskId: 'task_456',
    priority: 3
  },
  icon: '✅'
});

// Icon plugin uses MediaAnnotation
annotateMessage(msgId, {
  type: 'media',
  pluginId: 'message-icons',
  mediaType: 'icon',
  content: '⚠️',
  metadata: { iconType: 'emoji' },
  icon: '⚠️',
  collapsible: false
});

// Sentiment analysis uses RichContentAnnotation (structured data display)
annotateMessage(msgId, {
  type: 'rich_content',
  pluginId: 'sentiment-analysis',
  fields: [
    { label: 'Sentiment', value: 'Positive', inline: true },
    { label: 'Confidence', value: '85%', inline: true },
    { label: 'Emotions', value: 'joy, excitement', inline: false }
  ],
  metadata: {
    sentiment: 'positive',
    confidence: 0.85,
    emotions: ['joy', 'excitement']
  },
  icon: '😊'
});
```

#### How the UI Renders Each Type

The UI has generic rendering logic for each annotation type, with optional enhanced rendering for known plugins.

**TextAnnotation (Generic Rendering):**
```
┌─────────────────────────────────────┐
│ User: Hello world                   │
│                                     │
│ 🌐 Translation Plugin               │  ← pluginId displayed
│ Hola mundo                          │  ← content rendered as plain/markdown
│ [Collapse ▲]                        │  ← collapsible: true
└─────────────────────────────────────┘
```

**TextAnnotation (Enhanced for `pluginId: 'translation'`):**
```
┌─────────────────────────────────────┐
│ User: Hello world                   │
│                                     │
│ 🌐 Spanish (95% confident)          │  ← UI reads metadata for language badge
│ Hola mundo                          │
│ en → es                             │  ← UI formats originalLanguage → targetLanguage
│ [Collapse ▲]                        │
└─────────────────────────────────────┘
```

**ActionResultAnnotation (Generic Rendering):**
```
┌─────────────────────────────────────┐
│ User: Take out trash tonight        │
│                                     │
│ ✅ Google Calendar Plugin           │  ← Shows status icon + pluginId
│ Created calendar event              │  ← message field
│ [View →]                            │  ← Link from details.url
└─────────────────────────────────────┘
```

**ActionResultAnnotation (Enhanced for `pluginId: 'google-calendar'`):**
```
┌─────────────────────────────────────┐
│ User: Take out trash tonight        │
│                                     │
│ 📅 Event Created                    │
│ "Take out trash"                    │
│ Tonight at 8:00 PM                  │  ← UI formats details.timestamp
│ Repeats: Weekly                     │  ← UI reads metadata.recurrence
│ [View in Calendar →]                │
└─────────────────────────────────────┘
```

**MediaAnnotation (Icon Display):**
```
┌─────────────────────────────────────┐
│ User: Important meeting tomorrow    │
│ ⚠️                                  │  ← content displayed, minimal styling
└─────────────────────────────────────┘
```

**RichContentAnnotation (Structured Data):**
```
┌─────────────────────────────────────┐
│ User: I love this feature!          │
│                                     │
│ 😊 Sentiment Analysis               │  ← pluginId displayed
│ Sentiment:    Positive              │  ← fields rendered as key-value pairs
│ Confidence:   85%                   │
│ Emotions:     joy, excitement       │
│ [View details ▼]                    │  ← Metadata shown in collapsed detail
└─────────────────────────────────────┘
```

**Key Benefits:**
1. **Generic fallback always works** - Any plugin can use any type and get reasonable rendering
2. **Known plugins get enhanced UX** - UI can check `pluginId` and provide rich formatting
3. **No restriction on new plugins** - Developers aren't limited to predefined semantic types
4. **Gradual enhancement** - Plugins work immediately, enhanced rendering can be added later

#### Current Implementation Reference

This matches how translation currently works in Chamo:
1. User selects message
2. Clicks "Translate"
3. Translation appears **attached to that message**
4. Visually distinct from regular chat messages
5. User can collapse/expand translations

**Migration path**: Existing translation feature already uses this pattern, just needs to be formalized as the `annotateMessage` API.

### SDK Design: Minimal, Familiar, Composable

The SDK is a **thin convenience layer**, not a framework:

```typescript
// example-plugin/index.ts
import { ChamoPlugin, Message, PluginContext } from '@chamo/plugin-sdk';

export default class CalendarReminderPlugin extends ChamoPlugin {

  // Step 1: LLM analyzes message
  async parseMessage(
    messages: Message[],
    context: PluginContext
  ): Promise<ReminderDraft> {

    // SDK handles LLM prompting automatically
    const parsed = await this.llm.parse({
      template: 'parse_reminder',
      context: {
        messages,
        user_timezone: context.user.timezone
      }
    });

    return {
      title: parsed.title,
      datetime: parsed.datetime,
      confidence: parsed.confidence
    };
  }

  // Step 2: User confirms/edits
  async confirmDetails(
    draft: ReminderDraft,
    context: PluginContext
  ): Promise<ReminderConfirmed> {

    // SDK renders form in chat UI
    const confirmed = await this.ui.form({
      title: "Confirm Reminder",
      fields: [
        { name: 'title', value: draft.title, type: 'text' },
        { name: 'datetime', value: draft.datetime, type: 'datetime' },
        { name: 'recurrence', type: 'select', options: ['once', 'daily', 'weekly'] }
      ]
    });

    return confirmed;
  }

  // Step 3: Create calendar event
  async createEvent(
    reminder: ReminderConfirmed,
    context: PluginContext
  ): Promise<void> {

    // SDK handles OAuth token management
    const calendar = await this.external.googleCalendar(context.user);

    await calendar.events.create({
      summary: reminder.title,
      start: { dateTime: reminder.datetime },
      recurrence: reminder.recurrence !== 'once'
        ? [`RRULE:FREQ=${reminder.recurrence.toUpperCase()}`]
        : undefined
    });

    // SDK sends success message to chat
    await this.chat.reply("✅ Reminder created!");
  }
}
```

### SDK API Surface

```typescript
// @chamo/plugin-sdk

export abstract class ChamoPlugin {
  // LLM integration
  protected llm: LLMClient;

  // UI rendering
  protected ui: UIClient;

  // External API access
  protected external: ExternalAPIClient;

  // Chat interaction
  protected chat: ChatClient;

  // Storage (plugin-scoped)
  protected storage: StorageClient;
}

export interface LLMClient {
  parse(options: {
    template: string;
    context: Record<string, any>;
  }): Promise<any>;

  generate(prompt: string): Promise<string>;
}

export interface UIClient {
  form(config: FormConfig): Promise<Record<string, any>>;
  confirm(message: string): Promise<boolean>;
  select(options: SelectOption[]): Promise<string>;
  iconPicker(config: IconPickerConfig): Promise<IconSelection>;
}

export interface ExternalAPIClient {
  googleCalendar(user: User): Promise<GoogleCalendarAPI>;
  github(user: User): Promise<GitHubAPI>;
  // More services...
}

export interface ChatClient {
  // Primary output method - attaches annotation to message
  annotateMessage(messageId: string, annotation: MessageAnnotation): Promise<void>;

  // Legacy/alternative output methods
  reply(message: string): Promise<void>;  // For plugins that need to send actual messages
  sendTyping(): Promise<void>;
  refreshMessages(messageIds: string[]): Promise<void>;
}

export interface StorageClient {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}
```

### Why This DX Works

1. **Class-Based Structure**: Familiar to most developers
2. **SDK Handles Complexity**: LLM prompting, OAuth, UI rendering abstracted
3. **Type-Safe**: TypeScript provides autocomplete and compile-time checks
4. **Clear Separation**: Parse → Confirm → Execute pattern
5. **Minimal Boilerplate**: Focus on business logic, not infrastructure

---

## Plugin Examples: Simple vs Complex

The architecture supports plugins across the full spectrum of complexity. Here we contrast two examples to demonstrate the flexibility of the framework.

### Example 1: Message Icons (Simple Plugin)

A lightweight plugin with no LLM, no external APIs, and instant execution.

#### Manifest

```yaml
# plugin.yaml
name: "message-icons"
version: "1.0.0"
description: "Attach emoji or custom icons to messages for quick visual tagging"

capabilities:
  - type: "tool"
    name: "attach_icon"
    description: "Attach an icon to a message"

    # Minimal permissions needed
    required_context:
      - "selected_messages"  # Just need the message ID

    # No external APIs!
    external_apis: []

    # Single-step interaction (no LLM, no multi-step)
    interaction_flow:
      - step: "select_icon"
        ui_type: "icon_picker"
        llm_required: false

      - step: "attach"
        llm_required: false

# Very permissive security (no network access needed)
security:
  sandbox: "process"
  max_execution_time: 5000  # 5 seconds max
  max_memory_mb: 128
  network_access: []  # No network needed!

author:
  name: "Chamo Team"
  email: "plugins@chamo.app"

display:
  icon: "icon-picker.png"
  category: "utilities"
  tags: ["emoji", "icons", "organization"]
```

#### Implementation

```typescript
// index.ts
import { ChamoPlugin, Message, PluginContext } from '@chamo/plugin-sdk';

interface IconSelection {
  type: 'emoji' | 'custom' | 'color-tag';
  value: string;
}

export default class MessageIconsPlugin extends ChamoPlugin {

  // Step 1: Show icon picker
  async selectIcon(
    messages: Message[],
    context: PluginContext
  ): Promise<IconSelection> {

    // SDK renders icon picker UI
    const selection = await this.ui.iconPicker({
      title: "Choose an icon",
      tabs: [
        {
          name: "Emojis",
          type: "emoji",
          items: this.getPopularEmojis()
        },
        {
          name: "Tags",
          type: "color-tag",
          items: [
            { label: "Important", color: "#ff0000", icon: "⚠️" },
            { label: "Done", color: "#00ff00", icon: "✅" },
            { label: "Question", color: "#ffaa00", icon: "❓" },
            { label: "Idea", color: "#00aaff", icon: "💡" }
          ]
        },
        {
          name: "Custom",
          type: "custom",
          allowUpload: context.user.isPro // Pro users can upload
        }
      ]
    });

    return selection;
  }

  // Step 2: Attach icon to message
  async attach(
    icon: IconSelection,
    messages: Message[],
    context: PluginContext
  ): Promise<void> {

    // Attach icon as annotation to each message
    for (const message of messages) {
      // Store in plugin storage for persistence
      await this.storage.set(
        `icon:${message.id}`,
        icon,
        90 * 24 * 60 * 60 // TTL: 90 days
      );

      // Display icon as message annotation (using MediaAnnotation)
      await this.chat.annotateMessage(message.id, {
        type: 'media',
        pluginId: 'message-icons',
        mediaType: 'icon',
        content: icon.value,
        metadata: { iconType: icon.type },
        icon: icon.value,
        collapsible: false
      });
    }
  }

  // Helper: Get popular emojis
  private getPopularEmojis(): string[] {
    return [
      "❤️", "👍", "😊", "🎉", "🔥", "✅", "❓", "⚠️",
      "💡", "📌", "🎯", "⭐", "👀", "💬", "📝", "🚀"
    ];
  }
}
```

#### User Flow

```
User selects message → Opens plugin menu → Clicks "Message Icons"
    ↓
Plugin Orchestrator spawns isolated process
    ↓
Plugin shows icon picker UI (rendered by Chamo UI layer)
    ↓
User selects emoji/icon
    ↓
Plugin stores icon association in Redis (plugin-scoped storage)
    ↓
UI refreshes to show icon on message
```

**Execution Time**: <100ms (no network, no LLM)

#### Plugin Storage Implementation

The SDK provides simple key-value storage automatically scoped to the plugin:

```typescript
// In Plugin SDK
class StorageClient {
  private pluginId: string;

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const scopedKey = `plugin:${this.pluginId}:${key}`;
    const serialized = JSON.stringify(value);

    if (ttl) {
      await redis.setex(scopedKey, ttl, serialized);
    } else {
      await redis.set(scopedKey, serialized);
    }
  }

  async get(key: string): Promise<any> {
    const scopedKey = `plugin:${this.pluginId}:${key}`;
    const value = await redis.get(scopedKey);
    return value ? JSON.parse(value) : null;
  }

  async delete(key: string): Promise<void> {
    const scopedKey = `plugin:${this.pluginId}:${key}`;
    await redis.del(scopedKey);
  }

  async keys(pattern: string): Promise<string[]> {
    const scopedPattern = `plugin:${this.pluginId}:${pattern}`;
    const keys = await redis.keys(scopedPattern);
    // Strip plugin prefix from returned keys
    return keys.map(k => k.replace(`plugin:${this.pluginId}:`, ''));
  }
}
```

#### UI Integration: Icon Picker Component

```typescript
// In Chamo Chat UI
interface IconPickerProps {
  title: string;
  tabs: IconTab[];
  onSelect: (selection: IconSelection) => void;
  onCancel: () => void;
}

function IconPicker({ title, tabs, onSelect, onCancel }: IconPickerProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Dialog open>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Tabs value={activeTab} onChange={setActiveTab}>
          {tabs.map((tab, i) => (
            <Tab key={i} label={tab.name} />
          ))}
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          {/* Emoji Grid */}
          <div className="emoji-grid">
            {tabs[0].items.map(emoji => (
              <button
                key={emoji}
                onClick={() => onSelect({ type: 'emoji', value: emoji })}
                className="emoji-button"
              >
                {emoji}
              </button>
            ))}
          </div>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {/* Color Tags */}
          <div className="tag-list">
            {tabs[1].items.map(tag => (
              <button
                key={tag.label}
                onClick={() => onSelect({ type: 'color-tag', value: tag.icon })}
                className="tag-button"
                style={{ backgroundColor: tag.color }}
              >
                {tag.icon} {tag.label}
              </button>
            ))}
          </div>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
```

#### Displaying Icons in Messages

```typescript
// In Message Component
function MessageWithPluginData({ message }: { message: Message }) {
  const [icon, setIcon] = useState<IconSelection | null>(null);

  useEffect(() => {
    // Fetch icon data from plugin storage
    pluginAPI.getMessageIcon(message.id).then(setIcon);
  }, [message.id]);

  return (
    <div className="message">
      {icon && (
        <span className="message-icon" title="Icon added by Message Icons plugin">
          {icon.value}
        </span>
      )}
      <MessageContent content={message.content} />
    </div>
  );
}
```

### Example 2: Message Translation (Medium Complexity)

A plugin that demonstrates LLM integration with caching, bridging simple and complex plugins. This functionality currently exists as a **built-in feature** in Chamo and serves as an excellent example of how existing features could be **migrated to the plugin architecture**.

#### Manifest

```yaml
# plugin.yaml
name: "message-translation"
version: "1.0.0"
description: "Translate messages to any language using AI"

capabilities:
  - type: "tool"
    name: "translate_message"
    description: "Translate message to target language"

    # Needs message content and user preferences
    required_context:
      - "selected_messages"
      - "user_locale"  # User's preferred language

    # No external APIs needed (uses Chamo's Claude API)
    external_apis: []

    # Two-step interaction
    interaction_flow:
      - step: "select_language"
        ui_type: "language_picker"
        llm_required: false

      - step: "translate"
        llm_required: true  # Uses LLM for translation

# Moderate security requirements
security:
  sandbox: "process"
  max_execution_time: 10000  # 10 seconds max
  max_memory_mb: 256
  network_access: []  # Uses Chamo's internal LLM API

author:
  name: "Chamo Team"
  email: "plugins@chamo.app"

display:
  icon: "translate.png"
  category: "utilities"
  tags: ["translation", "language", "international"]
```

#### Implementation

```typescript
// index.ts
import { ChamoPlugin, Message, PluginContext } from '@chamo/plugin-sdk';

interface Translation {
  originalText: string;
  translatedText: string;
  targetLanguage: string;
  confidence: number;
}

export default class MessageTranslationPlugin extends ChamoPlugin {

  // Step 1: Select target language
  async selectLanguage(
    messages: Message[],
    context: PluginContext
  ): Promise<string> {

    // Check cache first - maybe user frequently translates to Spanish
    const recentLanguages = await this.storage.get('recent_languages') || [];

    const selection = await this.ui.select({
      title: "Translate to...",
      options: [
        ...recentLanguages.slice(0, 3).map(lang => ({
          value: lang,
          label: this.getLanguageName(lang),
          icon: "🕐" // Recent
        })),
        { value: "es", label: "Spanish", icon: "🇪🇸" },
        { value: "fr", label: "French", icon: "🇫🇷" },
        { value: "de", label: "German", icon: "🇩🇪" },
        { value: "ja", label: "Japanese", icon: "🇯🇵" },
        { value: "zh", label: "Chinese", icon: "🇨🇳" },
        { value: "ar", label: "Arabic", icon: "🇸🇦" },
        { value: "hi", label: "Hindi", icon: "🇮🇳" },
        { value: "pt", label: "Portuguese", icon: "🇵🇹" },
        { value: "ru", label: "Russian", icon: "🇷🇺" },
        { value: "ko", label: "Korean", icon: "🇰🇷" }
      ]
    });

    return selection;
  }

  // Step 2: Translate message
  async translate(
    targetLanguage: string,
    messages: Message[],
    context: PluginContext
  ): Promise<void> {

    await this.chat.sendTyping(); // Show "translating..." indicator

    for (const message of messages) {
      // Check cache (translations are expensive)
      const cacheKey = `translation:${message.id}:${targetLanguage}`;
      let translation = await this.storage.get(cacheKey);

      if (!translation) {
        // Not cached, use LLM
        translation = await this.llm.parse({
          template: 'translate',
          context: {
            text: message.content,
            target_language: this.getLanguageName(targetLanguage),
            user_locale: context.user.locale
          }
        });

        // Cache for 30 days
        await this.storage.set(cacheKey, translation, 30 * 24 * 60 * 60);
      }

      // Display translation as annotation (using TextAnnotation)
      await this.chat.annotateMessage(message.id, {
        type: 'text',
        pluginId: 'translation',
        content: translation.translatedText,
        format: 'plain',
        metadata: {
          targetLanguage,
          confidence: translation.confidence,
          originalLanguage: message.metadata?.detectedLanguage
        },
        icon: '🌐',
        collapsible: true
      });
    }

    // Update recent languages
    await this.updateRecentLanguages(targetLanguage);
  }

  // Helper: Track recently used languages
  private async updateRecentLanguages(language: string): Promise<void> {
    let recent = await this.storage.get('recent_languages') || [];

    // Remove if already exists
    recent = recent.filter(l => l !== language);

    // Add to front
    recent.unshift(language);

    // Keep only last 5
    recent = recent.slice(0, 5);

    await this.storage.set('recent_languages', recent);
  }

  private getLanguageName(code: string): string {
    const names: Record<string, string> = {
      'es': 'Spanish', 'fr': 'French', 'de': 'German',
      'ja': 'Japanese', 'zh': 'Chinese', 'ar': 'Arabic',
      'hi': 'Hindi', 'pt': 'Portuguese', 'ru': 'Russian', 'ko': 'Korean'
    };
    return names[code] || code;
  }
}
```

#### LLM Prompt Template

```text
// templates/translate.txt

Translate the following text to {{target_language}}.

Original text:
"""
{{text}}
"""

Requirements:
- Preserve the tone and intent of the original message
- Use natural, conversational language in the target language
- If the text contains idioms or cultural references, adapt them appropriately
- Maintain any formatting (bold, italic) from the original

Provide your confidence level (0.0 to 1.0) based on:
- Clarity of the source text
- Ambiguity of translation
- Cultural context requirements

Return the translation using the translate_message tool.
```

#### User Flow

```
User selects message → Opens plugin menu → Clicks "Translate"
    ↓
Plugin shows language picker
    ↓
User selects target language
    ↓
Plugin checks cache (key: message_id + language)
    ↓
If cached: Display immediately (<50ms)
If not cached: Call LLM (1-2s) → Cache result → Display
    ↓
Translation appears in chat thread
```

#### Key Optimizations

**1. Caching Strategy**
```typescript
// Cache key includes message ID and target language
const cacheKey = `translation:${message.id}:${targetLanguage}`;

// Check before making expensive LLM call
let translation = await this.storage.get(cacheKey);

if (!translation) {
  translation = await this.llm.parse({...});
  await this.storage.set(cacheKey, translation, 30 * 24 * 60 * 60); // 30 days
}
```

**Benefits:**
- First translation: ~1-2s (LLM call)
- Subsequent translations: <50ms (cache hit)
- Reduces LLM costs by ~90% for popular translations
- 30-day TTL balances freshness vs cost

**2. Recent Languages**
```typescript
// Store user's recently used languages
await this.storage.set('recent_languages', ['es', 'fr', 'de']);

// Show as quick-access options
const recentLanguages = await this.storage.get('recent_languages') || [];
```

**Benefits:**
- Reduces clicks for frequent translations
- Personalized per user
- No additional API calls

**3. Streaming Display**
```typescript
// Show typing indicator while translating
await this.chat.sendTyping();

// For multiple messages, show progress
for (const message of messages) {
  await this.chat.reply(`Translating ${i}/${messages.length}...`);
}
```

### Example 3: Google Calendar Reminder (Complex Plugin)

The Calendar plugin shown in the [Developer SDK](#developer-sdk) section demonstrates the full complexity spectrum:

- **LLM Integration**: Uses Claude to parse natural language
- **OAuth 2.1**: Connects to Google Calendar API
- **Multi-Step Flow**: Parse → Confirm → Execute
- **External API**: Creates calendar events
- **Execution Time**: 3-5 seconds (LLM parsing + API call)

### Comparison: Simple vs Medium vs Complex

| Aspect | Message Icons | Message Translation | Calendar Reminder |
|--------|---------------|---------------------|-------------------|
| **LLM Required** | ❌ No | ✅ Yes (translation) | ✅ Yes (parsing) |
| **External APIs** | ❌ None | ❌ None (uses Chamo's LLM) | ✅ Google Calendar |
| **OAuth Flow** | ❌ Not needed | ❌ Not needed | ✅ Required |
| **Multi-Step** | ✅ Basic (pick → attach) | ✅ Simple (pick lang → translate) | ✅ Complex (parse → confirm → create) |
| **Network Access** | ❌ None | ❌ None (internal) | ✅ googleapis.com |
| **Caching Strategy** | ✅ Simple (90 days) | ✅ Smart (30 days) | ❌ Not applicable |
| **Execution Time** | <100ms | 50ms (cached) / 1-2s (uncached) | 3-5 seconds |
| **State Management** | ❌ Synchronous | ❌ Minimal | ✅ Complex async |
| **Cost per Use** | ~$0 | ~$0.001 (with cache) | ~$0.01 |
| **Complexity** | Low | Medium | High |
| **Developer Time** | <2 hours | 4-6 hours | 1-2 days |

### Architecture Validation

These three examples validate that our architecture:

1. **✅ Supports full complexity spectrum** - Simple, medium, and complex plugins use the same SDK
2. **✅ LLM integration is flexible** - Can use Chamo's internal LLM API or external services
3. **✅ Smart caching reduces costs** - Translation plugin shows 90% cost reduction through caching
4. **✅ Works without external APIs** - Icons and Translation need no OAuth or external APIs
5. **✅ Handles varied state complexity** - From synchronous (icons) to async multi-step (calendar)
6. **✅ Provides plugin-scoped storage** - `this.storage.*` for both simple data and smart caching
7. **✅ Performance optimization patterns** - Caching, typing indicators, progressive display
8. **✅ Same SDK for all complexity levels** - Consistent developer experience across spectrum

### Plugin Categories by Complexity

**Simple Plugins** (No LLM, No External APIs):
- **Message Reactions** - Slack-style emoji reactions
- **Message Templates** - Quick text snippets / canned responses
- **Message Formatter** - Bold, italic, code formatting helpers
- **Color Themes** - Per-chat color customization
- **Quick Polls** - Simple yes/no voting
- **Message Bookmarks** - Save messages for later
- **Read Receipts** - Enhanced read status indicators
- **Message Labels** - Organize messages with tags

**Medium Plugins** (LLM, No External APIs):
- **Message Translation** - Translate to any language (exists as built-in, good migration candidate)
- **Message Summarization** - TL;DR for long messages
- **Sentiment Analysis** - Detect tone/emotion in messages
- **Smart Search** - Semantic search across chat history
- **Auto-Categorization** - Organize messages by topic
- **Writing Assistant** - Grammar/style suggestions
- **Keyword Extraction** - Pull out key points from messages

**Complex Plugins** (LLM + External APIs + OAuth):
- **Calendar Integration** - Create events from messages
- **Task Management** - Create Todoist/Asana tasks
- **GitHub Integration** - Create issues, link PRs
- **Email Bridge** - Send messages as emails
- **Slack Bridge** - Cross-post to Slack channels
- **Payment Requests** - Send money via Venmo/PayPal
- **Location Sharing** - Google Maps integration

### Implementation Strategy

The staged approach progressively validates complexity:

**Phase 1A: Simple Plugin MVP (1 week)**
- Implement **Message Icons** plugin first
- Validates core SDK without LLM complexity
- Tests UI integration patterns
- Proves plugin storage works
- Provides immediate user value
- **Risk**: Low - no external dependencies

**Phase 1B: Medium Plugin MVP (1 week)**
- Migrate **Message Translation** to plugin architecture
- Tests LLM integration without OAuth complexity
- Validates caching strategies
- Proves cost optimization patterns work
- Migrates existing built-in feature to demonstrate plugin conversion
- **Risk**: Medium - LLM reliability and costs

**Phase 1C: Complex Plugin MVP (2 weeks)**
- Implement **Google Calendar** plugin
- Tests OAuth 2.1 with PKCE flows
- Tests multi-step state machine
- Validates token management and encryption
- Tests external API integration patterns
- **Risk**: High - multiple external dependencies

**Why This Progression Works:**
1. **Incremental complexity** - Each phase adds one major component
2. **Early user value** - Icons and translation are immediately useful
3. **Risk mitigation** - Issues surface early with simpler plugins
4. **Developer learning** - Team learns SDK patterns progressively
5. **Architecture validation** - Each phase tests different architectural components
6. **Cost control** - Can optimize LLM costs before adding OAuth complexity

This staged approach allows iteration on SDK design at each complexity level before moving to the next.

### Migration Strategy: Built-in Features → Plugins

The translation example demonstrates an important architectural decision: **Which features should be plugins vs built-in?**

#### Migration Benefits

**Why migrate existing features to plugins:**

1. **Dogfooding** - Best way to validate plugin architecture is using it internally
2. **Proof of capability** - Shows external developers the plugin system works
3. **Reduced core complexity** - Moves optional features out of main codebase
4. **Marketplace seeding** - Provides initial high-quality plugins
5. **Update flexibility** - Plugin updates don't require app releases
6. **A/B testing** - Can enable/disable features per user
7. **Resource isolation** - Plugin crashes don't affect core app

**Candidate features for migration:**
- ✅ **Translation** (already built-in, clear boundaries, self-contained)
- ✅ **Message formatting** (optional enhancement)
- ✅ **Advanced search** (computationally expensive, good for isolation)
- ✅ **File converters** (PDF, images, etc.)
- ❌ **Core messaging** (must stay in core)
- ❌ **Authentication** (security-critical, keep in core)
- ❌ **E2EE** (performance-critical, keep in core)

#### Migration Process

**Phase 1B serves dual purpose:**
1. Validates plugin architecture with real-world feature
2. Demonstrates migration path for future built-in → plugin conversions

**Migration checklist:**
```typescript
// Before: Built-in translation in core app
async function translateMessage(messageId: string, targetLang: string) {
  const message = await db.messages.findById(messageId);
  const translation = await claude.translate(message.content, targetLang);
  return translation;
}

// After: Same functionality as plugin
export default class TranslationPlugin extends ChamoPlugin {
  async translate(targetLang: string, messages: Message[]) {
    for (const message of messages) {
      const translation = await this.llm.parse({
        template: 'translate',
        context: { text: message.content, target_language: targetLang }
      });
      await this.chat.reply(translation.translatedText);
    }
  }
}
```

**What changes:**
- ✅ Execution context: Core app → Isolated process
- ✅ API access: Direct DB → SDK abstraction (`this.llm`, `this.storage`)
- ✅ Lifecycle: Always loaded → User installs/uninstalls
- ✅ Updates: App release → Plugin update
- ✅ Permissions: Implicit → Explicit user grant

**What stays the same:**
- ✅ User experience (same UI, same workflow)
- ✅ Functionality (same LLM calls, same caching)
- ✅ Performance (similar execution time)

#### Long-term Vision

Over time, Chamo could evolve toward a "core + plugins" architecture:

**Core App (minimal):**
- User authentication
- Message storage & sync
- E2E encryption
- Basic message display
- Plugin orchestrator

**Everything else as plugins:**
- Translation, summarization, formatting
- Third-party integrations (Calendar, Tasks, etc.)
- Advanced features (search, analytics, etc.)
- Customizations (themes, layouts, etc.)

**Benefits:**
- Smaller core app (faster, more stable)
- User choice (install only what they need)
- Faster iteration (plugins update independently)
- Community contributions (external developers extend platform)
- Revenue opportunities (premium plugins, marketplace)

This architecture is proven by successful platforms like VS Code (extensions), Figma (plugins), and Obsidian (community plugins).

---

## Multi-Step Flow State Machine

Critical for handling async user interactions:

```typescript
// In Plugin Orchestrator
class PluginExecutionStateMachine {
  states = {
    IDLE: 'idle',
    PARSING: 'parsing',
    AWAITING_USER_INPUT: 'awaiting_user_input',
    EXECUTING: 'executing',
    COMPLETED: 'completed',
    FAILED: 'failed'
  };

  transitions = {
    start: { from: 'idle', to: 'parsing' },
    parse_complete: { from: 'parsing', to: 'awaiting_user_input' },
    user_confirmed: { from: 'awaiting_user_input', to: 'executing' },
    execute_complete: { from: 'executing', to: 'completed' },
    error: { from: '*', to: 'failed' }
  };

  async executePlugin(
    pluginId: string,
    messages: Message[],
    userId: string
  ) {
    const execution = await this.createExecution(pluginId, userId);

    try {
      await this.transition(execution, 'start');

      // Step 1: Parse with LLM
      const parsed = await this.runPluginMethod(
        pluginId,
        'parseMessage',
        { messages }
      );
      await this.transition(execution, 'parse_complete', parsed);

      // Step 2: Wait for user input (async, could be minutes)
      const confirmed = await this.waitForUserInput(execution.id);
      await this.transition(execution, 'user_confirmed', confirmed);

      // Step 3: Execute external API call
      const result = await this.runPluginMethod(
        pluginId,
        'createEvent',
        { reminder: confirmed }
      );
      await this.transition(execution, 'execute_complete', result);

    } catch (error) {
      await this.transition(execution, 'error', { error });
    }
  }

  async createExecution(pluginId: string, userId: string): Promise<Execution> {
    const execution = {
      id: uuid(),
      pluginId,
      userId,
      state: this.states.IDLE,
      data: {},
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 min TTL
    };

    // Persist to Redis with TTL
    await redis.setex(
      `plugin_execution:${execution.id}`,
      1800, // 30 minutes
      JSON.stringify(execution)
    );

    return execution;
  }

  async waitForUserInput(executionId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const channel = `execution:${executionId}:user_input`;

      // Subscribe to user input channel
      const subscriber = redis.duplicate();
      subscriber.subscribe(channel);

      subscriber.on('message', (ch, message) => {
        subscriber.unsubscribe(channel);
        subscriber.quit();
        resolve(JSON.parse(message));
      });

      // Timeout after 30 minutes
      setTimeout(() => {
        subscriber.unsubscribe(channel);
        subscriber.quit();
        reject(new Error('User input timeout'));
      }, 30 * 60 * 1000);
    });
  }
}
```

### State Persistence

Store execution state in Redis with automatic expiration:

```typescript
interface Execution {
  id: string;
  pluginId: string;
  userId: string;
  state: string;
  data: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
}

// Store
await redis.setex(
  `plugin_execution:${executionId}`,
  1800, // 30 minutes
  JSON.stringify(execution)
);

// Retrieve
const executionJson = await redis.get(`plugin_execution:${executionId}`);
const execution = JSON.parse(executionJson);

// Update state
execution.state = 'executing';
execution.data.result = result;
await redis.setex(
  `plugin_execution:${executionId}`,
  1800,
  JSON.stringify(execution)
);
```

---

## Security Architecture

### Web Worker Isolation (Client-Side)

**Critical: Plugins run in isolated Web Workers** (browser equivalent of process isolation)

Since plugins must run client-side for E2EE access, we use Web Workers instead of Node.js processes:

```typescript
// Plugin Web Worker Pool Manager (Client-Side)
class PluginWorkerPool {
  private workers: Map<string, Worker> = new Map();

  async executePlugin(
    pluginId: string,
    method: string,
    args: any
  ): Promise<any> {

    // Create or reuse Web Worker for this plugin
    let worker = this.workers.get(pluginId);

    if (!worker) {
      // Load plugin code as Web Worker
      const pluginCode = await this.loadPluginCode(pluginId);
      const blob = new Blob([pluginCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);

      worker = new Worker(workerUrl, {
        name: `plugin-${pluginId}`,
        type: 'module'
      });

      this.workers.set(pluginId, worker);
    }

    // Send execution request via message passing
    const messageId = crypto.randomUUID();
    worker.postMessage({
      id: messageId,
      method,
      args
    });

    // Handle response with timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.terminate();
        this.workers.delete(pluginId);
        reject(new PluginTimeoutError());
      }, 30000); // 30 second timeout

      const handler = (event: MessageEvent) => {
        if (event.data.id === messageId) {
          clearTimeout(timeout);
          worker.removeEventListener('message', handler);

          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        }
      };

      worker.addEventListener('message', handler);

      worker.addEventListener('error', (error) => {
        clearTimeout(timeout);
        worker.terminate();
        this.workers.delete(pluginId);
        reject(error);
      });
    });
  }

  terminatePlugin(pluginId: string) {
    const worker = this.workers.get(pluginId);
    if (worker) {
      worker.terminate();
      this.workers.delete(pluginId);
    }
  }
}
```

**Benefits:**
- Plugin crash doesn't affect Chamo UI
- Memory isolated (separate heap)
- CPU limits enforced by browser
- Runaway plugins can be terminated
- **Same-origin policy** prevents unauthorized network access
- No access to DOM (can't tamper with UI)
- No access to localStorage/cookies (unless explicitly granted)

**Limitations vs Server-Side:**
- No true memory limits (browser-dependent)
- No CPU quotas (browser may throttle)
- More limited sandboxing than OS processes
- Plugin code must be JavaScript (no native code)

### E2EE Security Considerations

Since plugins run client-side with access to decrypted messages, additional security measures are critical:

#### Message Access Control

```typescript
class ContextProvider {
  async getContextForPlugin(
    pluginId: string,
    messageIds: string[],
    userId: string
  ): Promise<PluginContext> {

    const plugin = await this.getPluginManifest(pluginId);
    const permissions = plugin.required_context;

    // CRITICAL: Only pass explicitly selected messages
    // Never give plugin access to entire chat history
    const context: PluginContext = {
      user: await this.getUserInfo(userId, permissions),
      messages: [],
      chat_history: [],
      metadata: {}
    };

    // User must explicitly select which messages plugin can access
    if (permissions.includes('selected_messages')) {
      // Decrypt messages client-side, then pass to plugin
      const encryptedMessages = await this.getMessages(messageIds);
      context.messages = await this.decryptMessages(encryptedMessages);
    }

    // Chat history requires additional permission grant
    if (permissions.includes('chat_history')) {
      const granted = await this.checkPermission(userId, pluginId, 'chat_history');
      if (granted) {
        // Limited to last N messages to minimize exposure
        const recent = await this.getRecentMessages(context.messages[0].chatId, 20);
        context.chat_history = await this.decryptMessages(recent);
      }
    }

    return context;
  }
}
```

#### Plugin Code Integrity

**Content Security Policy (CSP)**:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               worker-src blob:;
               script-src 'self' 'wasm-unsafe-eval';
               connect-src 'self' https://api.anthropic.com https://accounts.google.com">
```

**Subresource Integrity (SRI)**:
```typescript
// Plugins must provide hash of their code
interface PluginManifest {
  name: string;
  version: string;
  code_hash: string; // SHA-256 of plugin code
  // ...
}

// Verify before loading
async function loadPluginCode(pluginId: string): Promise<string> {
  const manifest = await getPluginManifest(pluginId);
  const code = await fetchPluginCode(pluginId);

  const hash = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(code)
  );

  const hashHex = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (hashHex !== manifest.code_hash) {
    throw new Error('Plugin code integrity check failed');
  }

  return code;
}
```

#### Storage Encryption

Plugin storage must be encrypted client-side:

```typescript
class SecureStorage {
  private encryptionKey: CryptoKey;

  async set(key: string, value: any): Promise<void> {
    const plaintext = JSON.stringify(value);

    // Encrypt with user's key (derived from E2EE key)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      new TextEncoder().encode(plaintext)
    );

    // Store encrypted data
    await IndexedDB.put(key, {
      ciphertext: encrypted,
      iv: Array.from(iv)
    });
  }

  async get(key: string): Promise<any> {
    const stored = await IndexedDB.get(key);
    if (!stored) return null;

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(stored.iv) },
      this.encryptionKey,
      stored.ciphertext
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
  }
}
```

**Key Benefits:**
- Plugin data encrypted at rest (IndexedDB)
- Encryption key derived from user's E2EE key
- Even if device compromised, plugin data is protected
- Aligns with Chamo's security model

### OAuth 2.1 with PKCE (Client-Side)

**PKCE (Proof Key for Code Exchange) is mandatory for browser-based flows:**

```typescript
// In Plugin Orchestrator
class OAuthManager {
  async initiateOAuth(
    userId: string,
    pluginId: string,
    service: string
  ): Promise<string> {

    // Generate PKCE verifier
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    // Store verifier (temporary, 10 min TTL)
    await redis.setex(
      `oauth_verifier:${userId}:${pluginId}`,
      600,
      codeVerifier
    );

    // Build authorization URL
    const authUrl = new URL(oauthConfigs[service].auth_url);
    authUrl.searchParams.set('client_id', process.env[`${service.toUpperCase()}_CLIENT_ID`]);
    authUrl.searchParams.set('redirect_uri', `${process.env.BASE_URL}/oauth/callback`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', `${userId}:${pluginId}`);
    authUrl.searchParams.set('scope', oauthConfigs[service].scopes.join(' '));

    return authUrl.toString();
  }

  async handleCallback(
    code: string,
    state: string
  ): Promise<void> {

    const [userId, pluginId] = state.split(':');
    const codeVerifier = await redis.get(`oauth_verifier:${userId}:${pluginId}`);

    if (!codeVerifier) {
      throw new Error('OAuth verifier expired or invalid');
    }

    // Exchange code for token
    const tokenResponse = await fetch(oauthConfigs[service].token_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.BASE_URL}/oauth/callback`,
        client_id: process.env[`${service.toUpperCase()}_CLIENT_ID`],
        code_verifier: codeVerifier
      })
    });

    const tokens = await tokenResponse.json();

    // Store encrypted tokens
    await this.storeTokens(userId, pluginId, service, tokens);

    // Clean up verifier
    await redis.del(`oauth_verifier:${userId}:${pluginId}`);
  }

  async storeTokens(
    userId: string,
    pluginId: string,
    service: string,
    tokens: OAuthTokens
  ): Promise<void> {

    // Encrypt tokens at rest (AES-256-GCM)
    const encrypted = await encrypt(
      JSON.stringify(tokens),
      process.env.TOKEN_ENCRYPTION_KEY
    );

    await db.query(
      `INSERT INTO user_plugin_tokens (user_id, plugin_id, service, encrypted_tokens, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, plugin_id, service)
       DO UPDATE SET encrypted_tokens = $4, expires_at = $5`,
      [userId, pluginId, service, encrypted, new Date(Date.now() + tokens.expires_in * 1000)]
    );
  }

  async getToken(
    userId: string,
    pluginId: string,
    service: string
  ): Promise<string> {

    const result = await db.query(
      `SELECT encrypted_tokens, expires_at FROM user_plugin_tokens
       WHERE user_id = $1 AND plugin_id = $2 AND service = $3`,
      [userId, pluginId, service]
    );

    if (!result.rows[0]) {
      throw new Error('No OAuth token found');
    }

    const decrypted = await decrypt(
      result.rows[0].encrypted_tokens,
      process.env.TOKEN_ENCRYPTION_KEY
    );

    const tokens = JSON.parse(decrypted);

    // Check if expired, refresh if needed
    if (new Date() > result.rows[0].expires_at) {
      return await this.refreshToken(userId, pluginId, service, tokens.refresh_token);
    }

    return tokens.access_token;
  }
}
```

### Network Access Restriction

Plugins declare allowed domains in manifest:

```typescript
// In plugin-runner.js (isolated process)
const originalFetch = global.fetch;

global.fetch = function restrictedFetch(url: string, options?: any) {
  const parsedUrl = new URL(url);
  const allowedDomains = manifest.security.network_access || [];

  const isAllowed = allowedDomains.some(domain =>
    parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
  );

  if (!isAllowed) {
    throw new Error(`Network access denied: ${parsedUrl.hostname} not in allowed domains`);
  }

  return originalFetch(url, options);
};
```

### Permission System

Users grant permissions explicitly:

```typescript
interface PluginPermission {
  userId: string;
  pluginId: string;
  scope: string; // e.g., 'selected_messages', 'chat_history'
  grantedAt: Date;
}

// Before executing plugin
async function checkPermissions(
  userId: string,
  pluginId: string,
  requiredScopes: string[]
): Promise<boolean> {

  const granted = await db.query(
    `SELECT scope FROM plugin_permissions
     WHERE user_id = $1 AND plugin_id = $2`,
    [userId, pluginId]
  );

  const grantedScopes = granted.rows.map(r => r.scope);

  return requiredScopes.every(scope => grantedScopes.includes(scope));
}
```

---

## LLM Context Management

### Context Scoping

Plugins only access what they declare in manifest:

```typescript
class ContextProvider {
  async getContextForPlugin(
    pluginId: string,
    messageIds: string[],
    userId: string
  ): Promise<PluginContext> {

    const plugin = await this.getPluginManifest(pluginId);
    const permissions = plugin.required_context;

    const context: PluginContext = {
      user: await this.getUserInfo(userId, permissions),
      messages: [],
      chat_history: [],
      metadata: {}
    };

    // Only include what plugin declared it needs
    if (permissions.includes('selected_messages')) {
      context.messages = await this.getMessages(messageIds);
    }

    if (permissions.includes('chat_history')) {
      // Last 20 messages for context (privacy-aware)
      context.chat_history = await this.getRecentMessages(
        context.messages[0].chatId,
        20
      );
    }

    if (permissions.includes('user_timezone')) {
      context.metadata.timezone = context.user.timezone;
    }

    if (permissions.includes('user_locale')) {
      context.metadata.locale = context.user.locale;
    }

    return context;
  }
}
```

### LLM Prompt Management

SDK abstracts prompt engineering:

```typescript
// In Plugin SDK
class LLMClient {
  async parse(options: {
    template: string;
    context: any;
  }): Promise<any> {

    // Load prompt template from plugin package
    const template = await this.loadTemplate(options.template);

    // Inject context variables
    const prompt = this.renderTemplate(template, options.context);

    // Call Claude with structured output (tool use)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }],
      tools: [{
        name: 'extract_reminder_details',
        description: 'Extract reminder details from message',
        input_schema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Concise reminder title'
            },
            datetime: {
              type: 'string',
              format: 'date-time',
              description: 'When the reminder should trigger (ISO 8601)'
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Confidence in the extraction (0-1)'
            },
            reasoning: {
              type: 'string',
              description: 'Brief explanation of how datetime was determined'
            }
          },
          required: ['title', 'datetime', 'confidence']
        }
      }]
    });

    // Extract structured data from tool use
    const toolUse = response.content.find(c => c.type === 'tool_use');

    if (!toolUse) {
      throw new Error('LLM did not return structured data');
    }

    return toolUse.input;
  }

  async generate(prompt: string): Promise<string> {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    return response.content[0].text;
  }
}
```

### Prompt Template Example

```text
// templates/parse_reminder.txt

You are analyzing a family chat message to extract reminder details.

Message: "{{messages[0].content}}"

Context:
- User timezone: {{user_timezone}}
- Current date/time: {{current_datetime}}

Extract:
1. What should be reminded (clear, actionable title)
2. When the reminder should trigger (specific date/time in ISO 8601 format)
3. Your confidence in this extraction (0.0 to 1.0)

Consider:
- Relative times ("tonight" = today at 20:00)
- Implicit context ("put out the bins" likely means evening before collection day)
- Ambiguous times should have lower confidence

Use the extract_reminder_details tool to return structured data.
```

---

## Plugin Discovery & Registry

### Database Schema

```sql
-- Plugins table
CREATE TABLE plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) UNIQUE NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  author_id UUID REFERENCES users(id),
  manifest_json JSONB NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Full text search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', name || ' ' || description)
  ) STORED
);

CREATE INDEX idx_plugins_search ON plugins USING GIN(search_vector);
CREATE INDEX idx_plugins_verified ON plugins(verified) WHERE verified = true;

-- User installations
CREATE TABLE user_installed_plugins (
  user_id UUID REFERENCES users(id),
  plugin_id UUID REFERENCES plugins(id),
  enabled BOOLEAN DEFAULT TRUE,
  installed_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, plugin_id)
);

-- Plugin permissions
CREATE TABLE plugin_permissions (
  user_id UUID REFERENCES users(id),
  plugin_id UUID REFERENCES plugins(id),
  scope VARCHAR(100) NOT NULL,
  granted_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, plugin_id, scope)
);

-- OAuth tokens (encrypted)
CREATE TABLE user_plugin_tokens (
  user_id UUID REFERENCES users(id),
  plugin_id UUID REFERENCES plugins(id),
  service VARCHAR(100) NOT NULL,
  encrypted_tokens TEXT NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, plugin_id, service)
);

-- Plugin execution history
CREATE TABLE plugin_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  plugin_id UUID REFERENCES plugins(id),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  state VARCHAR(50),
  success BOOLEAN,
  error_message TEXT,
  duration_ms INTEGER
);

CREATE INDEX idx_executions_user_plugin ON plugin_executions(user_id, plugin_id);
CREATE INDEX idx_executions_completed ON plugin_executions(completed_at) WHERE completed_at IS NOT NULL;
```

### GraphQL API

```graphql
type Query {
  # Discovery
  plugins(
    category: String
    search: String
    verified: Boolean
    limit: Int = 20
    offset: Int = 0
  ): PluginConnection!

  # User's installed plugins
  myInstalledPlugins: [InstalledPlugin!]!

  # Single plugin details
  plugin(id: ID!): Plugin
}

type Plugin {
  id: ID!
  name: String!
  description: String!
  version: String!
  author: User!
  verified: Boolean!
  rating: Float
  downloads: Int!
  requiredPermissions: [String!]!
  requiredContextScopes: [String!]!
  externalApis: [ExternalAPI!]!
  screenshots: [String!]!
  category: String!
  tags: [String!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type InstalledPlugin {
  plugin: Plugin!
  enabled: Boolean!
  installedAt: DateTime!
  grantedPermissions: [String!]!
  connectedServices: [String!]!
}

type ExternalAPI {
  service: String!
  scopes: [String!]!
  connected: Boolean!
}

type PluginConnection {
  edges: [PluginEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type Mutation {
  # Installation
  installPlugin(pluginId: ID!): InstallResult!
  uninstallPlugin(pluginId: ID!): Boolean!
  togglePlugin(pluginId: ID!, enabled: Boolean!): Boolean!

  # Permissions
  grantPermission(pluginId: ID!, scope: String!): Boolean!
  revokePermission(pluginId: ID!, scope: String!): Boolean!

  # OAuth
  initiateOAuth(pluginId: ID!, service: String!): OAuthURL!
  disconnectService(pluginId: ID!, service: String!): Boolean!

  # Execution
  executePlugin(
    pluginId: ID!
    messageIds: [ID!]!
  ): PluginExecution!

  # User input for multi-step flows
  submitPluginInput(
    executionId: ID!
    data: JSON!
  ): PluginExecution!
}

type PluginExecution {
  id: ID!
  plugin: Plugin!
  state: ExecutionState!
  currentStep: String
  data: JSON
  error: String
}

enum ExecutionState {
  IDLE
  PARSING
  AWAITING_USER_INPUT
  EXECUTING
  COMPLETED
  FAILED
}
```

### Discovery UI Flow

1. **Browse Plugins**: User sees list with categories, search, filters
2. **Plugin Details**: View permissions, screenshots, reviews
3. **Install**: One-click install, no immediate permissions
4. **First Use**: When user applies plugin to message, prompt for permissions
5. **Grant Permissions**: User reviews and grants required scopes
6. **OAuth (if needed)**: Redirect to external service for connection
7. **Execute**: Plugin runs with granted permissions and connected services

---

## Rate Limiting & Quotas

### Per-User, Per-Plugin Limits

```typescript
class RateLimiter {
  async checkLimit(
    userId: string,
    pluginId: string
  ): Promise<void> {

    const plugin = await this.getPlugin(pluginId);
    const tier = await this.getUserTier(userId);

    // Different limits per tier
    const limits = {
      free: { executions: 10, per: 'hour' },
      pro: { executions: 100, per: 'hour' },
      enterprise: { executions: 1000, per: 'hour' }
    };

    const key = `rate_limit:${userId}:${pluginId}`;
    const current = await redis.incr(key);

    if (current === 1) {
      // Set expiration on first increment
      await redis.expire(key, 3600); // 1 hour
    }

    if (current > limits[tier].executions) {
      const ttl = await redis.ttl(key);
      throw new RateLimitError(
        `Rate limit exceeded: ${limits[tier].executions} executions per ${limits[tier].per}. ` +
        `Resets in ${Math.ceil(ttl / 60)} minutes.`
      );
    }
  }

  async getRemainingQuota(
    userId: string,
    pluginId: string
  ): Promise<number> {

    const tier = await this.getUserTier(userId);
    const limits = this.getLimitsForTier(tier);

    const key = `rate_limit:${userId}:${pluginId}`;
    const current = await redis.get(key);

    return limits.executions - (parseInt(current || '0'));
  }
}
```

### LLM Cost Management

```typescript
class LLMCostTracker {
  async trackUsage(
    userId: string,
    pluginId: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<void> {

    // Pricing (example, adjust to actual)
    const pricing = {
      input: 0.000003,  // $3 per 1M tokens
      output: 0.000015  // $15 per 1M tokens
    };

    const cost = (inputTokens * pricing.input) + (outputTokens * pricing.output);

    // Track in Redis (daily aggregation)
    const date = new Date().toISOString().split('T')[0];
    const key = `llm_cost:${date}:${userId}:${pluginId}`;

    await redis.hincrbyfloat(key, 'cost', cost);
    await redis.hincrby(key, 'input_tokens', inputTokens);
    await redis.hincrby(key, 'output_tokens', outputTokens);
    await redis.expire(key, 90 * 24 * 60 * 60); // 90 days retention

    // Check if user has exceeded budget
    const userBudget = await this.getUserMonthlyBudget(userId);
    const monthlySpend = await this.getMonthlySpend(userId);

    if (monthlySpend > userBudget) {
      throw new BudgetExceededError('Monthly LLM budget exceeded');
    }
  }
}
```

---

## Monitoring & Observability

### Plugin Execution Metrics

```typescript
class PluginMetrics {
  async recordExecution(
    pluginId: string,
    userId: string,
    duration: number,
    success: boolean,
    error?: Error
  ): Promise<void> {

    await Promise.all([
      // Time-series metrics (InfluxDB, Prometheus, etc.)
      influx.writePoints([{
        measurement: 'plugin_executions',
        tags: {
          plugin_id: pluginId,
          success: success.toString(),
          error_type: error?.name || 'none'
        },
        fields: {
          duration,
          user_id: userId
        },
        timestamp: new Date()
      }]),

      // Aggregate stats in Redis
      redis.hincrby(`plugin_stats:${pluginId}`, success ? 'success' : 'failure', 1),
      redis.hincrby(`plugin_stats:${pluginId}`, 'total_duration_ms', duration),

      // Recent errors (for debugging)
      error && redis.lpush(
        `plugin_errors:${pluginId}`,
        JSON.stringify({
          error: error.message,
          stack: error.stack,
          userId,
          timestamp: new Date()
        })
      )
    ]);

    // Trim error list to last 100
    if (error) {
      await redis.ltrim(`plugin_errors:${pluginId}`, 0, 99);
    }
  }

  async getPluginHealth(pluginId: string): Promise<PluginHealth> {
    const stats = await redis.hgetall(`plugin_stats:${pluginId}`);

    const totalExecutions = parseInt(stats.success || '0') + parseInt(stats.failure || '0');
    const successRate = totalExecutions > 0
      ? parseInt(stats.success || '0') / totalExecutions
      : 1;

    const avgDuration = totalExecutions > 0
      ? parseInt(stats.total_duration_ms || '0') / totalExecutions
      : 0;

    return {
      pluginId,
      successRate,
      avgDuration,
      totalExecutions,
      health: successRate > 0.95 ? 'healthy' : successRate > 0.80 ? 'degraded' : 'unhealthy',
      status: this.getStatusFromHealth(successRate, avgDuration)
    };
  }

  getStatusFromHealth(successRate: number, avgDuration: number): string {
    if (successRate < 0.80) return 'critical';
    if (successRate < 0.95 || avgDuration > 5000) return 'warning';
    return 'ok';
  }
}
```

### Alerting

```typescript
class PluginAlertManager {
  async checkAndAlert(pluginId: string): Promise<void> {
    const health = await metrics.getPluginHealth(pluginId);

    // Alert on degraded health
    if (health.status === 'critical') {
      await this.sendAlert({
        severity: 'critical',
        plugin: pluginId,
        message: `Plugin ${pluginId} has ${(health.successRate * 100).toFixed(1)}% success rate`,
        action: 'Consider disabling plugin or notifying developer'
      });
    }

    // Alert on slow performance
    if (health.avgDuration > 10000) {
      await this.sendAlert({
        severity: 'warning',
        plugin: pluginId,
        message: `Plugin ${pluginId} average execution time is ${(health.avgDuration / 1000).toFixed(1)}s`,
        action: 'Review plugin performance'
      });
    }
  }
}
```

### Developer Dashboard

Provide plugin developers with insights:

```typescript
type PluginAnalytics {
  # Usage metrics
  totalExecutions: Int!
  successRate: Float!
  avgExecutionTime: Float!

  # User metrics
  activeUsers: Int!
  installations: Int!
  uninstallRate: Float!

  # Performance
  p50Duration: Float!
  p95Duration: Float!
  p99Duration: Float!

  # Errors
  errorRate: Float!
  topErrors: [ErrorSummary!]!

  # Trends
  dailyExecutions: [DataPoint!]!
  dailyErrors: [DataPoint!]!
}

type Query {
  myPluginAnalytics(
    pluginId: ID!
    timeRange: TimeRange!
  ): PluginAnalytics!
}
```

---

## Versioning & Breaking Changes

### Semantic Versioning

Follow SemVer strictly:
- **MAJOR**: Breaking changes (incompatible API changes)
- **MINOR**: New features (backward-compatible)
- **PATCH**: Bug fixes (backward-compatible)

### Deprecation Strategy

```typescript
// In plugin manifest
{
  "version": "2.0.0",
  "compatibility": {
    "min_sdk_version": "1.5.0",
    "deprecated_methods": [
      {
        "method": "parseMessage_v1",
        "deprecated_in": "1.8.0",
        "removed_in": "2.0.0",
        "replacement": "parseMessage",
        "migration_guide": "https://docs.chamo.app/plugins/migration/v2"
      }
    ]
  }
}
```

### SDK Backward Compatibility

```typescript
// In Plugin SDK
class ChamoPlugin {
  // Old method (deprecated but functional)
  async parseMessage_v1(message: string): Promise<any> {
    console.warn(
      'parseMessage_v1 is deprecated since v1.8.0 and will be removed in v2.0.0. ' +
      'Use parseMessage instead.'
    );

    // Shim: convert old signature to new
    return this.parseMessage(
      [{ content: message, id: 'legacy', createdAt: new Date() }],
      {} as PluginContext
    );
  }

  // New method
  async parseMessage(messages: Message[], context: PluginContext): Promise<any> {
    throw new Error('Not implemented');
  }
}
```

### Breaking Change Notification

When plugin updates with breaking changes:

1. **In-App Notification**: Alert users of required action
2. **Grace Period**: Old version continues working for 30 days
3. **Migration Assistant**: SDK provides migration helpers
4. **Auto-Update Option**: Developers can mark updates as auto-safe

---

## Implementation Phases

### Phase 1A: Simple Plugin MVP (1 week)

**Goal**: Validate core architecture with minimal complexity

**Tasks:**
- [ ] Plugin registry database schema
- [ ] Basic plugin SDK (`@chamo/plugin-sdk` npm package)
- [ ] Process isolation for plugin execution
- [ ] Simple UI for plugin selection (message context menu)
- [ ] Plugin-scoped storage (Redis-based)
- [ ] Reference plugin: Message Icons (no LLM, no OAuth)
- [ ] UI integration for custom plugin components

**Deliverable**: Users can install Message Icons plugin, select message, attach icon

**Success Criteria**:
- Plugin executes in isolated process
- Plugin storage works (icons persist)
- Custom UI renders (icon picker)
- No crashes affect main app
- Execution completes in <200ms

---

### Phase 1B: Complex Plugin MVP (2 weeks)

**Goal**: Validate LLM integration and OAuth flows

**Tasks:**
- [ ] LLM integration (Claude API)
- [ ] OAuth 2.1 with PKCE implementation
- [ ] State machine for multi-step flows
- [ ] Token encryption at rest
- [ ] Reference plugin: Google Calendar reminder
- [ ] External API integration patterns

**Deliverable**: Users can install Calendar plugin, select message, create reminder

**Success Criteria**:
- User can complete multi-step flow (parse → confirm → execute)
- OAuth flow works for Google Calendar
- State persists across steps
- LLM parsing is accurate (>80% confidence)
- End-to-end execution completes in <10s

---

### Phase 2: Developer Experience (2 weeks)

**Goal**: Enable external developers to build plugins

**Tasks:**
- [ ] Manifest validation tooling (`chamo-plugin validate`)
- [ ] Plugin testing framework (mock SDK, fixture data)
- [ ] Developer documentation site
- [ ] Plugin CLI (`chamo-plugin init`, `chamo-plugin publish`)
- [ ] Example plugins (GitHub issues, Todoist, Slack)
- [ ] Plugin submission/review process

**Deliverable**: External developers can build and submit plugins

**Success Criteria**:
- Developer can scaffold new plugin in <5 minutes
- Unit tests run without Chamo backend
- Documentation covers 80% of common use cases
- 3+ external plugins submitted

---

### Phase 3: Production Hardening (1-2 weeks)

**Goal**: Production-ready, secure, observable

**Tasks:**
- [ ] OAuth token encryption at rest (AES-256-GCM)
- [ ] Rate limiting per user/plugin (Redis-based)
- [ ] Monitoring & alerting (plugin health dashboard)
- [ ] Plugin health checks (automatic disabling)
- [ ] Security audit of SDK and orchestrator
- [ ] Load testing (100 concurrent plugin executions)
- [ ] Error recovery (retry logic, graceful degradation)

**Deliverable**: Production-ready system with security and observability

**Success Criteria**:
- Pass security audit (no high/critical findings)
- Handle 100 concurrent executions without degradation
- Automatic recovery from plugin failures
- Alerts trigger on degraded plugin health

---

### Phase 4: Scale & Polish (Ongoing)

**Goal**: Marketplace, analytics, advanced features

**Tasks:**
- [ ] Plugin marketplace UI (discovery, ratings, reviews)
- [ ] Plugin analytics for developers (dashboard)
- [ ] Revenue sharing (if monetizing)
- [ ] Background jobs (scheduled plugin execution)
- [ ] Webhook support (external triggers)
- [ ] Plugin collections (curated sets)
- [ ] Advanced permissions (family-wide vs individual)

**Deliverable**: Full-featured plugin ecosystem

**Success Criteria**:
- 20+ plugins in marketplace
- 10+ active plugin developers
- <5% uninstall rate
- Positive user feedback on plugin quality

---

## Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Execution Location** | **Client-side (browser)** | **E2EE requires access to decrypted messages** |
| **Isolation Method** | **Web Workers** | **Browser-native sandboxing, separate heap, terminable** |
| **Plugin Interface** | MCP-inspired tools | LLM-native, model-agnostic, growing ecosystem |
| **Developer SDK** | TypeScript class-based | Familiar pattern, type-safe, good DX |
| **Manifest Format** | YAML declarative | Human-readable, validation-friendly, familiar |
| **Multi-step Flows** | Finite state machine (client) | Explicit states, debuggable, resumable |
| **Security** | Web Worker isolation + PKCE OAuth + CSP | Sandboxing, modern auth, content policy enforcement |
| **Plugin Storage** | IndexedDB encrypted (AES-GCM) | Client-side, encrypted at rest, aligned with E2EE |
| **LLM Integration** | Client → Server proxy → Claude | Plaintext never stored on server, quota enforcement |
| **State Storage** | Client-side (IndexedDB) + Server (Redis for sync) | Client-first for offline, server for multi-device |
| **Rate Limiting** | Client-side checks + Server enforcement | UX responsiveness, server authority |
| **Versioning** | Semantic with deprecation warnings | Non-breaking migrations, developer-friendly |
| **Monitoring** | Client metrics → Server aggregation | Privacy-preserving, aggregate insights |
| **Permissions** | Explicit message selection + scope grants | Minimize exposure, user control, auditable |
| **Code Integrity** | SHA-256 hash verification + CSP | Prevent tampering, restrict capabilities |

---

## Open Questions

### 1. Monetization Strategy

**Options:**
- **Free Marketplace**: All plugins free, Chamo provides infrastructure
- **Paid Plugins**: Developers set price, 70/30 revenue share
- **Freemium**: Free tier + premium features
- **Enterprise Only**: Plugins available only to paid Chamo users

**Recommendation**: Start with free marketplace, add paid plugins in Phase 4

---

### 2. LLM Cost Management

**Question**: Who pays for LLM API calls?

**Options:**
1. **Chamo Absorbs**: Include in subscription cost
2. **Plugin Developer Pays**: Developer provides API key
3. **User Pays**: User provides API key or pay-per-use
4. **Hybrid**: Chamo subsidizes, excess charged to user

**Recommendation**: Chamo absorbs cost with usage limits per tier

---

### 3. Plugin Review Process

**Question**: How to ensure plugin quality and security?

**Options:**
1. **Manual Review**: Team reviews each submission
2. **Automated Only**: Static analysis, no human review
3. **Community Review**: Users report issues, crowd-sourced quality
4. **Tiered**: Auto-approve low-risk, manual for high-risk

**Recommendation**: Tiered approach
- Auto-approve: No external API, no sensitive scopes
- Manual review: OAuth, network access, sensitive data

---

### 4. Background Execution

**Question**: Should plugins run on schedules or webhooks?

**Use Cases:**
- Daily digest plugin (summarize family activity)
- Bill reminder (monthly recurring)
- GitHub issue notifier (external webhook)

**Options:**
1. **No Background**: User-initiated only
2. **Scheduled**: Cron-like scheduling per user
3. **Webhooks**: External services trigger plugins
4. **Both**: Full flexibility

**Recommendation**: Phase 1 = user-initiated, Phase 4 = add scheduled + webhooks

---

### 5. Multi-User Plugins

**Question**: How do plugins work in family/group chats?

**Scenarios:**
- Family trip planning plugin (affects all members)
- Expense tracking (shared data)
- Poll plugin (voting)

**Options:**
1. **Individual Only**: Each user installs separately
2. **Chat-Level**: One installation per chat
3. **Hybrid**: Some plugins individual, some chat-level

**Recommendation**: Hybrid
- Default: Individual (privacy-first)
- Opt-in: Chat-level for collaborative plugins
- Permissions: Require majority approval for chat-level install

---

## Conclusion

This plugin framework architecture balances:

1. **Security**: Process isolation, PKCE OAuth, capability-based permissions
2. **Developer Experience**: Simple SDK, clear abstractions, comprehensive docs
3. **Scalability**: Stateless design, Redis for state, process pooling
4. **LLM Integration**: Native support for Claude, structured outputs, cost tracking
5. **User Experience**: Multi-step flows, transparent permissions, marketplace discovery

### Next Steps

1. **Validate Assumptions**: Review this document with team
2. **Spike**: Build minimal prototype (Google Calendar plugin)
3. **Gather Feedback**: User research on plugin use cases
4. **Refine Design**: Iterate based on prototype learnings
5. **Begin Phase 1**: Start MVP implementation

### Key Success Metrics

- **Developer Adoption**: 20+ plugins within 6 months
- **User Engagement**: 50%+ of users install ≥1 plugin
- **Quality**: <5% uninstall rate, >4.0 avg rating
- **Security**: Zero security incidents in first year
- **Performance**: <2s avg plugin execution time

---

**Document End**

For questions or feedback, contact: [Nick](mailto:nick@chamo.app)
