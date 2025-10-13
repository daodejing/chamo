# Tech Spec: Epic 7 - End-to-End Encryption Infrastructure

**Epic ID:** Epic 7
**Priority:** Critical (MVP Blocker)
**Story Points:** 13
**Estimated Duration:** 2 weeks
**Dependencies:** None (foundation for all other epics)

---

## 1. Epic Overview

End-to-End Encryption (E2EE) is the foundational security layer for OurChat. All messages and photos must be encrypted on the client before transmission and storage, ensuring the server cannot decrypt user content (zero-knowledge architecture). The encryption must be completely transparent to users - no manual key exchange, no verification prompts, no complexity.

**User Stories:**

- **US-7.1:** As a privacy-conscious user, I want all messages encrypted so that only my family can read them
  - **AC1:** Messages encrypted before leaving device
  - **AC2:** Server stores only ciphertext
  - **AC3:** Decryption happens only on recipient devices
  - **AC4:** No manual key management required

- **US-7.2:** As a privacy-conscious user, I want all photos encrypted so that my memories are private
  - **AC1:** Photos encrypted before upload
  - **AC2:** Object storage contains only ciphertext
  - **AC3:** Decryption happens in browser
  - **AC4:** Thumbnails also encrypted

- **US-7.3:** As a developer, I want encryption to be transparent so that users don't notice it
  - **AC1:** No loading delays from encryption/decryption
  - **AC2:** No UI indicators of encryption process
  - **AC3:** Error messages don't expose crypto details
  - **AC4:** Backup/sync works seamlessly

---

## 2. Architecture Components

### 2.1 Core Libraries

| Module | Location | Purpose |
|--------|----------|---------|
| **Encryption Core** | `lib/e2ee/encryption.ts` | AES-256-GCM encrypt/decrypt primitives |
| **Key Management** | `lib/e2ee/key-management.ts` | Family key generation, distribution, storage |
| **Client Storage** | `lib/e2ee/storage.ts` | IndexedDB key persistence |
| **Type Definitions** | `types/e2ee.ts` | TypeScript interfaces for E2EE |

### 2.2 Database Schema

```sql
-- Family key storage (encrypted per user)
ALTER TABLE users ADD COLUMN encrypted_family_key TEXT NOT NULL;

-- All message content encrypted
ALTER TABLE messages
  ALTER COLUMN encrypted_content SET NOT NULL;

-- Photo captions encrypted
ALTER TABLE photos
  ADD COLUMN encrypted_caption TEXT;

-- Family invite codes include key distribution
ALTER TABLE families
  ADD COLUMN invite_code VARCHAR(50) UNIQUE NOT NULL;
```

### 2.3 API Integration Points

E2EE is not an API - it's a client-side library used by all other epics:
- Epic 1: Key distribution during family creation/join
- Epic 2: Message encryption/decryption
- Epic 3: Photo encryption/decryption
- Epic 4: Calendar events NOT encrypted (Google Calendar sync requires plaintext)
- Epic 5: User preferences NOT encrypted (UI settings)
- Epic 6: Channel names NOT encrypted (navigation requires plaintext)

---

## 3. Implementation Details

### 3.1 Encryption Model: Shared Family Key

**Architecture Decision (ADR-002):**
Use a single symmetric key per family (not Signal Protocol or Megolm).

**Rationale:**
- Simplicity: ~100 LOC vs 500+ LOC
- UX: Zero user friction (no device verification)
- Sufficient security: Server can't decrypt, good enough for family trust model
- Tradeoff: No forward secrecy (acceptable for family use case)

**Security Properties:**
- ✅ Server cannot read messages/photos (zero-knowledge)
- ✅ Network eavesdropping defeated (HTTPS + E2EE)
- ✅ Database breach protected (ciphertext only)
- ⚠️ Key compromise = all messages compromised (no forward secrecy)
- ⚠️ Removed members can decrypt old messages (no key rotation in MVP)

### 3.2 Encryption Primitives

#### File: `lib/e2ee/encryption.ts`

