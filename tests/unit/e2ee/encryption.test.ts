import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptMessage,
  decryptMessage,
  encryptFile,
  decryptFile,
  encryptMessageBatch,
  decryptMessageBatch,
} from '@/lib/e2ee/encryption';
import { generateFamilyKey } from '@/lib/e2ee/key-management';

describe('E2EE Encryption', () => {
  let familyKey: CryptoKey;

  beforeEach(async () => {
    const { familyKey: key } = await generateFamilyKey();
    familyKey = key;
  });

  describe('Message Encryption', () => {
    it('should encrypt and decrypt a text message', async () => {
      const plaintext = 'Hello, family!';
      const encrypted = await encryptMessage(plaintext, familyKey);
      const decrypted = await decryptMessage(encrypted, familyKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce base64-encoded ciphertext', async () => {
      const plaintext = 'Test message';
      const encrypted = await encryptMessage(plaintext, familyKey);

      // Base64 regex
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should fail to decrypt with wrong key', async () => {
      const plaintext = 'Secret message';
      const encrypted = await encryptMessage(plaintext, familyKey);

      // Generate a different key
      const { familyKey: wrongKey } = await generateFamilyKey();

      await expect(decryptMessage(encrypted, wrongKey)).rejects.toThrow(
        'Failed to decrypt message'
      );
    });

    it('should produce different ciphertexts for same plaintext (random IV)', async () => {
      const plaintext = 'Test message';
      const encrypted1 = await encryptMessage(plaintext, familyKey);
      const encrypted2 = await encryptMessage(plaintext, familyKey);

      expect(encrypted1).not.toBe(encrypted2); // Different IVs
    });

    it('should handle Unicode characters', async () => {
      const plaintext = 'こんにちは 🎉 Hello! Émoji test';
      const encrypted = await encryptMessage(plaintext, familyKey);
      const decrypted = await decryptMessage(encrypted, familyKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', async () => {
      const plaintext = '';
      const encrypted = await encryptMessage(plaintext, familyKey);
      const decrypted = await decryptMessage(encrypted, familyKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long messages', async () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = await encryptMessage(plaintext, familyKey);
      const decrypted = await decryptMessage(encrypted, familyKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail with corrupted ciphertext', async () => {
      const plaintext = 'Test message';
      const encrypted = await encryptMessage(plaintext, familyKey);

      // Corrupt the ciphertext
      const corrupted = encrypted.slice(0, -5) + 'XXXXX';

      await expect(decryptMessage(corrupted, familyKey)).rejects.toThrow();
    });
  });

  describe('File Encryption', () => {
    it('should encrypt and decrypt a JPEG file', async () => {
      // JPEG header: FF D8 FF E0
      const fileContent = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const blob = new Blob([fileContent], { type: 'image/jpeg' });

      const encryptedBlob = await encryptFile(blob, familyKey);
      const decryptedBlob = await decryptFile(encryptedBlob, familyKey);

      const decryptedBytes = new Uint8Array(await decryptedBlob.arrayBuffer());
      expect(decryptedBytes).toEqual(fileContent);
      expect(decryptedBlob.type).toBe('image/jpeg');
    });

    it('should encrypt and decrypt a PNG file', async () => {
      // PNG header: 89 50 4E 47
      const fileContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      const blob = new Blob([fileContent], { type: 'image/png' });

      const encryptedBlob = await encryptFile(blob, familyKey);
      const decryptedBlob = await decryptFile(encryptedBlob, familyKey);

      const decryptedBytes = new Uint8Array(await decryptedBlob.arrayBuffer());
      expect(decryptedBytes).toEqual(fileContent);
      expect(decryptedBlob.type).toBe('image/png');
    });

    it('should encrypt and decrypt a WebP file', async () => {
      // WebP header: RIFF....WEBP
      const fileContent = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      const blob = new Blob([fileContent], { type: 'image/webp' });

      const encryptedBlob = await encryptFile(blob, familyKey);
      const decryptedBlob = await decryptFile(encryptedBlob, familyKey);

      const decryptedBytes = new Uint8Array(await decryptedBlob.arrayBuffer());
      expect(decryptedBytes).toEqual(fileContent);
      expect(decryptedBlob.type).toBe('image/webp');
    });

    it('should produce opaque binary blob when encrypted', async () => {
      const fileContent = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const blob = new Blob([fileContent], { type: 'image/jpeg' });

      const encryptedBlob = await encryptFile(blob, familyKey);

      expect(encryptedBlob.type).toBe('application/octet-stream');
    });

    it('should fail to decrypt with wrong key', async () => {
      const fileContent = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const blob = new Blob([fileContent], { type: 'image/jpeg' });

      const encryptedBlob = await encryptFile(blob, familyKey);

      const { familyKey: wrongKey } = await generateFamilyKey();

      await expect(decryptFile(encryptedBlob, wrongKey)).rejects.toThrow(
        'Failed to decrypt photo'
      );
    });

    it('should handle large files', async () => {
      // 1MB file
      const fileContent = new Uint8Array(1024 * 1024).fill(0x42);
      const blob = new Blob([fileContent], { type: 'application/octet-stream' });

      const encryptedBlob = await encryptFile(blob, familyKey);
      const decryptedBlob = await decryptFile(encryptedBlob, familyKey);

      const decryptedBytes = new Uint8Array(await decryptedBlob.arrayBuffer());
      expect(decryptedBytes.length).toBe(fileContent.length);
    });
  });

  describe('Batch Operations', () => {
    it('should encrypt multiple messages in batch', async () => {
      const plaintexts = ['Message 1', 'Message 2', 'Message 3'];
      const encrypted = await encryptMessageBatch(plaintexts, familyKey);

      expect(encrypted).toHaveLength(3);
      encrypted.forEach((cipher) => {
        expect(cipher).toMatch(/^[A-Za-z0-9+/]+=*$/);
      });
    });

    it('should decrypt multiple messages in batch', async () => {
      const plaintexts = ['Message 1', 'Message 2', 'Message 3'];
      const encrypted = await encryptMessageBatch(plaintexts, familyKey);
      const decrypted = await decryptMessageBatch(encrypted, familyKey);

      expect(decrypted).toEqual(plaintexts);
    });

    it('should handle empty batch', async () => {
      const encrypted = await encryptMessageBatch([], familyKey);
      expect(encrypted).toEqual([]);
    });
  });

  describe('Security Properties', () => {
    it('should use random IVs (no IV reuse)', async () => {
      const plaintext = 'Same message';

      const encrypted1 = await encryptMessage(plaintext, familyKey);
      const encrypted2 = await encryptMessage(plaintext, familyKey);

      // Decode base64 and extract IVs (first 12 bytes)
      const combined1 = Uint8Array.from(atob(encrypted1), (c) => c.charCodeAt(0));
      const combined2 = Uint8Array.from(atob(encrypted2), (c) => c.charCodeAt(0));

      const iv1 = combined1.slice(0, 12);
      const iv2 = combined2.slice(0, 12);

      // IVs must be different
      expect(iv1).not.toEqual(iv2);
    });

    it('should produce ciphertext of appropriate length', async () => {
      const plaintext = 'A'.repeat(100);
      const encrypted = await encryptMessage(plaintext, familyKey);

      // Ciphertext = IV (12 bytes) + ciphertext (100 bytes) + auth tag (16 bytes) = 128 bytes
      // Base64 encoding: 128 bytes * 4/3 ≈ 171 chars
      expect(encrypted.length).toBeGreaterThan(170);
      expect(encrypted.length).toBeLessThan(180);
    });

    it('should fail authentication with tampered ciphertext', async () => {
      const plaintext = 'Original message';
      const encrypted = await encryptMessage(plaintext, familyKey);

      // Tamper with ciphertext (flip last character)
      const tampered = encrypted.slice(0, -1) + 'X';

      await expect(decryptMessage(tampered, familyKey)).rejects.toThrow();
    });

    it('should include authentication tag (GCM)', async () => {
      const plaintext = 'Test';
      const encrypted = await encryptMessage(plaintext, familyKey);

      // Decode base64
      const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

      // IV (12) + ciphertext (4) + auth tag (16) = 32 bytes minimum
      expect(combined.length).toBeGreaterThanOrEqual(32);
    });
  });
});
