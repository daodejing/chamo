import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { MessagingFixturePayload, FamilyAdminFixturePayload, CleanupResult } from './test-support.types';
import { TestCreateMessagingFixtureInput, TestCreateFamilyAdminFixtureInput, TestCleanupInput } from './test-support.inputs';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Role, Channel as PrismaChannel } from '@prisma/client';
import { Channel as ChannelType } from '../channels/types/channel.type';

@Injectable()
export class TestSupportService {
  private readonly logger = new Logger(TestSupportService.name);
  private readonly isEnabled = process.env.NODE_ENV !== 'production';

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  private ensureEnabled() {
    if (!this.isEnabled) {
      throw new ForbiddenException(
        'Test support operations are disabled in this environment.',
      );
    }
  }

  private generateInviteCode(): string {
    return randomBytes(4).toString('hex').toUpperCase();
  }

  private generatePublicKey(): string {
    return randomBytes(32).toString('base64');
  }

  private toChannelType(channel: PrismaChannel): ChannelType {
    return {
      ...channel,
      description: channel.description ?? undefined,
      icon: channel.icon ?? undefined,
    };
  }

  async createMessagingFixture(
    input: TestCreateMessagingFixtureInput,
  ): Promise<MessagingFixturePayload> {
    this.ensureEnabled();

    const { admin, member, familyName } = input;
    const adminEmail = admin.email.toLowerCase();
    const memberEmail = member.email.toLowerCase();

    const [adminPasswordHash, memberPasswordHash] = await Promise.all([
      bcrypt.hash(admin.password, 10),
      bcrypt.hash(member.password, 10),
    ]);

    const adminUser = await this.prisma.user.create({
      data: {
        email: adminEmail,
        name: admin.name,
        passwordHash: adminPasswordHash,
        role: Role.MEMBER,
        publicKey: admin.publicKey ?? this.generatePublicKey(),
        emailVerified: true,
      },
    });

    const { family, inviteCode } = await this.authService.createFamily(
      adminUser.id,
      familyName,
      this.generateInviteCode(),
    );

    const memberUser = await this.prisma.user.create({
      data: {
        email: memberEmail,
        name: member.name,
        passwordHash: memberPasswordHash,
        role: Role.MEMBER,
        publicKey: member.publicKey ?? this.generatePublicKey(),
        emailVerified: true,
        activeFamilyId: family.id,
      },
    });

    await this.prisma.familyMembership.create({
      data: {
        familyId: family.id,
        userId: memberUser.id,
        role: Role.MEMBER,
      },
    });

    let channel = await this.prisma.channel.findFirst({
      where: {
        familyId: family.id,
        isDefault: true,
      },
    });

    if (!channel) {
      this.logger.error(
        `Expected default channel for family ${family.id}, but none was found.`,
      );
      throw new Error('Family setup failed to create default channel.');
    }

    if (input.channelName && channel.name !== input.channelName) {
      channel = await this.prisma.channel.create({
        data: {
          familyId: family.id,
          name: input.channelName,
          description: `Automated test channel (${input.channelName})`,
          createdById: adminUser.id,
          isDefault: false,
        },
      });
    }

    const [adminAuth, memberAuth] = await Promise.all([
      this.authService.login(adminEmail, admin.password),
      this.authService.login(memberEmail, member.password),
    ]);

    return {
      admin: adminAuth,
      member: memberAuth,
      family,
      channel: this.toChannelType(channel),
      inviteCode,
    };
  }

