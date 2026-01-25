import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import nacl from 'tweetnacl';

import {
  generateTransferPIN,
  deriveKeyFromPIN,
  encryptKeyForTransfer,
  decryptKeyFromTransfer,
  verifyKeyPair,
  validateTransferPayload,
  isPayloadExpired,
  parsePayload,
  serializePayload,
  KeyTransferError,
  PIN_LENGTH,
  SALT_BYTE_LENGTH,
  KEY_TRANSFER_VERSION,
  TRANSFER_EXPIRY_MS,
  type TransferPayload,
} from '@/lib/crypto/key-transfer';
import { SECRET_KEY_BYTE_LENGTH, PUBLIC_KEY_BYTE_LENGTH } from '@/lib/crypto/keypair';

describe('generateTransferPIN', () => {
  it('generates a 6-digit string', () => {
    const pin = generateTransferPIN();

    expect(pin).toHaveLength(PIN_LENGTH);
    expect(/^\d{6}$/.test(pin)).toBe(true);
  });

  it('generates unique PINs on each call', () => {
    const pins = new Set<string>();
    for (let i = 0; i < 100; i++) {
      pins.add(generateTransferPIN());
    }

    // With 6 digits (1M possibilities), 100 calls should almost always be unique
    expect(pins.size).toBeGreaterThan(90);
  });

  it('pads PINs with leading zeros when needed', () => {
    // Run many times to increase chance of getting a low number
    const pins: string[] = [];
    for (let i = 0; i < 1000; i++) {
      pins.push(generateTransferPIN());
    }

    // All should be exactly 6 characters
    expect(pins.every((p) => p.length === PIN_LENGTH)).toBe(true);
  });
});

describe('deriveKeyFromPIN', () => {
  it('derives a CryptoKey from valid PIN and salt', async () => {
    const pin = '123456';
    const salt = nacl.randomBytes(SALT_BYTE_LENGTH);

    const key = await deriveKeyFromPIN(pin, salt);

    expect(key).toBeInstanceOf(CryptoKey);
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('derives the same key for the same PIN and salt', async () => {
    const pin = '654321';
    const salt = nacl.randomBytes(SALT_BYTE_LENGTH);

    // Derive twice with same inputs
    const key1 = await deriveKeyFromPIN(pin, salt);
    const key2 = await deriveKeyFromPIN(pin, salt);

    // Verify by encrypting the same data and comparing ciphertext
    // (same key + same IV = same ciphertext)
    const iv = nacl.randomBytes(12);
    const testData = new TextEncoder().encode('test data');

    const encrypted1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, testData);
    const encrypted2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key2, testData);

    expect(new Uint8Array(encrypted1)).toEqual(new Uint8Array(encrypted2));
  });

  it('derives different keys for different PINs', async () => {
    const salt = nacl.randomBytes(SALT_BYTE_LENGTH);

    const key1 = await deriveKeyFromPIN('111111', salt);
    const key2 = await deriveKeyFromPIN('222222', salt);

    // Verify by encrypting the same data and comparing ciphertext
    const iv = nacl.randomBytes(12);
    const testData = new TextEncoder().encode('test data');

    const encrypted1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, testData);
    const encrypted2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key2, testData);

    expect(new Uint8Array(encrypted1)).not.toEqual(new Uint8Array(encrypted2));
  });

  it('derives different keys for different salts', async () => {
    const pin = '123456';

    const key1 = await deriveKeyFromPIN(pin, nacl.randomBytes(SALT_BYTE_LENGTH));
    const key2 = await deriveKeyFromPIN(pin, nacl.randomBytes(SALT_BYTE_LENGTH));

    // Verify by encrypting the same data and comparing ciphertext
    const iv = nacl.randomBytes(12);
    const testData = new TextEncoder().encode('test data');

    const encrypted1 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1, testData);
    const encrypted2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key2, testData);

    expect(new Uint8Array(encrypted1)).not.toEqual(new Uint8Array(encrypted2));
  });

  it('rejects invalid PIN format', async () => {
    const salt = nacl.randomBytes(SALT_BYTE_LENGTH);

    await expect(deriveKeyFromPIN('12345', salt)).rejects.toThrow(KeyTransferError);
    await expect(deriveKeyFromPIN('1234567', salt)).rejects.toThrow(KeyTransferError);
    await expect(deriveKeyFromPIN('abcdef', salt)).rejects.toThrow(KeyTransferError);
  });

  it('rejects invalid salt length', async () => {
    await expect(deriveKeyFromPIN('123456', new Uint8Array(8))).rejects.toThrow(
      KeyTransferError
    );
  });
});