```typescript
/**
 * Core E2EE encryption library for OurChat.
 * Uses AES-256-GCM (Web Crypto API) for all encryption operations.
 */

import { EncryptedPayload, DecryptedPayload } from '@/types/e2ee';

/**
 * Encrypts a text message using the family key.
 * @param plaintext - The message to encrypt
 * @param familyKey - The family's shared AES-256-GCM key
 * @returns Base64-encoded ciphertext (IV prepended)
 */
export async function encryptMessage(
  plaintext: string,
  familyKey: CryptoKey
): Promise<string> {
  // Encode plaintext to UTF-8 bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random IV (96 bits for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt with AES-256-GCM
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128, // 128-bit authentication tag
    },
    familyKey,
    data
  );

  // Combine IV + ciphertext + auth tag
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Encode as base64 for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts an encrypted message.
 * @param encrypted - Base64-encoded ciphertext (IV prepended)
 * @param familyKey - The family's shared AES-256-GCM key
 * @returns Decrypted plaintext message
 * @throws Error if decryption fails (wrong key or corrupted data)
 */
export async function decryptMessage(
  encrypted: string,
  familyKey: CryptoKey
): Promise<string> {
  try {
    // Decode base64
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

    // Extract IV (first 12 bytes) and ciphertext (rest)
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // Decrypt with AES-256-GCM
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      familyKey,
      ciphertext
    );

    // Decode UTF-8 bytes to string
    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  } catch (error) {
    // Don't expose crypto details in error message
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt message. You may not have access to this family.');
  }
}

/**
 * Encrypts a file (photo) using the family key.
 * @param blob - The file blob to encrypt
 * @param familyKey - The family's shared AES-256-GCM key
 * @returns Encrypted blob (IV prepended)
 */
export async function encryptFile(
  blob: Blob,
  familyKey: CryptoKey
): Promise<Blob> {
  // Read file as ArrayBuffer
  const arrayBuffer = await blob.arrayBuffer();

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt with AES-256-GCM
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    familyKey,
    arrayBuffer
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Return as blob (opaque binary)
  return new Blob([combined], { type: 'application/octet-stream' });
}

/**
 * Decrypts an encrypted file.
 * @param encryptedBlob - Encrypted blob (IV prepended)
 * @param familyKey - The family's shared AES-256-GCM key
 * @returns Decrypted blob with original MIME type
 */
export async function decryptFile(
  encryptedBlob: Blob,
  familyKey: CryptoKey
): Promise<Blob> {
  try {
    // Read encrypted blob as ArrayBuffer
    const combined = new Uint8Array(await encryptedBlob.arrayBuffer());

    // Extract IV and ciphertext
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // Decrypt with AES-256-GCM
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      familyKey,
      ciphertext
    );

    // Detect original MIME type from magic numbers
    const mimeType = detectMimeType(new Uint8Array(plaintext));

    return new Blob([plaintext], { type: mimeType });
  } catch (error) {
    console.error('File decryption failed:', error);
    throw new Error('Failed to decrypt photo. You may not have access to this family.');
  }
}

/**
 * Detects MIME type from file magic numbers.
 * @param bytes - First bytes of file
 * @returns MIME type string
 */
function detectMimeType(bytes: Uint8Array): string {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  // HEIC/HEIF: Check for "ftyp" at offset 4
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'image/heic';
  }
  // WebP: "RIFF" ... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // Default to JPEG if unknown
  return 'image/jpeg';
}

/**
 * Batch encrypt multiple messages (for efficiency).
 * @param plaintexts - Array of messages to encrypt
 * @param familyKey - The family's shared key
 * @returns Array of encrypted messages
 */
export async function encryptMessageBatch(
  plaintexts: string[],
  familyKey: CryptoKey
): Promise<string[]> {
  return Promise.all(plaintexts.map((msg) => encryptMessage(msg, familyKey)));
}

/**
 * Batch decrypt multiple messages.
 * @param encryptedMessages - Array of encrypted messages
 * @param familyKey - The family's shared key
 * @returns Array of decrypted messages
 */
export async function decryptMessageBatch(
  encryptedMessages: string[],
  familyKey: CryptoKey
): Promise<string[]> {
  return Promise.all(encryptedMessages.map((msg) => decryptMessage(msg, familyKey)));
}
```

### 3.3 Key Management

#### File: `lib/e2ee/key-management.ts`

