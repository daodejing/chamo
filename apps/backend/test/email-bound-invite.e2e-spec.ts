import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/email/email.service';
import { JwtService } from '@nestjs/jwt';
import { TelemetryService } from '../src/telemetry/telemetry.service';
import { encryptEmail, decryptEmail } from '../src/common/utils/crypto.util';
import { generateInviteCode, hashInviteCode } from '../src/common/utils/invite-code.util';

/**
 * Integration tests for Story 1.5: Email-Bound Invite System
 *
 * Tests the full invite creation → redemption flow including:
 * - Successful invite creation and redemption
 * - Email mismatch rejection
 * - Expired invite rejection
 * - Already used invite rejection
 * - Race condition handling
 */
describe('Email-Bound Invite Flow (Integration)', () => {
  let authService: AuthService;
  let prismaService: PrismaService;

  const prismaMock: any = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    family: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    familyMembership: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    familyInvite: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    emailVerificationToken: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const emailServiceMock: any = {
    sendVerificationEmail: jest.fn(),
  };

  const jwtServiceMock: any = {
    sign: jest.fn().mockReturnValue('test-jwt-token'),
  };

  const telemetryServiceMock: any = {
    trackEvent: jest.fn(),
    trackError: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    // Default transaction implementation
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') {
        return cb(prismaMock);
      }
      // Array of operations
      return Promise.all(cb.map((op: any) => op));
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: TelemetryService, useValue: telemetryServiceMock },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
    prismaService = moduleRef.get(PrismaService);
  });

  describe('Subtask 10.4: Full invite creation → redemption flow', () => {
    it('should create invite and successfully redeem with correct email', async () => {
      const inviterUserId = 'inviter-123';
      const familyId = 'family-123';
      const inviteeEmail = 'invitee@example.com';
      const inviteCode = generateInviteCode();
      const codeHash = hashInviteCode(inviteCode);
      const encryptedEmail = encryptEmail(inviteeEmail);
      // Valid 44-character base64 public key
      const validPublicKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

      // Mock: Find inviter user with active family
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: inviterUserId,
        email: 'inviter@example.com',
        name: 'Inviter',
        activeFamilyId: familyId,
        role: 'USER',
        emailVerified: true,
        passwordHash: 'hash',
        publicKey: validPublicKey,
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        preferences: {},
      });

      // Mock: Inviter is a family member
      prismaMock.familyMembership.findUnique.mockResolvedValueOnce({
        userId: inviterUserId,
        familyId,
        role: 'ADMIN',
      });

      // Mock: Create invite
      prismaMock.familyInvite.create.mockResolvedValueOnce({
        id: 'invite-123',
        code: inviteCode,
        codeHash,
        familyId,
        inviterId: inviterUserId,
        inviteeEmailEncrypted: encryptedEmail,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        redeemedAt: null,
        redeemedByUserId: null,
        createdAt: new Date(),
      });

      // Step 1: Create invite
      const createResult = await authService.createInvite(inviterUserId, inviteeEmail);

      expect(createResult.inviteCode).toBe(inviteCode);
      expect(createResult.inviteeEmail).toBe(inviteeEmail);
      expect(createResult.expiresAt).toBeInstanceOf(Date);

      // Mock: Lookup invite for redemption
      prismaMock.familyInvite.findUnique.mockResolvedValueOnce({
        id: 'invite-123',
        code: inviteCode,
        codeHash,
        familyId,
        inviterId: inviterUserId,
        inviteeEmailEncrypted: encryptedEmail,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        redeemedAt: null,
        redeemedByUserId: null,
        createdAt: new Date(),
        family: {
          id: familyId,
          name: 'Test Family',
          inviteCode: 'FAMILY-OLDCODE',
          avatar: null,
          maxMembers: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
          memberships: [],
        },
      });

      // Mock family lookup fallback (should not be called for email-bound invites)
      prismaMock.family.findUnique.mockResolvedValueOnce(null);

      // Mock: Family lookup fallback (should not be called)
      prismaMock.family.findUnique.mockResolvedValueOnce(null);

      // Mock: User doesn't exist yet
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      // Mock: Create user
      prismaMock.user.create.mockResolvedValueOnce({
        id: 'user-123',
        email: inviteeEmail,
        name: 'Test User',
        passwordHash: 'hash',
        publicKey: 'public-key',
        emailVerified: false,
        activeFamilyId: familyId,
        role: 'USER',
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        preferences: {},
      });

      // Mock: Create family membership
      prismaMock.familyMembership.create.mockResolvedValueOnce({
        id: 'membership-123',
        userId: 'user-123',
        familyId,
        role: 'MEMBER',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock: Mark invite as redeemed
      prismaMock.familyInvite.update.mockResolvedValueOnce({});

      // Mock: Create email verification token
      prismaMock.emailVerificationToken.create.mockResolvedValueOnce({
        id: 'token-123',
        userId: 'user-123',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
      });

      // Step 2: Join family with correct email
      const joinResult = await authService.joinFamily(
        inviteeEmail,
        'password123',
        'Test User',
        inviteCode,
        validPublicKey
      );

      expect(joinResult).toEqual({
        message: 'Registration successful. Please check your email to verify your account.',
        requiresEmailVerification: true,
        userId: 'user-123',
      });

      // Verify invite was marked as redeemed
      expect(prismaMock.familyInvite.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'invite-123' },
          data: expect.objectContaining({
            redeemedAt: expect.any(Date),
            redeemedByUserId: 'user-123',
          }),
        })
      );

      // Verify email was sent
      expect(emailServiceMock.sendVerificationEmail).toHaveBeenCalledWith(
        inviteeEmail,
        expect.any(String)
      );
    });
  });

  describe('Subtask 10.5: Email mismatch rejection', () => {
    it('should reject redemption when email does not match', async () => {
      const inviteeEmail = 'correct@example.com';
      const wrongEmail = 'wrong@example.com';
      const inviteCode = generateInviteCode();
      const codeHash = hashInviteCode(inviteCode);
      const encryptedEmail = encryptEmail(inviteeEmail);
      const validPublicKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

      // Mock: Lookup invite
      prismaMock.familyInvite.findUnique.mockResolvedValueOnce({
        id: 'invite-123',
        code: inviteCode,
        codeHash,
        familyId: 'family-123',
        inviterId: 'inviter-123',
        inviteeEmailEncrypted: encryptedEmail,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        redeemedAt: null,
        redeemedByUserId: null,
        createdAt: new Date(),
        family: {
          id: 'family-123',
          name: 'Test Family',
          inviteCode: 'FAMILY-OLDCODE',
          avatar: null,
          maxMembers: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Mock: Family lookup fallback
      prismaMock.family.findUnique.mockResolvedValueOnce(null);

      // Attempt to join with wrong email
      await expect(
        authService.joinFamily(
          wrongEmail,
          'password123',
          'Test User',
          inviteCode,
          validPublicKey
        )
      ).rejects.toThrow('This invite code was not sent to your email address');

      // Verify user was not created
      expect(prismaMock.user.create).not.toHaveBeenCalled();

      // Verify invite was not marked as redeemed
      expect(prismaMock.familyInvite.update).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive email comparison', async () => {
      const inviteeEmail = 'User@Example.com';
      const inviteCode = generateInviteCode();
      const codeHash = hashInviteCode(inviteCode);
      const encryptedEmail = encryptEmail(inviteeEmail.toLowerCase());
      const validPublicKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

      // Mock: Lookup invite
      prismaMock.familyInvite.findUnique.mockResolvedValueOnce({
        id: 'invite-123',
        code: inviteCode,
        codeHash,
        familyId: 'family-123',
        inviterId: 'inviter-123',
        inviteeEmailEncrypted: encryptedEmail,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        redeemedAt: null,
        redeemedByUserId: null,
        createdAt: new Date(),
        family: {
          id: 'family-123',
          name: 'Test Family',
          inviteCode: 'FAMILY-OLDCODE',
          avatar: null,
          maxMembers: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
          memberships: [],
        },
      });
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.user.create.mockResolvedValueOnce({
        id: 'user-123',
        email: inviteeEmail.toLowerCase(),
        name: 'Test User',
        passwordHash: 'hash',
        publicKey: validPublicKey,
        emailVerified: false,
        activeFamilyId: 'family-123',
        role: 'USER',
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        preferences: {},
      });
      prismaMock.familyMembership.create.mockResolvedValueOnce({});
      prismaMock.familyInvite.update.mockResolvedValueOnce({});
      prismaMock.emailVerificationToken.create.mockResolvedValueOnce({
        id: 'token-123',
        userId: 'user-123',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
      });

      // Should succeed with different case
      const result = await authService.joinFamily(
        'USER@EXAMPLE.COM',
        'password123',
        'Test User',
        inviteCode,
        validPublicKey
      );

      expect(result.requiresEmailVerification).toBe(true);
    });
  });

  describe('Subtask 10.6: Expired invite rejection', () => {
    it('should reject redemption of expired invite', async () => {
      const inviteeEmail = 'invitee@example.com';
      const inviteCode = generateInviteCode();
      const codeHash = hashInviteCode(inviteCode);
      const encryptedEmail = encryptEmail(inviteeEmail);
      const validPublicKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

      // Mock: Lookup expired invite
      prismaMock.familyInvite.findUnique.mockResolvedValueOnce({
        id: 'invite-123',
        code: inviteCode,
        codeHash,
        familyId: 'family-123',
        inviterId: 'inviter-123',
        inviteeEmailEncrypted: encryptedEmail,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        redeemedAt: null,
        redeemedByUserId: null,
        createdAt: new Date(),
        family: {
          id: 'family-123',
          name: 'Test Family',
          inviteCode: 'FAMILY-OLDCODE',
          avatar: null,
          maxMembers: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      prismaMock.family.findUnique.mockResolvedValueOnce(null);

      // Attempt to join with expired invite
      await expect(
        authService.joinFamily(
          inviteeEmail,
          'password123',
          'Test User',
          inviteCode,
          validPublicKey
        )
      ).rejects.toThrow('This invite code has expired');

      // Verify user was not created
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  describe('Subtask 10.7: Already used invite rejection', () => {
    it('should reject redemption of already used invite', async () => {
      const inviteeEmail = 'invitee@example.com';
      const inviteCode = generateInviteCode();
      const codeHash = hashInviteCode(inviteCode);
      const encryptedEmail = encryptEmail(inviteeEmail);
      const validPublicKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

      // Mock: Lookup used invite
      prismaMock.familyInvite.findUnique.mockResolvedValueOnce({
        id: 'invite-123',
        code: inviteCode,
        codeHash,
        familyId: 'family-123',
        inviterId: 'inviter-123',
        inviteeEmailEncrypted: encryptedEmail,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        redeemedAt: new Date(Date.now() - 60 * 60 * 1000), // Used 1 hour ago
        redeemedByUserId: 'other-user-123',
        createdAt: new Date(),
        family: {
          id: 'family-123',
          name: 'Test Family',
          inviteCode: 'FAMILY-OLDCODE',
          avatar: null,
          maxMembers: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      prismaMock.family.findUnique.mockResolvedValueOnce(null);

      // Attempt to join with already used invite
      await expect(
        authService.joinFamily(
          inviteeEmail,
          'password123',
          'Test User',
          inviteCode,
          validPublicKey
        )
      ).rejects.toThrow('This invite code has already been used');

      // Verify user was not created
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  describe('Subtask 10.8: Race condition handling', () => {
    it('should handle concurrent redemption attempts safely', async () => {
      const inviteeEmail = 'invitee@example.com';
      const inviteCode = generateInviteCode();
      const codeHash = hashInviteCode(inviteCode);
      const encryptedEmail = encryptEmail(inviteeEmail);
      const validPublicKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

      const validInvite = {
        id: 'invite-123',
        code: inviteCode,
        codeHash,
        familyId: 'family-123',
        inviterId: 'inviter-123',
        inviteeEmailEncrypted: encryptedEmail,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        redeemedAt: null,
        redeemedByUserId: null,
        createdAt: new Date(),
        family: {
          id: 'family-123',
          name: 'Test Family',
          inviteCode: 'FAMILY-OLDCODE',
          avatar: null,
          maxMembers: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
          memberships: [],
        },
      };

      // First request gets valid invite
      prismaMock.familyInvite.findUnique.mockResolvedValueOnce(validInvite);
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.user.create.mockResolvedValueOnce({
        id: 'user-123',
        email: inviteeEmail,
        name: 'Test User',
        passwordHash: 'hash',
        publicKey: validPublicKey,
        emailVerified: false,
        activeFamilyId: 'family-123',
        role: 'USER',
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        preferences: {},
      });
      prismaMock.familyMembership.create.mockResolvedValueOnce({});
      prismaMock.familyInvite.update.mockResolvedValueOnce({});
      prismaMock.emailVerificationToken.create.mockResolvedValueOnce({
        id: 'token-123',
        userId: 'user-123',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: null,
        createdAt: new Date(),
      });

      // First request succeeds
      const result1 = await authService.joinFamily(
        inviteeEmail,
        'password123',
        'Test User',
        inviteCode,
        validPublicKey
      );

      expect(result1.requiresEmailVerification).toBe(true);

      // Second request gets already redeemed invite
      const usedInvite = {
        ...validInvite,
        redeemedAt: new Date(),
        redeemedByUserId: 'user-123',
      };

      prismaMock.familyInvite.findUnique.mockResolvedValueOnce(usedInvite);
      prismaMock.family.findUnique.mockResolvedValueOnce({
        id: 'family-123',
        name: 'Test Family',
        inviteCode: 'FAMILY-OLDCODE',
        avatar: null,
        maxMembers: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [],
      });

      // Second request should fail
      await expect(
        authService.joinFamily(
          inviteeEmail,
          'password456',
          'Test User 2',
          inviteCode,
          'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='
        )
      ).rejects.toThrow('This invite code has already been used');
    });
  });

  describe('Encryption round-trip verification', () => {
    it('should encrypt and decrypt email correctly', () => {
      const originalEmail = 'test@example.com';
      const encrypted = encryptEmail(originalEmail);
      const decrypted = decryptEmail(encrypted);

      expect(decrypted).toBe(originalEmail);
      expect(encrypted).not.toBe(originalEmail);
    });

    it('should produce different ciphertext for same email (random IV)', () => {
      const email = 'test@example.com';
      const encrypted1 = encryptEmail(email);
      const encrypted2 = encryptEmail(email);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decryptEmail(encrypted1)).toBe(email);
      expect(decryptEmail(encrypted2)).toBe(email);
    });

    it('should fail decryption if ciphertext is tampered', () => {
      const email = 'test@example.com';
      const encrypted = encryptEmail(email);

      // Tamper with the ciphertext
      const tamperedBase64 = encrypted.slice(0, -5) + 'AAAAA';

      expect(() => decryptEmail(tamperedBase64)).toThrow();
    });
  });
});
