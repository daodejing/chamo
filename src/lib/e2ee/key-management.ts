/**
 * Family key generation and distribution.
 */

import { storeKey, retrieveKey, deleteKey, clearKeys, listKeys } from './storage';

const FAMILY_KEY_PREFIX = 'familyKey';

function buildKeyStorageName(familyId: string): string {
  if (!familyId || familyId.trim().length === 0) {
    throw new Error('Family identifier is required for key storage.');
  }
  return `${FAMILY_KEY_PREFIX}:${familyId}`;
}

export async function listStoredFamilyKeyIds(): Promise<string[]> {
  const keys = await listKeys();
  return keys
    .filter((key) => key.startsWith(`${FAMILY_KEY_PREFIX}:`))
    .map((key) => key.replace(`${FAMILY_KEY_PREFIX}:`, ''));
}

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
      salt: salt as BufferSource,
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
 * Generates a cryptographically secure invite code.
 * Format: FAMILY-XXXXXXXXXXXXXXXX (128-bit random code)
 * Security relies on high entropy to prevent guessing.
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (0/O, 1/I)
  const codeLength = 16; // 128-bit entropy (33^16)

  const randomValues = new Uint8Array(codeLength);
  crypto.getRandomValues(randomValues);

  const code = Array.from(randomValues, (byte) =>
    chars.charAt(byte % chars.length)
  ).join('');

  return `FAMILY-${code}`;
}

/**
 * Formats invite code with embedded key.
 * Format: FAMILY-{16 random chars}:{base64 key}
 * Example: FAMILY-A3X9K2P1BCDEFGH2:dGVzdGtleWV4YW1wbGUxMjM0NTY3ODkwMTIzNDU2Nzg5MA==
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
  const parts = inviteCodeWithKey.split(':');

  // Must have exactly 2 parts (code and key)
  if (parts.length !== 2) {
    throw new Error('Invalid invite code format. Expected CODE:KEY');
  }

  const [code, base64Key] = parts;

  if (!code || !base64Key) {
    throw new Error('Invalid invite code format. Expected CODE:KEY');
  }

  return { code, base64Key };
}

/**
 * Initializes family key on first load (after login).
 * @param base64Key - Family key from server
 */
export async function initializeFamilyKey(base64Key: string, familyId: string): Promise<void> {
  if (!familyId) {
    throw new Error('initializeFamilyKey requires a familyId');
  }
  const familyKey = await importFamilyKey(base64Key);
  await storeKey(buildKeyStorageName(familyId), familyKey);
}

/**
 * Gets the current family key from storage.
 * @returns Family key or null if not found
 */
export async function getFamilyKey(familyId: string): Promise<CryptoKey | null> {
  return retrieveKey(buildKeyStorageName(familyId));
}

/**
 * Exports the stored family key as a base64-encoded string.
 * @returns Base64 key or null if not available
 */
export async function getFamilyKeyBase64(familyId: string): Promise<string | null> {
  const familyKey = await getFamilyKey(familyId);

  if (!familyKey) {
    return null;
  }

  const rawKey = await crypto.subtle.exportKey('raw', familyKey);
  const bytes = new Uint8Array(rawKey);
  let binary = '';

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

/**
 * Clears all keys from storage (on logout).
 */
export async function clearFamilyKey(familyId?: string): Promise<void> {
  if (familyId) {
    await deleteKey(buildKeyStorageName(familyId));
    return;
  }
  await clearKeys();
}
