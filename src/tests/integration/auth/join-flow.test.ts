import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { createAdminClient, TestDataTracker } from '../../helpers/test-db';

/**
 * Integration tests for the join flow.
 *
 * These tests hit the actual API endpoint and verify:
 * - Invite code validation
 * - Family capacity check
 * - Member account creation
 * - Encrypted family key storage
 * - Error handling
 *
 * Uses local Supabase instance with cleanup in afterAll.
 */

describe('Join Flow Integration Tests', () => {
  const tracker = new TestDataTracker();
  const admin = createAdminClient();

  // Test API URL from environment
  const TEST_API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

  // Helper to create a test family and get invite code
  const createTestFamily = async () => {
    const email = `test-family-${Date.now()}@example.com`;
    const response = await fetch(`${TEST_API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-bypass-rate-limit': 'true',
      },
      body: JSON.stringify({
        email,
        password: 'TestPassword123!',
        familyName: 'Test Family',
        userName: 'Test Admin',
      }),
    });

    const data = await response.json();
    tracker.trackFamily(data.family.id);
    tracker.trackUser(data.user.id, email);

    return {
      familyId: data.family.id,
      inviteCode: data.family.inviteCode,
      adminUserId: data.user.id,
    };
  };

  // Helper to make join requests
  const fetchJoin = (body: object) => {
    return fetch(`${TEST_API_URL}/api/auth/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-bypass-rate-limit': 'true',
      },
      body: JSON.stringify(body),
    });
  };

  afterAll(async () => {
    // Clean up all test data
    await tracker.cleanup();
  }, 30000); // Increase timeout for cleanup (psql can take time)

  describe('POST /api/auth/join', () => {
    const validJoinData = {
      email: 'member@example.com',
      password: 'MemberPassword123!',
      userName: 'Test Member',
    };

    it('should allow member to join family with valid invite code', async () => {
      const { inviteCode } = await createTestFamily();
      const memberEmail = `member-${Date.now()}@example.com`;

      const response = await fetchJoin({
        ...validJoinData,
        email: memberEmail,
        inviteCode,
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(memberEmail);
      expect(data.user.name).toBe(validJoinData.userName);
      expect(data.user.role).toBe('member');
      expect(data.family).toBeDefined();
      expect(data.family.name).toBe('Test Family');
      expect(data.session).toBeDefined();

      // Track for cleanup
      tracker.trackUser(data.user.id, memberEmail);
    });

    it('should create member user record with encrypted family key', async () => {
      const { inviteCode, familyId } = await createTestFamily();
      const memberEmail = `member-key-${Date.now()}@example.com`;

      const response = await fetchJoin({
        ...validJoinData,
        email: memberEmail,
        inviteCode,
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data.user.role).toBe('member');
      expect(data.user.familyId).toBe(familyId);
      expect(data.user.encryptedFamilyKey).toBeDefined();
      expect(data.user.encryptedFamilyKey).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64

      // Verify the family key matches the one in the invite code
      const [, base64Key] = inviteCode.split(':');
      expect(data.user.encryptedFamilyKey).toBe(base64Key);

      // Track for cleanup
      tracker.trackUser(data.user.id, memberEmail);
    });

    it('should reject join with invalid invite code format', async () => {
      const response = await fetchJoin({
        ...validJoinData,
        inviteCode: 'INVALID-CODE',
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject join with non-existent invite code', async () => {
      const response = await fetchJoin({
        ...validJoinData,
        inviteCode: 'FAMILY-NOTFOUND:dGVzdGtleQ==',
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVITE_CODE_NOT_FOUND');
    });

    it('should reject duplicate email during join', async () => {
      const { inviteCode } = await createTestFamily();
      const duplicateEmail = `duplicate-${Date.now()}@example.com`;

      // First join
      const response1 = await fetchJoin({
        ...validJoinData,
        email: duplicateEmail,
        inviteCode,
      });
      expect(response1.status).toBe(201);
      const data1 = await response1.json();
      tracker.trackUser(data1.user.id, duplicateEmail);

      // Second join with same email
      const response2 = await fetchJoin({
        ...validJoinData,
        email: duplicateEmail,
        inviteCode,
      });

      expect(response2.status).toBe(409);
      const data2 = await response2.json();
      expect(data2.success).toBe(false);
      expect(data2.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should reject join when family is full', async () => {
      const { inviteCode, familyId } = await createTestFamily();

      // Update family max_members to 1 (admin already exists)
      await admin
        .from('families')
        .update({ max_members: 1 })
        .eq('id', familyId);

      const response = await fetchJoin({
        ...validJoinData,
        email: `full-test-${Date.now()}@example.com`,
        inviteCode,
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FAMILY_FULL');
    });

    it('should allow multiple members to join same family', async () => {
      const { inviteCode, familyId } = await createTestFamily();

      // Update family max_members to allow multiple members
      await admin
        .from('families')
        .update({ max_members: 5 })
        .eq('id', familyId);

      const members = [];

      // Join 3 members
      for (let i = 0; i < 3; i++) {
        const email = `member-multi-${Date.now()}-${i}@example.com`;
        const response = await fetchJoin({
          ...validJoinData,
          email,
          userName: `Member ${i + 1}`,
          inviteCode,
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.user.familyId).toBe(familyId);
        expect(data.user.role).toBe('member');
        expect(data.success).toBe(true);
        members.push({ userId: data.user.id, email });

        // Small delay to avoid timing issues
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Track all for cleanup
      members.forEach(({ userId, email }) => {
        tracker.trackUser(userId, email);
      });

      // Verify we successfully created 3 members
      expect(members.length).toBe(3);
    });

    it('should reject invalid email format', async () => {
      const { inviteCode } = await createTestFamily();

      const response = await fetchJoin({
        ...validJoinData,
        email: 'invalid-email',
        inviteCode,
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject short password', async () => {
      const { inviteCode } = await createTestFamily();

      const response = await fetchJoin({
        ...validJoinData,
        password: 'short',
        inviteCode,
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject short user name', async () => {
      const { inviteCode } = await createTestFamily();

      const response = await fetchJoin({
        ...validJoinData,
        userName: 'A',
        inviteCode,
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing required fields', async () => {
      const response = await fetchJoin({
        email: 'test@example.com',
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return session data for authenticated login', async () => {
      const { inviteCode } = await createTestFamily();
      const memberEmail = `session-${Date.now()}@example.com`;

      const response = await fetchJoin({
        ...validJoinData,
        email: memberEmail,
        inviteCode,
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data.session).toBeDefined();
      expect(data.session.accessToken).toBeDefined();
      expect(data.session.refreshToken).toBeDefined();

      // Track for cleanup
      tracker.trackUser(data.user.id, memberEmail);
    });
  });
});
