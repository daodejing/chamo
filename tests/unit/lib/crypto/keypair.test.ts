import { describe, expect, it } from 'vitest';
import nacl from 'tweetnacl';

import {
  decodePublicKey,
  encodePublicKey,
  generateKeypair,
  PUBLIC_KEY_BASE64_LENGTH,
  PUBLIC_KEY_BYTE_LENGTH,
  SECRET_KEY_BYTE_LENGTH,
} from '@/lib/crypto/keypair';

describe('generateKeypair', () => {
  it('returns base64 public key and Uint8Array secret key', () => {
    const result = generateKeypair();

    expect(typeof result.publicKey).toBe('string');
    expect(result.publicKey).toHaveLength(PUBLIC_KEY_BASE64_LENGTH);
    expect(result.secretKey).toBeInstanceOf(Uint8Array);
    expect(result.secretKey).toHaveLength(SECRET_KEY_BYTE_LENGTH);
  });

  it('produces unique keypairs per call', () => {
    const first = generateKeypair();
    const second = generateKeypair();

    expect(first.publicKey).not.toEqual(second.publicKey);
    expect(first.secretKey).not.toEqual(second.secretKey);
  });
});

describe('encodePublicKey / decodePublicKey', () => {
  it('performs a lossless round-trip for valid keys', () => {
    const keyBytes = nacl.randomBytes(PUBLIC_KEY_BYTE_LENGTH);
    const encoded = encodePublicKey(keyBytes);
    const decoded = decodePublicKey(encoded);

    expect(decoded).toHaveLength(PUBLIC_KEY_BYTE_LENGTH);
    expect(Array.from(decoded)).toEqual(Array.from(keyBytes));
  });

  it('rejects malformed base64 strings', () => {
    expect(() => decodePublicKey('!!not-base64!!')).toThrow(/Invalid public key format/);
  });

  it('rejects encoded keys that are not the expected length', () => {
    const shortKey = 'AAAA';
    expect(() => decodePublicKey(shortKey)).toThrow(/Invalid public key format/);
  });

  it('rejects raw keys that do not match required byte length', () => {
    expect(() => encodePublicKey(new Uint8Array(16))).toThrow(/Public key must be/);
  });
});