describe('encryptKeyForTransfer / decryptKeyFromTransfer', () => {
  it('performs lossless round-trip encryption', async () => {
    const keypair = nacl.box.keyPair();
    const pin = generateTransferPIN();

    const payload = await encryptKeyForTransfer(keypair.secretKey, keypair.publicKey, pin);
    const decrypted = await decryptKeyFromTransfer(payload, pin);

    expect(decrypted).toEqual(keypair.secretKey);
  });

  it('returns a valid TransferPayload structure', async () => {
    const keypair = nacl.box.keyPair();
    const pin = '123456';

    const payload = await encryptKeyForTransfer(keypair.secretKey, keypair.publicKey, pin);

    expect(payload.version).toBe(KEY_TRANSFER_VERSION);
    expect(typeof payload.encryptedKey).toBe('string');
    expect(typeof payload.iv).toBe('string');
    expect(typeof payload.salt).toBe('string');
    expect(typeof payload.publicKey).toBe('string');
    expect(typeof payload.expiresAt).toBe('number');
    expect(payload.expiresAt).toBeGreaterThan(Date.now());
  });

  it('generates unique IV and salt per encryption', async () => {
    const keypair = nacl.box.keyPair();
    const pin = '123456';

    const payload1 = await encryptKeyForTransfer(keypair.secretKey, keypair.publicKey, pin);
    const payload2 = await encryptKeyForTransfer(keypair.secretKey, keypair.publicKey, pin);

    expect(payload1.iv).not.toBe(payload2.iv);
    expect(payload1.salt).not.toBe(payload2.salt);
    expect(payload1.encryptedKey).not.toBe(payload2.encryptedKey);
  });

  it('throws INVALID_PIN error for wrong PIN', async () => {
    const keypair = nacl.box.keyPair();
    const correctPin = '123456';
    const wrongPin = '654321';

    const payload = await encryptKeyForTransfer(keypair.secretKey, keypair.publicKey, correctPin);

    await expect(decryptKeyFromTransfer(payload, wrongPin)).rejects.toThrow(KeyTransferError);
    await expect(decryptKeyFromTransfer(payload, wrongPin)).rejects.toMatchObject({
      code: 'INVALID_PIN',
    });
  });

  it('rejects private key with wrong length', async () => {
    const publicKey = nacl.randomBytes(PUBLIC_KEY_BYTE_LENGTH);
    const wrongLengthKey = nacl.randomBytes(16);
    const pin = '123456';

    await expect(
      encryptKeyForTransfer(wrongLengthKey, publicKey, pin)
    ).rejects.toThrow(/Private key must be/);
  });

  it('rejects public key with wrong length', async () => {
    const privateKey = nacl.randomBytes(SECRET_KEY_BYTE_LENGTH);
    const wrongLengthKey = nacl.randomBytes(16);
    const pin = '123456';

    await expect(
      encryptKeyForTransfer(privateKey, wrongLengthKey, pin)
    ).rejects.toThrow(/Public key must be/);
  });
});

describe('validateTransferPayload', () => {
  const createValidPayload = (): TransferPayload => ({
    encryptedKey: 'base64data',
    iv: 'ivdata',
    salt: 'saltdata',
    publicKey: 'pubkeydata',
    version: KEY_TRANSFER_VERSION,
    expiresAt: Date.now() + 60000,
  });

  it('accepts a valid payload', () => {
    const payload = createValidPayload();
    expect(() => validateTransferPayload(payload)).not.toThrow();
  });

  it('rejects non-object values', () => {
    expect(() => validateTransferPayload(null)).toThrow(KeyTransferError);
    expect(() => validateTransferPayload('string')).toThrow(KeyTransferError);
    expect(() => validateTransferPayload(123)).toThrow(KeyTransferError);
  });

  it('rejects wrong version', () => {
    const payload = { ...createValidPayload(), version: 999 };
    expect(() => validateTransferPayload(payload)).toThrow(/Unsupported payload version/);
  });

  it('rejects missing required fields', () => {
    const required = ['encryptedKey', 'iv', 'salt', 'publicKey', 'expiresAt'];

    for (const field of required) {
      const payload = createValidPayload();
      delete (payload as Record<string, unknown>)[field];
      expect(() => validateTransferPayload(payload)).toThrow(/Missing required field/);
    }
  });

  it('rejects non-string fields', () => {
    const stringFields = ['encryptedKey', 'iv', 'salt', 'publicKey'];

    for (const field of stringFields) {
      const payload = createValidPayload();
      (payload as Record<string, unknown>)[field] = 123;
      expect(() => validateTransferPayload(payload)).toThrow(/must be a string/);
    }
  });

  it('rejects non-number expiresAt', () => {
    const payload = { ...createValidPayload(), expiresAt: 'not-a-number' };
    expect(() => validateTransferPayload(payload)).toThrow(/must be a number/);
  });
});

