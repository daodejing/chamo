import { Test } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { EmailService } from '../src/email/email.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService verifyEmail (integration)', () => {
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
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const emailServiceMock: any = {
    sendVerificationEmail: jest.fn(),
  };

  const jwtServiceMock: any = {
    sign: jest.fn().mockReturnValue('token'),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb: any) =>
      cb({
        user: prismaMock.user,
        emailVerificationToken: prismaMock.emailVerificationToken,
      }),
    );

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

  it('verifies a token, marks the user verified, and returns auth response', async () => {
    const tokenRecord = {
      id: 'token-1',
      userId: 'user-1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 10_000),
      usedAt: null,
      user: {
        id: 'user-1',
        emailVerified: false,
        activeFamilyId: 'family-1',
      },
    };
    prismaMock.emailVerificationToken.findUnique.mockResolvedValue(tokenRecord);
    prismaMock.user.findUnique.mockResolvedValue({
      ...tokenRecord.user,
      emailVerified: true,
      memberships: [
        {
          familyId: 'family-1',
          family: {
            id: 'family-1',
            name: 'Doe Family',
            avatar: null,
            inviteCode: 'FAMILY-CODE',
            maxMembers: 10,
          },
        },
      ],
      activeFamily: {
        id: 'family-1',
        name: 'Doe Family',
        avatar: null,
        inviteCode: 'FAMILY-CODE',
        maxMembers: 10,
      },
    });
    prismaMock.family.findUnique.mockResolvedValue({
      id: 'family-1',
      name: 'Doe Family',
      avatar: null,
      inviteCode: 'FAMILY-CODE',
      maxMembers: 10,
      memberships: [],
    });

    const response = await authService.verifyEmail('plain-token');

    expect(prismaMock.emailVerificationToken.update).toHaveBeenCalledWith({
      where: { id: 'token-1' },
      data: { usedAt: expect.any(Date) },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({ emailVerified: true }),
    });
    expect(response.user.emailVerified).toBe(true);
    expect(jwtServiceMock.sign).toHaveBeenCalled();
    expect(response.family.id).toBe('family-1');
  });
});