  /**
   * Create a family admin fixture - single user with family (for invite tests)
   */
  async createFamilyAdminFixture(
    input: TestCreateFamilyAdminFixtureInput,
  ): Promise<FamilyAdminFixturePayload> {
    this.ensureEnabled();

    const { admin, familyName } = input;
    const adminEmail = admin.email.toLowerCase();

    const adminPasswordHash = await bcrypt.hash(admin.password, 10);

    const adminUser = await this.prisma.user.create({
      data: {
        email: adminEmail,
        name: admin.name,
        passwordHash: adminPasswordHash,
        role: Role.MEMBER,
        publicKey: admin.publicKey ?? this.generatePublicKey(),
        emailVerified: true,
      },
    });

    const { family, inviteCode } = await this.authService.createFamily(
      adminUser.id,
      familyName,
      this.generateInviteCode(),
    );

    const adminAuth = await this.authService.login(adminEmail, admin.password);

    this.logger.log(`Created family admin fixture: ${adminEmail} with family ${familyName}`);

    return {
      admin: adminAuth,
      family,
      inviteCode,
    };
  }

  /**
   * Cleanup test data - deletes users and families by ID or email pattern
   */
  async cleanup(input: TestCleanupInput): Promise<CleanupResult> {
    this.ensureEnabled();

    let deletedUsers = 0;
    let deletedFamilies = 0;

    // Delete by family IDs
    if (input.familyIds?.length) {
      // First delete all related data
      for (const familyId of input.familyIds) {
        await this.prisma.invite.deleteMany({ where: { familyId } });
        await this.prisma.message.deleteMany({ where: { channel: { familyId } } });
        await this.prisma.channel.deleteMany({ where: { familyId } });
        await this.prisma.familyMembership.deleteMany({ where: { familyId } });
      }
      const result = await this.prisma.family.deleteMany({
        where: { id: { in: input.familyIds } },
      });
      deletedFamilies += result.count;
    }

    // Delete by user IDs
    if (input.userIds?.length) {
      // Clear active family references first
      await this.prisma.user.updateMany({
        where: { id: { in: input.userIds } },
        data: { activeFamilyId: null },
      });
      // Delete related data
      await this.prisma.emailVerificationToken.deleteMany({
        where: { userId: { in: input.userIds } },
      });
      const result = await this.prisma.user.deleteMany({
        where: { id: { in: input.userIds } },
      });
      deletedUsers += result.count;
    }

    // Delete by email patterns (e.g., "test-*@example.com")
    if (input.emailPatterns?.length) {
      for (const pattern of input.emailPatterns) {
        // Convert glob pattern to SQL LIKE pattern
        const likePattern = pattern.replace(/\*/g, '%');

        // Find matching users
        const users = await this.prisma.user.findMany({
          where: { email: { contains: likePattern.replace(/%/g, '') } },
          select: { id: true, activeFamilyId: true },
        });

        if (users.length > 0) {
          const userIds = users.map((u) => u.id);
          const familyIds = users
            .map((u) => u.activeFamilyId)
            .filter((id): id is string => id !== null);

          // Delete families owned by these users
          if (familyIds.length > 0) {
            for (const familyId of familyIds) {
              await this.prisma.invite.deleteMany({ where: { familyId } });
              await this.prisma.message.deleteMany({ where: { channel: { familyId } } });
              await this.prisma.channel.deleteMany({ where: { familyId } });
              await this.prisma.familyMembership.deleteMany({ where: { familyId } });
            }
            const familyResult = await this.prisma.family.deleteMany({
              where: { id: { in: familyIds } },
            });
            deletedFamilies += familyResult.count;
          }

          // Delete users
          await this.prisma.user.updateMany({
            where: { id: { in: userIds } },
            data: { activeFamilyId: null },
          });
          await this.prisma.emailVerificationToken.deleteMany({
            where: { userId: { in: userIds } },
          });
          const userResult = await this.prisma.user.deleteMany({
            where: { id: { in: userIds } },
          });
          deletedUsers += userResult.count;
        }
      }
    }

    this.logger.log(`Cleanup complete: ${deletedUsers} users, ${deletedFamilies} families deleted`);

    return {
      success: true,
      message: `Deleted ${deletedUsers} users and ${deletedFamilies} families`,
      deletedUsers,
      deletedFamilies,
    };
  }
}
