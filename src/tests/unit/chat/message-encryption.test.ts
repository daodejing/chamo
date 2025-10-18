/**
 * Unit tests for message encryption/decryption
 * Story 2.1 - AC4: Message is encrypted before transmission (E2EE)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { encryptMessage, decryptMessage } from '@/lib/e2ee/encryption';
import { generateFamilyKey } from '@/lib/e2ee/key-management';

describe('Message Encryption', () => {
  let familyKey: CryptoKey;

  beforeAll(async () => {
    const { familyKey: key } = await generateFamilyKey();
    familyKey = key;
  });

  it('should encrypt and decrypt a simple message', async () => {
    const plaintext = 'Hello, family!';
    const encrypted = await encryptMessage(plaintext, familyKey);
    const decrypted = await decryptMessage(encrypted, familyKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same message (random IV)', async () => {
    const plaintext = 'Test message';
    const encrypted1 = await encryptMessage(plaintext, familyKey);
    const encrypted2 = await encryptMessage(plaintext, familyKey);

    expect(encrypted1).not.toBe(encrypted2);

    const decrypted1 = await decryptMessage(encrypted1, familyKey);
    const decrypted2 = await decryptMessage(encrypted2, familyKey);

    expect(decrypted1).toBe(plaintext);
    expect(decrypted2).toBe(plaintext);
  });

  it('should handle Unicode characters correctly', async () => {
    const plaintext = 'こんにちは 👋 Émojis';
    const encrypted = await encryptMessage(plaintext, familyKey);
    const decrypted = await decryptMessage(encrypted, familyKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should handle long messages', async () => {
    const plaintext = 'A'.repeat(10000);
    const encrypted = await encryptMessage(plaintext, familyKey);
    const decrypted = await decryptMessage(encrypted, familyKey);

    expect(decrypted).toBe(plaintext);
  });

  it('should fail decryption with wrong key', async () => {
    const plaintext = 'Secret message';
    const encrypted = await encryptMessage(plaintext, familyKey);

    const { familyKey: wrongKey } = await generateFamilyKey();

    await expect(decryptMessage(encrypted, wrongKey)).rejects.toThrow();
  });

  it('should fail decryption with corrupted ciphertext', async () => {
    const plaintext = 'Test';
    const encrypted = await encryptMessage(plaintext, familyKey);

    // Corrupt the ciphertext
    const corrupted = encrypted.slice(0, -5) + 'XXXXX';

    await expect(decryptMessage(corrupted, familyKey)).rejects.toThrow();
  });

  it('should return base64-encoded ciphertext', async () => {
    const plaintext = 'Test';
    const encrypted = await encryptMessage(plaintext, familyKey);

    // Should be base64 (only contains valid base64 characters)
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