```typescript
/**
 * Family key generation and distribution.
 */

import { storeKey, retrieveKey, clearKeys } from './storage';

/**
 * Generates a new family key during family creation.
 * @returns Object with family key and base64-encoded key for distribution
 */
export async function generateFamilyKey(): Promise<{
  familyKey: CryptoKey;
  base64Key: string;
}> {
  // Generate 256-bit AES key
  const familyKey = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable (needed for distribution)
    ['encrypt', 'decrypt']
  );

  // Export key as raw bytes
  const rawKey = await crypto.subtle.exportKey('raw', familyKey);
  const base64Key = btoa(String.fromCharCode(...new Uint8Array(rawKey)));

  return { familyKey, base64Key };
}

/**
 * Imports a family key from base64 (during family join).
 * @param base64Key - Base64-encoded family key
 * @returns CryptoKey ready for encryption/decryption
 */
export async function importFamilyKey(base64Key: string): Promise<CryptoKey> {
  // Decode base64 to raw bytes
  const rawKey = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));

  // Import as CryptoKey
  const familyKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  return familyKey;
}

/**
 * Derives a key from a password (for future password-based encryption).
 * NOT USED IN MVP (Shared Family Key model doesn't need this).
 * Included for Phase 2 migration to per-user key wrapping.
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import password as key material
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES key using PBKDF2
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000, // OWASP recommendation
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Formats invite code with embedded key.
 * Format: FAMILY-{8 random chars}:{base64 key}
 * Example: FAMILY-A3X9K2P1:dGVzdGtleWV4YW1wbGUxMjM0NTY3ODkwMTIzNDU2Nzg5MA==
 */
export function createInviteCodeWithKey(
  inviteCode: string,
  base64Key: string
): string {
  return `${inviteCode}:${base64Key}`;
}

/**
 * Parses invite code to extract code and key.
 * @param inviteCodeWithKey - Format: CODE:KEY
 * @returns Object with code and key separated
 */
export function parseInviteCode(inviteCodeWithKey: string): {
  code: string;
  base64Key: string;
} {
  const [code, base64Key] = inviteCodeWithKey.split(':');

  if (!code || !base64Key) {
    throw new Error('Invalid invite code format. Expected CODE:KEY');
  }

  return { code, base64Key };
}

/**
 * Initializes family key on first load (after login).
 * @param base64Key - Family key from server
 */
export async function initializeFamilyKey(base64Key: string): Promise<void> {
  const familyKey = await importFamilyKey(base64Key);
  await storeKey('familyKey', familyKey);
}

/**
 * Gets the current family key from storage.
 * @returns Family key or null if not found
 */
export async function getFamilyKey(): Promise<CryptoKey | null> {
  return retrieveKey('familyKey');
}

/**
 * Clears all keys from storage (on logout).
 */
export async function clearFamilyKey(): Promise<void> {
  await clearKeys();
}
```

### 3.4 Client Storage (IndexedDB)

#### File: `lib/e2ee/storage.ts`

```typescript
/**
 * Secure client-side key storage using IndexedDB.
 * Keys persist across browser sessions but are cleared on logout.
 */

import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'ourchat-keys';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

let db: IDBPDatabase | null = null;

/**
 * Opens or creates the IndexedDB database.
 */
async function getDB(): Promise<IDBPDatabase> {
  if (db) return db;

  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Create object store for keys
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    },
  });

  return db;
}

/**
 * Stores a CryptoKey in IndexedDB.
 * @param keyName - Identifier for the key (e.g., 'familyKey')
 * @param key - CryptoKey to store
 */
export async function storeKey(keyName: string, key: CryptoKey): Promise<void> {
  const database = await getDB();
  await database.put(STORE_NAME, key, keyName);
}

/**
 * Retrieves a CryptoKey from IndexedDB.
 * @param keyName - Identifier for the key
 * @returns CryptoKey or null if not found
 */
export async function retrieveKey(keyName: string): Promise<CryptoKey | null> {
  const database = await getDB();
  const key = await database.get(STORE_NAME, keyName);
  return key || null;
}

/**
 * Deletes a specific key from storage.
 * @param keyName - Identifier for the key
 */
export async function deleteKey(keyName: string): Promise<void> {
  const database = await getDB();
  await database.delete(STORE_NAME, keyName);
}

/**
 * Clears all keys from storage (on logout).
 */
export async function clearKeys(): Promise<void> {
  const database = await getDB();
  await database.clear(STORE_NAME);
}

/**
 * Lists all stored key names (for debugging).
 * @returns Array of key names
 */
export async function listKeys(): Promise<string[]> {
  const database = await getDB();
  return database.getAllKeys(STORE_NAME) as Promise<string[]>;
}
```

