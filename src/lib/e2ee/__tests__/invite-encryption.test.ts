/**
 * Unit tests for invite encryption/decryption utilities
 * Tests E2EE flow using nacl.box for encrypted family key distribution
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { encryptFamilyKeyForRecipient, decryptFamilyKey } from '../invite-encryption';
import nacl from 'tweetnacl';
import * as secureStorage from '../../crypto/secure-storage';

describe('Invite Encryption', () => {
  let senderUserId: string;
  let senderSecretKey: Uint8Array;
  let senderPublicKey: string;
  let recipientUserId: string;
  let recipientSecretKey: Uint8Array;
  let recipientPublicKey: string;
  let familyKeyBase64: string;

  beforeAll(() => {
    // Generate keypairs for sender and recipient using nacl.box
    senderUserId = 'sender-user-id';
    recipientUserId = 'recipient-user-id';

    const senderKeypair = nacl.box.keyPair();
    const recipientKeypair = nacl.box.keyPair();

    senderSecretKey = senderKeypair.secretKey;
    senderPublicKey = btoa(String.fromCharCode(...senderKeypair.publicKey));

    recipientSecretKey = recipientKeypair.secretKey;
    recipientPublicKey = btoa(String.fromCharCode(...recipientKeypair.publicKey));

    // Generate a mock family key (base64-encoded AES-256 key)
    const familyKeyBytes = nacl.randomBytes(32); // 256 bits
    familyKeyBase64 = btoa(String.fromCharCode(...familyKeyBytes));

    // Mock secure storage to return our test keys
    vi.spyOn(secureStorage, 'getPrivateKey').mockImplementation(async (userId: string) => {
      if (userId === senderUserId) return senderSecretKey;
      if (userId === recipientUserId) return recipientSecretKey;
      return null;
    });
  });

  describe('encryptFamilyKeyForRecipient', () => {
    it('should encrypt family key for recipient', async () => {
      const result = await encryptFamilyKeyForRecipient(
        familyKeyBase64,
        recipientPublicKey,
        senderUserId
      );

      expect(result).toBeDefined();
      expect(result.encryptedKey).toBeDefined();
      expect(result.nonce).toBeDefined();
      expect(typeof result.encryptedKey).toBe('string');
      expect(typeof result.nonce).toBe('string');
      expect(result.encryptedKey.length).toBeGreaterThan(0);
      expect(result.nonce.length).toBeGreaterThan(0);
    });

    it('should produce different encrypted keys with different nonces', async () => {
      const result1 = await encryptFamilyKeyForRecipient(
        familyKeyBase64,
        recipientPublicKey,
        senderUserId
      );

      const result2 = await encryptFamilyKeyForRecipient(
        familyKeyBase64,
        recipientPublicKey,
        senderUserId
      );

      // Different nonces should produce different encrypted outputs
      expect(result1.nonce).not.toBe(result2.nonce);
      expect(result1.encryptedKey).not.toBe(result2.encryptedKey);
    });

    it('should throw error if sender private key not found', async () => {
      const nonExistentUserId = 'non-existent-user';

      await expect(
        encryptFamilyKeyForRecipient(
          familyKeyBase64,
          recipientPublicKey,
          nonExistentUserId
        )
      ).rejects.toThrow('Sender private key not found');
    });

    it('should throw error with invalid recipient public key', async () => {
      const invalidPublicKey = 'invalid-base64-key';

      await expect(
        encryptFamilyKeyForRecipient(
          familyKeyBase64,
          invalidPublicKey,
          senderUserId
        )
      ).rejects.toThrow();
    });
  });

  describe('decryptFamilyKey', () => {
    it('should decrypt encrypted family key', async () => {
      // Encrypt the family key
      const { encryptedKey, nonce } = await encryptFamilyKeyForRecipient(
        familyKeyBase64,
        recipientPublicKey,
        senderUserId
      );

      // Decrypt the family key
      const decryptedKey = await decryptFamilyKey(
        encryptedKey,
        nonce,
        senderPublicKey,
        recipientUserId
      );

      // Should match original family key
      expect(decryptedKey).toBe(familyKeyBase64);
    });

    it('should throw error if recipient private key not found', async () => {
      const { encryptedKey, nonce } = await encryptFamilyKeyForRecipient(
        familyKeyBase64,
        recipientPublicKey,
        senderUserId
      );

      const nonExistentUserId = 'non-existent-user';

      await expect(
        decryptFamilyKey(
          encryptedKey,
          nonce,
          senderPublicKey,
          nonExistentUserId
        )
      ).rejects.toThrow('Recipient private key not found');
    });

    it('should throw error with wrong sender public key', async () => {
      const { encryptedKey, nonce } = await encryptFamilyKeyForRecipient(
        familyKeyBase64,
        recipientPublicKey,
        senderUserId
      );

      // Try to decrypt with wrong sender's public key
      const wrongSenderKeypair = nacl.box.keyPair();
      const wrongSenderPublicKey = btoa(String.fromCharCode(...wrongSenderKeypair.publicKey));

      await expect(
        decryptFamilyKey(
          encryptedKey,
          nonce,
          wrongSenderPublicKey,
          recipientUserId
        )
      ).rejects.toThrow('Decryption failed');
    });

    it('should throw error with tampered encrypted data', async () => {
      const { encryptedKey, nonce } = await encryptFamilyKeyForRecipient(
        familyKeyBase64,
        recipientPublicKey,
        senderUserId
      );

      // Tamper with the encrypted data
      const tamperedEncryptedKey = encryptedKey.slice(0, -10) + 'TAMPERED==';

      await expect(
        decryptFamilyKey(
          tamperedEncryptedKey,
          nonce,
          senderPublicKey,
          recipientUserId
        )
      ).rejects.toThrow('Decryption failed');
    });

    it('should throw error with wrong nonce', async () => {
      const { encryptedKey } = await encryptFamilyKeyForRecipient(
        familyKeyBase64,
        recipientPublicKey,
        senderUserId
      );

      // Generate a different nonce
      const wrongNonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));

      await expect(
        decryptFamilyKey(
          encryptedKey,
          wrongNonce,
          senderPublicKey,
          recipientUserId
        )
      ).rejects.toThrow('Decryption failed');
    });
  });

  describe('End-to-End Encryption Flow', () => {
    it('should support full invite flow: encrypt → store → retrieve → decrypt', async () => {
      // Step 1: Admin encrypts family key for invitee
      const { encryptedKey, nonce } = await encryptFamilyKeyForRecipient(
        familyKeyBase64,
        recipientPublicKey,
        senderUserId
      );

      // Step 2: Server would store: { encryptedKey, nonce, inviterPublicKey: senderPublicKey }
      const storedInvite = {
        encryptedFamilyKey: encryptedKey,
        nonce: nonce,
        inviterPublicKey: senderPublicKey,
      };

      // Step 3: Invitee retrieves and decrypts
      const decryptedKey = await decryptFamilyKey(
        storedInvite.encryptedFamilyKey,
        storedInvite.nonce,
        storedInvite.inviterPublicKey,
        recipientUserId
      );

      // Step 4: Verify decrypted key matches original
      expect(decryptedKey).toBe(familyKeyBase64);
    });

    it('should prevent decryption by unauthorized users', async () => {
      // Admin encrypts for Alice
      const { encryptedKey, nonce } = await encryptFamilyKeyForRecipient(
        familyKeyBase64,
        recipientPublicKey,
        senderUserId
      );

      // Bob tries to decrypt (different user with different keys)
      const bobUserId = 'bob-user-id';
      const bobKeypair = nacl.box.keyPair();

      // Temporarily mock Bob's keys
      vi.spyOn(secureStorage, 'getPrivateKey').mockResolvedValueOnce(bobKeypair.secretKey);

      // Should fail - Bob doesn't have the right private key
      await expect(
        decryptFamilyKey(
          encryptedKey,
          nonce,
          senderPublicKey,
          bobUserId
        )
      ).rejects.toThrow('Decryption failed');
    });
  });
});
