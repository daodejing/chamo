import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
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
});