### 3.5 TypeScript Types

#### File: `types/e2ee.ts`

```typescript
/**
 * Type definitions for E2EE operations.
 */

/**
 * Encrypted payload stored in database.
 */
export interface EncryptedPayload {
  /** Base64-encoded ciphertext (IV + encrypted data + auth tag) */
  ciphertext: string;
  /** Encryption algorithm version (for future key rotation) */
  version?: 'aes-gcm-v1';
}

/**
 * Decrypted payload (plaintext).
 */
export interface DecryptedPayload {
  /** Plaintext content */
  plaintext: string;
}

/**
 * Family key metadata.
 */
export interface FamilyKeyInfo {
  /** Base64-encoded key */
  base64Key: string;
  /** Key generation timestamp */
  createdAt: Date;
  /** Key version (for rotation in Phase 2) */
  version: number;
}

/**
 * Invite code with embedded key.
 */
export interface InviteCodeWithKey {
  /** Human-readable code (e.g., FAMILY-A3X9K2P1) */
  code: string;
  /** Base64-encoded family key */
  base64Key: string;
  /** Full invite string (CODE:KEY) */
  fullInviteCode: string;
}
```

---

## 4. Error Handling

### 4.1 Client-Side Errors

**Encryption Errors:**
- **Cause:** Invalid key, corrupted data, browser doesn't support Web Crypto
- **Handling:**
  ```typescript
  try {
    const encrypted = await encryptMessage(message, familyKey);
  } catch (error) {
    console.error('Encryption failed:', error);
    toast.error('Failed to send message. Please try again.');
    // Don't send message if encryption fails
  }
  ```

**Decryption Errors:**
- **Cause:** Wrong key, corrupted ciphertext, authentication tag mismatch
- **Handling:**
  ```typescript
  try {
    const plaintext = await decryptMessage(encrypted, familyKey);
  } catch (error) {
    console.error('Decryption failed:', error);
    // Show placeholder message instead of crashing
    return '[Message cannot be decrypted. You may not have access to this family.]';
  }
  ```

**Key Storage Errors:**
- **Cause:** IndexedDB quota exceeded, browser privacy mode, corrupted storage
- **Handling:**
  ```typescript
  try {
    await storeKey('familyKey', key);
  } catch (error) {
    console.error('Failed to store key:', error);
    toast.error('Failed to save encryption key. You may need to allow storage.');
    // Fall back to session-only storage (sessionStorage)
    sessionStorage.setItem('familyKey_temp', base64Key);
  }
  ```

### 4.2 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| **Family key not found in storage** | Redirect to login, re-fetch key from server |
| **Browser doesn't support Web Crypto** | Show error: "Your browser is not supported. Please update to a modern browser." |
| **IndexedDB unavailable (private browsing)** | Fall back to sessionStorage (warn: session-only) |
| **Corrupted ciphertext** | Show placeholder message, log error for debugging |
| **Key mismatch (user switched families)** | Clear old key, re-initialize with new family key |

---

## 5. Testing Strategy

### 5.1 Unit Tests (Vitest)

