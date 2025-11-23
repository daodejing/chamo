import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { MessagingFixturePayload } from './test-support.types';
import { TestCreateMessagingFixtureInput } from './test-support.inputs';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Role, Channel as PrismaChannel } from '@prisma/client';
import { Channel as ChannelType } from '../channels/types/channel.type';

@Injectable()
export class TestSupportService {
  private readonly logger = new Logger(TestSupportService.name);
  private readonly isEnabled =
    process.env.ENABLE_TEST_SUPPORT === 'true' ||
    process.env.NODE_ENV !== 'production';

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
}
