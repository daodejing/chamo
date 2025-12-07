import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { Role } from '@prisma/client';

/**
 * Story 1.14: Remove Family Member & Self De-registration
 *
 * Tests cover:
 * - Part A: Remove Family Member (AC1-5)
 * - Part B: Self De-registration (AC6-14)
 */
describe('AuthService - Story 1.14: Remove Family Member & Self De-registration', () => {
  let authService: AuthService;

  // Mock data
  const adminUserId = 'admin-user-id';
  const memberUserId = 'member-user-id';
  const otherAdminUserId = 'other-admin-id';
  const familyId = 'family-id';
  const memberEmail = 'member@example.com';

  const prismaMock: any = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    familyMembership: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    invite: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const emailServiceMock: any = {
    sendVerificationEmail: jest.fn(),
    sendInviteNotification: jest.fn(),
    sendRegistrationInviteEmail: jest.fn(),
  };

  const jwtServiceMock: any = {
    sign: jest.fn().mockReturnValue('test-token'),
  };

  const telemetryMock: any = {
    recordUnverifiedLogin: jest.fn(),
    recordInviteDecryptFailure: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock as PrismaService },
        { provide: EmailService, useValue: emailServiceMock as EmailService },
        { provide: JwtService, useValue: jwtServiceMock as JwtService },
        { provide: TelemetryService, useValue: telemetryMock as TelemetryService },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  // ==========================================================================
  // Part A: Remove Family Member (AC2, AC3, AC5)
  // ==========================================================================
  describe('removeFamilyMember', () => {
    describe('AC2: Remove Member Backend', () => {
      it('should successfully remove a non-admin member from the family', async () => {
        // Setup: Admin membership
        prismaMock.familyMembership.findUnique
          .mockResolvedValueOnce({
            userId: adminUserId,
            familyId,
            role: Role.ADMIN,
          })
          // Target user membership
          .mockResolvedValueOnce({
            userId: memberUserId,
            familyId,
            role: Role.MEMBER,
            user: {
              name: 'Test Member',
              email: memberEmail,
              activeFamilyId: familyId,
            },
          });

        // Mock transaction to execute callback
        prismaMock.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            familyMembership: {
              delete: jest.fn().mockResolvedValue({}),
            },
            user: {
              update: jest.fn().mockResolvedValue({}),
            },
            invite: {
              updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
          });
        });

        const result = await authService.removeFamilyMember(
          adminUserId,
          memberUserId,
          familyId,
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('Test Member');
        expect(prismaMock.$transaction).toHaveBeenCalled();
      });

      it('should clear activeFamilyId when removed member was active in that family', async () => {
        prismaMock.familyMembership.findUnique
          .mockResolvedValueOnce({
            userId: adminUserId,
            familyId,
            role: Role.ADMIN,
          })
          .mockResolvedValueOnce({
            userId: memberUserId,
            familyId,
            role: Role.MEMBER,
            user: {
              name: 'Test Member',
              email: memberEmail,
              activeFamilyId: familyId, // Active in this family
            },
          });

        const userUpdateMock = jest.fn().mockResolvedValue({});
        prismaMock.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            familyMembership: { delete: jest.fn().mockResolvedValue({}) },
            user: { update: userUpdateMock },
            invite: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          });
        });

        await authService.removeFamilyMember(adminUserId, memberUserId, familyId);

        // Verify user update was called with activeFamilyId: null
        expect(userUpdateMock).toHaveBeenCalledWith({
          where: { id: memberUserId },
          data: { activeFamilyId: null },
        });
      });

      it('should NOT clear activeFamilyId when removed member was active in a different family', async () => {
        const otherFamilyId = 'other-family-id';

        prismaMock.familyMembership.findUnique
          .mockResolvedValueOnce({
            userId: adminUserId,
            familyId,
            role: Role.ADMIN,
          })
          .mockResolvedValueOnce({
            userId: memberUserId,
            familyId,
            role: Role.MEMBER,
            user: {
              name: 'Test Member',
              email: memberEmail,
              activeFamilyId: otherFamilyId, // Active in different family
            },
          });

        const userUpdateMock = jest.fn();
        prismaMock.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            familyMembership: { delete: jest.fn().mockResolvedValue({}) },
            user: { update: userUpdateMock },
            invite: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          });
        });

        await authService.removeFamilyMember(adminUserId, memberUserId, familyId);

        // Verify user update was NOT called (since activeFamilyId is different)
        expect(userUpdateMock).not.toHaveBeenCalled();
      });
    });

    describe('AC3: Admin Protection', () => {
      it('should throw ForbiddenException when trying to remove another admin', async () => {
        // First call: caller's membership (admin)
        // Second call: target's membership (also admin)
        prismaMock.familyMembership.findUnique
          .mockResolvedValueOnce({
            userId: adminUserId,
            familyId,
            role: Role.ADMIN,
          })
          .mockResolvedValueOnce({
            userId: otherAdminUserId,
            familyId,
            role: Role.ADMIN, // Target is also an admin
            user: {
              name: 'Other Admin',
              email: 'other-admin@example.com',
              activeFamilyId: familyId,
            },
          });

        await expect(
          authService.removeFamilyMember(adminUserId, otherAdminUserId, familyId),
        ).rejects.toThrow(ForbiddenException);

        // Reset mock for second assertion
        prismaMock.familyMembership.findUnique
          .mockResolvedValueOnce({
            userId: adminUserId,
            familyId,
            role: Role.ADMIN,
          })
          .mockResolvedValueOnce({
            userId: otherAdminUserId,
            familyId,
            role: Role.ADMIN,
            user: {
              name: 'Other Admin',
              email: 'other-admin@example.com',
              activeFamilyId: familyId,
            },
          });

        await expect(
          authService.removeFamilyMember(adminUserId, otherAdminUserId, familyId),
        ).rejects.toThrow('Cannot remove other admins from the family');
      });

      it('should throw ForbiddenException when non-admin tries to remove a member', async () => {
        prismaMock.familyMembership.findUnique.mockResolvedValueOnce({
          userId: memberUserId,
          familyId,
          role: Role.MEMBER, // Caller is not an admin
        });

        await expect(
          authService.removeFamilyMember(memberUserId, adminUserId, familyId),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          authService.removeFamilyMember(memberUserId, adminUserId, familyId),
        ).rejects.toThrow('Only family admins can remove members');
      });

      it('should throw ForbiddenException when caller is not a member of the family', async () => {
        prismaMock.familyMembership.findUnique.mockResolvedValueOnce(null);

        await expect(
          authService.removeFamilyMember(adminUserId, memberUserId, familyId),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('AC5: Invite Cleanup', () => {
      it('should revoke pending invites TO the removed user for this family', async () => {
        prismaMock.familyMembership.findUnique
          .mockResolvedValueOnce({
            userId: adminUserId,
            familyId,
            role: Role.ADMIN,
          })
          .mockResolvedValueOnce({
            userId: memberUserId,
            familyId,
            role: Role.MEMBER,
            user: {
              name: 'Test Member',
              email: memberEmail,
              activeFamilyId: null,
            },
          });

        const inviteUpdateMock = jest.fn().mockResolvedValue({ count: 2 });
        prismaMock.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            familyMembership: { delete: jest.fn().mockResolvedValue({}) },
            user: { update: jest.fn().mockResolvedValue({}) },
            invite: { updateMany: inviteUpdateMock },
          });
        });

        await authService.removeFamilyMember(adminUserId, memberUserId, familyId);

        // Verify invite.updateMany was called with correct parameters
        expect(inviteUpdateMock).toHaveBeenCalledWith({
          where: {
            familyId,
            inviteeEmail: memberEmail,
            status: {
              in: ['PENDING', 'PENDING_REGISTRATION'],
            },
          },
          data: {
            status: 'REVOKED',
          },
        });
      });
    });

    describe('Edge Cases', () => {
      it('should throw BadRequestException when target user is not a member', async () => {
        // First call: caller's membership (admin)
        // Second call: target's membership (not found)
        prismaMock.familyMembership.findUnique
          .mockResolvedValueOnce({
            userId: adminUserId,
            familyId,
            role: Role.ADMIN,
          })
          .mockResolvedValueOnce(null); // Target is not a member

        await expect(
          authService.removeFamilyMember(adminUserId, memberUserId, familyId),
        ).rejects.toThrow(BadRequestException);

        // Reset mocks for second assertion
        prismaMock.familyMembership.findUnique
          .mockResolvedValueOnce({
            userId: adminUserId,
            familyId,
            role: Role.ADMIN,
          })
          .mockResolvedValueOnce(null);

        await expect(
          authService.removeFamilyMember(adminUserId, memberUserId, familyId),
        ).rejects.toThrow('User is not a member of this family');
      });

      it('should throw BadRequestException when admin tries to remove themselves', async () => {
        prismaMock.familyMembership.findUnique.mockResolvedValueOnce({
          userId: adminUserId,
          familyId,
          role: Role.ADMIN,
        });

        await expect(
          authService.removeFamilyMember(adminUserId, adminUserId, familyId),
        ).rejects.toThrow(BadRequestException);

        // Reset mock for second assertion
        prismaMock.familyMembership.findUnique.mockResolvedValueOnce({
          userId: adminUserId,
          familyId,
          role: Role.ADMIN,
        });

        await expect(
          authService.removeFamilyMember(adminUserId, adminUserId, familyId),
        ).rejects.toThrow('Use deregisterSelf to remove yourself from a family');
      });
    });
  });

  // ==========================================================================
  // Part B: Self De-registration (AC9, AC10, AC11)
  // ==========================================================================
  describe('deregisterSelf', () => {
    describe('AC9: Soft Delete Execution', () => {
      it('should soft delete user by setting deletedAt and clearing activeFamilyId', async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce({
          id: memberUserId,
          email: memberEmail,
          deletedAt: null,
          memberships: [{ familyId }],
        });

        const userUpdateMock = jest.fn().mockResolvedValue({});
        prismaMock.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            user: { update: userUpdateMock },
            familyMembership: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
            invite: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          });
        });

        const result = await authService.deregisterSelf(memberUserId);

        expect(result.success).toBe(true);
        expect(result.message).toContain('deleted');

        // Verify user update
        expect(userUpdateMock).toHaveBeenCalledWith({
          where: { id: memberUserId },
          data: {
            deletedAt: expect.any(Date),
            activeFamilyId: null,
          },
        });
      });
    });

    describe('AC10: Membership Cleanup', () => {
      it('should delete all FamilyMembership records for the user', async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce({
          id: memberUserId,
          email: memberEmail,
          deletedAt: null,
          memberships: [
            { familyId: 'family-1' },
            { familyId: 'family-2' },
            { familyId: 'family-3' },
          ],
        });

        const membershipDeleteMock = jest.fn().mockResolvedValue({ count: 3 });
        prismaMock.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            user: { update: jest.fn().mockResolvedValue({}) },
            familyMembership: { deleteMany: membershipDeleteMock },
            invite: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          });
        });

        await authService.deregisterSelf(memberUserId);

        expect(membershipDeleteMock).toHaveBeenCalledWith({
          where: { userId: memberUserId },
        });
      });
    });

    describe('AC11: Invite Cleanup', () => {
      it('should revoke all pending invites TO the deleted user', async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce({
          id: memberUserId,
          email: memberEmail,
          deletedAt: null,
          memberships: [],
        });

        const inviteUpdateMock = jest.fn().mockResolvedValue({ count: 5 });
        prismaMock.$transaction.mockImplementation(async (callback: any) => {
          return callback({
            user: { update: jest.fn().mockResolvedValue({}) },
            familyMembership: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
            invite: { updateMany: inviteUpdateMock },
          });
        });

        await authService.deregisterSelf(memberUserId);

        expect(inviteUpdateMock).toHaveBeenCalledWith({
          where: {
            inviteeEmail: memberEmail,
            status: {
              in: ['PENDING', 'PENDING_REGISTRATION'],
            },
          },
          data: {
            status: 'REVOKED',
          },
        });
      });
    });

    describe('Edge Cases', () => {
      it('should throw BadRequestException when user not found', async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce(null);

        await expect(authService.deregisterSelf(memberUserId)).rejects.toThrow(
          BadRequestException,
        );

        await expect(authService.deregisterSelf(memberUserId)).rejects.toThrow(
          'User not found',
        );
      });

      it('should throw BadRequestException when user is already deleted', async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce({
          id: memberUserId,
          email: memberEmail,
          deletedAt: new Date(), // Already deleted
          memberships: [],
        });

        await expect(authService.deregisterSelf(memberUserId)).rejects.toThrow(
          BadRequestException,
        );

        // Reset mock for second assertion
        prismaMock.user.findUnique.mockResolvedValueOnce({
          id: memberUserId,
          email: memberEmail,
          deletedAt: new Date(),
          memberships: [],
        });

        await expect(authService.deregisterSelf(memberUserId)).rejects.toThrow(
          'Account is already deleted',
        );
      });
    });

    describe('Transaction Atomicity', () => {
      it('should execute all operations within a single transaction', async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce({
          id: memberUserId,
          email: memberEmail,
          deletedAt: null,
          memberships: [{ familyId }],
        });

        const txOperations: string[] = [];

        prismaMock.$transaction.mockImplementation(async (callback: any) => {
          const mockTx = {
            user: {
              update: jest.fn().mockImplementation(() => {
                txOperations.push('user.update');
                return Promise.resolve({});
              }),
            },
            familyMembership: {
              deleteMany: jest.fn().mockImplementation(() => {
                txOperations.push('familyMembership.deleteMany');
                return Promise.resolve({ count: 1 });
              }),
            },
            invite: {
              updateMany: jest.fn().mockImplementation(() => {
                txOperations.push('invite.updateMany');
                return Promise.resolve({ count: 0 });
              }),
            },
          };
          return callback(mockTx);
        });

        await authService.deregisterSelf(memberUserId);

        // Verify all operations happened within the transaction
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(txOperations).toContain('user.update');
        expect(txOperations).toContain('familyMembership.deleteMany');
        expect(txOperations).toContain('invite.updateMany');
      });
    });
  });

  // ==========================================================================
  // Query Filtering (AC13: All user queries filter by deletedAt IS NULL)
  // ==========================================================================
  describe('Query Filtering for Deleted Users', () => {
    describe('AC13: Login rejects deleted users', () => {
      it('should return "Invalid credentials" when user is soft-deleted', async () => {
        // findFirst returns null because we filter by deletedAt: null
        prismaMock.user.findFirst.mockResolvedValueOnce(null);

        await expect(
          authService.login(memberEmail, 'password123'),
        ).rejects.toThrow('Invalid credentials');
      });
    });

    describe('AC13: getUserPublicKey filters deleted users', () => {
      it('should return null for soft-deleted user', async () => {
        // findFirst returns null because we filter by deletedAt: null
        prismaMock.user.findFirst.mockResolvedValueOnce(null);

        const result = await authService.getUserPublicKey(memberEmail);

        expect(result).toBeNull();
        expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
          where: { email: memberEmail, deletedAt: null },
          select: { publicKey: true },
        });
      });

      it('should return public key for active user', async () => {
        prismaMock.user.findFirst.mockResolvedValueOnce({
          publicKey: 'test-public-key',
        });

        const result = await authService.getUserPublicKey(memberEmail);

        expect(result).toBe('test-public-key');
      });
    });
  });
});