**File:** `tests/unit/e2ee/encryption.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { encryptMessage, decryptMessage, encryptFile, decryptFile } from '@/lib/e2ee/encryption';
import { generateFamilyKey } from '@/lib/e2ee/key-management';

describe('E2EE Encryption', () => {
  let familyKey: CryptoKey;

  beforeEach(async () => {
    const { familyKey: key } = await generateFamilyKey();
    familyKey = key;
  });

  it('should encrypt and decrypt a text message', async () => {
    const plaintext = 'Hello, family!';
    const encrypted = await encryptMessage(plaintext, familyKey);
    const decrypted = await decryptMessage(encrypted, familyKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should fail to decrypt with wrong key', async () => {
    const plaintext = 'Secret message';
    const encrypted = await encryptMessage(plaintext, familyKey);

    // Generate a different key
    const { familyKey: wrongKey } = await generateFamilyKey();

    await expect(decryptMessage(encrypted, wrongKey)).rejects.toThrow();
  });

  it('should encrypt and decrypt a file', async () => {
    const fileContent = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
    const blob = new Blob([fileContent], { type: 'image/jpeg' });

    const encryptedBlob = await encryptFile(blob, familyKey);
    const decryptedBlob = await decryptFile(encryptedBlob, familyKey);

    const decryptedBytes = new Uint8Array(await decryptedBlob.arrayBuffer());
    expect(decryptedBytes).toEqual(fileContent);
    expect(decryptedBlob.type).toBe('image/jpeg');
  });

  it('should produce different ciphertexts for same plaintext (random IV)', async () => {
    const plaintext = 'Test message';
    const encrypted1 = await encryptMessage(plaintext, familyKey);
    const encrypted2 = await encryptMessage(plaintext, familyKey);

    expect(encrypted1).not.toBe(encrypted2); // Different IVs
  });

  it('should handle Unicode characters', async () => {
    const plaintext = 'こんにちは 🎉 Hello!';
    const encrypted = await encryptMessage(plaintext, familyKey);
    const decrypted = await decryptMessage(encrypted, familyKey);

    expect(decrypted).toBe(plaintext);
  });
});
```

**File:** `tests/unit/e2ee/key-management.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  generateFamilyKey,
  importFamilyKey,
  createInviteCodeWithKey,
  parseInviteCode
} from '@/lib/e2ee/key-management';

describe('Key Management', () => {
  it('should generate a valid family key', async () => {
    const { familyKey, base64Key } = await generateFamilyKey();

    expect(familyKey.type).toBe('secret');
    expect(familyKey.algorithm.name).toBe('AES-GCM');
    expect(base64Key).toMatch(/^[A-Za-z0-9+/=]+$/); // Valid base64
  });

  it('should import and export keys consistently', async () => {
    const { base64Key } = await generateFamilyKey();
    const importedKey = await importFamilyKey(base64Key);

    expect(importedKey.type).toBe('secret');
    expect(importedKey.algorithm.name).toBe('AES-GCM');
  });

  it('should format and parse invite codes correctly', async () => {
    const inviteCode = 'FAMILY-A3X9K2P1';
    const { base64Key } = await generateFamilyKey();

    const fullInvite = createInviteCodeWithKey(inviteCode, base64Key);
    const parsed = parseInviteCode(fullInvite);

    expect(parsed.code).toBe(inviteCode);
    expect(parsed.base64Key).toBe(base64Key);
  });

  it('should reject invalid invite code formats', () => {
    expect(() => parseInviteCode('INVALIDCODE')).toThrow('Invalid invite code format');
  });
});
```

### 5.2 Integration Tests

**File:** `tests/integration/e2ee/message-flow.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { encryptMessage, decryptMessage } from '@/lib/e2ee/encryption';
import { generateFamilyKey } from '@/lib/e2ee/key-management';
import { storeKey, retrieveKey } from '@/lib/e2ee/storage';

describe('E2EE Message Flow Integration', () => {
  let familyKey: CryptoKey;

  beforeAll(async () => {
    const { familyKey: key } = await generateFamilyKey();
    familyKey = key;
    await storeKey('familyKey', key);
  });

  it('should encrypt message, store in DB, retrieve, and decrypt', async () => {
    const message = 'Integration test message';

    // Simulate client-side encryption
    const encrypted = await encryptMessage(message, familyKey);

    // Simulate server storage (store encrypted string)
    const storedCiphertext = encrypted;

    // Simulate client retrieval and decryption
    const retrievedKey = await retrieveKey('familyKey');
    const decrypted = await decryptMessage(storedCiphertext, retrievedKey!);

    expect(decrypted).toBe(message);
  });
});
```

### 5.3 E2E Tests (Playwright)

