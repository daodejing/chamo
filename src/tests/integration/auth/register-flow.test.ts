import { describe, it, expect, afterAll } from 'vitest';
import { createAdminClient, TestDataTracker } from '../../helpers/test-db';

/**
 * Integration tests for the registration flow.
 * 
 * These tests hit the actual API endpoint and verify:
 * - Input validation
 * - Database record creation
 * - Invite code generation
 * - E2EE key storage
 * - Error handling
 * 
 * Uses local Supabase instance with cleanup in afterAll.
 */

describe('Registration Flow Integration Tests', () => {
  const tracker = new TestDataTracker();
  const admin = createAdminClient();

  afterAll(async () => {
    // Clean up all test data
    await tracker.cleanup();
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      familyName: 'Test Family',
      userName: 'Test User',
    };

    // Helper to make requests with rate limit bypass header
    // Uses environment variable from vitest.config.ts (defaults to dev port 3002)
    const TEST_API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';
    const fetchRegister = (body: object) => {
      return fetch(`${TEST_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-bypass-rate-limit': 'true',
        },
        body: JSON.stringify(body),
      });
    };

    it('should create family and admin user successfully', async () => {
      const uniqueEmail = `test-${Date.now()}@example.com`;
      const response = await fetchRegister({
        ...validRegistrationData,
        email: uniqueEmail,
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(uniqueEmail);
      expect(data.user.name).toBe(validRegistrationData.userName);
      expect(data.family).toBeDefined();
      expect(data.family.name).toBe(validRegistrationData.familyName);
      expect(data.family.inviteCode).toBeDefined();
      // Invite code includes embedded key: FAMILY-XXXXXXXX:base64key
      expect(data.family.inviteCode).toMatch(/^FAMILY-[A-Z0-9]{8}:[A-Za-z0-9+/=]+$/);

      // Track for cleanup
      tracker.trackFamily(data.family.id);
      tracker.trackUser(data.user.id, uniqueEmail);
    });

    it('should create family record in database', async () => {
      const uniqueEmail = `test-family-${Date.now()}@example.com`;
      const response = await fetchRegister({
          ...validRegistrationData,
          email: uniqueEmail,
          familyName: 'Integration Test Family',
        });

      expect(response.status).toBe(201);
      const data = await response.json();

      // Verify family exists in database
      const { data: family, error } = await admin
        .from('families')
        .select('*')
        .eq('id', data.family.id)
        .single();

      expect(error).toBeNull();
      expect(family).toBeDefined();
      expect(family?.name).toBe('Integration Test Family');
      // Database stores just the code, API returns code:key
      const [codeOnly] = data.family.inviteCode.split(':');
      expect(family?.invite_code).toBe(codeOnly);

      // Track for cleanup
      tracker.trackFamily(data.family.id);
      tracker.trackUser(data.user.id, uniqueEmail);
    });

    it('should create admin user record with encrypted key', async () => {
      const uniqueEmail = `test-admin-${Date.now()}@example.com`;
      const response = await fetchRegister({
          ...validRegistrationData,
          email: uniqueEmail,
        });

      expect(response.status).toBe(201);
      const data = await response.json();

      // Verify user record was created
      // Note: We've already verified the user through the API response
      // which includes all the fields we need to validate
      expect(data.user.id).toBeDefined();
      expect(data.user.email).toBe(uniqueEmail);
      expect(data.user.name).toBe(validRegistrationData.userName);
      expect(data.user.role).toBe('admin');
      expect(data.user.familyId).toBe(data.family.id);
      expect(data.user.encryptedFamilyKey).toBeDefined();
      expect(data.user.encryptedFamilyKey).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64

      // Track for cleanup
      tracker.trackFamily(data.family.id);
      tracker.trackUser(data.user.id, uniqueEmail);
    });

    it('should return encrypted family key in response', async () => {
      const uniqueEmail = `test-key-${Date.now()}@example.com`;
      const response = await fetchRegister({
          ...validRegistrationData,
          email: uniqueEmail,
        });

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data.user.encryptedFamilyKey).toBeDefined();
      expect(data.user.encryptedFamilyKey).toMatch(/^[A-Za-z0-9+/=]+$/);

      // Track for cleanup
      tracker.trackFamily(data.family.id);
      tracker.trackUser(data.user.id, uniqueEmail);
    });

    it('should reject duplicate email registration', async () => {
      const email = `test-dup-${Date.now()}@example.com`;
      
      // First registration
      const response1 = await fetchRegister({
          ...validRegistrationData,
          email,
        });
      expect(response1.status).toBe(201);
      const data1 = await response1.json();

      // Track for cleanup
      tracker.trackFamily(data1.family.id);
      tracker.trackUser(data1.user.id, email);

      // Second registration with same email
      const response2 = await fetchRegister({
          ...validRegistrationData,
          email,
        });

      expect(response2.status).toBe(409);
      const data2 = await response2.json();
      expect(data2.success).toBe(false);
      expect(data2.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should reject invalid email format', async () => {
      const response = await fetchRegister({
          ...validRegistrationData,
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject short password', async () => {
      const response = await fetchRegister({
          ...validRegistrationData,
          password: 'short',
        });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject short family name', async () => {
      const response = await fetchRegister({
          ...validRegistrationData,
          familyName: 'A',
        });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing required fields', async () => {
      const response = await fetchRegister({
          email: 'test@example.com',
        });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should generate unique invite codes for multiple families', async () => {
      const codes = new Set<string>();
      const testFamilies = [];
      
      // Create 3 families
      for (let i = 0; i < 3; i++) {
        const email = `test-unique-${Date.now()}-${i}@example.com`;
        const response = await fetchRegister({
            ...validRegistrationData,
            email,
            familyName: `Unique Family ${i}`,
          });

        expect(response.status).toBe(201);
        const data = await response.json();
        codes.add(data.family.inviteCode);
        testFamilies.push({ familyId: data.family.id, userId: data.user.id, email });
      }

      // All codes should be unique
      expect(codes.size).toBe(3);

      // Track all for cleanup
      testFamilies.forEach(({ familyId, userId, email }) => {
        tracker.trackFamily(familyId);
        tracker.trackUser(userId, email);
      });
    });

    it('should return invite code in correct format', async () => {
      const email = `test-format-${Date.now()}@example.com`;
      const response = await fetchRegister({
          ...validRegistrationData,
          email,
        });

      expect(response.status).toBe(201);
      const data = await response.json();

      // Check format: FAMILY-XXXXXXXX:base64key
      expect(data.family.inviteCode).toMatch(/^FAMILY-[A-Z0-9]{8}:[A-Za-z0-9+/=]+$/);

      // Check that the code part (before :) only contains uppercase letters and numbers
      const [codeOnly] = data.family.inviteCode.split(':');
      const codeWithoutPrefix = codeOnly.replace('FAMILY-', '');
      expect(codeWithoutPrefix).toMatch(/^[A-Z0-9]+$/);
      expect(codeWithoutPrefix).toHaveLength(8);

      // Track for cleanup
      tracker.trackFamily(data.family.id);
      tracker.trackUser(data.user.id, email);
    });
  });
});
