import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role } from '@prisma/client';
import type { AuthResponse, UserType } from './types/auth-response.type';
import type { FamilyType } from './types/family.type';
import type { FamilyMembershipType } from './types/family-membership.type';

type FamilySummary = {
  id: string;
  name: string;
  avatar: string | null;
  inviteCode: string;
  maxMembers: number;
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private readonly userInclude = {
    activeFamily: true,
    memberships: {
      include: {
        family: true,
      },
    },
  } satisfies Prisma.UserInclude;

  private readonly familyInclude = {
    memberships: {
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            email: true,
          },
        },
      },
    },
  } satisfies Prisma.FamilyInclude;

  private async requireUserWithMemberships(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userInclude,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async requireFamilyWithMeta(familyId: string) {
    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      include: this.familyInclude,
    });

    if (!family) {
      throw new UnauthorizedException('Family not found');
    }

    return family;
  }

  private toFamilyType(family: FamilySummary): FamilyType {
    const { id, name, avatar, inviteCode, maxMembers } = family;
    return {
      id,
      name,
      avatar: avatar ?? null,
      inviteCode,
      maxMembers,
    } as FamilyType;
  }

  private toMembershipType(
    membership: Prisma.FamilyMembershipGetPayload<{ include: { family: true } }>,
  ): FamilyMembershipType {
    return {
      id: membership.id,
      role: membership.role,
      joinedAt: membership.joinedAt,
      familyId: membership.familyId,
      family: this.toFamilyType(membership.family),
    } as FamilyMembershipType;
  }

  private toUserType(
    user: Prisma.UserGetPayload<{
      include: {
        activeFamily: true;
        memberships: { include: { family: true } };
      };
    }>,
  ): UserType {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar ?? null,
      role: user.role,
      activeFamilyId: user.activeFamilyId ?? null,
      activeFamily: user.activeFamily
        ? this.toFamilyType(user.activeFamily)
        : null,
      memberships: user.memberships.map((membership) =>
        this.toMembershipType(membership),
      ),
      preferences: (user.preferences as Prisma.JsonValue) ?? null,
    } as UserType;
  }

  private toAuthResponse(params: {
    user: Prisma.UserGetPayload<{
      include: {
        activeFamily: true;
        memberships: { include: { family: true } };
      };
    }>;
    family: Prisma.FamilyGetPayload<{
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true;
                name: true;
                avatar: true;
                email: true;
              };
            };
          };
        };
      };
    }>;
    accessToken: string;
    refreshToken: string;
  }): AuthResponse {
    return {
      user: this.toUserType(params.user),
      family: this.toFamilyType(params.family),
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
    } as AuthResponse;
  }

  async register(
    email: string,
    password: string,
    name: string,
    familyName: string,
    inviteCode: string, // Client-generated invite code
  ): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const publicKey = 'placeholder-public-key';

    const { user, family } = await this.prisma.$transaction(async (tx) => {
      const createdFamily = await tx.family.create({
        data: {
          name: familyName,
          inviteCode,
          createdBy: email,
        },
      });

      const createdUser = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: Role.ADMIN,
          publicKey,
          activeFamilyId: createdFamily.id,
        },
      });

      await tx.family.update({
        where: { id: createdFamily.id },
        data: { createdBy: createdUser.id },
      });

      await tx.familyMembership.create({
        data: {
          familyId: createdFamily.id,
          userId: createdUser.id,
          role: Role.ADMIN,
        },
      });

      await tx.channel.create({
        data: {
          name: 'General',
          description: 'Default family channel',
          icon: '💬',
          isDefault: true,
          familyId: createdFamily.id,
          createdById: createdUser.id,
        },
      });

      return { user: createdUser, family: createdFamily };
    });

    const [userWithRelations, familyWithMeta] = await Promise.all([
      this.requireUserWithMemberships(user.id),
      this.requireFamilyWithMeta(family.id),
    ]);

    const accessToken = this.generateAccessToken(
      userWithRelations.id,
      userWithRelations.activeFamilyId,
    );
    const refreshToken = this.generateRefreshToken(userWithRelations.id);

    return this.toAuthResponse({
      user: userWithRelations,
      family: familyWithMeta,
      accessToken,
      refreshToken,
    });
  }

  async joinFamily(
    email: string,
    password: string,
    name: string,
    inviteCode: string,
  ): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const family = await this.prisma.family.findUnique({
      where: { inviteCode },
      include: { memberships: true },
    });

    if (!family) {
      throw new UnauthorizedException('Invalid invite code');
    }

    if (family.memberships.length >= family.maxMembers) {
      throw new ConflictException('Family is full');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const publicKey = 'placeholder-public-key';

    const { user } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: Role.MEMBER,
          publicKey,
          activeFamilyId: family.id,
        },
      });

      await tx.familyMembership.create({
        data: {
          familyId: family.id,
          userId: createdUser.id,
          role: Role.MEMBER,
        },
      });

      return { user: createdUser };
    });

    const [userWithRelations, familyWithMeta] = await Promise.all([
      this.requireUserWithMemberships(user.id),
      this.requireFamilyWithMeta(family.id),
    ]);

    const accessToken = this.generateAccessToken(
      userWithRelations.id,
      userWithRelations.activeFamilyId,
    );
    const refreshToken = this.generateRefreshToken(userWithRelations.id);

    return this.toAuthResponse({
      user: userWithRelations,
      family: familyWithMeta,
      accessToken,
      refreshToken,
    });
  }

  async joinFamilyAsMember(
    userId: string,
    inviteCode: string,
    makeActive = false,
  ): Promise<FamilyType> {
    const family = await this.prisma.family.findUnique({
      where: { inviteCode },
      include: {
        memberships: true,
      },
    });

    if (!family) {
      throw new UnauthorizedException('Invalid invite code');
    }

    if (family.memberships.length >= family.maxMembers) {
      throw new ConflictException('Family is full');
    }

    const existingMembership = await this.prisma.familyMembership.findUnique({
      where: {
        userId_familyId: {
          userId,
          familyId: family.id,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('You already belong to this family');
    }

    await this.prisma.familyMembership.create({
      data: {
        familyId: family.id,
        userId,
        role: Role.MEMBER,
      },
    });

    if (makeActive) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { activeFamilyId: family.id },
      });
    }

    const familyWithMeta = await this.requireFamilyWithMeta(family.id);
    return this.toFamilyType(familyWithMeta);
  }

  async switchActiveFamily(
    userId: string,
    familyId: string,
  ): Promise<UserType> {
    const membership = await this.prisma.familyMembership.findUnique({
      where: {
        userId_familyId: {
          userId,
          familyId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this family');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { activeFamilyId: familyId },
    });

    const userWithRelations = await this.requireUserWithMemberships(
      updatedUser.id,
    );
    return this.toUserType(userWithRelations);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        activeFamily: true,
        memberships: {
          include: { family: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    const targetFamilyId =
      user.activeFamilyId ?? user.memberships[0]?.familyId ?? null;

    if (!targetFamilyId) {
      throw new ForbiddenException('Active family not set for this user');
    }

    const [userWithRelations, familyWithMeta] = await Promise.all([
      this.requireUserWithMemberships(user.id),
      this.requireFamilyWithMeta(targetFamilyId),
    ]);

    const accessToken = this.generateAccessToken(
      userWithRelations.id,
      userWithRelations.activeFamilyId,
    );
    const refreshToken = this.generateRefreshToken(userWithRelations.id);

    return this.toAuthResponse({
      user: userWithRelations,
      family: familyWithMeta,
      accessToken,
      refreshToken,
    });
  }

  async validateUser(userId: string): Promise<UserType> {
    const user = await this.requireUserWithMemberships(userId);
    return this.toUserType(user);
  }

  private generateAccessToken(userId: string, activeFamilyId?: string | null) {
    const payload: Record<string, string> = { sub: userId };
    if (activeFamilyId) {
      payload.familyId = activeFamilyId;
    }

    return this.jwtService.sign(payload, {
      expiresIn: '7d',
    });
  }

  private generateRefreshToken(userId: string): string {
    const payload = { sub: userId };
    return this.jwtService.sign(payload, {
      secret: process.env.REFRESH_TOKEN_SECRET,
      expiresIn: '30d',
    });
  }

  private getFamilyWithMeta(familyId: string) {
    return this.prisma.family.findUnique({
      where: { id: familyId },
      include: this.familyInclude,
    });
  }
}