**File:** `tests/e2e/e2ee/encryption.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('E2EE End-to-End', () => {
  test('should send and receive encrypted message', async ({ page, context }) => {
    // Create family admin
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="familyName"]', 'Test Family');
    await page.fill('[name="password"]', 'password123');
    await page.click('button:text("Create Family")');

    // Get invite code (with embedded key)
    await page.click('button:text("Settings")');
    const inviteCode = await page.locator('[data-testid="invite-code"]').textContent();

    // Open second browser context (family member)
    const memberPage = await context.newPage();
    await memberPage.goto('/login');
    await memberPage.fill('[name="email"]', 'member@test.com');
    await memberPage.fill('[name="inviteCode"]', inviteCode!);
    await memberPage.fill('[name="password"]', 'password123');
    await memberPage.click('button:text("Join Family")');

    // Admin sends message
    await page.goto('/chat');
    await page.fill('[data-testid="message-input"]', 'Encrypted test message');
    await page.click('button:text("Send")');

    // Member receives message
    await memberPage.goto('/chat');
    await expect(memberPage.locator('text=Encrypted test message')).toBeVisible();

    // Verify server never saw plaintext (check network logs - ciphertext only)
    const requests = page.context().on('request', (request) => {
      if (request.url().includes('/api/messages')) {
        const postData = request.postData();
        expect(postData).not.toContain('Encrypted test message'); // Plaintext not in request
        expect(postData).toContain('encryptedContent'); // Ciphertext field present
      }
    });
  });
});
```

### 5.4 Security Tests

**File:** `tests/security/e2ee-audit.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { encryptMessage } from '@/lib/e2ee/encryption';
import { generateFamilyKey } from '@/lib/e2ee/key-management';

describe('E2EE Security Audit', () => {
  it('should use random IVs (no IV reuse)', async () => {
    const { familyKey } = await generateFamilyKey();
    const plaintext = 'Same message';

    const encrypted1 = await encryptMessage(plaintext, familyKey);
    const encrypted2 = await encryptMessage(plaintext, familyKey);

    // Extract IVs (first 16 base64 chars = 12 bytes)
    const iv1 = encrypted1.slice(0, 16);
    const iv2 = encrypted2.slice(0, 16);

    expect(iv1).not.toBe(iv2); // IVs must be different
  });

  it('should produce ciphertext of appropriate length', async () => {
    const { familyKey } = await generateFamilyKey();
    const plaintext = 'A'.repeat(100);

    const encrypted = await encryptMessage(plaintext, familyKey);

    // Ciphertext = IV (12 bytes) + ciphertext (100 bytes) + auth tag (16 bytes) = 128 bytes
    // Base64 encoding: 128 bytes * 4/3 ≈ 171 chars
    expect(encrypted.length).toBeGreaterThan(170);
  });

  it('should fail authentication with tampered ciphertext', async () => {
    const { familyKey } = await generateFamilyKey();
    const encrypted = await encryptMessage('Original message', familyKey);

    // Tamper with ciphertext (flip a bit)
    const tampered = encrypted.slice(0, -1) + 'X';

    await expect(decryptMessage(tampered, familyKey)).rejects.toThrow();
  });
});
```

### 5.5 Coverage Targets

- **Unit Test Coverage:** 95%+ for `lib/e2ee/` module
- **Integration Test Coverage:** 80%+ for E2EE flows
- **E2E Test Coverage:** All user-facing encryption scenarios (send message, upload photo)
- **Security Test Coverage:** 100% of crypto primitives (IV randomness, auth tag validation)

---

## 6. Security Considerations

### 6.1 Threat Model

**In Scope:**
- ✅ External attackers intercepting network traffic
- ✅ Database breach (attacker gains access to PostgreSQL)
- ✅ Object storage breach (attacker gains access to Supabase Storage)
- ✅ Compromised Groq API (translation service sees plaintext temporarily)

**Out of Scope (MVP):**
- ❌ Malicious family members (trust model: family members trust each other)
- ❌ Compromised Vercel or Supabase infrastructure (require client-side key storage)
- ❌ Nation-state attackers
- ❌ Quantum computing attacks (AES-256 is quantum-resistant for now)

### 6.2 Security Guarantees

**What E2EE Protects:**
- ✅ Server cannot read messages/photos (zero-knowledge)
- ✅ Database breach does not expose content (ciphertext only)
- ✅ Network eavesdropping defeated (HTTPS + E2EE double encryption)
- ✅ Object storage breach does not expose photos (encrypted blobs)

**What E2EE Does NOT Protect:**
- ⚠️ Metadata (sender, timestamp, channel ID) visible to server
- ⚠️ Forward secrecy (key compromise = all messages compromised)
- ⚠️ Removed members can still decrypt old messages (no key rotation in MVP)
- ⚠️ Server can inject malicious keys (requires compromising Vercel/Supabase)

