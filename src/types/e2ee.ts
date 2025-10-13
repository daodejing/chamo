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
