import { encryptEmail, decryptEmail, validateInviteSecret } from './crypto.util';

describe('crypto.util', () => {
  const originalInviteSecret = process.env.INVITE_SECRET;

  beforeAll(() => {
    // Set a test INVITE_SECRET (64-character hex = 32 bytes)
    process.env.INVITE_SECRET = 'a'.repeat(64); // Valid 64-char hex for testing
  });

  afterAll(() => {
    // Restore original
    if (originalInviteSecret) {
      process.env.INVITE_SECRET = originalInviteSecret;
    } else {
      delete process.env.INVITE_SECRET;
    }
  });

  describe('validateInviteSecret', () => {
    it('should validate a correct 64-character hex INVITE_SECRET', () => {
      process.env.INVITE_SECRET = '1234567890abcdef'.repeat(4); // 64 chars
      expect(() => validateInviteSecret()).not.toThrow();
    });

    it('should throw if INVITE_SECRET is missing', () => {
      delete process.env.INVITE_SECRET;
      expect(() => validateInviteSecret()).toThrow('INVITE_SECRET environment variable is not set');
      process.env.INVITE_SECRET = 'a'.repeat(64); // Restore for other tests
    });

    it('should throw if INVITE_SECRET is not 64 characters', () => {
      process.env.INVITE_SECRET = 'abc123'; // Too short
      expect(() => validateInviteSecret()).toThrow('INVITE_SECRET must be exactly 64 characters');
      process.env.INVITE_SECRET = 'a'.repeat(64); // Restore
    });

    it('should throw if INVITE_SECRET is not valid hex', () => {
      process.env.INVITE_SECRET = 'g'.repeat(64); // Invalid hex (g is not a hex character)
      expect(() => validateInviteSecret()).toThrow('INVITE_SECRET must be a valid 64-character hexadecimal string');
      process.env.INVITE_SECRET = 'a'.repeat(64); // Restore
    });
  });

  describe('encryptEmail and decryptEmail', () => {
    it('should encrypt and decrypt an email successfully (round-trip)', () => {
      const email = 'test@example.com';

      const encrypted = encryptEmail(email);
      const decrypted = decryptEmail(encrypted);

      expect(decrypted).toBe(email);
    });

    it('should produce different ciphertext for the same email (random IV)', () => {
      const email = 'test@example.com';

      const encrypted1 = encryptEmail(email);
      const encrypted2 = encryptEmail(email);

      // Same plaintext should produce different ciphertext due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same email
      expect(decryptEmail(encrypted1)).toBe(email);
      expect(decryptEmail(encrypted2)).toBe(email);
    });

    it('should encrypt and decrypt emails with special characters', () => {
      const email = 'user+test@example.co.uk';

      const encrypted = encryptEmail(email);
      const decrypted = decryptEmail(encrypted);

      expect(decrypted).toBe(email);
    });

    it('should throw error if ciphertext is tampered with', () => {
      const email = 'test@example.com';
      const encrypted = encryptEmail(email);

      // Tamper with the ciphertext by changing one character
      const tamperedEncrypted = encrypted.slice(0, -5) + 'XXXXX';

      expect(() => decryptEmail(tamperedEncrypted)).toThrow('Email decryption failed');
    });

    it('should throw error if auth tag is tampered with', () => {
      const email = 'test@example.com';
      const encrypted = encryptEmail(email);

      // Decode, tamper with auth tag, re-encode
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[buffer.length - 1] ^= 0xFF; // Flip bits in last byte (part of auth tag)
      const tamperedEncrypted = buffer.toString('base64');

      expect(() => decryptEmail(tamperedEncrypted)).toThrow('Email decryption failed');
    });

    it('should throw error if IV is tampered with', () => {
      const email = 'test@example.com';
      const encrypted = encryptEmail(email);

      // Decode, tamper with IV, re-encode
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[0] ^= 0xFF; // Flip bits in first byte (part of IV)
      const tamperedEncrypted = buffer.toString('base64');

      expect(() => decryptEmail(tamperedEncrypted)).toThrow('Email decryption failed');
    });

    it('should handle long email addresses', () => {
      const email = 'very.long.email.address.with.many.parts@subdomain.example.com';

      const encrypted = encryptEmail(email);
      const decrypted = decryptEmail(encrypted);

      expect(decrypted).toBe(email);
    });

    it('should throw if INVITE_SECRET is missing during encryption', () => {
      delete process.env.INVITE_SECRET;
      expect(() => encryptEmail('test@example.com')).toThrow('INVITE_SECRET environment variable is not set');
      process.env.INVITE_SECRET = 'a'.repeat(64); // Restore
    });

    it('should throw if INVITE_SECRET is missing during decryption', () => {
      const email = 'test@example.com';
      const encrypted = encryptEmail(email);

      delete process.env.INVITE_SECRET;
      expect(() => decryptEmail(encrypted)).toThrow('INVITE_SECRET environment variable is not set');
      process.env.INVITE_SECRET = 'a'.repeat(64); // Restore
    });
  });
});
