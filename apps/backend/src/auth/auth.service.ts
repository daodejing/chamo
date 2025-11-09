import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Buffer } from 'buffer';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role } from '@prisma/client';
import type { AuthResponse, UserType, EmailVerificationResponse, GenericResponse, CreateFamilyResponse } from './types/auth-response.type';
import type { FamilyType } from './types/family.type';
import type { FamilyMembershipType } from './types/family-membership.type';
import { EmailService } from '../email/email.service';
import { generateVerificationToken, hashToken } from '../common/utils/token.util';

type FamilySummary = {
  id: string;
  name: string;
  avatar: string | null;
  inviteCode: string;
  maxMembers: number;
};

@Injectable()
export class AuthService {
  // In-memory rate limiting cache for email verification resends
  private resendAttempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  private readonly publicKeyPattern = /^[A-Za-z0-9+/]+={0,2}$/;

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
      publicKey: user.publicKey,
      emailVerified: user.emailVerified,
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
    }> | null;
    accessToken: string;
    refreshToken: string;
  }): AuthResponse {
    return {
      user: this.toUserType(params.user),
      family: params.family ? this.toFamilyType(params.family) : null,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
    } as AuthResponse;
  }

  private validatePublicKey(publicKey: string): string {
    const trimmed = publicKey?.trim();
    if (!trimmed) {
      throw new BadRequestException('Public key is required.');
    }

    if (trimmed.length !== 44 || !this.publicKeyPattern.test(trimmed)) {
      throw new BadRequestException(
        'Invalid public key format. Expected 44-character base64 string.',
      );
    }

    let decoded: Buffer;
    try {
      decoded = Buffer.from(trimmed, 'base64');
    } catch {
      throw new BadRequestException('Invalid public key encoding.');
    }

    if (decoded.length !== 32) {
      throw new BadRequestException(
        'Invalid public key length. Expected 32 bytes.',
      );
    }

    return trimmed;
  }

  async register(
    email: string,
    password: string,
    name: string,
    publicKey: string,
  ): Promise<EmailVerificationResponse> {
    const normalizedPublicKey = this.validatePublicKey(publicKey);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Generate verification token
    const token = generateVerificationToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const { user } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: Role.MEMBER, // No longer ADMIN by default - will be set when creating family
          publicKey: normalizedPublicKey,
          activeFamilyId: null, // No family yet
          emailVerified: false, // User starts unverified
        },
      });

      // Store hashed verification token
      await tx.emailVerificationToken.create({
        data: {
          userId: createdUser.id,
          tokenHash,
          expiresAt,
        },
      });

      return { user: createdUser };
    });

    // Send verification email (fire and forget)
    await this.emailService.sendVerificationEmail(email, token);

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      requiresEmailVerification: true,
      userId: user.id,
    };
  }

  async createFamily(
    userId: string,
    familyName: string,
    inviteCode: string,
  ): Promise<CreateFamilyResponse> {
    // Verify user exists and is verified
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Email must be verified before creating a family');
    }

    // Check if user already has a family (as creator or member)
    const existingMembership = await this.prisma.familyMembership.findFirst({
      where: { userId },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of a family');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Create family
      const createdFamily = await tx.family.create({
        data: {
          name: familyName,
          inviteCode,
          createdBy: userId,
        },
      });

      // Update user to be admin and set active family
      await tx.user.update({
        where: { id: userId },
        data: {
          role: Role.ADMIN,
          activeFamilyId: createdFamily.id,
        },
      });

      // Create family membership
      await tx.familyMembership.create({
        data: {
          familyId: createdFamily.id,
          userId,
          role: Role.ADMIN,
        },
      });

      // Create default General channel
      await tx.channel.create({
        data: {
          name: 'General',
          description: 'Default family channel',
          icon: '💬',
          isDefault: true,
          familyId: createdFamily.id,
          createdById: userId,
        },
      });

      return { family: createdFamily };
    });

    return {
      family: this.toFamilyType(result.family as any),
      inviteCode,
    };
  }

  async joinFamily(
    email: string,
    password: string,
    name: string,
    inviteCode: string,
    publicKey: string,
  ): Promise<EmailVerificationResponse> {
    const normalizedPublicKey = this.validatePublicKey(publicKey);
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

    // Generate verification token
    const token = generateVerificationToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const { user } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: Role.MEMBER,
          publicKey: normalizedPublicKey,
          activeFamilyId: family.id,
          emailVerified: false, // User starts unverified
        },
      });

      await tx.familyMembership.create({
        data: {
          familyId: family.id,
          userId: createdUser.id,
          role: Role.MEMBER,
        },
      });

      // Store hashed verification token
      await tx.emailVerificationToken.create({
        data: {
          userId: createdUser.id,
          tokenHash,
          expiresAt,
        },
      });

      return { user: createdUser };
    });

    // Send verification email (fire and forget)
    await this.emailService.sendVerificationEmail(email, token);

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      requiresEmailVerification: true,
      userId: user.id,
    };
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

  async getUserPublicKey(email: string): Promise<string | null> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email is required.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { publicKey: true },
    });

    return user?.publicKey ?? null;
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

    // Check email verification
    if (!user.emailVerified) {
      throw new ForbiddenException({
        message: 'Email not verified. Please check your inbox.',
        requiresEmailVerification: true,
        email: user.email,
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    const targetFamilyId =
      user.activeFamilyId ?? user.memberships[0]?.familyId ?? null;

    // Allow login without a family - user can create/join later
    const userWithRelations = await this.requireUserWithMemberships(user.id);
    const familyWithMeta = targetFamilyId
      ? await this.requireFamilyWithMeta(targetFamilyId)
      : null;

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

  async verifyEmail(token: string): Promise<AuthResponse> {
    // Hash the provided token to look up in database
    const tokenHash = hashToken(token);

    // Find token in database
    const verificationToken = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Check if already used
    if (verificationToken.usedAt) {
      throw new BadRequestException('This verification token has already been used');
    }

    // Check if expired
    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('This verification token has expired. Please request a new one.');
    }

    // Mark user as verified and token as used
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });

      await tx.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      });
    });

    // Get user with relations
    const user = await this.requireUserWithMemberships(verificationToken.userId);

    // Get active family - may be null if user hasn't created/joined a family yet
    const targetFamilyId = user.activeFamilyId ?? user.memberships[0]?.familyId ?? null;
    const family = targetFamilyId
      ? await this.requireFamilyWithMeta(targetFamilyId)
      : null;

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id, user.activeFamilyId);
    const refreshToken = this.generateRefreshToken(user.id);

    return this.toAuthResponse({
      user,
      family,
      accessToken,
      refreshToken,
    });
  }

  async resendVerificationEmail(email: string): Promise<GenericResponse> {
    // Check rate limiting
    const now = Date.now();
    const attempts = this.resendAttempts.get(email);

    if (attempts) {
      if (attempts.resetAt > now) {
        if (attempts.count >= 5) {
          throw new BadRequestException('Too many resend attempts. Please try again in 15 minutes.');
        }
        attempts.count++;
      } else {
        // Reset window expired, start fresh
        this.resendAttempts.set(email, { count: 1, resetAt: now + 15 * 60 * 1000 });
      }
    } else {
      // First attempt
      this.resendAttempts.set(email, { count: 1, resetAt: now + 15 * 60 * 1000 });
    }

    // Find user by email (return generic success even if not found to prevent enumeration)
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && !user.emailVerified) {
      // Invalidate old unused tokens
      await this.prisma.emailVerificationToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: { usedAt: new Date() }, // Mark as used to invalidate
      });

      // Generate new token
      const token = generateVerificationToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      // Send verification email
      await this.emailService.sendVerificationEmail(email, token);
    }

    // Always return success to prevent email enumeration
    return {
      success: true,
      message: 'If an account exists with this email, a verification email has been sent.',
    };
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

  async createEncryptedInvite(
    inviterId: string,
    familyId: string,
    inviteeEmail: string,
    encryptedFamilyKey: string,
    nonce: string,
    inviteCode: string,
    expiresAt: Date,
  ) {
    // Verify inviter is a member of the family
    const membership = await this.prisma.familyMembership.findUnique({
      where: {
        userId_familyId: {
          userId: inviterId,
          familyId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You must be a family member to create invites');
    }

    // Verify invitee is not already a member
    const normalizedEmail = inviteeEmail.trim().toLowerCase();
    const inviteeUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          where: { familyId },
        },
      },
    });

    if (inviteeUser && inviteeUser.memberships.length > 0) {
      throw new ConflictException('User is already a member of this family');
    }

    // Check for existing pending invite
    const existingInvite = await this.prisma.invite.findFirst({
      where: {
        familyId,
        inviteeEmail: normalizedEmail,
        status: 'PENDING',
      },
    });

    if (existingInvite) {
      throw new ConflictException('A pending invite already exists for this email');
    }

    // Create the invite
    const invite = await this.prisma.invite.create({
      data: {
        familyId,
        inviterId,
        inviteeEmail: normalizedEmail,
        encryptedFamilyKey,
        nonce,
        inviteCode,
        status: 'PENDING',
        expiresAt,
      },
    });

    return {
      invite: {
        ...invite,
        acceptedAt: invite.acceptedAt ?? undefined,
      },
      inviteCode: invite.inviteCode,
      message: `Invite created successfully for ${inviteeEmail}`,
    };
  }

  async acceptInvite(userId: string, inviteCode: string) {
    // Find the invite
    const invite = await this.prisma.invite.findUnique({
      where: { inviteCode },
      include: {
        family: true,
      },
    });

    if (!invite) {
      throw new BadRequestException('Invalid invite code');
    }

    if (invite.status !== 'PENDING') {
      throw new BadRequestException('This invite has already been used or revoked');
    }

    if (invite.expiresAt < new Date()) {
      // Mark as expired
      await this.prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('This invite has expired');
    }

    // Verify the user's email matches the invite
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.email !== invite.inviteeEmail) {
      throw new ForbiddenException('This invite was sent to a different email address');
    }

    // Check if user is already a member
    const existingMembership = await this.prisma.familyMembership.findUnique({
      where: {
        userId_familyId: {
          userId,
          familyId: invite.familyId,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('You are already a member of this family');
    }

    // Create family membership
    await this.prisma.familyMembership.create({
      data: {
        userId,
        familyId: invite.familyId,
        role: Role.MEMBER,
      },
    });

    // Update user's active family if they don't have one
    if (!user.activeFamilyId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { activeFamilyId: invite.familyId },
      });
    }

    // Mark invite as accepted
    await this.prisma.invite.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    return {
      success: true,
      message: `Successfully joined ${invite.family.name}`,
      familyId: invite.familyId,
      familyName: invite.family.name,
      encryptedFamilyKey: invite.encryptedFamilyKey,
      nonce: invite.nonce,
    };
  }
}
