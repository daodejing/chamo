import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(
    email: string,
    password: string,
    name: string,
    familyName: string,
    familyKeyBase64: string, // Client-generated family key
  ) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate invite code with embedded family key (format: FAMILY-XXXXXXXX:BASE64KEY)
    const inviteCodeWithKey = this.generateInviteCodeWithKey(familyKeyBase64);

    // Parse to extract code portion for database storage
    const { code: inviteCode } = this.parseInviteCode(inviteCodeWithKey);

    // Store the family key (client-side generated, E2EE model)
    const encryptedFamilyKey = familyKeyBase64; // Shared family key model (no per-user encryption needed)

    // Generate E2EE public key placeholder
    const publicKey = 'placeholder-public-key'; // In production, derive from password

    // Create family and user in transaction
    const family = await this.prisma.family.create({
      data: {
        name: familyName,
        inviteCode, // Store only code portion (FAMILY-XXXXXXXX) in database
        createdBy: email, // Will update with userId after user creation
        users: {
          create: {
            email,
            name,
            passwordHash,
            role: Role.ADMIN,
            encryptedFamilyKey,
            publicKey,
          },
        },
        channels: {
          create: {
            name: 'General',
            description: 'Default family channel',
            icon: '💬',
            isDefault: true,
            createdBy: {
              connect: { email },
            },
          },
        },
      },
      include: {
        users: true,
      },
    });

    const user = family.users[0];

    // Generate JWT tokens
    const accessToken = this.generateAccessToken(user.id, user.familyId);
    const refreshToken = this.generateRefreshToken(user.id);

    // Replace family.inviteCode with full invite code (including embedded key) for admin to share
    const familyWithFullInviteCode = {
      ...family,
      inviteCode: inviteCodeWithKey, // Return full format: FAMILY-XXXXXXXX:BASE64KEY
    };

    return {
      user,
      family: familyWithFullInviteCode,
      accessToken,
      refreshToken,
    };
  }

  async joinFamily(
    email: string,
    password: string,
    name: string,
    inviteCodeWithKey: string, // Format: FAMILY-XXXXXXXX:BASE64KEY
  ) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Parse invite code to extract code and family key
    const { code, base64Key } = this.parseInviteCode(inviteCodeWithKey);

    // Find family by invite code (code portion only, without key)
    const family = await this.prisma.family.findUnique({
      where: { inviteCode: code },
      include: { users: true },
    });

    if (!family) {
      throw new UnauthorizedException('Invalid invite code');
    }

    // Check if family is full
    if (family.users.length >= family.maxMembers) {
      throw new ConflictException('Family is full');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Use the family key from invite code (E2EE model - shared family key)
    const encryptedFamilyKey = base64Key;

    const publicKey = 'placeholder-public-key'; // In production, derive from password

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: Role.MEMBER,
        familyId: family.id,
        encryptedFamilyKey,
        publicKey,
      },
    });

    // Generate JWT tokens
    const accessToken = this.generateAccessToken(user.id, user.familyId);
    const refreshToken = this.generateRefreshToken(user.id);

    return {
      user,
      family,
      accessToken,
      refreshToken,
    };
  }

  async login(email: string, password: string) {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { family: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update lastSeenAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    // Generate JWT tokens
    const accessToken = this.generateAccessToken(user.id, user.familyId);
    const refreshToken = this.generateRefreshToken(user.id);

    return {
      user,
      family: user.family,
      accessToken,
      refreshToken,
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { family: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private generateAccessToken(userId: string, familyId: string): string {
    const payload = { sub: userId, familyId };
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

  /**
   * Generates invite code with embedded family encryption key.
   * Format: FAMILY-XXXXXXXX:BASE64KEY
   * Example: FAMILY-A3X9K2P1:dGVzdGtleWV4YW1wbGUxMjM0NTY3ODkwMTIzNDU2Nzg5MA==
   */
  private generateInviteCodeWithKey(familyKeyBase64: string): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars (0/O, 1/I)
    const codeLength = 8; // FAMILY-XXXXXXXX
    const code = Array.from({ length: codeLength }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join('');

    // Return format: FAMILY-XXXXXXXX:BASE64KEY
    return `FAMILY-${code}:${familyKeyBase64}`;
  }

  /**
   * Parses invite code to extract code and embedded family key.
   * @param inviteCodeWithKey - Format: FAMILY-XXXXXXXX:BASE64KEY
   * @returns Object with code and base64 key separated
   */
  private parseInviteCode(inviteCodeWithKey: string): {
    code: string;
    base64Key: string;
  } {
    const parts = inviteCodeWithKey.split(':');

    if (parts.length !== 2) {
      throw new UnauthorizedException(
        'Invalid invite code format. Expected FAMILY-XXXXXXXX:KEY',
      );
    }

    const [code, base64Key] = parts;

    if (!code || !base64Key || !code.startsWith('FAMILY-')) {
      throw new UnauthorizedException(
        'Invalid invite code format. Expected FAMILY-XXXXXXXX:KEY',
      );
    }

    return { code, base64Key };
  }
}
