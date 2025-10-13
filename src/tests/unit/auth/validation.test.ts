import { describe, it, expect } from 'vitest';
import { registerSchema, joinSchema, loginSchema } from '@/lib/validators/auth';

describe('Auth Validation Schemas', () => {
  describe('registerSchema', () => {
    const validData = {
      email: 'test@example.com',
      password: 'password123',
      familyName: 'The Smiths',
      userName: 'John Doe',
    };

    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    describe('email validation', () => {
      it('should reject invalid email format', () => {
        const result = registerSchema.safeParse({
          ...validData,
          email: 'invalid-email',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('email');
        }
      });

      it('should reject empty email', () => {
        const result = registerSchema.safeParse({
          ...validData,
          email: '',
        });
        expect(result.success).toBe(false);
      });

      it('should accept email with subdomains', () => {
        const result = registerSchema.safeParse({
          ...validData,
          email: 'user@mail.example.com',
        });
        expect(result.success).toBe(true);
      });

      it('should accept email with plus addressing', () => {
        const result = registerSchema.safeParse({
          ...validData,
          email: 'user+tag@example.com',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('password validation', () => {
      it('should reject password shorter than 8 characters', () => {
        const result = registerSchema.safeParse({
          ...validData,
          password: 'pass',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('8');
        }
      });

      it('should accept password exactly 8 characters', () => {
        const result = registerSchema.safeParse({
          ...validData,
          password: '12345678',
        });
        expect(result.success).toBe(true);
      });

      it('should accept long passwords', () => {
        const result = registerSchema.safeParse({
          ...validData,
          password: 'a'.repeat(100),
        });
        expect(result.success).toBe(true);
      });

      it('should accept passwords with special characters', () => {
        const result = registerSchema.safeParse({
          ...validData,
          password: 'P@ssw0rd!#$%',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('familyName validation', () => {
      it('should reject family name shorter than 2 characters', () => {
        const result = registerSchema.safeParse({
          ...validData,
          familyName: 'A',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('2');
        }
      });

      it('should reject family name longer than 50 characters', () => {
        const result = registerSchema.safeParse({
          ...validData,
          familyName: 'A'.repeat(51),
        });
        expect(result.success).toBe(false);
      });

      it('should accept family name exactly 2 characters', () => {
        const result = registerSchema.safeParse({
          ...validData,
          familyName: 'AB',
        });
        expect(result.success).toBe(true);
      });

      it('should accept family name exactly 50 characters', () => {
        const result = registerSchema.safeParse({
          ...validData,
          familyName: 'A'.repeat(50),
        });
        expect(result.success).toBe(true);
      });

      it('should accept family names with spaces', () => {
        const result = registerSchema.safeParse({
          ...validData,
          familyName: 'The Smith Family',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('userName validation', () => {
      it('should reject user name shorter than 2 characters', () => {
        const result = registerSchema.safeParse({
          ...validData,
          userName: 'A',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('2');
        }
      });

      it('should reject user name longer than 50 characters', () => {
        const result = registerSchema.safeParse({
          ...validData,
          userName: 'A'.repeat(51),
        });
        expect(result.success).toBe(false);
      });

      it('should accept user name exactly 2 characters', () => {
        const result = registerSchema.safeParse({
          ...validData,
          userName: 'AB',
        });
        expect(result.success).toBe(true);
      });

      it('should accept user name exactly 50 characters', () => {
        const result = registerSchema.safeParse({
          ...validData,
          userName: 'A'.repeat(50),
        });
        expect(result.success).toBe(true);
      });

      it('should accept names with spaces', () => {
        const result = registerSchema.safeParse({
          ...validData,
          userName: 'John Robert Doe',
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject missing required fields', () => {
      const result = registerSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe('joinSchema', () => {
    const validData = {
      email: 'test@example.com',
      password: 'password123',
      inviteCode: 'FAMILY-ABC12345:dGVzdGtleQ==',
      userName: 'Jane Doe',
    };

    it('should accept valid join data', () => {
      const result = joinSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = joinSchema.safeParse({
        ...validData,
        email: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = joinSchema.safeParse({
        ...validData,
        password: 'short',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid invite code format', () => {
      const result = joinSchema.safeParse({
        ...validData,
        inviteCode: 'INVALID-CODE',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid invite code');
      }
    });

    it('should reject invite code without key', () => {
      const result = joinSchema.safeParse({
        ...validData,
        inviteCode: 'FAMILY-ABC12345',
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid invite code with base64 key', () => {
      const result = joinSchema.safeParse({
        ...validData,
        inviteCode: 'FAMILY-XYZ98765:YWJjZGVmZ2hpamtsbW5vcA==',
      });
      expect(result.success).toBe(true);
    });

    it('should reject short user name', () => {
      const result = joinSchema.safeParse({
        ...validData,
        userName: 'A',
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid user name', () => {
      const result = joinSchema.safeParse({
        ...validData,
        userName: 'Valid Name',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('loginSchema', () => {
    const validData = {
      email: 'test@example.com',
      password: 'anypassword',
    };

    it('should accept valid login data', () => {
      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        ...validData,
        email: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('should accept any non-empty password', () => {
      const result = loginSchema.safeParse({
        ...validData,
        password: 'a',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty email', () => {
      const result = loginSchema.safeParse({
        ...validData,
        email: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        ...validData,
        password: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing fields', () => {
      const result = loginSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept short passwords for login', () => {
      // Login allows any password length since we're verifying against stored hash
      const result = loginSchema.safeParse({
        ...validData,
        password: 'short',
      });
      expect(result.success).toBe(true);
    });
  });
});