### 6.3 Browser Compatibility

**Minimum Browser Versions (Web Crypto API support):**
- Chrome 90+ (released April 2021)
- Firefox 88+ (released April 2021)
- Safari 14+ (released September 2020)
- Edge 90+ (Chromium-based, released April 2021)

**Unsupported Browsers:**
- Internet Explorer (no Web Crypto support)
- Older mobile browsers (iOS < 14, Android < 90)

**Detection:**
```typescript
function isWebCryptoSupported(): boolean {
  return !!(window.crypto && window.crypto.subtle);
}

if (!isWebCryptoSupported()) {
  alert('Your browser does not support encryption. Please update to a modern browser.');
  window.location.href = '/unsupported-browser';
}
```

### 6.4 Key Rotation (Phase 2)

**MVP:** No key rotation (single family key for life of family)

**Phase 2 Plan:**
1. Admin initiates key rotation
2. Generate new family key
3. Re-encrypt all messages/photos with new key (background job)
4. Update invite codes with new key
5. Removed members lose access to new messages (old messages still accessible)

**Complexity:** High - deferred to Phase 2 to maintain MVP simplicity.

---

## 7. Performance Targets

### 7.1 Encryption Performance

| Operation | Target Latency | Acceptable Max | Measurement |
|-----------|---------------|----------------|-------------|
| **Encrypt message (100 chars)** | < 5ms | < 20ms | Web Crypto API (native) |
| **Decrypt message (100 chars)** | < 5ms | < 20ms | Web Crypto API (native) |
| **Encrypt photo (1MB)** | < 50ms | < 200ms | Async operation |
| **Decrypt photo (1MB)** | < 50ms | < 200ms | Async operation |
| **Generate family key** | < 10ms | < 50ms | One-time operation |
| **Store key in IndexedDB** | < 10ms | < 50ms | Persistent storage |

### 7.2 Perceived Performance

**User Expectations:**
- Message encryption must be imperceptible (< 20ms)
- Photo encryption can have slight delay (< 200ms acceptable)
- Key retrieval from IndexedDB must be fast (< 50ms)

**Optimization Strategies:**
- Use Web Workers for large file encryption (offload to background thread)
- Cache family key in memory (avoid repeated IndexedDB reads)
- Batch encrypt/decrypt multiple messages (Promise.all)

**Performance Testing:**
```typescript
// Benchmark encryption speed
import { performance } from 'perf_hooks';

async function benchmarkEncryption() {
  const { familyKey } = await generateFamilyKey();
  const message = 'A'.repeat(100);

  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    await encryptMessage(message, familyKey);
  }
  const end = performance.now();

  console.log(`Avg encryption time: ${(end - start) / 1000} ms`);
}
```

---

## 8. Implementation Checklist

### Phase 1: Core Encryption (Week 1)
- [ ] Implement `lib/e2ee/encryption.ts` (encryptMessage, decryptMessage, encryptFile, decryptFile)
- [ ] Implement `lib/e2ee/key-management.ts` (generateFamilyKey, importFamilyKey)
- [ ] Implement `lib/e2ee/storage.ts` (IndexedDB key storage)
- [ ] Write unit tests for encryption primitives (95% coverage)
- [ ] Test browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Benchmark encryption performance (< 20ms for messages)

### Phase 2: Key Distribution (Week 1)
- [ ] Implement invite code with embedded key (createInviteCodeWithKey, parseInviteCode)
- [ ] Test key import/export (family creation and join)
- [ ] Write integration tests for key distribution flow
- [ ] Test key persistence across browser restarts (IndexedDB)

### Phase 3: Integration (Week 2)
- [ ] Integrate E2EE into Epic 2 (message encryption/decryption)
- [ ] Integrate E2EE into Epic 3 (photo encryption/decryption)
- [ ] Test end-to-end message flow (send encrypted, receive encrypted, decrypt)
- [ ] Test end-to-end photo flow (upload encrypted, download encrypted, decrypt)
- [ ] Verify server never sees plaintext (network log inspection)

### Phase 4: Security Audit (Week 2)
- [ ] Run security tests (IV randomness, auth tag validation)
- [ ] Verify zero-knowledge architecture (server stores ciphertext only)
- [ ] Test decryption failure scenarios (wrong key, corrupted data)
- [ ] Review threat model and document tradeoffs
- [ ] Optional: External security audit (penetration test)

