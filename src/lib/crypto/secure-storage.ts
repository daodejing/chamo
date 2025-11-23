import Dexie, { Table } from 'dexie';
import {
  applyEncryptionMiddleware,
  NON_INDEXED_FIELDS,
} from 'dexie-encrypted';

import {
  cryptoStorageConfig,
  deviceFingerprintSeedOrder,
  type DeviceFingerprintSeed,
  USER_KEYS_TABLE,
} from './config';
import { SECRET_KEY_BYTE_LENGTH } from './keypair';

type UserKeyRecord = {
  userId: string;
  secretKey: string; // base64
};

type CryptoDatabase = Dexie & {
  userKeys: Table<UserKeyRecord, string>;
};

type NodeBuffer = typeof import('buffer').Buffer;

const nodeBuffer: NodeBuffer | undefined = (globalThis as {
  Buffer?: NodeBuffer;
}).Buffer;

const fingerprintResolvers: Record<DeviceFingerprintSeed, () => string> = {
  'navigator.userAgent': () =>
    typeof navigator !== 'undefined' ? navigator.userAgent ?? '' : '',
  'navigator.language': () =>
    typeof navigator !== 'undefined' ? navigator.language ?? '' : '',
  'navigator.platform': () =>
    typeof navigator !== 'undefined' ? navigator.platform ?? '' : '',
  'screen.width': () =>
    typeof screen !== 'undefined' ? String(screen.width ?? '') : '',
  'screen.height': () =>
    typeof screen !== 'undefined' ? String(screen.height ?? '') : '',
  'screen.colorDepth': () =>
    typeof screen !== 'undefined' ? String(screen.colorDepth ?? '') : '',
  'window.devicePixelRatio': () =>
    typeof window !== 'undefined'
      ? String(window.devicePixelRatio ?? '')
      : '',
};

let dbPromise: Promise<CryptoDatabase> | null = null;
let activeDb: CryptoDatabase | null = null;

function ensureEnvironment(): void {
  if (typeof indexedDB === 'undefined') {
    throw new Error(
      'IndexedDB is not available. Encryption keys can only be stored in modern browsers.'
    );
  }

  if (typeof globalThis.crypto?.subtle === 'undefined') {
    throw new Error(
      'Web Crypto API is required for secure key storage but is unavailable in this environment.'
    );
  }
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  if (typeof globalThis.btoa === 'function') {
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return globalThis.btoa(binary);
  }

  if (nodeBuffer) {
    return nodeBuffer.from(bytes).toString('base64');
  }

  throw new Error('Base64 encoding is not supported in this environment.');
}

function decodeBase64ToBytes(value: string): Uint8Array {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(value);
    const output = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      output[i] = binary.charCodeAt(i);
    }
    return output;
  }

  if (nodeBuffer) {
    return new Uint8Array(nodeBuffer.from(value, 'base64'));
  }

  throw new Error('Base64 decoding is not supported in this environment.');
}

async function deriveEncryptionKey(): Promise<Uint8Array> {
  const seed = deviceFingerprintSeedOrder
    .map((field) => fingerprintResolvers[field]?.() ?? '')
    .join('|');

  const encodedSeed = new TextEncoder().encode(seed);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encodedSeed);
  return new Uint8Array(digest);
}

async function createDatabase(): Promise<CryptoDatabase> {
  ensureEnvironment();

  const encryptionKey = await deriveEncryptionKey();
  const db = new Dexie(
    cryptoStorageConfig.dbName
  ) as unknown as CryptoDatabase;

  const tableSettings = Object.fromEntries(
    cryptoStorageConfig.encryption.tables.map((table) => [
      table,
      NON_INDEXED_FIELDS,
    ])
  );

  const onKeyChange = async (db: CryptoDatabase) => {
    // Clear all encrypted tables when the encryption key changes
    // This ensures we don't have data encrypted with an old key
    console.warn('[SecureStorage] Encryption key changed - clearing encrypted tables');
    await Promise.all(
      cryptoStorageConfig.encryption.tables.map((tableName) =>
        db.table(tableName).clear()
      )
    );
  };

  applyEncryptionMiddleware(db, encryptionKey, tableSettings, onKeyChange);
  db.version(cryptoStorageConfig.version).stores(cryptoStorageConfig.stores);

  db.userKeys = db.table(USER_KEYS_TABLE);
  await db.open();
  activeDb = db;
  return db;
}

async function getDatabase(): Promise<CryptoDatabase> {
  if (!dbPromise) {
    dbPromise = createDatabase().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }

  return dbPromise;
}

function ensureSecretKeyLength(secretKey: Uint8Array): void {
  if (secretKey.length !== SECRET_KEY_BYTE_LENGTH) {
    throw new Error(
      `Private key must be ${SECRET_KEY_BYTE_LENGTH} bytes. Received ${secretKey.length}.`
    );
  }
}

function normalizeUserId(userId: string): string {
  if (!userId || !userId.trim()) {
    throw new Error('A valid user identifier is required.');
  }
  return userId.trim();
}

function isQuotaExceeded(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === 'QuotaExceededError'
  );
}

export async function storePrivateKey(
  userId: string,
  secretKey: Uint8Array
): Promise<void> {
  ensureSecretKeyLength(secretKey);
  const normalizedUserId = normalizeUserId(userId);
  const db = await getDatabase();

  try {
    await db.userKeys.put({
      userId: normalizedUserId,
      secretKey: encodeBytesToBase64(secretKey),
    });
  } catch (error) {
    if (isQuotaExceeded(error)) {
      throw new Error(
        'Unable to store encryption keys: browser storage quota exceeded.'
      );
    }
    throw error instanceof Error
      ? error
      : new Error('Failed to store encryption key.');
  }
}

export async function getPrivateKey(
  userId: string
): Promise<Uint8Array | null> {
  const normalizedUserId = normalizeUserId(userId);
  const db = await getDatabase();
  const record = await db.userKeys.get(normalizedUserId);
  if (!record) {
    return null;
  }
  const secretKey = decodeBase64ToBytes(record.secretKey);
  ensureSecretKeyLength(secretKey);
  return secretKey;
}

export async function hasPrivateKey(userId: string): Promise<boolean> {
  const normalizedUserId = normalizeUserId(userId);
  const db = await getDatabase();
  const record = await db.userKeys.get(normalizedUserId);
  return Boolean(record);
}

export async function __dangerous__closeCryptoStorageForTests(): Promise<void> {
  if (activeDb) {
    activeDb.close();
    activeDb = null;
  }
  dbPromise = null;
}

export async function __dangerous__wipeCryptoStorageForTests(): Promise<void> {
  await __dangerous__closeCryptoStorageForTests();
  try {
    await Dexie.delete(cryptoStorageConfig.dbName);
  } catch {
    // Best-effort cleanup; ignore errors (e.g., database never opened)
  }
}
