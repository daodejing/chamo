/**
 * Crypto utilities for cross-device key transfer via QR code.
 * Implements PIN-protected encryption for secure key transfer.
 *
 * Security properties:
 * - Private key encrypted with AES-256-GCM
 * - PIN-derived key via PBKDF2 (100,000 iterations)
 * - Salt and IV are random per transfer
 * - Payload contains encrypted key + public key for verification
 */
import nacl from 'tweetnacl';

import { SECRET_KEY_BYTE_LENGTH, PUBLIC_KEY_BYTE_LENGTH } from './keypair';

export const KEY_TRANSFER_VERSION = 1;
export const PIN_LENGTH = 6;
export const PBKDF2_ITERATIONS = 100_000;
export const SALT_BYTE_LENGTH = 16;
export const IV_BYTE_LENGTH = 12; // GCM standard IV length
export const MAX_PIN_ATTEMPTS = 3;
export const TRANSFER_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export type TransferPayload = {
  /** Encrypted private key (base64) */
  encryptedKey: string;
  /** AES-GCM initialization vector (base64) */
  iv: string;
  /** PBKDF2 salt (base64) */
  salt: string;
  /** Unencrypted public key for verification (base64) */
  publicKey: string;
  /** Payload format version */
  version: number;
  /** Unix timestamp when QR expires */
  expiresAt: number;
};

export type TransferError =
  | 'INVALID_PIN'
  | 'KEY_MISMATCH'
  | 'PAYLOAD_INVALID'
  | 'PAYLOAD_EXPIRED'
  | 'STORAGE_FAILED'
  | 'NETWORK_ERROR';

export class KeyTransferError extends Error {
  constructor(
    public readonly code: TransferError,
    message: string
  ) {
    super(message);
    this.name = 'KeyTransferError';
  }
}

type NodeBuffer = typeof import('buffer').Buffer;

const nodeBuffer: NodeBuffer | undefined = (globalThis as {
  Buffer?: NodeBuffer;
}).Buffer;

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
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  if (nodeBuffer) {
    return new Uint8Array(nodeBuffer.from(value, 'base64'));
  }

  throw new Error('Base64 decoding is not supported in this environment.');
}

function assertWebCryptoAvailable(): void {
  if (typeof globalThis.crypto?.subtle === 'undefined') {
    throw new Error(
      'Web Crypto API is required for key transfer but is unavailable in this environment.'
    );
  }
}

/**
 * Generate a 6-digit random PIN for key transfer.
 * Uses crypto.getRandomValues for cryptographic randomness.
 */
export function generateTransferPIN(): string {
  assertWebCryptoAvailable();

  const randomBytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(randomBytes);

  // Convert to number and modulo to get 6 digits
  const value =
    (randomBytes[0] << 24) |
    (randomBytes[1] << 16) |
    (randomBytes[2] << 8) |
    randomBytes[3];
  const pin = Math.abs(value) % 1_000_000;

  return pin.toString().padStart(PIN_LENGTH, '0');
}

/**
 * Derive an AES-256 key from a PIN using PBKDF2.
 *
 * @param pin - 6-digit PIN string
 * @param salt - 16-byte random salt
 * @returns CryptoKey suitable for AES-GCM encryption
 */
export async function deriveKeyFromPIN(
  pin: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  assertWebCryptoAvailable();

  if (pin.length !== PIN_LENGTH || !/^\d{6}$/.test(pin)) {
    throw new KeyTransferError('INVALID_PIN', 'PIN must be exactly 6 digits');
  }

  if (salt.length !== SALT_BYTE_LENGTH) {
    throw new KeyTransferError(
      'PAYLOAD_INVALID',
      `Salt must be ${SALT_BYTE_LENGTH} bytes`
    );
  }

  const pinBytes = new TextEncoder().encode(pin);

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    pinBytes,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a private key for transfer using PIN-derived encryption.
 *
 * @param privateKey - 32-byte NaCl secret key
 * @param publicKey - 32-byte NaCl public key (included for verification)
 * @param pin - 6-digit PIN for encryption
 * @returns TransferPayload ready for QR encoding
 */
export async function encryptKeyForTransfer(
  privateKey: Uint8Array,
  publicKey: Uint8Array,
  pin: string
): Promise<TransferPayload> {
  assertWebCryptoAvailable();

  if (privateKey.length !== SECRET_KEY_BYTE_LENGTH) {
    throw new Error(`Private key must be ${SECRET_KEY_BYTE_LENGTH} bytes`);
  }

  if (publicKey.length !== PUBLIC_KEY_BYTE_LENGTH) {
    throw new Error(`Public key must be ${PUBLIC_KEY_BYTE_LENGTH} bytes`);
  }

  // Generate random salt and IV
  const salt = new Uint8Array(SALT_BYTE_LENGTH);
  const iv = new Uint8Array(IV_BYTE_LENGTH);
  globalThis.crypto.getRandomValues(salt);
  globalThis.crypto.getRandomValues(iv);

  // Derive encryption key from PIN
  const aesKey = await deriveKeyFromPIN(pin, salt);

  // Encrypt the private key
  const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    privateKey
  );

  return {
    encryptedKey: encodeBytesToBase64(new Uint8Array(encryptedBuffer)),
    iv: encodeBytesToBase64(iv),
    salt: encodeBytesToBase64(salt),
    publicKey: encodeBytesToBase64(publicKey),
    version: KEY_TRANSFER_VERSION,
    expiresAt: Date.now() + TRANSFER_EXPIRY_MS,
  };
}