---

## 9. Dependencies & Risks

**Depends On:**
- None (Epic 7 is the foundation for all other epics)

**Depended On By:**
- Epic 1: Key distribution during family creation/join
- Epic 2: Message encryption/decryption
- Epic 3: Photo encryption/decryption

**Risks:**

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Web Crypto API performance on low-end devices** | High | Medium | Benchmark on target devices (older iPhones, Android), use Web Workers if needed |
| **IndexedDB quota exhausted** | Medium | Low | Fall back to sessionStorage (warn user), implement key compression |
| **Key compromise (leaked invite code)** | High | Low | Phase 2: Add key rotation, audit invite code sharing practices |
| **Browser compatibility issues** | Medium | Low | Test on minimum supported versions, graceful error messages |
| **Plaintext accidentally stored** | Critical | Very Low | Code review all database operations, E2E tests verify ciphertext |

---

## 10. Acceptance Criteria

### AC-1: Messages Encrypted Before Leaving Device
- [ ] Network logs show only `encryptedContent` field (no plaintext)
- [ ] Database inspection shows ciphertext only in `messages.encrypted_content`
- [ ] Decryption happens in client only (verify with browser DevTools)

### AC-2: Server Stores Only Ciphertext
- [ ] Database query: `SELECT encrypted_content FROM messages` returns base64 gibberish
- [ ] Supabase Storage: Download encrypted photo, verify it's not a valid image (before decryption)
- [ ] Server logs do not contain plaintext messages (audit logs)

### AC-3: Decryption Happens Only on Recipient Devices
- [ ] Recipient's browser decrypts message locally (no server API call for decryption)
- [ ] Family key never sent to server (verify network logs)
- [ ] IndexedDB contains CryptoKey (not base64 key on disk)

### AC-4: No Manual Key Management Required
- [ ] User creates family without seeing "key" or "encryption" UI
- [ ] User joins family with invite code only (key embedded, transparent)
- [ ] No "verify device" or "trust key" prompts (UX test with non-tech users)

### AC-5: Photos Encrypted Before Upload
- [ ] Network upload contains `application/octet-stream` (not `image/jpeg`)
- [ ] Supabase Storage blob cannot be opened as image (without decryption)
- [ ] Client-side decryption displays correct image

### AC-6: Thumbnails Also Encrypted
- [ ] Photo grid fetches encrypted blobs, decrypts client-side
- [ ] Thumbnail generation happens after decryption (not on server)

### AC-7: Transparent Encryption (No Loading Delays)
- [ ] Message send latency < 2 seconds (NFR-2.1)
- [ ] Photo upload latency < 5 seconds for 10MB (NFR-2.2)
- [ ] No "Encrypting..." loading indicators (encryption is imperceptible)

### AC-8: Error Messages Don't Expose Crypto Details
- [ ] Decryption failure shows: "Failed to decrypt message. You may not have access to this family."
- [ ] No stack traces or "AES-GCM" errors visible to users
- [ ] Errors logged to console for developers (not shown to users)

### AC-9: Backup/Sync Works Seamlessly
- [ ] Family key persists across browser restarts (IndexedDB)
- [ ] Multiple devices (same user) can access messages (same family key)
- [ ] Logout clears keys (verify IndexedDB empty after logout)

---

## 11. Migration Path (Phase 2+)

### Upgrade to Megolm (Optional, Phase 2)

If forward secrecy becomes a requirement:

1. **Dual-encryption mode:**
   - Shared Family Key for MVP users (legacy)
   - Megolm for new "Advanced Security" users (opt-in)

2. **Migration strategy:**
   - Generate per-user Megolm keys
   - Encrypt new messages with Megolm
   - Old messages remain with Shared Family Key
   - Gradual migration over 6 months

3. **UX changes:**
   - Add "Advanced Security Mode" toggle in settings
   - Show device verification UI (only for Megolm users)
   - Legacy users see no changes

**Effort:** ~3 weeks for Megolm implementation + 1 week migration logic

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-13 | Claude (Tech Spec Generator) | Initial tech spec for Epic 7 |

---

**Status:** ✅ Ready for Implementation
