import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email/email.service';

describe('AuthService - Encrypted Invite Flow', () => {
  let authService: AuthService;
  const prismaMock: any = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    family: {
      findUnique: jest.fn(),
    },
    familyMembership: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    invite: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const emailServiceMock: any = {
    sendVerificationEmail: jest.fn(),
  };

  const jwtServiceMock: any = {
    sign: jest.fn().mockReturnValue('test-token'),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock as PrismaService },
        { provide: EmailService, useValue: emailServiceMock as EmailService },
        { provide: JwtService, useValue: jwtServiceMock as JwtService },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe('createEncryptedInvite', () => {
    const inviterUserId = 'inviter-user-123';
    const familyId = 'family-123';
    const inviteeEmail = 'invitee@example.com';
    const encryptedFamilyKey = 'encrypted-key-base64';
    const nonce = 'nonce-base64';
    const inviteCode = 'FAMILY-TESTCODE123';
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    it('should create encrypted invite successfully', async () => {
      // Mock user is a family member
      prismaMock.familyMembership.findUnique.mockResolvedValueOnce({
        userId: inviterUserId,
        familyId,
        role: 'ADMIN',
      });

      // Mock no existing pending invite
      prismaMock.invite.findFirst.mockResolvedValueOnce(null);

      // Mock invite creation
      const createdInvite = {
        id: 'invite-123',
        familyId,
        inviterId: inviterUserId,
        inviteeEmail,
        encryptedFamilyKey,
        nonce,
        inviteCode,
        status: 'PENDING',
        expiresAt,
        acceptedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.invite.create.mockResolvedValueOnce(createdInvite);

      const result = await authService.createEncryptedInvite(
        inviterUserId,
        familyId,
        inviteeEmail,
        encryptedFamilyKey,
        nonce,
        inviteCode,
        expiresAt
      );

      expect(result).toEqual({
        invite: {
          ...createdInvite,
          acceptedAt: undefined,
        },
        inviteCode,
        message: `Invite created successfully for ${inviteeEmail}`,
      });

      expect(prismaMock.familyMembership.findUnique).toHaveBeenCalledWith({
        where: { userId_familyId: { userId: inviterUserId, familyId } },
      });

      expect(prismaMock.invite.create).toHaveBeenCalledWith({
        data: {
          familyId,
          inviterId: inviterUserId,
          inviteeEmail,
          encryptedFamilyKey,
          nonce,
          inviteCode,
          status: 'PENDING',
          expiresAt,
        },
      });
    });

    it('should throw ForbiddenException if inviter is not a family member', async () => {
      prismaMock.familyMembership.findUnique.mockResolvedValueOnce(null);

      await expect(
        authService.createEncryptedInvite(
          inviterUserId,
          familyId,
          inviteeEmail,
          encryptedFamilyKey,
          nonce,
          inviteCode,
          expiresAt
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if pending invite already exists', async () => {
      prismaMock.familyMembership.findUnique.mockResolvedValueOnce({
        userId: inviterUserId,
        familyId,
        role: 'ADMIN',
      });

      prismaMock.invite.findFirst.mockResolvedValueOnce({
        id: 'existing-invite',
        status: 'PENDING',
      });

      await expect(
        authService.createEncryptedInvite(
          inviterUserId,
          familyId,
          inviteeEmail,
          encryptedFamilyKey,
          nonce,
          inviteCode,
          expiresAt
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('acceptInvite', () => {
    const userId = 'user-123';
    const inviteCode = 'FAMILY-TESTCODE123';
    const familyId = 'family-123';
    const inviterId = 'inviter-123';
    const userEmail = 'user@example.com';

    it('should accept invite successfully', async () => {
      const mockInvite = {
        id: 'invite-123',
        familyId,
        inviterId,
        inviteeEmail: userEmail,
        encryptedFamilyKey: 'encrypted-key',
        nonce: 'nonce',
        inviteCode,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        family: {
          id: familyId,
          name: 'Test Family',
        },
        inviter: {
          id: inviterId,
          publicKey: 'inviter-public-key',
        },
      };

      const mockUser = {
        id: userId,
        email: userEmail,
        activeFamilyId: null,
      };

      prismaMock.invite.findUnique.mockResolvedValueOnce(mockInvite);
      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser);
      prismaMock.familyMembership.findUnique.mockResolvedValueOnce(null);
      prismaMock.familyMembership.create.mockResolvedValueOnce({});
      prismaMock.user.update.mockResolvedValueOnce({});
      prismaMock.invite.update.mockResolvedValueOnce({});

      const result = await authService.acceptInvite(userId, inviteCode);

      expect(result).toEqual({
        success: true,
        message: `Successfully joined ${mockInvite.family.name}`,
        familyId,
        familyName: 'Test Family',
        encryptedFamilyKey: 'encrypted-key',
        nonce: 'nonce',
        inviterPublicKey: 'inviter-public-key',
      });

      expect(prismaMock.familyMembership.create).toHaveBeenCalledWith({
        data: {
          userId,
          familyId,
          role: 'MEMBER',
        },
      });

      expect(prismaMock.invite.update).toHaveBeenCalledWith({
        where: { id: mockInvite.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: expect.any(Date),
        },
      });
    });

    it('should throw BadRequestException if invite not found', async () => {
      prismaMock.invite.findUnique.mockResolvedValueOnce(null);

      await expect(
        authService.acceptInvite(userId, inviteCode)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if invite already used', async () => {
      prismaMock.invite.findUnique.mockResolvedValueOnce({
        status: 'ACCEPTED',
        family: {},
      });

      await expect(
        authService.acceptInvite(userId, inviteCode)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException and mark as expired if invite expired', async () => {
      const mockInvite = {
        id: 'invite-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 1000), // Expired
        family: {},
      };

      prismaMock.invite.findUnique.mockResolvedValueOnce(mockInvite);
      prismaMock.invite.update.mockResolvedValueOnce({});

      await expect(
        authService.acceptInvite(userId, inviteCode)
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.invite.update).toHaveBeenCalledWith({
        where: { id: mockInvite.id },
        data: { status: 'EXPIRED' },
      });
    });

    it('should throw ForbiddenException if email does not match', async () => {
      prismaMock.invite.findUnique.mockResolvedValueOnce({
        id: 'invite-123',
        inviteeEmail: 'wrong@example.com',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        family: {},
      });

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: userId,
        email: 'user@example.com',
      });

      await expect(
        authService.acceptInvite(userId, inviteCode)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if user already a member', async () => {
      prismaMock.invite.findUnique.mockResolvedValueOnce({
        id: 'invite-123',
        familyId,
        inviteeEmail: userEmail,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        family: {},
      });

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: userId,
        email: userEmail,
      });

      prismaMock.familyMembership.findUnique.mockResolvedValueOnce({
        userId,
        familyId,
      });

      await expect(
        authService.acceptInvite(userId, inviteCode)
      ).rejects.toThrow(ConflictException);
    });
  });
});
