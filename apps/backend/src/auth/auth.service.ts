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
import type { InviteResponse } from './types/invite.type';
import { EmailService } from '../email/email.service';
import { generateVerificationToken, hashToken } from '../common/utils/token.util';
import { generateInviteCode, hashInviteCode } from '../common/utils/invite-code.util';
import { encryptEmail, decryptEmail } from '../common/utils/crypto.util';
import { TelemetryService } from '../telemetry/telemetry.service';

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
    private readonly telemetry: TelemetryService,
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
    pendingInviteCode?: string | null,
  ): Promise<EmailVerificationResponse> {
    const normalizedPublicKey = this.validatePublicKey(publicKey);
    const normalizedPendingInvite =
      pendingInviteCode && pendingInviteCode.trim().length > 0
        ? pendingInviteCode.trim()
        : null;

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
          pendingInviteCode: normalizedPendingInvite,
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
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Story 1.5: Check for email-bound invite first
    const codeHash = hashInviteCode(inviteCode);
    const emailBoundInvite = await this.prisma.familyInvite.findUnique({
      where: { codeHash },
      include: {
        family: {
          include: { memberships: true },
        },
      },
    });

    let family;
    let shouldMarkInviteRedeemed = false;

    if (emailBoundInvite) {
      // Email-bound invite found - validate it (Story 1.5)

      // AC6: Check expiration
      if (emailBoundInvite.expiresAt < new Date()) {
        throw new BadRequestException('This invite code has expired');
      }

      // AC5: Check if already redeemed
      if (emailBoundInvite.redeemedAt) {
        throw new BadRequestException('This invite code has already been used');
      }

      // AC4: Decrypt and compare email (case-insensitive)
      const decryptedEmail = decryptEmail(emailBoundInvite.inviteeEmailEncrypted);

      if (decryptedEmail.toLowerCase() !== normalizedEmail) {
        throw new BadRequestException('This invite code was not sent to your email address');
      }

      // Valid email-bound invite
      family = emailBoundInvite.family;
      shouldMarkInviteRedeemed = true;
    } else {
      // Fall back to Family.inviteCode (Story 1.1/1.2)
      family = await this.prisma.family.findUnique({
        where: { inviteCode },
        include: { memberships: true },
      });

      if (!family) {
        throw new UnauthorizedException('Invalid invite code');
      }
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
          email: normalizedEmail,
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

      // Story 1.5 AC4, AC5: Mark email-bound invite as redeemed
      if (shouldMarkInviteRedeemed && emailBoundInvite) {
        await tx.familyInvite.update({
          where: { id: emailBoundInvite.id },
          data: {
            redeemedAt: new Date(),
            redeemedByUserId: createdUser.id,
          },
        });
      }

      return { user: createdUser };
    });

    // Send verification email (fire and forget)
    await this.emailService.sendVerificationEmail(normalizedEmail, token);

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
      this.telemetry.recordUnverifiedLogin(user.email, 'login');
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

    const pendingInviteCode = verificationToken.pendingInviteCode ?? null;

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

    const response = this.toAuthResponse({
      user,
      family,
      accessToken,
      refreshToken,
    });

    response.pendingInviteCode = pendingInviteCode;

    return response;
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

  async recordInviteDecryptFailure(
    userId: string,
    inviteCode: string,
    reason: string,
  ): Promise<GenericResponse> {
    this.telemetry.recordInviteDecryptFailure(userId, inviteCode, reason);
    return {
      success: true,
      message: 'Invite decrypt failure recorded',
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
        encryptedFamilyKey: invite.encryptedFamilyKey!, // Non-null assertion: always provided for encrypted invites
        nonce: invite.nonce!, // Non-null assertion: always provided for encrypted invites
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
        inviter: true,
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
      encryptedFamilyKey: invite.encryptedFamilyKey!, // Non-null assertion: always present for PENDING status invites
      nonce: invite.nonce!, // Non-null assertion: always present for PENDING status invites
      inviterPublicKey: invite.inviter.publicKey,
    };
  }

  async createPendingInvite(
    inviterId: string,
    familyId: string,
    inviteeEmail: string,
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

    // Check if invitee is registered (has a public key)
    if (inviteeUser?.publicKey) {
      throw new BadRequestException(
        'User is already registered. Use createEncryptedInvite to send them an invite.',
      );
    }

    // Check for existing pending registration invite
    const existingInvite = await this.prisma.invite.findFirst({
      where: {
        familyId,
        inviteeEmail: normalizedEmail,
        status: 'PENDING_REGISTRATION',
      },
    });

    if (existingInvite) {
      throw new ConflictException(
        'A pending registration invite already exists for this email',
      );
    }

    // Generate unique invite code
    const inviteCode = this.generateInviteCode();

    // Create the pending registration invite (no encryption keys yet)
    const invite = await this.prisma.invite.create({
      data: {
        familyId,
        inviterId,
        inviteeEmail: normalizedEmail,
        inviteCode,
        status: 'PENDING_REGISTRATION',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return {
      invite: {
        ...invite,
        encryptedFamilyKey: null,
        nonce: null,
        acceptedAt: invite.acceptedAt ?? undefined,
      },
      inviteCode: invite.inviteCode,
      message: `Registration invitation created for ${inviteeEmail}. They must register before you can complete the invite.`,
    };
  }

  async getPendingInvites(userId: string, familyId: string) {
    // Verify user is a member of the family
    const membership = await this.prisma.familyMembership.findUnique({
      where: {
        userId_familyId: {
          userId,
          familyId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You must be a family member to view invites');
    }

    // Get all pending invites for this family
    const invites = await this.prisma.invite.findMany({
      where: {
        familyId,
        status: {
          in: ['PENDING_REGISTRATION', 'PENDING'],
        },
      },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return invites.map((invite) => ({
      ...invite,
      encryptedFamilyKey: invite.encryptedFamilyKey ?? null,
      nonce: invite.nonce ?? null,
      acceptedAt: invite.acceptedAt ?? undefined,
    }));
  }

  /**
   * Story 1.5: Create email-bound invite
   * Admin specifies invitee email, system generates secure invite code
   * Email is encrypted server-side, invite code is hashed for lookup
   */
  async createInvite(
    userId: string,
    inviteeEmail: string,
  ): Promise<InviteResponse> {
    // Get user's active family
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeFamilyId: true },
    });

    if (!user?.activeFamilyId) {
      throw new BadRequestException('You must have an active family to create invites');
    }

    // Verify user is a member of their active family
    const membership = await this.prisma.familyMembership.findUnique({
      where: {
        userId_familyId: {
          userId,
          familyId: user.activeFamilyId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You must be a family member to create invites');
    }

    // Normalize and validate email
    const normalizedEmail = inviteeEmail.trim().toLowerCase();

    // Verify invitee is not already a member
    const inviteeUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          where: { familyId: user.activeFamilyId },
        },
      },
    });

    if (inviteeUser && inviteeUser.memberships.length > 0) {
      throw new ConflictException('User is already a member of this family');
    }

    // Generate cryptographically secure 22-character invite code
    const inviteCode = generateInviteCode();

    // Hash invite code for database lookup (SHA-256)
    const codeHash = hashInviteCode(inviteCode);

    // Encrypt invitee email using AES-256-GCM
    const inviteeEmailEncrypted = encryptEmail(normalizedEmail);

    // Set expiration to 14 days from now
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Store in family_invites table
    const familyInvite = await this.prisma.familyInvite.create({
      data: {
        code: inviteCode,
        codeHash,
        familyId: user.activeFamilyId,
        inviteeEmailEncrypted,
        inviterId: userId,
        expiresAt,
      },
    });

    // Return response with invite code, email, and expiration
    return {
      inviteCode: familyInvite.code,
      inviteeEmail: normalizedEmail,
      expiresAt: familyInvite.expiresAt,
    };
  }

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous characters
    const parts = [4, 4, 4]; // INV-XXXX-YYYY format
    const code = parts
      .map((length) =>
        Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
      )
      .join('-');
    return `INV-${code}`;
  }
}
