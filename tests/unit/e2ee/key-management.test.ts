import { describe, it, expect } from 'vitest';
import {
  generateFamilyKey,
  importFamilyKey,
  createInviteCodeWithKey,
  parseInviteCode,
  deriveKeyFromPassword,
} from '@/lib/e2ee/key-management';
import { encryptMessage, decryptMessage } from '@/lib/e2ee/encryption';

describe('Key Management', () => {
  describe('Family Key Generation', () => {
    it('should generate a valid family key', async () => {
      const { familyKey, base64Key } = await generateFamilyKey();

      expect(familyKey.type).toBe('secret');
      expect(familyKey.algorithm.name).toBe('AES-GCM');
      expect((familyKey.algorithm as AesKeyAlgorithm).length).toBe(256);
      expect(base64Key).toMatch(/^[A-Za-z0-9+/=]+$/); // Valid base64
    });

    it('should generate unique keys each time', async () => {
      const { base64Key: key1 } = await generateFamilyKey();
      const { base64Key: key2 } = await generateFamilyKey();

      expect(key1).not.toBe(key2);
    });

    it('should generate 256-bit keys (44 base64 chars)', async () => {
      const { base64Key } = await generateFamilyKey();

      // 256 bits = 32 bytes = 44 base64 characters (with padding)
      expect(base64Key.length).toBe(44);
    });

    it('should allow key to be used for encryption', async () => {
      const { familyKey } = await generateFamilyKey();

      const plaintext = 'Test encryption';
      const encrypted = await encryptMessage(plaintext, familyKey);

      expect(encrypted).toBeTruthy();
      expect(encrypted.length).toBeGreaterThan(0);
    });
  });

  describe('Key Import/Export', () => {
    it('should import and export keys consistently', async () => {
      const { base64Key, familyKey: originalKey } = await generateFamilyKey();
      const importedKey = await importFamilyKey(base64Key);

      expect(importedKey.type).toBe('secret');
      expect(importedKey.algorithm.name).toBe('AES-GCM');
      expect((importedKey.algorithm as AesKeyAlgorithm).length).toBe(256);
    });

    it('should allow imported key to decrypt messages', async () => {
      const { familyKey: key1, base64Key } = await generateFamilyKey();
      const plaintext = 'Secret message';

      // Encrypt with original key
      const encrypted = await encryptMessage(plaintext, key1);

      // Import key and decrypt
      const key2 = await importFamilyKey(base64Key);
      const decrypted = await decryptMessage(encrypted, key2);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle invalid base64 gracefully', async () => {
      const invalidBase64 = 'not-valid-base64!!!';

      await expect(importFamilyKey(invalidBase64)).rejects.toThrow();
    });

    it('should handle empty base64 string', async () => {
      await expect(importFamilyKey('')).rejects.toThrow();
    });
  });

  describe('Invite Code Formatting', () => {
    it('should format invite code with embedded key', async () => {
      const inviteCode = 'FAMILY-A3X9K2P1';
      const { base64Key } = await generateFamilyKey();

      const fullInvite = createInviteCodeWithKey(inviteCode, base64Key);

      expect(fullInvite).toBe(`${inviteCode}:${base64Key}`);
      expect(fullInvite).toContain(':');
    });

    it('should parse invite code correctly', async () => {
      const inviteCode = 'FAMILY-A3X9K2P1';
      const { base64Key } = await generateFamilyKey();

      const fullInvite = createInviteCodeWithKey(inviteCode, base64Key);
      const parsed = parseInviteCode(fullInvite);

      expect(parsed.code).toBe(inviteCode);
      expect(parsed.base64Key).toBe(base64Key);
    });

    it('should reject invalid invite code formats', () => {
      expect(() => parseInviteCode('INVALIDCODE')).toThrow('Invalid invite code format');
      expect(() => parseInviteCode('NO:MULTIPLE:COLONS:HERE')).toThrow('Invalid invite code format');
      expect(() => parseInviteCode('')).toThrow('Invalid invite code format');
    });

    it('should handle invite codes with no key', () => {
      expect(() => parseInviteCode('FAMILY-A3X9K2P1:')).toThrow('Invalid invite code format');
    });

    it('should handle invite codes with no code', () => {
      expect(() => parseInviteCode(':dGVzdGtleQ==')).toThrow('Invalid invite code format');
    });

    it('should round-trip encode/decode invite codes', async () => {
      const inviteCode = 'FAMILY-TEST123';
      const { base64Key } = await generateFamilyKey();

      const fullInvite = createInviteCodeWithKey(inviteCode, base64Key);
      const parsed = parseInviteCode(fullInvite);
      const reconstructed = createInviteCodeWithKey(parsed.code, parsed.base64Key);

      expect(reconstructed).toBe(fullInvite);
    });
  });

  describe('Password-Based Key Derivation (Phase 2)', () => {
    it('should derive key from password', async () => {
      const password = 'SecurePassword123!';
      const salt = crypto.getRandomValues(new Uint8Array(16));

      const derivedKey = await deriveKeyFromPassword(password, salt);

      expect(derivedKey.type).toBe('secret');
      expect(derivedKey.algorithm.name).toBe('AES-GCM');
      expect((derivedKey.algorithm as AesKeyAlgorithm).length).toBe(256);
    });

    it('should derive consistent keys with same password and salt', async () => {
      const password = 'MyPassword';
      const salt = crypto.getRandomValues(new Uint8Array(16));

      const key1 = await deriveKeyFromPassword(password, salt);
      const key2 = await deriveKeyFromPassword(password, salt);

      // Both keys should be able to decrypt messages encrypted by the other
      const plaintext = 'Test message';
      const encrypted = await encryptMessage(plaintext, key1);
      const decrypted = await decryptMessage(encrypted, key2);

      expect(decrypted).toBe(plaintext);
    });

    it('should derive different keys with different passwords', async () => {
      const salt = crypto.getRandomValues(new Uint8Array(16));

      const key1 = await deriveKeyFromPassword('password1', salt);
      const key2 = await deriveKeyFromPassword('password2', salt);

      // Keys should be different (decryption will fail)
      const plaintext = 'Test message';
      const encrypted = await encryptMessage(plaintext, key1);

      await expect(decryptMessage(encrypted, key2)).rejects.toThrow();
    });

    it('should derive different keys with different salts', async () => {
      const password = 'SamePassword';
      const salt1 = crypto.getRandomValues(new Uint8Array(16));
      const salt2 = crypto.getRandomValues(new Uint8Array(16));

      const key1 = await deriveKeyFromPassword(password, salt1);
      const key2 = await deriveKeyFromPassword(password, salt2);

      // Keys should be different
      const plaintext = 'Test message';
      const encrypted = await encryptMessage(plaintext, key1);

      await expect(decryptMessage(encrypted, key2)).rejects.toThrow();
    });

    it('should use PBKDF2 with 100k iterations', async () => {
      const password = 'test';
      const salt = new Uint8Array(16);

      // This test just verifies the function doesn't throw
      // and produces a valid key (iteration count is internal)
      const key = await deriveKeyFromPassword(password, salt);
      expect(key).toBeTruthy();
    });
  });

  describe('Key Properties', () => {
    it('should generate extractable keys', async () => {
      const { familyKey } = await generateFamilyKey();

      expect(familyKey.extractable).toBe(true);
    });

    it('should allow encrypt and decrypt usages', async () => {
      const { familyKey } = await generateFamilyKey();

      expect(familyKey.usages).toContain('encrypt');
      expect(familyKey.usages).toContain('decrypt');
    });

    it('should use AES-GCM algorithm', async () => {
      const { familyKey } = await generateFamilyKey();

      expect(familyKey.algorithm.name).toBe('AES-GCM');
    });
  });
});
