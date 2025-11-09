import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Buffer } from 'buffer';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

describe('AuthService email verification workflows', () => {
  let authService: AuthService;
  const prismaMock: any = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    family: {
      findUnique: jest.fn(),
    },
    emailVerificationToken: {
      updateMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
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

  afterEach(() => {
    (authService as any).resendAttempts.clear();
  });

  it('throws ForbiddenException with requiresEmailVerification when login is attempted before verification', async () => {
    const hashedPassword = await bcrypt.hash('PlainPassword!1', 8);
    prismaMock.user.findUnique = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      passwordHash: hashedPassword,
      emailVerified: false,
      memberships: [],
    });

    await expect(authService.login('user@example.com', 'PlainPassword!1')).rejects.toMatchObject({
      response: expect.objectContaining({
        requiresEmailVerification: true,
        email: 'user@example.com',
      }),
    });
  });

  it('sends a new verification email when resendVerificationEmail is called for an unverified account', async () => {
    prismaMock.user.findUnique = jest.fn().mockResolvedValue({
      id: 'user-2',
      email: 'member@example.com',
      emailVerified: false,
    });
    prismaMock.emailVerificationToken.updateMany = jest.fn().mockResolvedValue(undefined);
    prismaMock.emailVerificationToken.create = jest.fn().mockResolvedValue(undefined);
    emailServiceMock.sendVerificationEmail = jest.fn().mockResolvedValue(undefined);

    const response = await authService.resendVerificationEmail('member@example.com');

    expect(prismaMock.emailVerificationToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-2',
        usedAt: null,
      },
      data: { usedAt: expect.any(Date) },
    });
    expect(prismaMock.emailVerificationToken.create).toHaveBeenCalled();
    expect(emailServiceMock.sendVerificationEmail).toHaveBeenCalledWith(
      'member@example.com',
      expect.any(String),
    );
    expect(response).toEqual({
      success: true,
      message: expect.stringContaining('If an account exists'),
    });
  });

  describe('public key validation', () => {
    it('accepts well-formed 32-byte base64 keys and trims whitespace', () => {
      const raw = Buffer.alloc(32, 7);
      const base64 = raw.toString('base64');
      const result = (authService as any).validatePublicKey(`  ${base64}  `);
      expect(result).toBe(base64);
    });

    it('rejects values that are not 44 characters long', () => {
      expect(() => (authService as any).validatePublicKey('abcd')).toThrow(
        BadRequestException,
      );
    });

    it('rejects values that match base64 pattern but decode to wrong length', () => {
      const invalid = 'A'.repeat(44);
      expect(() => (authService as any).validatePublicKey(invalid)).toThrow(
        BadRequestException,
      );
    });

    it('rejects characters outside the base64 alphabet', () => {
      const invalid = '!'.repeat(44);
      expect(() => (authService as any).validatePublicKey(invalid)).toThrow(
        BadRequestException,
      );
    });
  });
});
