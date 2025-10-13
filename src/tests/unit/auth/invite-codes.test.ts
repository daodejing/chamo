import { describe, it, expect } from 'vitest';
import { generateInviteCode, validateInviteCodeFormat } from '@/lib/auth/invite-codes';

describe('Invite Code Utilities', () => {
  describe('generateInviteCode', () => {
    it('should generate invite code with correct format', () => {
      const code = generateInviteCode();
      expect(code).toMatch(/^FAMILY-[A-Z0-9]{8}$/);
    });

    it('should generate unique codes on multiple calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateInviteCode());
      }
      // All codes should be unique
      expect(codes.size).toBe(100);
    });

    it('should only contain uppercase letters and numbers', () => {
      const code = generateInviteCode();
      const codeWithoutPrefix = code.replace('FAMILY-', '');
      expect(codeWithoutPrefix).toMatch(/^[A-Z0-9]+$/);
    });

    it('should have exactly 8 characters after prefix', () => {
      const code = generateInviteCode();
      const codeWithoutPrefix = code.replace('FAMILY-', '');
      expect(codeWithoutPrefix).toHaveLength(8);
    });
  });

  describe('validateInviteCodeFormat', () => {
    it('should validate correct invite code format with key', () => {
      const validCode = 'FAMILY-ABC12345:dGVzdGtleQ==';
      expect(validateInviteCodeFormat(validCode)).toBe(true);
    });

    it('should reject code without key', () => {
      const invalidCode = 'FAMILY-ABC12345';
      expect(validateInviteCodeFormat(invalidCode)).toBe(false);
    });

    it('should reject code without FAMILY prefix', () => {
      const invalidCode = 'ABC12345:dGVzdGtleQ==';
      expect(validateInviteCodeFormat(invalidCode)).toBe(false);
    });

    it('should reject code with wrong length', () => {
      const invalidCode = 'FAMILY-ABC:dGVzdGtleQ==';
      expect(validateInviteCodeFormat(invalidCode)).toBe(false);
    });

    it('should reject code with lowercase letters', () => {
      const invalidCode = 'FAMILY-abc12345:dGVzdGtleQ==';
      expect(validateInviteCodeFormat(invalidCode)).toBe(false);
    });

    it('should reject code with special characters', () => {
      const invalidCode = 'FAMILY-ABC@2345:dGVzdGtleQ==';
      expect(validateInviteCodeFormat(invalidCode)).toBe(false);
    });

    it('should accept valid base64 key with padding', () => {
      const validCode = 'FAMILY-ABC12345:dGVzdGtleQ==';
      expect(validateInviteCodeFormat(validCode)).toBe(true);
    });

    it('should accept valid base64 key without padding', () => {
      const validCode = 'FAMILY-ABC12345:dGVzdGtleQ';
      expect(validateInviteCodeFormat(validCode)).toBe(true);
    });

    it('should accept base64 key with plus and slash', () => {
      const validCode = 'FAMILY-ABC12345:dGVzd+t/eQ==';
      expect(validateInviteCodeFormat(validCode)).toBe(true);
    });

    it('should reject empty string', () => {
      expect(validateInviteCodeFormat('')).toBe(false);
    });

    it('should reject null-like values', () => {
      expect(validateInviteCodeFormat('null')).toBe(false);
      expect(validateInviteCodeFormat('undefined')).toBe(false);
    });
  });
});
