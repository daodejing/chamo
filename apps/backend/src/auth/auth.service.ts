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

    // Generate invite code (format: CODE-XXXX-YYYY)
    const inviteCode = this.generateInviteCode();

    // Generate family key (AES-256 32 bytes = 256 bits)
    const familyKey = this.generateFamilyKey();
    const encryptedFamilyKey = familyKey; // In production, encrypt with user's key

    // Generate E2EE public key placeholder
    const publicKey = 'placeholder-public-key'; // In production, derive from password

    // Create family and user in transaction
    const family = await this.prisma.family.create({
      data: {
        name: familyName,
        inviteCode,
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

    return {
      user,
      family,
      accessToken,
      refreshToken,
    };
  }

  async joinFamily(
    email: string,
    password: string,
    name: string,
    inviteCode: string,
  ) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Find family by invite code
    const family = await this.prisma.family.findUnique({
      where: { inviteCode },
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

    // Get family key from admin (first user)
    const adminUser = family.users[0];
    const familyKey = adminUser.encryptedFamilyKey; // In production, decrypt and re-encrypt
    const encryptedFamilyKey = familyKey;

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

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars
    const segments = [4, 4]; // CODE-XXXX-YYYY format
    const code = segments
      .map((len) =>
        Array.from({ length: len }, () =>
          chars.charAt(Math.floor(Math.random() * chars.length)),
        ).join(''),
      )
      .join('-');
    return `CODE-${code}`;
  }

  private generateFamilyKey(): string {
    // Generate 256-bit (32 bytes) random key
    // In production, use Web Crypto API on client side
    const bytes = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 256),
    );
    return Buffer.from(bytes).toString('base64');
  }
}