describe('isPayloadExpired', () => {
  it('returns false for future expiration', () => {
    const payload: TransferPayload = {
      encryptedKey: '',
      iv: '',
      salt: '',
      publicKey: '',
      version: KEY_TRANSFER_VERSION,
      expiresAt: Date.now() + 60000,
    };

    expect(isPayloadExpired(payload)).toBe(false);
  });

  it('returns true for past expiration', () => {
    const payload: TransferPayload = {
      encryptedKey: '',
      iv: '',
      salt: '',
      publicKey: '',
      version: KEY_TRANSFER_VERSION,
      expiresAt: Date.now() - 1000,
    };

    expect(isPayloadExpired(payload)).toBe(true);
  });
});

describe('decryptKeyFromTransfer with expired payload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws PAYLOAD_EXPIRED for expired QR codes', async () => {
    const keypair = nacl.box.keyPair();
    const pin = '123456';

    const payload = await encryptKeyForTransfer(keypair.secretKey, keypair.publicKey, pin);

    // Advance time past expiration
    vi.advanceTimersByTime(TRANSFER_EXPIRY_MS + 1000);

    await expect(decryptKeyFromTransfer(payload, pin)).rejects.toMatchObject({
      code: 'PAYLOAD_EXPIRED',
    });
  });
});

describe('verifyKeyPair', () => {
  it('returns true for matching keypair', () => {
    const keypair = nacl.box.keyPair();
    expect(verifyKeyPair(keypair.secretKey, keypair.publicKey)).toBe(true);
  });

  it('returns false for mismatched keypair', () => {
    const keypair1 = nacl.box.keyPair();
    const keypair2 = nacl.box.keyPair();
    expect(verifyKeyPair(keypair1.secretKey, keypair2.publicKey)).toBe(false);
  });

  it('returns false for wrong private key length', () => {
    const publicKey = nacl.randomBytes(PUBLIC_KEY_BYTE_LENGTH);
    const wrongLength = nacl.randomBytes(16);
    expect(verifyKeyPair(wrongLength, publicKey)).toBe(false);
  });

  it('returns false for wrong public key length', () => {
    const privateKey = nacl.randomBytes(SECRET_KEY_BYTE_LENGTH);
    const wrongLength = nacl.randomBytes(16);
    expect(verifyKeyPair(privateKey, wrongLength)).toBe(false);
  });
});

describe('serializePayload / parsePayload', () => {
  it('performs lossless round-trip serialization', async () => {
    const keypair = nacl.box.keyPair();
    const pin = '123456';

    const original = await encryptKeyForTransfer(keypair.secretKey, keypair.publicKey, pin);
    const serialized = serializePayload(original);
    const parsed = parsePayload(serialized);

    expect(parsed).toEqual(original);
  });

  it('throws PAYLOAD_INVALID for invalid JSON', () => {
    expect(() => parsePayload('not json')).toThrow(KeyTransferError);
    expect(() => parsePayload('not json')).toThrow(/doesn't look like a Chamo/);
  });

  it('throws PAYLOAD_INVALID for JSON that is not a valid payload', () => {
    expect(() => parsePayload('{"foo": "bar"}')).toThrow(KeyTransferError);
  });
});

describe('KeyTransferError', () => {
  it('has correct error code and message', () => {
    const error = new KeyTransferError('INVALID_PIN', 'Wrong PIN');

    expect(error.code).toBe('INVALID_PIN');
    expect(error.message).toBe('Wrong PIN');
    expect(error.name).toBe('KeyTransferError');
    expect(error instanceof Error).toBe(true);
  });
});
