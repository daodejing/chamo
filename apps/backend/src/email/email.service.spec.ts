import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let mockSendMail: jest.Mock;
  let mockVerify: jest.Mock;

  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables with required SMTP config
    process.env = {
      ...originalEnv,
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      EMAIL_FROM: 'test@example.com',
      EMAIL_FROM_NAME: 'OurChat Test',
      EMAIL_VERIFICATION_URL: 'http://localhost:3002/verify-email',
      APP_BASE_URL: 'http://localhost:3002',
    };

    // Mock nodemailer transport
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
    mockVerify = jest.fn().mockResolvedValue(true);

    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Initialization - Fail Fast', () => {
    it('should initialize successfully with valid SMTP configuration', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();

      service = module.get<EmailService>(EmailService);
      expect(service).toBeDefined();
    });

    it('should throw error when SMTP_HOST is missing', async () => {
      delete process.env.SMTP_HOST;

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [EmailService],
        }).compile();
        module.get<EmailService>(EmailService);
      }).rejects.toThrow('Missing required email configuration: SMTP_HOST');
    });

    it('should throw error when SMTP_PORT is missing', async () => {
      delete process.env.SMTP_PORT;

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [EmailService],
        }).compile();
        module.get<EmailService>(EmailService);
      }).rejects.toThrow('Missing required email configuration: SMTP_PORT');
    });

    it('should throw error when EMAIL_FROM is missing', async () => {
      delete process.env.EMAIL_FROM;

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [EmailService],
        }).compile();
        module.get<EmailService>(EmailService);
      }).rejects.toThrow('Missing required email configuration: EMAIL_FROM');
    });

    it('should throw error when EMAIL_VERIFICATION_URL is missing', async () => {
      delete process.env.EMAIL_VERIFICATION_URL;

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [EmailService],
        }).compile();
        module.get<EmailService>(EmailService);
      }).rejects.toThrow('Missing required email configuration: EMAIL_VERIFICATION_URL');
    });

    it('should list all missing variables in error message', async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.EMAIL_FROM;

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [EmailService],
        }).compile();
        module.get<EmailService>(EmailService);
      }).rejects.toThrow('Missing required email configuration: SMTP_HOST, SMTP_PORT, EMAIL_FROM');
    });

    it('should throw error for invalid SMTP_PORT', async () => {
      process.env.SMTP_PORT = 'not-a-number';

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [EmailService],
        }).compile();
        module.get<EmailService>(EmailService);
      }).rejects.toThrow('Invalid SMTP_PORT');
    });

    it('should throw error when only SMTP_USER is provided without SMTP_PASS', async () => {
      process.env.SMTP_USER = 'user@example.com';
      // SMTP_PASS not set

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [EmailService],
        }).compile();
        module.get<EmailService>(EmailService);
      }).rejects.toThrow('SMTP authentication incomplete');
    });

    it('should throw error when only SMTP_PASS is provided without SMTP_USER', async () => {
      process.env.SMTP_PASS = 'secret';
      // SMTP_USER not set

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          providers: [EmailService],
        }).compile();
        module.get<EmailService>(EmailService);
      }).rejects.toThrow('SMTP authentication incomplete');
    });

    it('should accept both SMTP_USER and SMTP_PASS together', async () => {
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'secret';

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();

      service = module.get<EmailService>(EmailService);
      expect(service).toBeDefined();

      // Verify auth was configured
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: { user: 'user@example.com', pass: 'secret' },
        }),
      );
    });

    it('should use default EMAIL_FROM_NAME if not provided', async () => {
      delete process.env.EMAIL_FROM_NAME;

      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();

      service = module.get<EmailService>(EmailService);
      expect(service).toBeDefined();
    });
  });

  describe('sendVerificationEmail', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();
      service = module.get<EmailService>(EmailService);
    });

    it('should reject invalid email format', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.sendVerificationEmail('invalid-email', 'token123');

      expect(mockSendMail).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('Invalid email format: invalid-email');
      loggerSpy.mockRestore();
    });

    it('should send verification email with correct parameters', async () => {
      const email = 'user@example.com';
      const token = 'test-verification-token-123';

      await service.sendVerificationEmail(email, token);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"OurChat Test" <test@example.com>',
          to: 'user@example.com',
          subject: 'Verify your email - Chamo',
          html: expect.stringContaining('http://localhost:3002/verify-email?token=test-verification-token-123'),
          text: expect.stringContaining('http://localhost:3002/verify-email?token=test-verification-token-123'),
        }),
      );
    });

    it('should handle email sending errors gracefully', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      mockSendMail.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.sendVerificationEmail('user@example.com', 'token123'),
      ).resolves.not.toThrow();

      loggerSpy.mockRestore();
    });

    it('should retry once on transient network error', async () => {
      mockSendMail
        .mockRejectedValueOnce({ code: 'ECONNRESET', message: 'Connection reset' })
        .mockResolvedValueOnce({ messageId: 'retry-success' });

      await service.sendVerificationEmail('user@example.com', 'token123');

      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendWelcomeEmail', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();
      service = module.get<EmailService>(EmailService);
    });

    it('should reject invalid email format', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.sendWelcomeEmail('not-an-email', 'John Doe');

      expect(mockSendMail).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('Invalid email format: not-an-email');
      loggerSpy.mockRestore();
    });

    it('should send welcome email with correct parameters', async () => {
      const email = 'user@example.com';
      const userName = 'John Doe';

      await service.sendWelcomeEmail(email, userName);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"OurChat Test" <test@example.com>',
          to: 'user@example.com',
          subject: 'Welcome to Chamo!',
          html: expect.stringContaining('John Doe'),
          text: expect.stringContaining('John Doe'),
        }),
      );
    });
  });

  describe('sendInviteNotification', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();
      service = module.get<EmailService>(EmailService);
    });

    it('should reject invalid email format', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.sendInviteNotification('invalid', 'Family', 'CODE');

      expect(mockSendMail).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('Invalid email format: invalid');
      loggerSpy.mockRestore();
    });

    it('should send invite notification with correct parameters', async () => {
      const email = 'invitee@example.com';
      const familyName = 'Smith Family';
      const inviteCode = 'SMITH123';

      await service.sendInviteNotification(email, familyName, inviteCode);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'invitee@example.com',
          subject: "You've been invited to join Smith Family on Chamo",
          html: expect.stringContaining('accept-invite?code=SMITH123'),
        }),
      );
    });

    it('should send invite notification in Japanese when ja language is specified', async () => {
      await service.sendInviteNotification('invitee@example.com', 'Sakura Family', 'SAKURA123', 'ja');

      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.subject).toContain('招待');
      expect(callArg.html).toContain('招待コード');
    });
  });

  describe('sendRegistrationInviteEmail', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();
      service = module.get<EmailService>(EmailService);
    });

    it('should reject invalid invitee email', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.sendRegistrationInviteEmail('bad-email', 'The Parkers', 'Sam');

      expect(mockSendMail).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('Invalid email format: bad-email');
      loggerSpy.mockRestore();
    });

    it('should send registration invite with correct CTA', async () => {
      const email = 'guest@example.com';
      await service.sendRegistrationInviteEmail(email, 'Team Nova', 'Ava');

      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.subject).toContain('Team Nova');
      expect(callArg.html).toContain('Create your account');
      expect(callArg.html).toContain(encodeURIComponent(email));
    });

    it('should send registration invite in Japanese when ja language is specified', async () => {
      await service.sendRegistrationInviteEmail('guest@example.com', 'Team Nova', 'Ava', 'ja');

      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.html).toContain('もう少しです');
      expect(callArg.html).toContain('アカウントを作成');
    });
  });

  describe('sendInviteeRegistrationNotification', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();
      service = module.get<EmailService>(EmailService);
    });

    it('should reject invalid inviter email', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.sendInviteeRegistrationNotification('invalid', 'member@example.com', 'Lumen Family');

      expect(mockSendMail).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('Invalid inviter email format: invalid');
      loggerSpy.mockRestore();
    });

    it('should notify inviter with pending invite instructions', async () => {
      await service.sendInviteeRegistrationNotification('admin@example.com', 'member@example.com', 'Orbit Family');

      const callArg = mockSendMail.mock.calls[0][0];
      expect(callArg.subject).toContain('member@example.com');
      expect(callArg.html).toContain('Complete invite now');
    });
  });
});
