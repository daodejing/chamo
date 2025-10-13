import { describe, it, expect } from 'vitest';
import { parseInviteCode } from '@/lib/e2ee/key-management';

describe('Join Logic - Invite Code Parsing', () => {
  describe('parseInviteCode', () => {
    it('should parse valid invite code with key', () => {
      const inviteCode = 'FAMILY-ABC12345:dGVzdGtleQ==';
      const result = parseInviteCode(inviteCode);

      expect(result.code).toBe('FAMILY-ABC12345');
      expect(result.base64Key).toBe('dGVzdGtleQ==');
    });

    it('should parse invite code with longer base64 key', () => {
      const inviteCode = 'FAMILY-XYZ98765:YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkw';
      const result = parseInviteCode(inviteCode);

      expect(result.code).toBe('FAMILY-XYZ98765');
      expect(result.base64Key).toBe('YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkw');
    });

    it('should parse invite code with base64 key containing special chars', () => {
      const inviteCode = 'FAMILY-TEST1234:dGVz+dC9r/ZXlQ==';
      const result = parseInviteCode(inviteCode);

      expect(result.code).toBe('FAMILY-TEST1234');
      expect(result.base64Key).toBe('dGVz+dC9r/ZXlQ==');
    });

    it('should throw error for invite code without colon separator', () => {
      const invalidCode = 'FAMILY-ABC12345dGVzdGtleQ==';

      expect(() => parseInviteCode(invalidCode)).toThrow('Invalid invite code format');
    });

    it('should throw error for invite code with only one part', () => {
      const invalidCode = 'FAMILY-ABC12345';

      expect(() => parseInviteCode(invalidCode)).toThrow('Expected CODE:KEY');
    });

    it('should throw error for invite code with empty code', () => {
      const invalidCode = ':dGVzdGtleQ==';

      expect(() => parseInviteCode(invalidCode)).toThrow('Expected CODE:KEY');
    });

    it('should throw error for invite code with empty key', () => {
      const invalidCode = 'FAMILY-ABC12345:';

      expect(() => parseInviteCode(invalidCode)).toThrow('Expected CODE:KEY');
    });

    it('should throw error for invite code with multiple colons', () => {
      const invalidCode = 'FAMILY-ABC12345:key:extra';

      // Multiple colons will result in parts.length !== 2
      expect(() => parseInviteCode(invalidCode)).toThrow('Invalid invite code format');
    });

    it('should handle base64 key without padding', () => {
      const inviteCode = 'FAMILY-ABC12345:dGVzdGtleQ';
      const result = parseInviteCode(inviteCode);

      expect(result.code).toBe('FAMILY-ABC12345');
      expect(result.base64Key).toBe('dGVzdGtleQ');
    });

    it('should handle real-world 256-bit key (44 chars base64)', () => {
      // 256-bit key = 32 bytes = 44 base64 characters (with padding)
      const key256bit = 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=';
      const inviteCode = `FAMILY-ABC12345:${key256bit}`;
      const result = parseInviteCode(inviteCode);

      expect(result.code).toBe('FAMILY-ABC12345');
      expect(result.base64Key).toBe(key256bit);
    });
  });
});