/**
 * Validate the structure of a transfer payload.
 *
 * @param payload - Object to validate
 * @throws KeyTransferError if payload is invalid
 */
export function validateTransferPayload(payload: unknown): asserts payload is TransferPayload {
  if (typeof payload !== 'object' || payload === null) {
    throw new KeyTransferError('PAYLOAD_INVALID', 'Payload must be an object');
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.version !== 'number' || p.version !== KEY_TRANSFER_VERSION) {
    throw new KeyTransferError(
      'PAYLOAD_INVALID',
      `Unsupported payload version: ${p.version}`
    );
  }

  const requiredFields = ['encryptedKey', 'iv', 'salt', 'publicKey', 'expiresAt'];
  for (const field of requiredFields) {
    if (!(field in p)) {
      throw new KeyTransferError('PAYLOAD_INVALID', `Missing required field: ${field}`);
    }
  }

  if (typeof p.expiresAt !== 'number') {
    throw new KeyTransferError('PAYLOAD_INVALID', 'expiresAt must be a number');
  }

  const stringFields = ['encryptedKey', 'iv', 'salt', 'publicKey'];
  for (const field of stringFields) {
    if (typeof p[field] !== 'string') {
      throw new KeyTransferError('PAYLOAD_INVALID', `${field} must be a string`);
    }
  }
}

/**
 * Check if a transfer payload has expired.
 */
export function isPayloadExpired(payload: TransferPayload): boolean {
  return Date.now() > payload.expiresAt;
}

/**
 * Decrypt a private key from a transfer payload using PIN.
 *
 * @param payload - TransferPayload from QR code
 * @param pin - 6-digit PIN entered by user
 * @returns Decrypted private key (32 bytes)
 * @throws KeyTransferError on invalid PIN or payload
 */
export async function decryptKeyFromTransfer(
  payload: TransferPayload,
  pin: string
): Promise<Uint8Array> {
  assertWebCryptoAvailable();
  validateTransferPayload(payload);

  if (isPayloadExpired(payload)) {
    throw new KeyTransferError('PAYLOAD_EXPIRED', 'This QR code has expired');
  }

  const salt = decodeBase64ToBytes(payload.salt);
  const iv = decodeBase64ToBytes(payload.iv);
  const encryptedKey = decodeBase64ToBytes(payload.encryptedKey);

  // Derive decryption key from PIN
  const aesKey = await deriveKeyFromPIN(pin, salt);

  try {
    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encryptedKey
    );

    const privateKey = new Uint8Array(decryptedBuffer);

    if (privateKey.length !== SECRET_KEY_BYTE_LENGTH) {
      throw new KeyTransferError(
        'PAYLOAD_INVALID',
        `Decrypted key has wrong length: ${privateKey.length}`
      );
    }

    return privateKey;
  } catch (error) {
    // AES-GCM throws on wrong key (authentication failure)
    if (error instanceof KeyTransferError) {
      throw error;
    }
    throw new KeyTransferError(
      'INVALID_PIN',
      'Incorrect PIN or corrupted data'
    );
  }
}

/**
 * Verify that a private key matches a public key.
 * Derives the public key from the private key and compares.
 *
 * @param privateKey - 32-byte NaCl secret key
 * @param publicKey - 32-byte NaCl public key to verify against
 * @returns true if keys match, false otherwise
 */
export function verifyKeyPair(
  privateKey: Uint8Array,
  publicKey: Uint8Array
): boolean {
  if (privateKey.length !== SECRET_KEY_BYTE_LENGTH) {
    return false;
  }

  if (publicKey.length !== PUBLIC_KEY_BYTE_LENGTH) {
    return false;
  }

  // NaCl box.keyPair.fromSecretKey derives public key from secret key
  const keypair = nacl.box.keyPair.fromSecretKey(privateKey);
  const derivedPublic = keypair.publicKey;

  // Constant-time comparison to avoid timing attacks
  if (derivedPublic.length !== publicKey.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < derivedPublic.length; i++) {
    diff |= derivedPublic[i] ^ publicKey[i];
  }

  return diff === 0;
}

/**
 * Serialize a TransferPayload to a JSON string for QR encoding.
 */
export function serializePayload(payload: TransferPayload): string {
  return JSON.stringify(payload);
}

/**
 * Parse a QR code string back to a TransferPayload.
 *
 * @param data - JSON string from QR code
 * @returns Validated TransferPayload
 * @throws KeyTransferError if data is not a valid payload
 */
export function parsePayload(data: string): TransferPayload {
  try {
    const parsed = JSON.parse(data);
    validateTransferPayload(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof KeyTransferError) {
      throw error;
    }
    throw new KeyTransferError(
      'PAYLOAD_INVALID',
      "This doesn't look like a Chamo key transfer code"
    );
  }
}
