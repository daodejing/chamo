import { generateInviteCode, hashInviteCode } from './invite-code.util';

describe('invite-code.util', () => {
  describe('generateInviteCode', () => {
    it('should generate a 22-character string', () => {
      const code = generateInviteCode();
      expect(code).toHaveLength(22);
    });

    it('should generate URL-safe base64url characters (no +, /, =)', () => {
      const code = generateInviteCode();

      // Should not contain + / = characters (base64url is URL-safe)
      expect(code).not.toMatch(/[+/=]/);

      // Should only contain base64url characters: A-Z a-z 0-9 - _
      expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    });

    it('should generate unique codes on repeated calls', () => {
      const codes = new Set<string>();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        codes.add(generateInviteCode());
      }

      // All codes should be unique (no collisions in 1000 iterations)
      expect(codes.size).toBe(iterations);
    });

    it('should produce different codes each time (random)', () => {
      const code1 = generateInviteCode();
      const code2 = generateInviteCode();

      expect(code1).not.toBe(code2);
    });

    it('should have sufficient entropy for security (128 bits)', () => {
      // 22 characters of base64url = ~132 bits of entropy (16 bytes * 8 bits/byte)
      // This test verifies the length which ensures entropy
      const code = generateInviteCode();
      expect(code).toHaveLength(22);

      // Verify it's not a predictable pattern
      expect(code).not.toBe('0'.repeat(22));
      expect(code).not.toBe('A'.repeat(22));
    });
  });

  describe('hashInviteCode', () => {
    it('should produce a 64-character hex string (SHA-256)', () => {
      const code = 'test-invite-code-12345';
      const hash = hashInviteCode(code);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/); // Lowercase hex
    });

    it('should produce consistent hashes for the same input', () => {
      const code = 'consistent-code-test';

      const hash1 = hashInviteCode(code);
      const hash2 = hashInviteCode(code);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const code1 = 'code-one';
      const code2 = 'code-two';

      const hash1 = hashInviteCode(code1);
      const hash2 = hashInviteCode(code2);

      expect(hash1).not.toBe(hash2);
    });

    it('should be case-sensitive', () => {
      const codeLower = 'testcode';
      const codeUpper = 'TESTCODE';

      const hashLower = hashInviteCode(codeLower);
      const hashUpper = hashInviteCode(codeUpper);

      expect(hashLower).not.toBe(hashUpper);
    });

    it('should handle generated invite codes correctly', () => {
      const code = generateInviteCode();
      const hash = hashInviteCode(code);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce valid SHA-256 hashes for edge cases', () => {
      const testCases = [
        '',                           // Empty string
        ' ',                          // Single space
        'a',                          // Single character
        'test@example.com',          // Email-like
        '!@#$%^&*()',                // Special characters
        'a'.repeat(1000),            // Very long string
      ];

      testCases.forEach((testCase) => {
        const hash = hashInviteCode(testCase);
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      });
    });
  });

  describe('generateInviteCode and hashInviteCode integration', () => {
    it('should generate and hash codes without errors', () => {
      expect(() => {
        const code = generateInviteCode();
        const hash = hashInviteCode(code);
        expect(code).toHaveLength(22);
        expect(hash).toHaveLength(64);
      }).not.toThrow();
    });

    it('should produce unique hashes for unique codes', () => {
      const hashes = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const code = generateInviteCode();
        const hash = hashInviteCode(code);
        hashes.add(hash);
      }

      // All hashes should be unique
      expect(hashes.size).toBe(iterations);
    });
  });
});
